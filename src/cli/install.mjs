/**
 * 安装、卸载与更新。
 *
 * 标准模式：把内核注入宿主载体文件（AGENTS.md 等），标记包裹，卸载即还原。
 *   同时为每个宿主创建软链接并注入 hooks（载体文件 + hooks + symlink 三步走）。
 *   Cursor 例外：不注入载体文件（无全局规则文件），仅创建软链接和 hooks。
 * 全局模式：在标准模式之上叠加宿主原生插件安装。
 *
 * 切换安装方式时先移除旧方式的落盘内容，再写入新方式。
 */
import { execFileSync, execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { readInstallState, writeInstallState } from '../kernel/config.mjs'
import { ensureDir, fileExists, readJson, readText, removePath, writeJsonAtomic, writeTextAtomic } from '../kernel/fsx.mjs'
import { appDir, helloagentsRoot, toPosix, userConfigPath } from '../kernel/paths.mjs'
import { injectKernel, readKernelText, removeKernel } from '../hosts/carriers.mjs'
import { resolveDshHome } from '../hosts/registry.mjs'
import { backupCodexConfig, removeCodexBackups } from '../hosts/codex-backup.mjs'
import { installCodexManagedConfig, uninstallCodexManagedConfig } from '../hosts/codex-config.mjs'
import { installCodexHooks, uninstallCodexHooks } from '../hosts/codex-hooks.mjs'
import {
  installDshPlugin,
  removeDshSkills,
  syncDshSkills,
  uninstallDshPlugin,
} from '../hosts/dsh-config.mjs'
import { removeCursorHooks, removeSettingsHooks, upsertCursorHooks, upsertSettingsHooks } from '../hosts/hooks-config.mjs'
import {
  installClaudePlugin,
  installCodexPlugin,
  installCursorPlugin,
  installGrokPlugin,
  installHermesPlugin,
  uninstallClaudePlugin,
  uninstallCodexPlugin,
  uninstallCursorPlugin,
  uninstallGrokPlugin,
  uninstallHermesPlugin,
} from '../hosts/plugins.mjs'
import { applyAddon, enabledAddons } from './addons.mjs'
import { removeApp, syncApp } from './runtime-app.mjs'

/** @typedef {import('../hosts/registry.mjs').HostAdapter} HostAdapter */
/** @typedef {import('./main.mjs').CliContext} CliContext */
/** @typedef {import('../kernel/config.mjs').InstallSource} InstallSource */

// ── 工具函数 ────────────────────────────────────────────────────────────

/** @param {string} packageRootPath @returns {InstallSource} */
function detectSource(packageRootPath) {
  if (!fileExists(join(packageRootPath, '.git'))) {
    return { type: 'npm' }
  }
  try {
    const url = execSync('git remote get-url origin', { cwd: packageRootPath, encoding: 'utf-8', timeout: 10000 }).trim()
    const branch = execSync('git branch --show-current', { cwd: packageRootPath, encoding: 'utf-8', timeout: 10000 }).trim()
    if (url && branch) {
      return { type: 'git', url, branch, path: packageRootPath }
    }
  } catch {
    // git 不可用时回退
  }
  return { type: 'npm' }
}

/** @param {Extract<InstallSource, {type: 'git'}>} source */
function gitPullSource(source) {
  try {
    const options = { cwd: source.path, encoding: /** @type {const} */ ('utf-8'), timeout: 60000 }
    const branch = execFileSync('git', ['branch', '--show-current'], options).trim()
    if (branch !== source.branch || execFileSync('git', ['status', '--porcelain'], options).trim()) return null
    execFileSync('git', ['pull', '--ff-only', 'origin', source.branch], options)
    return source.path
  } catch {
    return null
  }
}

/** @param {string} target @param {string} linkPath */
function createSymlink(target, linkPath) {
  if (fileExists(linkPath)) return
  try {
    ensureDir(dirname(linkPath))
    if (process.platform === 'win32') {
      execSync(`cmd /c mklink /J "${linkPath}" "${target}"`, { encoding: 'utf-8', timeout: 10000 })
    } else {
      execSync(`ln -s "${target}" "${linkPath}"`, { encoding: 'utf-8', timeout: 5000 })
    }
  } catch {
    // 软链接创建失败不阻断主流程
  }
}

// ── 宿主 hooks 安装 / 卸载 ─────────────────────────────────────────────

/**
 * 判断一条独立 hooks 文件中的内层命令是否属于附加组件（guard 或 notify）。
 * 基础 hooks 使用 helloagents-js，附加组件使用运行副本中的 guard.mjs 或 notify.mjs。
 * @param {unknown} command
 */
function isAddonHookCommand(command) {
  const value = String(command || '')
  return value.includes('/guard.mjs') || value.includes('/notify.mjs')
}

/**
 * 合并写入独立 hooks 文件：保留已有的附加组件条目，仅替换基础条目。
 * @param {string} hooksPath
 * @param {{hooks?: Record<string, unknown[]>}} hooksData
 */
function mergeGrokHooksFile(hooksPath, hooksData) {
  const baseHooks = hooksData && typeof hooksData.hooks === 'object' && hooksData.hooks
    ? /** @type {Record<string, unknown[]>} */ (hooksData.hooks)
    : {}
  const existing = /** @type {{hooks?: Record<string, unknown[]>} | null} */ (readJson(hooksPath))
  const current = existing && typeof existing.hooks === 'object' && existing.hooks
    ? /** @type {Record<string, unknown[]>} */ (existing.hooks)
    : {}
  /** @type {Record<string, unknown[]>} */
  const merged = {}
  const events = new Set([...Object.keys(current), ...Object.keys(baseHooks)])
  for (const event of events) {
    const kept = Array.isArray(current[event]) ? current[event].filter((group) => {
      if (!group || typeof group !== 'object') return true
      const inner = Array.isArray(/** @type {{hooks?: unknown}} */ (group).hooks)
        ? /** @type {Array<{command?: unknown}>} */ (/** @type {{hooks?: unknown}} */ (group).hooks)
        : []
      return inner.some((hook) => isAddonHookCommand(hook?.command))
    }) : []
    const base = Array.isArray(baseHooks[event]) ? baseHooks[event] : []
    const combined = [...kept, ...base]
    if (combined.length > 0) merged[event] = combined
  }
  writeJsonAtomic(hooksPath, { hooks: merged })
}

/**
 * 从 hooks 定义文件中读取 hooks 内容并注入到宿主对应配置。
 * 根据宿主类型选择不同的注入方式。
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 */
function installHostHooks(ctx, host) {
  const hooksFile = join(ctx.app, 'hooks', `hooks-${host.id}.json`)
  const hooksData = /** @type {{hooks?: Record<string, Array<{matcher?: string, hooks: Array<{type: string, command: string, timeout?: number}>}>>} | null} */ (readJson(hooksFile))
  if (!hooksData || !hooksData.hooks) return

  if (host.id === 'claude') {
    const settingsPath = host.settingsPath(ctx.home)
    if (!settingsPath) return
    upsertSettingsHooks(settingsPath, hooksData.hooks, { home: ctx.home })
  } else if (host.id === 'codex') {
    const hooksPath = join(ctx.home, '.codex', 'hooks.json')
    installCodexHooks(hooksPath, hooksData.hooks)
  } else if (host.id === 'grok') {
    const hooksPath = join(ctx.home, '.grok', 'hooks', 'helloagents.json')
    mergeGrokHooksFile(hooksPath, hooksData)
  } else if (host.id === 'cursor') {
    const hooksPath = join(ctx.home, '.cursor', 'hooks.json')
    /** @type {Record<string, Array<{ command: string, timeout?: number }>>} */
    const flat = {}
    for (const [event, groups] of Object.entries(hooksData.hooks)) {
      if (!Array.isArray(groups)) continue
      flat[event] = groups.flatMap((g) => {
        if (g && typeof g === 'object' && Array.isArray(/** @type {{hooks?: unknown}} */ (g).hooks)) {
          const nested = /** @type {unknown} */ (/** @type {{hooks?: unknown}} */ (g).hooks)
          return /** @type {Array<{command: string, timeout?: number}>} */ (nested).map((h) => ({ command: h.command, timeout: h.timeout }))
        }
        if (g && typeof g === 'object' && typeof /** @type {{command?: unknown}} */ (g).command === 'string') {
          const entry = /** @type {unknown} */ (g)
          const typed = /** @type {{command: string, timeout?: number}} */ (entry)
          return [{ command: typed.command, ...(typed.timeout !== undefined ? { timeout: typed.timeout } : {}) }]
        }
        return []
      })
    }
    upsertCursorHooks(hooksPath, flat, { home: ctx.home })
  } else if (host.id === 'hermes') {
    // Hermes hooks 通过 plugin 系统管理
  }
}

/** @param {CliContext} ctx @param {HostAdapter} host */
function uninstallHostHooks(ctx, host) {
  if (host.id === 'claude') {
    const settingsPath = host.settingsPath(ctx.home)
    if (settingsPath) removeSettingsHooks(settingsPath, { home: ctx.home })
  } else if (host.id === 'codex') {
    const hooksPath = join(ctx.home, '.codex', 'hooks.json')
    uninstallCodexHooks(hooksPath)
  } else if (host.id === 'grok') {
    removePath(join(ctx.home, '.grok', 'hooks', 'helloagents.json'))
  } else if (host.id === 'cursor') {
    const hooksPath = join(ctx.home, '.cursor', 'hooks.json')
    removeCursorHooks(hooksPath, { home: ctx.home })
  }
}

// ── 宿主标准模式安装 / 卸载 ────────────────────────────────────────────

/**
 * 单个宿主标准模式安装：载体文件 + 软链接 + hooks。
 * Cursor 无载体文件，跳过内核注入。
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 * @param {string} kernel
 */
function installHostStandard(ctx, host, kernel) {
  // 1. 载体文件注入（Cursor 无全局规则文件，仅安装钩子与软链接）
  const carrier = host.carrierPath(ctx.home)
  if (carrier) {
    injectKernel(carrier, kernel, ctx.version)
    ctx.log(ctx.t('install.standard.done', { host: host.label, path: carrier }))
  } else {
    ctx.log(ctx.t('install.standard.hooksDone', { host: host.label }))
  }

  // 2. 软链接（dsh 跟随 $DSH_HOME）
  const linkPath =
    host.id === 'dsh'
      ? join(resolveDshHome(ctx.home), 'helloagents')
      : join(ctx.home, `.${host.id}`, 'helloagents')
  createSymlink(ctx.app, linkPath)

  // 3. hooks 注入（dsh 无用户级 hooks，hooks-dsh.json 不存在时自动跳过）
  installHostHooks(ctx, host)

  // 4. dsh 原生技能目录同步
  if (host.id === 'dsh') {
    const synced = syncDshSkills(ctx.home, ctx.app)
    if (!synced.ok) {
      ctx.log(ctx.t('install.dshSkillsFailed', { message: synced.reason }))
    }
  }

  // 5. Codex 额外配置
  if (host.id === 'codex') {
    try {
      const configPath = String(host.codexConfigPath(ctx.home))
      backupCodexConfig(ctx.home, configPath)
      const hooksPath = join(ctx.home, '.codex', 'hooks.json')
      const hooksData = readJson(hooksPath)
      installCodexManagedConfig(configPath, hooksPath, hooksData, join(helloagentsRoot(ctx.home), 'backups', 'codex'))
    } catch (error) {
      ctx.log(ctx.t('install.codexExtrasFailed', { message: error instanceof Error ? error.message : String(error) }))
    }
  }
}

/** @param {CliContext} ctx @param {HostAdapter} host */
function uninstallHostStandard(ctx, host) {
  // 载体文件
  const carrier = host.carrierPath(ctx.home)
  if (carrier) removeKernel(carrier)

  // 软链接（dsh 跟随 $DSH_HOME）
  const linkPath =
    host.id === 'dsh'
      ? join(resolveDshHome(ctx.home), 'helloagents')
      : join(ctx.home, `.${host.id}`, 'helloagents')
  removePath(linkPath)

  // hooks
  uninstallHostHooks(ctx, host)

  // dsh 原生技能目录清理
  if (host.id === 'dsh') {
    removeDshSkills(ctx.home, ctx.app)
  }

  // Codex 额外清理
  if (host.id === 'codex') {
    try {
      const configPath = String(host.codexConfigPath(ctx.home))
      uninstallCodexManagedConfig(configPath, join(helloagentsRoot(ctx.home), 'backups', 'codex'))
      removeCodexBackups(ctx.home)
    } catch { /* 清理异常不中断 */ }
  }
}

// ── 全局模式插件 ────────────────────────────────────────────────────────

/** @param {CliContext} ctx @param {HostAdapter} host */
function installHostPlugin(ctx, host) {
  if (host.id === 'claude') return installClaudePlugin(ctx.home, ctx.app)
  if (host.id === 'cursor') return installCursorPlugin(ctx.home, ctx.app)
  if (host.id === 'codex') return installCodexPlugin(ctx.home, ctx.app)
  if (host.id === 'grok') return installGrokPlugin(ctx.home, ctx.app)
  if (host.id === 'hermes') return installHermesPlugin(ctx.home, ctx.app)
  if (host.id === 'dsh') return installDshPlugin(ctx.home, ctx.app)
  return { ok: false }
}

/** @param {CliContext} ctx @param {HostAdapter} host */
function uninstallHostPlugin(ctx, host) {
  if (host.id === 'claude') return uninstallClaudePlugin(ctx.home)
  if (host.id === 'cursor') return uninstallCursorPlugin(ctx.home)
  if (host.id === 'codex') return uninstallCodexPlugin(ctx.home)
  if (host.id === 'grok') return uninstallGrokPlugin(ctx.home)
  if (host.id === 'hermes') return uninstallHermesPlugin(ctx.home)
  if (host.id === 'dsh') return uninstallDshPlugin(ctx.home)
  return { ok: true }
}

/** @param {string} home */
function ensureUserConfig(home) {
  const path = userConfigPath(home)
  const defaults = { language: null, notify: { sound: true, desktop: false } }
  const existing = /** @type {Partial<typeof defaults> | null} */ (readJson(path))
  if (!existing) {
    writeJsonAtomic(path, defaults)
    return
  }
  // 合并缺失的默认键
  let changed = false
  const merged = { ...existing }
  if (!('notify' in merged) || typeof merged.notify !== 'object' || !merged.notify) {
    merged.notify = defaults.notify
    changed = true
  } else {
    const n = /** @type {Record<string, unknown>} */ (merged.notify)
    if (!('sound' in n)) { n.sound = defaults.notify.sound; changed = true }
    if (!('desktop' in n)) { n.desktop = defaults.notify.desktop; changed = true }
  }
  if (!('language' in merged)) { merged.language = defaults.language; changed = true }
  if (changed) writeJsonAtomic(path, merged)
}

// ── 主流程 ──────────────────────────────────────────────────────────────

/** @param {CliContext} ctx @param {HostAdapter[]} targets @param {'standard' | 'global' | null} requestedMode */
export function runInstall(ctx, targets, requestedMode) {
  const version = syncApp(ctx.packageRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(ctx.t('install.kernelMissing', { path: join(ctx.app, 'prompts', 'kernel.md') }))

  const state = readInstallState(ctx.home)
  state.source = detectSource(ctx.packageRoot)

  // 首次安装时写入默认用户配置
  ensureUserConfig(ctx.home)

  let installedCount = 0

  for (const host of targets) {
    const desired = requestedMode ?? (host.capabilities.global ? 'global' : 'standard')
    if (!host.capabilities[desired]) {
      const supported = ['standard', 'global'].filter(
        (mode) => host.capabilities[/** @type {'standard' | 'global'} */ (mode)],
      )
      ctx.log(ctx.t('install.mode.unsupported', { host: host.label, mode: desired, supported: supported.join('、') || '-' }))
      continue
    }

    const prior = state.hosts[host.id]
    if (prior && prior.mode !== desired) {
      if (prior.mode === 'global') uninstallHostPlugin(ctx, host)
      ctx.log(ctx.t('install.switched', { host: host.label, from: prior.mode, to: desired }))
    }

    let finalMode = desired
    if (desired === 'global') {
      const result = installHostPlugin(ctx, host)
      if (result.ok) {
        ctx.log(ctx.t('install.global.done', { host: host.label }))
      } else {
        if (result.manualSteps) {
          ctx.log(ctx.t('install.global.manual', { host: host.label, steps: result.manualSteps }))
        }
        if (host.capabilities.standard) {
          finalMode = 'standard'
          ctx.log(ctx.t('install.global.fallback', { host: host.label }))
        } else {
          continue
        }
      }
    }

    // 标准模式安装（载体文件 + hooks + symlink）
    // 全局模式也需执行——全局模式叠加在标准模式之上
    installHostStandard(ctx, host, kernel)

    state.hosts[host.id] = {
      mode: finalMode,
      version: ctx.version,
      updatedAt: new Date().toISOString(),
    }
    installedCount += 1

    const addons = enabledAddons(state, host.id)
    if (addons.guard) applyAddon(ctx, host, 'guard', true, addons)
    if (addons.notify) applyAddon(ctx, host, 'notify', true, addons)
  }

  writeInstallState(ctx.home, state)
  ctx.log(ctx.t('install.summary', { count: installedCount }))
}

/** @param {CliContext} ctx @param {HostAdapter[]} targets @param {{all: boolean, purge: boolean}} options */
export function runUninstall(ctx, targets, options) {
  const state = readInstallState(ctx.home)

  for (const host of targets) {
    applyAddon(ctx, host, 'guard', false, { guard: false, notify: state.addons.notify.includes(host.id) })
    applyAddon(ctx, host, 'notify', false, { guard: false, notify: false })
    state.addons.guard = state.addons.guard.filter((id) => id !== host.id)
    state.addons.notify = state.addons.notify.filter((id) => id !== host.id)

    uninstallHostStandard(ctx, host)

    if (state.hosts[host.id]?.mode === 'global' || host.capabilities.global) {
      uninstallHostPlugin(ctx, host)
    }
    delete state.hosts[host.id]
    ctx.log(ctx.t('uninstall.host.done', { host: host.label }))
  }

  writeInstallState(ctx.home, state)

  if (options.all) {
    removeApp(ctx.app)
    ctx.log(ctx.t('uninstall.app.removed', { path: ctx.app }))
    if (options.purge) {
      removePath(helloagentsRoot(ctx.home))
    } else {
      ctx.log(ctx.t('uninstall.config.kept', { path: helloagentsRoot(ctx.home) }))
    }
  }
}

/** @param {CliContext} ctx @param {HostAdapter[]} allHosts */
export function runUpdate(ctx, allHosts) {
  const state = readInstallState(ctx.home)
  const installed = allHosts.filter((host) => state.hosts[host.id])
  if (installed.length === 0) {
    ctx.log(ctx.t('update.nothing'))
    return
  }

  let sourceRoot = ctx.packageRoot
  if (state.source?.type === 'git') {
    const pulled = gitPullSource(state.source)
    if (pulled) {
      sourceRoot = pulled
      ctx.log(ctx.t('update.gitPulled', { path: pulled, branch: state.source.branch }))
    } else {
      ctx.log(ctx.t('update.gitFallback', { path: state.source.path }))
      sourceRoot = state.source.path
    }
  }

  const version = syncApp(sourceRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(ctx.t('install.kernelMissing', { path: join(ctx.app, 'prompts', 'kernel.md') }))

  for (const host of installed) {
    // 更新载体文件
    const carrier = host.carrierPath(ctx.home)
    if (carrier) injectKernel(carrier, kernel, ctx.version)

    // 更新 hooks（可能已变更）
    installHostHooks(ctx, host)

    // dsh：刷新原生技能目录
    if (host.id === 'dsh') {
      const synced = syncDshSkills(ctx.home, ctx.app)
      if (!synced.ok) {
        ctx.log(ctx.t('install.dshSkillsFailed', { message: synced.reason }))
      }
    }

    // Codex：标准/全局模式均依赖标准层受管配置，统一刷新受管行与 hooks 信任哈希
    if (host.id === 'codex') {
      try {
        const configPath = String(host.codexConfigPath(ctx.home))
        const hooksPath = join(ctx.home, '.codex', 'hooks.json')
        const hooksData = readJson(hooksPath)
        if (hooksData) {
          installCodexManagedConfig(
            configPath,
            hooksPath,
            hooksData,
            join(helloagentsRoot(ctx.home), 'backups', 'codex'),
          )
        }
      } catch { /* 非关键 */ }
    }

    if (state.hosts[host.id]?.mode === 'global') {
      installHostPlugin(ctx, host)
    }
    const addons = enabledAddons(state, host.id)
    if (addons.guard) applyAddon(ctx, host, 'guard', true, addons)
    if (addons.notify) applyAddon(ctx, host, 'notify', true, addons)
    const entry = state.hosts[host.id]
    if (entry) {
      entry.version = ctx.version
      entry.updatedAt = new Date().toISOString()
    }
  }

  state.source = detectSource(sourceRoot)
  writeInstallState(ctx.home, state)
  ctx.log(ctx.t('update.done', { count: installed.length, version: ctx.version }))
}

/**
 * 安装、卸载与更新。
 * 内核注入对所有具备载体文件的宿主统一执行；全局模式在标准模式之上叠加宿主原生插件。
 * 切换安装方式时先移除旧方式的落盘内容，再写入新方式。
 */
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { readInstallState, writeInstallState } from '../kernel/config.mjs'
import { fileExists, removePath } from '../kernel/fsx.mjs'
import { helloagentsRoot } from '../kernel/paths.mjs'
import { injectKernel, readKernelText, removeKernel } from '../hosts/carriers.mjs'
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

/**
 * 检测 packageRoot 是否为 git 仓库，返回对应的安装源信息。
 * @param {string} packageRootPath
 * @returns {InstallSource}
 */
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
    // git 命令不可用或仓库异常，回退到 npm 模式
  }
  return { type: 'npm' }
}

/**
 * 从 git 克隆目录拉取最新代码。
 * @param {import('../kernel/config.mjs').GitSource} source
 * @returns {string | null} 成功返回路径，失败返回 null
 */
function gitPullSource(source) {
  try {
    execSync(`git fetch origin ${source.branch}`, { cwd: source.path, encoding: 'utf-8', timeout: 60000 })
    execSync(`git checkout ${source.branch}`, { cwd: source.path, encoding: 'utf-8', timeout: 30000 })
    execSync(`git reset --hard origin/${source.branch}`, { cwd: source.path, encoding: 'utf-8', timeout: 30000 })
    return source.path
  } catch {
    return null
  }
}

/**
 * 执行宿主的全局模式插件安装。
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 * @returns {{ ok: boolean, manualSteps?: string }}
 */
function installHostPlugin(ctx, host) {
  if (host.id === 'claude') return installClaudePlugin(ctx.home, ctx.app)
  if (host.id === 'cursor') return installCursorPlugin(ctx.home, ctx.app)
  if (host.id === 'codex') return installCodexPlugin(ctx.home, ctx.app)
  if (host.id === 'grok') return installGrokPlugin(ctx.home, ctx.app)
  if (host.id === 'hermes') return installHermesPlugin(ctx.home, ctx.app)
  return { ok: false }
}

/**
 * 执行宿主的全局模式插件卸载。
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 */
function uninstallHostPlugin(ctx, host) {
  if (host.id === 'claude') return uninstallClaudePlugin(ctx.home)
  if (host.id === 'cursor') return uninstallCursorPlugin(ctx.home)
  if (host.id === 'codex') return uninstallCodexPlugin(ctx.home)
  if (host.id === 'grok') return uninstallGrokPlugin(ctx.home)
  if (host.id === 'hermes') return uninstallHermesPlugin(ctx.home)
  return { ok: true }
}

/**
 * 安装到指定宿主。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} targets
 * @param {'standard' | 'global' | null} requestedMode
 */
export function runInstall(ctx, targets, requestedMode) {
  const version = syncApp(ctx.packageRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(ctx.t('install.kernelMissing', { path: join(ctx.app, 'prompts', 'kernel.md') }))

  const state = readInstallState(ctx.home)
  // 记录安装源，供后续 update 使用。
  state.source = detectSource(ctx.packageRoot)
  let installedCount = 0

  for (const host of targets) {
    const desired = requestedMode ?? (host.capabilities.global ? 'global' : 'standard')
    if (!host.capabilities[desired]) {
      const supported = ['standard', 'global'].filter(
        (mode) => host.capabilities[/** @type {'standard' | 'global'} */ (mode)],
      )
      ctx.log(
        ctx.t('install.mode.unsupported', {
          host: host.label,
          mode: desired,
          supported: supported.join('、') || '-',
        }),
      )
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

    const carrier = host.carrierPath(ctx.home)
    if (carrier) {
      injectKernel(carrier, kernel, ctx.version)
      ctx.log(ctx.t('install.standard.done', { host: host.label, path: carrier }))
    }

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

/**
 * 从指定宿主卸载；--all 时同时删除运行副本。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} targets
 * @param {{ all: boolean, purge: boolean }} options
 */
export function runUninstall(ctx, targets, options) {
  const state = readInstallState(ctx.home)

  for (const host of targets) {
    applyAddon(ctx, host, 'guard', false, { guard: false, notify: state.addons.notify.includes(host.id) })
    applyAddon(ctx, host, 'notify', false, { guard: false, notify: false })
    state.addons.guard = state.addons.guard.filter((id) => id !== host.id)
    state.addons.notify = state.addons.notify.filter((id) => id !== host.id)

    const carrier = host.carrierPath(ctx.home)
    if (carrier) removeKernel(carrier)
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

/**
 * 刷新运行副本与全部已安装宿主。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} allHosts
 */
export function runUpdate(ctx, allHosts) {
  const state = readInstallState(ctx.home)
  const installed = allHosts.filter((host) => state.hosts[host.id])
  if (installed.length === 0) {
    ctx.log(ctx.t('update.nothing'))
    return
  }

  // git 源：先拉取再同步；npm 源或无记录：沿用当前包路径。
  let sourceRoot = ctx.packageRoot
  if (state.source?.type === 'git') {
    const pulled = gitPullSource(state.source)
    if (pulled) {
      sourceRoot = pulled
      ctx.log(`Git 仓库已更新：${pulled}（${state.source.branch}）`)
    } else {
      ctx.log(`Git 拉取失败，使用本地副本：${state.source.path}`)
      sourceRoot = state.source.path
    }
  }

  const version = syncApp(sourceRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(ctx.t('install.kernelMissing', { path: join(ctx.app, 'prompts', 'kernel.md') }))

  for (const host of installed) {
    const carrier = host.carrierPath(ctx.home)
    if (carrier) injectKernel(carrier, kernel, ctx.version)
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

  // git 源版本可能已变，重新检测并更新。
  state.source = detectSource(sourceRoot)
  writeInstallState(ctx.home, state)
  ctx.log(ctx.t('update.done', { count: installed.length, version: ctx.version }))
}

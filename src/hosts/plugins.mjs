/**
 * 各宿主全局模式（原生插件市场）的安装与卸载。
 *
 * 对齐 hello-ashare 已验证的原生市场安装路径：
 * - Claude Code：~/.claude/plugins/local-marketplaces/<market>/ + marketplace add + plugin install
 * - Codex CLI：~/plugins/<name> + ~/.agents/plugins/marketplace.json (local-plugins) + plugin add
 * - Grok Build：~/.grok/local-marketplaces/<market>/ + marketplace add + plugin install --trust
 * - Cursor：~/.cursor/plugins/local/<name>（Cursor 无独立市场，本地插件目录即原生机制）
 * - Hermes：HERMES_HOME/local-plugins/<name> + config.yaml skills.external_dirs
 *
 * 原则：市场快照只含插件内容（清单 + skills），不把运行副本的 CLI/src 塞进插件；
 * CLI 缺失时返回 manualSteps 并 ok:false，由 install 层决定是否回退标准模式。
 */
import { join } from 'node:path'
import {
  copyPath,
  ensureDir,
  fileExists,
  readJson,
  readText,
  removePath,
  writeJsonAtomic,
  writeTextAtomic,
} from '../kernel/fsx.mjs'
import { toPosix } from '../kernel/paths.mjs'
import { readKernelText } from './carriers.mjs'
import { runHostCommand } from './native.mjs'

export const PLUGIN_NAME = 'helloagents'
export const MARKETPLACE_NAME = 'helloagents-marketplace'
export const CLAUDE_PLUGIN_ID = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`
export const CODEX_MARKETPLACE_NAME = 'local-plugins'
export const CODEX_PLUGIN_ID = `${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`
export const MANAGED_PLUGIN_SUFFIX = '# helloagents-managed'

/**
 * @typedef {Object} PluginResult
 * @property {boolean} ok
 * @property {string} [manualSteps] 自动执行失败时的手动步骤说明
 */

/** @param {string} appDirPath */
function pluginMeta(appDirPath) {
  const pkg = /** @type {{ version?: string, description?: string, author?: { name?: string } | string } | null} */ (
    readJson(join(appDirPath, 'package.json'))
  )
  const author =
    typeof pkg?.author === 'string'
      ? pkg.author
      : pkg?.author && typeof pkg.author === 'object'
        ? pkg.author.name ?? 'HelloWind'
        : 'HelloWind'
  return {
    name: PLUGIN_NAME,
    version: pkg?.version ?? '0.0.0',
    description:
      pkg?.description ??
      '思维激活层：纠偏内核 + 按需思维技能。Thinking-activation layer: a behavior-correcting kernel plus on-demand thinking skills.',
    author,
  }
}

/**
 * 把运行副本中的 skills 与可选清单同步到目标插件目录（先清空再写入）。
 * @param {string} appDirPath
 * @param {string} targetDir
 * @param {{ manifests?: string[] }} [options]
 */
function syncSkillPluginTree(appDirPath, targetDir, options = {}) {
  const skillsSource = join(appDirPath, 'skills')
  if (!fileExists(skillsSource)) {
    return { ok: false, reason: `运行副本缺少 skills 目录：${skillsSource}` }
  }
  removePath(targetDir)
  ensureDir(targetDir)
  copyPath(skillsSource, join(targetDir, 'skills'))
  for (const relative of options.manifests ?? []) {
    const source = join(appDirPath, relative)
    if (fileExists(source)) copyPath(source, join(targetDir, relative))
  }
  return { ok: true }
}

/**
 * 写入通用插件清单。
 * @param {string} manifestPath
 * @param {{ name: string, version: string, description: string, author: string }} meta
 */
function writePluginManifest(manifestPath, meta) {
  writeJsonAtomic(manifestPath, {
    name: meta.name,
    version: meta.version,
    description: meta.description,
    author: { name: meta.author },
    homepage: 'https://github.com/hellowind777/helloagents',
    license: 'Apache-2.0',
    skills: './skills/',
  })
}

// ─── Claude Code（原生插件市场）─────────────────────────────────────────────

/** @param {string} home */
export function claudeMarketplaceRoot(home) {
  return join(home, '.claude', 'plugins', 'local-marketplaces', MARKETPLACE_NAME)
}

/** @param {string} home */
export function claudeMarketplacePluginDir(home) {
  return join(claudeMarketplaceRoot(home), 'plugins', PLUGIN_NAME)
}

/**
 * 构建 Claude 本地市场。
 * @param {string} home
 * @param {string} appDirPath
 */
function buildClaudeMarketplace(home, appDirPath) {
  const meta = pluginMeta(appDirPath)
  const root = claudeMarketplaceRoot(home)
  const pluginDir = claudeMarketplacePluginDir(home)
  const synced = syncSkillPluginTree(appDirPath, pluginDir, {
    manifests: ['.claude-plugin/plugin.json'],
  })
  if (!synced.ok) return { ok: false, reason: synced.reason }

  const claudeManifest = join(pluginDir, '.claude-plugin', 'plugin.json')
  if (!fileExists(claudeManifest)) writePluginManifest(claudeManifest, meta)

  writeJsonAtomic(join(root, '.claude-plugin', 'marketplace.json'), {
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: MARKETPLACE_NAME,
    description: 'HelloAGENTS local marketplace for Claude Code.',
    owner: { name: meta.author },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./plugins/${PLUGIN_NAME}`,
        description: meta.description,
        version: meta.version,
        category: 'productivity',
        strict: false,
      },
    ],
  })
  return { ok: true, root, pluginDir, meta }
}

/**
 * Claude Code：注册本地市场并安装插件。
 * @param {string} home
 * @param {string} appDirPath
 * @returns {PluginResult}
 */
export function installClaudePlugin(home, appDirPath) {
  const built = buildClaudeMarketplace(home, appDirPath)
  if (!built.ok) return { ok: false, manualSteps: built.reason }

  const steps = `claude plugin marketplace add "${built.root}" && claude plugin install ${CLAUDE_PLUGIN_ID}`

  // 测试隔离：只验证市场快照落盘，不调用真实 claude。
  if (process.env.HELLOAGENTS_HOME) return { ok: true, manualSteps: steps }

  runHostCommand('claude', ['plugin', 'uninstall', PLUGIN_NAME, '-y'])
  runHostCommand('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME])

  const marketplace = runHostCommand('claude', ['plugin', 'marketplace', 'add', built.root])
  if (marketplace.missing || !marketplace.ok) {
    return { ok: false, manualSteps: steps }
  }

  const install = runHostCommand('claude', ['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user'])
  if (!install.ok) {
    const retry = runHostCommand('claude', ['plugin', 'install', CLAUDE_PLUGIN_ID])
    if (!retry.ok) return { ok: false, manualSteps: `claude plugin install ${CLAUDE_PLUGIN_ID}` }
  }
  runHostCommand('claude', ['plugin', 'enable', CLAUDE_PLUGIN_ID])
  return { ok: true }
}

/** @param {string} home */
export function uninstallClaudePlugin(home) {
  if (!process.env.HELLOAGENTS_HOME) {
    runHostCommand('claude', ['plugin', 'uninstall', PLUGIN_NAME, '-y'])
    runHostCommand('claude', ['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '-y'])
    runHostCommand('claude', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME])
  }
  removePath(claudeMarketplaceRoot(home))
  return { ok: true }
}

// ─── Cursor（本地插件目录 = 原生机制）────────────────────────────────────────

/** @param {string} home */
export function cursorPluginDir(home) {
  return join(home, '.cursor', 'plugins', 'local', PLUGIN_NAME)
}

/** @param {string} pluginDir */
export function cursorRuleFile(pluginDir) {
  return join(pluginDir, 'rules', 'helloagents-kernel.mdc')
}

/** @param {string} pluginDir */
function isOurCursorPlugin(pluginDir) {
  const manifest = /** @type {{ name?: string } | null} */ (
    readJson(join(pluginDir, '.cursor-plugin', 'plugin.json'))
  )
  return manifest?.name === PLUGIN_NAME
}

/**
 * 内核转成 Cursor 规则文件内容。
 * 只写 alwaysApply、不写 description：Cursor 已知缺陷是二者同时存在时，
 * 规则会被降级为「按需取用」而不是始终生效。
 * @param {string} kernelText
 */
export function buildCursorRule(kernelText) {
  return `---\nalwaysApply: true\n---\n\n${kernelText.trimEnd()}\n`
}

/**
 * Cursor：生成本地插件目录。
 * @param {string} home
 * @param {string} appDirPath
 * @returns {PluginResult}
 */
export function installCursorPlugin(home, appDirPath) {
  const target = cursorPluginDir(home)
  if (fileExists(target) && !isOurCursorPlugin(target)) {
    return { ok: false, manualSteps: `目标目录已被其他内容占用，请先移除：${target}` }
  }
  const kernel = readKernelText(appDirPath)
  if (kernel === null) {
    return { ok: false, manualSteps: `运行副本缺少内核文件：${join(appDirPath, 'prompts', 'kernel.md')}` }
  }
  removePath(target)
  copyPath(join(appDirPath, '.cursor-plugin'), join(target, '.cursor-plugin'))
  copyPath(join(appDirPath, 'skills'), join(target, 'skills'))
  writeTextAtomic(cursorRuleFile(target), buildCursorRule(kernel))
  return { ok: true }
}

/** @param {string} home */
export function uninstallCursorPlugin(home) {
  const target = cursorPluginDir(home)
  if (!fileExists(target)) return { ok: true }
  if (!isOurCursorPlugin(target)) return { ok: true }
  removePath(target)
  return { ok: true }
}

// ─── Codex CLI（原生插件市场 local-plugins）─────────────────────────────────

/** @param {string} home */
export function codexPluginDir(home) {
  return join(home, 'plugins', PLUGIN_NAME)
}

/** @param {string} home */
export function codexMarketplacePath(home) {
  return join(home, '.agents', 'plugins', 'marketplace.json')
}

/** @param {string} home */
function codexConfigPath(home) {
  return join(home, '.codex', 'config.toml')
}

/** @param {string} home @param {{ version: string, description: string }} meta */
function ensureCodexMarketplaceEntry(home, meta) {
  const path = codexMarketplacePath(home)
  const existing = /** @type {{ name?: string, interface?: { displayName?: string }, plugins?: unknown[] } | null} */ (
    readJson(path)
  )
  /** @type {{ name: string, interface: { displayName: string }, plugins: Array<Record<string, unknown>> }} */
  const marketplace = {
    name: CODEX_MARKETPLACE_NAME,
    interface: { displayName: existing?.interface?.displayName ?? 'Local Plugins' },
    plugins: [],
  }
  for (const entry of existing?.plugins ?? []) {
    if (!entry || typeof entry !== 'object') continue
    const name = /** @type {{ name?: string }} */ (entry).name
    if (name && name !== PLUGIN_NAME) marketplace.plugins.push(/** @type {Record<string, unknown>} */ (entry))
  }
  marketplace.plugins.push({
    name: PLUGIN_NAME,
    source: { source: 'local', path: `./plugins/${PLUGIN_NAME}` },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Productivity',
    version: meta.version,
    description: meta.description,
  })
  writeJsonAtomic(path, marketplace)
}

/** @param {string} home */
function removeCodexMarketplaceEntry(home) {
  const path = codexMarketplacePath(home)
  const existing = /** @type {{ plugins?: unknown[] } | null} */ (readJson(path))
  if (!existing || !Array.isArray(existing.plugins)) return
  existing.plugins = existing.plugins.filter((entry) => {
    if (!entry || typeof entry !== 'object') return true
    return /** @type {{ name?: string }} */ (entry).name !== PLUGIN_NAME
  })
  writeJsonAtomic(path, existing)
}

/** @param {string} configPath @param {boolean} enable */
function setCodexPluginEnabled(configPath, enable) {
  const header = `[plugins."${CODEX_PLUGIN_ID}"]`
  const managedHeader = `${header} ${MANAGED_PLUGIN_SUFFIX}`
  const text = readText(configPath) ?? ''
  const lines = text === '' ? [] : text.split(/\r?\n/)
  const kept = lines.filter((line) => {
    const trimmed = line.trim()
    return trimmed !== header && trimmed !== managedHeader && !trimmed.startsWith(`${header} `)
  })
  if (enable) kept.push(managedHeader)
  const body = kept.join('\n').replace(/\n+$/, '')
  if (body) writeTextAtomic(configPath, `${body}\n`)
  else if (fileExists(configPath)) removePath(configPath)
}

/** @param {string} home @param {string} appDirPath @returns {PluginResult} */
export function installCodexPlugin(home, appDirPath) {
  const meta = pluginMeta(appDirPath)
  const target = codexPluginDir(home)
  const synced = syncSkillPluginTree(appDirPath, target, {
    manifests: ['.codex-plugin/plugin.json'],
  })
  if (!synced.ok) return { ok: false, manualSteps: synced.reason }

  const manifestPath = join(target, '.codex-plugin', 'plugin.json')
  if (!fileExists(manifestPath)) writePluginManifest(manifestPath, meta)

  ensureCodexMarketplaceEntry(home, meta)
  setCodexPluginEnabled(codexConfigPath(home), true)

  if (process.env.HELLOAGENTS_HOME) {
    return { ok: true, manualSteps: `codex plugin add ${CODEX_PLUGIN_ID}` }
  }

  const probe = runHostCommand('codex', ['plugin', 'list'])
  if (probe.missing) {
    return { ok: true, manualSteps: `codex plugin add ${CODEX_PLUGIN_ID}` }
  }

  runHostCommand('codex', ['plugin', 'remove', CODEX_PLUGIN_ID])
  const add = runHostCommand('codex', ['plugin', 'add', CODEX_PLUGIN_ID])
  if (!add.ok) {
    return { ok: true, manualSteps: `codex plugin add ${CODEX_PLUGIN_ID}` }
  }
  return { ok: true }
}

/** @param {string} home */
export function uninstallCodexPlugin(home) {
  if (!process.env.HELLOAGENTS_HOME) {
    runHostCommand('codex', ['plugin', 'remove', CODEX_PLUGIN_ID])
  }
  setCodexPluginEnabled(codexConfigPath(home), false)
  removeCodexMarketplaceEntry(home)
  removePath(codexPluginDir(home))
  return { ok: true }
}

// ─── Grok Build（原生插件市场）──────────────────────────────────────────────

/** @param {string} home */
export function grokMarketplaceRoot(home) {
  return join(home, '.grok', 'local-marketplaces', MARKETPLACE_NAME)
}

/** @param {string} home */
export function grokMarketplacePluginDir(home) {
  return join(grokMarketplaceRoot(home), 'plugins', PLUGIN_NAME)
}

/** @param {string} home */
function grokConfigPath(home) {
  return join(home, '.grok', 'config.toml')
}

/** @param {string} home @param {string} appDirPath */
function buildGrokMarketplace(home, appDirPath) {
  const meta = pluginMeta(appDirPath)
  const root = grokMarketplaceRoot(home)
  const pluginDir = grokMarketplacePluginDir(home)
  const synced = syncSkillPluginTree(appDirPath, pluginDir, {
    manifests: ['.claude-plugin/plugin.json'],
  })
  if (!synced.ok) return { ok: false, reason: synced.reason }

  writePluginManifest(join(pluginDir, 'plugin.json'), meta)
  const claudeManifest = join(pluginDir, '.claude-plugin', 'plugin.json')
  if (!fileExists(claudeManifest)) writePluginManifest(claudeManifest, meta)

  writeJsonAtomic(join(root, '.grok-plugin', 'marketplace.json'), {
    name: MARKETPLACE_NAME,
    description: 'Grok Build local marketplace for HelloAGENTS.',
    owner: { name: meta.author },
    plugins: [
      {
        name: PLUGIN_NAME,
        description: meta.description,
        category: 'productivity',
        version: meta.version,
        source: { type: 'local', path: `./plugins/${PLUGIN_NAME}` },
      },
    ],
  })
  return { ok: true, root, pluginDir, meta }
}

/** @param {string} home @param {string} sourcePath */
function ensureGrokMarketplaceSource(home, sourcePath) {
  const configPath = grokConfigPath(home)
  const content = readText(configPath) ?? ''
  const pathLiteral = sourcePath.replaceAll('\\', '/')
  const block = `[[marketplace.sources]]\nname = "${MARKETPLACE_NAME}"\npath = '${pathLiteral}'`
  const pattern = new RegExp(
    String.raw`^\[\[marketplace\.sources\]\]\r?\nname = "${MARKETPLACE_NAME}"\r?\npath = ['"].*?['"]\r?\n?`,
    'ms',
  )

  let next
  if (!content.trim()) {
    next = block
  } else if (pattern.test(content)) {
    next = content.replace(pattern, `${block}\n`).trimEnd()
  } else {
    next = `${content.trimEnd()}\n\n${block}`
  }
  writeTextAtomic(configPath, `${next}\n`)
}

/** @param {string} home */
function removeGrokMarketplaceSource(home) {
  const configPath = grokConfigPath(home)
  const content = readText(configPath)
  if (content === null) return
  const pattern = new RegExp(
    String.raw`(?:^\[\[marketplace\.sources\]\]\r?\nname = "${MARKETPLACE_NAME}"\r?\npath = ['"].*?['"]\r?\n?)`,
    'ms',
  )
  const updated = content.replace(pattern, '').trim()
  if (updated) writeTextAtomic(configPath, `${updated}\n`)
  else removePath(configPath)
}

/** @param {string} home @param {string} appDirPath @returns {PluginResult} */
export function installGrokPlugin(home, appDirPath) {
  const built = buildGrokMarketplace(home, appDirPath)
  if (!built.ok) return { ok: false, manualSteps: built.reason }

  removePath(join(home, '.grok', 'plugins', PLUGIN_NAME))
  ensureGrokMarketplaceSource(home, built.root)

  const steps = `grok plugin marketplace add "${built.root}" && grok plugin install --trust "${built.pluginDir}" && grok plugin enable ${PLUGIN_NAME}`

  if (process.env.HELLOAGENTS_HOME) return { ok: true, manualSteps: steps }

  const probe = runHostCommand('grok', ['plugin', 'list'])
  if (probe.missing) return { ok: true, manualSteps: steps }

  runHostCommand('grok', ['plugin', 'uninstall', PLUGIN_NAME, '--confirm', '--keep-data'])
  runHostCommand('grok', ['plugin', 'marketplace', 'remove', built.root])
  runHostCommand('grok', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME])

  const addMarket = runHostCommand('grok', ['plugin', 'marketplace', 'add', built.root])
  ensureGrokMarketplaceSource(home, built.root)
  if (!addMarket.ok) {
    return { ok: false, manualSteps: steps }
  }

  const install = runHostCommand('grok', ['plugin', 'install', '--trust', built.pluginDir])
  if (!install.ok) {
    const retry = runHostCommand('grok', ['plugin', 'install', '--trust', PLUGIN_NAME])
    if (!retry.ok) return { ok: false, manualSteps: `grok plugin install --trust "${built.pluginDir}"` }
  }
  runHostCommand('grok', ['plugin', 'enable', PLUGIN_NAME])
  return { ok: true }
}

/** @param {string} home */
export function uninstallGrokPlugin(home) {
  const root = grokMarketplaceRoot(home)
  if (!process.env.HELLOAGENTS_HOME) {
    runHostCommand('grok', ['plugin', 'uninstall', PLUGIN_NAME, '--confirm', '--keep-data'])
    runHostCommand('grok', ['plugin', 'marketplace', 'remove', root])
    runHostCommand('grok', ['plugin', 'marketplace', 'remove', MARKETPLACE_NAME])
  }
  removeGrokMarketplaceSource(home)
  removePath(root)
  removePath(join(home, '.grok', 'plugins', PLUGIN_NAME))
  return { ok: true }
}

// ─── Hermes（local-plugins + external_dirs）────────────────────────────────

/** @param {string} home */
export function resolveHermesHome(home) {
  if (process.env.HELLOAGENTS_HOME) return join(home, '.hermes')

  const envHome = String(process.env.HERMES_HOME || '').trim()
  if (envHome) return envHome

  const dump = runHostCommand('hermes', ['dump'])
  if (dump.ok) {
    const match = dump.output.match(/^hermes_home:\s*(.+)$/m)
    if (match?.[1]) return match[1].trim()
  }

  const version = runHostCommand('hermes', ['--version'])
  if (version.ok) {
    const installMatch = version.output.match(/^Install directory:\s*(.+)$/m)
    if (installMatch?.[1]) {
      const installDir = installMatch[1].trim()
      const parent = join(installDir, '..')
      if (fileExists(join(parent, 'local-plugins')) || fileExists(join(parent, 'config.yaml'))) {
        return parent
      }
    }
  }

  if (process.env.LOCALAPPDATA) {
    const winDefault = join(process.env.LOCALAPPDATA, 'hermes')
    if (fileExists(winDefault)) return winDefault
  }

  return join(home, '.hermes')
}

/** @param {string} hermesHome */
export function hermesPluginDir(hermesHome) {
  return join(hermesHome, 'local-plugins', PLUGIN_NAME)
}

/** @param {string} hermesHome */
function hermesInstallStatePath(hermesHome) {
  return join(hermesHome, 'local-plugins', '.helloagents-installed.json')
}

/** @param {string} configPath @param {string} skillsDir @param {'add' | 'remove'} mode */
function updateHermesExternalDirs(configPath, skillsDir, mode) {
  const target = toPosix(skillsDir)
  const quoted = JSON.stringify(target)
  let text = readText(configPath) ?? ''

  if (mode === 'remove') {
    if (!text) return
    const lines = text.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('-')) return true
      const value = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '')
      return toPosix(value) !== target && value !== skillsDir
    })
    writeTextAtomic(configPath, `${lines.join('\n').replace(/\n+$/, '')}\n`)
    return
  }

  if (text.includes(target) || text.includes(skillsDir)) return

  if (!text.trim()) {
    writeTextAtomic(configPath, `skills:\n  external_dirs:\n    - ${quoted}\n`)
    return
  }

  if (/external_dirs:\s*\[\s*\]/.test(text)) {
    text = text.replace(/external_dirs:\s*\[\s*\]/, `external_dirs:\n    - ${quoted}`)
  } else if (/^[ \t]*external_dirs:[ \t]*$/m.test(text)) {
    text = text.replace(/^([ \t]*external_dirs:[ \t]*\r?\n)/m, `$1    - ${quoted}\n`)
  } else if (/^[ \t]*external_dirs:/m.test(text)) {
    text = text.replace(/(^[ \t]*external_dirs:[ \t]*\r?\n(?:[ \t]*-[ \t]*.+\r?\n)*)/m, `$1    - ${quoted}\n`)
  } else if (/^[ \t]*skills:[ \t]*$/m.test(text) || /^[ \t]*skills:[ \t]*\{/m.test(text)) {
    text = text.replace(/(^[ \t]*skills:[ \t]*\r?\n)/m, `$1  external_dirs:\n    - ${quoted}\n`)
  } else {
    text = `${text.replace(/\s+$/, '')}\n\nskills:\n  external_dirs:\n    - ${quoted}\n`
  }
  writeTextAtomic(configPath, text.endsWith('\n') ? text : `${text}\n`)
}

/** @param {string} home @param {string} appDirPath @returns {PluginResult} */
export function installHermesPlugin(home, appDirPath) {
  const hermesHome = resolveHermesHome(home)
  const pluginRoot = hermesPluginDir(hermesHome)
  const skillsPath = join(pluginRoot, 'skills')
  const configPath = join(hermesHome, 'config.yaml')

  const synced = syncSkillPluginTree(appDirPath, pluginRoot, {})
  if (!synced.ok) return { ok: false, manualSteps: synced.reason }
  if (!fileExists(skillsPath)) {
    return { ok: false, manualSteps: `安装结果缺少 skills 目录：${skillsPath}` }
  }

  updateHermesExternalDirs(configPath, skillsPath, 'add')
  writeJsonAtomic(hermesInstallStatePath(hermesHome), {
    plugin: PLUGIN_NAME,
    version: pluginMeta(appDirPath).version,
    pluginRoot,
    skillsPath,
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

/** @param {string} home */
export function uninstallHermesPlugin(home) {
  const hermesHome = resolveHermesHome(home)
  const statePath = hermesInstallStatePath(hermesHome)
  const state = /** @type {{ pluginRoot?: string, skillsPath?: string } | null} */ (readJson(statePath))
  const pluginRoot = state?.pluginRoot || hermesPluginDir(hermesHome)
  const skillsPath = state?.skillsPath || join(pluginRoot, 'skills')
  const configPath = join(hermesHome, 'config.yaml')

  if (fileExists(configPath)) updateHermesExternalDirs(configPath, skillsPath, 'remove')
  removePath(pluginRoot)
  removePath(statePath)
  return { ok: true }
}

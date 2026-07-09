import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULTS } from './cli-config.mjs'
import { inspectCodexDoctor as inspectCodexDoctorImpl } from './cli-doctor-codex.mjs'
import { printDoctorText } from './cli-doctor-render.mjs'
import { buildRuntimeCarrier } from './cli-runtime-carrier.mjs'
import {
  GROK_PLUGIN_NAME,
  getClaudeMarketplaceRoot,
  getCursorInstallRoot,
  getCursorPluginRoot,
  getGeminiExtensionRoot,
  getGrokMarketplaceRoot,
} from './cli-runtime-root.mjs'
import { loadHooksWithCliEntry, safeJson, safeRead } from './cli-utils.mjs'

const CLAUDE_PLUGIN = 'helloagents@helloagents'
const GEMINI_EXTENSION = 'helloagents'
const GROK_STANDBY_HOOK_FILE = 'helloagents.json'

const runtime = {
  home: '',
  pkgRoot: '',
  sourceRoot: '',
  pkgVersion: '',
  msg: (cn, en) => en || cn,
  readSettings: () => ({}),
  getTrackedHostMode: () => '',
  normalizeHost: (value) => value,
  detectHostMode: () => '',
  getHostLabel: (host) => host,
}

function safeRealTarget(linkPath) {
  try {
    return realpathSync(linkPath)
  } catch {
    return ''
  }
}

function normalizeText(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').trim()
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').toLowerCase()
}

function textIncludesNormalizedPath(text = '', targetPath = '') {
  const normalizedText = normalizePath(text)
  const normalizedTargetPath = normalizePath(targetPath)
  return Boolean(normalizedTargetPath) && normalizedText.includes(normalizedTargetPath)
}

function extractManagedCarrierContent(filePath) {
  const text = safeRead(filePath) || ''
  const match = text.match(/<!-- HELLOAGENTS_START -->([\s\S]*?)<!-- HELLOAGENTS_END -->/)
  return normalizeText(match?.[1] || '')
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortJson(value[key])
      return acc
    }, {})
  }
  return value
}

function stringifySorted(value) {
  return JSON.stringify(sortJson(value))
}

function pickManagedHooks(hooks) {
  const next = {}
  for (const [event, entries] of Object.entries(hooks || {})) {
    if (!Array.isArray(entries)) continue
    const managedEntries = entries.filter((entry) => JSON.stringify(entry).includes('helloagents'))
    if (managedEntries.length > 0) next[event] = managedEntries
  }
  return next
}

function readExpectedHooks(hooksFile, pathVar) {
  return pickManagedHooks(loadHooksWithCliEntry(runtime.pkgRoot, hooksFile, pathVar)?.hooks || {})
}

function managedHooksMatch(actualHooks, expectedHooks) {
  return stringifySorted(pickManagedHooks(actualHooks || {})) === stringifySorted(expectedHooks || {})
}

function readExpectedCarrierContent(fileName, settings, options = {}) {
  const bootstrap = safeRead(join(runtime.pkgRoot, fileName)) || ''
  return normalizeText(buildRuntimeCarrier(bootstrap, settings, options))
}

function buildDoctorIssue(code, cn, en) {
  return {
    code,
    message: runtime.msg(cn, en),
  }
}

function normalizeDoctorMode(mode = '') {
  return mode || 'none'
}

function hasEnabledPlugin(enabledPlugins, pluginName) {
  if (Array.isArray(enabledPlugins)) {
    return enabledPlugins.includes(pluginName)
  }
  if (enabledPlugins && typeof enabledPlugins === 'object') {
    return Boolean(enabledPlugins[pluginName])
  }
  return false
}

function hasRegistryPlugin(registry = {}, pluginName, expectedSource = '') {
  const normalizedExpectedSource = normalizePath(expectedSource)
  return Object.values(registry?.repos || {}).some((repo) => {
    if (!repo?.plugins?.[pluginName]) return false
    if (!normalizedExpectedSource) return true
    return normalizePath(repo?.kind?.source_path || '') === normalizedExpectedSource
  })
}

function summarizeDoctorStatus(issues, { host, trackedMode, detectedMode } = {}) {
  if (issues.length > 0) return 'drift'
  if (detectedMode !== 'none') return 'ok'
  if (trackedMode === 'global' && ['claude', 'gemini'].includes(host)) return 'manual-plugin'
  if (trackedMode !== 'none') return 'drift'
  return 'not-installed'
}

function suggestDoctorFix(host, status, trackedMode) {
  if (status === 'drift') {
    return `helloagents update ${host}${trackedMode && trackedMode !== 'none' ? ` --${trackedMode}` : ''}`
  }
  if (status === 'manual-plugin') {
    if (host === 'claude') return `/plugin marketplace add "${getClaudeMarketplaceRoot(runtime.home)}"; /plugin install helloagents@helloagents`
    if (host === 'gemini') return `gemini extensions link "${getGeminiExtensionRoot(runtime.home)}"`
  }
  if (status === 'not-installed') {
    return `helloagents install ${host} --standby`
  }
  return ''
}

export function initCliDoctor(options) {
  Object.assign(runtime, options)
}

function inspectClaudeDoctor(settings) {
  const host = 'claude'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const claudeDir = join(runtime.home, '.claude')
  const claudeSettings = safeJson(join(claudeDir, 'settings.json')) || {}
  const claudePlugins = safeJson(join(claudeDir, 'plugins', 'installed_plugins.json')) || {}
  const expectedHooks = readExpectedHooks('hooks-claude.json', '${CLAUDE_PLUGIN_ROOT}')
  const marketplaceRoot = getClaudeMarketplaceRoot(runtime.home)
  const globalPluginInstalled = Boolean(claudePlugins.plugins?.[CLAUDE_PLUGIN]?.length)
    || hasEnabledPlugin(claudeSettings.enabledPlugins, CLAUDE_PLUGIN)
  const checks = {
    carrierMarker: (safeRead(join(claudeDir, 'CLAUDE.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(claudeDir, 'CLAUDE.md'))
      === readExpectedCarrierContent('bootstrap-lite.md', settings),
    homeLink: safeRealTarget(join(claudeDir, 'helloagents')) === runtime.pkgRoot,
    globalMarketplaceRoot: existsSync(marketplaceRoot),
    globalPluginInstalled,
    settingsHooks: JSON.stringify(claudeSettings.hooks || {}).includes('helloagents'),
    settingsHooksMatch: managedHooksMatch(claudeSettings.hooks || {}, expectedHooks),
    settingsPermission: Array.isArray(claudeSettings.permissions?.allow)
      && claudeSettings.permissions.allow.includes('Read(~/.helloagents/helloagents/**)'),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 规则文件缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前标准模式规则不一致', 'Standby carrier content differs from the current standby rules'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向稳定运行根目录', 'Standby home link is missing or points to a different runtime root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
    if (checks.settingsHooks && !checks.settingsHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby settings hooks 与当前 hooks 配置不一致', 'Standby settings hooks differ from the current hook configuration'))
    if (!checks.settingsPermission) issues.push(buildDoctorIssue('standby-permission-missing', 'standby Claude 权限注入缺失', 'Standby Claude permission injection is missing'))
  }
  if (detectedMode === 'global') {
    if (!checks.globalMarketplaceRoot) issues.push(buildDoctorIssue('global-marketplace-root-missing', 'global marketplace 投影缺失', 'Global marketplace projection is missing'))
    if (!checks.globalPluginInstalled) issues.push(buildDoctorIssue('global-plugin-missing', 'global Claude 插件未安装', 'Global Claude plugin is not installed'))
    if (checks.carrierMarker || checks.homeLink || checks.settingsHooks || checks.settingsPermission) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is detected as global'))
    }
  } else if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Claude Code 的 global 模式由宿主插件系统管理；doctor 会检查本地 marketplace 投影、已安装插件记录与 standby 残留。',
      'Claude Code global mode is managed by the host plugin system; doctor checks the local marketplace projection, installed-plugin records, and standby residue.',
    ))
  }
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue('untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none' && trackedMode !== 'global') {
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }

  const status = summarizeDoctorStatus(issues, { host, trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestDoctorFix(host, status, trackedMode) }
}

function inspectCursorDoctor(settings) {
  const host = 'cursor'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const cursorDir = join(runtime.home, '.cursor')
  const actualHooks = safeJson(join(cursorDir, 'hooks.json')) || {}
  const expectedHooks = readExpectedHooks('hooks-cursor.json', '')
  const projectionRoot = getCursorPluginRoot(runtime.home)
  const installRoot = getCursorInstallRoot(runtime.home)
  const projectionManifestPath = join(projectionRoot, '.cursor-plugin', 'plugin.json')
  const projectionHooksPath = join(projectionRoot, 'hooks', 'hooks-cursor.json')
  const installManifestPath = join(installRoot, '.cursor-plugin', 'plugin.json')
  const installHooksPath = join(installRoot, 'hooks', 'hooks-cursor.json')
  const installedPlugin = safeJson(installManifestPath) || {}
  const projectionManifest = normalizeText(safeRead(projectionManifestPath) || '')
  const projectionHooks = normalizeText(safeRead(projectionHooksPath) || '')
  const installManifest = normalizeText(safeRead(installManifestPath) || '')
  const installHooks = normalizeText(safeRead(installHooksPath) || '')
  const checks = {
    homeLink: safeRealTarget(join(cursorDir, 'helloagents')) === runtime.pkgRoot,
    standbyHooksFile: JSON.stringify(actualHooks).includes('helloagents'),
    standbyHooksMatch: managedHooksMatch(actualHooks.hooks || actualHooks, expectedHooks),
    globalPluginRoot: existsSync(projectionRoot),
    globalPluginManifest: existsSync(projectionManifestPath),
    globalPluginHooks: existsSync(projectionHooksPath),
    globalPluginInstall: existsSync(installRoot),
    globalPluginInstallManifest: existsSync(installManifestPath),
    globalPluginInstallHooks: existsSync(installHooksPath),
    globalPluginInstalled: installedPlugin.name === 'helloagents' || existsSync(installManifestPath),
    globalPluginSyncMatch: Boolean(projectionManifest && projectionHooks)
      && projectionManifest === installManifest
      && projectionHooks === installHooks,
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby Cursor home 链接缺失或未指向稳定运行根目录', 'Standby Cursor home link is missing or points to a different runtime root'))
    if (!checks.standbyHooksFile) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby Cursor hooks.json 缺少 HelloAGENTS hooks', 'Standby Cursor hooks.json is missing HelloAGENTS hooks'))
    if (checks.standbyHooksFile && !checks.standbyHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby Cursor hooks 与当前 hooks 配置不一致', 'Standby Cursor hooks differ from the current hook configuration'))
  }
  if (detectedMode === 'global') {
    if (!checks.globalPluginRoot) issues.push(buildDoctorIssue('global-plugin-root-missing', 'global Cursor 插件投影缺失', 'Global Cursor plugin projection is missing'))
    if (!checks.globalPluginManifest) issues.push(buildDoctorIssue('global-plugin-manifest-missing', 'global Cursor .cursor-plugin/plugin.json 缺失', 'Global Cursor .cursor-plugin/plugin.json is missing'))
    if (!checks.globalPluginHooks) issues.push(buildDoctorIssue('global-plugin-hooks-missing', 'global Cursor hooks-cursor.json 缺失', 'Global Cursor hooks-cursor.json is missing'))
    if (!checks.globalPluginInstall) issues.push(buildDoctorIssue('global-plugin-install-missing', 'global Cursor 本地插件安装目录缺失', 'Global Cursor local plugin install directory is missing'))
    if (!checks.globalPluginInstallManifest) issues.push(buildDoctorIssue('global-plugin-install-manifest-missing', 'global Cursor 安装目录缺少 .cursor-plugin/plugin.json', 'Global Cursor install directory is missing .cursor-plugin/plugin.json'))
    if (!checks.globalPluginInstallHooks) issues.push(buildDoctorIssue('global-plugin-install-hooks-missing', 'global Cursor 安装目录缺少 hooks-cursor.json', 'Global Cursor install directory is missing hooks-cursor.json'))
    if (!checks.globalPluginInstalled) issues.push(buildDoctorIssue('global-plugin-missing', 'global Cursor 本地插件未安装', 'Global Cursor local plugin is not installed'))
    if (checks.globalPluginInstall && checks.globalPluginInstallManifest && checks.globalPluginInstallHooks && !checks.globalPluginSyncMatch) {
      issues.push(buildDoctorIssue('global-plugin-sync-drift', 'global Cursor 安装目录内容与受管投影不一致', 'Global Cursor install directory content differs from the managed projection'))
    }
    if (checks.homeLink || checks.standbyHooksFile) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is detected as global'))
    }
  } else if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Cursor 的 global 模式使用本地插件目录 `~/.cursor/plugins/local/helloagents`；doctor 会检查受管投影、安装目录内容同步情况与 standby 残留。',
      'Cursor global mode uses the local plugin directory `~/.cursor/plugins/local/helloagents`; doctor checks the managed projection, install-directory sync, and standby residue.',
    ))
  }
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue('untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none' && trackedMode !== 'global') {
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }

  const status = summarizeDoctorStatus(issues, { host, trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestDoctorFix(host, status, trackedMode) }
}

function inspectGrokDoctor(settings) {
  const host = 'grok'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const grokDir = join(runtime.home, '.grok')
  const registry = safeJson(join(grokDir, 'installed-plugins', 'registry.json')) || {}
  const configText = safeRead(join(grokDir, 'config.toml')) || ''
  const expectedHooks = readExpectedHooks('hooks-grok.json', '${GROK_PLUGIN_ROOT}')
  const marketplaceRoot = getGrokMarketplaceRoot(runtime.home)
  const marketplacePluginRoot = join(marketplaceRoot, 'plugins', GROK_PLUGIN_NAME)
  const actualHooks = safeJson(join(grokDir, 'hooks', GROK_STANDBY_HOOK_FILE)) || {}
  const checks = {
    carrierMarker: (safeRead(join(grokDir, 'AGENTS.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(grokDir, 'AGENTS.md'))
      === readExpectedCarrierContent('bootstrap-lite.md', settings),
    homeLink: safeRealTarget(join(grokDir, 'helloagents')) === runtime.pkgRoot,
    standbyHooksFile: JSON.stringify(actualHooks).includes('helloagents'),
    standbyHooksMatch: managedHooksMatch(actualHooks.hooks || actualHooks, expectedHooks),
    globalMarketplaceRoot: existsSync(marketplaceRoot),
    globalMarketplaceCatalog: existsSync(join(marketplaceRoot, '.grok-plugin', 'marketplace.json')),
    globalMarketplaceIndex: existsSync(join(marketplaceRoot, '.grok-plugin', 'plugin-index.json')),
    globalPluginPayload: existsSync(marketplacePluginRoot),
    globalPluginHooks: existsSync(join(marketplacePluginRoot, 'hooks', 'hooks.json')),
    globalMarketplaceConfigured: textIncludesNormalizedPath(configText, marketplaceRoot),
    globalPluginInstalled: hasRegistryPlugin(registry, GROK_PLUGIN_NAME, marketplacePluginRoot),
    globalPluginEnabled: /\[plugins\][\s\S]*enabled\s*=\s*\[[^\]]*["']helloagents["']/i.test(configText),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 规则文件缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前标准模式规则不一致', 'Standby carrier content differs from the current standby rules'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向稳定运行根目录', 'Standby home link is missing or points to a different runtime root'))
    if (!checks.standbyHooksFile) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby Grok hooks 文件缺失', 'Standby Grok hooks file is missing'))
    if (checks.standbyHooksFile && !checks.standbyHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby Grok hooks 与当前 hooks 配置不一致', 'Standby Grok hooks differ from the current hook configuration'))
  }
  if (detectedMode === 'global') {
    if (!checks.globalMarketplaceRoot) issues.push(buildDoctorIssue('global-marketplace-root-missing', 'global marketplace 投影缺失', 'Global marketplace projection is missing'))
    if (!checks.globalMarketplaceCatalog) issues.push(buildDoctorIssue('global-marketplace-catalog-missing', 'global marketplace catalog 缺失', 'Global marketplace catalog is missing'))
    if (!checks.globalMarketplaceIndex) issues.push(buildDoctorIssue('global-marketplace-index-missing', 'global marketplace plugin-index 缺失', 'Global marketplace plugin-index is missing'))
    if (!checks.globalPluginPayload) issues.push(buildDoctorIssue('global-plugin-payload-missing', 'global Grok 插件投影缺失', 'Global Grok plugin payload is missing'))
    if (!checks.globalPluginHooks) issues.push(buildDoctorIssue('global-plugin-hooks-missing', 'global Grok hooks.json 缺失', 'Global Grok hooks.json is missing'))
    if (!checks.globalPluginInstalled) issues.push(buildDoctorIssue('global-plugin-missing', 'global Grok 插件未安装', 'Global Grok plugin is not installed'))
    if (!checks.globalMarketplaceConfigured) issues.push(buildDoctorIssue('global-marketplace-config-missing', 'global marketplace 来源未写入 ~/.grok/config.toml', 'Global marketplace source is not written to ~/.grok/config.toml'))
    if (!checks.globalPluginEnabled) issues.push(buildDoctorIssue('global-plugin-disabled', 'global Grok 插件未在 ~/.grok/config.toml 中启用', 'Global Grok plugin is not enabled in ~/.grok/config.toml'))
    if (checks.carrierMarker || checks.homeLink || checks.standbyHooksFile) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is detected as global'))
    }
  }
  if (runtime.detectHostMode('claude') !== 'none') {
    notes.push(runtime.msg(
      '检测到 Claude Code 侧也存在受管配置。Grok 默认会扫描 Claude 兼容载体，若两边同时开启，可能出现规则重复加载。',
      'Managed Claude Code artifacts were also detected. Grok scans Claude compatibility carriers by default, so enabling both sides can lead to duplicated rule loading.',
    ))
  }
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue('untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none') {
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }

  const status = summarizeDoctorStatus(issues, { host, trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestDoctorFix(host, status, trackedMode) }
}

function inspectGeminiDoctor(settings) {
  const host = 'gemini'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const geminiDir = join(runtime.home, '.gemini')
  const geminiSettings = safeJson(join(geminiDir, 'settings.json')) || {}
  const expectedHooks = readExpectedHooks('hooks-gemini.json', '${extensionPath}')
  const extensionRoot = getGeminiExtensionRoot(runtime.home)
  const extensionInstallRoot = join(geminiDir, 'extensions', GEMINI_EXTENSION)
  const expectedExtensionTarget = safeRealTarget(extensionRoot) || normalizePath(extensionRoot)
  const checks = {
    carrierMarker: (safeRead(join(geminiDir, 'GEMINI.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(geminiDir, 'GEMINI.md'))
      === readExpectedCarrierContent('bootstrap-lite.md', settings),
    homeLink: safeRealTarget(join(geminiDir, 'helloagents')) === runtime.pkgRoot,
    globalExtensionRoot: existsSync(extensionRoot),
    globalExtensionLink: safeRealTarget(extensionInstallRoot) === expectedExtensionTarget,
    globalExtensionInstall: existsSync(extensionInstallRoot),
    settingsHooks: JSON.stringify(geminiSettings.hooks || {}).includes('helloagents'),
    settingsHooksMatch: managedHooksMatch(geminiSettings.hooks || {}, expectedHooks),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 规则文件缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前标准模式规则不一致', 'Standby carrier content differs from the current standby rules'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向稳定运行根目录', 'Standby home link is missing or points to a different runtime root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
    if (checks.settingsHooks && !checks.settingsHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby settings hooks 与当前 hooks 配置不一致', 'Standby settings hooks differ from the current hook configuration'))
  }
  if (detectedMode === 'global') {
    if (!checks.globalExtensionRoot) issues.push(buildDoctorIssue('global-extension-root-missing', 'global extension 投影缺失', 'Global extension projection is missing'))
    if (!checks.globalExtensionInstall) issues.push(buildDoctorIssue('global-extension-missing', 'global Gemini 扩展未安装', 'Global Gemini extension is not installed'))
    if (!checks.globalExtensionLink) issues.push(buildDoctorIssue('global-extension-link-missing', 'global Gemini 扩展链接未指向投影目录', 'Global Gemini extension link does not point to the projection root'))
    if (checks.carrierMarker || checks.homeLink || checks.settingsHooks) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is detected as global'))
    }
  } else if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Gemini CLI 的 global 模式由宿主扩展系统管理；doctor 会检查本地扩展投影、已安装链接与 standby 残留。',
      'Gemini CLI global mode is managed by the host extension system; doctor checks the local extension projection, installed link, and standby residue.',
    ))
  }
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue('untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none' && trackedMode !== 'global') {
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }

  const status = summarizeDoctorStatus(issues, { host, trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestDoctorFix(host, status, trackedMode) }
}

function parseDoctorArgs(args) {
  const wantsJson = args.includes('--json')
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--json' && arg !== '--all')
  if (unknownFlags.length) {
    throw new Error(runtime.msg(`未知参数: ${unknownFlags.join(', ')}`, `Unknown flags: ${unknownFlags.join(', ')}`))
  }
  const positionals = args.filter((arg) => !arg.startsWith('--'))
  if (positionals.length > 1) {
    throw new Error(runtime.msg(`参数过多: ${positionals.join(' ')}`, `Too many arguments: ${positionals.join(' ')}`))
  }
  const host = runtime.normalizeHost(args.includes('--all') ? 'all' : (positionals[0] || 'all'))
  if (!host) {
    throw new Error(runtime.msg(`不支持的 CLI: ${positionals[0]}`, `Unsupported CLI: ${positionals[0]}`))
  }
  return { host, wantsJson }
}

function inspectDoctorHost(host, settings) {
  if (host === 'claude') return inspectClaudeDoctor(settings)
  if (host === 'cursor') return inspectCursorDoctor(settings)
  if (host === 'gemini') return inspectGeminiDoctor(settings)
  if (host === 'grok') return inspectGrokDoctor(settings)
  return inspectCodexDoctorImpl(runtime, settings)
}

function buildDoctorReport(host) {
  const settings = runtime.readSettings(true)
  const hosts = host === 'all' ? ['claude', 'gemini', 'grok', 'cursor', 'codex'] : [host]
  const reports = hosts.map((target) => inspectDoctorHost(target, settings))
  const summary = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1
    acc.issueCount += report.issues.length
    return acc
  }, { ok: 0, drift: 0, 'manual-plugin': 0, 'not-installed': 0, issueCount: 0 })

  return {
    config: {
      packageVersion: runtime.pkgVersion,
      runtimeRoot: runtime.pkgRoot,
      packageRoot: runtime.sourceRoot || runtime.pkgRoot,
      installMode: settings.install_mode || DEFAULTS.install_mode,
      trackedHostModes: settings.host_install_modes || {},
    },
    hosts: reports,
    summary,
  }
}

export function runDoctor(rawArgs) {
  const { host, wantsJson } = parseDoctorArgs(rawArgs)
  const report = buildDoctorReport(host)
  if (wantsJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  printDoctorText(runtime, report)
}

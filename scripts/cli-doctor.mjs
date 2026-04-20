import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_CONFIG_HEADER, CODEX_PLUGIN_NAME } from './cli-codex.mjs'
import { DEFAULTS } from './cli-config.mjs'
import { printDoctorText } from './cli-doctor-render.mjs'
import { readTopLevelTomlLine } from './cli-toml.mjs'
import { loadHooksWithAbsPath, safeJson, safeRead } from './cli-utils.mjs'

const runtime = {
  home: '',
  pkgRoot: '',
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
  return String(value || '').replace(/\\/g, '/')
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
  return pickManagedHooks(loadHooksWithAbsPath(runtime.pkgRoot, hooksFile, pathVar)?.hooks || {})
}

function managedHooksMatch(actualHooks, expectedHooks) {
  return stringifySorted(pickManagedHooks(actualHooks || {})) === stringifySorted(expectedHooks || {})
}

function readBootstrapContent(fileName) {
  return normalizeText(safeRead(join(runtime.pkgRoot, fileName)) || '')
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
    if (host === 'claude') return '/plugin marketplace add hellowind777/helloagents'
    if (host === 'gemini') return 'gemini extensions install https://github.com/hellowind777/helloagents'
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
  const expectedHooks = readExpectedHooks('hooks-claude.json', '${CLAUDE_PLUGIN_ROOT}')
  const checks = {
    carrierMarker: (safeRead(join(claudeDir, 'CLAUDE.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(claudeDir, 'CLAUDE.md')) === readBootstrapContent('bootstrap-lite.md'),
    homeLink: safeRealTarget(join(claudeDir, 'helloagents')) === runtime.pkgRoot,
    settingsHooks: JSON.stringify(claudeSettings.hooks || {}).includes('helloagents'),
    settingsHooksMatch: managedHooksMatch(claudeSettings.hooks || {}, expectedHooks),
    settingsPermission: Array.isArray(claudeSettings.permissions?.allow)
      && claudeSettings.permissions.allow.includes('Read(~/.claude/helloagents/**)'),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 规则文件缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前 bootstrap-lite.md 不一致', 'Standby carrier content differs from the current bootstrap-lite.md'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
    if (checks.settingsHooks && !checks.settingsHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby settings hooks 与当前 hooks 配置不一致', 'Standby settings hooks differ from the current hook configuration'))
    if (!checks.settingsPermission) issues.push(buildDoctorIssue('standby-permission-missing', 'standby Claude 权限注入缺失', 'Standby Claude permission injection is missing'))
  }
  if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Claude Code 的 global 模式插件需手动安装；doctor 只检查 standby 残留，不直接探测插件状态。',
      'Claude Code global-mode plugins are manual; doctor only checks for standby residue and does not inspect plugin state directly.',
    ))
    if (checks.carrierMarker || checks.homeLink || checks.settingsHooks || checks.settingsPermission) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is tracked as global'))
    }
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

function inspectGeminiDoctor(settings) {
  const host = 'gemini'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const geminiDir = join(runtime.home, '.gemini')
  const geminiSettings = safeJson(join(geminiDir, 'settings.json')) || {}
  const expectedHooks = readExpectedHooks('hooks.json', '${extensionPath}')
  const checks = {
    carrierMarker: (safeRead(join(geminiDir, 'GEMINI.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(geminiDir, 'GEMINI.md')) === readBootstrapContent('bootstrap-lite.md'),
    homeLink: safeRealTarget(join(geminiDir, 'helloagents')) === runtime.pkgRoot,
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
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前 bootstrap-lite.md 不一致', 'Standby carrier content differs from the current bootstrap-lite.md'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
    if (checks.settingsHooks && !checks.settingsHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby settings hooks 与当前 hooks 配置不一致', 'Standby settings hooks differ from the current hook configuration'))
  }
  if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Gemini CLI 的 global 模式扩展需手动安装；doctor 只检查 standby 残留，不直接探测扩展状态。',
      'Gemini CLI global-mode extensions are manual; doctor only checks for standby residue and does not inspect extension state directly.',
    ))
    if (checks.carrierMarker || checks.homeLink || checks.settingsHooks) {
      issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 注入/链接', 'Standby injections or links still remain while the host is tracked as global'))
    }
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

function appendCodexStandbyIssues(issues, checks) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 规则文件缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前 bootstrap-lite.md 不一致', 'Standby carrier content differs from the current bootstrap-lite.md'))
  if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue('standby-model-instructions-missing', 'standby config 缺少受管 model_instructions_file', 'Standby config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue('standby-model-instructions-drift', 'standby model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Standby model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue('standby-notify-missing', 'standby notify 配置缺失', 'Standby notify configuration is missing'))
  if (checks.codexNotify && !checks.notifyPathMatch) issues.push(buildDoctorIssue('standby-notify-drift', 'standby notify 路径未指向当前包根目录', 'Standby notify path does not point to the current package root'))
  if (checks.pluginRoot || checks.pluginCache || checks.marketplaceEntry || checks.pluginEnabled || checks.globalNotifyPath) {
    issues.push(buildDoctorIssue('standby-global-residue', 'standby 模式下仍残留 global 插件文件或配置', 'Global plugin artifacts still remain while Codex is in standby mode'))
  }
}

function appendCodexGlobalIssues(issues, checks, pluginVersion, cacheVersion) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue('global-home-carrier-missing', 'global `~/.codex/AGENTS.md` 缺少 HelloAGENTS 规则内容', 'Global `~/.codex/AGENTS.md` is missing the HelloAGENTS carrier'))
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('global-home-carrier-drift', 'global `~/.codex/AGENTS.md` 与当前 bootstrap.md 不一致', 'Global `~/.codex/AGENTS.md` differs from the current bootstrap.md'))
  if (!checks.globalHomeLink) issues.push(buildDoctorIssue('global-read-root-link-missing', 'global `~/.codex/helloagents` 链接缺失或未指向当前插件根目录', 'Global `~/.codex/helloagents` link is missing or does not point to the current plugin root'))
  if (!checks.pluginRoot) issues.push(buildDoctorIssue('global-plugin-root-missing', 'global 插件根目录缺失', 'Global plugin root is missing'))
  if (!checks.pluginCache) issues.push(buildDoctorIssue('global-plugin-cache-missing', 'global 插件缓存目录缺失', 'Global plugin cache directory is missing'))
  if (checks.pluginRoot && !checks.pluginCarrierMatch) issues.push(buildDoctorIssue('global-plugin-carrier-drift', 'global 插件根目录中的 AGENTS.md 与当前 bootstrap.md 不一致', 'Global plugin AGENTS.md differs from the current bootstrap.md'))
  if (checks.pluginCache && !checks.pluginCacheCarrierMatch) issues.push(buildDoctorIssue('global-plugin-cache-carrier-drift', 'global 插件缓存中的 AGENTS.md 与当前 bootstrap.md 不一致', 'Global plugin cache AGENTS.md differs from the current bootstrap.md'))
  if (!checks.marketplaceEntry) issues.push(buildDoctorIssue('global-marketplace-missing', 'global marketplace 条目缺失', 'Global marketplace entry is missing'))
  if (!checks.pluginEnabled) issues.push(buildDoctorIssue('global-plugin-disabled', 'global config 中缺少插件启用段', 'Global plugin enablement block is missing from config'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue('global-model-instructions-missing', 'global config 缺少受管 model_instructions_file', 'Global config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue('global-model-instructions-drift', 'global model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Global model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.globalNotifyPath) issues.push(buildDoctorIssue('global-notify-missing', 'global notify 路径缺失', 'Global notify path is missing'))
  if (checks.globalNotifyPath && !checks.globalNotifyPathMatch) issues.push(buildDoctorIssue('global-notify-drift', 'global notify 路径未指向当前插件根目录', 'Global notify path does not point to the current plugin root'))
  if (pluginVersion && !checks.pluginVersionMatch) issues.push(buildDoctorIssue('global-plugin-version-drift', 'global 插件根目录版本与当前包版本不一致', 'Global plugin root version does not match the current package version'))
  if (cacheVersion && !checks.pluginCacheVersionMatch) issues.push(buildDoctorIssue('global-plugin-cache-version-drift', 'global 插件缓存版本与当前包版本不一致', 'Global plugin cache version does not match the current package version'))
  if (checks.homeLink) {
    issues.push(buildDoctorIssue('global-standby-link-residue', 'global 模式下仍残留 standby home 链接', 'Standby home link still remains while Codex is in global mode'))
  }
}

function inspectCodexDoctor(settings) {
  const host = 'codex'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const codexDir = join(runtime.home, '.codex')
  const codexConfig = safeRead(join(codexDir, 'config.toml')) || ''
  const pluginRoot = join(runtime.home, 'plugins', CODEX_PLUGIN_NAME)
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME, 'local')
  const marketplace = safeJson(join(runtime.home, '.agents', 'plugins', 'marketplace.json')) || {}
  const pluginVersion = safeJson(join(pluginRoot, 'package.json'))?.version || ''
  const cacheVersion = safeJson(join(pluginCacheRoot, 'package.json'))?.version || ''
  const homeLinkTarget = safeRealTarget(join(codexDir, 'helloagents'))
  const pkgRootTarget = safeRealTarget(runtime.pkgRoot) || normalizePath(runtime.pkgRoot)
  const pluginRootTarget = safeRealTarget(pluginRoot) || normalizePath(pluginRoot)
  const standbyNotifyPath = normalizePath(join(runtime.pkgRoot, 'scripts', 'notify.mjs'))
  const globalNotifyPath = normalizePath(join(pluginRoot, 'scripts', 'notify.mjs'))
  const managedHomeCarrierPath = normalizePath(join(codexDir, 'AGENTS.md'))
  const modelInstructionsLine = readTopLevelTomlLine(codexConfig, 'model_instructions_file')
  const expectedHomeCarrier = (detectedMode === 'global' || (detectedMode === 'none' && trackedMode === 'global'))
    ? 'bootstrap.md'
    : 'bootstrap-lite.md'
  const checks = {
    carrierMarker: (safeRead(join(codexDir, 'AGENTS.md')) || '').includes('HELLOAGENTS_START'),
    carrierContentMatch: extractManagedCarrierContent(join(codexDir, 'AGENTS.md')) === readBootstrapContent(expectedHomeCarrier),
    homeLink: homeLinkTarget === pkgRootTarget,
    globalHomeLink: homeLinkTarget === pluginRootTarget,
    modelInstructionsFile: !!modelInstructionsLine,
    modelInstructionsPathMatch: !!modelInstructionsLine
      && normalizePath(modelInstructionsLine).includes(`"${managedHomeCarrierPath}"`),
    codexNotify: codexConfig.includes('codex-notify'),
    notifyPathMatch: codexConfig.includes(standbyNotifyPath),
    pluginRoot: existsSync(pluginRoot),
    pluginCache: existsSync(pluginCacheRoot),
    pluginCarrierMatch: normalizeText(safeRead(join(pluginRoot, 'AGENTS.md')) || '') === readBootstrapContent('bootstrap.md'),
    pluginCacheCarrierMatch: normalizeText(safeRead(join(pluginCacheRoot, 'AGENTS.md')) || '') === readBootstrapContent('bootstrap.md'),
    marketplaceEntry: Array.isArray(marketplace.plugins) && marketplace.plugins.some((plugin) => plugin?.name === CODEX_PLUGIN_NAME),
    pluginEnabled: codexConfig.includes(CODEX_PLUGIN_CONFIG_HEADER) && codexConfig.includes('enabled = true'),
    globalNotifyPath: codexConfig.includes('/plugins/helloagents/scripts/notify.mjs'),
    globalNotifyPathMatch: codexConfig.includes(globalNotifyPath),
    pluginVersionMatch: pluginVersion ? pluginVersion === runtime.pkgVersion : false,
    pluginCacheVersionMatch: cacheVersion ? cacheVersion === runtime.pkgVersion : false,
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    appendCodexStandbyIssues(issues, checks)
  }
  if (detectedMode === 'global') {
    appendCodexGlobalIssues(issues, checks, pluginVersion, cacheVersion)
  }
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue('untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none') {
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }
  if (!checks.pluginVersionMatch && !pluginVersion && detectedMode === 'global') {
    notes.push(runtime.msg('未读到 global 插件根目录版本信息', 'Global plugin root version was not readable'))
  }
  if (!checks.pluginCacheVersionMatch && !cacheVersion && detectedMode === 'global') {
    notes.push(runtime.msg('未读到 global 插件缓存版本信息', 'Global plugin cache version was not readable'))
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
  if (host === 'gemini') return inspectGeminiDoctor(settings)
  return inspectCodexDoctor(settings)
}

function buildDoctorReport(host) {
  const settings = runtime.readSettings(true)
  const hosts = host === 'all' ? ['claude', 'gemini', 'codex'] : [host]
  const reports = hosts.map((target) => inspectDoctorHost(target, settings))
  const summary = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1
    acc.issueCount += report.issues.length
    return acc
  }, { ok: 0, drift: 0, 'manual-plugin': 0, 'not-installed': 0, issueCount: 0 })

  return {
    config: {
      packageVersion: runtime.pkgVersion,
      packageRoot: runtime.pkgRoot,
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

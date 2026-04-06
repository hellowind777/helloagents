import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_CONFIG_HEADER, CODEX_PLUGIN_NAME } from './cli-codex.mjs'
import { DEFAULTS } from './cli-config.mjs'
import { printDoctorText } from './cli-doctor-render.mjs'
import { safeJson, safeRead } from './cli-utils.mjs'

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
  const checks = {
    carrierMarker: (safeRead(join(claudeDir, 'CLAUDE.md')) || '').includes('HELLOAGENTS_START'),
    homeLink: safeRealTarget(join(claudeDir, 'helloagents')) === runtime.pkgRoot,
    settingsHooks: JSON.stringify(claudeSettings.hooks || {}).includes('helloagents'),
    settingsPermission: Array.isArray(claudeSettings.permissions?.allow)
      && claudeSettings.permissions.allow.includes('Read(~/.claude/helloagents/**)'),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 载体缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
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
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应受管痕迹', 'Config says this CLI is installed, but no managed artifacts were detected'))
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
  const checks = {
    carrierMarker: (safeRead(join(geminiDir, 'GEMINI.md')) || '').includes('HELLOAGENTS_START'),
    homeLink: safeRealTarget(join(geminiDir, 'helloagents')) === runtime.pkgRoot,
    settingsHooks: JSON.stringify(geminiSettings.hooks || {}).includes('helloagents'),
  }

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue('tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') {
    if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 载体缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
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
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应受管痕迹', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }

  const status = summarizeDoctorStatus(issues, { host, trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestDoctorFix(host, status, trackedMode) }
}

function appendCodexStandbyIssues(issues, checks) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue('standby-carrier-missing', 'standby 载体缺少 HELLOAGENTS 标记', 'Standby carrier is missing the HELLOAGENTS marker'))
  if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向当前包根目录', 'Standby home link is missing or points to a different package root'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue('standby-notify-missing', 'standby notify 配置缺失', 'Standby notify configuration is missing'))
  if (!checks.developerInstructions) issues.push(buildDoctorIssue('standby-developer-instructions-missing', 'standby developer_instructions 缺失', 'Standby developer_instructions block is missing'))
  if (checks.pluginRoot || checks.pluginCache || checks.marketplaceEntry || checks.pluginEnabled || checks.globalNotifyPath) {
    issues.push(buildDoctorIssue('standby-global-residue', 'standby 模式下仍残留 global 插件链路', 'Global plugin artifacts still remain while Codex is in standby mode'))
  }
}

function appendCodexGlobalIssues(issues, checks, pluginVersion, cacheVersion) {
  if (!checks.pluginRoot) issues.push(buildDoctorIssue('global-plugin-root-missing', 'global 插件根目录缺失', 'Global plugin root is missing'))
  if (!checks.pluginCache) issues.push(buildDoctorIssue('global-plugin-cache-missing', 'global 插件缓存目录缺失', 'Global plugin cache directory is missing'))
  if (!checks.marketplaceEntry) issues.push(buildDoctorIssue('global-marketplace-missing', 'global marketplace 条目缺失', 'Global marketplace entry is missing'))
  if (!checks.pluginEnabled) issues.push(buildDoctorIssue('global-plugin-disabled', 'global config 中缺少插件启用段', 'Global plugin enablement block is missing from config'))
  if (!checks.globalNotifyPath) issues.push(buildDoctorIssue('global-notify-missing', 'global notify 路径缺失', 'Global notify path is missing'))
  if (!checks.developerInstructions) issues.push(buildDoctorIssue('global-developer-instructions-missing', 'global developer_instructions 缺失', 'Global developer_instructions block is missing'))
  if (pluginVersion && !checks.pluginVersionMatch) issues.push(buildDoctorIssue('global-plugin-version-drift', 'global 插件根目录版本与当前包版本不一致', 'Global plugin root version does not match the current package version'))
  if (cacheVersion && !checks.pluginCacheVersionMatch) issues.push(buildDoctorIssue('global-plugin-cache-version-drift', 'global 插件缓存版本与当前包版本不一致', 'Global plugin cache version does not match the current package version'))
  if (checks.carrierMarker || checks.homeLink) {
    issues.push(buildDoctorIssue('global-standby-residue', 'global 模式下仍残留 standby 载体或链接', 'Standby carrier or link still remains while Codex is in global mode'))
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
  const checks = {
    carrierMarker: (safeRead(join(codexDir, 'AGENTS.md')) || '').includes('HELLOAGENTS_START'),
    homeLink: safeRealTarget(join(codexDir, 'helloagents')) === runtime.pkgRoot,
    codexNotify: codexConfig.includes('codex-notify'),
    developerInstructions: codexConfig.includes('HelloAGENTS'),
    pluginRoot: existsSync(pluginRoot),
    pluginCache: existsSync(pluginCacheRoot),
    marketplaceEntry: Array.isArray(marketplace.plugins) && marketplace.plugins.some((plugin) => plugin?.name === CODEX_PLUGIN_NAME),
    pluginEnabled: codexConfig.includes(CODEX_PLUGIN_CONFIG_HEADER) && codexConfig.includes('enabled = true'),
    globalNotifyPath: codexConfig.includes('/plugins/helloagents/scripts/notify.mjs'),
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
    issues.push(buildDoctorIssue('tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应受管痕迹', 'Config says this CLI is installed, but no managed artifacts were detected'))
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

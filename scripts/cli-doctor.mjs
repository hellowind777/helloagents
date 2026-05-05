import { realpathSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULTS } from './cli-config.mjs'
import { inspectCodexDoctor as inspectCodexDoctorImpl } from './cli-doctor-codex.mjs'
import { printDoctorText } from './cli-doctor-render.mjs'
import { buildRuntimeCarrier } from './cli-runtime-carrier.mjs'
import { readTopLevelTomlLine } from './cli-toml.mjs'
import { loadHooksWithCliEntry, safeJson, safeRead } from './cli-utils.mjs'

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
  return pickManagedHooks(loadHooksWithCliEntry(runtime.pkgRoot, hooksFile, pathVar)?.hooks || {})
}

function managedHooksMatch(actualHooks, expectedHooks) {
  return stringifySorted(pickManagedHooks(actualHooks || {})) === stringifySorted(expectedHooks || {})
}

function readExpectedCarrierContent(fileName, settings) {
  const bootstrap = safeRead(join(runtime.pkgRoot, fileName)) || ''
  return normalizeText(buildRuntimeCarrier(bootstrap, settings))
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
    if (host === 'claude') return '/plugin marketplace add hellowind777/helloagents; /plugin install helloagents@helloagents'
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
    carrierContentMatch: extractManagedCarrierContent(join(claudeDir, 'CLAUDE.md'))
      === readExpectedCarrierContent('bootstrap-lite.md', settings),
    homeLink: safeRealTarget(join(claudeDir, 'helloagents')) === runtime.pkgRoot,
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
  if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Claude Code 的 global 模式由宿主插件系统管理；doctor 只检查 standby 残留，不直接探测插件状态。',
      'Claude Code global mode is managed by the host plugin system; doctor only checks for standby residue and does not inspect plugin state directly.',
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
    carrierContentMatch: extractManagedCarrierContent(join(geminiDir, 'GEMINI.md'))
      === readExpectedCarrierContent('bootstrap-lite.md', settings),
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
    if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue('standby-carrier-drift', 'standby 规则文件内容与当前标准模式规则不一致', 'Standby carrier content differs from the current standby rules'))
    if (!checks.homeLink) issues.push(buildDoctorIssue('standby-link-missing', 'standby home 链接缺失或未指向稳定运行根目录', 'Standby home link is missing or points to a different runtime root'))
    if (!checks.settingsHooks) issues.push(buildDoctorIssue('standby-hooks-missing', 'standby settings hooks 缺失', 'Standby settings hooks are missing'))
    if (checks.settingsHooks && !checks.settingsHooksMatch) issues.push(buildDoctorIssue('standby-hooks-drift', 'standby settings hooks 与当前 hooks 配置不一致', 'Standby settings hooks differ from the current hook configuration'))
  }
  if (trackedMode === 'global') {
    notes.push(runtime.msg(
      'Gemini CLI 的 global 模式由宿主扩展系统管理；doctor 只检查 standby 残留，不直接探测扩展状态。',
      'Gemini CLI global mode is managed by the host extension system; doctor only checks for standby residue and does not inspect extension state directly.',
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
  return inspectCodexDoctorImpl(runtime, settings)
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

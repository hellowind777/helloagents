import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import { CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_CONFIG_HEADER, CODEX_PLUGIN_NAME } from './cli-codex.mjs'
import {
  CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH,
  CODEX_MANAGED_NOTIFY_VALUE,
  readCodexHooksFeatureLine,
} from './cli-codex-config.mjs'
import { buildRuntimeCarrier } from './cli-runtime-carrier.mjs'
import { readTopLevelTomlLine } from './cli-toml.mjs'
import { loadHooksWithCliEntry, safeJson, safeRead } from './cli-utils.mjs'

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

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortJson(value[key])
      return acc
    }, {})
  }
  return value
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

function managedHooksMatch(actualHooks, expectedHooks) {
  return JSON.stringify(sortJson(pickManagedHooks(actualHooks || {})))
    === JSON.stringify(sortJson(expectedHooks || {}))
}

function readExpectedHooks(runtime, hooksFile, pathVar) {
  return pickManagedHooks(loadHooksWithCliEntry(runtime.pkgRoot, hooksFile, pathVar)?.hooks || {})
}

function readExpectedCarrierContent(runtime, fileName, settings) {
  const bootstrap = safeRead(join(runtime.pkgRoot, fileName)) || ''
  return normalizeText(buildRuntimeCarrier(bootstrap, settings))
}

function buildDoctorIssue(runtime, code, cn, en) {
  return {
    code,
    message: runtime.msg(cn, en),
  }
}

function normalizeDoctorMode(mode = '') {
  return mode || 'none'
}

function summarizeDoctorStatus(issues, { trackedMode, detectedMode } = {}) {
  if (issues.length > 0) return 'drift'
  if (detectedMode !== 'none') return 'ok'
  if (trackedMode !== 'none') return 'drift'
  return 'not-installed'
}

function suggestCodexDoctorFix(status, trackedMode) {
  if (status === 'drift') {
    return `helloagents update codex${trackedMode && trackedMode !== 'none' ? ` --${trackedMode}` : ''}`
  }
  if (status === 'not-installed') return 'helloagents install codex --standby'
  return ''
}

function appendCodexStandbyIssues(runtime, issues, checks) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue(runtime, 'standby-carrier-missing', 'standby `~/.codex/AGENTS.md` 缺少 HelloAGENTS 标记', 'Standby `~/.codex/AGENTS.md` is missing the HELLOAGENTS marker'))
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue(runtime, 'standby-carrier-drift', 'standby `~/.codex/AGENTS.md` 与当前 bootstrap-lite.md 不一致', 'Standby `~/.codex/AGENTS.md` differs from the current bootstrap-lite.md'))
  if (!checks.homeLink) issues.push(buildDoctorIssue(runtime, 'standby-link-missing', 'standby `~/.codex/helloagents` 链接缺失或未指向稳定运行根目录', 'Standby `~/.codex/helloagents` link is missing or points to a different runtime root'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue(runtime, 'standby-model-instructions-missing', 'standby config 缺少受管 model_instructions_file', 'Standby config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue(runtime, 'standby-model-instructions-drift', 'standby model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Standby model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue(runtime, 'standby-notify-missing', 'standby notify 配置缺失', 'Standby notify configuration is missing'))
  if (checks.codexNotify && !checks.notifyPathMatch) issues.push(buildDoctorIssue(runtime, 'standby-notify-drift', 'standby notify 未使用受管命令入口', 'Standby notify does not use the managed command entrypoint'))
  if (!checks.codexHooksFeature) issues.push(buildDoctorIssue(runtime, 'codex-hooks-feature-missing', 'Codex hooks 功能未启用', 'Codex hooks feature is not enabled'))
  if (!checks.standaloneHooks) issues.push(buildDoctorIssue(runtime, 'standby-hooks-missing', 'standby `~/.codex/hooks.json` 缺少 HelloAGENTS hooks', 'Standby `~/.codex/hooks.json` is missing HelloAGENTS hooks'))
  if (checks.standaloneHooks && !checks.standaloneHooksMatch) issues.push(buildDoctorIssue(runtime, 'standby-hooks-drift', 'standby `~/.codex/hooks.json` 与当前 hooks-codex.json 不一致', 'Standby `~/.codex/hooks.json` differs from the current hooks-codex.json'))
  if (checks.pluginRoot || checks.pluginCache || checks.marketplaceEntry || checks.pluginEnabled) {
    issues.push(buildDoctorIssue(runtime, 'standby-global-residue', 'standby 模式下仍残留 global 插件文件或配置', 'Global plugin artifacts still remain while Codex is in standby mode'))
  }
}

function appendCodexGlobalIssues(runtime, issues, checks, pluginVersion, cacheVersion) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue(runtime, 'global-home-carrier-missing', 'global `~/.codex/AGENTS.md` 缺少 HelloAGENTS 规则内容', 'Global `~/.codex/AGENTS.md` is missing the HelloAGENTS carrier'))
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue(runtime, 'global-home-carrier-drift', 'global `~/.codex/AGENTS.md` 与当前 bootstrap.md 不一致', 'Global `~/.codex/AGENTS.md` differs from the current bootstrap.md'))
  if (!checks.globalHomeLink) issues.push(buildDoctorIssue(runtime, 'global-read-root-link-missing', 'global `~/.codex/helloagents` 链接缺失或未指向当前插件根目录', 'Global `~/.codex/helloagents` link is missing or does not point to the current plugin root'))
  if (!checks.pluginRoot) issues.push(buildDoctorIssue(runtime, 'global-plugin-root-missing', 'global 插件根目录缺失', 'Global plugin root is missing'))
  if (!checks.pluginCache) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-missing', 'global 插件缓存目录缺失', 'Global plugin cache directory is missing'))
  if (checks.pluginRoot && !checks.pluginCarrierMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-carrier-drift', 'global 插件根目录中的 AGENTS.md 与当前 bootstrap.md 不一致', 'Global plugin AGENTS.md differs from the current bootstrap.md'))
  if (checks.pluginCache && !checks.pluginCacheCarrierMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-carrier-drift', 'global 插件缓存中的 AGENTS.md 与当前 bootstrap.md 不一致', 'Global plugin cache AGENTS.md differs from the current bootstrap.md'))
  if (!checks.marketplaceEntry) issues.push(buildDoctorIssue(runtime, 'global-marketplace-missing', 'global marketplace 条目缺失', 'Global marketplace entry is missing'))
  if (!checks.pluginEnabled) issues.push(buildDoctorIssue(runtime, 'global-plugin-disabled', 'global config 中缺少插件启用段', 'Global plugin enablement block is missing from config'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue(runtime, 'global-model-instructions-missing', 'global config 缺少受管 model_instructions_file', 'Global config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue(runtime, 'global-model-instructions-drift', 'global model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Global model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue(runtime, 'global-notify-missing', 'global notify 配置缺失', 'Global notify configuration is missing'))
  if (checks.codexNotify && !checks.globalNotifyPathMatch) issues.push(buildDoctorIssue(runtime, 'global-notify-drift', 'global notify 未使用受管命令入口', 'Global notify does not use the managed command entrypoint'))
  if (!checks.codexHooksFeature) issues.push(buildDoctorIssue(runtime, 'codex-hooks-feature-missing', 'Codex hooks 功能未启用', 'Codex hooks feature is not enabled'))
  if (!checks.standaloneHooks) issues.push(buildDoctorIssue(runtime, 'global-hooks-missing', 'global `~/.codex/hooks.json` 缺少 HelloAGENTS hooks', 'Global `~/.codex/hooks.json` is missing HelloAGENTS hooks'))
  if (checks.standaloneHooks && !checks.standaloneHooksMatch) issues.push(buildDoctorIssue(runtime, 'global-hooks-drift', 'global `~/.codex/hooks.json` 与当前 hooks-codex.json 不一致', 'Global `~/.codex/hooks.json` differs from the current hooks-codex.json'))
  if (pluginVersion && !checks.pluginVersionMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-version-drift', 'global 插件根目录版本与当前包版本不一致', 'Global plugin root version does not match the current package version'))
  if (cacheVersion && !checks.pluginCacheVersionMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-version-drift', 'global 插件缓存版本与当前包版本不一致', 'Global plugin cache version does not match the current package version'))
  if (checks.homeLink) issues.push(buildDoctorIssue(runtime, 'global-standby-link-residue', 'global 模式下仍残留 standby home 链接', 'Standby home link still remains while Codex is in global mode'))
}

function buildCodexChecks(runtime, settings, trackedMode, detectedMode) {
  const codexDir = join(runtime.home, '.codex')
  const codexConfig = safeRead(join(codexDir, 'config.toml')) || ''
  const pluginRoot = join(runtime.home, 'plugins', CODEX_PLUGIN_NAME)
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME, 'local')
  const homeLinkTarget = safeRealTarget(join(codexDir, 'helloagents'))
  const expectedHomeCarrier = (detectedMode === 'global' || (detectedMode === 'none' && trackedMode === 'global'))
    ? 'bootstrap.md'
    : 'bootstrap-lite.md'
  const codexHooks = safeJson(join(codexDir, 'hooks.json')) || {}
  const marketplace = safeJson(join(runtime.home, '.agents', 'plugins', 'marketplace.json')) || {}
  const modelInstructionsLine = readTopLevelTomlLine(codexConfig, 'model_instructions_file')
  const expectedHooks = readExpectedHooks(runtime, 'hooks-codex.json', '${PLUGIN_ROOT}')

  return {
    checks: {
      carrierMarker: (safeRead(join(codexDir, 'AGENTS.md')) || '').includes('HELLOAGENTS_START'),
      carrierContentMatch: normalizeText((safeRead(join(codexDir, 'AGENTS.md')) || '').match(/<!-- HELLOAGENTS_START -->([\s\S]*?)<!-- HELLOAGENTS_END -->/)?.[1] || '')
        === readExpectedCarrierContent(runtime, expectedHomeCarrier, settings),
      homeLink: homeLinkTarget === (safeRealTarget(runtime.pkgRoot) || normalizePath(runtime.pkgRoot)),
      globalHomeLink: homeLinkTarget === (safeRealTarget(pluginRoot) || normalizePath(pluginRoot)),
      modelInstructionsFile: !!modelInstructionsLine,
      modelInstructionsPathMatch: !!modelInstructionsLine && normalizePath(modelInstructionsLine).includes(`"${CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH}"`),
      codexNotify: codexConfig.includes('codex-notify'),
      notifyPathMatch: codexConfig.includes(CODEX_MANAGED_NOTIFY_VALUE),
      codexHooksFeature: /^\s*codex_hooks\s*=\s*true\b/.test(readCodexHooksFeatureLine(codexConfig)),
      standaloneHooks: JSON.stringify(codexHooks.hooks || {}).includes('helloagents'),
      standaloneHooksMatch: managedHooksMatch(codexHooks.hooks || {}, expectedHooks),
      pluginRoot: existsSync(pluginRoot),
      pluginCache: existsSync(pluginCacheRoot),
      pluginCarrierMatch: normalizeText(safeRead(join(pluginRoot, 'AGENTS.md')) || '') === readExpectedCarrierContent(runtime, 'bootstrap.md', settings),
      pluginCacheCarrierMatch: normalizeText(safeRead(join(pluginCacheRoot, 'AGENTS.md')) || '') === readExpectedCarrierContent(runtime, 'bootstrap.md', settings),
      marketplaceEntry: Array.isArray(marketplace.plugins) && marketplace.plugins.some((plugin) => plugin?.name === CODEX_PLUGIN_NAME),
      pluginEnabled: codexConfig.includes(CODEX_PLUGIN_CONFIG_HEADER) && codexConfig.includes('enabled = true'),
      globalNotifyPathMatch: codexConfig.includes(CODEX_MANAGED_NOTIFY_VALUE),
      pluginVersionMatch: false,
      pluginCacheVersionMatch: false,
    },
    pluginVersion: safeJson(join(pluginRoot, 'package.json'))?.version || '',
    cacheVersion: safeJson(join(pluginCacheRoot, 'package.json'))?.version || '',
  }
}

export function inspectCodexDoctor(runtime, settings) {
  const host = 'codex'
  const trackedMode = normalizeDoctorMode(runtime.getTrackedHostMode(settings, host))
  const detectedMode = normalizeDoctorMode(runtime.detectHostMode(host))
  const { checks, pluginVersion, cacheVersion } = buildCodexChecks(runtime, settings, trackedMode, detectedMode)
  checks.pluginVersionMatch = pluginVersion ? pluginVersion === runtime.pkgVersion : false
  checks.pluginCacheVersionMatch = cacheVersion ? cacheVersion === runtime.pkgVersion : false

  const issues = []
  const notes = []
  if (trackedMode !== 'none' && detectedMode !== 'none' && trackedMode !== detectedMode) {
    issues.push(buildDoctorIssue(runtime, 'tracked-mode-mismatch', '记录模式与检测模式不一致', 'Tracked mode does not match detected mode'))
  }
  if (detectedMode === 'standby') appendCodexStandbyIssues(runtime, issues, checks)
  if (detectedMode === 'global') appendCodexGlobalIssues(runtime, issues, checks, pluginVersion, cacheVersion)
  if (trackedMode === 'none' && detectedMode !== 'none') {
    issues.push(buildDoctorIssue(runtime, 'untracked-managed-state', '检测到受管状态，但配置中未记录该 CLI 模式', 'Managed state detected but this CLI mode is not tracked in config'))
  }
  if (trackedMode !== 'none' && detectedMode === 'none') {
    issues.push(buildDoctorIssue(runtime, 'tracked-state-missing', '配置记录该 CLI 已安装，但未检测到对应的受管文件或配置', 'Config says this CLI is installed, but no managed artifacts were detected'))
  }
  if (!checks.pluginVersionMatch && !pluginVersion && detectedMode === 'global') notes.push(runtime.msg('未读到 global 插件根目录版本信息', 'Global plugin root version was not readable'))
  if (!checks.pluginCacheVersionMatch && !cacheVersion && detectedMode === 'global') notes.push(runtime.msg('未读到 global 插件缓存版本信息', 'Global plugin cache version was not readable'))

  const status = summarizeDoctorStatus(issues, { trackedMode, detectedMode })
  return { host, label: runtime.getHostLabel(host), trackedMode, detectedMode, status, checks, issues, notes, suggestedFix: suggestCodexDoctorFix(status, trackedMode) }
}

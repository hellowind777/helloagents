import { existsSync, realpathSync } from 'node:fs'
import { platform } from 'node:os'
import { join } from 'node:path'

import { CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_CONFIG_HEADER, CODEX_PLUGIN_NAME } from './cli-codex.mjs'
import {
  analyzeCodexNotifyBlock,
  CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH,
  readCodexGoalsFeatureLine,
  readCodexHooksFeatureLine,
} from './cli-codex-config.mjs'
import {
  buildManagedCodexHookTrustEntries,
  readCodexHookStateSections,
} from './cli-codex-hooks-state.mjs'
import { getStableRuntimeRoot } from './cli-runtime-root.mjs'
import { buildRuntimeCarrier } from './cli-runtime-carrier.mjs'
import { readTopLevelTomlBlock, readTopLevelTomlLine } from './cli-toml.mjs'
import { spawnCommandSync } from './cli-process.mjs'
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

function readExpectedCarrierContent(runtime, fileName, settings, options = {}) {
  const bootstrap = safeRead(join(runtime.pkgRoot, fileName)) || ''
  return normalizeText(buildRuntimeCarrier(bootstrap, settings, options))
}

function buildDoctorIssue(runtime, code, cn, en) {
  return {
    code,
    message: runtime.msg(cn, en),
  }
}

function normalizeDoctorText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function readFirstInteger(value = '') {
  const match = String(value || '').match(/-?\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

function readNativeDoctorDetail(checks, checkId, detailKey) {
  return String(checks?.[checkId]?.details?.[detailKey] || '').trim()
}

function readNativeDoctorList(value = '') {
  const normalized = normalizeDoctorText(value)
  if (!normalized || normalized === '(none)') return []
  return normalized.split(/\s*,\s*/).map((entry) => entry.trim()).filter(Boolean)
}

function summarizeNativeCodexDoctor(payload = {}) {
  const checks = payload?.checks || {}
  const configCheck = checks['config.load'] || {}
  const sandboxCheck = checks['sandbox.helpers'] || {}
  const mcpCount = readFirstInteger(readNativeDoctorDetail(checks, 'config.load', 'mcp servers'))
  const fsSandbox = readNativeDoctorDetail(checks, 'sandbox.helpers', 'filesystem sandbox').toLowerCase()
  const linuxHelper = readNativeDoctorDetail(checks, 'sandbox.helpers', 'codex-linux-sandbox helper').toLowerCase()
    || readNativeDoctorDetail(checks, 'sandbox.helpers', 'linux helper').toLowerCase()
  const execveHelper = readNativeDoctorDetail(checks, 'sandbox.helpers', 'execve wrapper helper').toLowerCase()

  let sandboxAvailable = null
  if (sandboxCheck && Object.keys(sandboxCheck).length > 0) {
    sandboxAvailable = Boolean(
      (fsSandbox && !fsSandbox.includes('unrestricted'))
      || (linuxHelper && linuxHelper !== 'none')
      || (execveHelper && execveHelper !== 'none')
    )
  }

  return {
    version: String(payload?.codexVersion || '').trim(),
    configPath: readNativeDoctorDetail(checks, 'config.load', 'config.toml'),
    resolvedProvider: readNativeDoctorDetail(checks, 'config.load', 'model provider'),
    resolvedModel: readNativeDoctorDetail(checks, 'config.load', 'model'),
    sandboxAvailable,
    mcpPresent: typeof mcpCount === 'number' ? mcpCount > 0 : false,
    skillsSelected: readNativeDoctorList(
      readNativeDoctorDetail(checks, 'config.load', 'selected skills')
      || readNativeDoctorDetail(checks, 'config.load', 'skills selected')
    ),
  }
}

function summarizeNativeCodexDoctorOutput(payload = {}) {
  const checks = Object.values(payload?.checks || {})
  const failedCheck = checks.find((check) => check?.status === 'fail')
  if (failedCheck?.issues?.length) {
    return normalizeDoctorText(failedCheck.issues.map((issue) => issue?.cause || issue?.measured || '').filter(Boolean).join(' | '))
  }
  if (failedCheck?.summary) return normalizeDoctorText(failedCheck.summary)

  const warningCheck = checks.find((check) => check?.status === 'warn')
  if (warningCheck?.issues?.length) {
    return normalizeDoctorText(warningCheck.issues.map((issue) => issue?.cause || issue?.measured || '').filter(Boolean).join(' | '))
  }
  if (warningCheck?.summary) return normalizeDoctorText(warningCheck.summary)

  return ''
}

function inspectNativeCodexDoctor(runtime) {
  const command = platform() === 'win32' ? 'codex.cmd' : 'codex'
  try {
    const result = spawnCommandSync(command, ['doctor', '--json'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: runtime.home || process.env.HOME,
        USERPROFILE: runtime.home || process.env.USERPROFILE,
        NO_COLOR: process.env.NO_COLOR || '1',
      },
      encoding: 'utf-8',
      timeout: 20_000,
      windowsHide: true,
    })

    if (result.error) {
      return {
        available: false,
        ok: false,
        status: '',
        summary: null,
        output: normalizeDoctorText(result.error.message || ''),
      }
    }

    const stdout = String(result.stdout || '').trim()
    if (!stdout) {
      return {
        available: true,
        ok: result.status === 0,
        status: '',
        summary: null,
        output: normalizeDoctorText(result.stderr || ''),
      }
    }

    try {
      const payload = JSON.parse(stdout)
      const status = String(payload?.overallStatus || '').trim().toLowerCase()
      return {
        available: true,
        ok: status ? status !== 'fail' : result.status === 0,
        status,
        summary: summarizeNativeCodexDoctor(payload),
        output: summarizeNativeCodexDoctorOutput(payload),
      }
    } catch {
      return {
        available: true,
        ok: result.status === 0,
        status: '',
        summary: null,
        output: normalizeDoctorText(stdout || result.stderr || ''),
      }
    }
  } catch (error) {
    return {
      available: false,
      ok: false,
      status: '',
      summary: null,
      output: normalizeDoctorText(error?.message || ''),
    }
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
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue(runtime, 'standby-carrier-drift', 'standby `~/.codex/AGENTS.md` 与当前标准模式规则不一致', 'Standby `~/.codex/AGENTS.md` differs from the current standby rules'))
  if (!checks.homeLink) issues.push(buildDoctorIssue(runtime, 'standby-link-missing', 'standby `~/.codex/helloagents` 链接缺失或未指向稳定运行根目录', 'Standby `~/.codex/helloagents` link is missing or points to a different runtime root'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue(runtime, 'standby-model-instructions-missing', 'standby config 缺少受管 model_instructions_file', 'Standby config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue(runtime, 'standby-model-instructions-drift', 'standby model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Standby model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue(runtime, 'standby-notify-missing', 'standby notify 配置缺失', 'Standby notify configuration is missing'))
  if (checks.codexNotify && !checks.notifyPathMatch) issues.push(buildDoctorIssue(runtime, 'standby-notify-drift', 'standby notify 未使用受管命令入口', 'Standby notify does not use the managed command entrypoint'))
  if (!checks.codexHooksFeature) issues.push(buildDoctorIssue(runtime, 'codex-hooks-feature-disabled', 'Codex hooks 功能被显式关闭', 'Codex hooks feature is explicitly disabled'))
  if (!checks.standaloneHooks) issues.push(buildDoctorIssue(runtime, 'standby-hooks-missing', 'standby `~/.codex/hooks.json` 缺少 HelloAGENTS hooks', 'Standby `~/.codex/hooks.json` is missing HelloAGENTS hooks'))
  if (checks.standaloneHooks && !checks.standaloneHooksMatch) issues.push(buildDoctorIssue(runtime, 'standby-hooks-drift', 'standby `~/.codex/hooks.json` 与当前 hooks-codex.json 不一致', 'Standby `~/.codex/hooks.json` differs from the current hooks-codex.json'))
  if (checks.standaloneHooks && !checks.managedHookTrust) issues.push(buildDoctorIssue(runtime, 'standby-hook-trust-missing', 'standby `config.toml` 缺少 HelloAGENTS hooks trust 本机状态', 'Standby `config.toml` is missing HelloAGENTS machine-local hook trust metadata'))
  if (checks.standaloneHooks && checks.managedHookTrust && !checks.managedHookTrustMatch) issues.push(buildDoctorIssue(runtime, 'standby-hook-trust-drift', 'standby hooks trust 本机状态与当前 hooks 定义或本机路径不一致', 'Standby machine-local hook trust metadata differs from the current hooks definition or local path'))
  if (checks.pluginRoot || checks.pluginCache || checks.marketplaceEntry || checks.pluginEnabled) {
    issues.push(buildDoctorIssue(runtime, 'standby-global-residue', 'standby 模式下仍残留 global 插件文件或配置', 'Global plugin artifacts still remain while Codex is in standby mode'))
  }
}

function appendCodexGlobalIssues(runtime, issues, checks, pluginVersion, cacheVersion) {
  if (!checks.carrierMarker) issues.push(buildDoctorIssue(runtime, 'global-home-carrier-missing', 'global `~/.codex/AGENTS.md` 缺少 HelloAGENTS 规则内容', 'Global `~/.codex/AGENTS.md` is missing the HelloAGENTS carrier'))
  if (checks.carrierMarker && !checks.carrierContentMatch) issues.push(buildDoctorIssue(runtime, 'global-home-carrier-drift', 'global `~/.codex/AGENTS.md` 与当前全局模式规则不一致', 'Global `~/.codex/AGENTS.md` differs from the current global rules'))
  if (!checks.globalHomeLink) issues.push(buildDoctorIssue(runtime, 'global-read-root-link-missing', 'global `~/.codex/helloagents` 链接缺失或未指向稳定运行根目录', 'Global `~/.codex/helloagents` link is missing or does not point to the stable runtime root'))
  if (!checks.pluginRoot) issues.push(buildDoctorIssue(runtime, 'global-plugin-root-missing', 'global 插件根目录缺失', 'Global plugin root is missing'))
  if (!checks.pluginCache) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-missing', 'global 插件缓存目录缺失', 'Global plugin cache directory is missing'))
  if (checks.pluginRoot && !checks.pluginRootLink) issues.push(buildDoctorIssue(runtime, 'global-plugin-root-link-drift', 'global 插件根目录未链接到稳定运行根目录', 'Global plugin root does not link to the stable runtime root'))
  if (checks.pluginCache && !checks.pluginCacheLink) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-link-drift', 'global 插件缓存未链接到稳定运行根目录', 'Global plugin cache does not link to the stable runtime root'))
  if (checks.pluginGenericHooks) issues.push(buildDoctorIssue(runtime, 'global-plugin-generic-hooks-present', 'global 插件根目录中意外存在通用 `hooks/hooks.json`，可能污染 Codex 本地插件 hook 加载', 'Global plugin root unexpectedly contains a generic `hooks/hooks.json`, which can pollute Codex local-plugin hook loading'))
  if (checks.pluginCacheGenericHooks) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-generic-hooks-present', 'global 插件缓存中意外存在通用 `hooks/hooks.json`，可能污染 Codex 本地插件 hook 加载', 'Global plugin cache unexpectedly contains a generic `hooks/hooks.json`, which can pollute Codex local-plugin hook loading'))
  if (checks.pluginRoot && !checks.pluginCarrierMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-carrier-drift', 'global 插件根目录中的 AGENTS.md 与当前全局模式规则不一致', 'Global plugin AGENTS.md differs from the current global rules'))
  if (checks.pluginCache && !checks.pluginCacheCarrierMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-carrier-drift', 'global 插件缓存中的 AGENTS.md 与当前全局模式规则不一致', 'Global plugin cache AGENTS.md differs from the current global rules'))
  if (!checks.marketplaceEntry) issues.push(buildDoctorIssue(runtime, 'global-marketplace-missing', 'global marketplace 条目缺失', 'Global marketplace entry is missing'))
  if (!checks.pluginEnabled) issues.push(buildDoctorIssue(runtime, 'global-plugin-disabled', 'global config 中缺少插件启用段', 'Global plugin enablement block is missing from config'))
  if (!checks.modelInstructionsFile) issues.push(buildDoctorIssue(runtime, 'global-model-instructions-missing', 'global config 缺少受管 model_instructions_file', 'Global config is missing the managed model_instructions_file'))
  if (checks.modelInstructionsFile && !checks.modelInstructionsPathMatch) issues.push(buildDoctorIssue(runtime, 'global-model-instructions-drift', 'global model_instructions_file 未指向受管 `~/.codex/AGENTS.md`', 'Global model_instructions_file does not point to the managed `~/.codex/AGENTS.md`'))
  if (!checks.codexNotify) issues.push(buildDoctorIssue(runtime, 'global-notify-missing', 'global notify 配置缺失', 'Global notify configuration is missing'))
  if (checks.codexNotify && !checks.globalNotifyPathMatch) issues.push(buildDoctorIssue(runtime, 'global-notify-drift', 'global notify 未使用受管命令入口', 'Global notify does not use the managed command entrypoint'))
  if (!checks.codexHooksFeature) issues.push(buildDoctorIssue(runtime, 'codex-hooks-feature-disabled', 'Codex hooks 功能被显式关闭', 'Codex hooks feature is explicitly disabled'))
  if (!checks.standaloneHooks) issues.push(buildDoctorIssue(runtime, 'global-hooks-missing', 'global `~/.codex/hooks.json` 缺少 HelloAGENTS hooks', 'Global `~/.codex/hooks.json` is missing HelloAGENTS hooks'))
  if (checks.standaloneHooks && !checks.standaloneHooksMatch) issues.push(buildDoctorIssue(runtime, 'global-hooks-drift', 'global `~/.codex/hooks.json` 与当前 hooks-codex.json 不一致', 'Global `~/.codex/hooks.json` differs from the current hooks-codex.json'))
  if (checks.standaloneHooks && !checks.managedHookTrust) issues.push(buildDoctorIssue(runtime, 'global-hook-trust-missing', 'global `config.toml` 缺少 HelloAGENTS hooks trust 本机状态', 'Global `config.toml` is missing HelloAGENTS machine-local hook trust metadata'))
  if (checks.standaloneHooks && checks.managedHookTrust && !checks.managedHookTrustMatch) issues.push(buildDoctorIssue(runtime, 'global-hook-trust-drift', 'global hooks trust 本机状态与当前 hooks 定义或本机路径不一致', 'Global machine-local hook trust metadata differs from the current hooks definition or local path'))
  if (pluginVersion && !checks.pluginVersionMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-version-drift', 'global 插件根目录版本与当前包版本不一致', 'Global plugin root version does not match the current package version'))
  if (cacheVersion && !checks.pluginCacheVersionMatch) issues.push(buildDoctorIssue(runtime, 'global-plugin-cache-version-drift', 'global 插件缓存版本与当前包版本不一致', 'Global plugin cache version does not match the current package version'))
}

function buildCodexChecks(runtime, settings, trackedMode, detectedMode) {
  const codexDir = join(runtime.home, '.codex')
  const codexConfig = safeRead(join(codexDir, 'config.toml')) || ''
  const pluginRoot = join(runtime.home, 'plugins', CODEX_PLUGIN_NAME)
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME, 'local')
  const runtimeRoot = safeRealTarget(getStableRuntimeRoot(runtime.home)) || normalizePath(getStableRuntimeRoot(runtime.home))
  const homeLinkTarget = safeRealTarget(join(codexDir, 'helloagents'))
  const pluginRootTarget = safeRealTarget(pluginRoot)
  const pluginCacheTarget = safeRealTarget(pluginCacheRoot)
  const pluginGenericHooks = !!safeRead(join(pluginRoot, 'hooks', 'hooks.json'))
  const pluginCacheGenericHooks = !!safeRead(join(pluginCacheRoot, 'hooks', 'hooks.json'))
  const expectedHomeCarrier = (detectedMode === 'global' || (detectedMode === 'none' && trackedMode === 'global'))
    ? 'bootstrap.md'
    : 'bootstrap-lite.md'
  const codexHooks = safeJson(join(codexDir, 'hooks.json')) || {}
  const marketplace = safeJson(join(runtime.home, '.agents', 'plugins', 'marketplace.json')) || {}
  const modelInstructionsLine = readTopLevelTomlLine(codexConfig, 'model_instructions_file')
  const notifyBlock = readTopLevelTomlBlock(codexConfig, 'notify')
  const notifyAnalysis = analyzeCodexNotifyBlock(notifyBlock)
  const expectedHooks = readExpectedHooks(runtime, 'hooks-codex.json', '${PLUGIN_ROOT}')
  const expectedHookTrust = buildManagedCodexHookTrustEntries(join(codexDir, 'hooks.json'), codexHooks)
  const managedHookTrust = new Map(
    readCodexHookStateSections(codexConfig)
      .filter((section) => section.managed)
      .map((section) => [section.key, section.trustedHash]),
  )
  const hooksFeatureLine = readCodexHooksFeatureLine(codexConfig)
  const goalsFeatureLine = readCodexGoalsFeatureLine(codexConfig)
  return {
    checks: {
      carrierMarker: (safeRead(join(codexDir, 'AGENTS.md')) || '').includes('HELLOAGENTS_START'),
      carrierContentMatch: normalizeText((safeRead(join(codexDir, 'AGENTS.md')) || '').match(/<!-- HELLOAGENTS_START -->([\s\S]*?)<!-- HELLOAGENTS_END -->/)?.[1] || '')
        === readExpectedCarrierContent(
          runtime,
          expectedHomeCarrier,
          settings,
          expectedHomeCarrier === 'bootstrap.md' ? { profile: 'full' } : {},
        ),
      homeLink: homeLinkTarget === (safeRealTarget(runtime.pkgRoot) || normalizePath(runtime.pkgRoot)),
      globalHomeLink: homeLinkTarget === runtimeRoot,
      modelInstructionsFile: !!modelInstructionsLine,
      modelInstructionsPathMatch: !!modelInstructionsLine && normalizePath(modelInstructionsLine).includes(`"${CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH}"`),
      codexNotify: notifyAnalysis.containsCodexNotify,
      notifyPathMatch: notifyAnalysis.managed,
      notifyShape: notifyAnalysis.shape,
      codexHooksFeature: !/^\s*hooks\s*=\s*false\b/.test(hooksFeatureLine),
      codexGoalsFeature: /^\s*goals\s*=\s*true\b/.test(goalsFeatureLine),
      standaloneHooks: JSON.stringify(codexHooks.hooks || {}).includes('helloagents'),
      standaloneHooksMatch: managedHooksMatch(codexHooks.hooks || {}, expectedHooks),
      managedHookTrust: expectedHookTrust.every((entry) => managedHookTrust.has(entry.key)),
      managedHookTrustMatch: expectedHookTrust.every((entry) => managedHookTrust.get(entry.key) === entry.trustedHash),
      pluginRoot: existsSync(pluginRoot),
      pluginCache: existsSync(pluginCacheRoot),
      pluginRootLink: pluginRootTarget === runtimeRoot,
      pluginCacheLink: pluginCacheTarget === runtimeRoot,
      pluginGenericHooks,
      pluginCacheGenericHooks,
      pluginCarrierMatch: normalizeText(safeRead(join(pluginRoot, 'AGENTS.md')) || '') === readExpectedCarrierContent(runtime, 'bootstrap.md', settings, { profile: 'full' }),
      pluginCacheCarrierMatch: normalizeText(safeRead(join(pluginCacheRoot, 'AGENTS.md')) || '') === readExpectedCarrierContent(runtime, 'bootstrap.md', settings, { profile: 'full' }),
      marketplaceEntry: Array.isArray(marketplace.plugins) && marketplace.plugins.some((plugin) => plugin?.name === CODEX_PLUGIN_NAME),
      pluginEnabled: codexConfig.includes(CODEX_PLUGIN_CONFIG_HEADER) && codexConfig.includes('enabled = true'),
      globalNotifyPathMatch: notifyAnalysis.managed,
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
  const nativeDoctor = inspectNativeCodexDoctor(runtime)
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
  if (detectedMode !== 'none' && !checks.codexGoalsFeature) notes.push(runtime.msg('Codex /goal 未启用；如需长程执行，可运行 `helloagents codex goals enable`。', 'Codex /goal is not enabled; run `helloagents codex goals enable` if you need long-running goals.'))
  if (checks.notifyShape === 'chained') notes.push(runtime.msg('HelloAGENTS notify 当前通过 Codex Computer Use / wrapper 链式转发，仍视为有效。', 'HelloAGENTS notify is currently chained through Codex Computer Use / a wrapper and is still treated as valid.'))
  if (!nativeDoctor.available) notes.push(runtime.msg('未检测到原生 `codex doctor`；当前仅检查 HelloAGENTS 受管覆盖层。', 'Native `codex doctor` was not available; only the HelloAGENTS managed overlay was checked.'))

  const status = summarizeDoctorStatus(issues, { trackedMode, detectedMode })
  return {
    host,
    label: runtime.getHostLabel(host),
    trackedMode,
    detectedMode,
    status,
    checks,
    nativeDoctor,
    issues,
    notes,
    suggestedFix: suggestCodexDoctorFix(status, trackedMode),
  }
}

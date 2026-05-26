import { platform } from 'node:os'

import {
  installClaudeStandby,
  installGeminiStandby,
  uninstallClaudeStandby,
  uninstallGeminiStandby,
} from './cli-hosts.mjs'
import {
  cleanupCodexGlobalResidueForStandby,
  installCodexGlobal,
  installCodexStandby,
  uninstallCodexGlobal,
  uninstallCodexStandby,
} from './cli-codex.mjs'
import { spawnCommandSync } from './cli-process.mjs'
import {
  detectHostMode as detectRuntimeHostMode,
  getHostLabel,
} from './cli-host-detect.mjs'
import {
  getClaudeMarketplaceRoot,
  getGeminiExtensionRoot,
  removeClaudeMarketplaceRoot,
  removeGeminiExtensionRoot,
  syncClaudeMarketplaceRoot,
  syncGeminiExtensionRoot,
} from './cli-runtime-root.mjs'

const CLAUDE_COMMAND = process.env.HELLOAGENTS_CLAUDE_CMD || 'claude'
const GEMINI_COMMAND = process.env.HELLOAGENTS_GEMINI_CMD || 'gemini'
const CLAUDE_PLUGIN = 'helloagents@helloagents'

function normalizeCommand(command = '') {
  return String(command || '').trim()
}

function commandCandidates(command = '') {
  const normalized = normalizeCommand(command)
  if (!normalized) return []

  if (platform() !== 'win32') return [normalized]

  const candidates = new Set([normalized])
  if (!/\.(cmd|bat|exe|ps1)$/i.test(normalized)) {
    candidates.add(`${normalized}.cmd`)
    candidates.add(`${normalized}.exe`)
  }
  return [...candidates]
}

function runHostCommand(command, args) {
  const attempts = commandCandidates(command)
  let lastResult = null

  for (const candidate of attempts) {
    const result = spawnCommandSync(candidate, args, {
      encoding: 'utf-8',
      errors: 'replace',
      windowsHide: true,
    })
    lastResult = result
    if (!result.error || !['ENOENT', 'EINVAL'].includes(result.error.code)) {
      break
    }
  }

  const errorMessage = lastResult?.error?.message || ''
  return {
    ok: lastResult?.status === 0,
    missing: ['ENOENT', 'EINVAL'].includes(lastResult?.error?.code || ''),
    output: `${lastResult?.stdout || ''}${lastResult?.stderr || ''}${errorMessage}`.trim(),
  }
}

function buildNativeResult(result, successCN, successEN, manualCN, manualEN) {
  if (result.ok) return { ok: true, noteCN: successCN, noteEN: successEN }
  return {
    ok: false,
    noteCN: `${manualCN}${result.output ? `；原因：${result.output}` : ''}`,
    noteEN: `${manualEN}${result.output ? `; reason: ${result.output}` : ''}`,
  }
}

function preserveTrackedModeOnFailure(result = {}, trackedMode = '') {
  if (result.ok === false && trackedMode) {
    return { ...result, trackedModeOnFailure: trackedMode }
  }
  return result
}

function installClaudeGlobalPlugin(marketplaceRoot) {
  const add = runHostCommand(CLAUDE_COMMAND, ['plugin', 'marketplace', 'add', marketplaceRoot])
  if (!add.ok && add.missing) return { ok: false, output: '未找到 claude 命令' }
  const install = runHostCommand(CLAUDE_COMMAND, ['plugin', 'install', CLAUDE_PLUGIN, '--scope', 'user'])
  return { ok: install.ok, output: install.output || add.output }
}

function installGeminiGlobalExtension(runtimeRoot) {
  return runHostCommand(GEMINI_COMMAND, ['extensions', 'link', runtimeRoot])
}

function removeClaudeGlobalPlugin() {
  return runHostCommand(CLAUDE_COMMAND, ['plugin', 'remove', 'helloagents'])
}

function removeGeminiGlobalExtension() {
  return runHostCommand(GEMINI_COMMAND, ['extensions', 'uninstall', 'helloagents'])
}

function reportHostAction(runtime, action, host, mode, result = {}) {
  const label = getHostLabel(host)
  const isCleanup = action === 'cleanup' || action === 'uninstall'
  if (result.skipped) {
    console.log(runtime.msg(`  - ${label} 未检测到，跳过`, `  - ${label} not detected, skipped`))
  } else if (result.ok === false) {
    console.log(runtime.msg(
      isCleanup ? `  - ${label} 自动清理未完成` : `  - ${label} 自动配置未完成`,
      isCleanup ? `  - ${label} automatic cleanup did not complete` : `  - ${label} automatic setup did not complete`,
    ))
  } else if (isCleanup) {
    runtime.ok(runtime.msg(`${label} 已清理（${mode} 模式）`, `${label} cleaned (${mode} mode)`))
  } else if (mode === 'standby') {
    runtime.ok(runtime.msg(`${label} 已配置（standby 模式）`, `${label} configured (standby mode)`))
  } else if (host === 'codex') {
    runtime.ok(runtime.msg(`${label} 已安装原生本地插件（global 模式）`, `${label} native local plugin installed (global mode)`))
  } else {
    runtime.ok(runtime.msg(`${label} 已切到 global 模式`, `${label} switched to global mode`))
  }

  if (result.noteCN || result.noteEN) {
    console.log(runtime.msg(`  ℹ ${result.noteCN}`, `  ℹ ${result.noteEN}`))
  }
}

function prepareClaudeStandby(previousMode) {
  if (previousMode !== 'global') return {}
  return preserveTrackedModeOnFailure(
    buildNativeResult(
      removeClaudeGlobalPlugin(),
      '已自动移除 Claude Code 插件',
      'Claude Code plugin removed automatically',
      '切到 standby 前无法自动移除 Claude Code 插件，请先在 Claude Code 中执行: /plugin remove helloagents',
      'Could not remove the Claude Code plugin before switching to standby. Run inside Claude Code: /plugin remove helloagents',
    ),
    'global',
  )
}

function prepareGeminiStandby(previousMode) {
  if (previousMode !== 'global') return {}
  return preserveTrackedModeOnFailure(
    buildNativeResult(
      removeGeminiGlobalExtension(),
      '已自动移除 Gemini CLI 扩展',
      'Gemini CLI extension removed automatically',
      '切到 standby 前无法自动移除 Gemini CLI 扩展，请先手动执行: gemini extensions uninstall helloagents',
      'Could not remove the Gemini CLI extension before switching to standby. Run manually: gemini extensions uninstall helloagents',
    ),
    'global',
  )
}

function installHostStandby(runtime, host, { previousMode = '' } = {}) {
  if (host === 'claude') {
    const cleanupResult = prepareClaudeStandby(previousMode)
    if (cleanupResult.ok === false) return cleanupResult
    installClaudeStandby(runtime.home, runtime.pkgRoot)
    if (detectRuntimeHostMode('claude', runtime) !== 'global') removeClaudeMarketplaceRoot(runtime.home)
    return cleanupResult
  }
  if (host === 'gemini') {
    const cleanupResult = prepareGeminiStandby(previousMode)
    if (cleanupResult.ok === false) return cleanupResult
    installGeminiStandby(runtime.home, runtime.pkgRoot)
    if (detectRuntimeHostMode('gemini', runtime) !== 'global') removeGeminiExtensionRoot(runtime.home)
    return cleanupResult
  }
  if (!installCodexStandby(runtime.home, runtime.pkgRoot)) return { skipped: true }
  cleanupCodexGlobalResidueForStandby(runtime.home)
  return {}
}

function installHostGlobal(runtime, host) {
  if (host === 'claude') {
    uninstallClaudeStandby(runtime.home)
    const marketplaceRoot = getClaudeMarketplaceRoot(runtime.home)
    syncClaudeMarketplaceRoot(runtime.pkgRoot, marketplaceRoot)
    const result = buildNativeResult(
      installClaudeGlobalPlugin(marketplaceRoot),
      '已自动安装 Claude Code 插件；重启 Claude Code 后生效',
      'Claude Code plugin installed automatically; restart Claude Code to apply',
      `Claude Code 插件自动安装失败，请在 Claude Code 中执行: /plugin marketplace add "${marketplaceRoot}"；/plugin install helloagents@helloagents`,
      `Claude Code plugin auto-install failed. Run inside Claude Code: /plugin marketplace add "${marketplaceRoot}"; /plugin install helloagents@helloagents`,
    )
    return result
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    const extensionRoot = getGeminiExtensionRoot(runtime.home)
    syncGeminiExtensionRoot(runtime.pkgRoot, extensionRoot)
    const result = buildNativeResult(
      installGeminiGlobalExtension(extensionRoot),
      '已自动安装 Gemini CLI 扩展；重启 Gemini CLI 后生效',
      'Gemini CLI extension installed automatically; restart Gemini CLI to apply',
      `Gemini CLI 扩展自动安装失败，请手动执行: gemini extensions link "${extensionRoot}"`,
      `Gemini CLI extension auto-install failed. Run manually: gemini extensions link "${extensionRoot}"`,
    )
    return result
  }
  uninstallCodexStandby(runtime.home)
  return installCodexGlobal(runtime.home, runtime.pkgRoot) ? {} : { skipped: true }
}

function cleanupHostStandby(runtime, host) {
  if (host === 'claude') {
    const skipped = !uninstallClaudeStandby(runtime.home)
    if (detectRuntimeHostMode('claude', runtime) !== 'global') removeClaudeMarketplaceRoot(runtime.home)
    return { skipped }
  }
  if (host === 'gemini') {
    const skipped = !uninstallGeminiStandby(runtime.home)
    if (detectRuntimeHostMode('gemini', runtime) !== 'global') removeGeminiExtensionRoot(runtime.home)
    return { skipped }
  }
  const standbyCleaned = uninstallCodexStandby(runtime.home)
  const globalResidueCleaned = uninstallCodexGlobal(runtime.home)
  return { skipped: !(standbyCleaned || globalResidueCleaned) }
}

function cleanupHostGlobal(runtime, host) {
  if (host === 'claude') {
    uninstallClaudeStandby(runtime.home)
    const result = preserveTrackedModeOnFailure(
      buildNativeResult(
        removeClaudeGlobalPlugin(),
        '已自动移除 Claude Code 插件',
        'Claude Code plugin removed automatically',
        'Claude Code 插件自动移除失败，请手动执行: /plugin remove helloagents',
        'Claude Code plugin auto-remove failed. Run manually: /plugin remove helloagents',
      ),
      'global',
    )
    if (result.ok) removeClaudeMarketplaceRoot(runtime.home)
    return result
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    const result = preserveTrackedModeOnFailure(
      buildNativeResult(
        removeGeminiGlobalExtension(),
        '已自动移除 Gemini CLI 扩展',
        'Gemini CLI extension removed automatically',
        'Gemini CLI 扩展自动移除失败，请手动执行: gemini extensions uninstall helloagents',
        'Gemini CLI extension auto-remove failed. Run manually: gemini extensions uninstall helloagents',
      ),
      'global',
    )
    if (result.ok) removeGeminiExtensionRoot(runtime.home)
    return result
  }
  return { skipped: !uninstallCodexGlobal(runtime.home) }
}

function installStandby(runtime, previousModes = {}) {
  const results = {}
  const claudeResult = installHostStandby(runtime, 'claude', { previousMode: previousModes.claude || '' })
  reportHostAction(runtime, 'install', 'claude', 'standby', claudeResult)
  results.claude = claudeResult.skipped ? { skipped: true } : claudeResult
  const geminiResult = installHostStandby(runtime, 'gemini', { previousMode: previousModes.gemini || '' })
  reportHostAction(runtime, 'install', 'gemini', 'standby', geminiResult)
  results.gemini = geminiResult.skipped ? { skipped: true } : geminiResult
  if (installCodexStandby(runtime.home, runtime.pkgRoot)) {
    cleanupCodexGlobalResidueForStandby(runtime.home)
    runtime.ok(runtime.msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'))
    results.codex = {}
  } else {
    console.log(runtime.msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'))
    results.codex = { skipped: true }
  }
  return results
}

function installGlobal(runtime) {
  const results = {}
  for (const host of ['claude', 'gemini', 'codex']) {
    const result = installHostGlobal(runtime, host)
    reportHostAction(runtime, 'install', host, 'global', result)
    results[host] = result
  }
  return results
}

export function installAllHosts(runtime, mode, { previousModes = {} } = {}) {
  if (mode === 'global') return installGlobal(runtime)
  return installStandby(runtime, previousModes)
}

export function uninstallAllHosts(runtime) {
  cleanupHostGlobal(runtime, 'claude')
  cleanupHostGlobal(runtime, 'gemini')
  uninstallCodexStandby(runtime.home)
  uninstallCodexGlobal(runtime.home)
}

export function runHostLifecycle(runtime, action, host, mode, options = {}) {
  const result = (action === 'cleanup' || action === 'uninstall')
    ? (mode === 'global' ? cleanupHostGlobal(runtime, host) : cleanupHostStandby(runtime, host))
    : (mode === 'global' ? installHostGlobal(runtime, host) : installHostStandby(runtime, host, options))

  reportHostAction(runtime, action, host, mode, result)
  return result
}

import { spawnSync } from 'node:child_process'

import { installClaudeStandby, installGeminiStandby, uninstallClaudeStandby, uninstallGeminiStandby } from './cli-hosts.mjs'
import {
  cleanupCodexGlobalResidueForStandby,
  installCodexGlobal,
  installCodexStandby,
  uninstallCodexGlobal,
  uninstallCodexStandby,
} from './cli-codex.mjs'
import { getHostLabel } from './cli-host-detect.mjs'

const CLAUDE_COMMAND = process.env.HELLOAGENTS_CLAUDE_CMD || 'claude'
const GEMINI_COMMAND = process.env.HELLOAGENTS_GEMINI_CMD || 'gemini'
const CLAUDE_MARKETPLACE = 'hellowind777/helloagents'
const CLAUDE_PLUGIN = 'helloagents@helloagents'
const GEMINI_EXTENSION = 'https://github.com/hellowind777/helloagents'

function runHostCommand(command, args) {
  const needsShell = process.platform === 'win32' && /\.cmd$/i.test(command)
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    errors: 'replace',
    shell: needsShell,
    windowsHide: true,
  })
  const errorMessage = result.error?.message || ''
  return {
    ok: result.status === 0,
    missing: result.error?.code === 'ENOENT',
    output: `${result.stdout || ''}${result.stderr || ''}${errorMessage}`.trim(),
  }
}

function buildNativeResult(result, successCN, successEN, manualCN, manualEN) {
  if (result.ok) return { noteCN: successCN, noteEN: successEN }
  return {
    noteCN: `${manualCN}${result.output ? `；原因：${result.output}` : ''}`,
    noteEN: `${manualEN}${result.output ? `; reason: ${result.output}` : ''}`,
  }
}

function installClaudeGlobalPlugin() {
  const add = runHostCommand(CLAUDE_COMMAND, ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE])
  if (!add.ok && add.missing) return { ok: false, output: '未找到 claude 命令' }
  const install = runHostCommand(CLAUDE_COMMAND, ['plugin', 'install', CLAUDE_PLUGIN, '--scope', 'user'])
  return { ok: install.ok, output: install.output || add.output }
}

function installGeminiGlobalExtension() {
  return runHostCommand(GEMINI_COMMAND, ['extensions', 'install', GEMINI_EXTENSION])
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

function installHostStandby(runtime, host) {
  if (host === 'claude') {
    installClaudeStandby(runtime.home, runtime.pkgRoot)
    return {}
  }
  if (host === 'gemini') {
    installGeminiStandby(runtime.home, runtime.pkgRoot)
    return {}
  }
  if (!installCodexStandby(runtime.home, runtime.pkgRoot)) return { skipped: true }
  cleanupCodexGlobalResidueForStandby(runtime.home)
  return {}
}

function installHostGlobal(runtime, host) {
  if (host === 'claude') {
    uninstallClaudeStandby(runtime.home)
    return buildNativeResult(
      installClaudeGlobalPlugin(),
      '已自动安装 Claude Code 插件；重启 Claude Code 后生效',
      'Claude Code plugin installed automatically; restart Claude Code to apply',
      'Claude Code 插件自动安装失败，请在 Claude Code 中执行: /plugin marketplace add hellowind777/helloagents；/plugin install helloagents@helloagents',
      'Claude Code plugin auto-install failed. Run inside Claude Code: /plugin marketplace add hellowind777/helloagents; /plugin install helloagents@helloagents',
    )
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    return buildNativeResult(
      installGeminiGlobalExtension(),
      '已自动安装 Gemini CLI 扩展；重启 Gemini CLI 后生效',
      'Gemini CLI extension installed automatically; restart Gemini CLI to apply',
      'Gemini CLI 扩展自动安装失败，请手动执行: gemini extensions install https://github.com/hellowind777/helloagents',
      'Gemini CLI extension auto-install failed. Run manually: gemini extensions install https://github.com/hellowind777/helloagents',
    )
  }
  uninstallCodexStandby(runtime.home)
  return installCodexGlobal(runtime.home, runtime.pkgRoot) ? {} : { skipped: true }
}

function cleanupHostStandby(runtime, host) {
  if (host === 'claude') return { skipped: !uninstallClaudeStandby(runtime.home) }
  if (host === 'gemini') return { skipped: !uninstallGeminiStandby(runtime.home) }
  const standbyCleaned = uninstallCodexStandby(runtime.home)
  const globalResidueCleaned = uninstallCodexGlobal(runtime.home)
  return { skipped: !(standbyCleaned || globalResidueCleaned) }
}

function cleanupHostGlobal(runtime, host) {
  if (host === 'claude') {
    uninstallClaudeStandby(runtime.home)
    return buildNativeResult(
      removeClaudeGlobalPlugin(),
      '已自动移除 Claude Code 插件',
      'Claude Code plugin removed automatically',
      'Claude Code 插件自动移除失败，请手动执行: /plugin remove helloagents',
      'Claude Code plugin auto-remove failed. Run manually: /plugin remove helloagents',
    )
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    return buildNativeResult(
      removeGeminiGlobalExtension(),
      '已自动移除 Gemini CLI 扩展',
      'Gemini CLI extension removed automatically',
      'Gemini CLI 扩展自动移除失败，请手动执行: gemini extensions uninstall helloagents',
      'Gemini CLI extension auto-remove failed. Run manually: gemini extensions uninstall helloagents',
    )
  }
  return { skipped: !uninstallCodexGlobal(runtime.home) }
}

function installStandby(runtime) {
  if (installClaudeStandby(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Claude Code 已配置（standby 模式）', 'Claude Code configured (standby mode)'))
  if (installGeminiStandby(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Gemini CLI 已配置（standby 模式）', 'Gemini CLI configured (standby mode)'))
  if (installCodexStandby(runtime.home, runtime.pkgRoot)) {
    cleanupCodexGlobalResidueForStandby(runtime.home)
    runtime.ok(runtime.msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'))
  }
  else console.log(runtime.msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'))
}

function installGlobal(runtime) {
  for (const host of ['claude', 'gemini', 'codex']) {
    reportHostAction(runtime, 'install', host, 'global', installHostGlobal(runtime, host))
  }
}

export function installAllHosts(runtime, mode) {
  if (mode === 'global') installGlobal(runtime)
  else installStandby(runtime)
}

export function uninstallAllHosts(runtime) {
  cleanupHostGlobal(runtime, 'claude')
  cleanupHostGlobal(runtime, 'gemini')
  uninstallCodexStandby(runtime.home)
  uninstallCodexGlobal(runtime.home)
}

export function runHostLifecycle(runtime, action, host, mode) {
  const result = (action === 'cleanup' || action === 'uninstall')
    ? (mode === 'global' ? cleanupHostGlobal(runtime, host) : cleanupHostStandby(runtime, host))
    : (mode === 'global' ? installHostGlobal(runtime, host) : installHostStandby(runtime, host))

  reportHostAction(runtime, action, host, mode, result)
  return result
}

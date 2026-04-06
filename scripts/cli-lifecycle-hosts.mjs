import { installClaudeStandby, installGeminiStandby, uninstallClaudeStandby, uninstallGeminiStandby } from './cli-hosts.mjs'
import {
  installCodexGlobal,
  installCodexStandby,
  uninstallCodexGlobal,
  uninstallCodexStandby,
} from './cli-codex.mjs'
import { getHostLabel } from './cli-host-detect.mjs'

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
  uninstallCodexGlobal(runtime.home)
  return installCodexStandby(runtime.home, runtime.pkgRoot) ? {} : { skipped: true }
}

function installHostGlobal(runtime, host) {
  if (host === 'claude') {
    uninstallClaudeStandby(runtime.home)
    return {
      noteCN: 'Claude Code 的 global 模式需手动安装插件: /plugin marketplace add hellowind777/helloagents',
      noteEN: 'Claude Code global mode still needs a manual plugin install: /plugin marketplace add hellowind777/helloagents',
    }
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    return {
      noteCN: 'Gemini CLI 的 global 模式需手动安装扩展: gemini extensions install https://github.com/hellowind777/helloagents',
      noteEN: 'Gemini CLI global mode still needs a manual extension install: gemini extensions install https://github.com/hellowind777/helloagents',
    }
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
    return {
      noteCN: '如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents',
      noteEN: 'If the Claude Code plugin is installed, remove it manually: /plugin remove helloagents',
    }
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(runtime.home)
    return {
      noteCN: '如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
      noteEN: 'If the Gemini CLI extension is installed, remove it manually: gemini extensions uninstall helloagents',
    }
  }
  return { skipped: !uninstallCodexGlobal(runtime.home) }
}

function installStandby(runtime) {
  uninstallCodexGlobal(runtime.home)
  if (installClaudeStandby(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Claude Code 已配置（standby 模式）', 'Claude Code configured (standby mode)'))
  if (installGeminiStandby(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Gemini CLI 已配置（standby 模式）', 'Gemini CLI configured (standby mode)'))
  if (installCodexStandby(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'))
  else console.log(runtime.msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'))
}

function installGlobal(runtime) {
  uninstallClaudeStandby(runtime.home)
  uninstallGeminiStandby(runtime.home)
  uninstallCodexStandby(runtime.home)
  if (installCodexGlobal(runtime.home, runtime.pkgRoot)) runtime.ok(runtime.msg('Codex CLI 已安装原生本地插件（global 模式）', 'Codex CLI native local plugin installed (global mode)'))
  else console.log(runtime.msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'))
}

export function installAllHosts(runtime, mode) {
  if (mode === 'global') installGlobal(runtime)
  else installStandby(runtime)
}

export function uninstallAllHosts(runtime) {
  uninstallClaudeStandby(runtime.home)
  uninstallGeminiStandby(runtime.home)
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

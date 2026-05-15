import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import {
  CODEX_MARKETPLACE_NAME,
  CODEX_PLUGIN_KEY,
  CODEX_PLUGIN_NAME,
} from './cli-codex.mjs'
import { getStableRuntimeRoot } from './cli-runtime-root.mjs'
import { FULL_CARRIER_PROFILE_MARKER } from './cli-utils.mjs'
import { safeJson, safeRead } from './cli-utils.mjs'

const HOST_ALIASES = new Map([
  ['all', 'all'],
  ['*', 'all'],
  ['claude', 'claude'],
  ['claude-code', 'claude'],
  ['gemini', 'gemini'],
  ['gemini-cli', 'gemini'],
  ['codex', 'codex'],
  ['codex-cli', 'codex'],
  ['deepseek', 'deepseek'],
  ['deepseek-tui', 'deepseek'],
])

function hasHelloagentsMarker(filePath) {
  return (safeRead(filePath) || '').includes('HELLOAGENTS_START')
}

function hasHelloagentsSettings(filePath) {
  return JSON.stringify(safeJson(filePath) || {}).includes('helloagents')
}

function hasFullCarrierProfile(filePath) {
  return (safeRead(filePath) || '').includes(FULL_CARRIER_PROFILE_MARKER)
}

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/').toLowerCase()
}

function safeRealTarget(linkPath) {
  try {
    return normalizePath(realpathSync(linkPath))
  } catch {
    return ''
  }
}

function detectClaudeMode(home) {
  const claudeDir = join(home, '.claude')
  if (
    existsSync(join(claudeDir, 'helloagents'))
    || hasHelloagentsMarker(join(claudeDir, 'CLAUDE.md'))
    || hasHelloagentsSettings(join(claudeDir, 'settings.json'))
  ) {
    return 'standby'
  }
  return ''
}

function detectGeminiMode(home) {
  const geminiDir = join(home, '.gemini')
  if (
    existsSync(join(geminiDir, 'helloagents'))
    || hasHelloagentsMarker(join(geminiDir, 'GEMINI.md'))
    || hasHelloagentsSettings(join(geminiDir, 'settings.json'))
  ) {
    return 'standby'
  }
  return ''
}

function detectCodexMode(home) {
  const codexDir = join(home, '.codex')
  const codexHomeLink = join(codexDir, 'helloagents')
  const codexConfig = safeRead(join(codexDir, 'config.toml')) || ''
  const marketplace = safeRead(join(home, '.agents', 'plugins', 'marketplace.json')) || ''
  const runtimeRoot = normalizePath(getStableRuntimeRoot(home))
  const codexHomeLinkTarget = safeRealTarget(codexHomeLink)
  if (
    existsSync(join(home, 'plugins', CODEX_PLUGIN_NAME))
    || existsSync(join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME))
    || marketplace.includes(`"name": "${CODEX_PLUGIN_NAME}"`)
    || codexConfig.includes(CODEX_PLUGIN_KEY)
  ) {
    return 'global'
  }
  if (
    (existsSync(codexHomeLink) && codexHomeLinkTarget === runtimeRoot)
    || hasHelloagentsMarker(join(codexDir, 'AGENTS.md'))
    || codexConfig.includes('codex-notify')
    || codexConfig.includes('HelloAGENTS')
  ) {
    return 'standby'
  }
  return ''
}

function detectDeepseekMode(home) {
  const deepseekDir = join(home, '.deepseek')
  const carrierPath = join(deepseekDir, 'AGENTS.md')
  const runtimeRoot = normalizePath(getStableRuntimeRoot(home))
  const homeLinkTarget = safeRealTarget(join(deepseekDir, 'helloagents'))
  if (
    (hasHelloagentsMarker(carrierPath) || (existsSync(join(deepseekDir, 'helloagents')) && homeLinkTarget === runtimeRoot))
    && hasFullCarrierProfile(carrierPath)
  ) {
    return 'global'
  }
  if (
    (existsSync(join(deepseekDir, 'helloagents')) && homeLinkTarget === runtimeRoot)
    || hasHelloagentsMarker(carrierPath)
  ) {
    return 'standby'
  }
  return ''
}

export function normalizeHost(value = '') {
  return HOST_ALIASES.get(String(value || '').toLowerCase()) || ''
}

export function getHostLabel(host) {
  if (host === 'claude') return 'Claude Code'
  if (host === 'gemini') return 'Gemini CLI'
  if (host === 'codex') return 'Codex CLI'
  if (host === 'deepseek') return 'DeepSeek TUI'
  return 'All CLIs'
}

export function detectHostMode(host, runtime) {
  if (host === 'claude') return detectClaudeMode(runtime.home)
  if (host === 'gemini') return detectGeminiMode(runtime.home)
  if (host === 'codex') return detectCodexMode(runtime.home)
  if (host === 'deepseek') return detectDeepseekMode(runtime.home)
  return ''
}

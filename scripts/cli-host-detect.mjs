import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

import {
  CODEX_MARKETPLACE_NAME,
  CODEX_PLUGIN_KEY,
  CODEX_PLUGIN_NAME,
} from './cli-codex.mjs'
import { getGeminiExtensionRoot, getStableRuntimeRoot } from './cli-runtime-root.mjs'
import { safeJson, safeRead } from './cli-utils.mjs'

const CLAUDE_PLUGIN = 'helloagents@helloagents'
const GEMINI_EXTENSION = 'helloagents'

const HOST_ALIASES = new Map([
  ['all', 'all'],
  ['*', 'all'],
  ['claude', 'claude'],
  ['claude-code', 'claude'],
  ['gemini', 'gemini'],
  ['gemini-cli', 'gemini'],
  ['codex', 'codex'],
  ['codex-cli', 'codex'],
])

function hasHelloagentsMarker(filePath) {
  return (safeRead(filePath) || '').includes('HELLOAGENTS_START')
}

function hasHelloagentsSettings(filePath, host = '') {
  const settings = safeJson(filePath) || {}
  const hooksText = JSON.stringify(settings.hooks || {})
  if (hooksText.includes('helloagents')) return true
  if (host === 'claude') {
    return JSON.stringify(settings.permissions?.allow || []).includes('~/.helloagents/helloagents')
  }
  return false
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

function hasEnabledPlugin(enabledPlugins, pluginName) {
  if (Array.isArray(enabledPlugins)) {
    return enabledPlugins.includes(pluginName)
  }
  if (enabledPlugins && typeof enabledPlugins === 'object') {
    return Boolean(enabledPlugins[pluginName])
  }
  return false
}

function detectClaudeMode(home) {
  const claudeDir = join(home, '.claude')
  const settings = safeJson(join(claudeDir, 'settings.json')) || {}
  const installedPlugins = safeJson(join(claudeDir, 'plugins', 'installed_plugins.json')) || {}
  if (hasEnabledPlugin(settings.enabledPlugins, CLAUDE_PLUGIN) || installedPlugins.plugins?.[CLAUDE_PLUGIN]?.length) {
    return 'global'
  }
  if (
    existsSync(join(claudeDir, 'helloagents'))
    || hasHelloagentsMarker(join(claudeDir, 'CLAUDE.md'))
    || hasHelloagentsSettings(join(claudeDir, 'settings.json'), 'claude')
  ) {
    return 'standby'
  }
  return ''
}

function detectGeminiMode(home) {
  const geminiDir = join(home, '.gemini')
  const extensionRoot = safeRealTarget(getGeminiExtensionRoot(home)) || normalizePath(getGeminiExtensionRoot(home))
  const installedExtensionRoot = join(geminiDir, 'extensions', GEMINI_EXTENSION)
  const installedExtension = safeJson(join(installedExtensionRoot, 'gemini-extension.json')) || {}
  if (
    existsSync(installedExtensionRoot)
    && (safeRealTarget(installedExtensionRoot) === extensionRoot || installedExtension.name === GEMINI_EXTENSION)
  ) {
    return 'global'
  }
  if (
    existsSync(join(geminiDir, 'helloagents'))
    || hasHelloagentsMarker(join(geminiDir, 'GEMINI.md'))
    || hasHelloagentsSettings(join(geminiDir, 'settings.json'), 'gemini')
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

export function normalizeHost(value = '') {
  return HOST_ALIASES.get(String(value || '').toLowerCase()) || ''
}

export function getHostLabel(host) {
  if (host === 'claude') return 'Claude Code'
  if (host === 'gemini') return 'Gemini CLI'
  if (host === 'codex') return 'Codex CLI'
  return 'All CLIs'
}

export function detectHostMode(host, runtime) {
  if (host === 'claude') return detectClaudeMode(runtime.home)
  if (host === 'gemini') return detectGeminiMode(runtime.home)
  if (host === 'codex') return detectCodexMode(runtime.home)
  return ''
}

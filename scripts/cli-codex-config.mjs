import {
  prependTopLevelTomlBlocks,
  removeTopLevelTomlBlock,
  stripTomlSection,
} from './cli-toml.mjs'

export const CODEX_PLUGIN_CONFIG_HEADER = '[plugins."helloagents@local-plugins"]'
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed'
export const CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md'
export const CODEX_MANAGED_NOTIFY_VALUE = '["helloagents-js", "codex-notify"]'

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/')
}

export function upsertCodexPluginConfig(text) {
  const stripped = stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text.trimEnd()
  const block = `${CODEX_PLUGIN_CONFIG_HEADER}\nenabled = true`
  return stripped ? `${stripped}\n\n${block}\n` : `${block}\n`
}

export function removeCodexPluginConfig(text) {
  return stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text
}

export function isManagedCodexModelInstruction(line = '') {
  return line.includes('model_instructions_file')
    && line.includes(CODEX_MANAGED_TOML_COMMENT)
}

export function isManagedCodexNotify(line = '') {
  const value = String(line || '').replace(/\\/g, '/')
  return value.includes(CODEX_MANAGED_TOML_COMMENT)
    || (
      value.includes('helloagents-js')
      && value.includes('codex-notify')
    )
}

export function isManagedCodexBackupInstruction(line = '') {
  return line.includes(CODEX_MANAGED_TOML_COMMENT)
}

function formatManagedCodexModelInstructionsValue(filePath) {
  return `"${normalizePath(filePath)}" ${CODEX_MANAGED_TOML_COMMENT}`
}

function formatManagedCodexModelInstructionsLine(filePath = CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH) {
  return `model_instructions_file = ${formatManagedCodexModelInstructionsValue(filePath)}`
}

function formatManagedCodexNotifyValue() {
  return CODEX_MANAGED_NOTIFY_VALUE
}

function formatManagedCodexNotifyLine() {
  return `notify = ${formatManagedCodexNotifyValue()} ${CODEX_MANAGED_TOML_COMMENT}`
}

function removeTopLevelLinesBeingReplaced(toml, lines) {
  let next = toml

  for (const line of lines.map((value) => String(value || '').trim()).filter(Boolean)) {
    const key = line.slice(0, line.indexOf('=')).trim()
    if (!key) continue
    next = removeTopLevelTomlBlock(next, key)
  }

  return next
}

function upsertOrderedCodexTopLevelLines(toml, lines) {
  return prependTopLevelTomlBlocks(
    removeTopLevelLinesBeingReplaced(toml, lines),
    lines,
  )
}

export function installCodexManagedTopLevelConfig(toml, { modelInstructionsPath } = {}) {
  return upsertOrderedCodexTopLevelLines(toml, [
    formatManagedCodexModelInstructionsLine(modelInstructionsPath),
    formatManagedCodexNotifyLine(),
  ])
}

export function restoreCodexTopLevelConfig(toml, { modelInstructionsLine = '', notifyLine = '' }) {
  return upsertOrderedCodexTopLevelLines(toml, [
    modelInstructionsLine,
    notifyLine,
  ])
}

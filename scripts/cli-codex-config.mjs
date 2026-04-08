import {
  upsertTopLevelTomlKey,
  removeTopLevelTomlLines,
  stripTomlSection,
} from './cli-toml.mjs'

export const CODEX_PLUGIN_CONFIG_HEADER = '[plugins."helloagents@local-plugins"]'
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed'

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
  return line.includes('codex-notify')
}

export function isManagedCodexBackupInstruction(line = '') {
  return line.includes(CODEX_MANAGED_TOML_COMMENT)
}

function formatManagedCodexModelInstructionsValue(filePath) {
  return `"${normalizePath(filePath)}" ${CODEX_MANAGED_TOML_COMMENT}`
}

export function installCodexModelInstructions(toml, filePath) {
  const next = removeTopLevelTomlLines(
    toml,
    (line) => line.startsWith('model_instructions_file ='),
  ).text
  return upsertTopLevelTomlKey(
    next,
    'model_instructions_file',
    formatManagedCodexModelInstructionsValue(filePath),
  )
}

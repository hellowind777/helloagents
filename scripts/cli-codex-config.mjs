import {
  isTomlTableHeader,
  normalizeToml,
  prependTopLevelTomlBlocks,
  removeTopLevelTomlBlock,
  stripTomlSection,
} from './cli-toml.mjs'

export const CODEX_PLUGIN_CONFIG_HEADER = '[plugins."helloagents@local-plugins"]'
export const CODEX_FEATURES_HEADER = '[features]'
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed'
export const CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md'
export const CODEX_MANAGED_NOTIFY_COMMAND = 'helloagents-js.cmd'
export const CODEX_MANAGED_NOTIFY_VALUE = `["${CODEX_MANAGED_NOTIFY_COMMAND}", "codex-notify"]`
export const CODEX_HOOKS_FEATURE_KEY = 'hooks'
export const CODEX_LEGACY_HOOKS_FEATURE_KEY = 'codex_hooks'
export const CODEX_GOALS_FEATURE_KEY = 'goals'
export const CODEX_MANAGED_GOALS_FEATURE_LINE = `${CODEX_GOALS_FEATURE_KEY} = true ${CODEX_MANAGED_TOML_COMMENT}`
export const CODEX_MANAGED_GOALS_DISABLED_LINE = `${CODEX_GOALS_FEATURE_KEY} = false ${CODEX_MANAGED_TOML_COMMENT}`

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/')
}

function splitTomlLines(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').split('\n')
}

function findSectionBounds(lines, headerLine) {
  const start = lines.findIndex((line) => line.trim() === headerLine)
  if (start < 0) return { start: -1, end: -1 }

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isTomlTableHeader(lines[index])) {
      end = index
      break
    }
  }
  return { start, end }
}

function findSectionKeyIndex(lines, bounds, key) {
  if (bounds.start < 0) return -1
  for (let index = bounds.start + 1; index < bounds.end; index += 1) {
    if (lines[index].trim().startsWith(`${key} =`)) return index
  }
  return -1
}

function upsertTomlSectionLine(text, headerLine, key, line) {
  const lines = splitTomlLines(text)
  const bounds = findSectionBounds(lines, headerLine)
  if (bounds.start < 0) {
    const base = String(text || '').trimEnd()
    const block = `${headerLine}\n${line}`
    return normalizeToml(base ? `${base}\n\n${block}` : block)
  }

  const keyIndex = findSectionKeyIndex(lines, bounds, key)
  if (keyIndex >= 0) lines[keyIndex] = line
  else {
    let insertIndex = bounds.end
    while (insertIndex > bounds.start + 1 && !lines[insertIndex - 1].trim()) insertIndex -= 1
    lines.splice(insertIndex, 0, line)
  }
  return normalizeToml(lines.join('\n'))
}

function removeTomlSectionLine(text, headerLine, key, shouldRemove) {
  const lines = splitTomlLines(text)
  const bounds = findSectionBounds(lines, headerLine)
  const keyIndex = findSectionKeyIndex(lines, bounds, key)
  if (keyIndex < 0 || !shouldRemove(lines[keyIndex].trim())) return normalizeToml(text)

  lines.splice(keyIndex, 1)
  const nextBounds = findSectionBounds(lines, headerLine)
  const sectionLines = nextBounds.start < 0
    ? []
    : lines.slice(nextBounds.start + 1, nextBounds.end).filter((entry) => entry.trim())
  if (nextBounds.start >= 0 && sectionLines.length === 0) {
    lines.splice(nextBounds.start, 1)
  }
  return normalizeToml(lines.join('\n'))
}

export function upsertCodexPluginConfig(text) {
  const stripped = stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text.trimEnd()
  const block = `${CODEX_PLUGIN_CONFIG_HEADER}\nenabled = true`
  return stripped ? `${stripped}\n\n${block}\n` : `${block}\n`
}

export function removeCodexPluginConfig(text) {
  return stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text
}

export function readCodexHooksFeatureLine(text) {
  return readCodexFeatureLine(text, CODEX_HOOKS_FEATURE_KEY)
}

export function readLegacyCodexHooksFeatureLine(text) {
  return readCodexFeatureLine(text, CODEX_LEGACY_HOOKS_FEATURE_KEY)
}

export function readCodexGoalsFeatureLine(text) {
  return readCodexFeatureLine(text, CODEX_GOALS_FEATURE_KEY)
}

export function readCodexFeatureLine(text, key) {
  const lines = splitTomlLines(text)
  const bounds = findSectionBounds(lines, CODEX_FEATURES_HEADER)
  const keyIndex = findSectionKeyIndex(lines, bounds, key)
  return keyIndex >= 0 ? lines[keyIndex].trim() : ''
}

export function setCodexGoalsFeatureConfig(text, enabled = true) {
  return upsertTomlSectionLine(
    text,
    CODEX_FEATURES_HEADER,
    CODEX_GOALS_FEATURE_KEY,
    enabled ? CODEX_MANAGED_GOALS_FEATURE_LINE : CODEX_MANAGED_GOALS_DISABLED_LINE,
  )
}

export function removeCodexGoalsFeatureConfig(text) {
  return removeTomlSectionLine(
    text,
    CODEX_FEATURES_HEADER,
    CODEX_GOALS_FEATURE_KEY,
    isManagedCodexGoalsFeature,
  )
}

export function removeLegacyManagedCodexHooksFeatureConfig(text) {
  return removeTomlSectionLine(
    text,
    CODEX_FEATURES_HEADER,
    CODEX_LEGACY_HOOKS_FEATURE_KEY,
    isManagedLegacyCodexHooksFeature,
  )
}

export function restoreCodexGoalsFeatureConfig(text, { codexGoalsLine = '' } = {}) {
  if (!codexGoalsLine) return normalizeToml(text)
  return upsertTomlSectionLine(
    text,
    CODEX_FEATURES_HEADER,
    CODEX_GOALS_FEATURE_KEY,
    codexGoalsLine,
  )
}

export function isManagedCodexModelInstruction(line = '') {
  return line.includes('model_instructions_file')
    && line.includes(CODEX_MANAGED_TOML_COMMENT)
}

export function isManagedCodexNotify(line = '') {
  const value = String(line || '').replace(/\\/g, '/')
  return value.includes(CODEX_MANAGED_NOTIFY_VALUE)
}

function isManagedFeatureLine(line = '', key = '') {
  return new RegExp(`^\\s*${key}\\s*=`).test(String(line || ''))
    && String(line || '').includes(CODEX_MANAGED_TOML_COMMENT)
}

export function isManagedCodexHooksFeature(line = '') {
  return isManagedFeatureLine(line, CODEX_HOOKS_FEATURE_KEY)
}

export function isManagedLegacyCodexHooksFeature(line = '') {
  return isManagedFeatureLine(line, CODEX_LEGACY_HOOKS_FEATURE_KEY)
}

export function isManagedCodexGoalsFeature(line = '') {
  return isManagedFeatureLine(line, CODEX_GOALS_FEATURE_KEY)
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

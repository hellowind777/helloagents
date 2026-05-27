import {
  isTomlTableHeader,
  normalizeToml,
  prependTopLevelTomlBlocks,
  removeTopLevelTomlBlock,
  stripTomlSection,
} from './cli-toml.mjs'

export const CODEX_PLUGIN_CONFIG_HEADER = '[plugins."helloagents@local-plugins"]'
export const CODEX_FEATURES_HEADER = '[features]'
export const CODEX_TUI_HEADER = '[tui]'
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed'
export const CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md'
export const CODEX_MANAGED_NOTIFY_COMMAND = 'helloagents-js'
export const CODEX_MANAGED_NOTIFY_VALUE = `["${CODEX_MANAGED_NOTIFY_COMMAND}", "codex-notify"]`
export const CODEX_MANAGED_TUI_NOTIFICATIONS_VALUE = '["plan-mode-prompt"]'
export const CODEX_HOOKS_FEATURE_KEY = 'hooks'
export const CODEX_GOALS_FEATURE_KEY = 'goals'
export const CODEX_MANAGED_GOALS_FEATURE_LINE = `${CODEX_GOALS_FEATURE_KEY} = true ${CODEX_MANAGED_TOML_COMMENT}`
export const CODEX_MANAGED_GOALS_DISABLED_LINE = `${CODEX_GOALS_FEATURE_KEY} = false ${CODEX_MANAGED_TOML_COMMENT}`
export const CODEX_MANAGED_TUI_NOTIFICATIONS_LINE = `notifications = ${CODEX_MANAGED_TUI_NOTIFICATIONS_VALUE} ${CODEX_MANAGED_TOML_COMMENT}`

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/')
}

function isManagedCodexNotifyParts(parts) {
  return Array.isArray(parts)
    && parts.length === 2
    && parts[0] === CODEX_MANAGED_NOTIFY_COMMAND
    && parts[1] === 'codex-notify'
}

function extractTomlArrayLiteral(text = '') {
  const source = String(text || '')
  const equalsIndex = source.indexOf('=')
  let quoted = false
  let escaped = false
  let commented = false
  let depth = 0
  let start = -1

  for (let index = equalsIndex >= 0 ? equalsIndex + 1 : 0; index < source.length; index += 1) {
    const char = source[index]

    if (commented) {
      if (char === '\n') commented = false
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\' && quoted) {
      escaped = true
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === '#') {
      commented = true
      continue
    }
    if (char === '[') {
      if (depth === 0) start = index
      depth += 1
      continue
    }
    if (char === ']' && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) return source.slice(start, index + 1)
    }
  }

  return ''
}

function parseTomlStringArrayLiteral(literal = '') {
  const source = String(literal || '').trim()
  if (!source.startsWith('[') || !source.endsWith(']')) return null

  const items = []
  let quoted = false
  let escaped = false
  let tokenStart = -1

  for (let index = 1; index < source.length; index += 1) {
    const char = source[index]

    if (quoted) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        try {
          items.push(JSON.parse(source.slice(tokenStart, index + 1)))
        } catch {
          return null
        }
        quoted = false
        tokenStart = -1
      }
      continue
    }

    if (char === '#') {
      while (index < source.length && source[index] !== '\n') index += 1
      continue
    }
    if (/\s|,/.test(char)) continue
    if (char === ']') return items
    if (char !== '"') return null

    quoted = true
    tokenStart = index
  }

  return null
}

function analyzeNotifyCommandParts(parts = []) {
  if (isManagedCodexNotifyParts(parts)) {
    return {
      managed: true,
      shape: 'direct',
      containsCodexNotify: true,
      entrypoint: [...parts],
      wrapper: '',
      rawCommand: [...parts],
    }
  }

  let containsCodexNotify = parts.includes('codex-notify')
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] !== '--previous-notify') continue

    try {
      const nested = JSON.parse(parts[index + 1])
      if (!Array.isArray(nested) || !nested.every((entry) => typeof entry === 'string')) continue

      const nestedAnalysis = analyzeNotifyCommandParts(nested)
      containsCodexNotify = containsCodexNotify || nestedAnalysis.containsCodexNotify
      if (!nestedAnalysis.managed) continue

      return {
        managed: true,
        shape: 'chained',
        containsCodexNotify: true,
        entrypoint: [...nestedAnalysis.entrypoint],
        wrapper: parts[0] || '',
        rawCommand: [...parts],
      }
    } catch {
      continue
    }
  }

  return {
    managed: false,
    shape: parts.length ? 'external' : 'invalid',
    containsCodexNotify,
    entrypoint: [],
    wrapper: '',
    rawCommand: [...parts],
  }
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

export function readCodexGoalsFeatureLine(text) {
  return readCodexFeatureLine(text, CODEX_GOALS_FEATURE_KEY)
}

export function readCodexTuiNotificationsLine(text) {
  return readCodexSectionLine(text, CODEX_TUI_HEADER, 'notifications')
}

export function readCodexFeatureLine(text, key) {
  return readCodexSectionLine(text, CODEX_FEATURES_HEADER, key)
}

export function readCodexSectionLine(text, headerLine, key) {
  const lines = splitTomlLines(text)
  const bounds = findSectionBounds(lines, headerLine)
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
  return value.includes(CODEX_MANAGED_TOML_COMMENT)
    && value.includes(CODEX_MANAGED_NOTIFY_VALUE)
}

export function analyzeCodexNotifyBlock(block = '') {
  const source = String(block || '').trim()
  if (!source) {
    return {
      exists: false,
      managed: false,
      containsCodexNotify: false,
      shape: 'missing',
      entrypoint: [],
      wrapper: '',
      rawCommand: [],
      rawBlock: '',
    }
  }

  const literal = extractTomlArrayLiteral(source)
  const parts = literal ? parseTomlStringArrayLiteral(literal) : null
  if (!parts) {
    return {
      exists: true,
      managed: false,
      containsCodexNotify: source.includes('codex-notify'),
      shape: 'invalid',
      entrypoint: [],
      wrapper: '',
      rawCommand: [],
      rawBlock: source,
    }
  }

  return {
    exists: true,
    ...analyzeNotifyCommandParts(parts),
    rawBlock: source,
  }
}

export function isManagedCodexTuiNotifications(line = '') {
  return String(line || '').includes(CODEX_MANAGED_TUI_NOTIFICATIONS_VALUE)
    && String(line || '').includes(CODEX_MANAGED_TOML_COMMENT)
}

function isManagedFeatureLine(line = '', key = '') {
  return new RegExp(`^\\s*${key}\\s*=`).test(String(line || ''))
    && String(line || '').includes(CODEX_MANAGED_TOML_COMMENT)
}

export function isManagedCodexHooksFeature(line = '') {
  return isManagedFeatureLine(line, CODEX_HOOKS_FEATURE_KEY)
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

export function installCodexManagedTuiConfig(text) {
  const currentLine = readCodexTuiNotificationsLine(text)
  if (currentLine && !isManagedCodexTuiNotifications(currentLine)) {
    return normalizeToml(text)
  }

  return upsertTomlSectionLine(
    text,
    CODEX_TUI_HEADER,
    'notifications',
    CODEX_MANAGED_TUI_NOTIFICATIONS_LINE,
  )
}

export function removeCodexManagedTuiConfig(text) {
  return removeTomlSectionLine(
    text,
    CODEX_TUI_HEADER,
    'notifications',
    isManagedCodexTuiNotifications,
  )
}

export function restoreCodexTopLevelConfig(toml, { modelInstructionsLine = '', notifyLine = '' }) {
  return upsertOrderedCodexTopLevelLines(toml, [
    modelInstructionsLine,
    notifyLine,
  ])
}

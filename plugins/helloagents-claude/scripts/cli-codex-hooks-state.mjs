import { createHash } from 'node:crypto'

import { isTomlTableHeader, normalizeToml } from './cli-toml.mjs'
import { removeIfExists, safeJson, safeRead, safeWrite } from './cli-utils.mjs'

const MANAGED_MARKER = '# helloagents-managed'

const HOOK_EVENT_KEY = {
  PreToolUse: 'pre_tool_use',
  PermissionRequest: 'permission_request',
  PostToolUse: 'post_tool_use',
  PreCompact: 'pre_compact',
  PostCompact: 'post_compact',
  SessionStart: 'session_start',
  UserPromptSubmit: 'user_prompt_submit',
  Stop: 'stop',
}

const EVENTS_WITH_MATCHER = new Set([
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'SessionStart',
])

// Codex persists hook trust under `[hooks.state."<key>"]`, where the key is
// derived from the discovered hooks.json absolute path plus event/group/handler
// indexes. That makes hook trust machine-local materialized state rather than a
// portable config value. Keep portable config such as
// `model_instructions_file = "~/.codex/AGENTS.md"` separate from this generated
// trust metadata and regenerate it on each machine during install/update.

const HOOK_STATE_HEADER_RE = /^\[hooks\.state\."((?:\\.|[^"])*)"\](?:\s*#.*)?$/

function normalizeLineEndings(text = '') {
  return String(text || '').replace(/\r\n/g, '\n')
}

function escapeTomlBasicString(value = '') {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function unescapeTomlBasicString(value = '') {
  return String(value || '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (!value || typeof value !== 'object') return value

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      if (value[key] !== undefined) acc[key] = canonicalizeJson(value[key])
      return acc
    }, {})
}

function hashNormalizedHookIdentity(identity) {
  const serialized = JSON.stringify(canonicalizeJson(identity))
  return `sha256:${createHash('sha256').update(serialized).digest('hex')}`
}

function normalizeHookMatcher(eventName, matcher) {
  if (!EVENTS_WITH_MATCHER.has(eventName)) return undefined
  return matcher === undefined ? undefined : String(matcher)
}

function normalizeHookTimeout(timeout) {
  const value = Number(timeout)
  if (!Number.isFinite(value)) return 600
  return Math.max(1, Math.trunc(value))
}

function buildHookDescriptor(eventName, group, handler) {
  return JSON.stringify({
    eventName,
    matcher: normalizeHookMatcher(eventName, group?.matcher),
    command: handler?.command || '',
  })
}

function buildNormalizedHookIdentity(eventName, group, handler) {
  const matcher = normalizeHookMatcher(eventName, group?.matcher)
  const statusMessage = typeof handler?.statusMessage === 'string'
    ? handler.statusMessage
    : undefined

  return {
    event_name: HOOK_EVENT_KEY[eventName],
    ...(matcher !== undefined ? { matcher } : {}),
    hooks: [
      {
        type: 'command',
        command: String(handler?.command || ''),
        timeout: normalizeHookTimeout(handler?.timeout),
        async: Boolean(handler?.async),
        ...(statusMessage !== undefined ? { statusMessage } : {}),
      },
    ],
  }
}

function isHelloagentsCommandHandler(handler) {
  return handler?.type === 'command'
    && typeof handler.command === 'string'
    && handler.command.includes('helloagents')
}

function serializeHookStateBlock(entry) {
  const lines = [`[hooks.state."${escapeTomlBasicString(entry.key)}"]`]
  if (entry.enabled === false) lines.push('enabled = false')
  lines.push(`trusted_hash = "${escapeTomlBasicString(entry.trustedHash)}" ${MANAGED_MARKER}`)
  return lines.join('\n')
}

function collectHookStateSections(text = '') {
  const lines = normalizeLineEndings(text).split('\n')
  const sections = []

  for (let index = 0; index < lines.length; index += 1) {
    const match = HOOK_STATE_HEADER_RE.exec(lines[index].trim())
    if (!match) continue

    let end = lines.length
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (isTomlTableHeader(lines[cursor])) {
        end = cursor
        break
      }
    }

    const bodyLines = lines.slice(index + 1, end)
    const enabledLine = bodyLines.find((line) => /^\s*enabled\s*=/.test(line))
    const trustedHashLine = bodyLines.find((line) => /^\s*trusted_hash\s*=/.test(line))
    const trustedHashMatch = trustedHashLine?.match(/^\s*trusted_hash\s*=\s*"((?:\\.|[^"])*)"/)

    sections.push({
      key: unescapeTomlBasicString(match[1]),
      start: index,
      end,
      enabled: /^\s*enabled\s*=\s*false\b/.test(enabledLine || '') ? false : undefined,
      trustedHash: trustedHashMatch ? unescapeTomlBasicString(trustedHashMatch[1]) : '',
      managed: lines[index].includes(MANAGED_MARKER)
        || bodyLines.some((line) => line.includes(MANAGED_MARKER)),
    })

    index = end - 1
  }

  return { lines, sections }
}

function removeHookStateSections(text, shouldRemove) {
  const { lines, sections } = collectHookStateSections(text)
  if (!sections.length) return normalizeToml(text)

  const removedStarts = new Set(
    sections
      .filter(shouldRemove)
      .map((section) => section.start),
  )

  if (!removedStarts.size) return normalizeToml(text)

  const kept = []
  for (let index = 0; index < lines.length;) {
    const section = sections.find((item) => item.start === index)
    if (!section) {
      kept.push(lines[index])
      index += 1
      continue
    }
    if (!removedStarts.has(section.start)) {
      kept.push(...lines.slice(section.start, section.end))
    }
    index = section.end
  }

  return normalizeToml(kept.join('\n'))
}

function appendHookStateBlocks(text, entries) {
  if (!entries.length) return normalizeToml(text)
  const blocks = entries.map(serializeHookStateBlock).join('\n\n')
  const base = normalizeLineEndings(text).trimEnd()
  return normalizeToml(base ? `${base}\n\n${blocks}` : blocks)
}

export function buildManagedCodexHookTrustEntries(hooksPath, hooksData = safeJson(hooksPath)) {
  const hooks = hooksData?.hooks
  if (!hooks || typeof hooks !== 'object') return []

  const entries = []
  for (const eventName of Object.keys(HOOK_EVENT_KEY)) {
    const groups = hooks[eventName]
    if (!Array.isArray(groups)) continue

    groups.forEach((group, groupIndex) => {
      const handlers = Array.isArray(group?.hooks) ? group.hooks : []
      handlers.forEach((handler, handlerIndex) => {
        if (!isHelloagentsCommandHandler(handler)) return

        const key = `${hooksPath}:${HOOK_EVENT_KEY[eventName]}:${groupIndex}:${handlerIndex}`
        entries.push({
          key,
          trustedHash: hashNormalizedHookIdentity(
            buildNormalizedHookIdentity(eventName, group, handler),
          ),
          descriptor: buildHookDescriptor(eventName, group, handler),
        })
      })
    })
  }

  return entries
}

export function readCodexHookStateSections(text = '') {
  return collectHookStateSections(text).sections
}

export function syncManagedCodexHookTrust(configPath, hooksPath, hooksData = safeJson(hooksPath)) {
  const entries = buildManagedCodexHookTrustEntries(hooksPath, hooksData)
  if (!entries.length) return cleanupManagedCodexHookTrust(configPath)

  const keySet = new Set(entries.map((entry) => entry.key))
  const existingText = safeRead(configPath) || ''
  const existingSections = readCodexHookStateSections(existingText)
  const enabledByDescriptor = new Map()

  for (const section of existingSections) {
    if (!keySet.has(section.key) || section.enabled !== false) continue
    const matchingEntry = entries.find((entry) => entry.key === section.key)
    if (matchingEntry) enabledByDescriptor.set(matchingEntry.descriptor, false)
  }

  const cleanedText = removeHookStateSections(
    existingText,
    (section) => section.managed || keySet.has(section.key),
  )

  const nextEntries = entries.map((entry) => ({
    ...entry,
    enabled: enabledByDescriptor.get(entry.descriptor),
  }))

  const nextText = appendHookStateBlocks(cleanedText, nextEntries)
  if (normalizeLineEndings(nextText) === normalizeLineEndings(existingText)) return false

  safeWrite(configPath, nextText)
  return true
}

export function cleanupManagedCodexHookTrust(configPath) {
  const existingText = safeRead(configPath)
  if (!existingText) return false

  const nextText = removeHookStateSections(existingText, (section) => section.managed)
  if (normalizeLineEndings(nextText) === normalizeLineEndings(existingText)) return false

  if (nextText.trim()) safeWrite(configPath, nextText)
  else removeIfExists(configPath)
  return true
}

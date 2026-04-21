import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { appendReplayEvent } from './replay-state.mjs'

const TURN_STATE_PATH = join(homedir(), '.helloagents', 'runtime', 'turn-state.json')
const TURN_STATE_TTL_MS = 30 * 60 * 1000
const VALID_KINDS = new Set(['complete', 'waiting', 'blocked', 'progress'])
const VALID_ROLES = new Set(['main', 'subagent'])
const VALID_REASON_CATEGORIES = new Set([
  'ambiguity',
  'missing-input',
  'missing-file',
  'missing-credential',
  'unauthorized-side-effect',
  'high-risk-confirmation',
  'external-dependency',
  'error',
])

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function ensureRuntimeDir() {
  mkdirSync(dirname(TURN_STATE_PATH), { recursive: true })
}

function readStore() {
  try {
    return JSON.parse(readFileSync(TURN_STATE_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeStore(store) {
  const keys = Object.keys(store)
  if (keys.length === 0) {
    rmSync(TURN_STATE_PATH, { force: true })
    return
  }

  ensureRuntimeDir()
  writeFileSync(TURN_STATE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf-8')
}

function getTurnStateKey(cwd = process.cwd()) {
  return normalizePath(cwd)
}

function normalizeTurnState(input = {}) {
  const kind = typeof input.kind === 'string' ? input.kind.trim().toLowerCase() : ''
  const role = typeof input.role === 'string' ? input.role.trim().toLowerCase() : 'main'
  const reasonCategory = typeof input.reasonCategory === 'string'
    ? input.reasonCategory.trim().toLowerCase()
    : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''

  return {
    kind: VALID_KINDS.has(kind) ? kind : '',
    role: VALID_ROLES.has(role) ? role : 'main',
    phase: typeof input.phase === 'string' ? input.phase.trim().toLowerCase() : '',
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    requiresDeliveryGate: Boolean(input.requiresDeliveryGate),
    reasonCategory: VALID_REASON_CATEGORIES.has(reasonCategory) ? reasonCategory : '',
    reason,
  }
}

function pruneInvalidEntry(store, key) {
  delete store[key]
  writeStore(store)
}

export function clearTurnState(cwd = process.cwd()) {
  const key = getTurnStateKey(cwd)
  if (!key) return false
  const store = readStore()
  if (!(key in store)) return false
  delete store[key]
  writeStore(store)
  return true
}

export function readTurnState(cwd = process.cwd(), { now = Date.now() } = {}) {
  const key = getTurnStateKey(cwd)
  if (!key) return null

  const store = readStore()
  const entry = store[key]
  if (!entry?.cwd || !entry?.kind || !entry?.updatedAt) {
    if (entry) pruneInvalidEntry(store, key)
    return null
  }

  const updatedAt = Date.parse(entry.updatedAt)
  if (!Number.isFinite(updatedAt) || (now - updatedAt > TURN_STATE_TTL_MS)) {
    pruneInvalidEntry(store, key)
    return null
  }

  const normalized = normalizeTurnState(entry)
  if (!normalized.kind) {
    pruneInvalidEntry(store, key)
    return null
  }

  return {
    cwd: normalizePath(entry.cwd),
    updatedAt: entry.updatedAt,
    ...normalized,
  }
}

export function writeTurnState(cwd = process.cwd(), input = {}) {
  const key = getTurnStateKey(cwd)
  const normalized = normalizeTurnState(input)
  if (!key || !normalized.kind) {
    throw new Error('turn-state requires cwd and a valid kind')
  }
  if (
    (normalized.kind === 'waiting' || normalized.kind === 'blocked')
    && (!normalized.reasonCategory || !normalized.reason)
  ) {
    throw new Error('turn-state waiting/blocked requires reasonCategory and reason')
  }

  const store = readStore()
  const payload = {
    cwd: key,
    updatedAt: new Date().toISOString(),
    ...normalized,
  }
  store[key] = payload
  writeStore(store)

  appendReplayEvent(cwd, {
    event: 'turn_state_written',
    source: normalized.source,
    details: {
      kind: normalized.kind,
      role: normalized.role,
      phase: normalized.phase,
      requiresDeliveryGate: normalized.requiresDeliveryGate,
      reasonCategory: normalized.reasonCategory,
      reason: normalized.reason,
    },
  })

  return payload
}

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

function main() {
  const command = process.argv[2] || ''
  const input = readStdinJson()
  const cwd = input.cwd || process.cwd()

  if (command === 'write') {
    const payload = writeTurnState(cwd, input)
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      path: TURN_STATE_PATH,
      payload,
    }))
    return
  }

  if (command === 'clear') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      cleared: clearTurnState(cwd),
    }))
    return
  }

  if (command === 'read') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      state: readTurnState(cwd),
    }))
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

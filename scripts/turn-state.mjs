import { readFileSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  appendSessionEvent,
  clearCapsuleSection,
  getSessionCapsulePath,
  getRuntimeScope,
  readCapsuleSection,
  writeCapsuleSection,
} from './session-capsule.mjs'

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

function normalizeTurnState(input = {}) {
  const kind = typeof input.kind === 'string' ? input.kind.trim().toLowerCase() : ''
  const role = typeof input.role === 'string' ? input.role.trim().toLowerCase() : 'main'
  const reasonCategory = typeof input.reasonCategory === 'string'
    ? input.reasonCategory.trim().toLowerCase()
    : ''
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  const blocker = normalizeBlocker(input.blocker)

  return {
    kind: VALID_KINDS.has(kind) ? kind : '',
    role: VALID_ROLES.has(role) ? role : 'main',
    phase: typeof input.phase === 'string' ? input.phase.trim().toLowerCase() : '',
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    requiresDeliveryGate: Boolean(input.requiresDeliveryGate),
    reasonCategory: VALID_REASON_CATEGORIES.has(reasonCategory) ? reasonCategory : '',
    reason,
    ...(blocker ? { blocker } : {}),
  }
}

function normalizeBlocker(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const target = typeof input.target === 'string' ? input.target.trim() : ''
  const evidence = typeof input.evidence === 'string' ? input.evidence.trim() : ''
  const requiredAction = typeof input.requiredAction === 'string'
    ? input.requiredAction.trim()
    : ''

  if (!target && !evidence && !requiredAction) return null
  return { target, evidence, requiredAction }
}

export function clearTurnState(cwd = process.cwd(), options = {}) {
  return clearCapsuleSection(cwd, 'turn', options)
}

export function readTurnState(cwd = process.cwd(), { now = Date.now(), ...options } = {}) {
  const entry = readCapsuleSection(cwd, 'turn', options)
  if (!entry?.cwd || !entry?.kind || !entry?.updatedAt) {
    return null
  }

  const updatedAt = Date.parse(entry.updatedAt)
  if (!Number.isFinite(updatedAt) || (now - updatedAt > TURN_STATE_TTL_MS)) {
    clearTurnState(cwd, options)
    return null
  }

  const normalized = normalizeTurnState(entry)
  if (!normalized.kind) {
    clearTurnState(cwd, options)
    return null
  }

  return {
    cwd: normalizePath(entry.cwd),
    key: entry.key || '',
    path: getSessionCapsulePath(cwd, options),
    updatedAt: entry.updatedAt,
    ...normalized,
  }
}

export function writeTurnState(cwd = process.cwd(), input = {}) {
  const runtimeOptions = {
    payload: input.payload && typeof input.payload === 'object' ? input.payload : input,
    env: input.env || process.env,
    ppid: input.ppid ?? process.ppid,
  }
  const scope = getRuntimeScope(cwd, runtimeOptions)
  const normalized = normalizeTurnState(input)
  if (!normalized.kind) {
    throw new Error('turn-state requires cwd and a valid kind')
  }
  if (
    (normalized.kind === 'waiting' || normalized.kind === 'blocked')
    && (!normalized.reasonCategory || !normalized.reason)
  ) {
    throw new Error('turn-state waiting/blocked requires reasonCategory and reason')
  }

  const payload = {
    cwd: normalizePath(cwd),
    key: scope.key,
    scope: scope.scope,
    updatedAt: new Date().toISOString(),
    ...normalized,
  }
  writeCapsuleSection(cwd, 'turn', payload, runtimeOptions)

  appendSessionEvent(cwd, {
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
      path: getSessionCapsulePath(cwd, input),
      payload,
    }))
    return
  }

  if (command === 'clear') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      cleared: clearTurnState(cwd, input),
    }))
    return
  }

  if (command === 'read') {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      state: readTurnState(cwd, input),
    }))
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

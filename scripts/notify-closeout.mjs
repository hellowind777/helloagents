import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { getRuntimeEvidencePath, readRuntimeEvidence, writeRuntimeEvidence } from './runtime-artifacts.mjs'

export const CODEX_CLOSEOUT_EVIDENCE_FILE = 'codex-native-stop.json'
const CODEX_CLOSEOUT_LOCK_FILE = 'codex-native-stop.lock'
const WEAK_KEY_TTL_MS = 10_000
const LOCK_STALE_MS = 120_000

function getTurnId(payload = {}) {
  return String(payload.turnId || payload.turn_id || payload['turn-id'] || '').trim()
}

function getSessionId(payload = {}) {
  return String(payload.sessionId || payload.session_id || payload['session-id'] || '').trim()
}

function normalizeMessage(message = '') {
  return String(message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function hashValue(value = '') {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, 16)
}

function uniqueKeys(values = []) {
  return Array.from(new Set(values.filter(Boolean)))
}

function readLockPayload(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8'))
  } catch {
    return null
  }
}

function isLockStale(lockPath, now = Date.now()) {
  try {
    const stat = statSync(lockPath)
    return now - stat.mtimeMs > LOCK_STALE_MS
  } catch {
    return false
  }
}

function writeLockFile(lockPath, payload) {
  mkdirSync(dirname(lockPath), { recursive: true })
  const fd = openSync(lockPath, 'wx')
  try {
    writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  } finally {
    closeSync(fd)
  }
}

function releaseLockFile(lockPath) {
  try {
    unlinkSync(lockPath)
  } catch {}
}

function intersects(left = [], right = []) {
  if (!left.length || !right.length) return false
  const rightSet = new Set(right)
  return left.some((item) => rightSet.has(item))
}

export function buildCodexCloseoutSnapshot({ payload = {}, turnState = null } = {}) {
  const turnId = getTurnId(payload)
  const sessionId = getSessionId(payload)
  const message = normalizeMessage(
    payload.lastAssistantMessage
    || payload.last_assistant_message
    || payload['last-assistant-message']
    || '',
  )
  const messageHash = message ? hashValue(message) : ''

  const strongKeys = uniqueKeys([
    turnId ? `turn:${turnId}` : '',
    turnState?.key && turnState?.updatedAt
      ? `state:${turnState.key}:${turnState.updatedAt}`
      : '',
  ])
  const weakKeys = uniqueKeys([
    sessionId && messageHash ? `session-message:${sessionId}:${messageHash}` : '',
    !sessionId && messageHash ? `message:${messageHash}` : '',
  ])

  return {
    turnId,
    sessionId,
    messageHash,
    strongKeys,
    weakKeys,
  }
}

export function matchesCodexCloseoutEvidence(evidence, snapshot, now = Date.now()) {
  if (!evidence || typeof evidence !== 'object') return false

  const strongKeys = Array.isArray(evidence.strongKeys) ? evidence.strongKeys : []
  const weakKeys = Array.isArray(evidence.weakKeys) ? evidence.weakKeys : []
  if (intersects(snapshot.strongKeys, strongKeys)) return true

  const currentHasStrong = snapshot.strongKeys.length > 0
  const evidenceHasStrong = strongKeys.length > 0
  if (currentHasStrong && evidenceHasStrong) return false

  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt) || now - updatedAt > WEAK_KEY_TTL_MS) return false
  return intersects(snapshot.weakKeys, weakKeys)
}

/**
 * Try to claim the current Codex closeout so Stop and native notify handle one turn only once.
 */
export function beginCodexCloseoutClaim(cwd, { payload = {}, turnState = null, source = '' } = {}) {
  const snapshot = buildCodexCloseoutSnapshot({ payload, turnState })
  const lockPath = getRuntimeEvidencePath(cwd, CODEX_CLOSEOUT_LOCK_FILE, { payload })
  const evidencePath = getRuntimeEvidencePath(cwd, CODEX_CLOSEOUT_EVIDENCE_FILE, { payload })
  const now = Date.now()
  const lockPayload = {
    source,
    pid: process.pid,
    createdAt: new Date(now).toISOString(),
    turnId: snapshot.turnId,
    sessionId: snapshot.sessionId,
  }

  try {
    writeLockFile(lockPath, lockPayload)
  } catch (error) {
    if (error?.code === 'EEXIST' && isLockStale(lockPath, now)) {
      releaseLockFile(lockPath)
      try {
        writeLockFile(lockPath, lockPayload)
      } catch (retryError) {
        if (retryError?.code !== 'EEXIST') throw retryError
      }
    } else if (error?.code !== 'EEXIST') {
      throw error
    }
  }

  const lockOwner = readLockPayload(lockPath)
  if (
    !lockOwner
    || lockOwner.createdAt !== lockPayload.createdAt
    || lockOwner.source !== source
    || lockOwner.pid !== process.pid
  ) {
    return {
      claimed: false,
      reason: 'busy',
      snapshot,
      evidencePath,
    }
  }

  const evidence = readRuntimeEvidence(cwd, CODEX_CLOSEOUT_EVIDENCE_FILE, { payload })
  if (matchesCodexCloseoutEvidence(evidence, snapshot, now)) {
    releaseLockFile(lockPath)
    return {
      claimed: false,
      reason: 'duplicate',
      snapshot,
      evidencePath,
    }
  }

  return {
    claimed: true,
    cwd,
    payload,
    source,
    lockPath,
    evidencePath,
    snapshot,
  }
}

/**
 * Persist the handled closeout fingerprint and release the in-flight lock.
 */
export function finalizeCodexCloseoutClaim(claim, meta = {}) {
  if (!claim?.claimed) return

  try {
    if (meta.handled !== false) {
      writeRuntimeEvidence(claim.cwd, CODEX_CLOSEOUT_EVIDENCE_FILE, {
        version: 2,
        updatedAt: new Date().toISOString(),
        source: meta.source || claim.source || '',
        turnKind: meta.turnKind || '',
        event: meta.event || '',
        turnId: claim.snapshot.turnId,
        sessionId: claim.snapshot.sessionId,
        messageHash: claim.snapshot.messageHash,
        strongKeys: claim.snapshot.strongKeys,
        weakKeys: claim.snapshot.weakKeys,
      }, { payload: claim.payload })
    }
  } finally {
    releaseLockFile(claim.lockPath)
  }
}

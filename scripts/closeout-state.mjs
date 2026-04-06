import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { captureWorkspaceFingerprint } from './verify-state.mjs'
import { appendReplayEvent } from './replay-state.mjs'

export const CLOSEOUT_EVIDENCE_FILE_NAME = '.ralph-closeout.json'
const CLOSEOUT_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000
const ALLOWED_STATUSES = new Set(['PASS', 'BLOCKED'])

function normalizeEntry(entry = {}) {
  return {
    status: typeof entry.status === 'string' ? entry.status.trim().toUpperCase() : '',
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
  }
}

export function getCloseoutEvidencePath(cwd) {
  return join(cwd, '.helloagents', CLOSEOUT_EVIDENCE_FILE_NAME)
}

export function readCloseoutEvidence(cwd) {
  try {
    return JSON.parse(readFileSync(getCloseoutEvidencePath(cwd), 'utf-8'))
  } catch {
    return null
  }
}

export function clearCloseoutEvidence(cwd) {
  rmSync(getCloseoutEvidencePath(cwd), { force: true })
}

export function normalizeCloseoutEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    requirementsCoverage: normalizeEntry(input.requirementsCoverage),
    deliveryChecklist: normalizeEntry(input.deliveryChecklist),
  }
}

export function writeCloseoutEvidence(cwd, input = {}) {
  mkdirSync(join(cwd, '.helloagents'), { recursive: true })
  const normalized = normalizeCloseoutEvidence(input)
  const payload = {
    updatedAt: new Date().toISOString(),
    source: normalized.source || 'manual',
    originCommand: normalized.originCommand,
    requirementsCoverage: normalized.requirementsCoverage,
    deliveryChecklist: normalized.deliveryChecklist,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeFileSync(getCloseoutEvidencePath(cwd), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  appendReplayEvent(cwd, {
    event: 'closeout_evidence_written',
    source: normalized.source || 'manual',
    skillName: normalized.originCommand,
    details: {
      requirementsCoverage: normalized.requirementsCoverage,
      deliveryChecklist: normalized.deliveryChecklist,
    },
    artifacts: ['.helloagents/.ralph-closeout.json'],
  })
  return payload
}

function readRequiredCloseoutEvidence(cwd) {
  const evidence = readCloseoutEvidence(cwd)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['missing closeout evidence for requirements coverage and delivery checklist'],
    },
  }
}

function validateCloseoutTimestamp(evidence, now) {
  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['closeout evidence timestamp is invalid'],
    }
  }
  if (now - updatedAt > CLOSEOUT_EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: ['closeout evidence is older than 30 minutes'],
    }
  }
  return null
}

function validateCloseoutEntries(evidence) {
  const requirementsCoverage = normalizeEntry(evidence.requirementsCoverage)
  const deliveryChecklist = normalizeEntry(evidence.deliveryChecklist)

  if (
    !ALLOWED_STATUSES.has(requirementsCoverage.status)
    || !requirementsCoverage.summary
    || !ALLOWED_STATUSES.has(deliveryChecklist.status)
    || !deliveryChecklist.summary
  ) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['closeout evidence must record requirements coverage and delivery checklist with explicit PASS/BLOCKED status plus summary'],
    }
  }
  if (requirementsCoverage.status !== 'PASS') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['requirements coverage is not marked as PASS in the latest closeout evidence'],
    }
  }
  if (deliveryChecklist.status !== 'PASS') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['delivery checklist is not marked as PASS in the latest closeout evidence'],
    }
  }
  return {
    requirementsCoverage,
    deliveryChecklist,
  }
}

function validateCloseoutFingerprint(cwd, evidence) {
  const currentFingerprint = captureWorkspaceFingerprint(cwd)
  if (
    currentFingerprint.available
    && evidence.fingerprint?.available
    && currentFingerprint.combined !== evidence.fingerprint.combined
  ) {
    return {
      required: true,
      status: 'stale-diff',
      evidence,
      details: ['workspace diff changed after the last successful closeout evidence'],
    }
  }
  return null
}

export function getCloseoutEvidenceStatus(cwd, { required = false, now = Date.now() } = {}) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const requiredEvidence = readRequiredCloseoutEvidence(cwd)
  if (requiredEvidence.error) return requiredEvidence.error

  const { evidence } = requiredEvidence
  const timestampError = validateCloseoutTimestamp(evidence, now)
  if (timestampError) return timestampError

  const normalizedEntries = validateCloseoutEntries(evidence)
  if (!('requirementsCoverage' in normalizedEntries)) return normalizedEntries

  const fingerprintError = validateCloseoutFingerprint(cwd, evidence)
  if (fingerprintError) return fingerprintError

  return {
    required: true,
    status: 'valid',
    evidence: {
      ...evidence,
      requirementsCoverage: normalizedEntries.requirementsCoverage,
      deliveryChecklist: normalizedEntries.deliveryChecklist,
    },
  }
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
  if (command !== 'write') return

  const input = readStdinJson()
  const cwd = input.cwd || process.cwd()
  const payload = writeCloseoutEvidence(cwd, input)
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getCloseoutEvidencePath(cwd),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

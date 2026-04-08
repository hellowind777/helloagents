import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { captureWorkspaceFingerprint } from './verify-state.mjs'
import { appendReplayEvent } from './replay-state.mjs'

export const REVIEW_EVIDENCE_FILE_NAME = '.ralph-review.json'
const REVIEW_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000
const VALID_REVIEW_OUTCOMES = new Set(['clean', 'findings'])

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean))]
}

function normalizeReviewOutcome(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_REVIEW_OUTCOMES.has(normalized) ? normalized : ''
}

export function getReviewEvidencePath(cwd) {
  return join(cwd, '.helloagents', REVIEW_EVIDENCE_FILE_NAME)
}

export function readReviewEvidence(cwd) {
  try {
    return JSON.parse(readFileSync(getReviewEvidencePath(cwd), 'utf-8'))
  } catch {
    return null
  }
}

export function clearReviewEvidence(cwd) {
  rmSync(getReviewEvidencePath(cwd), { force: true })
}

export function normalizeReviewEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    reviewMode: typeof input.reviewMode === 'string' ? input.reviewMode.trim() : '',
    outcome: normalizeReviewOutcome(input.outcome),
    conclusion: typeof input.conclusion === 'string' ? input.conclusion.trim() : '',
    findings: normalizeStringArray(input.findings),
    fileReferences: normalizeStringArray(input.fileReferences),
  }
}

export function writeReviewEvidence(cwd, {
  source = 'stop',
  originCommand = '',
  reviewMode = '',
  outcome = '',
  conclusion = '',
  findings = [],
  fileReferences = [],
} = {}) {
  mkdirSync(join(cwd, '.helloagents'), { recursive: true })
  const normalized = normalizeReviewEvidence({
    source,
    originCommand,
    reviewMode,
    outcome,
    conclusion,
    findings,
    fileReferences,
  })
  const payload = {
    updatedAt: new Date().toISOString(),
    source: normalized.source,
    originCommand: normalized.originCommand,
    reviewMode: normalized.reviewMode,
    conclusion: normalized.conclusion,
    outcome: normalized.outcome,
    findings: normalized.findings,
    fileReferences: normalized.fileReferences,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeFileSync(getReviewEvidencePath(cwd), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  appendReplayEvent(cwd, {
    event: 'review_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    details: {
      reviewMode: normalized.reviewMode,
      outcome: normalized.outcome,
      conclusion: normalized.conclusion,
      findings: normalized.findings,
      fileReferences: normalized.fileReferences,
    },
    artifacts: ['.helloagents/.ralph-review.json'],
  })
  return payload
}

function readRequiredReviewEvidence(cwd) {
  const evidence = readReviewEvidence(cwd)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['missing successful review evidence for review-first closeout'],
    },
  }
}

function validateReviewTimestamp(evidence, now) {
  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['review evidence timestamp is invalid'],
    }
  }
  if (now - updatedAt > REVIEW_EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: ['review evidence is older than 30 minutes'],
    }
  }
  return null
}

function validateReviewFingerprint(cwd, evidence) {
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
      details: ['workspace diff changed after the last successful review evidence'],
    }
  }
  return null
}

function validateReviewOutcome(evidence) {
  if (!normalizeReviewOutcome(evidence.outcome) || !String(evidence.conclusion || '').trim()) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['review evidence must record explicit outcome and conclusion'],
    }
  }
  if (normalizeReviewOutcome(evidence.outcome) !== 'clean') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['latest review evidence still records blocking findings'],
    }
  }
  return null
}

export function getReviewEvidenceStatus(cwd, { required = false, now = Date.now() } = {}) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const requiredEvidence = readRequiredReviewEvidence(cwd)
  if (requiredEvidence.error) return requiredEvidence.error

  const { evidence } = requiredEvidence
  const timestampError = validateReviewTimestamp(evidence, now)
  if (timestampError) return timestampError

  const fingerprintError = validateReviewFingerprint(cwd, evidence)
  if (fingerprintError) return fingerprintError

  const outcomeError = validateReviewOutcome(evidence)
  if (outcomeError) return outcomeError

  return {
    required: true,
    status: 'valid',
    evidence,
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
  const payload = writeReviewEvidence(cwd, input)
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getReviewEvidencePath(cwd),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

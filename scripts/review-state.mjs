import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { appendReplayEvent } from './replay-state.mjs'
import {
  captureWorkspaceFingerprint,
  clearRuntimeEvidence,
  getRuntimeEvidencePath,
  getRuntimeEvidenceRelativePath,
  readRuntimeEvidence,
  validateEvidenceFingerprint,
  validateEvidenceTimestamp,
  writeRuntimeEvidence,
} from './runtime-artifacts.mjs'

export const REVIEW_EVIDENCE_FILE_NAME = 'review.json'
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

export function getReviewEvidencePath(cwd, options = {}) {
  return getRuntimeEvidencePath(cwd, REVIEW_EVIDENCE_FILE_NAME, options)
}

export function readReviewEvidence(cwd, options = {}) {
  return readRuntimeEvidence(cwd, REVIEW_EVIDENCE_FILE_NAME, options)
}

export function clearReviewEvidence(cwd, options = {}) {
  clearRuntimeEvidence(cwd, REVIEW_EVIDENCE_FILE_NAME, options)
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
} = {}, options = {}) {
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
  writeRuntimeEvidence(cwd, REVIEW_EVIDENCE_FILE_NAME, payload, options)
  appendReplayEvent(cwd, {
    event: 'review_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    payload: options.payload || {},
    details: {
      reviewMode: normalized.reviewMode,
      outcome: normalized.outcome,
      conclusion: normalized.conclusion,
      findings: normalized.findings,
      fileReferences: normalized.fileReferences,
    },
    artifacts: [getRuntimeEvidenceRelativePath(cwd, REVIEW_EVIDENCE_FILE_NAME, options)],
  })
  return payload
}

function readRequiredReviewEvidence(cwd, options = {}) {
  const evidence = readReviewEvidence(cwd, options)
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
  return validateEvidenceTimestamp(evidence, now, 'review evidence')
}

function validateReviewFingerprint(cwd, evidence) {
  return validateEvidenceFingerprint(cwd, evidence, 'successful review evidence')
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

export function getReviewEvidenceStatus(cwd, { required = false, now = Date.now(), ...options } = {}) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const requiredEvidence = readRequiredReviewEvidence(cwd, options)
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
  const payload = writeReviewEvidence(cwd, input, { payload: input })
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getReviewEvidencePath(cwd, { payload: input }),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

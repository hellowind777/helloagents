import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { appendReplayEvent } from './replay-state.mjs'
import { captureWorkspaceFingerprint } from './verify-state.mjs'

export const ADVISOR_EVIDENCE_FILE_NAME = '.ralph-advisor.json'
const ADVISOR_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000
const VALID_ADVISOR_OUTCOMES = new Set(['clean', 'findings'])
const VALID_SOURCES = new Set(['claude', 'codex', 'gemini'])

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))]
}

function normalizeSources(values) {
  return normalizeStringArray(values).filter((value) => VALID_SOURCES.has(value))
}

function normalizeOutcome(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_ADVISOR_OUTCOMES.has(normalized) ? normalized : ''
}

export function getAdvisorEvidencePath(cwd) {
  return join(cwd, '.helloagents', ADVISOR_EVIDENCE_FILE_NAME)
}

export function readAdvisorEvidence(cwd) {
  try {
    return JSON.parse(readFileSync(getAdvisorEvidencePath(cwd), 'utf-8'))
  } catch {
    return null
  }
}

export function clearAdvisorEvidence(cwd) {
  rmSync(getAdvisorEvidencePath(cwd), { force: true })
}

export function normalizeAdvisorEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    reason: typeof input.reason === 'string' ? input.reason.trim() : '',
    focus: normalizeStringArray(input.focus),
    preferredSources: normalizeSources(input.preferredSources),
    consultedSources: normalizeSources(input.consultedSources),
    outcome: normalizeOutcome(input.outcome),
    summary: typeof input.summary === 'string' ? input.summary.trim() : '',
    findings: normalizeStringArray(input.findings),
    recommendations: normalizeStringArray(input.recommendations),
  }
}

export function writeAdvisorEvidence(cwd, input = {}) {
  mkdirSync(join(cwd, '.helloagents'), { recursive: true })
  const normalized = normalizeAdvisorEvidence(input)
  const payload = {
    updatedAt: new Date().toISOString(),
    ...normalized,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeFileSync(getAdvisorEvidencePath(cwd), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  appendReplayEvent(cwd, {
    event: 'advisor_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    details: {
      reason: normalized.reason,
      focus: normalized.focus,
      preferredSources: normalized.preferredSources,
      consultedSources: normalized.consultedSources,
      outcome: normalized.outcome,
    },
    artifacts: ['.helloagents/.ralph-advisor.json'],
  })
  return payload
}

function readRequiredAdvisorEvidence(cwd, required) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const evidence = readAdvisorEvidence(cwd)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['missing advisor evidence required by the active contract'],
    },
  }
}

function validateAdvisorTimestamp(evidence, now) {
  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['advisor evidence timestamp is invalid'],
    }
  }
  if (now - updatedAt > ADVISOR_EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: ['advisor evidence is older than 30 minutes'],
    }
  }
  return null
}

function validateAdvisorFingerprint(cwd, evidence) {
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
      details: ['workspace diff changed after the last advisor evidence'],
    }
  }
  return null
}

function validateAdvisorContent(evidence, focus = []) {
  if (!normalizeOutcome(evidence.outcome) || !String(evidence.summary || '').trim() || !String(evidence.reason || '').trim()) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['advisor evidence must record explicit outcome, reason, and summary'],
    }
  }
  if (normalizeSources(evidence.consultedSources).length === 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['advisor evidence must record at least one consulted source'],
    }
  }
  if (normalizeStringArray(focus).length > 0 && normalizeStringArray(evidence.focus).length === 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['advisor evidence must retain the requested advisor focus'],
    }
  }
  if (normalizeOutcome(evidence.outcome) !== 'clean') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['latest advisor evidence still records blocking findings'],
    }
  }
  return null
}

export function getAdvisorEvidenceStatus(cwd, { required = false, focus = [], now = Date.now() } = {}) {
  const requiredEvidence = readRequiredAdvisorEvidence(cwd, required)
  if ('status' in requiredEvidence) return requiredEvidence
  if (requiredEvidence.error) return requiredEvidence.error

  const { evidence } = requiredEvidence
  const timestampError = validateAdvisorTimestamp(evidence, now)
  if (timestampError) return timestampError

  const fingerprintError = validateAdvisorFingerprint(cwd, evidence)
  if (fingerprintError) return fingerprintError

  const contentError = validateAdvisorContent(evidence, focus)
  if (contentError) return contentError

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
  const payload = writeAdvisorEvidence(cwd, input)
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getAdvisorEvidencePath(cwd),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

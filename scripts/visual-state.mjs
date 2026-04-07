import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { appendReplayEvent } from './replay-state.mjs'
import { captureWorkspaceFingerprint } from './verify-state.mjs'

export const VISUAL_EVIDENCE_FILE_NAME = '.ralph-visual.json'
const VISUAL_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000
const VALID_VISUAL_STATUSES = new Set(['PASS', 'BLOCKED'])

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))]
}

function normalizeVisualStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return VALID_VISUAL_STATUSES.has(normalized) ? normalized : ''
}

function findMissingCoverage(requested = [], completed = []) {
  const completedSet = new Set(normalizeStringArray(completed))
  return normalizeStringArray(requested).filter((entry) => !completedSet.has(entry))
}

export function getVisualEvidencePath(cwd) {
  return join(cwd, '.helloagents', VISUAL_EVIDENCE_FILE_NAME)
}

export function readVisualEvidence(cwd) {
  try {
    return JSON.parse(readFileSync(getVisualEvidencePath(cwd), 'utf-8'))
  } catch {
    return null
  }
}

export function clearVisualEvidence(cwd) {
  rmSync(getVisualEvidencePath(cwd), { force: true })
}

export function normalizeVisualEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    reason: typeof input.reason === 'string' ? input.reason.trim() : '',
    tooling: normalizeStringArray(input.tooling),
    screensChecked: normalizeStringArray(input.screensChecked),
    statesChecked: normalizeStringArray(input.statesChecked),
    status: normalizeVisualStatus(input.status),
    summary: typeof input.summary === 'string' ? input.summary.trim() : '',
    findings: normalizeStringArray(input.findings),
    recommendations: normalizeStringArray(input.recommendations),
  }
}

export function writeVisualEvidence(cwd, input = {}) {
  mkdirSync(join(cwd, '.helloagents'), { recursive: true })
  const normalized = normalizeVisualEvidence(input)
  const payload = {
    updatedAt: new Date().toISOString(),
    ...normalized,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeFileSync(getVisualEvidencePath(cwd), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  appendReplayEvent(cwd, {
    event: 'visual_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    details: {
      reason: normalized.reason,
      tooling: normalized.tooling,
      screensChecked: normalized.screensChecked,
      statesChecked: normalized.statesChecked,
      status: normalized.status,
    },
    artifacts: ['.helloagents/.ralph-visual.json'],
  })
  return payload
}

function readRequiredVisualEvidence(cwd, required) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const evidence = readVisualEvidence(cwd)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['missing visual validation evidence required by the active UI contract'],
    },
  }
}

function validateVisualTimestamp(evidence, now) {
  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['visual validation evidence timestamp is invalid'],
    }
  }
  if (now - updatedAt > VISUAL_EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: ['visual validation evidence is older than 30 minutes'],
    }
  }
  return null
}

function validateVisualFingerprint(cwd, evidence) {
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
      details: ['workspace diff changed after the last visual validation evidence'],
    }
  }
  return null
}

function validateVisualContent(evidence, { screens = [], states = [] } = {}) {
  const normalized = normalizeVisualEvidence(evidence)
  if (!normalized.status || !normalized.summary || !normalized.reason) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['visual validation evidence must record explicit status, reason, and summary'],
    }
  }
  if (normalized.tooling.length === 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['visual validation evidence must record the tooling used for the check'],
    }
  }
  if (normalized.screensChecked.length === 0 && normalized.statesChecked.length === 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: ['visual validation evidence must record at least one checked screen or state'],
    }
  }

  const missingScreens = findMissingCoverage(screens, normalized.screensChecked)
  if (missingScreens.length > 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: [`visual validation evidence does not cover requested screens: ${missingScreens.join(', ')}`],
    }
  }

  const missingStates = findMissingCoverage(states, normalized.statesChecked)
  if (missingStates.length > 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: [`visual validation evidence does not cover requested states: ${missingStates.join(', ')}`],
    }
  }

  if (normalized.status !== 'PASS') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['latest visual validation evidence still records blocking findings'],
    }
  }
  return null
}

export function getVisualEvidenceStatus(cwd, { required = false, screens = [], states = [], now = Date.now() } = {}) {
  const requiredEvidence = readRequiredVisualEvidence(cwd, required)
  if ('status' in requiredEvidence) return requiredEvidence
  if (requiredEvidence.error) return requiredEvidence.error

  const { evidence } = requiredEvidence
  const timestampError = validateVisualTimestamp(evidence, now)
  if (timestampError) return timestampError

  const fingerprintError = validateVisualFingerprint(cwd, evidence)
  if (fingerprintError) return fingerprintError

  const contentError = validateVisualContent(evidence, { screens, states })
  if (contentError) return contentError

  return {
    required: true,
    status: 'valid',
    evidence: normalizeVisualEvidence(evidence),
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
  const payload = writeVisualEvidence(cwd, input)
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getVisualEvidencePath(cwd),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

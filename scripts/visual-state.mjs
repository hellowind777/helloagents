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

export const VISUAL_EVIDENCE_FILE_NAME = 'visual.json'
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

export function getVisualEvidencePath(cwd, options = {}) {
  return getRuntimeEvidencePath(cwd, VISUAL_EVIDENCE_FILE_NAME, options)
}

export function readVisualEvidence(cwd, options = {}) {
  return readRuntimeEvidence(cwd, VISUAL_EVIDENCE_FILE_NAME, options)
}

export function clearVisualEvidence(cwd, options = {}) {
  clearRuntimeEvidence(cwd, VISUAL_EVIDENCE_FILE_NAME, options)
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

export function writeVisualEvidence(cwd, input = {}, options = {}) {
  const normalized = normalizeVisualEvidence(input)
  const payload = {
    updatedAt: new Date().toISOString(),
    ...normalized,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeRuntimeEvidence(cwd, VISUAL_EVIDENCE_FILE_NAME, payload, options)
  appendReplayEvent(cwd, {
    event: 'visual_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    payload: options.payload || {},
    details: {
      reason: normalized.reason,
      tooling: normalized.tooling,
      screensChecked: normalized.screensChecked,
      statesChecked: normalized.statesChecked,
      status: normalized.status,
    },
    artifacts: [getRuntimeEvidenceRelativePath(cwd, VISUAL_EVIDENCE_FILE_NAME, options)],
  })
  return payload
}

function readRequiredVisualEvidence(cwd, required, options = {}) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const evidence = readVisualEvidence(cwd, options)
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
  return validateEvidenceTimestamp(evidence, now, 'visual validation evidence')
}

function validateVisualFingerprint(cwd, evidence) {
  return validateEvidenceFingerprint(cwd, evidence, 'visual validation evidence')
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

export function getVisualEvidenceStatus(cwd, { required = false, screens = [], states = [], now = Date.now(), ...options } = {}) {
  const requiredEvidence = readRequiredVisualEvidence(cwd, required, options)
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
  const payload = writeVisualEvidence(cwd, input, { payload: input })
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getVisualEvidencePath(cwd, { payload: input }),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

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

export const CLOSEOUT_EVIDENCE_FILE_NAME = 'closeout.json'
const ALLOWED_STATUSES = new Set(['PASS', 'BLOCKED'])

function normalizeEntry(entry = {}) {
  return {
    status: typeof entry.status === 'string' ? entry.status.trim().toUpperCase() : '',
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
  }
}

export function getCloseoutEvidencePath(cwd, options = {}) {
  return getRuntimeEvidencePath(cwd, CLOSEOUT_EVIDENCE_FILE_NAME, options)
}

export function readCloseoutEvidence(cwd, options = {}) {
  return readRuntimeEvidence(cwd, CLOSEOUT_EVIDENCE_FILE_NAME, options)
}

export function clearCloseoutEvidence(cwd, options = {}) {
  clearRuntimeEvidence(cwd, CLOSEOUT_EVIDENCE_FILE_NAME, options)
}

export function normalizeCloseoutEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    requirementsCoverage: normalizeEntry(input.requirementsCoverage),
    deliveryChecklist: normalizeEntry(input.deliveryChecklist),
  }
}

export function writeCloseoutEvidence(cwd, input = {}, options = {}) {
  const normalized = normalizeCloseoutEvidence(input)
  const payload = {
    updatedAt: new Date().toISOString(),
    source: normalized.source || 'manual',
    originCommand: normalized.originCommand,
    requirementsCoverage: normalized.requirementsCoverage,
    deliveryChecklist: normalized.deliveryChecklist,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeRuntimeEvidence(cwd, CLOSEOUT_EVIDENCE_FILE_NAME, payload, options)
  appendReplayEvent(cwd, {
    event: 'closeout_evidence_written',
    source: normalized.source || 'manual',
    skillName: normalized.originCommand,
    payload: options.payload || {},
    details: {
      requirementsCoverage: normalized.requirementsCoverage,
      deliveryChecklist: normalized.deliveryChecklist,
    },
    artifacts: [getRuntimeEvidenceRelativePath(cwd, CLOSEOUT_EVIDENCE_FILE_NAME, options)],
  })
  return payload
}

function readRequiredCloseoutEvidence(cwd, options = {}) {
  const evidence = readCloseoutEvidence(cwd, options)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['缺少需求覆盖和交付清单的收尾证据'],
    },
  }
}

function validateCloseoutTimestamp(evidence, now) {
  return validateEvidenceTimestamp(evidence, now, '收尾证据')
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
      details: ['收尾证据必须记录需求覆盖和交付清单，并包含明确的 PASS/BLOCKED 状态和 summary'],
    }
  }
  if (requirementsCoverage.status !== 'PASS') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['最新收尾证据中的需求覆盖未标记为 PASS'],
    }
  }
  if (deliveryChecklist.status !== 'PASS') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      details: ['最新收尾证据中的交付清单未标记为 PASS'],
    }
  }
  return {
    requirementsCoverage,
    deliveryChecklist,
  }
}

function validateCloseoutFingerprint(cwd, evidence) {
  return validateEvidenceFingerprint(cwd, evidence, '成功收尾证据')
}

export function getCloseoutEvidenceStatus(cwd, { required = false, now = Date.now(), ...options } = {}) {
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
    }
  }

  const requiredEvidence = readRequiredCloseoutEvidence(cwd, options)
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
  const payload = writeCloseoutEvidence(cwd, input, { payload: input })
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getCloseoutEvidencePath(cwd, { payload: input }),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

import { execSync } from 'node:child_process'

import {
  clearSessionArtifact,
  getSessionArtifactPath,
  getSessionArtifactRelativePath,
  readSessionArtifact,
  writeSessionArtifact,
} from './session-capsule.mjs'

export const EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000

function readGitDiffStat(cwd, args) {
  try {
    return execSync(`git diff --stat ${args}`.trim(), {
      cwd,
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

export function captureWorkspaceFingerprint(cwd) {
  const unstaged = readGitDiffStat(cwd, 'HEAD')
  const staged = readGitDiffStat(cwd, '--cached')
  const available = unstaged !== null || staged !== null

  return {
    available,
    unstaged: unstaged || '',
    staged: staged || '',
    combined: `${unstaged || ''}\n---\n${staged || ''}`.trim(),
  }
}

export function getRuntimeEvidencePath(cwd, fileName, options = {}) {
  return getSessionArtifactPath(cwd, fileName, options)
}

export function getRuntimeEvidenceRelativePath(cwd, fileName, options = {}) {
  return getSessionArtifactRelativePath(cwd, fileName, options)
}

export function readRuntimeEvidence(cwd, fileName, options = {}) {
  return readSessionArtifact(cwd, fileName, options)
}

export function clearRuntimeEvidence(cwd, fileName, options = {}) {
  clearSessionArtifact(cwd, fileName, options)
}

export function writeRuntimeEvidence(cwd, fileName, payload, options = {}) {
  return writeSessionArtifact(cwd, fileName, payload, options)
}

export function validateEvidenceTimestamp(evidence, now, label) {
  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      details: [`${label} timestamp is invalid`],
    }
  }
  if (now - updatedAt > EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: [`${label} is older than 30 minutes`],
    }
  }
  return null
}

export function validateEvidenceFingerprint(cwd, evidence, label) {
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
      details: [`workspace diff changed after the last ${label}`],
    }
  }
  return null
}

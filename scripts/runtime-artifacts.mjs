import { execSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'

import {
  getProjectEvidencePath,
  getProjectEvidenceRelativePath,
} from './project-storage.mjs'
import { writeJsonFileAtomic } from './runtime-scope.mjs'

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
  return getProjectEvidencePath(cwd, fileName, options)
}

export function getRuntimeEvidenceRelativePath(cwd, fileName, options = {}) {
  return getProjectEvidenceRelativePath(cwd, fileName, options)
}

export function readRuntimeEvidence(cwd, fileName, options = {}) {
  try {
    return JSON.parse(readFileSync(getRuntimeEvidencePath(cwd, fileName, options), 'utf-8'))
  } catch {
    return null
  }
}

export function clearRuntimeEvidence(cwd, fileName, options = {}) {
  rmSync(getRuntimeEvidencePath(cwd, fileName, options), { force: true })
}

export function writeRuntimeEvidence(cwd, fileName, payload, options = {}) {
  const evidencePath = getRuntimeEvidencePath(cwd, fileName, options)
  writeJsonFileAtomic(evidencePath, payload)
  return evidencePath
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

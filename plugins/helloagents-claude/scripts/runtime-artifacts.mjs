import { execSync } from 'node:child_process'

import {
  clearSessionArtifact,
  getSessionArtifactPath,
  getSessionArtifactRelativePath,
  readSessionArtifact,
  writeSessionArtifact,
} from './session-capsule.mjs'
import { EVIDENCE_MAX_AGE_MS, LONG_RUNNING_TTL_HOURS } from './runtime-ttl.mjs'

export { EVIDENCE_MAX_AGE_MS }

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

function readGitHead(cwd) {
  try {
    return execSync('git rev-parse HEAD', {
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
  const head = readGitHead(cwd)
  const unstaged = readGitDiffStat(cwd, 'HEAD')
  const staged = readGitDiffStat(cwd, '--cached')
  const available = head !== null || unstaged !== null || staged !== null

  return {
    available,
    head: head || '',
    unstaged: unstaged || '',
    staged: staged || '',
    combined: [`HEAD:${head || ''}`, unstaged || '', staged || ''].join('\n---\n').trim(),
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
      details: [`${label}时间戳无效`],
    }
  }
  if (now - updatedAt > EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      evidence,
      details: [`${label}超过 ${LONG_RUNNING_TTL_HOURS} 小时`],
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
      details: [`工作区变更已不同于最近一次${label}后的状态`],
    }
  }
  return null
}

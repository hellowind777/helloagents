import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appendReplayEvent } from './replay-state.mjs'
import {
  getProjectVerifyYamlPath,
} from './project-storage.mjs'
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

export const VERIFY_EVIDENCE_FILE_NAME = 'verify.json'
const SHELL_OPERATORS = /[;&|`$(){}\n\r]/

export function getVerifyEvidencePath(cwd, options = {}) {
  return getRuntimeEvidencePath(cwd, VERIFY_EVIDENCE_FILE_NAME, options)
}

export function readVerifyEvidence(cwd, options = {}) {
  return readRuntimeEvidence(cwd, VERIFY_EVIDENCE_FILE_NAME, options)
}

export function clearVerifyEvidence(cwd, options = {}) {
  clearRuntimeEvidence(cwd, VERIFY_EVIDENCE_FILE_NAME, options)
}

function loadVerifyYaml(cwd) {
  const f = getProjectVerifyYamlPath(cwd)
  if (!existsSync(f)) return null
  try {
    const content = readFileSync(f, 'utf-8')
    const cmds = []
    let inCmds = false
    for (const line of content.split('\n')) {
      const s = line.trim()
      if (s.startsWith('commands:')) { inCmds = true; continue }
      if (inCmds) {
        if (s.startsWith('- ') && !s.startsWith('# ')) {
          const cmd = s.slice(2).trim().replace(/^["']|["']$/g, '')
          if (cmd && !cmd.startsWith('#')) cmds.push(cmd)
        } else if (s && !s.startsWith('#')) {
          break
        }
      }
    }
    return cmds.length ? cmds : null
  } catch {
    return null
  }
}

function detectFromPackageJson(cwd) {
  const f = join(cwd, 'package.json')
  if (!existsSync(f)) return []
  try {
    const scripts = JSON.parse(readFileSync(f, 'utf-8')).scripts || {}
    return ['lint', 'typecheck', 'type-check', 'test', 'build']
      .filter((k) => k in scripts)
      .map((k) => `npm run ${k}`)
  } catch {
    return []
  }
}

function detectFromPyproject(cwd) {
  const f = join(cwd, 'pyproject.toml')
  if (!existsSync(f)) return []
  try {
    const content = readFileSync(f, 'utf-8')
    const cmds = []
    if (content.includes('[tool.ruff')) cmds.push('ruff check .')
    if (content.includes('[tool.mypy')) cmds.push('mypy .')
    if (content.includes('[tool.pytest')) cmds.push('pytest --tb=short -q')
    return cmds
  } catch {
    return []
  }
}

export function detectCommands(cwd) {
  const yaml = loadVerifyYaml(cwd)
  if (yaml?.length) return yaml
  const pkg = detectFromPackageJson(cwd)
  if (pkg.length) return pkg
  return detectFromPyproject(cwd)
}

export function hasUnsafeVerifyCommand(commands = []) {
  return commands.some((cmd) => SHELL_OPERATORS.test(cmd))
}

export function writeVerifyEvidence(cwd, { commands = [], fastOnly = false, source = 'ralph-loop' } = {}, options = {}) {
  const payload = {
    updatedAt: new Date().toISOString(),
    commands,
    fastOnly,
    source,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeRuntimeEvidence(cwd, VERIFY_EVIDENCE_FILE_NAME, payload, options)
  appendReplayEvent(cwd, {
    event: 'verify_evidence_written',
    source,
    payload: options.payload || {},
    details: {
      commands,
      fastOnly,
    },
    artifacts: [getRuntimeEvidenceRelativePath(cwd, VERIFY_EVIDENCE_FILE_NAME, options)],
  })
}

function validateVerifyEvidencePresence(commands, evidence) {
  if (evidence) return null
  return {
    required: true,
    status: 'missing',
    commands,
    details: ['缺少当前工作流的成功验证证据'],
  }
}

function validateVerifyEvidenceFreshness(cwd, commands, evidence, now) {
  if (evidence.fastOnly) {
    return {
      required: true,
      status: 'fast-only',
      commands,
      evidence,
      details: ['最新验证证据只覆盖子代理快速检查'],
    }
  }

  const timestampError = validateEvidenceTimestamp(evidence, now, '验证证据')
  return timestampError ? { ...timestampError, commands } : null
}

function validateVerifyFingerprint(cwd, commands, evidence) {
  const fingerprintError = validateEvidenceFingerprint(cwd, evidence, '成功验证证据')
  return fingerprintError ? { ...fingerprintError, commands } : null
}

export function getVerifyEvidenceStatus(cwd, { now = Date.now(), ...options } = {}) {
  const commands = detectCommands(cwd)
  if (!commands.length) {
    return {
      required: false,
      status: 'not-applicable',
      commands,
    }
  }

  const evidence = readVerifyEvidence(cwd, options)
  const missingError = validateVerifyEvidencePresence(commands, evidence)
  if (missingError) return missingError

  const freshnessError = validateVerifyEvidenceFreshness(cwd, commands, evidence, now)
  if (freshnessError) return freshnessError

  const fingerprintError = validateVerifyFingerprint(cwd, commands, evidence)
  if (fingerprintError) return fingerprintError

  return {
    required: true,
    status: 'valid',
    commands,
    evidence,
  }
}

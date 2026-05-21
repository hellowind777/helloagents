import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
import { getProjectVerifyYamlPath } from './project-storage.mjs'

export const QA_REVIEW_EVIDENCE_FILE_NAME = 'qa-review.json'
const VALID_QA_MODES = new Set(['standard', 'deep'])
const VALID_QA_OUTCOMES = new Set(['clean', 'findings'])
const SHELL_OPERATORS = /[;&|`$(){}\n\r]/

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean))]
}

function normalizeQaMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_QA_MODES.has(normalized) ? normalized : ''
}

function normalizeQaOutcome(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_QA_OUTCOMES.has(normalized) ? normalized : ''
}

function normalizeCommands(values) {
  return normalizeStringArray(values)
}

function loadVerifyYaml(cwd) {
  const filePath = getProjectVerifyYamlPath(cwd)
  if (!existsSync(filePath)) return null
  try {
    const content = readFileSync(filePath, 'utf-8')
    const commands = []
    let inCommands = false
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('commands:')) {
        inCommands = true
        continue
      }
      if (!inCommands) continue
      if (trimmed.startsWith('- ') && !trimmed.startsWith('# ')) {
        const command = trimmed.slice(2).trim().replace(/^["']|["']$/g, '')
        if (command && !command.startsWith('#')) commands.push(command)
        continue
      }
      if (trimmed && !trimmed.startsWith('#')) break
    }
    return commands.length > 0 ? commands : null
  } catch {
    return null
  }
}

function detectFromPackageJson(cwd) {
  const filePath = join(cwd, 'package.json')
  if (!existsSync(filePath)) return []
  try {
    const scripts = JSON.parse(readFileSync(filePath, 'utf-8')).scripts || {}
    return ['lint', 'typecheck', 'type-check', 'test', 'build']
      .filter((key) => key in scripts)
      .map((key) => `npm run ${key}`)
  } catch {
    return []
  }
}

function detectFromPyproject(cwd) {
  const filePath = join(cwd, 'pyproject.toml')
  if (!existsSync(filePath)) return []
  try {
    const content = readFileSync(filePath, 'utf-8')
    const commands = []
    if (content.includes('[tool.ruff')) commands.push('ruff check .')
    if (content.includes('[tool.mypy')) commands.push('mypy .')
    if (content.includes('[tool.pytest')) commands.push('pytest --tb=short -q')
    return commands
  } catch {
    return []
  }
}

export function detectCommands(cwd) {
  const yamlCommands = loadVerifyYaml(cwd)
  if (yamlCommands?.length) return yamlCommands
  const packageJsonCommands = detectFromPackageJson(cwd)
  if (packageJsonCommands.length > 0) return packageJsonCommands
  return detectFromPyproject(cwd)
}

export function hasUnsafeQaCommand(commands = []) {
  return commands.some((command) => SHELL_OPERATORS.test(command))
}

export function getQaReviewEvidencePath(cwd, options = {}) {
  return getRuntimeEvidencePath(cwd, QA_REVIEW_EVIDENCE_FILE_NAME, options)
}

export function readQaReviewEvidence(cwd, options = {}) {
  return readRuntimeEvidence(cwd, QA_REVIEW_EVIDENCE_FILE_NAME, options)
}

export function clearQaReviewEvidence(cwd, options = {}) {
  clearRuntimeEvidence(cwd, QA_REVIEW_EVIDENCE_FILE_NAME, options)
}

export function normalizeQaReviewEvidence(input = {}) {
  return {
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    qaMode: normalizeQaMode(input.qaMode) || 'standard',
    scope: typeof input.scope === 'string' ? input.scope.trim() : '',
    outcome: normalizeQaOutcome(input.outcome),
    conclusion: typeof input.conclusion === 'string' ? input.conclusion.trim() : '',
    findings: normalizeStringArray(input.findings),
    fileReferences: normalizeStringArray(input.fileReferences),
    commands: normalizeCommands(input.commands),
    fastOnly: Boolean(input.fastOnly),
  }
}

export function writeQaReviewEvidence(cwd, {
  source = 'manual',
  originCommand = '',
  qaMode = 'standard',
  scope = '',
  outcome = '',
  conclusion = '',
  findings = [],
  fileReferences = [],
  commands = [],
  fastOnly = false,
} = {}, options = {}) {
  const normalized = normalizeQaReviewEvidence({
    source,
    originCommand,
    qaMode,
    scope,
    outcome,
    conclusion,
    findings,
    fileReferences,
    commands,
    fastOnly,
  })
  const payload = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    source: normalized.source,
    originCommand: normalized.originCommand,
    qaMode: normalized.qaMode,
    scope: normalized.scope,
    outcome: normalized.outcome,
    conclusion: normalized.conclusion,
    findings: normalized.findings,
    fileReferences: normalized.fileReferences,
    commands: normalized.commands,
    fastOnly: normalized.fastOnly,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeRuntimeEvidence(cwd, QA_REVIEW_EVIDENCE_FILE_NAME, payload, options)
  appendReplayEvent(cwd, {
    event: 'qa_review_evidence_written',
    source: normalized.source,
    skillName: normalized.originCommand,
    payload: options.payload || {},
    details: {
      qaMode: normalized.qaMode,
      scope: normalized.scope,
      outcome: normalized.outcome,
      conclusion: normalized.conclusion,
      findings: normalized.findings,
      fileReferences: normalized.fileReferences,
      commands: normalized.commands,
      fastOnly: normalized.fastOnly,
    },
    artifacts: [getRuntimeEvidenceRelativePath(cwd, QA_REVIEW_EVIDENCE_FILE_NAME, options)],
  })
  return payload
}

function readRequiredQaReviewEvidence(cwd, options = {}) {
  const evidence = readQaReviewEvidence(cwd, options)
  if (evidence) return { evidence }
  return {
    error: {
      required: true,
      status: 'missing',
      details: ['缺少当前工作流的成功 qa-review 证据'],
    },
  }
}

function validateQaReviewTimestamp(evidence, now) {
  return validateEvidenceTimestamp(evidence, now, 'qa-review 证据')
}

function validateQaReviewFingerprint(cwd, evidence) {
  return validateEvidenceFingerprint(cwd, evidence, '成功 qa-review 证据')
}

function validateQaReviewEvidence(commands, evidence) {
  if (!normalizeQaOutcome(evidence.outcome) || !String(evidence.conclusion || '').trim()) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      commands,
      details: ['qa-review 证据必须记录明确的 outcome 和 conclusion'],
    }
  }
  if (commands.length > 0 && normalizeCommands(evidence.commands).length === 0) {
    return {
      required: true,
      status: 'invalid',
      evidence,
      commands,
      details: ['qa-review 证据必须记录本次实际执行的验证命令'],
    }
  }
  if (Boolean(evidence.fastOnly)) {
    return {
      required: true,
      status: 'fast-only',
      evidence,
      commands,
      details: ['最新 qa-review 证据只覆盖快速命令检查，未完成完整 qa-review 闭环'],
    }
  }
  if (normalizeQaOutcome(evidence.outcome) !== 'clean') {
    return {
      required: true,
      status: 'blocked',
      evidence,
      commands,
      details: ['最新 qa-review 证据仍记录阻断问题'],
    }
  }
  return null
}

export function getQaReviewEvidenceStatus(cwd, { required = false, now = Date.now(), ...options } = {}) {
  const commands = detectCommands(cwd)
  if (!required) {
    return {
      required: false,
      status: 'not-applicable',
      commands,
    }
  }

  const requiredEvidence = readRequiredQaReviewEvidence(cwd, options)
  if (requiredEvidence.error) return { ...requiredEvidence.error, commands }

  const { evidence } = requiredEvidence
  const timestampError = validateQaReviewTimestamp(evidence, now)
  if (timestampError) return { ...timestampError, commands }

  const fingerprintError = validateQaReviewFingerprint(cwd, evidence)
  if (fingerprintError) return { ...fingerprintError, commands }

  const evidenceError = validateQaReviewEvidence(commands, evidence)
  if (evidenceError) return evidenceError

  return {
    required: true,
    status: 'valid',
    evidence,
    commands,
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
  const payload = writeQaReviewEvidence(cwd, input, { payload: input })
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getQaReviewEvidencePath(cwd, { payload: input }),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

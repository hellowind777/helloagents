import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { appendReplayEvent } from './replay-state.mjs'
import { getProjectVerifyYamlPath } from './project-storage.mjs'

export const VERIFY_EVIDENCE_FILE_NAME = '.ralph-verify.json'
const VERIFY_EVIDENCE_MAX_AGE_MS = 30 * 60 * 1000
const SHELL_OPERATORS = /[;&|`$(){}\n\r]/

export function getVerifyEvidencePath(cwd) {
  return join(cwd, '.helloagents', VERIFY_EVIDENCE_FILE_NAME)
}

export function readVerifyEvidence(cwd) {
  try {
    return JSON.parse(readFileSync(getVerifyEvidencePath(cwd), 'utf-8'))
  } catch {
    return null
  }
}

export function clearVerifyEvidence(cwd) {
  rmSync(getVerifyEvidencePath(cwd), { force: true })
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

export function writeVerifyEvidence(cwd, { commands = [], fastOnly = false, source = 'ralph-loop' } = {}) {
  mkdirSync(join(cwd, '.helloagents'), { recursive: true })
  const payload = {
    updatedAt: new Date().toISOString(),
    commands,
    fastOnly,
    source,
    fingerprint: captureWorkspaceFingerprint(cwd),
  }
  writeFileSync(getVerifyEvidencePath(cwd), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  appendReplayEvent(cwd, {
    event: 'verify_evidence_written',
    source,
    details: {
      commands,
      fastOnly,
    },
    artifacts: ['.helloagents/.ralph-verify.json'],
  })
}

function validateVerifyEvidencePresence(commands, evidence) {
  if (evidence) return null
  return {
    required: true,
    status: 'missing',
    commands,
    details: ['missing successful verification evidence for the current workflow'],
  }
}

function validateVerifyEvidenceFreshness(cwd, commands, evidence, now) {
  if (evidence.fastOnly) {
    return {
      required: true,
      status: 'fast-only',
      commands,
      evidence,
      details: ['latest verification evidence only covers subagent fast checks'],
    }
  }

  const updatedAt = Date.parse(evidence.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return {
      required: true,
      status: 'invalid',
      commands,
      evidence,
      details: ['verification evidence timestamp is invalid'],
    }
  }
  if (now - updatedAt > VERIFY_EVIDENCE_MAX_AGE_MS) {
    return {
      required: true,
      status: 'stale-time',
      commands,
      evidence,
      details: ['verification evidence is older than 30 minutes'],
    }
  }
  return null
}

function validateVerifyFingerprint(cwd, commands, evidence) {
  const currentFingerprint = captureWorkspaceFingerprint(cwd)
  if (
    currentFingerprint.available
    && evidence.fingerprint?.available
    && currentFingerprint.combined !== evidence.fingerprint.combined
  ) {
    return {
      required: true,
      status: 'stale-diff',
      commands,
      evidence,
      details: ['workspace diff changed after the last successful verification evidence'],
    }
  }
  return null
}

export function getVerifyEvidenceStatus(cwd, now = Date.now()) {
  const commands = detectCommands(cwd)
  if (!commands.length) {
    return {
      required: false,
      status: 'not-applicable',
      commands,
    }
  }

  const evidence = readVerifyEvidence(cwd)
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

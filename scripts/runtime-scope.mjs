import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

import { resolveSessionToken } from './session-token.mjs'

export const PROJECT_DIR_NAME = '.helloagents'
export const PROJECT_SESSIONS_DIR_NAME = 'sessions'
export const PROJECT_EVIDENCE_DIR_NAME = 'evidence'
export const PROJECT_RUNTIME_DIR_NAME = 'runtime'
export const PROJECT_REPLAY_DIR_NAME = 'replay'
export const DEFAULT_STATE_SESSION_TOKEN = 'default'

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function runGit(cwd, args = []) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function resolveGitBranchName(cwd) {
  const branchName = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branchName && branchName !== 'HEAD') return branchName

  const symbolicName = runGit(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  return symbolicName && symbolicName !== 'HEAD' ? symbolicName : ''
}

export function sanitizeRuntimeSegment(value = '', fallback = '') {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return normalized || fallback
}

export function normalizeRuntimeOptions(options = {}) {
  if (!options || typeof options !== 'object') return {}
  if (options.payload && typeof options.payload === 'object') return options
  return {
    ...options,
    payload: options,
  }
}

export function getProjectActivationDir(cwd) {
  return join(cwd, PROJECT_DIR_NAME)
}

export function isProjectRuntimeActive(cwd) {
  return existsSync(getProjectActivationDir(cwd))
}

function resolveStableSessionToken({ payload = {}, env = process.env, ppid = process.ppid } = {}) {
  void ppid
  return resolveSessionToken({
    payload,
    env,
    ppid: 0,
    allowPpidFallback: false,
  })
}

function resolveTransientSessionToken({ payload = {}, env = process.env, ppid = process.ppid } = {}) {
  return resolveSessionToken({
    payload,
    env,
    ppid,
    allowPpidFallback: true,
  })
}

export function getProjectSessionScope(cwd, options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const { payload = {}, env = process.env, ppid = process.ppid } = normalizeRuntimeOptions(options)
  const stableToken = resolveStableSessionToken({ payload, env, ppid })
  const branch = sanitizeRuntimeSegment(resolveGitBranchName(normalizedCwd), 'detached')
  const session = sanitizeRuntimeSegment(stableToken, DEFAULT_STATE_SESSION_TOKEN)
  const activationDir = getProjectActivationDir(normalizedCwd)
  const sessionDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME, branch, session)

  return {
    cwd: normalizedCwd,
    active: isProjectRuntimeActive(normalizedCwd),
    branch,
    session,
    sessionMode: stableToken ? 'host-session' : 'default',
    activationDir,
    sessionDir,
    statePath: join(sessionDir, 'STATE.md'),
    evidenceDir: join(sessionDir, PROJECT_EVIDENCE_DIR_NAME),
    runtimeDir: join(sessionDir, PROJECT_RUNTIME_DIR_NAME),
    replayDir: join(sessionDir, PROJECT_REPLAY_DIR_NAME),
    key: `${normalizedCwd}::${branch}::${session}`,
  }
}

function buildTransientRuntimeDir(cwd, options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const { payload = {}, env = process.env, ppid = process.ppid } = normalizeRuntimeOptions(options)
  const token = sanitizeRuntimeSegment(
    resolveTransientSessionToken({ payload, env, ppid }),
    DEFAULT_STATE_SESSION_TOKEN,
  )
  const hash = createHash('sha1')
    .update(`${normalizedCwd.toLowerCase()}::${token}`)
    .digest('hex')
    .slice(0, 16)

  return {
    cwd: normalizedCwd,
    branch: 'transient',
    session: token,
    sessionMode: token === DEFAULT_STATE_SESSION_TOKEN ? 'default' : 'transient-session',
    runtimeDir: join(homedir(), PROJECT_DIR_NAME, PROJECT_RUNTIME_DIR_NAME, hash),
    key: `${normalizedCwd}::transient::${token}`,
  }
}

export function getRuntimeScope(cwd = process.cwd(), options = {}) {
  const projectScope = getProjectSessionScope(cwd, options)
  if (projectScope.active) {
    return {
      ...projectScope,
      scope: 'project-session',
    }
  }

  return {
    ...buildTransientRuntimeDir(cwd, options),
    active: false,
    scope: 'user-runtime',
  }
}

export function getRuntimeFilePath(cwd, fileName, options = {}) {
  return join(getRuntimeScope(cwd, options).runtimeDir, fileName)
}

export function getProjectReplayDir(cwd, options = {}) {
  const scope = getProjectSessionScope(cwd, options)
  return scope.active ? scope.replayDir : ''
}

export function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

export function writeJsonFileAtomic(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = join(dirname(filePath), `.${Date.now()}-${randomUUID()}.tmp`)
  writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  renameSync(tmpPath, filePath)
}

export function removeRuntimeFile(filePath) {
  rmSync(filePath, { force: true })
}


import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

import { resolveSessionToken } from './session-token.mjs'
import { USER_RUNTIME_MAX_AGE_MS } from './runtime-ttl.mjs'

export const PROJECT_DIR_NAME = '.helloagents'
export const PROJECT_SESSIONS_DIR_NAME = 'sessions'
export const PROJECT_ARTIFACTS_DIR_NAME = 'artifacts'
export const CAPSULE_FILE_NAME = 'capsule.json'
export const EVENTS_FILE_NAME = 'events.jsonl'
export const DEFAULT_STATE_SESSION_TOKEN = 'default'
export const USER_RUNTIME_DIR_NAME = 'runtime'
export { USER_RUNTIME_MAX_AGE_MS }

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

function getHomeDir(env = process.env) {
  return env.HOME || env.USERPROFILE || homedir()
}

function normalizeComparablePath(filePath = '') {
  const resolved = normalizePath(filePath)
  try {
    return realpathSync.native(resolved)
  } catch {
    return resolved
  }
}

function samePath(left, right) {
  const a = normalizeComparablePath(left)
  const b = normalizeComparablePath(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function resolveGitTopLevel(cwd) {
  const absolute = runGit(cwd, ['rev-parse', '--path-format=absolute', '--show-toplevel'])
  if (absolute) return normalize(resolve(absolute))

  const raw = runGit(cwd, ['rev-parse', '--show-toplevel'])
  return raw ? normalize(resolve(cwd, raw)) : ''
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
  const activeDir = findProjectActivationDir(cwd)
  return activeDir || join(normalizePath(cwd || process.cwd()), PROJECT_DIR_NAME)
}

export function isProjectRuntimeActive(cwd) {
  return Boolean(findProjectActivationDir(cwd))
}

export function getProjectRoot(cwd) {
  const activeDir = findProjectActivationDir(cwd)
  return activeDir ? dirname(activeDir) : normalizePath(cwd || process.cwd())
}

export function getUserRuntimeRoot(home = getHomeDir()) {
  return join(home, PROJECT_DIR_NAME, USER_RUNTIME_DIR_NAME)
}

function isUserHomeHelloagentsDir(dirPath) {
  const homeCandidates = [
    getHomeDir(),
    process.env.USERPROFILE || '',
    homedir(),
  ].filter(Boolean)
  return homeCandidates.some((home) => samePath(dirPath, join(home, PROJECT_DIR_NAME)))
}

function isUserConfigStoreDir(dirPath) {
  return existsSync(join(dirPath, 'helloagents.json'))
}

function isUserHomeDir(dirPath) {
  const homeCandidates = [
    getHomeDir(),
    process.env.USERPROFILE || '',
    homedir(),
  ].filter(Boolean)
  return homeCandidates.some((home) => samePath(dirPath, home))
}

function findProjectActivationDir(cwd) {
  let current = normalizePath(cwd || process.cwd())
  const gitRoot = resolveGitTopLevel(current)

  while (current) {
    const candidate = join(current, PROJECT_DIR_NAME)
    if (
      existsSync(candidate)
      && !isUserHomeHelloagentsDir(candidate)
      && !isUserConfigStoreDir(candidate)
    ) {
      return candidate
    }
    if (isUserHomeDir(current)) break
    if (gitRoot && samePath(current, gitRoot)) break

    const parent = dirname(current)
    if (!parent || parent === current) break
    current = parent
  }

  return ''
}

function removePathIfExists(filePath, result, bucket) {
  if (!existsSync(filePath)) return
  try {
    rmSync(filePath, { recursive: true, force: true })
    result[bucket].push(filePath)
  } catch (error) {
    result.errors.push(`${filePath}: ${error.message}`)
  }
}

export function cleanupUserRuntimeRoot({
  home = getHomeDir(),
  now = Date.now(),
  maxAgeMs = USER_RUNTIME_MAX_AGE_MS,
} = {}) {
  const root = getUserRuntimeRoot(home)
  const result = {
    root,
    removedExpiredDirs: [],
    errors: [],
  }

  if (!existsSync(root)) return result

  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    result.errors.push(`${root}: ${error.message}`)
    return result
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dirPath = join(root, entry.name)
    try {
      if (now - statSync(dirPath).mtimeMs > maxAgeMs) {
        removePathIfExists(dirPath, result, 'removedExpiredDirs')
      }
    } catch (error) {
      result.errors.push(`${dirPath}: ${error.message}`)
    }
  }

  return result
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
  const projectRoot = getProjectRoot(normalizedCwd)
  const { payload = {}, env = process.env, ppid = process.ppid } = normalizeRuntimeOptions(options)
  const stableToken = resolveStableSessionToken({ payload, env, ppid })
  const branch = sanitizeRuntimeSegment(resolveGitBranchName(projectRoot), 'detached')
  const session = sanitizeRuntimeSegment(stableToken, DEFAULT_STATE_SESSION_TOKEN)
  const activationDir = getProjectActivationDir(projectRoot)
  const sessionDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME, branch, session)

  return {
    cwd: projectRoot,
    active: isProjectRuntimeActive(projectRoot),
    branch,
    session,
    sessionMode: stableToken ? 'host-session' : 'default',
    activationDir,
    sessionDir,
    statePath: join(sessionDir, 'STATE.md'),
    capsulePath: join(sessionDir, CAPSULE_FILE_NAME),
    eventsPath: join(sessionDir, EVENTS_FILE_NAME),
    artifactsDir: join(sessionDir, PROJECT_ARTIFACTS_DIR_NAME),
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
  cleanupUserRuntimeRoot()

  return {
    cwd: normalizedCwd,
    branch: 'transient',
    session: token,
    sessionMode: token === DEFAULT_STATE_SESSION_TOKEN ? 'default' : 'transient-session',
    sessionDir: join(getUserRuntimeRoot(), hash),
    capsulePath: join(getUserRuntimeRoot(), hash, CAPSULE_FILE_NAME),
    eventsPath: join(getUserRuntimeRoot(), hash, EVENTS_FILE_NAME),
    artifactsDir: join(getUserRuntimeRoot(), hash, PROJECT_ARTIFACTS_DIR_NAME),
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
  return join(getRuntimeScope(cwd, options).sessionDir, fileName)
}

export function getProjectEventsPath(cwd, options = {}) {
  const scope = getProjectSessionScope(cwd, options)
  return scope.active ? scope.eventsPath : ''
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

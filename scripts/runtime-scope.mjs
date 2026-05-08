import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

import { resolveSessionToken } from './session-token.mjs'
import { USER_RUNTIME_MAX_AGE_MS } from './runtime-ttl.mjs'
import { cleanupUserRuntimeRoot, getUserRuntimeRoot } from './runtime-user-cleanup.mjs'

export const PROJECT_DIR_NAME = '.helloagents'
export const PROJECT_SESSIONS_DIR_NAME = 'sessions'
export const PROJECT_ARTIFACTS_DIR_NAME = 'artifacts'
export const CAPSULE_FILE_NAME = 'capsule.json'
export const EVENTS_FILE_NAME = 'events.jsonl'
export const ACTIVE_SESSION_FILE_NAME = 'active.json'
export const DEFAULT_STATE_SESSION_TOKEN = 'default'
export const USER_RUNTIME_DIR_NAME = 'runtime'
export { cleanupUserRuntimeRoot, getUserRuntimeRoot, USER_RUNTIME_MAX_AGE_MS }

const gitTopLevelCache = new Map()
const gitBranchNameCache = new Map()
const gitShortHeadCache = new Map()
const workspaceNameCache = new Map()
let userRuntimeCleanupDone = false

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

function readCachedValue(cache, key, loader) {
  if (cache.has(key)) return cache.get(key)
  const value = loader()
  cache.set(key, value)
  return value
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
  const normalizedCwd = normalizePath(cwd || process.cwd())
  return readCachedValue(gitTopLevelCache, normalizedCwd, () => {
    const absolute = runGit(normalizedCwd, ['rev-parse', '--path-format=absolute', '--show-toplevel'])
    if (absolute) return normalize(resolve(absolute))

    const raw = runGit(normalizedCwd, ['rev-parse', '--show-toplevel'])
    return raw ? normalize(resolve(normalizedCwd, raw)) : ''
  })
}

function resolveGitBranchName(cwd) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  return readCachedValue(gitBranchNameCache, normalizedCwd, () => {
    const branchName = runGit(normalizedCwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
    if (branchName && branchName !== 'HEAD') return branchName

    const symbolicName = runGit(normalizedCwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    return symbolicName && symbolicName !== 'HEAD' ? symbolicName : ''
  })
}

function resolveGitShortHead(cwd) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  return readCachedValue(gitShortHeadCache, normalizedCwd, () =>
    runGit(normalizedCwd, ['rev-parse', '--short', 'HEAD']))
}

function resolveWorkspaceName(cwd) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  return readCachedValue(workspaceNameCache, normalizedCwd, () => {
    const branchName = resolveGitBranchName(normalizedCwd)
    if (branchName) return sanitizeRuntimeSegment(branchName, 'workspace')

    if (resolveGitTopLevel(normalizedCwd)) {
      const shortHead = sanitizeRuntimeSegment(resolveGitShortHead(normalizedCwd), '')
      return shortHead ? `detached-${shortHead}` : 'detached'
    }

    return 'workspace'
  })
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

function resolvePayloadSessionToken(payload = {}) {
  if (payload?._helloagentsSessionAlias) return ''
  return resolveSessionToken({
    payload,
    env: {},
    ppid: 0,
    allowPpidFallback: false,
  })
}

function resolveEnvSessionToken(env = process.env) {
  return resolveSessionToken({
    payload: {},
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

function getActiveSessionPath(activationDir) {
  return join(activationDir, PROJECT_SESSIONS_DIR_NAME, ACTIVE_SESSION_FILE_NAME)
}

function resolveActiveSessionToken({ activationDir, projectRoot, workspace, now = Date.now() } = {}) {
  const active = readJsonFile(getActiveSessionPath(activationDir), null)
  if (!active || typeof active !== 'object') return ''
  if (active.cwd && !samePath(active.cwd, projectRoot)) return ''

  const activeWorkspace = sanitizeRuntimeSegment(active.workspace || active.branch || '', '')
  if (activeWorkspace && activeWorkspace !== workspace) return ''

  const updatedAt = Date.parse(active.updatedAt || '')
  if (!Number.isFinite(updatedAt) || now - updatedAt > USER_RUNTIME_MAX_AGE_MS) return ''

  return sanitizeRuntimeSegment(active.session, '')
}

function resolveActiveAliasSession({ activationDir, projectRoot, workspace, alias, now = Date.now() } = {}) {
  if (!alias) return ''
  const active = readJsonFile(getActiveSessionPath(activationDir), null)
  if (!active || typeof active !== 'object') return ''
  if (active.cwd && !samePath(active.cwd, projectRoot)) return ''

  const activeWorkspace = sanitizeRuntimeSegment(active.workspace || active.branch || '', '')
  if (activeWorkspace && activeWorkspace !== workspace) return ''

  const updatedAt = Date.parse(active.updatedAt || '')
  if (!Number.isFinite(updatedAt) || now - updatedAt > USER_RUNTIME_MAX_AGE_MS) return ''

  const aliases = active.aliases && typeof active.aliases === 'object' ? active.aliases : {}
  return sanitizeRuntimeSegment(aliases[alias], '')
}

export function writeActiveProjectSession(scope, { host = '', source = '', env = process.env } = {}) {
  if (!scope?.active || !scope.activationDir || !scope.session) return ''

  const activePath = getActiveSessionPath(scope.activationDir)
  const current = readJsonFile(activePath, null) || {}
  const aliases = current.aliases && typeof current.aliases === 'object' ? current.aliases : {}
  const envToken = sanitizeRuntimeSegment(resolveEnvSessionToken(env), '')
  if (envToken && envToken !== scope.session) aliases[envToken] = scope.session

  writeJsonFileAtomic(activePath, {
    version: 1,
    cwd: scope.cwd,
    workspace: scope.workspace || scope.branch,
    session: scope.session,
    sessionMode: scope.sessionMode,
    host,
    source,
    aliases,
    updatedAt: new Date().toISOString(),
  })
  return activePath
}

function chooseProjectSession({ payload, env, activationDir, projectRoot, workspace }) {
  const payloadToken = sanitizeRuntimeSegment(resolvePayloadSessionToken(payload), '')
  if (payloadToken) return { session: payloadToken, sessionMode: 'host-session' }

  const payloadAlias = sanitizeRuntimeSegment(payload?._helloagentsSessionAlias, '')
  const payloadAliasToken = resolveActiveAliasSession({
    activationDir,
    projectRoot,
    workspace,
    alias: payloadAlias,
  })
  if (payloadAliasToken) return { session: payloadAliasToken, sessionMode: 'active-session' }

  const envToken = sanitizeRuntimeSegment(resolveEnvSessionToken(env), '')
  const aliasToken = resolveActiveAliasSession({
    activationDir,
    projectRoot,
    workspace,
    alias: envToken,
  })
  if (aliasToken) return { session: aliasToken, sessionMode: 'active-session' }

  if (envToken) return { session: envToken, sessionMode: 'host-session' }

  const activeToken = resolveActiveSessionToken({ activationDir, projectRoot, workspace })
  if (activeToken) return { session: activeToken, sessionMode: 'active-session' }

  return { session: DEFAULT_STATE_SESSION_TOKEN, sessionMode: 'default' }
}

export function getProjectSessionScope(cwd, options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const projectRoot = getProjectRoot(normalizedCwd)
  const { payload = {}, env = process.env } = normalizeRuntimeOptions(options)
  const activationDir = getProjectActivationDir(projectRoot)
  const workspace = resolveWorkspaceName(projectRoot)
  const { session, sessionMode } = chooseProjectSession({
    payload,
    env,
    activationDir,
    projectRoot,
    workspace,
  })
  const sessionDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME, workspace, session)

  return {
    cwd: projectRoot,
    active: isProjectRuntimeActive(projectRoot),
    branch: workspace,
    workspace,
    session,
    sessionMode,
    activationDir,
    sessionDir,
    statePath: join(sessionDir, 'STATE.md'),
    capsulePath: join(sessionDir, CAPSULE_FILE_NAME),
    eventsPath: join(sessionDir, EVENTS_FILE_NAME),
    artifactsDir: join(sessionDir, PROJECT_ARTIFACTS_DIR_NAME),
    key: `${projectRoot}::${workspace}::${session}`,
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
  if (!userRuntimeCleanupDone) {
    cleanupUserRuntimeRoot()
    userRuntimeCleanupDone = true
  }

  return {
    cwd: normalizedCwd,
    branch: 'transient',
    workspace: 'transient',
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

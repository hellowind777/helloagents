import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

import {
  PROJECT_CONVERSATION_PAYLOAD_KEYS,
  PROJECT_SESSION_PAYLOAD_KEYS,
  PROJECT_THREAD_PAYLOAD_KEYS,
  resolveProjectSessionAliasToken,
  resolveProjectSessionToken,
  resolveSessionToken,
  sanitizeSessionToken,
} from './session-token.mjs'
import { USER_RUNTIME_MAX_AGE_MS } from './runtime-ttl.mjs'
import { cleanupUserRuntimeRoot, getUserRuntimeRoot } from './runtime-user-cleanup.mjs'
import { FULL_CARRIER_PROFILE_MARKER } from './cli-utils.mjs'

export const PROJECT_DIR_NAME = '.helloagents'
export const PROJECT_SESSIONS_DIR_NAME = 'sessions'
export const PROJECT_ARTIFACTS_DIR_NAME = 'artifacts'
export const EVENTS_FILE_NAME = 'events.jsonl'
export const ACTIVE_SESSION_FILE_NAME = 'active.json'
export const PROJECT_RUNTIME_FILE_NAME = 'runtime.json'
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

function getCarrierPathForRoot(root, host = '') {
  if (!root) return ''
  if (host === 'codex') return join(root, 'AGENTS.md')
  if (host === 'gemini') return join(root, '.gemini', 'GEMINI.md')
  return join(root, 'CLAUDE.md')
}

function getCarrierCandidatePaths(root, host = '', { anyHost = false } = {}) {
  if (!root) return []
  if (!anyHost) return [getCarrierPathForRoot(root, host)]
  return [
    join(root, 'AGENTS.md'),
    join(root, 'CLAUDE.md'),
    join(root, '.gemini', 'GEMINI.md'),
  ]
}

function hasFullCarrierMarker(filePath = '') {
  if (!filePath || !existsSync(filePath)) return false
  try {
    return readFileSync(filePath, 'utf-8').includes(FULL_CARRIER_PROFILE_MARKER)
  } catch {
    return false
  }
}

function findProjectCarrierRoot(cwd, host = '', options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const gitRoot = resolveGitTopLevel(normalizedCwd)
  const requireFullProfile = options.requireFullProfile === true
  const anyHost = options.anyHost === true
  let current = normalizedCwd

  while (current) {
    const candidates = getCarrierCandidatePaths(current, host, { anyHost })
    const matched = candidates.some((filePath) =>
      requireFullProfile ? hasFullCarrierMarker(filePath) : existsSync(filePath))
    if (matched) return current
    if (isUserHomeDir(current)) break
    if (gitRoot && samePath(current, gitRoot)) break

    const parent = dirname(current)
    if (!parent || parent === current) break
    current = parent
  }

  return ''
}

export function getProjectLocalRoot(cwd) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const activeDir = findProjectActivationDir(normalizedCwd)
  if (activeDir) return dirname(activeDir)

  const fullCarrierRoot = findProjectCarrierRoot(normalizedCwd, '', {
    anyHost: true,
    requireFullProfile: true,
  })
  return fullCarrierRoot || resolveGitTopLevel(normalizedCwd) || normalizedCwd
}

export function getProjectLocalDir(cwd) {
  return join(getProjectLocalRoot(cwd), PROJECT_DIR_NAME)
}

export function getProjectCarrierRoot(cwd) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  return findProjectCarrierRoot(normalizedCwd, '', { anyHost: true })
    || resolveGitTopLevel(normalizedCwd)
    || getProjectRoot(normalizedCwd)
}

export function getProjectCarrierPath(cwd, host = '') {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const carrierRoot = findProjectCarrierRoot(normalizedCwd, host, {
    requireFullProfile: true,
  }) || findProjectCarrierRoot(normalizedCwd, host)
    || getProjectCarrierRoot(normalizedCwd)
  return getCarrierPathForRoot(carrierRoot, host)
}

export function hasProjectFullCarrier(cwd, host = '') {
  const carrierPath = getProjectCarrierPath(cwd, host)
  return hasFullCarrierMarker(carrierPath)
}

function buildInitialStateSnapshot({
  goal = '继续当前非只读任务',
  doing = '已进入当前任务执行流程',
  context = '由运行时自动创建；后续按实际任务重写',
  next = '根据当前用户请求继续执行，并按实际任务重写本状态文件',
} = {}) {
  return [
    '# 恢复快照',
    '',
    '## 主线目标',
    goal,
    '',
    '## 正在做什么',
    doing,
    '',
    '## 关键上下文',
    context,
    '',
    '## 下一步',
    next,
    '',
    '## 阻塞项',
    '（无）',
    '',
    '## 方案',
    '',
    '## 已标记技能',
    '',
  ].join('\n')
}

export function ensureProjectLocalRuntime(cwd, options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const localDir = getProjectLocalDir(normalizedCwd)
  mkdirSync(localDir, { recursive: true })

  const scope = getProjectSessionScope(normalizedCwd, options)
  mkdirSync(dirname(scope.statePath), { recursive: true })

  if (!existsSync(scope.statePath)) {
    writeFileSync(scope.statePath, `${buildInitialStateSnapshot(options.stateSeed || {})}\n`, 'utf-8')
  }

  return scope
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
  return resolveProjectSessionToken({
    payload,
    env: {},
  })
}

function readRawPayloadValue(payload = {}, key = '') {
  if (!payload || typeof payload !== 'object') return ''
  const value = payload[key]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function readPayloadSessionIdentity(payload = {}) {
  const groups = [
    ['session', PROJECT_SESSION_PAYLOAD_KEYS],
    ['conversation', PROJECT_CONVERSATION_PAYLOAD_KEYS],
    ['thread', PROJECT_THREAD_PAYLOAD_KEYS],
  ]

  for (const [kind, keys] of groups) {
    for (const key of keys) {
      const value = sanitizeRuntimeSegment(sanitizeSessionToken(readRawPayloadValue(payload, key)), '')
      if (value) return { kind, token: value }
    }
  }

  return { kind: '', token: '' }
}

function resolveEnvSessionToken(env = process.env) {
  return resolveProjectSessionToken({ payload: {}, env })
}

function resolveEnvSessionAliasToken(env = process.env) {
  return resolveProjectSessionAliasToken({ env })
}

function resolveProjectSessionHostHint({ env = process.env, ppid = process.ppid } = {}) {
  const envToken = sanitizeRuntimeSegment(resolveEnvSessionToken(env), '')
  if (envToken) return `host:${envToken}`

  const envAliasToken = sanitizeRuntimeSegment(resolveEnvSessionAliasToken(env), '')
  if (envAliasToken) return `alias:${envAliasToken}`

  const parentToken = sanitizeRuntimeSegment(String(ppid || '').trim(), '')
  return parentToken ? `ppid:${parentToken}` : ''
}

function resolveTransientSessionToken({ payload = {}, env = process.env, ppid = process.ppid } = {}) {
  return resolveSessionToken({
    payload,
    env,
    ppid,
    allowPpidFallback: true,
  })
}

function buildScopedSessionToken(kind = '', raw = '') {
  const normalizedKind = sanitizeRuntimeSegment(kind, 'session')
  const value = sanitizeRuntimeSegment(String(raw || '').trim(), '')
  if (!value) return ''
  return `${normalizedKind}-${value}`
}

function buildSessionAliasKeys({ payload = {}, env = process.env } = {}) {
  const keys = []
  const payloadIdentity = readPayloadSessionIdentity(payload)
  if (payloadIdentity.token) {
    keys.push(`${payloadIdentity.kind}:${payloadIdentity.token}`)
  }

  const envSession = sanitizeRuntimeSegment(resolveEnvSessionToken(env), '')
  if (envSession && !payloadIdentity.token) keys.push(`host:${envSession}`)

  const payloadAlias = sanitizeRuntimeSegment(sanitizeSessionToken(payload?._helloagentsSessionAlias), '')
  if (payloadAlias) keys.push(`alias:${payloadAlias}`)

  const envAlias = sanitizeRuntimeSegment(resolveEnvSessionAliasToken(env), '')
  if (envAlias && envSession && envAlias === envSession) {
    return [...new Set(keys.filter(Boolean))]
  }
  if (envAlias) keys.push(`alias:${envAlias}`)

  return [...new Set(keys.filter(Boolean))]
}

function getActiveSessionPath(activationDir) {
  return join(activationDir, PROJECT_SESSIONS_DIR_NAME, ACTIVE_SESSION_FILE_NAME)
}

function readActiveProjectSession({ activationDir, projectRoot, workspace, now = Date.now() } = {}) {
  const active = readJsonFile(getActiveSessionPath(activationDir), null)
  if (!active || typeof active !== 'object') return ''
  if (active.cwd && !samePath(active.cwd, projectRoot)) return ''

  const activeWorkspace = sanitizeRuntimeSegment(active.workspace || active.branch || '', '')
  if (activeWorkspace && activeWorkspace !== workspace) return ''

  const updatedAt = Date.parse(active.updatedAt || '')
  if (!Number.isFinite(updatedAt) || now - updatedAt > USER_RUNTIME_MAX_AGE_MS) return ''

  return active
}

function resolveActiveAliasSession({ activationDir, projectRoot, workspace, alias, now = Date.now() } = {}) {
  if (!alias) return ''
  const active = readActiveProjectSession({
    activationDir,
    projectRoot,
    workspace,
    now,
  })
  if (!active || typeof active !== 'object') return ''

  const aliases = active.aliases && typeof active.aliases === 'object' ? active.aliases : {}
  const mapped = sanitizeRuntimeSegment(aliases[alias], '')
  if (mapped) return mapped
  if (
    Object.prototype.hasOwnProperty.call(aliases, alias)
    && resolveActiveSessionToken(active, join(activationDir, PROJECT_SESSIONS_DIR_NAME, workspace)) === DEFAULT_STATE_SESSION_TOKEN
  ) {
    return DEFAULT_STATE_SESSION_TOKEN
  }
  return ''
}

function choosePreferredProjectSession(activeSession = '', candidates = []) {
  for (const candidate of candidates) {
    if (!candidate) continue
    if (activeSession && candidate === activeSession) return candidate
  }
  return candidates.find(Boolean) || ''
}

function resolveActiveSessionToken(active = {}, workspaceDir = '') {
  const session = sanitizeRuntimeSegment(active?.session || '', '')
  if (session) return session

  const defaultStatePath = workspaceDir
    ? join(workspaceDir, DEFAULT_STATE_SESSION_TOKEN, 'STATE.md')
    : ''
  return defaultStatePath && existsSync(defaultStatePath)
    ? DEFAULT_STATE_SESSION_TOKEN
    : ''
}

export function writeActiveProjectSession(scope, { host = '', source = '', payload = {}, env = process.env, ppid = process.ppid } = {}) {
  if (!scope?.active || !scope.activationDir || !scope.workspace) return ''

  const activePath = getActiveSessionPath(scope.activationDir)
  const current = readJsonFile(activePath, null) || {}
  const aliases = current.aliases && typeof current.aliases === 'object' ? { ...current.aliases } : {}
  const session = scope.session || DEFAULT_STATE_SESSION_TOKEN
  const sessionMode = scope.session
    ? scope.sessionMode
    : 'default'
  const hostHint = resolveProjectSessionHostHint({ env, ppid }) || current.hostHint || ''
  const aliasKeys = buildSessionAliasKeys({ payload, env })
  for (const aliasKey of aliasKeys) {
    aliases[aliasKey] = session
    const [, aliasValue = ''] = String(aliasKey).split(':')
    if (aliasValue) aliases[aliasValue] = session
  }
  writeJsonFileAtomic(activePath, {
    version: 1,
    cwd: scope.cwd,
    workspace: scope.workspace || scope.branch,
    session,
    sessionMode,
    host,
    source,
    ...(hostHint ? { hostHint } : {}),
    aliases,
    ...(current.cleanupCheckedAt ? { cleanupCheckedAt: current.cleanupCheckedAt } : {}),
    updatedAt: new Date().toISOString(),
  })
  return activePath
}

function chooseProjectSession({ payload, env, ppid, activationDir, projectRoot, workspace }) {
  const workspaceDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME, workspace)
  const active = readActiveProjectSession({
    activationDir,
    projectRoot,
    workspace,
  })
  const activeSession = resolveActiveSessionToken(active, workspaceDir)
  const payloadIdentity = readPayloadSessionIdentity(payload)
  const payloadToken = payloadIdentity.token
  const payloadAlias = sanitizeRuntimeSegment(sanitizeSessionToken(payload?._helloagentsSessionAlias), '')
  const payloadAliases = [
    payloadIdentity.token ? `${payloadIdentity.kind}:${payloadIdentity.token}` : '',
    payloadAlias ? `alias:${payloadAlias}` : '',
  ].filter(Boolean)
  const payloadMappedSession = choosePreferredProjectSession(
    activeSession,
    payloadAliases.map((alias) => resolveActiveAliasSession({
      activationDir,
      projectRoot,
      workspace,
      alias,
    })),
  )
  if (payloadMappedSession) {
    return { session: payloadMappedSession, sessionMode: 'active-session' }
  }

  const envToken = sanitizeRuntimeSegment(resolveEnvSessionToken(env), '')
  const envAliasToken = sanitizeRuntimeSegment(resolveEnvSessionAliasToken(env), '')
  const envMappedSession = choosePreferredProjectSession(
    activeSession,
    [
      envToken ? resolveActiveAliasSession({
        activationDir,
        projectRoot,
        workspace,
        alias: `host:${envToken}`,
      }) : '',
      envAliasToken ? resolveActiveAliasSession({
        activationDir,
        projectRoot,
        workspace,
        alias: `alias:${envAliasToken}`,
      }) : '',
    ],
  )
  if (envMappedSession) return { session: envMappedSession, sessionMode: 'active-session' }

  if (
    activeSession === DEFAULT_STATE_SESSION_TOKEN
    && active?.hostHint
    && active.hostHint === resolveProjectSessionHostHint({ env, ppid })
    && (payloadToken || payloadAlias || envToken || envAliasToken)
  ) {
    return {
      session: activeSession,
      sessionMode: 'active-session',
    }
  }

  if (payloadToken) {
    return {
      session: buildScopedSessionToken('host', payloadToken),
      sessionMode: 'host-session',
    }
  }
  if (payloadAlias) {
    return {
      session: buildScopedSessionToken('alias', payloadAlias),
      sessionMode: 'alias-session',
    }
  }

  if (envToken) {
    return {
      session: buildScopedSessionToken('host', envToken),
      sessionMode: 'host-session',
    }
  }

  if (envAliasToken) {
    return {
      session: buildScopedSessionToken('alias', envAliasToken),
      sessionMode: 'alias-session',
    }
  }

  const source = String(payload?.source || '').trim().toLowerCase()
  if ((source === 'resume' || source === 'compact') && activeSession) {
    return {
      session: activeSession,
      sessionMode: 'active-session',
    }
  }

  return { session: '', sessionMode: 'unidentified' }
}

export function getProjectSessionScope(cwd, options = {}) {
  const normalizedCwd = normalizePath(cwd || process.cwd())
  const projectRoot = getProjectRoot(normalizedCwd)
  const { payload = {}, env = process.env, ppid = process.ppid } = normalizeRuntimeOptions(options)
  const activationDir = getProjectActivationDir(projectRoot)
  const workspace = resolveWorkspaceName(projectRoot)
  const { session, sessionMode } = chooseProjectSession({
    payload,
    env,
    ppid,
    activationDir,
    projectRoot,
    workspace,
  })
  const workspaceDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME, workspace)
  const sessionDir = session ? join(workspaceDir, session) : join(workspaceDir, DEFAULT_STATE_SESSION_TOKEN)

  return {
    cwd: projectRoot,
    active: isProjectRuntimeActive(projectRoot),
    branch: workspace,
    workspace,
    session,
    sessionMode,
    activationDir,
    sessionDir,
    workspaceDir,
    statePath: join(sessionDir, 'STATE.md'),
    eventsPath: join(sessionDir, EVENTS_FILE_NAME),
    artifactsDir: join(sessionDir, PROJECT_ARTIFACTS_DIR_NAME),
    runtimePath: join(sessionDir, PROJECT_RUNTIME_FILE_NAME),
    key: `${projectRoot}::${workspace}::${session || DEFAULT_STATE_SESSION_TOKEN}`,
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
    statePath: join(getUserRuntimeRoot(), hash, 'STATE.md'),
    eventsPath: join(getUserRuntimeRoot(), hash, EVENTS_FILE_NAME),
    artifactsDir: join(getUserRuntimeRoot(), hash, PROJECT_ARTIFACTS_DIR_NAME),
    runtimePath: join(getUserRuntimeRoot(), hash, PROJECT_RUNTIME_FILE_NAME),
    key: `${normalizedCwd}::transient::${token}`,
  }
}

export function getRuntimeScope(cwd = process.cwd(), options = {}) {
  const normalizedOptions = normalizeRuntimeOptions(options)
  if (normalizedOptions.ensureProjectLocal === true) {
    return {
      ...ensureProjectLocalRuntime(cwd, normalizedOptions),
      active: true,
      scope: 'project-session',
    }
  }

  const projectScope = getProjectSessionScope(cwd, normalizedOptions)
  if (projectScope.active) {
    return {
      ...projectScope,
      scope: 'project-session',
    }
  }

  return {
    ...buildTransientRuntimeDir(cwd, normalizedOptions),
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

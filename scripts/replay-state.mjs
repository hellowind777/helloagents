import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

const RUNTIME_DIR = join(homedir(), '.helloagents', 'runtime')
const REPLAY_CONTEXT_PATH = join(RUNTIME_DIR, 'replay-context.json')
const REPLAY_SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_REPLAY_SESSIONS = 3

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function ensureRuntimeDir() {
  mkdirSync(dirname(REPLAY_CONTEXT_PATH), { recursive: true })
}

function readReplayContext() {
  try {
    return JSON.parse(readFileSync(REPLAY_CONTEXT_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeReplayContext(context) {
  ensureRuntimeDir()
  writeFileSync(REPLAY_CONTEXT_PATH, `${JSON.stringify(context, null, 2)}\n`, 'utf-8')
}

function getReplayKey(cwd, host = '') {
  return `${normalizePath(cwd)}::${host || 'unknown'}`
}

function findLatestReplaySession(context, cwd) {
  const normalizedCwd = normalizePath(cwd)
  const entries = Object.values(context)
    .filter((entry) => entry?.cwd === normalizedCwd && entry.filePath && existsSync(entry.filePath))
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
  return entries[0] || null
}

function getProjectRoot(cwd) {
  const projectRoot = join(cwd, '.helloagents')
  return existsSync(projectRoot) ? projectRoot : ''
}

export function getReplayDir(cwd) {
  const projectRoot = getProjectRoot(cwd)
  return projectRoot ? join(projectRoot, 'replay') : ''
}

function ensureReplayDir(cwd) {
  const replayDir = getReplayDir(cwd)
  if (!replayDir) return ''
  mkdirSync(replayDir, { recursive: true })
  return replayDir
}

function listReplaySessionFiles(replayDir) {
  if (!replayDir || !existsSync(replayDir)) return []
  return readdirSync(replayDir)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
}

function trimReplaySessions(replayDir) {
  const files = listReplaySessionFiles(replayDir)
  const staleFiles = files.slice(0, Math.max(0, files.length - MAX_REPLAY_SESSIONS))
  for (const fileName of staleFiles) {
    rmSync(join(replayDir, fileName), { force: true })
  }
}

function sanitizeReplayValue(value) {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim().slice(0, 280)
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .map((entry) => sanitizeReplayValue(entry))
      .filter((entry) => entry !== '' && entry !== undefined)
  }
  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, entry] of Object.entries(value)) {
      const sanitized = sanitizeReplayValue(entry)
      if (
        sanitized === ''
        || sanitized === undefined
        || sanitized === null
        || (Array.isArray(sanitized) && sanitized.length === 0)
        || (typeof sanitized === 'object' && !Array.isArray(sanitized) && Object.keys(sanitized).length === 0)
      ) {
        continue
      }
      output[key] = sanitized
    }
    return output
  }
  return value
}

function getReplaySession(cwd, { host = '', create = false, reset = false } = {}) {
  const replayDir = ensureReplayDir(cwd)
  if (!replayDir) return null

  const key = getReplayKey(cwd, host)
  const context = readReplayContext()
  const current = context[key] || (!host ? findLatestReplaySession(context, cwd) : null)
  const isExpired = !current?.updatedAt || (Date.now() - current.updatedAt > REPLAY_SESSION_TTL_MS)
  const isMissing = !current?.filePath || !existsSync(current.filePath)

  if (!reset && !isExpired && !isMissing) {
    context[key] = {
      ...current,
      updatedAt: Date.now(),
    }
    writeReplayContext(context)
    return context[key]
  }

  if (!create) return null

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const suffix = Math.random().toString(36).slice(2, 8)
  const sessionId = `${stamp}-${host || 'unknown'}-${suffix}`
  const filePath = join(replayDir, `${sessionId}.jsonl`)
  const next = {
    cwd: normalizePath(cwd),
    host: host || 'unknown',
    sessionId,
    filePath,
    updatedAt: Date.now(),
  }
  context[key] = next
  writeReplayContext(context)
  return next
}

function buildReplayRecommendation(recommendation) {
  if (!recommendation) return {}
  return {
    nextCommand: recommendation.nextCommand,
    nextPath: recommendation.nextPath,
    stage: recommendation.stage || '',
    status: recommendation.status || '',
    planName: recommendation.plan?.planName || '',
    summary: recommendation.summary || '',
  }
}

export function startReplaySession(cwd, {
  host = '',
  source = 'startup',
  bootstrapFile = '',
  installMode = '',
} = {}) {
  const session = getReplaySession(cwd, { host, create: true, reset: true })
  if (!session) return ''

  appendReplayEvent(cwd, {
    host,
    event: 'session_started',
    source,
    bootstrapFile,
    installMode,
    sessionId: session.sessionId,
  })
  return session.filePath
}

export function appendReplayEvent(cwd, {
  host = '',
  event = '',
  source = '',
  skillName = '',
  sourceSkillName = '',
  recommendation = null,
  reason = '',
  artifacts = [],
  details = {},
  sessionId = '',
} = {}) {
  if (!event) return ''
  const session = getReplaySession(cwd, { host, create: true })
  if (!session?.filePath) return ''

  const payload = sanitizeReplayValue({
    ts: new Date().toISOString(),
    event,
    host: host || session.host,
    source,
    sessionId: sessionId || session.sessionId,
    skillName,
    sourceSkillName,
    recommendation: buildReplayRecommendation(recommendation),
    reason,
    artifacts,
    details,
  })

  writeFileSync(session.filePath, `${JSON.stringify(payload)}\n`, {
    encoding: 'utf-8',
    flag: 'a',
  })
  trimReplaySessions(getReplayDir(cwd))
  return session.filePath
}

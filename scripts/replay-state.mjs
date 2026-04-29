import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getProjectReplayDir,
  getProjectSessionScope,
} from './runtime-scope.mjs'

const REPLAY_FILE_NAME = 'events.jsonl'

export function getReplayDir(cwd, options = {}) {
  return getProjectReplayDir(cwd, options)
}

function getReplayFilePath(cwd, options = {}) {
  const replayDir = getReplayDir(cwd, options)
  return replayDir ? join(replayDir, REPLAY_FILE_NAME) : ''
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
  payload = {},
  env,
  ppid,
} = {}) {
  const filePath = getReplayFilePath(cwd, { payload, env, ppid })
  if (!filePath) return ''

  mkdirSync(getReplayDir(cwd, { payload, env, ppid }), { recursive: true })
  writeFileSync(filePath, '', 'utf-8')
  appendReplayEvent(cwd, {
    host,
    event: 'session_started',
    source,
    bootstrapFile,
    installMode,
    payload,
    env,
    ppid,
  })
  return filePath
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
  payload = {},
  env,
  ppid,
} = {}) {
  if (!event) return ''

  const filePath = getReplayFilePath(cwd, { payload, env, ppid })
  if (!filePath) return ''

  const scope = getProjectSessionScope(cwd, { payload, env, ppid })
  mkdirSync(getReplayDir(cwd, { payload, env, ppid }), { recursive: true })

  const eventPayload = sanitizeReplayValue({
    ts: new Date().toISOString(),
    event,
    host: host || 'unknown',
    source,
    sessionId: sessionId || scope.session,
    skillName,
    sourceSkillName,
    recommendation: buildReplayRecommendation(recommendation),
    reason,
    artifacts,
    details,
  })

  writeFileSync(filePath, `${JSON.stringify(eventPayload)}\n`, {
    encoding: 'utf-8',
    flag: existsSync(filePath) ? 'a' : 'w',
  })
  return filePath
}

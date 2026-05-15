import { dirname } from 'node:path'

import {
  appendSessionEvent,
  getRuntimeScope,
  getSessionEventsPath,
  resetSessionEvents,
} from './session-capsule.mjs'
import { ensureProjectLocalRuntime, getProjectSessionScope } from './runtime-scope.mjs'

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

export function getReplayDir(cwd, options = {}) {
  const eventPath = getSessionEventsPath(cwd, options)
  return eventPath ? dirname(eventPath) : ''
}

export function startReplaySession(cwd, {
  host = '',
  source = 'startup',
  bootstrapFile = '',
  installMode = '',
  payload = {},
  ensureProjectLocal = false,
  env,
  ppid,
} = {}) {
  const scope = ensureProjectLocal
    ? {
      ...ensureProjectLocalRuntime(cwd, {
        payload,
        env,
        ppid,
        stateSeed: {
          goal: '进入当前项目级执行流程',
          doing: '正在初始化当前会话运行态',
          context: '由运行时自动创建；后续按实际任务重写',
          next: '根据当前用户请求继续执行当前流程',
        },
      }),
      active: true,
      scope: 'project-session',
    }
    : getProjectSessionScope(cwd, { payload, env, ppid })
  if (!scope.active) return ''

  const filePath = resetSessionEvents(cwd, { payload, env, ppid })
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
  const scope = getRuntimeScope(cwd, { payload, env, ppid })
  if (scope.scope !== 'project-session' || !scope.active || !event) return ''

  return appendSessionEvent(cwd, sanitizeReplayValue({
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
  }), { payload, env, ppid })
}

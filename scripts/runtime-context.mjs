import { normalize, resolve } from 'node:path'
import { createHash } from 'node:crypto'

import {
  clearCapsuleSection,
  getRuntimeScope,
  readCapsuleSection,
  writeCapsuleSection,
} from './session-capsule.mjs'
import { ROUTE_CONTEXT_TTL_MS } from './runtime-ttl.mjs'

export const UNBOUND_ROUTE_CONTEXT_TTL_MS = 10 * 60 * 1000

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function normalizeIdentityValue(value) {
  return String(value || '').trim()
}

function extractPayloadIdentity(payload = {}) {
  return {
    sessionId: normalizeIdentityValue(payload.sessionId || payload.session_id || payload['session-id']),
    threadId: normalizeIdentityValue(payload.threadId || payload.thread_id || payload['thread-id']),
    turnId: normalizeIdentityValue(payload.turnId || payload.turn_id || payload['turn-id']),
    goalId: normalizeIdentityValue(payload.goalId || payload.goal_id || payload['goal-id']),
  }
}

function hashPrompt(prompt = '') {
  const text = String(prompt || '').trim()
  if (!text) return ''
  return createHash('sha1').update(text).digest('hex').slice(0, 16)
}

function routeSource(payload = {}) {
  return normalizeIdentityValue(payload.hookEventName || payload.source || payload.type || '')
}

function hasTurnBinding(identity = {}) {
  return Boolean(identity.turnId)
}

function hasAnyIdentity(identity = {}) {
  return Boolean(identity.sessionId || identity.threadId || identity.turnId || identity.goalId)
}

function routeContextMaxAge(context = {}) {
  return hasTurnBinding(context.identity) ? ROUTE_CONTEXT_TTL_MS : UNBOUND_ROUTE_CONTEXT_TTL_MS
}

function identityFieldsMatch(contextIdentity = {}, payloadIdentity = {}) {
  for (const key of ['sessionId', 'threadId', 'turnId', 'goalId']) {
    if (contextIdentity[key] && !payloadIdentity[key]) return false
    if (contextIdentity[key] && payloadIdentity[key] && contextIdentity[key] !== payloadIdentity[key]) return false
  }
  return true
}

function payloadMatchesRouteContext(context = {}, payload = {}) {
  if (!Object.prototype.hasOwnProperty.call(context, 'identity')) return false

  const contextIdentity = context.identity || {}
  if (!hasAnyIdentity(contextIdentity)) return true

  return identityFieldsMatch(contextIdentity, extractPayloadIdentity(payload))
}

function resolvePayload(options = {}) {
  return options.payload && typeof options.payload === 'object' ? options.payload : options
}

export function clearRouteContext(options = {}) {
  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || process.cwd()
  clearCapsuleSection(cwd, 'route', { payload, env: options.env, ppid: options.ppid })
}

export function writeRouteContext({ cwd, skillName, sourceSkillName = skillName, payload = {}, env, ppid }) {
  const scope = getRuntimeScope(cwd, { payload, env, ppid })
  const context = {
    cwd: normalizePath(cwd),
    skillName,
    sourceSkillName,
    zeroSideEffect: skillName === 'idea',
    identity: extractPayloadIdentity(payload),
    source: routeSource(payload),
    promptHash: hashPrompt(payload.prompt),
    scope: scope.scope,
    key: scope.key,
    updatedAt: Date.now(),
  }
  writeCapsuleSection(cwd, 'route', context, { payload, env, ppid })
}

export function readRouteContext(options = {}) {
  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || process.cwd()
  const context = readCapsuleSection(cwd, 'route', { payload, env: options.env, ppid: options.ppid })
  if (!context?.cwd || !context?.skillName || !context?.updatedAt) {
    return null
  }
  if (Date.now() - context.updatedAt > routeContextMaxAge(context)) {
    clearRouteContext({ cwd, payload, env: options.env, ppid: options.ppid })
    return null
  }

  return {
    ...context,
    cwd: normalizePath(context.cwd),
  }
}

export function getApplicableRouteContext({ cwd = '', filePath = '', payload = {}, env, ppid } = {}) {
  const context = readRouteContext({ cwd, payload, env, ppid })
  if (!context) return null
  if (!payloadMatchesRouteContext(context, payload)) return null

  const normalizedCwd = normalizePath(cwd)
  if (normalizedCwd && normalizedCwd === context.cwd) {
    return context
  }

  const normalizedFilePath = normalizePath(filePath)
  if (
    normalizedFilePath
    && (
      normalizedFilePath === context.cwd
      || normalizedFilePath.startsWith(`${context.cwd}\\`)
      || normalizedFilePath.startsWith(`${context.cwd}/`)
    )
  ) {
    return context
  }

  return null
}

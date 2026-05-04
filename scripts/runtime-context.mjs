import { normalize, resolve } from 'node:path'

import {
  clearCapsuleSection,
  getRuntimeScope,
  readCapsuleSection,
  writeCapsuleSection,
} from './session-capsule.mjs'
import { ROUTE_CONTEXT_TTL_MS } from './runtime-ttl.mjs'

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
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
  if (Date.now() - context.updatedAt > ROUTE_CONTEXT_TTL_MS) {
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

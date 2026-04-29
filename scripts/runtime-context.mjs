import { existsSync } from 'node:fs'
import { normalize, resolve } from 'node:path'

import {
  getRuntimeFilePath,
  getRuntimeScope,
  readJsonFile,
  removeRuntimeFile,
  writeJsonFileAtomic,
} from './runtime-scope.mjs'

const ROUTE_CONTEXT_FILE_NAME = 'route-context.json'
const ROUTE_CONTEXT_TTL_MS = 30 * 60 * 1000

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function resolvePayload(options = {}) {
  return options.payload && typeof options.payload === 'object' ? options.payload : options
}

function getRouteContextPath({ cwd = process.cwd(), payload = {}, env, ppid } = {}) {
  return getRuntimeFilePath(cwd, ROUTE_CONTEXT_FILE_NAME, { payload, env, ppid })
}

export function clearRouteContext(options = {}) {
  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || process.cwd()
  removeRuntimeFile(getRouteContextPath({ cwd, payload, env: options.env, ppid: options.ppid }))
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
  writeJsonFileAtomic(getRouteContextPath({ cwd, payload, env, ppid }), context)
}

export function readRouteContext(options = {}) {
  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || process.cwd()
  const filePath = getRouteContextPath({ cwd, payload, env: options.env, ppid: options.ppid })
  if (!existsSync(filePath)) return null

  const context = readJsonFile(filePath, null)
  if (!context?.cwd || !context?.skillName || !context?.updatedAt) {
    removeRuntimeFile(filePath)
    return null
  }
  if (Date.now() - context.updatedAt > ROUTE_CONTEXT_TTL_MS) {
    removeRuntimeFile(filePath)
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

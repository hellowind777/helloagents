import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

import { resolveSessionToken } from './session-token.mjs'

const RUNTIME_DIR = join(homedir(), '.helloagents', 'runtime')
const ROUTE_CONTEXT_PATH = join(RUNTIME_DIR, 'route-context.json')
const ROUTE_CONTEXT_TTL_MS = 30 * 60 * 1000

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function ensureRuntimeDir() {
  mkdirSync(dirname(ROUTE_CONTEXT_PATH), { recursive: true })
}

function readStore() {
  try {
    return JSON.parse(readFileSync(ROUTE_CONTEXT_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeStore(store) {
  const keys = Object.keys(store)
  if (keys.length === 0) {
    rmSync(ROUTE_CONTEXT_PATH, { force: true })
    return
  }

  ensureRuntimeDir()
  writeFileSync(ROUTE_CONTEXT_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf-8')
}

function resolvePayload(options = {}) {
  return options.payload && typeof options.payload === 'object' ? options.payload : options
}

function getRouteContextKey({ cwd = process.cwd(), payload = {}, env = process.env, ppid = process.ppid } = {}) {
  const sessionToken = resolveSessionToken({
    payload,
    env,
    ppid,
    allowPpidFallback: true,
  }) || 'default'
  return `${normalizePath(cwd)}::${sessionToken}`
}

export function clearRouteContext(options = {}) {
  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || ''

  if (!cwd) {
    rmSync(ROUTE_CONTEXT_PATH, { force: true })
    return
  }

  const store = readStore()
  delete store[getRouteContextKey({ cwd, payload, env: options.env, ppid: options.ppid })]
  writeStore(store)
}

export function writeRouteContext({ cwd, skillName, sourceSkillName = skillName, payload = {}, env, ppid }) {
  const store = readStore()
  const key = getRouteContextKey({ cwd, payload, env, ppid })
  const context = {
    cwd: normalizePath(cwd),
    skillName,
    sourceSkillName,
    zeroSideEffect: skillName === 'idea',
    key,
    updatedAt: Date.now(),
  }
  store[key] = context
  writeStore(store)
}

export function readRouteContext(options = {}) {
  if (!existsSync(ROUTE_CONTEXT_PATH)) return null

  const payload = resolvePayload(options)
  const cwd = options.cwd || payload.cwd || process.cwd()
  const key = getRouteContextKey({ cwd, payload, env: options.env, ppid: options.ppid })
  const store = readStore()
  const context = store[key]
  if (!context?.cwd || !context?.skillName || !context?.updatedAt) {
    if (context) {
      delete store[key]
      writeStore(store)
    }
    return null
  }
  if (Date.now() - context.updatedAt > ROUTE_CONTEXT_TTL_MS) {
    delete store[key]
    writeStore(store)
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

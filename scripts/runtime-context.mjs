import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'

const RUNTIME_DIR = join(homedir(), '.helloagents', 'runtime')
const ROUTE_CONTEXT_PATH = join(RUNTIME_DIR, 'route-context.json')
const ROUTE_CONTEXT_TTL_MS = 30 * 60 * 1000

function normalizePath(filePath = '') {
  return filePath ? normalize(resolve(filePath)) : ''
}

function ensureRuntimeDir() {
  mkdirSync(dirname(ROUTE_CONTEXT_PATH), { recursive: true })
}

export function clearRouteContext() {
  rmSync(ROUTE_CONTEXT_PATH, { force: true })
}

export function writeRouteContext({ cwd, skillName, sourceSkillName = skillName }) {
  ensureRuntimeDir()
  const context = {
    cwd: normalizePath(cwd),
    skillName,
    sourceSkillName,
    zeroSideEffect: skillName === 'idea',
    updatedAt: Date.now(),
  }
  writeFileSync(ROUTE_CONTEXT_PATH, `${JSON.stringify(context, null, 2)}\n`, 'utf-8')
}

export function readRouteContext() {
  if (!existsSync(ROUTE_CONTEXT_PATH)) return null

  try {
    const context = JSON.parse(readFileSync(ROUTE_CONTEXT_PATH, 'utf-8'))
    if (!context?.cwd || !context?.skillName || !context?.updatedAt) return null
    if (Date.now() - context.updatedAt > ROUTE_CONTEXT_TTL_MS) {
      clearRouteContext()
      return null
    }
    return {
      ...context,
      cwd: normalizePath(context.cwd),
    }
  } catch {
    return null
  }
}

export function getApplicableRouteContext({ cwd = '', filePath = '' } = {}) {
  const context = readRouteContext()
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

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  ACTIVE_SESSION_FILE_NAME,
  PROJECT_SESSIONS_DIR_NAME,
  getProjectActivationDir,
  getProjectRoot,
  readJsonFile,
  writeJsonFileAtomic,
} from './runtime-scope.mjs'
import { LONG_RUNNING_TTL_MS } from './runtime-ttl.mjs'
import { looksLikeAutoCreatedState, readStateDocument } from './state-document.mjs'

export const PROJECT_SESSION_CLEANUP_COOLDOWN_MS = 10 * 60 * 1000
export const PROJECT_SESSION_MAX_AGE_MS = LONG_RUNNING_TTL_MS
function removePath(filePath, result, bucket) {
  try {
    rmSync(filePath, { recursive: true, force: true })
    result[bucket].push(filePath)
  } catch (error) {
    result.errors.push(`${filePath}: ${error.message}`)
  }
}

function isDirectoryEmptyRecursive(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  if (entries.length === 0) return true
  return entries.every((entry) => {
    const entryPath = join(dirPath, entry.name)
    return entry.isDirectory() && isDirectoryEmptyRecursive(entryPath)
  })
}

function shouldKeepNestedSession(active, workspace, sessionName) {
  const activeWorkspace = active.workspace || active.branch || ''
  const activeSession = active.session || ''
  return activeWorkspace === workspace && activeSession === sessionName
}

function readCleanupCheckedAt(active) {
  const raw = active && typeof active === 'object' ? active.cleanupCheckedAt : ''
  const timestamp = Date.parse(raw || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function writeCleanupCheckpoint(activePath, active, now) {
  if (!active || typeof active !== 'object' || Object.keys(active).length === 0) return
  writeJsonFileAtomic(activePath, {
    ...active,
    cleanupCheckedAt: new Date(now).toISOString(),
  })
}

function hasStateSnapshot(sessionDir) {
  return existsSync(join(sessionDir, 'STATE.md'))
}

function isAutoCreatedSeedSession(sessionDir) {
  const statePath = join(sessionDir, 'STATE.md')
  if (!existsSync(statePath)) return false

  const { body } = readStateDocument(statePath)
  return looksLikeAutoCreatedState(body)
}

function readSessionStateMtimeMs(sessionDir) {
  try {
    return statSync(join(sessionDir, 'STATE.md')).mtimeMs
  } catch {
    return 0
  }
}

function isStaleStateSession(sessionDir, now, maxAgeMs) {
  const mtimeMs = readSessionStateMtimeMs(sessionDir)
  return !Number.isFinite(mtimeMs) || mtimeMs <= 0 || (now - mtimeMs > maxAgeMs)
}

function isTransientSessionTemp(entryName = '') {
  return /^\.[0-9]+-[0-9a-f-]+\.tmp$/i.test(entryName)
}

function cleanupTransientSessionTemps(sessionsDir, result) {
  for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !isTransientSessionTemp(entry.name)) continue
    removePath(join(sessionsDir, entry.name), result, 'removedTempFiles')
  }
}

export function cleanupProjectSessions(cwd, { now = Date.now(), minIntervalMs = 0, maxAgeMs = PROJECT_SESSION_MAX_AGE_MS } = {}) {
  const projectRoot = getProjectRoot(cwd)
  const activationDir = getProjectActivationDir(projectRoot)
  const sessionsDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME)
  const activePath = join(sessionsDir, ACTIVE_SESSION_FILE_NAME)
  const active = readJsonFile(activePath, null) || {}
  const result = {
    sessionsDir,
    removedEmptyDirs: [],
    removedInactiveDirs: [],
    removedNoStateDirs: [],
    removedSeedDirs: [],
    removedTempFiles: [],
    errors: [],
    skipped: false,
  }

  if (!existsSync(sessionsDir)) return result
  if (minIntervalMs > 0) {
    const lastCleanupAt = readCleanupCheckedAt(active)
    if (lastCleanupAt > 0 && now - lastCleanupAt < minIntervalMs) {
      result.skipped = true
      return result
    }
  }

  try {
    cleanupTransientSessionTemps(sessionsDir, result)
  } catch (error) {
    result.errors.push(`${sessionsDir}: ${error.message}`)
  }

  for (const workspaceEntry of readdirSync(sessionsDir, { withFileTypes: true })) {
    if (!workspaceEntry.isDirectory()) continue
    const workspaceDir = join(sessionsDir, workspaceEntry.name)
    try {
      const nestedEntries = readdirSync(workspaceDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      for (const nestedEntry of nestedEntries) {
        const sessionDir = join(workspaceDir, nestedEntry.name)
        if (shouldKeepNestedSession(active, workspaceEntry.name, nestedEntry.name)) continue
        if (isDirectoryEmptyRecursive(sessionDir)) {
          removePath(sessionDir, result, 'removedEmptyDirs')
          continue
        }
        if (!hasStateSnapshot(sessionDir)) {
          removePath(sessionDir, result, 'removedNoStateDirs')
          continue
        }
        if (isAutoCreatedSeedSession(sessionDir)) {
          removePath(sessionDir, result, 'removedSeedDirs')
          continue
        }
        if (isStaleStateSession(sessionDir, now, maxAgeMs)) {
          removePath(sessionDir, result, 'removedInactiveDirs')
        }
      }

      if (isDirectoryEmptyRecursive(workspaceDir)) {
        removePath(workspaceDir, result, 'removedEmptyDirs')
      }
    } catch (error) {
      result.errors.push(`${workspaceDir}: ${error.message}`)
    }
  }

  writeCleanupCheckpoint(activePath, active, now)
  return result
}

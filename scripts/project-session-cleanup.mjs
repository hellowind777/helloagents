import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  ACTIVE_SESSION_FILE_NAME,
  CAPSULE_FILE_NAME,
  EVENTS_FILE_NAME,
  PROJECT_ARTIFACTS_DIR_NAME,
  PROJECT_SESSIONS_DIR_NAME,
  getProjectActivationDir,
  getProjectRoot,
  readJsonFile,
  writeJsonFileAtomic,
} from './runtime-scope.mjs'

export const PROJECT_SESSION_CLEANUP_COOLDOWN_MS = 10 * 60 * 1000

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

function listFilesRecursive(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const entryPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      return listFilesRecursive(entryPath).map((child) => `${entry.name}/${child}`)
    }
    return entry.isFile() ? [entry.name] : []
  })
}

function isRouteOnlySessionDir(sessionDir) {
  if (existsSync(join(sessionDir, 'STATE.md'))) return false
  const files = listFilesRecursive(sessionDir).map((file) => file.replace(/\\/g, '/'))
  if (files.length === 0) return false
  if (!files.includes(`${PROJECT_ARTIFACTS_DIR_NAME}/codex-native-stop.json`)) return false
  return files.every((file) => [
    CAPSULE_FILE_NAME,
    EVENTS_FILE_NAME,
    `${PROJECT_ARTIFACTS_DIR_NAME}/codex-native-stop.json`,
  ].includes(file))
}

function shouldKeepSession(active, workspace, session) {
  const activeWorkspace = active.workspace || active.branch || ''
  return activeWorkspace === workspace && active.session === session
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

export function cleanupProjectSessions(cwd, { now = Date.now(), minIntervalMs = 0 } = {}) {
  const projectRoot = getProjectRoot(cwd)
  const activationDir = getProjectActivationDir(projectRoot)
  const sessionsDir = join(activationDir, PROJECT_SESSIONS_DIR_NAME)
  const activePath = join(sessionsDir, ACTIVE_SESSION_FILE_NAME)
  const active = readJsonFile(activePath, null) || {}
  const result = {
    sessionsDir,
    removedEmptyDirs: [],
    removedRouteOnlyDirs: [],
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

  for (const workspaceEntry of readdirSync(sessionsDir, { withFileTypes: true })) {
    if (!workspaceEntry.isDirectory()) continue
    const workspaceDir = join(sessionsDir, workspaceEntry.name)

    for (const sessionEntry of readdirSync(workspaceDir, { withFileTypes: true })) {
      if (!sessionEntry.isDirectory()) continue
      const sessionDir = join(workspaceDir, sessionEntry.name)
      if (shouldKeepSession(active, workspaceEntry.name, sessionEntry.name)) continue

      try {
        if (isDirectoryEmptyRecursive(sessionDir)) {
          removePath(sessionDir, result, 'removedEmptyDirs')
        } else if (isRouteOnlySessionDir(sessionDir)) {
          removePath(sessionDir, result, 'removedRouteOnlyDirs')
        }
      } catch (error) {
        result.errors.push(`${sessionDir}: ${error.message}`)
      }
    }

    try {
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

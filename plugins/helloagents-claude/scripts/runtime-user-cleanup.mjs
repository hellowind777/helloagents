import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { USER_RUNTIME_MAX_AGE_MS } from './runtime-ttl.mjs'

const PROJECT_DIR_NAME = '.helloagents'
const USER_RUNTIME_DIR_NAME = 'runtime'

function getHomeDir(env = process.env) {
  return env.HOME || env.USERPROFILE || homedir()
}

export function getUserRuntimeRoot(home = getHomeDir()) {
  return join(home, PROJECT_DIR_NAME, USER_RUNTIME_DIR_NAME)
}

function removePathIfExists(filePath, result, bucket) {
  if (!existsSync(filePath)) return
  try {
    rmSync(filePath, { recursive: true, force: true })
    result[bucket].push(filePath)
  } catch (error) {
    result.errors.push(`${filePath}: ${error.message}`)
  }
}

export function cleanupUserRuntimeRoot({
  home = getHomeDir(),
  now = Date.now(),
  maxAgeMs = USER_RUNTIME_MAX_AGE_MS,
} = {}) {
  const root = getUserRuntimeRoot(home)
  const result = {
    root,
    removedExpiredDirs: [],
    errors: [],
  }

  if (!existsSync(root)) return result

  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    result.errors.push(`${root}: ${error.message}`)
    return result
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dirPath = join(root, entry.name)
    try {
      if (now - statSync(dirPath).mtimeMs > maxAgeMs) {
        removePathIfExists(dirPath, result, 'removedExpiredDirs')
      }
    } catch (error) {
      result.errors.push(`${dirPath}: ${error.message}`)
    }
  }

  return result
}

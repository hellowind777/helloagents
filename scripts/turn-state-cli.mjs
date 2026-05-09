#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function normalizePath(filePath = '') {
  const resolved = resolve(filePath)
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

function samePath(left, right) {
  const a = normalizePath(left)
  const b = normalizePath(right)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

const localScriptPath = join(dirname(fileURLToPath(import.meta.url)), 'turn-state.mjs')
const runtimeScriptPath = join(homedir(), '.helloagents', 'helloagents', 'scripts', 'turn-state.mjs')
const scriptPath = existsSync(runtimeScriptPath) && !samePath(runtimeScriptPath, localScriptPath)
  ? runtimeScriptPath
  : localScriptPath

const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: true,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(typeof result.status === 'number' ? result.status : 1)

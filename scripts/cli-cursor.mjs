import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  cleanHooksConfig,
  createLink,
  ensureDir,
  mergeHooksConfig,
  removeLink,
  safeJson,
} from './cli-utils.mjs'

function readCursorHooks(pkgRoot) {
  return safeJson(join(pkgRoot, 'hooks', 'hooks-cursor.json')) || null
}

function writeCursorStandbyHooks(home, pkgRoot) {
  const hooksData = readCursorHooks(pkgRoot)
  if (!hooksData) return false

  const cursorDir = join(home, '.cursor')
  ensureDir(cursorDir)
  mergeHooksConfig(join(cursorDir, 'hooks.json'), hooksData)
  return true
}

export function installCursorStandby(home, pkgRoot) {
  const cursorDir = join(home, '.cursor')
  ensureDir(cursorDir)
  createLink(pkgRoot, join(cursorDir, 'helloagents'))
  writeCursorStandbyHooks(home, pkgRoot)
  return true
}

export function uninstallCursorStandby(home) {
  const cursorDir = join(home, '.cursor')
  if (!existsSync(cursorDir)) return false

  removeLink(join(cursorDir, 'helloagents'))
  cleanHooksConfig(join(cursorDir, 'hooks.json'))
  return true
}

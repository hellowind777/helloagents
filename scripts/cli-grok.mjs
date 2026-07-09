import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  createLink,
  ensureDir,
  injectMarkedContent,
  loadHooksWithCliEntry,
  removeIfExists,
  removeLink,
  removeMarkedContent,
  safeRead,
  safeWrite,
} from './cli-utils.mjs'
import { buildRuntimeCarrier, readCarrierSettings } from './cli-runtime-carrier.mjs'

export const GROK_STANDBY_HOOK_FILE = 'helloagents.json'

function writeStandbyHooks(home, pkgRoot) {
  const hooksData = loadHooksWithCliEntry(pkgRoot, 'hooks-grok.json', '${GROK_PLUGIN_ROOT}')
  if (!hooksData) return false

  const hooksDir = join(home, '.grok', 'hooks')
  ensureDir(hooksDir)
  safeWrite(join(hooksDir, GROK_STANDBY_HOOK_FILE), `${JSON.stringify(hooksData, null, 2)}\n`)
  return true
}

export function installGrokStandby(home, pkgRoot) {
  const grokDir = join(home, '.grok')
  ensureDir(grokDir)

  const bootstrapContent = safeRead(join(pkgRoot, 'bootstrap-lite.md'))
  if (bootstrapContent) {
    injectMarkedContent(
      join(grokDir, 'AGENTS.md'),
      buildRuntimeCarrier(bootstrapContent, readCarrierSettings(home)).trimEnd(),
    )
  }

  createLink(pkgRoot, join(grokDir, 'helloagents'))
  writeStandbyHooks(home, pkgRoot)
  return true
}

export function uninstallGrokStandby(home) {
  const grokDir = join(home, '.grok')
  if (!existsSync(grokDir)) return false

  removeMarkedContent(join(grokDir, 'AGENTS.md'))
  removeLink(join(grokDir, 'helloagents'))
  removeIfExists(join(grokDir, 'hooks', GROK_STANDBY_HOOK_FILE))
  return true
}

import { copyFileSync, existsSync, mkdtempSync, realpathSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { copyEntries, createLink, ensureDir, removeIfExists } from './cli-utils.mjs'

export const RUNTIME_ROOT_ENTRIES = [
  '.claude-plugin',
  '.codex-plugin',
  'assets',
  'bootstrap-lite.md',
  'bootstrap.md',
  'cli.mjs',
  'gemini-extension.json',
  'hooks',
  'install.ps1',
  'install.sh',
  'LICENSE.md',
  'package.json',
  'README.md',
  'README_CN.md',
  'scripts',
  'skills',
  'templates',
]

/** Return the stable per-user runtime copy used by host integrations. */
export function getStableRuntimeRoot(home) {
  return join(home, '.helloagents', 'helloagents')
}

/** Return the Claude local marketplace projection root derived from the shared runtime copy. */
export function getClaudeMarketplaceRoot(home) {
  return join(home, '.helloagents', 'host-projections', 'claude-marketplace')
}

/** Return the Gemini extension projection root derived from the shared runtime copy. */
export function getGeminiExtensionRoot(home) {
  return join(home, '.helloagents', 'host-projections', 'gemini')
}

function normalizePath(path) {
  const resolved = resolve(path)
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

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function retryTransientFs(operation) {
  let lastError
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return operation()
    } catch (error) {
      lastError = error
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error?.code) || attempt === 5) {
        throw error
      }
      wait(40 * (attempt + 1))
    }
  }
  throw lastError
}

function syncRuntimeTree(sourceRoot, targetRoot, { materializeGeminiHooks = false } = {}) {
  const source = resolve(sourceRoot)
  const target = resolve(targetRoot)
  if (samePath(source, target)) {
    return { synced: false, root: target }
  }

  const parent = dirname(target)
  ensureDir(parent)
  const staging = mkdtempSync(join(parent, '.helloagents-runtime-'))

  try {
    copyEntries(source, staging, RUNTIME_ROOT_ENTRIES)
    if (materializeGeminiHooks) {
      const sourceHooks = join(staging, 'hooks', 'hooks-gemini.json')
      const targetHooks = join(staging, 'hooks', 'hooks.json')
      if (existsSync(sourceHooks)) {
        copyFileSync(sourceHooks, targetHooks)
      }
    }
    retryTransientFs(() => {
      removeIfExists(target)
      renameSync(staging, target)
    })
    return { synced: true, root: target }
  } catch (error) {
    removeIfExists(staging)
    throw error
  }
}

/** Sync package runtime files into the stable root without copying repo-only files. */
export function syncRuntimeRoot(sourceRoot, runtimeRoot) {
  return syncRuntimeTree(sourceRoot, runtimeRoot)
}

/** Sync a Claude local marketplace root that resolves to the stable runtime copy. */
export function syncClaudeMarketplaceRoot(sourceRoot, marketplaceRoot) {
  const source = resolve(sourceRoot)
  const target = resolve(marketplaceRoot)
  if (samePath(source, target)) {
    return { synced: false, root: target }
  }

  removeIfExists(target)
  if (createLink(source, target)) {
    return { synced: true, root: target }
  }
  return syncRuntimeTree(source, target)
}

/** Sync a host-specific extension root derived from the stable runtime copy. */
export function syncGeminiExtensionRoot(sourceRoot, extensionRoot) {
  return syncRuntimeTree(sourceRoot, extensionRoot, { materializeGeminiHooks: true })
}

/** Remove the stable runtime copy while leaving user settings under ~/.helloagents intact. */
export function removeRuntimeRoot(runtimeRoot) {
  removeIfExists(runtimeRoot)
}

/** Remove the Claude marketplace projection root. */
export function removeClaudeMarketplaceRoot(home) {
  removeIfExists(getClaudeMarketplaceRoot(home))
}

/** Remove the Gemini extension projection root. */
export function removeGeminiExtensionRoot(home) {
  removeIfExists(getGeminiExtensionRoot(home))
}

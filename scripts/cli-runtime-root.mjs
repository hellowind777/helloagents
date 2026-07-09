import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { copyEntries, createLink, ensureDir, removeIfExists } from './cli-utils.mjs'

export const RUNTIME_ROOT_ENTRIES = [
  '.claude-plugin',
  '.codex-plugin',
  '.grok-plugin',
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

export const GROK_MARKETPLACE_NAME = 'helloagents-grok-marketplace'
export const GROK_PLUGIN_NAME = 'helloagents'

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

/** Return the Grok marketplace projection root derived from the shared runtime copy. */
export function getGrokMarketplaceRoot(home) {
  return join(home, '.helloagents', 'host-projections', GROK_MARKETPLACE_NAME)
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

function safeJson(filePath, fallback = null) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

function safeText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function normalizeSummaryText(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

function extractSkillDescription(skillFile) {
  const text = safeText(skillFile)
  if (!text) return ''

  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let inCodeFence = false
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence || !line || line.startsWith('#')) continue
    return normalizeSummaryText(line).slice(0, 280)
  }
  return ''
}

function listSkillComponents(sourceRoot) {
  const skillsRoot = join(sourceRoot, 'skills')
  if (!existsSync(skillsRoot)) return []

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillFile = join(skillsRoot, entry.name, 'SKILL.md')
      if (!existsSync(skillFile)) return null
      const description = extractSkillDescription(skillFile)
      return description
        ? { name: entry.name, description }
        : { name: entry.name }
    })
    .filter(Boolean)
}

function listGrokHookComponents(sourceRoot) {
  const hooksData = safeJson(join(sourceRoot, 'hooks', 'hooks-grok.json'), {})
  return Object.keys(hooksData.hooks || {}).map((name) => (
    name === 'SessionStart'
      ? { name, description: 'startup|resume|clear|compact' }
      : { name }
  ))
}

function readPackageMetadata(sourceRoot) {
  const pkg = safeJson(join(sourceRoot, 'package.json'), {}) || {}
  const grokManifest = safeJson(join(sourceRoot, '.grok-plugin', 'plugin.json'), {}) || {}
  const author = (
    typeof grokManifest.author === 'object' && grokManifest.author
      ? grokManifest.author
      : (typeof pkg.author === 'object' && pkg.author ? pkg.author : {})
  )

  return {
    name: grokManifest.name || GROK_PLUGIN_NAME,
    version: grokManifest.version || pkg.version || '0.0.0',
    description: grokManifest.description || pkg.description || '',
    homepage: grokManifest.homepage || pkg.homepage || '',
    repository: typeof grokManifest.repository === 'string'
      ? grokManifest.repository
      : (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || ''),
    authorName: author.name || 'HelloWind',
    authorEmail: author.email || '',
    keywords: Array.isArray(grokManifest.keywords)
      ? grokManifest.keywords
      : (Array.isArray(pkg.keywords) ? pkg.keywords : []),
  }
}

function buildGrokMarketplaceManifest(metadata) {
  return {
    name: GROK_MARKETPLACE_NAME,
    description: 'Local development marketplace for the HelloAGENTS Grok Build plugin.',
    owner: {
      name: metadata.authorName,
      ...(metadata.authorEmail ? { email: metadata.authorEmail } : {}),
    },
    plugins: [
      {
        name: metadata.name || GROK_PLUGIN_NAME,
        description: metadata.description,
        category: 'development',
        version: metadata.version,
        source: {
          type: 'local',
          path: `./plugins/${GROK_PLUGIN_NAME}`,
        },
        ...(metadata.homepage ? { homepage: metadata.homepage } : {}),
        ...(metadata.keywords.length ? { keywords: metadata.keywords } : {}),
      },
    ],
  }
}

function buildClaudeCompatibleMarketplaceManifest(metadata) {
  return {
    name: GROK_MARKETPLACE_NAME,
    description: 'Local development marketplace for the HelloAGENTS Grok Build plugin.',
    owner: {
      name: metadata.authorName,
      ...(metadata.authorEmail ? { email: metadata.authorEmail } : {}),
    },
    plugins: [
      {
        name: metadata.name || GROK_PLUGIN_NAME,
        description: metadata.description,
        source: `./plugins/${GROK_PLUGIN_NAME}`,
        version: metadata.version,
        category: 'development',
        strict: false,
      },
    ],
  }
}

function buildGrokPluginIndex(sourceRoot) {
  return {
    version: 1,
    plugins: {
      [GROK_PLUGIN_NAME]: {
        components: {
          hooks: listGrokHookComponents(sourceRoot),
          skills: listSkillComponents(sourceRoot),
        },
      },
    },
  }
}

function writeJsonFile(filePath, value) {
  ensureDir(dirname(filePath))
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
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

/** Sync a materialized Grok marketplace projection derived from the shared runtime copy. */
export function syncGrokMarketplaceRoot(sourceRoot, marketplaceRoot) {
  const source = resolve(sourceRoot)
  const target = resolve(marketplaceRoot)
  if (samePath(source, target)) {
    return { synced: false, root: target }
  }

  const parent = dirname(target)
  ensureDir(parent)
  const staging = mkdtempSync(join(parent, '.helloagents-grok-marketplace-'))

  try {
    const pluginRoot = join(staging, 'plugins', GROK_PLUGIN_NAME)
    copyEntries(source, pluginRoot, RUNTIME_ROOT_ENTRIES)

    const sourceHooks = join(pluginRoot, 'hooks', 'hooks-grok.json')
    const targetHooks = join(pluginRoot, 'hooks', 'hooks.json')
    if (existsSync(sourceHooks)) {
      copyFileSync(sourceHooks, targetHooks)
    }

    const metadata = readPackageMetadata(source)
    writeJsonFile(join(staging, '.grok-plugin', 'marketplace.json'), buildGrokMarketplaceManifest(metadata))
    writeJsonFile(join(staging, '.grok-plugin', 'plugin-index.json'), buildGrokPluginIndex(source))
    writeJsonFile(join(staging, '.claude-plugin', 'marketplace.json'), buildClaudeCompatibleMarketplaceManifest(metadata))

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

/** Remove the Grok marketplace projection root. */
export function removeGrokMarketplaceRoot(home) {
  removeIfExists(getGrokMarketplaceRoot(home))
}

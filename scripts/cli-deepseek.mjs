import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { buildRuntimeCarrier, readCarrierSettings } from './cli-runtime-carrier.mjs'
import { createLink, ensureDir, injectMarkedContent, removeLink, removeMarkedContent, safeRead } from './cli-utils.mjs'

export const DEEPSEEK_COMMAND = process.env.HELLOAGENTS_DEEPSEEK_CMD || 'deepseek'

function looksLikeCommandPath(command = '') {
  return /[\\/]/.test(command) || /^[A-Za-z]:/.test(command)
}

function injectDeepseekCarrier(home, pkgRoot, bootstrapFile, options = {}) {
  const deepseekDir = join(home, '.deepseek')
  ensureDir(deepseekDir)

  const bootstrapContent = safeRead(join(pkgRoot, bootstrapFile))
  if (!bootstrapContent) return false

  injectMarkedContent(
    join(deepseekDir, 'AGENTS.md'),
    buildRuntimeCarrier(bootstrapContent, readCarrierSettings(home), options).trimEnd(),
  )
  createLink(pkgRoot, join(deepseekDir, 'helloagents'))
  return true
}

export function installDeepseekStandby(home, pkgRoot) {
  return injectDeepseekCarrier(home, pkgRoot, 'bootstrap-lite.md')
}

export function installDeepseekGlobal(home, pkgRoot) {
  return injectDeepseekCarrier(home, pkgRoot, 'bootstrap.md', { profile: 'full' })
}

export function uninstallDeepseekStandby(home) {
  const deepseekDir = join(home, '.deepseek')
  if (!existsSync(deepseekDir)) return false

  removeMarkedContent(join(deepseekDir, 'AGENTS.md'))
  removeLink(join(deepseekDir, 'helloagents'))
  return true
}

export function uninstallDeepseekGlobal(home) {
  return uninstallDeepseekStandby(home)
}

function runDeepseekCommand(command, args = []) {
  if (looksLikeCommandPath(command) && !existsSync(command)) {
    return {
      ok: false,
      missing: true,
      exitCode: null,
      stdout: '',
      stderr: '',
      errorMessage: '',
      combinedOutput: '',
    }
  }
  const needsShell = process.platform === 'win32' && /\.cmd$/i.test(command)
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    errors: 'replace',
    shell: needsShell,
    windowsHide: true,
  })
  const stdout = String(result.stdout || '').trim()
  const stderr = String(result.stderr || '').trim()
  const errorMessage = result.error?.message || ''
  return {
    ok: result.status === 0,
    missing: result.error?.code === 'ENOENT',
    exitCode: typeof result.status === 'number' ? result.status : null,
    stdout,
    stderr,
    errorMessage,
    combinedOutput: [stdout, stderr, errorMessage].filter(Boolean).join('\n').trim(),
  }
}

function tryParseJson(text = '') {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function buildDoctorSummary(report = {}) {
  const skills = report.skills || {}
  const capability = report.capability || {}
  const sandbox = report.sandbox || {}
  const mcp = report.mcp || {}
  return {
    version: typeof report.version === 'string' ? report.version : '',
    configPath: typeof report.config_path === 'string' ? report.config_path : '',
    skillsSelected: Array.isArray(skills.selected) ? skills.selected : [],
    mcpPresent: Boolean(mcp.present),
    sandboxAvailable: typeof sandbox.available === 'boolean' ? sandbox.available : null,
    resolvedProvider: typeof capability.resolved_provider === 'string' ? capability.resolved_provider : '',
    resolvedModel: typeof capability.resolved_model === 'string' ? capability.resolved_model : '',
  }
}

export function inspectNativeDeepseekDoctor() {
  const result = runDeepseekCommand(DEEPSEEK_COMMAND, ['doctor', '--json'])
  if (result.missing) {
    return {
      available: false,
      command: DEEPSEEK_COMMAND,
      exitCode: null,
      ok: false,
      summary: null,
      note: 'command-not-found',
    }
  }

  const parsed = tryParseJson(result.stdout) || tryParseJson(result.combinedOutput)
  return {
    available: true,
    command: DEEPSEEK_COMMAND,
    exitCode: result.exitCode,
    ok: result.ok,
    summary: parsed ? buildDoctorSummary(parsed) : null,
    parseError: parsed ? '' : (result.combinedOutput ? 'invalid-json' : ''),
    output: parsed ? '' : result.combinedOutput,
  }
}

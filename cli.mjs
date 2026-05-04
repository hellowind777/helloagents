#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero external dependencies.
 */
'use strict'

import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEFAULTS, ensureConfig, loadPackageVersion } from './scripts/cli-config.mjs'
import { safeJson, ensureDir } from './scripts/cli-utils.mjs'
import {
  detectHostMode,
  getHostLabel,
  getTrackedHostMode,
  initCliLifecycle,
  normalizeHost,
  readSettings,
  runScopedLifecycle,
  switchMode,
  syncVersion,
} from './scripts/cli-lifecycle.mjs'
import { initCliDoctor, runDoctor } from './scripts/cli-doctor.mjs'
import { runBranchSwitch } from './scripts/cli-branch.mjs'
import { createMessageHelpers, createInstallMessagePrinter } from './scripts/cli-messages.mjs'
import { getStableRuntimeRoot, removeRuntimeRoot, syncRuntimeRoot } from './scripts/cli-runtime-root.mjs'

const HOME = homedir()
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const HELLOAGENTS_HOME = join(HOME, '.helloagents')
const RUNTIME_ROOT = getStableRuntimeRoot(HOME)
const CONFIG_FILE = join(HELLOAGENTS_HOME, 'helloagents.json')
const pkg = loadPackageVersion(PKG_ROOT)

const isCN = (() => {
  const lang = (process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '').toLowerCase()
  return lang.includes('zh') || lang.includes('cn')
})()

const { msg, ok } = createMessageHelpers(isCN)
const { printHelp, printInstallMsg } = createInstallMessagePrinter({
  home: HOME,
  pkgVersion: pkg.version,
  msg,
})
initCliLifecycle({
  home: HOME,
  pkgRoot: RUNTIME_ROOT,
  sourceRoot: PKG_ROOT,
  helloagentsHome: HELLOAGENTS_HOME,
  configFile: CONFIG_FILE,
  pkgVersion: pkg.version,
  msg,
  ok,
  printInstallMsg,
})
initCliDoctor({
  home: HOME,
  pkgRoot: RUNTIME_ROOT,
  sourceRoot: PKG_ROOT,
  pkgVersion: pkg.version,
  msg,
  readSettings,
  getTrackedHostMode,
  normalizeHost,
  detectHostMode,
  getHostLabel,
})

function ensureRuntimeRoot() {
  syncRuntimeRoot(PKG_ROOT, RUNTIME_ROOT)
}

function printPostinstallMessage() {
  console.log(`\n  HelloAGENTS v${pkg.version}\n`)
  ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir)
  ensureRuntimeRoot()
  ok('~/.helloagents/helloagents.json')
  ok('~/.helloagents/helloagents')

  const settings = readSettings()
  const mode = settings.install_mode || DEFAULTS.install_mode
  const deployMessage = shouldDeployFromEnv()
    ? msg(
      '  HelloAGENTS 包已安装，正在按环境变量部署。\n',
      '  HelloAGENTS package installed; deploying from environment variables.\n',
    )
    : msg(
      `  HelloAGENTS 包已安装，尚未自动部署到任何 CLI。\n  使用显式命令部署：\n    helloagents install codex --${mode}\n    helloagents install --all --${mode}\n`,
      `  HelloAGENTS package installed. No CLI targets were configured automatically.\n  Deploy explicitly with:\n    helloagents install codex --${mode}\n    helloagents install --all --${mode}\n`,
    )
  console.log(deployMessage)
}

function runSafely(handler) {
  try {
    handler()
  } catch (error) {
    console.error(`\n  ✗ ${error.message}\n`)
    process.exitCode = 1
  }
}

function resolveRuntimeScript(scriptName) {
  const runtimeScript = join(RUNTIME_ROOT, 'scripts', scriptName)
  if (existsSync(runtimeScript)) return runtimeScript
  return join(PKG_ROOT, 'scripts', scriptName)
}

function runRuntimeScript(scriptName, scriptArgs) {
  const result = spawnSync(process.execPath, [resolveRuntimeScript(scriptName), ...scriptArgs], {
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error) {
    console.error(`\n  ✗ ${result.error.message}\n`)
    process.exitCode = 1
    return
  }
  process.exitCode = typeof result.status === 'number' ? result.status : 1
}

function envFlag(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').toLowerCase())
}

function parseCompactLifecycleSpec() {
  const raw = String(process.env.HELLOAGENTS || '').trim()
  if (!raw) return null

  const parts = raw.split(':')
  if (parts.length > 2 || !parts[0]) {
    throw new Error(msg('HELLOAGENTS 必须是 target[:mode]，例如 codex:global', 'HELLOAGENTS must be target[:mode], for example codex:global'))
  }

  const target = normalizeHost(parts[0].trim().toLowerCase())
  const mode = (parts[1] || '').trim().toLowerCase()
  if (!target) throw new Error(msg(`不支持的 HELLOAGENTS 目标：${parts[0]}`, `Unsupported HELLOAGENTS target: ${parts[0]}`))
  if (mode && !['standby', 'global'].includes(mode)) {
    throw new Error(msg(`不支持的 HELLOAGENTS 模式：${mode}`, `Unsupported HELLOAGENTS mode: ${mode}`))
  }

  return { target, mode }
}

function lifecycleArgsFromEnv(defaultTarget = 'all') {
  const compact = parseCompactLifecycleSpec()
  const target = (
    process.env.HELLOAGENTS_TARGET
    || process.env.HELLOAGENTS_HOST
    || compact?.target
    || defaultTarget
  ).trim()
  const mode = (process.env.HELLOAGENTS_MODE || compact?.mode || '').trim().toLowerCase()
  const args = [target === 'all' ? '--all' : target]
  if (mode) args.push(`--${mode}`)
  return args
}

function shouldDeployFromEnv() {
  return envFlag('HELLOAGENTS_DEPLOY') || Boolean(String(process.env.HELLOAGENTS || '').trim())
}

const argv = process.argv.slice(2)
const cmd = argv[0] || ''

if (cmd === 'codex-notify') {
  runRuntimeScript('notify.mjs', ['codex-notify', ...argv.slice(1)])
} else if (cmd === 'notify') {
  runRuntimeScript('notify.mjs', argv.slice(1))
} else if (cmd === 'guard') {
  runRuntimeScript('guard.mjs', argv.slice(1))
} else if (cmd === 'ralph-loop') {
  runRuntimeScript('ralph-loop.mjs', argv.slice(1))
} else if (cmd === 'codex' && argv[1] === 'goals') {
  runRuntimeScript('cli-codex-goals.mjs', argv.slice(2))
} else if (cmd === 'postinstall') {
  printPostinstallMessage()
  if (shouldDeployFromEnv()) {
    runSafely(() => runScopedLifecycle('install', lifecycleArgsFromEnv()))
  }
} else if (cmd === 'preuninstall') {
  runSafely(() => {
    const cleanupArgs = argv.length > 1 ? argv.slice(1) : lifecycleArgsFromEnv('all')
    runScopedLifecycle('cleanup', cleanupArgs)
    if (cleanupArgs.includes('--all')) removeRuntimeRoot(RUNTIME_ROOT)
  })
} else if (cmd === 'sync-version') {
  syncVersion()
} else if (cmd === 'doctor') {
  runSafely(() => runDoctor(argv.slice(1)))
} else if (cmd === '--global' || cmd === '--standby') {
  runSafely(() => {
    ensureRuntimeRoot()
    switchMode(cmd === '--global' ? 'global' : 'standby')
  })
} else if (cmd === 'branch' || cmd === 'switch-branch') {
  runSafely(() => runBranchSwitch(argv.slice(1)))
} else if (['install', 'update', 'uninstall', 'cleanup'].includes(cmd)) {
  runSafely(() => {
    const action = cmd
    const lifecycleArgs = argv.slice(1)
    if (cmd === 'install' || cmd === 'update') ensureRuntimeRoot()
    runScopedLifecycle(action, lifecycleArgs)
    const positionals = lifecycleArgs.filter((arg) => !arg.startsWith('--'))
    if (action === 'uninstall' && (lifecycleArgs.includes('--all') || positionals.length === 0)) {
      removeRuntimeRoot(RUNTIME_ROOT)
    }
  })
} else {
  printHelp()
}

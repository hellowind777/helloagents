#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero external dependencies.
 */
'use strict'

import { homedir } from 'node:os'
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

const HOME = homedir()
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const HELLOAGENTS_HOME = join(HOME, '.helloagents')
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
  pkgRoot: PKG_ROOT,
  helloagentsHome: HELLOAGENTS_HOME,
  configFile: CONFIG_FILE,
  pkgVersion: pkg.version,
  msg,
  ok,
  printInstallMsg,
})
initCliDoctor({
  home: HOME,
  pkgRoot: PKG_ROOT,
  pkgVersion: pkg.version,
  msg,
  readSettings,
  getTrackedHostMode,
  normalizeHost,
  detectHostMode,
  getHostLabel,
})

function printPostinstallMessage() {
  console.log(`\n  HelloAGENTS v${pkg.version}\n`)
  ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir)
  ok('~/.helloagents/helloagents.json')

  const settings = readSettings()
  const mode = settings.install_mode || DEFAULTS.install_mode
  const deployMessage = shouldDeployFromEnv()
    ? msg(
      '  HelloAGENTS 包已安装，正在按 HELLOAGENTS_TARGET / HELLOAGENTS_MODE 部署。\n',
      '  HelloAGENTS package installed; deploying from HELLOAGENTS_TARGET / HELLOAGENTS_MODE.\n',
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

function envFlag(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').toLowerCase())
}

function lifecycleArgsFromEnv(defaultTarget = 'all') {
  const target = (process.env.HELLOAGENTS_TARGET || process.env.HELLOAGENTS_HOST || defaultTarget).trim()
  const mode = (process.env.HELLOAGENTS_MODE || '').trim().toLowerCase()
  const args = [target === 'all' ? '--all' : target]
  if (mode) args.push(`--${mode}`)
  return args
}

function shouldDeployFromEnv() {
  return envFlag('HELLOAGENTS_DEPLOY')
}

const argv = process.argv.slice(2)
const cmd = argv[0] || ''

if (cmd === 'postinstall') {
  printPostinstallMessage()
  if (shouldDeployFromEnv()) {
    runSafely(() => runScopedLifecycle('install', lifecycleArgsFromEnv()))
  }
} else if (cmd === 'preuninstall') {
  runScopedLifecycle('cleanup', lifecycleArgsFromEnv('all'))
} else if (cmd === 'sync-version') {
  syncVersion()
} else if (cmd === 'doctor') {
  runSafely(() => runDoctor(argv.slice(1)))
} else if (cmd === '--global' || cmd === '--standby') {
  switchMode(cmd === '--global' ? 'global' : 'standby')
} else if (cmd === 'branch' || cmd === 'switch-branch') {
  runSafely(() => runBranchSwitch(argv.slice(1)))
} else if (['install', 'update', 'uninstall', 'cleanup', '--cleanup'].includes(cmd)) {
  runSafely(() => runScopedLifecycle(cmd === '--cleanup' ? 'cleanup' : cmd, argv.slice(1)))
} else {
  printHelp()
}

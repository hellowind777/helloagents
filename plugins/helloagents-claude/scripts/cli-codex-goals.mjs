#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { ensureTimestampedBackup } from './cli-codex-backup.mjs'
import {
  CODEX_GOALS_FEATURE_KEY,
  CODEX_MANAGED_TOML_COMMENT,
  isManagedCodexGoalsFeature,
  readCodexGoalsFeatureLine,
  removeCodexGoalsFeatureConfig,
  setCodexGoalsFeatureConfig,
} from './cli-codex-config.mjs'
import { ensureDir, safeRead, safeWrite } from './cli-utils.mjs'

const CODEX_CONFIG_BASENAME = 'config.toml'

function isJsonMode(args) {
  return args.includes('--json')
}

function readStatus(home) {
  const configPath = join(home, '.codex', CODEX_CONFIG_BASENAME)
  const toml = safeRead(configPath) || ''
  const line = readCodexGoalsFeatureLine(toml)
  const valueMatch = line.match(/^\s*goals\s*=\s*(true|false)\b/)
  const configured = Boolean(valueMatch)
  const enabled = valueMatch ? valueMatch[1] === 'true' : false

  return {
    configPath,
    configured,
    enabled,
    managed: isManagedCodexGoalsFeature(line),
    line,
  }
}

function printStatus(status, jsonMode) {
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify({
      feature: CODEX_GOALS_FEATURE_KEY,
      enabled: status.enabled,
      configured: status.configured,
      managed: status.managed,
      configPath: status.configPath,
    }, null, 2)}\n`)
    return
  }

  const state = status.enabled ? 'enabled' : 'disabled'
  const source = status.configured ? (status.managed ? 'managed' : 'user') : 'default'
  process.stdout.write(`Codex goals: ${state} (${source})\n`)
}

function updateGoals(home, enabled) {
  const codexDir = join(home, '.codex')
  const configPath = join(codexDir, CODEX_CONFIG_BASENAME)
  ensureDir(codexDir)
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME)

  const current = safeRead(configPath) || ''
  const next = enabled
    ? setCodexGoalsFeatureConfig(current, true)
    : removeCodexGoalsFeatureConfig(setCodexGoalsFeatureConfig(current, false))

  if (next.trim()) safeWrite(configPath, next)
  else safeWrite(configPath, '')
}

function printUsage() {
  process.stdout.write([
    'Usage: helloagents codex goals <status|enable|disable> [--json]',
    '',
    `This only manages [features].goals ${CODEX_MANAGED_TOML_COMMENT}.`,
  ].join('\n') + '\n')
}

export function runCodexGoalsCli(args = process.argv.slice(2), { home = homedir() } = {}) {
  const command = args.find((arg) => !arg.startsWith('--')) || 'status'
  const jsonMode = isJsonMode(args)

  if (!existsSync(join(home, '.codex')) && command === 'status') {
    const status = {
      configPath: join(home, '.codex', CODEX_CONFIG_BASENAME),
      configured: false,
      enabled: false,
      managed: false,
      line: '',
    }
    printStatus(status, jsonMode)
    return
  }

  if (command === 'status') {
    printStatus(readStatus(home), jsonMode)
    return
  }

  if (command === 'enable' || command === 'disable') {
    updateGoals(home, command === 'enable')
    printStatus(readStatus(home), jsonMode)
    return
  }

  printUsage()
  process.exitCode = 1
}

if (process.argv[1]?.endsWith('cli-codex-goals.mjs')) {
  runCodexGoalsCli()
}

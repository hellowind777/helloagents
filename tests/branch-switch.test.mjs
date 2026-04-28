import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync } from 'node:fs'
import { join } from 'node:path'

import {
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  writeText,
} from './helpers/test-env.mjs'
import { runCli } from './helpers/cli-test-helpers.mjs'

function writeFakeCommand(binDir, name, logPath) {
  if (process.platform === 'win32') {
    const commandPath = join(binDir, `${name}.cmd`)
    writeText(commandPath, `@echo off\r\necho %*>>"${logPath}"\r\nexit /b 0\r\n`)
    return commandPath
  }
  const commandPath = join(binDir, name)
  writeText(commandPath, `#!/bin/sh\necho "$@" >> "${logPath}"\nexit 0\n`)
  chmodSync(commandPath, 0o755)
  return commandPath
}

function createBranchSwitchFixture() {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const binDir = createTempDir('helloagents-branch-bin-')
  const npmLog = join(home, 'npm.log')
  const helloagentsLog = join(home, 'helloagents.log')
  return {
    pkgRoot,
    home,
    npmLog,
    helloagentsLog,
    env: {
      HELLOAGENTS_NPM_CMD: writeFakeCommand(binDir, 'npm', npmLog),
      HELLOAGENTS_BIN_CMD: writeFakeCommand(binDir, 'helloagents', helloagentsLog),
    },
  }
}

test('switch-branch installs a GitHub branch and refreshes a scoped global host', () => {
  const { pkgRoot, home, env, npmLog, helloagentsLog } = createBranchSwitchFixture()

  runCli(pkgRoot, home, ['switch-branch', 'beta', 'claude', '--global'], env)

  assert.match(readText(npmLog), /install -g github:hellowind777\/helloagents#beta/)
  assert.match(readText(helloagentsLog), /update claude --global/)
})

test('branch accepts a full npm spec and refreshes all hosts with explicit mode', () => {
  const { pkgRoot, home, env, npmLog, helloagentsLog } = createBranchSwitchFixture()

  runCli(pkgRoot, home, [
    'branch',
    'github:hellowind777/helloagents#beta',
    '--all',
    '--standby',
  ], env)

  assert.match(readText(npmLog), /install -g github:hellowind777\/helloagents#beta/)
  assert.match(readText(helloagentsLog), /update --all --standby/)
})

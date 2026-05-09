import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync } from 'node:fs'
import { join } from 'node:path'

import {
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readJson,
  readText,
  REPO_ROOT,
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
  return {
    pkgRoot,
    home,
    npmLog,
    env: {
      HELLOAGENTS_NPM_CMD: writeFakeCommand(binDir, 'npm', npmLog),
    },
  }
}

test('switch-branch installs a GitHub branch and refreshes a scoped global host through npm', () => {
  const { pkgRoot, home, env, npmLog } = createBranchSwitchFixture()

  runCli(pkgRoot, home, ['switch-branch', 'beta', 'claude', '--global'], env)

  assert.match(readText(npmLog), /install -g github:hellowind777\/helloagents#beta/)
  assert.match(readText(npmLog), /explore -g helloagents -- npm run sync-hosts -- claude --global/)
})

test('branch accepts a full npm spec and refreshes all hosts through npm', () => {
  const { pkgRoot, home, env, npmLog } = createBranchSwitchFixture()

  runCli(pkgRoot, home, [
    'branch',
    'github:hellowind777/helloagents#beta',
    '--all',
    '--standby',
  ], env)

  assert.match(readText(npmLog), /install -g github:hellowind777\/helloagents#beta/)
  assert.match(readText(npmLog), /explore -g helloagents -- npm run sync-hosts -- --all --standby/)
})

test('package exposes npm-script and one-shot script entry points', () => {
  const pkg = readJson(join(REPO_ROOT, 'package.json'))

  assert.equal(pkg.scripts.deploy, 'node cli.mjs install')
  assert.equal(pkg.scripts['deploy:global'], 'node cli.mjs install --all --global')
  assert.equal(pkg.scripts['sync-hosts'], 'node cli.mjs update')
  assert.equal(pkg.scripts['cleanup-hosts'], 'node cli.mjs cleanup')
  assert.equal(pkg.scripts['switch-branch'], 'node cli.mjs switch-branch')
  assert.equal(pkg.bin['helloagents-js.cmd'], 'cli.mjs')
  assert.equal(pkg.bin['helloagents-turn-state'], 'scripts/turn-state-cli.mjs')
  assert.ok(pkg.files.includes('install.sh'))
  assert.ok(pkg.files.includes('install.ps1'))
  assert.match(readText(join(REPO_ROOT, 'README.md')), /HELLOAGENTS=codex:global/)
  assert.match(readText(join(REPO_ROOT, 'README.md')), /HELLOAGENTS_ACTION=update/)
  assert.match(readText(join(REPO_ROOT, 'README.md')), /HELLOAGENTS_ACTION=switch-branch/)
  assert.match(readText(join(REPO_ROOT, 'README.md')), /HELLOAGENTS_ACTION=cleanup/)
  assert.match(readText(join(REPO_ROOT, 'README.md')), /HELLOAGENTS_ACTION=uninstall/)
  assert.match(readText(join(REPO_ROOT, 'install.sh')), /HELLOAGENTS_ACTION/)
  assert.match(readText(join(REPO_ROOT, 'install.sh')), /install\|update\|cleanup\|uninstall\|switch-branch\|branch/)
  assert.match(readText(join(REPO_ROOT, 'install.sh')), /HELLOAGENTS=all\|claude\|gemini\|codex/)
  assert.match(readText(join(REPO_ROOT, 'install.ps1')), /HELLOAGENTS_ACTION/)
  assert.match(readText(join(REPO_ROOT, 'install.ps1')), /install\|update\|cleanup\|uninstall\|switch-branch\|branch/)
  assert.match(readText(join(REPO_ROOT, 'install.ps1')), /HELLOAGENTS=all\|claude\|gemini\|codex/)
})

test('one-shot shell wrappers preserve mode omission for update and cleanup flows', () => {
  const installSh = readText(join(REPO_ROOT, 'install.sh'))
  const installPs1 = readText(join(REPO_ROOT, 'install.ps1'))

  assert.match(installSh, /export HELLOAGENTS_MODE="\$\{MODE:-standby\}"/)
  assert.match(installSh, /if \[ -n "\$MODE" \]; then\s+npm explore -g helloagents -- npm run sync-hosts -- "\$TARGET" "--\$MODE"\s+else\s+npm explore -g helloagents -- npm run sync-hosts -- "\$TARGET"/s)
  assert.match(installPs1, /if \(\$Mode\) \{\s*\$env:HELLOAGENTS_MODE = \$Mode\s*\}\s*else \{\s*\$env:HELLOAGENTS_MODE = "standby"/s)
  assert.doesNotMatch(installPs1, /\$Mode = "standby"/)
})

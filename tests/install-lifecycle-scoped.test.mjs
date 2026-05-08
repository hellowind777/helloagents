import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, realpathSync } from 'node:fs'
import { delimiter, join } from 'node:path'

import { createHomeFixture, createPackageFixture, createTempDir, readJson, readText, writeJson, writeText } from './helpers/test-env.mjs'
import { runCli, seedHostConfigs } from './helpers/cli-test-helpers.mjs'

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

test('single-host install and cleanup only touch the targeted CLI in standby mode by default', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'claude'])

  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/)
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.doesNotMatch(readText(join(home, '.gemini', 'GEMINI.md')), /HELLOAGENTS_START/)
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.equal(readJson(configFile).host_install_modes.claude, 'standby')

  runCli(pkgRoot, home, ['cleanup', 'claude'])

  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/)
  assert.match(readText(join(home, '.gemini', 'GEMINI.md')), /# Gemini custom/)
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /# Codex custom/)
  assert.equal(readJson(configFile).host_install_modes.claude, undefined)
})

test('single-host update reuses tracked codex mode and cleanup leaves other CLIs intact', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const pluginRoot = join(home, 'plugins', 'helloagents')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'codex', '--global'])
  assert.ok(existsSync(pluginRoot))
  assert.equal(realpathSync(pluginRoot), realpathSync(join(home, '.helloagents', 'helloagents')))
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.equal(readJson(configFile).host_install_modes.codex, 'global')

  writeText(join(pkgRoot, 'bootstrap.md'), '# scoped global update\n')
  runCli(pkgRoot, home, ['update', 'codex'])
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# scoped global update/)
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /# scoped global update/)

  runCli(pkgRoot, home, ['install', 'claude'])
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  assert.ok(!existsSync(pluginRoot))
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')))
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.equal(readJson(configFile).host_install_modes.codex, undefined)
  assert.equal(readJson(configFile).host_install_modes.claude, 'standby')
})

test('single-host update infers the detected codex mode when tracked config is stale', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const pluginRoot = join(home, 'plugins', 'helloagents')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'codex', '--global'])
  writeJson(configFile, {
    ...readJson(configFile),
    install_mode: 'standby',
    host_install_modes: {},
  })

  writeText(join(pkgRoot, 'bootstrap.md'), '# detected global refresh\n')
  runCli(pkgRoot, home, ['update', 'codex'])

  assert.ok(existsSync(pluginRoot))
  assert.equal(realpathSync(pluginRoot), realpathSync(join(home, '.helloagents', 'helloagents')))
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# detected global refresh/)
  assert.equal(readJson(configFile).host_install_modes.codex, 'global')
})

test('all-host update preserves each CLI tracked mode when no mode flag is passed', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const pluginRoot = join(home, 'plugins', 'helloagents')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'codex', '--global'])
  runCli(pkgRoot, home, ['install', 'claude', '--standby'])
  writeText(join(pkgRoot, 'bootstrap.md'), '# refreshed global mode\n')
  writeText(join(pkgRoot, 'bootstrap-lite.md'), '# refreshed standby mode\n')

  runCli(pkgRoot, home, ['update', '--all'])

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.codex, 'global')
  assert.equal(settings.host_install_modes.claude, 'standby')
  assert.equal(settings.host_install_modes.gemini, 'standby')
  assert.ok(existsSync(pluginRoot))
  assert.equal(realpathSync(pluginRoot), realpathSync(join(home, '.helloagents', 'helloagents')))
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# refreshed global mode/)
  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /# refreshed standby mode/)
})

test('all-host install without a mode falls back to standby for untracked CLIs', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)
  runCli(pkgRoot, home, ['postinstall'])

  writeJson(configFile, {
    ...readJson(configFile),
    install_mode: 'global',
    host_install_modes: {},
  })

  runCli(pkgRoot, home, ['install', '--all'])

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.claude, 'standby')
  assert.equal(settings.host_install_modes.gemini, 'standby')
  assert.equal(settings.host_install_modes.codex, 'standby')
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(!existsSync(join(home, 'plugins', 'helloagents')))
})

test('all-host global install records only successful host setup', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', '--all', '--global'], {
    HELLOAGENTS_CLAUDE_CMD: join(home, 'missing-claude.cmd'),
    HELLOAGENTS_GEMINI_CMD: join(home, 'missing-gemini.cmd'),
  })

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.claude, undefined)
  assert.equal(settings.host_install_modes.gemini, undefined)
  assert.equal(settings.host_install_modes.codex, 'global')
})

test('standby refresh updates injected carrier files for every CLI after bootstrap changes', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', '--all', '--standby'])

  writeText(join(pkgRoot, 'bootstrap-lite.md'), '# refreshed standby carrier\n')
  runCli(pkgRoot, home, ['update', '--all'])

  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /# refreshed standby carrier/)
  assert.match(readText(join(home, '.gemini', 'GEMINI.md')), /# refreshed standby carrier/)
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /# refreshed standby carrier/)
})

test('codex cleanup removes an empty local marketplace file left behind by prior global installs', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  writeJson(join(home, '.agents', 'plugins', 'marketplace.json'), {
    name: 'local-plugins',
    interface: {
      displayName: 'Local Plugins',
    },
    plugins: [],
  })

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')))
})

test('global install attempts Claude and Gemini native installers when commands exist', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const fakeBin = createTempDir('helloagents-fake-bin-')
  const claudeLog = join(home, 'claude.log')
  const geminiLog = join(home, 'gemini.log')

  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const geminiCommand = writeFakeCommand(fakeBin, 'gemini', geminiLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  runCli(pkgRoot, home, ['install', '--all', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })

  assert.match(readText(claudeLog), /plugin marketplace add hellowind777\/helloagents/)
  assert.match(readText(claudeLog), /plugin install helloagents@helloagents --scope user/)
  assert.match(readText(geminiLog), /extensions install https:\/\/github\.com\/hellowind777\/helloagents/)
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.claude, 'global')
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.gemini, 'global')
})

test('single-host global install does not record a mode when the native host command fails', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'claude', '--global'], {
    HELLOAGENTS_CLAUDE_CMD: join(home, 'missing-claude.cmd'),
  })

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.claude, undefined)
})

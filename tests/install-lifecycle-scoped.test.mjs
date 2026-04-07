import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { createHomeFixture, createPackageFixture, readJson, readText, writeJson, writeText } from './helpers/test-env.mjs'
import { runCli, seedHostConfigs } from './helpers/cli-test-helpers.mjs'

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
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# detected global refresh/)
  assert.equal(readJson(configFile).host_install_modes.codex, 'global')
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

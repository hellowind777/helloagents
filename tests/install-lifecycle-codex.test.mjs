import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { CODEX_DEVELOPER_INSTRUCTIONS } from '../scripts/cli-codex.mjs'
import { createHomeFixture, createPackageFixture, readText, writeText } from './helpers/test-env.mjs'
import {
  hasTimestampedBackup,
  runCli,
  seedHostConfigs,
  writeTimestampedBackup,
} from './helpers/cli-test-helpers.mjs'

test('Codex global cleanup still removes marketplace and plugin roots when .codex is gone', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])
  runCli(pkgRoot, home, ['--global'])

  rmSync(join(home, '.codex'), { recursive: true, force: true })
  runCli(pkgRoot, home, ['preuninstall'])

  assert.ok(!existsSync(join(home, 'plugins', 'helloagents')))
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')))
})

test('Codex cleanup ignores contaminated backups and strips managed config lines', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      'unified_exec = true',
      '',
    ].join('\n'),
  )
  writeTimestampedBackup(
    home,
    'config.toml',
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['cleanup'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(cleaned, /developer_instructions\s*=/)
  assert.doesNotMatch(cleaned, /codex-notify/)
  assert.doesNotMatch(cleaned, /codex_hooks = true/)
  assert.match(cleaned, /unified_exec = true/)
})

test('Codex standby temporarily suspends a user-owned model_instructions_file and restores it on cleanup', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const userAgentsPath = join(home, '.codex', 'AGENTS.md').replace(/\\/g, '/')

  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n')
  writeText(join(home, '.codex', 'config.toml'), `model_instructions_file = "${userAgentsPath}"\n`)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(installedConfig, /model_instructions_file\s*=/)
  assert.match(installedConfig, /developer_instructions\s*=\s*"""/)
  assert.ok(installedConfig.indexOf('developer_instructions = """') < installedConfig.indexOf('notify = ['))

  runCli(pkgRoot, home, ['cleanup'])

  assert.match(readText(join(home, '.codex', 'config.toml')), new RegExp(`model_instructions_file = "${userAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.equal(readText(join(home, '.codex', 'AGENTS.md')), '# Codex custom\n')
})

test('Codex standby preserves a user-owned developer_instructions block and restores it on cleanup', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      'user custom instructions',
      '"""',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(installedConfig, new RegExp(CODEX_DEVELOPER_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.ok(hasTimestampedBackup(home, 'developer_instructions'))

  runCli(pkgRoot, home, ['cleanup'])

  const restoredConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(restoredConfig, /^developer_instructions = """\nuser custom instructions\n"""/)
  assert.ok(!hasTimestampedBackup(home, 'developer_instructions'))
})

test('Codex cleanup ignores contaminated developer_instructions backups', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'unified_exec = true',
      '',
    ].join('\n'),
  )
  writeTimestampedBackup(
    home,
    'developer_instructions',
    'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]\n',
  )

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(cleaned, /^developer_instructions = \["node"/)
  assert.doesNotMatch(cleaned, /developer_instructions\s*=/)
  assert.doesNotMatch(cleaned, /codex-notify/)
  assert.match(cleaned, /unified_exec = true/)
  assert.ok(!hasTimestampedBackup(home, 'developer_instructions'))
})

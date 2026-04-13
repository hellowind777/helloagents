import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { isManagedCodexModelInstruction } from '../scripts/cli-codex-config.mjs'
import { createHomeFixture, createPackageFixture, readText, writeText } from './helpers/test-env.mjs'
import {
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
  const codexAgentsPath = join(home, '.codex', 'AGENTS.md').replace(/\\/g, '/')

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      `model_instructions_file = "${codexAgentsPath}" # helloagents-managed`,
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
      `model_instructions_file = "${codexAgentsPath}" # helloagents-managed`,
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['cleanup'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(cleaned, /model_instructions_file\s*=/)
  assert.doesNotMatch(cleaned, /codex-notify/)
  assert.doesNotMatch(cleaned, /codex_hooks = true/)
  assert.match(cleaned, /unified_exec = true/)
})

test('Codex standby replaces a user-owned model_instructions_file with the managed home AGENTS carrier and restores it on cleanup', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const userAgentsPath = join(home, '.codex', 'AGENTS.md').replace(/\\/g, '/')

  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n')
  writeText(join(home, '.codex', 'config.toml'), `model_instructions_file = "${userAgentsPath}"\n`)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(installedConfig, new RegExp(`model_instructions_file = "${userAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.ok(isManagedCodexModelInstruction(installedConfig.split('\n').find((line) => line.startsWith('model_instructions_file ='))))
  assert.match(installedConfig, /notify = \["node", ".*\/scripts\/notify\.mjs", "codex-notify"\]/)

  runCli(pkgRoot, home, ['cleanup'])

  assert.match(readText(join(home, '.codex', 'config.toml')), new RegExp(`model_instructions_file = "${userAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.equal(readText(join(home, '.codex', 'AGENTS.md')), '# Codex custom\n')
})

test('Codex standby keeps model_instructions_file before notify and separates managed lines from later fields', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'approval_policy = "never"',
      'sandbox_mode = "danger-full-access"',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(
    installedConfig,
    /^model_instructions_file = ".*\/\.codex\/AGENTS\.md" # helloagents-managed\nnotify = \["node", ".*\/scripts\/notify\.mjs", "codex-notify"\]\n\napproval_policy = "never"\nsandbox_mode = "danger-full-access"\n\n\[features\]\nexperimental = true\n/,
  )
})

test('Codex standby leaves a user-owned developer_instructions block untouched', () => {
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
  assert.match(installedConfig, /developer_instructions = """\nuser custom instructions\n"""/)
  assert.match(installedConfig, /model_instructions_file = ".*\/\.codex\/AGENTS\.md" # helloagents-managed/)

  runCli(pkgRoot, home, ['cleanup'])

  const restoredConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(restoredConfig, /^developer_instructions = """\nuser custom instructions\n"""/)
})

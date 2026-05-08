import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  CODEX_MANAGED_GOALS_FEATURE_LINE,
  CODEX_MANAGED_NOTIFY_VALUE,
  CODEX_MANAGED_TUI_NOTIFICATIONS_LINE,
  isManagedCodexModelInstruction,
  isManagedCodexNotify,
} from '../scripts/cli-codex-config.mjs'
import { buildManagedCodexHookTrustEntries, readCodexHookStateSections } from '../scripts/cli-codex-hooks-state.mjs'
import { createHomeFixture, createPackageFixture, readText, writeText } from './helpers/test-env.mjs'
import {
  runCli,
  seedHostConfigs,
} from './helpers/cli-test-helpers.mjs'

const MANAGED_NOTIFY_LINE = `notify = ${CODEX_MANAGED_NOTIFY_VALUE} # helloagents-managed`

function readManagedHookTrust(home) {
  const hooksPath = join(home, '.codex', 'hooks.json')
  const configPath = join(home, '.codex', 'config.toml')
  const hooks = JSON.parse(readText(hooksPath))
  const expected = buildManagedCodexHookTrustEntries(hooksPath, hooks)
  const sections = readCodexHookStateSections(readText(configPath))
    .filter((section) => section.managed)
  return { expected, sections }
}

test('Codex managed notify uses a single cross-platform entrypoint', () => {
  assert.equal(CODEX_MANAGED_NOTIFY_VALUE, '["helloagents-js", "codex-notify"]')
  assert.equal(isManagedCodexNotify('notify = ["helloagents-js.cmd", "codex-notify"]'), false)
  assert.equal(isManagedCodexNotify('notify = ["helloagents-js.cmd", "codex-notify"] # helloagents-managed'), false)
  assert.equal(isManagedCodexNotify(`${MANAGED_NOTIFY_LINE}`), true)
})

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

test('Codex cleanup leaves unmarked package-script notify entries untouched', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /notify = \["node", "D:\/GitHub\/dev\/helloagents\/scripts\/notify\.mjs", "codex-notify"\]/)
  assert.match(cleaned, /\[features\]\nexperimental = true/)
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
  assert.match(installedConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)
  assert.ok(isManagedCodexModelInstruction(installedConfig.split('\n').find((line) => line.startsWith('model_instructions_file ='))))
  assert.ok(installedConfig.includes(MANAGED_NOTIFY_LINE), installedConfig)
  assert.match(installedConfig, /\[tui\]\nnotifications = \["plan-mode-prompt"\] # helloagents-managed/)
  assert.doesNotMatch(installedConfig, /codex_hooks\s*=/)
  assert.doesNotMatch(installedConfig, /^\s*hooks\s*=/m)
  assert.doesNotMatch(installedConfig, /UserPromptSubmit/)
  const installedHooks = JSON.parse(readText(join(home, '.codex', 'hooks.json')))
  assert.match(JSON.stringify(installedHooks), /helloagents-js notify route --codex --silent/)
  const managedHookTrust = readManagedHookTrust(home)
  assert.equal(managedHookTrust.sections.length, managedHookTrust.expected.length)
  for (const entry of managedHookTrust.expected) {
    const match = managedHookTrust.sections.find((section) => section.key === entry.key)
    assert.ok(match, entry.key)
    assert.equal(match.trustedHash, entry.trustedHash)
  }

  runCli(pkgRoot, home, ['cleanup'])

  assert.match(readText(join(home, '.codex', 'config.toml')), new RegExp(`model_instructions_file = "${userAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.equal(readText(join(home, '.codex', 'AGENTS.md')), '# Codex custom\n')
  assert.doesNotMatch(readText(join(home, '.codex', 'config.toml')), /plan-mode-prompt/)
  assert.ok(!existsSync(join(home, '.codex', 'hooks.json')))
  assert.equal(readCodexHookStateSections(readText(join(home, '.codex', 'config.toml'))).filter((section) => section.managed).length, 0)
})

test('Codex standby merges standalone hooks without writing hook blocks into config.toml', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'hooks.json'),
    JSON.stringify({
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'node "other.mjs"', timeout: 1 }],
          },
        ],
      },
    }, null, 2) + '\n',
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const config = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(config, /codex_hooks\s*=/)
  assert.doesNotMatch(config, /^\s*hooks\s*=/m)
  assert.doesNotMatch(config, /hooks-codex/)
  assert.doesNotMatch(config, /UserPromptSubmit/)

  const installedHooks = JSON.parse(readText(join(home, '.codex', 'hooks.json')))
  assert.match(JSON.stringify(installedHooks), /node \\"other\.mjs\\"/)
  assert.match(JSON.stringify(installedHooks), /helloagents-js notify inject --codex --silent/)
  assert.match(JSON.stringify(installedHooks), /helloagents-js notify stop --codex/)
  const managedHookTrust = readManagedHookTrust(home)
  assert.equal(managedHookTrust.sections.length, managedHookTrust.expected.length)

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleanedHooks = JSON.parse(readText(join(home, '.codex', 'hooks.json')))
  assert.match(JSON.stringify(cleanedHooks), /node \\"other\.mjs\\"/)
  assert.doesNotMatch(JSON.stringify(cleanedHooks), /helloagents/)
  const configPath = join(home, '.codex', 'config.toml')
  assert.equal(
    existsSync(configPath)
      ? readCodexHookStateSections(readText(configPath)).filter((section) => section.managed).length
      : 0,
    0,
  )
})

test('Codex global also installs standalone hooks outside config.toml', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--global'])

  const config = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(config, /codex_hooks\s*=/)
  assert.doesNotMatch(config, /^\s*hooks\s*=/m)
  assert.doesNotMatch(config, /UserPromptSubmit/)

  const installedHooks = JSON.parse(readText(join(home, '.codex', 'hooks.json')))
  assert.match(JSON.stringify(installedHooks), /helloagents-js notify route --codex --silent/)
  const managedHookTrust = readManagedHookTrust(home)
  assert.equal(managedHookTrust.sections.length, managedHookTrust.expected.length)

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  assert.ok(!existsSync(join(home, '.codex', 'hooks.json')))
})

test('Codex reinstall preserves a disabled managed hook state while refreshing trust hashes', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const configPath = join(home, '.codex', 'config.toml')
  const managedHookTrust = readManagedHookTrust(home)
  const sessionStartKey = managedHookTrust.expected.find((entry) => entry.key.includes(':session_start:'))?.key
  assert.ok(sessionStartKey)

  writeText(
    configPath,
    readText(configPath).replace(
      `[hooks.state."${sessionStartKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]\ntrusted_hash = `,
      `[hooks.state."${sessionStartKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]\nenabled = false\ntrusted_hash = `,
    ),
  )

  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const sections = readCodexHookStateSections(readText(configPath))
  const sessionStartState = sections.find((section) => section.key === sessionStartKey)
  assert.equal(sessionStartState?.enabled, false)
  assert.equal(sessionStartState?.managed, true)
  assert.match(readText(configPath), /trusted_hash = "sha256:[0-9a-f]+" # helloagents-managed/)
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
  assert.ok(installedConfig.startsWith([
    'model_instructions_file = "~/.codex/AGENTS.md" # helloagents-managed',
    MANAGED_NOTIFY_LINE,
    '',
    'approval_policy = "never"',
    'sandbox_mode = "danger-full-access"',
    '',
    '[features]',
    'experimental = true',
    '',
  ].join('\n')), installedConfig)
  assert.match(installedConfig, /\[tui\]\nnotifications = \["plan-mode-prompt"\] # helloagents-managed/)
})

test('Codex install does not override user-owned TUI notifications', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[tui]',
      'notifications = ["agent-turn-complete", "approval-requested"]',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(installedConfig, /\[tui\]\nnotifications = \["agent-turn-complete", "approval-requested"\]/)
  assert.doesNotMatch(installedConfig, new RegExp(CODEX_MANAGED_TUI_NOTIFICATIONS_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleanedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleanedConfig, /\[tui\]\nnotifications = \["agent-turn-complete", "approval-requested"\]/)
})

test('Codex install removes legacy managed codex_hooks and preserves user-owned legacy keys', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[features]',
      'codex_hooks = true # helloagents-managed',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  let config = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(config, /codex_hooks/)
  assert.match(config, /experimental = true/)

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  let cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /\[features\]/)
  assert.match(cleaned, /experimental = true/)
  assert.doesNotMatch(cleaned, /helloagents-managed/)

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[features]',
      'codex_hooks = false',
      'experimental = true',
      '',
    ].join('\n'),
  )
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])
  config = readText(join(home, '.codex', 'config.toml'))
  assert.match(config, /codex_hooks = false/)
  assert.doesNotMatch(config, /codex_hooks = true # helloagents-managed/)

  runCli(pkgRoot, home, ['cleanup', 'codex'])
  cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /codex_hooks = false/)
})

test('Codex goals command explicitly manages latest Codex goals feature', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  let result = runCli(pkgRoot, home, ['codex', 'goals', 'status', '--json'])
  let status = JSON.parse(result.stdout)
  assert.equal(status.enabled, false)
  assert.equal(status.configured, false)

  runCli(pkgRoot, home, ['codex', 'goals', 'enable'])
  let config = readText(join(home, '.codex', 'config.toml'))
  assert.match(config, new RegExp(CODEX_MANAGED_GOALS_FEATURE_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(config, /experimental = true/)

  result = runCli(pkgRoot, home, ['codex', 'goals', 'status', '--json'])
  status = JSON.parse(result.stdout)
  assert.equal(status.enabled, true)
  assert.equal(status.managed, true)

  runCli(pkgRoot, home, ['codex', 'goals', 'disable'])
  config = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(config, /^\s*goals\s*=/m)
  assert.match(config, /experimental = true/)
})

test('Codex standby replaces existing top-level notify with the managed command', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'notify = ["node", "C:/custom/notify.mjs", "custom-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  assert.ok(installedConfig.includes(MANAGED_NOTIFY_LINE), installedConfig)
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
  assert.match(installedConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)

  runCli(pkgRoot, home, ['cleanup'])

  const restoredConfig = readText(join(home, '.codex', 'config.toml'))
  assert.match(restoredConfig, /^developer_instructions = """\nuser custom instructions\n"""/)
})

test('Codex cleanup preserves user-owned config replacements written after install', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'model_instructions_file = "C:/original/bootstrap.md"',
      'notify = ["node", "C:/original/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--global'])

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'model_instructions_file = "D:/custom/AGENTS.md"',
      'notify = ["node", "D:/custom/notify.mjs", "custom-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      'experimental = true',
      '',
      '[plugins."helloagents@local-plugins"]',
      'enabled = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /model_instructions_file = "D:\/custom\/AGENTS\.md"/)
  assert.match(cleaned, /notify = \["node", "D:\/custom\/notify\.mjs", "custom-notify"\]/)
  assert.match(cleaned, /codex_hooks = true/)
  assert.doesNotMatch(cleaned, /C:\/original\/bootstrap\.md/)
  assert.doesNotMatch(cleaned, /\[plugins\."helloagents@local-plugins"\]/)
})

test('Codex cleanup restores user-owned notify even when it uses codex-notify', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'notify = ["node", "C:/tools/custom-notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])
  assert.match(readText(join(home, '.codex', 'config.toml')), /# helloagents-managed/)

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /notify = \["node", "C:\/tools\/custom-notify\.mjs", "codex-notify"\]/)
  assert.doesNotMatch(cleaned, /helloagents-managed/)
})

test('Codex install and cleanup preserve multiline user notify arrays', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'notify = [',
      '  "node",',
      '  "C:/tools/custom-notify.mjs",',
      '  "custom-notify"',
      ']',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installed = readText(join(home, '.codex', 'config.toml'))
  assert.doesNotMatch(installed, /"C:\/tools\/custom-notify\.mjs",\n\s+"custom-notify"\n\]/)
  assert.ok(installed.includes(MANAGED_NOTIFY_LINE), installed)

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const cleaned = readText(join(home, '.codex', 'config.toml'))
  assert.match(cleaned, /notify = \[\n  "node",\n  "C:\/tools\/custom-notify\.mjs",\n  "custom-notify"\n\]/)
  assert.match(cleaned, /\[features\]\nexperimental = true/)
})

test('Codex cleanup preserves a user-owned marketplace file after removing helloagents', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--global'])
  writeText(
    join(home, '.agents', 'plugins', 'marketplace.json'),
    JSON.stringify({
      name: 'my-local-marketplace',
      interface: {
        displayName: 'My Local Marketplace',
      },
      plugins: [
        {
          name: 'helloagents',
          source: {
            source: 'local',
            path: './plugins/helloagents',
          },
        },
      ],
    }, null, 2) + '\n',
  )

  runCli(pkgRoot, home, ['cleanup', 'codex'])

  const marketplace = JSON.parse(readText(join(home, '.agents', 'plugins', 'marketplace.json')))
  assert.equal(marketplace.name, 'my-local-marketplace')
  assert.deepEqual(marketplace.plugins, [])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, realpathSync } from 'node:fs'
import { delimiter, join } from 'node:path'

import { getClaudeMarketplaceRoot, getCursorInstallRoot, getCursorPluginRoot, getGeminiExtensionRoot, getGrokMarketplaceRoot } from '../scripts/cli-runtime-root.mjs'
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
  assert.ok(!existsSync(join(home, '.helloagents', 'helloagents', 'hooks', 'hooks.json')))
  assert.ok(!existsSync(join(pluginRoot, 'hooks', 'hooks.json')))
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_PROFILE: full/)
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /HELLOAGENTS_PROFILE: full/)
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
  assert.equal(settings.host_install_modes.cursor, 'standby')
  assert.equal(settings.host_install_modes.codex, 'standby')
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(existsSync(join(home, '.cursor', 'helloagents')))
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
  assert.equal(settings.host_install_modes.cursor, 'global')
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
  const claudeMarketplaceRoot = getClaudeMarketplaceRoot(home)
  const geminiExtensionRoot = getGeminiExtensionRoot(home)

  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const geminiCommand = writeFakeCommand(fakeBin, 'gemini', geminiLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  const result = runCli(pkgRoot, home, ['install', '--all', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })
  assert.doesNotMatch(result.stderr || '', /DEP0190/)

  assert.match(readText(claudeLog), /plugin marketplace add .*host-projections[\\/]+claude-marketplace/)
  assert.match(readText(claudeLog), /plugin install helloagents@helloagents --scope user/)
  assert.match(readText(geminiLog), /extensions link .*host-projections[\\/]+gemini/)
  assert.ok(existsSync(claudeMarketplaceRoot))
  assert.ok(existsSync(join(geminiExtensionRoot, 'hooks', 'hooks.json')))
  assert.ok(!existsSync(join(home, '.helloagents', 'helloagents', 'hooks', 'hooks.json')))
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.claude, 'global')
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.gemini, 'global')
})

test('single-host Grok standby install writes native AGENTS carrier, runtime link, and global hooks file', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'grok', '--standby'])

  assert.match(readText(join(home, '.grok', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.ok(existsSync(join(home, '.grok', 'helloagents')))
  assert.match(readText(join(home, '.grok', 'hooks', 'helloagents.json')), /helloagents-js notify inject --grok/)
  assert.match(readText(join(home, '.grok', 'hooks', 'helloagents.json')), /helloagents-js guard --grok/)
  assert.equal(readJson(configFile).host_install_modes.grok, 'standby')

  runCli(pkgRoot, home, ['cleanup', 'grok'])

  assert.doesNotMatch(readText(join(home, '.grok', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.ok(!existsSync(join(home, '.grok', 'helloagents')))
  assert.ok(!existsSync(join(home, '.grok', 'hooks', 'helloagents.json')))
  assert.match(readText(join(home, '.grok', 'hooks', 'keep.json')), /other-grok\.mjs/)
  assert.equal(readJson(configFile).host_install_modes.grok, undefined)
})

test('cleanup grok removes a leftover reserved helloagents hook file even when no mode is tracked', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.grok', 'hooks', 'helloagents.json'), JSON.stringify({
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: 'command', command: 'echo home-grok' }],
        },
      ],
    },
  }, null, 2) + '\n')

  runCli(pkgRoot, home, ['cleanup', 'grok'])

  assert.ok(!existsSync(join(home, '.grok', 'hooks', 'helloagents.json')))
})

test('single-host Cursor standby install writes runtime link and managed hooks into ~/.cursor/hooks.json', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'cursor', '--standby'])

  assert.ok(existsSync(join(home, '.cursor', 'helloagents')))
  const cursorHooks = JSON.stringify(readJson(join(home, '.cursor', 'hooks.json')))
  assert.match(cursorHooks, /helloagents-js cursor-hook session-start/)
  assert.match(cursorHooks, /helloagents-js cursor-hook stop/)
  assert.match(cursorHooks, /other-cursor\.mjs/)
  assert.equal(readJson(configFile).host_install_modes.cursor, 'standby')

  runCli(pkgRoot, home, ['cleanup', 'cursor'])

  assert.ok(!existsSync(join(home, '.cursor', 'helloagents')))
  const cleanedHooks = JSON.stringify(readJson(join(home, '.cursor', 'hooks.json')))
  assert.doesNotMatch(cleanedHooks, /helloagents-js cursor-hook/)
  assert.match(cleanedHooks, /other-cursor\.mjs/)
  assert.equal(readJson(configFile).host_install_modes.cursor, undefined)
})

test('single-host Cursor global install materializes a local-plugin projection and copies it into ~/.cursor/plugins/local', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const projectionRoot = getCursorPluginRoot(home)
  const installRoot = getCursorInstallRoot(home)
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'cursor', '--global'])

  assert.ok(existsSync(join(projectionRoot, '.cursor-plugin', 'plugin.json')))
  assert.ok(existsSync(join(projectionRoot, 'hooks', 'hooks-cursor.json')))
  assert.ok(existsSync(installRoot))
  assert.ok(existsSync(join(installRoot, '.cursor-plugin', 'plugin.json')))
  assert.ok(existsSync(join(installRoot, 'hooks', 'hooks-cursor.json')))
  assert.notEqual(realpathSync(installRoot), realpathSync(projectionRoot))
  assert.ok(!existsSync(join(home, '.cursor', 'helloagents')))
  assert.equal(readJson(configFile).host_install_modes.cursor, 'global')
})

test('single-host Cursor standby install removes the tracked Cursor local plugin before writing standby files', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'cursor', '--global'])
  runCli(pkgRoot, home, ['install', 'cursor', '--standby'])

  assert.ok(!existsSync(getCursorInstallRoot(home)))
  assert.ok(!existsSync(getCursorPluginRoot(home)))
  assert.ok(existsSync(join(home, '.cursor', 'helloagents')))
  assert.match(JSON.stringify(readJson(join(home, '.cursor', 'hooks.json'))), /helloagents-js cursor-hook session-start/)
  assert.equal(readJson(configFile).host_install_modes.cursor, 'standby')
})

test('single-host Grok global install materializes a marketplace projection and runs native grok commands', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-grok-bin-')
  const grokLog = join(home, 'grok.log')
  const grokCommand = writeFakeCommand(fakeBin, 'grok', grokLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  const marketplaceRoot = getGrokMarketplaceRoot(home)

  seedHostConfigs(home)
  runCli(pkgRoot, home, ['install', 'grok', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GROK_CMD: grokCommand,
  })

  assert.match(readText(grokLog), /plugin uninstall helloagents --confirm/)
  assert.match(readText(grokLog), /plugin marketplace remove .*helloagents-grok-marketplace/)
  assert.match(readText(grokLog), /plugin marketplace add .*helloagents-grok-marketplace/)
  assert.match(readText(grokLog), /plugin install .*plugins[\\/]+helloagents --trust/)
  assert.ok(existsSync(join(marketplaceRoot, '.grok-plugin', 'marketplace.json')))
  assert.ok(existsSync(join(marketplaceRoot, '.grok-plugin', 'plugin-index.json')))
  assert.ok(existsSync(join(marketplaceRoot, '.claude-plugin', 'marketplace.json')))
  assert.ok(existsSync(join(marketplaceRoot, 'plugins', 'helloagents', 'hooks', 'hooks.json')))
  assert.ok(!existsSync(join(home, '.grok', 'helloagents')))
  assert.equal(readJson(configFile).host_install_modes.grok, 'global')
})

test('single-host Grok standby install removes the tracked Grok global plugin before writing standby files', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-grok-standby-bin-')
  const grokLog = join(home, 'grok-standby.log')
  const grokCommand = writeFakeCommand(fakeBin, 'grok', grokLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'grok', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GROK_CMD: grokCommand,
  })

  runCli(pkgRoot, home, ['install', 'grok', '--standby'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GROK_CMD: grokCommand,
  })

  assert.match(readText(grokLog), /plugin install .*plugins[\\/]+helloagents --trust/)
  assert.match(readText(grokLog), /plugin uninstall helloagents --confirm/)
  assert.match(readText(grokLog), /plugin marketplace remove .*helloagents-grok-marketplace/)
  assert.ok(!existsSync(getGrokMarketplaceRoot(home)))
  assert.ok(existsSync(join(home, '.grok', 'helloagents')))
  assert.match(readText(join(home, '.grok', 'AGENTS.md')), /HELLOAGENTS_START/)
  assert.equal(readJson(configFile).host_install_modes.grok, 'standby')
})

test('cleanup claude --global runs native removal and clears only Claude tracked mode', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-fake-bin-')
  const claudeLog = join(home, 'claude-cleanup.log')
  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'claude', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })
  runCli(pkgRoot, home, ['install', 'codex', '--global'])

  runCli(pkgRoot, home, ['cleanup', 'claude', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })

  assert.match(readText(claudeLog), /plugin remove helloagents/)
  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.claude, undefined)
  assert.equal(settings.host_install_modes.codex, 'global')
})

test('uninstall gemini reuses tracked global mode and runs native removal', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-fake-bin-')
  const geminiLog = join(home, 'gemini-uninstall.log')
  const geminiCommand = writeFakeCommand(fakeBin, 'gemini', geminiLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'gemini', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })
  runCli(pkgRoot, home, ['install', 'claude'])

  runCli(pkgRoot, home, ['uninstall', 'gemini'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })

  assert.match(readText(geminiLog), /extensions uninstall helloagents/)
  assert.ok(!existsSync(getGeminiExtensionRoot(home)))
  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.gemini, undefined)
  assert.equal(settings.host_install_modes.claude, 'standby')
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
  assert.ok(existsSync(getClaudeMarketplaceRoot(home)))
})

test('single-host standby install removes the tracked Claude global plugin before writing standby files', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-claude-standby-bin-')
  const claudeLog = join(home, 'claude-standby.log')
  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  const globalResult = runCli(pkgRoot, home, ['install', 'claude', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })
  assert.doesNotMatch(globalResult.stderr || '', /DEP0190/)

  const standbyResult = runCli(pkgRoot, home, ['install', 'claude', '--standby'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })
  assert.doesNotMatch(standbyResult.stderr || '', /DEP0190/)

  assert.match(readText(claudeLog), /plugin marketplace add .*host-projections[\\/]+claude-marketplace/)
  assert.match(readText(claudeLog), /plugin install helloagents@helloagents --scope user/)
  assert.match(readText(claudeLog), /plugin remove helloagents/)
  assert.ok(!existsSync(getClaudeMarketplaceRoot(home)))
  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/)
  assert.equal(readJson(configFile).host_install_modes.claude, 'standby')
})

test('failed Claude global cleanup keeps the tracked global mode and skips standby injection', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-claude-failover-bin-')
  const claudeLog = join(home, 'claude-failover.log')
  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'claude', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })

  runCli(pkgRoot, home, ['install', 'claude', '--standby'], {
    HELLOAGENTS_CLAUDE_CMD: join(home, 'missing-claude.cmd'),
  })

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.claude, 'global')
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/)
  assert.match(readText(claudeLog), /plugin marketplace add .*host-projections[\\/]+claude-marketplace/)
  assert.match(readText(claudeLog), /plugin install helloagents@helloagents --scope user/)
  assert.ok(existsSync(getClaudeMarketplaceRoot(home)))
})

test('failed Gemini global cleanup keeps the tracked global mode', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  const fakeBin = createTempDir('helloagents-gemini-failover-bin-')
  const geminiLog = join(home, 'gemini-failover.log')
  const geminiCommand = writeFakeCommand(fakeBin, 'gemini', geminiLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['install', 'gemini', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })

  runCli(pkgRoot, home, ['cleanup', 'gemini', '--global'], {
    HELLOAGENTS_GEMINI_CMD: join(home, 'missing-gemini.cmd'),
  })

  const settings = readJson(configFile)
  assert.equal(settings.host_install_modes.gemini, 'global')
  assert.match(readText(geminiLog), /extensions link .*host-projections[\\/]+gemini/)
})

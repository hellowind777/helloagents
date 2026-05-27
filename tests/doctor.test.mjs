import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, rmSync } from 'node:fs'
import { delimiter, join } from 'node:path'

import { getGeminiExtensionRoot } from '../scripts/cli-runtime-root.mjs'
import { createLink } from '../scripts/cli-utils.mjs'
import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs'

function runCli(pkgRoot, home, args, env = {}) {
  const result = runNode(join(pkgRoot, 'cli.mjs'), args, {
    cwd: pkgRoot,
    env: {
      ...buildHomeEnv(home),
      LANG: 'en_US.UTF-8',
      ...env,
    },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

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

test('doctor reports codex standby health and detects drift in JSON mode', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  let result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  let report = JSON.parse(result.stdout)
  let codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'ok')
  assert.equal(codex.detectedMode, 'standby')
  assert.equal(codex.trackedMode, 'standby')
  assert.equal(codex.checks.carrierMarker, true)
  assert.equal(codex.checks.carrierContentMatch, true)
  assert.equal(codex.checks.homeLink, true)
  assert.equal(codex.checks.modelInstructionsFile, true)
  assert.equal(codex.checks.modelInstructionsPathMatch, true)
  assert.equal(codex.checks.codexNotify, true)
  assert.equal(codex.checks.notifyPathMatch, true)
  assert.equal(codex.checks.codexHooksFeature, true)
  assert.equal(codex.checks.codexGoalsFeature, false)
  assert.ok(codex.notes.some((note) => /Codex \/goal/.test(note)))
  assert.equal(codex.checks.standaloneHooks, true)
  assert.equal(codex.checks.standaloneHooksMatch, true)
  assert.equal(codex.checks.managedHookTrust, true)
  assert.equal(codex.checks.managedHookTrustMatch, true)
  assert.equal(typeof codex.nativeDoctor?.available, 'boolean')
  if (codex.nativeDoctor?.available) {
    assert.equal(typeof codex.nativeDoctor.ok, 'boolean')
    assert.equal(Array.isArray(codex.nativeDoctor.summary?.skillsSelected), true)
  }

  rmSync(join(home, '.codex', 'helloagents'), { recursive: true, force: true })

  result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  report = JSON.parse(result.stdout)
  codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.ok(codex.issues.some((issue) => issue.code === 'standby-link-missing'))
})

test('doctor accepts Codex Computer Use wrapped notify without reporting drift', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const installedConfig = readText(join(home, '.codex', 'config.toml'))
  writeText(
    join(home, '.codex', 'config.toml'),
    installedConfig.replace(
      /notify = \["helloagents-js", "codex-notify"\] # helloagents-managed/,
      [
        'notify = [',
        '  "/Users/test/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",',
        '  "turn-ended",',
        '  "--previous-notify",',
        '  "[\\"helloagents-js\\",\\"codex-notify\\"]"',
        ']',
      ].join('\n'),
    ),
  )

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'ok')
  assert.equal(codex.checks.codexNotify, true)
  assert.equal(codex.checks.notifyPathMatch, true)
  assert.equal(codex.checks.notifyShape, 'chained')
  assert.ok(codex.notes.some((note) => /chained/i.test(note)))
  assert.ok(!codex.issues.some((issue) => issue.code === 'standby-notify-drift'))
})

test('doctor detects standby carrier and hook drift for gemini content mismatches', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'gemini', '--standby'])

  let result = runCli(pkgRoot, home, ['doctor', 'gemini', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  let report = JSON.parse(result.stdout)
  let gemini = report.hosts.find((entry) => entry.host === 'gemini')

  assert.equal(gemini.status, 'ok')
  assert.equal(gemini.checks.carrierContentMatch, true)
  assert.equal(gemini.checks.settingsHooksMatch, true)

  writeText(join(home, '.gemini', 'GEMINI.md'), '<!-- HELLOAGENTS_START -->\n# stale carrier\n<!-- HELLOAGENTS_END -->\n')
  writeText(
    join(home, '.gemini', 'settings.json'),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: `node "${pkgRoot.replace(/\\/g, '/')}\/scripts\/notify.mjs" inject --gemini`,
                timeout: 10000,
              },
            ],
          },
        ],
      },
    }, null, 2) + '\n',
  )

  result = runCli(pkgRoot, home, ['doctor', 'gemini', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  report = JSON.parse(result.stdout)
  gemini = report.hosts.find((entry) => entry.host === 'gemini')

  assert.equal(gemini.status, 'drift')
  assert.ok(gemini.issues.some((issue) => issue.code === 'standby-carrier-drift'))
  assert.ok(gemini.issues.some((issue) => issue.code === 'standby-hooks-drift'))
})

test('doctor reports Claude global health from installed-plugin metadata and local marketplace projection', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const fakeBin = createTempDir('helloagents-claude-doctor-bin-')
  const claudeLog = join(home, 'claude-doctor.log')
  const claudeCommand = writeFakeCommand(fakeBin, 'claude', claudeLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'claude', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_CLAUDE_CMD: claudeCommand,
  })

  writeJson(join(home, '.claude', 'settings.json'), {
    enabledPlugins: {
      'helloagents@helloagents': true,
    },
  })
  writeJson(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    version: 2,
    plugins: {
      'helloagents@helloagents': [
        {
          scope: 'user',
          installPath: 'C:\\helloagents-test\\installed',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00.000Z',
          lastUpdated: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  })

  const result = runCli(pkgRoot, home, ['doctor', 'claude', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const claude = report.hosts.find((entry) => entry.host === 'claude')

  assert.equal(claude.status, 'ok')
  assert.equal(claude.detectedMode, 'global')
  assert.equal(claude.trackedMode, 'global')
  assert.equal(claude.checks.globalMarketplaceRoot, true)
  assert.equal(claude.checks.globalPluginInstalled, true)
  assert.equal(claude.issues.length, 0)
})

test('doctor reports Gemini global health from extension link projection', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const fakeBin = createTempDir('helloagents-gemini-doctor-bin-')
  const geminiLog = join(home, 'gemini-doctor.log')
  const geminiCommand = writeFakeCommand(fakeBin, 'gemini', geminiLog)
  const testPath = `${fakeBin}${delimiter}${process.env.PATH || process.env.Path || ''}`
  const extensionRoot = getGeminiExtensionRoot(home)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'gemini', '--global'], {
    PATH: testPath,
    Path: testPath,
    HELLOAGENTS_GEMINI_CMD: geminiCommand,
  })
  assert.equal(createLink(extensionRoot, join(home, '.gemini', 'extensions', 'helloagents')), true)

  const result = runCli(pkgRoot, home, ['doctor', 'gemini', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const gemini = report.hosts.find((entry) => entry.host === 'gemini')

  assert.equal(gemini.status, 'ok')
  assert.equal(gemini.detectedMode, 'global')
  assert.equal(gemini.trackedMode, 'global')
  assert.equal(gemini.checks.globalExtensionRoot, true)
  assert.equal(gemini.checks.globalExtensionInstall, true)
  assert.equal(gemini.checks.globalExtensionLink, true)
  assert.equal(gemini.issues.length, 0)
})

test('doctor ignores a stale Claude marketplace record when no plugin or standby artifacts are active', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  runCli(pkgRoot, home, ['postinstall'])
  writeJson(join(home, '.claude', 'settings.json'), {
    extraKnownMarketplaces: {
      helloagents: {
        source: {
          source: 'local',
          path: 'C:\\stale\\helloagents',
        },
      },
    },
  })

  const result = runCli(pkgRoot, home, ['doctor', 'claude', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const claude = report.hosts.find((entry) => entry.host === 'claude')

  assert.equal(claude.detectedMode, 'none')
  assert.equal(claude.status, 'not-installed')
  assert.equal(claude.issues.length, 0)
})

test('doctor reports codex global health with a home carrier baseline', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--global'])

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'ok')
  assert.equal(codex.detectedMode, 'global')
  assert.equal(codex.trackedMode, 'global')
  assert.equal(codex.checks.carrierMarker, true)
  assert.equal(codex.checks.carrierContentMatch, true)
  assert.equal(codex.checks.homeLink, true)
  assert.equal(codex.checks.globalHomeLink, true)
  assert.equal(codex.checks.modelInstructionsFile, true)
  assert.equal(codex.checks.modelInstructionsPathMatch, true)
  assert.equal(codex.checks.codexHooksFeature, true)
  assert.equal(codex.checks.codexGoalsFeature, false)
  assert.equal(codex.checks.pluginRoot, true)
  assert.equal(codex.checks.pluginCache, true)
  assert.equal(codex.checks.pluginRootLink, true)
  assert.equal(codex.checks.pluginCacheLink, true)
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_PROFILE: full/)
  assert.equal(codex.checks.standaloneHooks, true)
  assert.equal(codex.checks.standaloneHooksMatch, true)
  assert.equal(codex.checks.managedHookTrust, true)
  assert.equal(codex.checks.managedHookTrustMatch, true)
  assert.equal(typeof codex.nativeDoctor?.available, 'boolean')
})

test('doctor treats latest Codex hooks=false as drift', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[features]',
      'hooks = false',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.equal(codex.checks.codexHooksFeature, false)
  assert.ok(codex.issues.some((issue) => issue.code === 'codex-hooks-feature-disabled'))
})

test('doctor flags missing codex hook trust as drift', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  writeText(
    join(home, '.codex', 'config.toml'),
    readText(join(home, '.codex', 'config.toml'))
      .split('\n')
      .filter((line) => !line.includes('trusted_hash = "') || !line.includes('helloagents-managed'))
      .join('\n'),
  )

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.equal(codex.checks.managedHookTrust, false)
  assert.ok(codex.issues.some((issue) => issue.code === 'standby-hook-trust-missing'))
  assert.ok(codex.issues.some((issue) => /machine-local hook trust metadata/.test(issue.message)))
})

test('doctor reports native Codex doctor when codex.cmd is available on Windows', { skip: process.platform !== 'win32' }, () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  assert.doesNotMatch(result.stderr || '', /DEP0190/)
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.nativeDoctor.available, true)
})

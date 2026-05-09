import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  readText,
  runNode,
  writeText,
} from './helpers/test-env.mjs'

function runCli(pkgRoot, home, args) {
  const result = runNode(join(pkgRoot, 'cli.mjs'), args, {
    cwd: pkgRoot,
    env: {
      ...buildHomeEnv(home),
      LANG: 'en_US.UTF-8',
    },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result
}

test('doctor reports codex standby health and detects drift in JSON mode', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  let result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
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

  rmSync(join(home, '.codex', 'helloagents'), { recursive: true, force: true })

  result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  report = JSON.parse(result.stdout)
  codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.ok(codex.issues.some((issue) => issue.code === 'standby-link-missing'))
})

test('doctor detects standby carrier and hook drift for gemini content mismatches', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'gemini', '--standby'])

  let result = runCli(pkgRoot, home, ['doctor', 'gemini', '--json'])
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
  report = JSON.parse(result.stdout)
  gemini = report.hosts.find((entry) => entry.host === 'gemini')

  assert.equal(gemini.status, 'drift')
  assert.ok(gemini.issues.some((issue) => issue.code === 'standby-carrier-drift'))
  assert.ok(gemini.issues.some((issue) => issue.code === 'standby-hooks-drift'))
})

test('doctor reports codex global health with a home carrier baseline', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(join(home, '.codex', 'config.toml'), '[features]\nunified_exec = true\n')

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--global'])

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
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
  assert.equal(codex.checks.standaloneHooks, true)
  assert.equal(codex.checks.standaloneHooksMatch, true)
  assert.equal(codex.checks.managedHookTrust, true)
  assert.equal(codex.checks.managedHookTrustMatch, true)
})

test('doctor treats latest Codex hooks=false as drift and legacy codex_hooks as a note', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      '[features]',
      'hooks = false',
      'codex_hooks = true',
      '',
    ].join('\n'),
  )

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.equal(codex.checks.codexHooksFeature, false)
  assert.equal(codex.checks.legacyCodexHooksFeature, true)
  assert.ok(codex.issues.some((issue) => issue.code === 'codex-hooks-feature-disabled'))
  assert.ok(codex.notes.some((note) => /codex_hooks/.test(note)))
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
  const report = JSON.parse(result.stdout)
  const codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.equal(codex.checks.managedHookTrust, false)
  assert.ok(codex.issues.some((issue) => issue.code === 'standby-hook-trust-missing'))
  assert.ok(codex.issues.some((issue) => /machine-local hook trust metadata/.test(issue.message)))
})

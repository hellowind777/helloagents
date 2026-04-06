import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
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
  assert.equal(codex.checks.homeLink, true)
  assert.equal(codex.checks.codexNotify, true)
  assert.equal(codex.checks.developerInstructions, true)

  rmSync(join(home, '.codex', 'helloagents'), { recursive: true, force: true })

  result = runCli(pkgRoot, home, ['doctor', 'codex', '--json'])
  report = JSON.parse(result.stdout)
  codex = report.hosts.find((entry) => entry.host === 'codex')

  assert.equal(codex.status, 'drift')
  assert.ok(codex.issues.some((issue) => issue.code === 'standby-link-missing'))
})

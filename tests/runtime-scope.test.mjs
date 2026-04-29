import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  REPO_ROOT,
  buildHomeEnv,
  createHomeFixture,
  createTempDir,
  runCommand,
  writeText,
} from './helpers/test-env.mjs'
import { writeSettings } from './helpers/runtime-test-helpers.mjs'
import { cleanupUserRuntimeRoot, getUserRuntimeRoot } from '../scripts/runtime-scope.mjs'

const RUNTIME_SCOPE_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'runtime-scope.mjs')).href
const RUNTIME_ARTIFACTS_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'runtime-artifacts.mjs')).href

function assertCommandOk(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function runModuleEval({ cwd, env, source }) {
  const result = runCommand(process.execPath, ['--input-type=module', '-e', source], {
    cwd,
    env,
  })
  assertCommandOk(result)
  return result.stdout ? JSON.parse(result.stdout) : null
}

test('home-level settings directory is not treated as an activated project', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  writeSettings(home)

  const payload = runModuleEval({
    cwd: home,
    env,
    source: `
      const { getRuntimeScope, isProjectRuntimeActive } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(home)}, { payload: { sessionId: 'abc123' } })
      process.stdout.write(JSON.stringify({
        active: isProjectRuntimeActive(${JSON.stringify(home)}),
        scope: scope.scope,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.active, false)
  assert.equal(payload.scope, 'user-runtime')
  assert.match(payload.sessionDir, /[\\/]\.helloagents[\\/]runtime[\\/]/)
})

test('activated project scope resolves from nested working directories', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-runtime-project-')
  const nested = join(project, 'packages', 'app')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(join(nested, 'index.js'), 'console.log("ok")\n')

  const payload = runModuleEval({
    cwd: nested,
    env,
    source: `
      const { getRuntimeScope, getProjectActivationDir } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(nested)}, { payload: { sessionId: 'abc123' } })
      process.stdout.write(JSON.stringify({
        scope: scope.scope,
        active: scope.active,
        cwd: scope.cwd,
        activationDir: getProjectActivationDir(${JSON.stringify(nested)}),
        statePath: scope.statePath,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.scope, 'project-session')
  assert.equal(payload.active, true)
  assert.equal(payload.cwd, project)
  assert.equal(payload.activationDir, join(project, '.helloagents'))
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', 'detached', 'abc123'))
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'detached', 'abc123', 'STATE.md'))
})

test('user runtime cleanup removes legacy flat files and expired transient sessions only', () => {
  const home = createHomeFixture()
  const runtimeRoot = getUserRuntimeRoot(home)
  const expiredDir = join(runtimeRoot, 'expired-session')
  const freshDir = join(runtimeRoot, 'fresh-session')
  const now = Date.now()
  const oldDate = new Date(now - 10 * 24 * 60 * 60 * 1000)

  writeText(join(runtimeRoot, 'turn-state.json'), '{}\n')
  writeText(join(runtimeRoot, 'replay-context.json'), '{}\n')
  writeText(join(expiredDir, 'capsule.json'), '{}\n')
  writeText(join(freshDir, 'capsule.json'), '{}\n')
  mkdirSync(expiredDir, { recursive: true })
  utimesSync(expiredDir, oldDate, oldDate)

  const result = cleanupUserRuntimeRoot({
    home,
    now,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  })

  assert.equal(result.errors.length, 0)
  assert.ok(!existsSync(join(runtimeRoot, 'turn-state.json')))
  assert.ok(!existsSync(join(runtimeRoot, 'replay-context.json')))
  assert.ok(!existsSync(expiredDir))
  assert.ok(existsSync(freshDir))
  assert.deepEqual(readdirSync(runtimeRoot).sort(), ['fresh-session'])
})

test('unactivated runtime artifacts stay in the user-level transient directory', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-runtime-transient-')

  writeSettings(home)

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { writeRuntimeEvidence } = await import(${JSON.stringify(RUNTIME_ARTIFACTS_MODULE_URL)})
      const path = writeRuntimeEvidence(
        ${JSON.stringify(project)},
        'verify.json',
        { updatedAt: new Date().toISOString(), commands: [] },
        { payload: { sessionId: 'abc123' } },
      )
      process.stdout.write(JSON.stringify({ path }))
    `,
  })

  assert.match(payload.path, /[\\/]\.helloagents[\\/]runtime[\\/][^\\/]+[\\/]artifacts[\\/]verify\.json$/)
  assert.equal(existsSync(join(project, '.helloagents')), false)
})

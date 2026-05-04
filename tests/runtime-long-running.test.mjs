import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'

import {
  createHomeFixture,
  createTempDir,
  readJson,
  runCommand,
  writeJson,
  writeText,
} from './helpers/test-env.mjs'
import { getSessionCapsulePath } from '../scripts/session-capsule.mjs'
import {
  UNBOUND_ROUTE_CONTEXT_TTL_MS,
  getApplicableRouteContext,
  writeRouteContext,
  readRouteContext,
} from '../scripts/runtime-context.mjs'
import { cleanupUserRuntimeRoot, USER_RUNTIME_MAX_AGE_MS } from '../scripts/runtime-scope.mjs'
import { writeTurnState, readTurnState } from '../scripts/turn-state.mjs'
import {
  captureWorkspaceFingerprint,
  EVIDENCE_MAX_AGE_MS,
} from '../scripts/runtime-artifacts.mjs'
import { getVerifyEvidenceStatus, writeVerifyEvidence } from '../scripts/verify-state.mjs'
import {
  LONG_RUNNING_TTL_HOURS,
  LONG_RUNNING_TTL_MS,
  ROUTE_CONTEXT_TTL_MS,
  TURN_STATE_TTL_MS,
} from '../scripts/runtime-ttl.mjs'

const HOURS = 60 * 60 * 1000
const SESSION_PAYLOAD = { sessionId: 'goal720', turnId: 'turn-long' }

function activateProject(project) {
  writeText(join(project, '.helloagents', '.keep'), '')
}

function writeCapsuleRouteUpdatedAt(project, updatedAt, payload = SESSION_PAYLOAD) {
  const capsulePath = getSessionCapsulePath(project, { payload })
  const capsule = readJson(capsulePath)
  capsule.route.updatedAt = updatedAt
  writeJson(capsulePath, capsule)
}

test('long-running runtime TTLs stay aligned for Codex goal sessions', () => {
  assert.equal(LONG_RUNNING_TTL_HOURS, 720)
  assert.equal(ROUTE_CONTEXT_TTL_MS, LONG_RUNNING_TTL_MS)
  assert.equal(TURN_STATE_TTL_MS, LONG_RUNNING_TTL_MS)
  assert.equal(EVIDENCE_MAX_AGE_MS, LONG_RUNNING_TTL_MS)
  assert.equal(USER_RUNTIME_MAX_AGE_MS, LONG_RUNNING_TTL_MS)
})

test('route context remains valid for long-running goal sessions', () => {
  const project = createTempDir('helloagents-goal-route-')
  activateProject(project)

  writeRouteContext({
    cwd: project,
    skillName: 'auto',
    payload: SESSION_PAYLOAD,
  })

  writeCapsuleRouteUpdatedAt(project, Date.now() - (LONG_RUNNING_TTL_HOURS - 1) * HOURS)
  assert.equal(readRouteContext({ cwd: project, payload: SESSION_PAYLOAD })?.skillName, 'auto')

  writeCapsuleRouteUpdatedAt(project, Date.now() - (LONG_RUNNING_TTL_HOURS + 1) * HOURS)
  assert.equal(readRouteContext({ cwd: project, payload: SESSION_PAYLOAD }), null)
})

test('route context is turn-bound so old explicit commands do not block later goal turns', () => {
  const project = createTempDir('helloagents-goal-turn-bound-')
  activateProject(project)

  writeRouteContext({
    cwd: project,
    skillName: 'auto',
    payload: {
      sessionId: 'goal-session',
      turnId: 'turn-1',
    },
  })

  assert.equal(
    getApplicableRouteContext({
      cwd: project,
      payload: {
        sessionId: 'goal-session',
        turnId: 'turn-1',
      },
    })?.skillName,
    'auto',
  )
  assert.equal(
    getApplicableRouteContext({
      cwd: project,
      payload: {
        sessionId: 'goal-session',
        turnId: 'turn-2',
      },
    }),
    null,
  )

  const gate = runCommand(process.execPath, [join(process.cwd(), 'scripts', 'turn-stop-gate.mjs')], {
    cwd: project,
    input: JSON.stringify({
      cwd: project,
      sessionId: 'goal-session',
      turnId: 'turn-2',
    }),
  })
  assert.equal(gate.status, 0, gate.stderr || gate.stdout)
  assert.equal(JSON.parse(gate.stdout).decision, 'continue')
})

test('unbound route context expires quickly even though bound routes support 720h turns', () => {
  const project = createTempDir('helloagents-unbound-route-')
  activateProject(project)

  writeRouteContext({
    cwd: project,
    skillName: 'auto',
    payload: {},
  })

  writeCapsuleRouteUpdatedAt(project, Date.now() - UNBOUND_ROUTE_CONTEXT_TTL_MS + 60_000, {})
  assert.equal(readRouteContext({ cwd: project, payload: {} })?.skillName, 'auto')

  writeCapsuleRouteUpdatedAt(project, Date.now() - UNBOUND_ROUTE_CONTEXT_TTL_MS - 60_000, {})
  assert.equal(readRouteContext({ cwd: project, payload: {} }), null)
})

test('turn-state and evidence stay valid across long-running goal sessions', () => {
  const project = createTempDir('helloagents-goal-evidence-')
  activateProject(project)
  writeJson(join(project, 'package.json'), {
    name: 'goal-evidence-project',
    scripts: {
      test: 'node -e "process.exit(0)"',
    },
  })

  const turn = writeTurnState(project, {
    ...SESSION_PAYLOAD,
    role: 'main',
    kind: 'complete',
    phase: 'verify',
  })
  const validNow = Date.parse(turn.updatedAt) + (LONG_RUNNING_TTL_HOURS - 1) * HOURS
  const staleNow = Date.parse(turn.updatedAt) + (LONG_RUNNING_TTL_HOURS + 1) * HOURS
  assert.equal(readTurnState(project, { now: validNow, payload: SESSION_PAYLOAD })?.kind, 'complete')

  writeVerifyEvidence(project, {
    commands: ['npm run test'],
    source: 'test',
  }, {
    payload: SESSION_PAYLOAD,
  })

  let status = getVerifyEvidenceStatus(project, {
    now: validNow,
    payload: SESSION_PAYLOAD,
  })
  assert.equal(status.status, 'valid')

  status = getVerifyEvidenceStatus(project, {
    now: staleNow,
    payload: SESSION_PAYLOAD,
  })
  assert.equal(status.status, 'stale-time')
  assert.match(status.details.join('\n'), /超过 720 小时/)
})

test('transient runtime cleanup keeps sessions inside the long-running TTL window', () => {
  const home = createHomeFixture()
  const runtimeRoot = join(home, '.helloagents', 'runtime')
  const freshDir = join(runtimeRoot, 'fresh-goal-session')
  const staleDir = join(runtimeRoot, 'stale-goal-session')
  const now = Date.now()
  const freshDate = new Date(now - (LONG_RUNNING_TTL_HOURS - 1) * HOURS)
  const staleDate = new Date(now - (LONG_RUNNING_TTL_HOURS + 1) * HOURS)

  writeText(join(freshDir, 'capsule.json'), '{}\n')
  writeText(join(staleDir, 'capsule.json'), '{}\n')
  utimesSync(freshDir, freshDate, freshDate)
  utimesSync(staleDir, staleDate, staleDate)

  const result = cleanupUserRuntimeRoot({ home, now })
  assert.equal(result.errors.length, 0)
  assert.deepEqual(result.removedExpiredDirs, [staleDir])
  assert.equal(existsSync(join(freshDir, 'capsule.json')), true)
})

test('workspace fingerprint includes git HEAD so committed changes invalidate old evidence', () => {
  const project = createTempDir('helloagents-fingerprint-head-')
  const assertOk = (result) => assert.equal(result.status, 0, result.stderr || result.stdout)

  assertOk(runCommand('git', ['init'], { cwd: project }))
  assertOk(runCommand('git', ['config', 'user.email', 'helloagents@example.test'], { cwd: project }))
  assertOk(runCommand('git', ['config', 'user.name', 'HelloAGENTS Test'], { cwd: project }))
  writeText(join(project, 'file.txt'), 'one\n')
  assertOk(runCommand('git', ['add', 'file.txt'], { cwd: project }))
  assertOk(runCommand('git', ['commit', '-m', 'test: initial'], { cwd: project }))
  const first = captureWorkspaceFingerprint(project)

  writeText(join(project, 'file.txt'), 'two\n')
  assertOk(runCommand('git', ['add', 'file.txt'], { cwd: project }))
  assertOk(runCommand('git', ['commit', '-m', 'test: update'], { cwd: project }))
  const second = captureWorkspaceFingerprint(project)

  assert.ok(first.head)
  assert.ok(second.head)
  assert.notEqual(first.head, second.head)
  assert.notEqual(first.combined, second.combined)
})

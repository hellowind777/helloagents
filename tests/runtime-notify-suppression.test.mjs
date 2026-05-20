import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  runNode,
  writeJson,
} from './helpers/test-env.mjs'
import { writeSettings } from './helpers/runtime-test-helpers.mjs'

function createNotificationSpy(home) {
  const logPath = join(home, 'notify-spy.log')
  return {
    logPath,
    env: {
      HELLOAGENTS_DISABLE_OS_NOTIFICATIONS: '',
      HELLOAGENTS_NOTIFY_TEST_LOG: logPath,
    },
  }
}

async function waitForLogLines(logPath, minLines = 1, timeoutMs = 1200) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(logPath)) {
      const lines = readText(logPath).trim().split('\n').filter(Boolean)
      if (lines.length >= minLines) return lines
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!existsSync(logPath)) return []
  return readText(logPath).trim().split('\n').filter(Boolean)
}

function managedStopHooks() {
  return {
    hooks: {
      Stop: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'helloagents-js notify stop --codex',
              timeout: 120,
            },
          ],
        },
      ],
    },
  }
}

test('notification spy captures at least one native transport path', async () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const spy = createNotificationSpy(home)
  const env = { ...buildHomeEnv(home), ...spy.env }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { notify_level: 3 })
  writeJson(join(home, '.codex', 'hooks.json'), managedStopHooks())

  const project = createTempDir('helloagents-main-notify-')
  const result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex_exec',
    cwd: project,
    sessionId: 'main-notify-1',
    inputMessages: ['主任务提示'],
    lastAssistantMessage: 'DONE',
  })], {
    cwd: project,
    env,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')
  const lines = await waitForLogLines(spy.logPath, 1)
  assert.ok(lines.length >= 1, lines.join('\n'))
})

test('managed codex notify keeps delegated child completions silent for sound and desktop transports', async () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const spy = createNotificationSpy(home)
  const env = { ...buildHomeEnv(home), ...spy.env }
  const project = createTempDir('helloagents-child-notify-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { notify_level: 3 })
  writeJson(join(home, '.codex', 'hooks.json'), managedStopHooks())

  const result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    cwd: project,
    sessionId: 'child-notify-1',
    inputMessages: ['局部子任务提示'],
    lastAssistantMessage: 'OK',
  })], {
    cwd: project,
    env,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')
  const lines = await waitForLogLines(spy.logPath, 1, 300)
  assert.deepEqual(lines, [])
})

test('codex stop keeps plain subagent handoff silent for sound and desktop transports', async () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const spy = createNotificationSpy(home)
  const env = { ...buildHomeEnv(home), ...spy.env }
  const project = createTempDir('helloagents-subagent-stop-silent-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { notify_level: 3 })

  const result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      sessionId: 'sub-stop-silent-1',
      isSubagent: true,
      parentAgentId: 'parent-1',
      lastAssistantMessage: 'OK',
    }),
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.deepEqual(JSON.parse(result.stdout), { suppressOutput: true })
  const lines = await waitForLogLines(spy.logPath, 1, 300)
  assert.deepEqual(lines, [])
})

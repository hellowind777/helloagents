import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveNotificationSource } from '../scripts/notify-source.mjs'
import { buildDesktopNotificationContent } from '../scripts/notify-ui.mjs'

test('notification source prefers explicit session identifiers and includes host plus project', () => {
  const source = resolveNotificationSource({
    host: 'codex',
    cwd: 'D:/GitHub/dev/helloagents',
    payload: {
      sessionId: 'session-abcdef123456',
    },
    env: {
      WT_SESSION: 'ignored-env-session',
    },
    ppid: 43210,
  })

  assert.equal(source.hostLabel, 'Codex')
  assert.equal(source.projectLabel, 'helloagents')
  assert.equal(source.sessionToken, 'abcdef12')
  assert.equal(source.sourceLabel, 'Codex · helloagents · 会话 abcdef12')
})

test('notification source falls back to terminal session env and then parent process id', () => {
  const envSource = resolveNotificationSource({
    host: 'claude',
    cwd: 'D:/GitHub/dev/demo-app',
    payload: {},
    env: {
      WT_SESSION: 'wt-session-abcdef',
    },
    ppid: 22222,
  })
  assert.equal(envSource.sourceLabel, 'Claude Code · demo-app · 会话 abcdef')

  const ppidSource = resolveNotificationSource({
    host: 'gemini',
    cwd: 'D:/GitHub/dev/demo-app',
    payload: {},
    env: {},
    ppid: 67890,
  })
  assert.equal(ppidSource.sourceLabel, 'Gemini · demo-app · 会话 67890')
})

test('desktop notification content keeps source label separate from event message', () => {
  const notification = buildDesktopNotificationContent('warning', {
    sourceLabel: 'Codex · helloagents · 会话 67890',
  })

  assert.equal(notification.title, 'HelloAgents 通知')
  assert.equal(notification.message, '出现问题')
  assert.equal(notification.body, 'Codex · helloagents · 会话 67890\n出现问题')
  assert.deepEqual(notification.toastLines, ['Codex · helloagents · 会话 67890', '出现问题'])
})

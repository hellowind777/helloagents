import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  runNode,
  writeText,
} from './helpers/test-env.mjs'
import { parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('codex notify gates only main complete turns from turn-state', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { output_format: true })
  writeText(
    join(project, '.helloagents', 'STATE.md'),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '完成当前审计收尾',
      '',
      '## 正在做什么',
      '整理当前方案包',
      '',
      '## 方案',
      '.helloagents/plans/202604100101_audit',
      '',
      '## 下一步',
      '补齐方案包并完成收尾',
      '',
    ].join('\n'),
  )
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'requirements.md'), '# audit requirements\n')
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'plan.md'), '# audit plan\n')
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'tasks.md'), '# audit tasks\n\n- [ ] still open\n')

  let result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'subagent',
      kind: 'complete',
      phase: 'verify',
    }),
  })
  parseStdoutJson(result)
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'plan',
    }),
  })
  parseStdoutJson(result)
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'consolidate',
    }),
  })
  parseStdoutJson(result)
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /unfinished tasks|missing a trustworthy structured contract/)

  result = runNode(notifyScript, ['route', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  parseStdoutJson(result)

  result = runNode(turnStateScript, ['read'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.state, null)
})

test('stop delivery gate prefers structured turn-state over completion text', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-stop-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: false })
  writeText(
    join(project, '.helloagents', 'plans', '202604200101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [ ] 收尾验证',
      '- [√] 已完成任务',
      '',
    ].join('\n'),
  )

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'clarify',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '当前任务已完成，等待您的下一步指示。',
    }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'consolidate',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '收尾摘要已写入。',
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /unfinished tasks/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  runNode,
} from './helpers/test-env.mjs'
import { parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

function routeExplicitAuto(notifyScript, project, env) {
  const result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      prompt: '~auto continue the current task until done',
    }),
  })
  parseStdoutJson(result)
}

function writeWaitingState(turnStateScript, project, env, reasonCategory, reason, blocker) {
  const result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'build',
      reasonCategory,
      reason,
      ...(blocker ? { blocker } : {}),
    }),
  })
  parseStdoutJson(result)
}

function writeCompleteState(turnStateScript, project, env) {
  const result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'verify',
    }),
  })
  parseStdoutJson(result)
}

test('stop blocks explicit auto soft handoff even with waiting turn-state', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-stop-auto-handoff-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  routeExplicitAuto(notifyScript, project, env)
  writeWaitingState(
    turnStateScript,
    project,
    env,
    'missing-input',
    '当前阶段已完成，等待用户下一步。',
  )

  const result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '我先停在这里，等你决定下一步。',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /blocker\.target/)
  assert.match(payload.reason, /显式 ~auto 本轮不应直接停下/)
})

test('stop allows explicit auto waiting when the blocker is concrete', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-stop-auto-concrete-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  routeExplicitAuto(notifyScript, project, env)
  writeWaitingState(
    turnStateScript,
    project,
    env,
    'missing-file',
    '缺少 tests/fixtures/input.csv 文件，无法继续生成基线结果。',
    {
      target: 'tests/fixtures/input.csv',
      evidence: '读取基线输入文件时文件不存在。',
      requiredAction: '用户补充该文件或确认改用其他输入路径。',
    },
  )

  const result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '缺少 tests/fixtures/input.csv 文件，无法继续。',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)
})

test('stop blocks explicit auto closeout when the final message repeats the HelloAGENTS title', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-stop-auto-duplicate-title-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  routeExplicitAuto(notifyScript, project, env)
  writeCompleteState(turnStateScript, project, env)

  const result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: [
        '✅【HelloAGENTS】- 已完成候选池刷新架构审计',
        '',
        '结论：你的判断是对的，但要分开看。',
        '',
        '✅【HelloAGENTS】- 已完成候选池刷新架构审计',
        '',
        '这里又重复了一次标题。',
        '',
        '🔄 下一步: 当前任务已完成；无后续动作。',
      ].join('\n'),
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /重复输出了 HelloAGENTS 标题/)
})

test('stop allows explicit auto closeout when the final message keeps a single HelloAGENTS wrapper', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-stop-auto-single-title-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  routeExplicitAuto(notifyScript, project, env)
  writeCompleteState(turnStateScript, project, env)

  const result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: [
        '✅【HelloAGENTS】- 已完成候选池刷新架构审计',
        '',
        '结论：你的判断基本成立，但根因在收尾契约缺少单次包装约束。',
        '',
        '## 根因',
        '收尾消息在同一条回复里重复输出了外层标题。',
        '',
        '## 修复',
        '把所有内容合并到同一个外层块内。',
        '',
        '🔄 下一步: 当前任务已完成；无后续动作。',
      ].join('\n'),
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)
})

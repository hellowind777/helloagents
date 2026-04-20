import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  listFiles,
  readText,
  runNode,
  writeText,
} from './helpers/test-env.mjs'
import { getSessionStatePath } from './helpers/runtime-test-helpers.mjs'

function readJsonl(filePath) {
  return readText(filePath)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

test('replay artifact stays inactive until project activation and records event-level sessions', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-replay-')
  const env = buildHomeEnv(home)
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const closeoutScript = join(pkgRoot, 'scripts', 'closeout-state.mjs')

  let result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(existsSync(join(project, '.helloagents', 'replay')), false)

  writeText(
    getSessionStatePath(project),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '完成结账流程规划',
      '',
      '## 正在做什么',
      '整理需求',
      '',
      '## 关键上下文',
      '（无）',
      '',
      '## 下一步',
      '继续 ~plan',
      '',
      '## 阻塞项',
      '（无）',
      '',
      '## 方案',
      '（无）',
      '',
      '## 已标记技能',
      '（无）',
      '',
    ].join('\n'),
  )

  result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~plan checkout flow' }),
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)

  result = runNode(closeoutScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      requirementsCoverage: {
        status: 'PASS',
        summary: 'requirements covered',
      },
      deliveryChecklist: {
        status: 'PASS',
        summary: 'delivery checklist covered',
      },
    }),
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)

  const replayDir = join(project, '.helloagents', 'replay')
  let replayFiles = listFiles(replayDir).filter((name) => name.endsWith('.jsonl'))
  assert.equal(replayFiles.length, 1)

  let events = readJsonl(join(replayDir, replayFiles[0]))
  assert.ok(events.some((entry) => entry.event === 'session_started'))
  assert.ok(events.some((entry) => entry.event === 'session_injected'))
  assert.ok(events.some((entry) => entry.event === 'command_route_selected'))
  assert.ok(events.some((entry) => entry.event === 'closeout_evidence_written'))
  assert.ok(events.every((entry) => !Object.prototype.hasOwnProperty.call(entry, 'prompt')))

  for (let i = 0; i < 4; i += 1) {
    result = runNode(notifyScript, ['inject'], {
      cwd: project,
      env,
      input: JSON.stringify({ cwd: project, source: 'startup' }),
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  }

  replayFiles = listFiles(replayDir).filter((name) => name.endsWith('.jsonl'))
  assert.equal(replayFiles.length, 3)
})

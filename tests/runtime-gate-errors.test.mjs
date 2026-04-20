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

test('stop blocks completion when a runtime gate returns invalid output', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-gate-error-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: false })
  writeText(join(pkgRoot, 'scripts', 'delivery-gate.mjs'), 'process.stdout.write("not json")\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604200101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [√] 已完成任务（涉及文件：src/app.js；完成标准：功能完成；验证方式：npm test）',
      '',
    ].join('\n'),
  )

  let result = runNode(turnStateScript, ['write'], {
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
  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /delivery-gate 执行失败/)
  assert.match(payload.reason, /无法解析的 JSON/)
})

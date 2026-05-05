import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs'
import {
  getSessionEvidencePath,
  getSessionStatePath,
  parseStdoutJson,
  writeSettings,
} from './helpers/runtime-test-helpers.mjs'

test('delivery gate blocks completion when plan packages stay open or malformed', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-delivery-')
  const gateScript = join(pkgRoot, 'scripts', 'delivery-gate.mjs')
  const closeoutScript = join(pkgRoot, 'scripts', 'closeout-state.mjs')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: false })
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [ ] 收尾验证',
      '- [√] 已完成任务',
      '',
    ].join('\n'),
  )

  let result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /未完成任务/)
  assert.match(payload.reason, /任务缺少可交付元数据/)
  assert.match(payload.reason, /处理路径：~plan -> ~build \/ ~verify/)

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
    input: JSON.stringify({ cwd: project, lastAssistantMessage: '当前任务已完成，等待您的下一步指示。' }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /未完成任务/)

  writeText(getSessionStatePath(project), ['# 恢复快照', '', '## 方案', '.helloagents/plans/202604050101_feature', ''].join('\n'))
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'tasks.md'),
    ['# {项目/功能名称} — 任务分解', '', '## 任务列表', '[按执行顺序排列，每个任务独立可验证]', ''].join('\n'),
  )

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /缺少必需文件|模板占位|没有可执行任务/)

  writeText(join(project, '.helloagents', 'plans', '202604050101_feature', 'requirements.md'), '# feature requirements\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'plan.md'),
    ['# feature plan', '', '## 风险与验证', '涉及认证边界，需先做审查再完成验证。', ''].join('\n'),
  )
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [√] 已完成任务（涉及文件：src/core/app.ts；完成标准：主流程满足需求边界；验证方式：npm run test）',
      '- [√] 另一个已完成任务（涉及文件：src/core/view.ts；完成标准：界面层与主流程对齐；验证方式：npm run build）',
      '',
    ].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604050101_feature', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'review-first',
    reviewerFocus: ['认证边界'],
    testerFocus: ['主流程满足需求边界', '界面层与主流程对齐'],
    ui: {
      required: false,
      designContract: false,
      sourcePriority: [],
    },
  })
  writeJson(join(project, 'package.json'), {
    name: 'delivery-project',
    scripts: {
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"',
    },
  })

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /缺少最新验证证据/)
  assert.match(payload.reason, /处理路径：~verify -> CONSOLIDATE/)

  writeJson(getSessionEvidencePath(project, 'verify.json'), {
    updatedAt: new Date(Date.now() - 721 * 60 * 60 * 1000).toISOString(),
    commands: ['npm run test', 'npm run build'],
    fastOnly: false,
    source: 'stop',
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })
  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /验证证据超过 720 小时/)

  writeJson(getSessionEvidencePath(project, 'verify.json'), {
    updatedAt: new Date().toISOString(),
    commands: ['npm run test', 'npm run build'],
    fastOnly: false,
    source: 'stop',
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })
  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /缺少最新审查证据/)

  writeJson(getSessionEvidencePath(project, 'review.json'), {
    updatedAt: new Date().toISOString(),
    source: 'manual',
    originCommand: 'review',
    reviewMode: 'review-first',
    conclusion: '发现 1 个阻塞问题。',
    outcome: 'findings',
    findings: ['src/core/app.ts:12 权限边界仍未覆盖'],
    fileReferences: ['src/core/app.ts:12'],
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })
  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /阻塞问题/)

  writeJson(getSessionEvidencePath(project, 'review.json'), {
    updatedAt: new Date().toISOString(),
    source: 'stop',
    originCommand: 'review',
    reviewMode: 'review-first',
    conclusion: '未发现阻塞问题。',
    outcome: 'clean',
    findings: [],
    fileReferences: ['src/core/app.ts:12'],
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })
  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /缺少最新收尾证据/)

  writeJson(getSessionEvidencePath(project, 'closeout.json'), {
    updatedAt: new Date().toISOString(),
    source: 'manual',
    originCommand: 'verify',
    requirementsCoverage: {
      status: 'BLOCKED',
      summary: '仍有 1 条需求未覆盖',
    },
    deliveryChecklist: {
      status: 'PASS',
      summary: '交付检查清单已逐项核对',
    },
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })
  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /需求覆盖未标记为 PASS/)

  result = runNode(closeoutScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      requirementsCoverage: {
        status: 'PASS',
        summary: '已对 requirements.md 做逐条核对，当前范围已覆盖，非目标未实现。',
      },
      deliveryChecklist: {
        status: 'PASS',
        summary: '已逐项核对激活技能检查项，验证与交付证据齐全。',
      },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
})

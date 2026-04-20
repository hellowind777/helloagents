import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readJson,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs'
import { getSessionStatePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('notify workflow hints cover active plans, aliases, and consolidate transitions', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-workflow-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const closeoutScript = join(pkgRoot, 'scripts', 'closeout-state.mjs')
  const reviewScript = join(pkgRoot, 'scripts', 'review-state.mjs')

  writeSettings(home, { install_mode: 'standby' })
  writeText(
    getSessionStatePath(project),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '完成认证功能',
      '',
      '## 正在做什么',
      '继续当前功能实现',
      '',
      '## 方案',
      '.helloagents/plans/202604050101_feature',
      '',
    ].join('\n'),
  )
  writeText(join(project, '.helloagents', 'plans', '202604050101_feature', 'requirements.md'), '# feature requirements\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'plan.md'),
    [
      '# feature plan',
      '',
      '## 风险与验证',
      '涉及认证边界，先审查权限与数据流，再跑完整验证。',
      '',
    ].join('\n'),
  )
  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [ ] 接口改造（涉及文件：src/api/auth.ts；完成标准：认证接口返回新会话字段；验证方式：npm run test -- auth）',
      '- [ ] 页面联调（涉及文件：src/ui/login.tsx；完成标准：登录页展示并消费新会话字段；验证方式：npm run test -- login）',
      '- [√] 主体实现（涉及文件：src/core/session.ts；完成标准：session 模型支持新字段；验证方式：npm run lint）',
      '',
    ].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604050101_feature', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'review-first',
    reviewerFocus: ['权限与会话边界'],
    testerFocus: ['认证接口返回新会话字段', '登录页消费新会话字段'],
    ui: {
      required: true,
      designContract: true,
      sourcePriority: ['plan.md', '.helloagents/DESIGN.md', 'hello-ui'],
    },
  })
  writeText(join(project, '.helloagents', 'DESIGN.md'), '# design contract\n')

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'continue the current feature and finish it' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前应执行 ~build/)
  assert.match(payload.hookSpecificOutput.additionalContext, /执行路径：~build -> ~verify/)
  assert.match(payload.hookSpecificOutput.additionalContext, /编排提示：检测到可并行的开放任务/)
  assert.match(payload.hookSpecificOutput.additionalContext, /hello-subagent/)
  assert.match(payload.hookSpecificOutput.additionalContext, /按需能力：/)
  assert.match(payload.hookSpecificOutput.additionalContext, /design-contract=/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~auto continue the current feature and finish it' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]auto[\\/]SKILL\.md/)
  assert.match(payload.hookSpecificOutput.additionalContext, /本次 ~auto 的执行主路径：~build -> ~verify/)
  assert.match(payload.hookSpecificOutput.additionalContext, /未触发阻塞判定前不要停下/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不要把阶段结果写成“下一步建议”/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~loop keep optimizing the current feature' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]loop[\\/]SKILL\.md/)
  assert.match(payload.hookSpecificOutput.additionalContext, /用户已显式使用 ~loop/)
  assert.match(payload.hookSpecificOutput.additionalContext, /按 ~loop 的循环规则直接执行/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不要把单轮结果写成“下一步建议”/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~verify check whether everything is done' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前不该把 ~verify 当成越级入口；先按 ~build 处理/)
  assert.match(payload.hookSpecificOutput.additionalContext, /即使执行 ~verify，也不能越过当前工作流边界/)
  assert.match(payload.hookSpecificOutput.additionalContext, /验证分流：当前更适合审查优先/)
  assert.match(payload.hookSpecificOutput.additionalContext, /review-evaluator=/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~review audit the current changes' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /兼容别名映射：本次按 ~verify 的审查优先模式执行/)

  result = runNode(reviewScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'review',
      reviewMode: 'review-first',
      outcome: 'clean',
      conclusion: '未发现阻塞问题。',
      findings: [],
      fileReferences: ['src/api/auth.ts:12'],
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(readJson(join(project, '.helloagents', '.ralph-review.json')).outcome, 'clean')

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~design rethink the feature structure' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /兼容别名映射：本次按 ~plan 规则执行/)
  assert.match(payload.hookSpecificOutput.additionalContext, /方案文件使用 `plan\.md`/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~do implement the remaining task' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /兼容别名映射：本次按 ~build 规则执行/)

  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [√] 接口改造（涉及文件：src/api/auth.ts；完成标准：认证接口返回新会话字段；验证方式：npm run test -- auth）',
      '- [√] 页面联调（涉及文件：src/ui/login.tsx；完成标准：登录页展示并消费新会话字段；验证方式：npm run test -- login）',
      '- [√] 主体实现（涉及文件：src/core/session.ts；完成标准：session 模型支持新字段；验证方式：npm run lint）',
      '',
    ].join('\n'),
  )

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~build implement one more thing' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前不该继续 ~build/)
  assert.match(payload.hookSpecificOutput.additionalContext, /除非用户明确提出新增实现范围，否则直接进入 CONSOLIDATE/)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前已进入 CONSOLIDATE/)
  assert.match(payload.hookSpecificOutput.additionalContext, /\.helloagents\/\.ralph-closeout\.json/)
  assert.match(payload.hookSpecificOutput.additionalContext, /UI 约束提示/)

  writeText(
    join(project, '.helloagents', 'plans', '202604050101_feature', 'plan.md'),
    [
      '# feature plan',
      '',
      '## 风险与验证',
      '主要风险较低，按既定验证方式完成自动验证即可。',
      '',
    ].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604050101_feature', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'test-first',
    reviewerFocus: [],
    testerFocus: ['按既定验证方式完成自动验证'],
    ui: {
      required: true,
      designContract: true,
      sourcePriority: ['plan.md', '.helloagents/DESIGN.md', 'hello-ui'],
    },
  })

  writeSettings(home, { install_mode: 'global' })
  const freshProject = createTempDir('helloagents-global-')
  result = runNode(notifyScript, ['inject'], {
    cwd: freshProject,
    env,
    input: JSON.stringify({ cwd: freshProject, source: 'startup' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/)

  writeJson(join(project, '.helloagents', '.ralph-verify.json'), {
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
  parseStdoutJson(result)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'finish delivery closeout for the current feature' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前应直接进入 CONSOLIDATE/)
  assert.match(payload.hookSpecificOutput.additionalContext, /任务与交付证据已闭合/)
  assert.match(payload.hookSpecificOutput.additionalContext, /收尾证据/)
})

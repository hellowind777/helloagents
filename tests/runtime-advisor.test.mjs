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
import { getSessionStatePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('advisor contract stays optional but blocks closeout when explicitly required', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-advisor-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const gateScript = join(pkgRoot, 'scripts', 'delivery-gate.mjs')
  const advisorScript = join(pkgRoot, 'scripts', 'advisor-state.mjs')

  writeSettings(home)
  writeText(getSessionStatePath(project), ['# 恢复快照', '', '## 方案', '.helloagents/plans/202604050501_release', ''].join('\n'))
  writeText(join(project, '.helloagents', 'plans', '202604050501_release', 'requirements.md'), '# release requirements\n')
  writeText(join(project, '.helloagents', 'plans', '202604050501_release', 'plan.md'), '# release plan\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604050501_release', 'tasks.md'),
    ['# release', '', '## 任务列表', '- [√] 发布校验（涉及文件：release.md；完成标准：发布流程确认；验证方式：npm run test）', ''].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604050501_release', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'test-first',
    reviewerFocus: [],
    testerFocus: ['发布流程确认'],
    ui: {
      required: false,
      designContract: false,
      sourcePriority: [],
    },
    advisor: {
      required: true,
      reason: '发布流程需要独立复查',
      focus: ['发布步骤与回滚边界'],
      preferredSources: ['codex'],
    },
  })
  writeJson(join(project, 'package.json'), {
    name: 'advisor-project',
    scripts: {
      test: 'node -e "process.exit(0)"',
    },
  })
  writeJson(join(project, '.helloagents', '.ralph-verify.json'), {
    updatedAt: new Date().toISOString(),
    commands: ['npm run test'],
    fastOnly: false,
    source: 'stop',
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~verify release closeout' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /按需能力：/)
  assert.match(payload.hookSpecificOutput.additionalContext, /advisor-artifact=/)
  assert.match(payload.hookSpecificOutput.additionalContext, /\.helloagents\/\.ralph-advisor\.json/)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /missing fresh advisor evidence/)

  result = runNode(advisorScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '发布流程需要独立复查',
      focus: ['发布步骤与回滚边界'],
      preferredSources: ['codex'],
      consultedSources: ['codex'],
      outcome: 'findings',
      summary: '发现发布回滚说明缺失。',
      findings: ['release.md:12 缺少回滚说明'],
      recommendations: ['补齐回滚步骤'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /latest advisor evidence still records blocking findings/)

  result = runNode(advisorScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '发布流程需要独立复查',
      focus: ['发布步骤与回滚边界'],
      preferredSources: ['codex'],
      consultedSources: ['codex'],
      outcome: 'clean',
      summary: 'advisor 复查通过。',
      findings: [],
      recommendations: ['可继续收尾'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /missing fresh closeout evidence/)
})

test('ui style advisor reuses advisor evidence when the UI contract explicitly requires it', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-style-advisor-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const gateScript = join(pkgRoot, 'scripts', 'delivery-gate.mjs')
  const advisorScript = join(pkgRoot, 'scripts', 'advisor-state.mjs')

  writeSettings(home)
  writeText(getSessionStatePath(project), ['# 恢复快照', '', '## 方案', '.helloagents/plans/202604060101_dashboard', ''].join('\n'))
  writeText(join(project, '.helloagents', 'plans', '202604060101_dashboard', 'requirements.md'), '# dashboard requirements\n')
  writeText(join(project, '.helloagents', 'plans', '202604060101_dashboard', 'plan.md'), '# dashboard plan\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604060101_dashboard', 'tasks.md'),
    ['# dashboard', '', '## 任务列表', '- [√] 仪表盘收尾（涉及文件：src/ui/dashboard.tsx；完成标准：界面达到发布标准；验证方式：npm run test）', ''].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604060101_dashboard', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'test-first',
    reviewerFocus: [],
    testerFocus: ['界面达到发布标准'],
    ui: {
      required: true,
      designContract: true,
      sourcePriority: ['plan.md', '.helloagents/DESIGN.md', 'hello-ui'],
      styleAdvisor: {
        required: true,
        reason: '首页视觉方向需要独立复查',
        focus: ['主视觉层级', '品牌记忆点'],
      },
    },
  })
  writeText(join(project, '.helloagents', 'DESIGN.md'), '# dashboard design contract\n')
  writeJson(join(project, 'package.json'), {
    name: 'style-advisor-project',
    scripts: {
      test: 'node -e "process.exit(0)"',
    },
  })
  writeJson(join(project, '.helloagents', '.ralph-verify.json'), {
    updatedAt: new Date().toISOString(),
    commands: ['npm run test'],
    fastOnly: false,
    source: 'stop',
    fingerprint: {
      available: false,
      unstaged: '',
      staged: '',
      combined: '',
    },
  })

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~verify finish the dashboard ui closeout' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /advisor-artifact=/)
  assert.match(payload.hookSpecificOutput.additionalContext, /\.helloagents\/\.ralph-advisor\.json/)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /missing fresh advisor evidence/)

  result = runNode(advisorScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '首页视觉方向需要独立复查',
      focus: [],
      consultedSources: ['codex'],
      outcome: 'clean',
      summary: '风格复查通过。',
      findings: [],
      recommendations: ['可继续收尾'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /advisor evidence must retain the requested advisor focus/)

  result = runNode(advisorScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '首页视觉方向需要独立复查',
      focus: ['主视觉层级', '品牌记忆点'],
      consultedSources: ['codex'],
      outcome: 'clean',
      summary: '风格复查通过。',
      findings: [],
      recommendations: ['可继续收尾'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /missing fresh closeout evidence/)
})

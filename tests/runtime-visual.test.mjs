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
import { parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('visual validation stays optional but blocks closeout when the UI contract explicitly requires it', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-visual-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const gateScript = join(pkgRoot, 'scripts', 'delivery-gate.mjs')
  const visualScript = join(pkgRoot, 'scripts', 'visual-state.mjs')

  writeSettings(home)
  writeText(join(project, '.helloagents', 'STATE.md'), ['# 恢复快照', '', '## 方案', '.helloagents/plans/202604060201_ui-release', ''].join('\n'))
  writeText(join(project, '.helloagents', 'plans', '202604060201_ui-release', 'requirements.md'), '# ui release requirements\n')
  writeText(join(project, '.helloagents', 'plans', '202604060201_ui-release', 'plan.md'), '# ui release plan\n')
  writeText(
    join(project, '.helloagents', 'plans', '202604060201_ui-release', 'tasks.md'),
    ['# ui release', '', '## 任务列表', '- [√] 发布前 UI 验收（涉及文件：src/ui/home.tsx；完成标准：首页与关键状态符合设计契约；验证方式：npm run test）', ''].join('\n'),
  )
  writeJson(join(project, '.helloagents', 'plans', '202604060201_ui-release', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'test-first',
    reviewerFocus: [],
    testerFocus: ['首页与关键状态符合设计契约'],
    ui: {
      required: true,
      designContract: true,
      sourcePriority: ['plan.md', '.helloagents/DESIGN.md', 'hello-ui'],
      visualValidation: {
        required: true,
        reason: '发布前需要独立视觉验收',
        screens: ['desktop-home', 'mobile-home'],
        states: ['loading', 'error'],
      },
    },
  })
  writeText(join(project, '.helloagents', 'DESIGN.md'), '# ui design contract\n')
  writeJson(join(project, 'package.json'), {
    name: 'visual-project',
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
    input: JSON.stringify({ cwd: project, prompt: '~verify finish the UI release closeout' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /visual-evaluator=/)
  assert.match(payload.hookSpecificOutput.additionalContext, /\.helloagents\/\.ralph-visual\.json/)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /missing fresh visual validation evidence/)

  result = runNode(visualScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '发布前需要独立视觉验收',
      tooling: ['playwright', 'screenshots'],
      screensChecked: ['desktop-home', 'mobile-home'],
      statesChecked: ['loading'],
      status: 'PASS',
      summary: '桌面与移动端首屏表现一致。',
      findings: [],
      recommendations: ['补看错误态'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /does not cover requested states: error/)

  result = runNode(visualScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '发布前需要独立视觉验收',
      tooling: ['playwright', 'screenshots'],
      screensChecked: ['desktop-home', 'mobile-home'],
      statesChecked: ['loading', 'error'],
      status: 'BLOCKED',
      summary: '错误态布局仍然错位。',
      findings: ['src/ui/home.tsx:88 错误态按钮遮挡说明文案'],
      recommendations: ['修正错误态布局后重验'],
    }),
  })
  parseStdoutJson(result)

  result = runNode(gateScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.reason, /latest visual validation evidence still records blocking findings/)

  result = runNode(visualScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      source: 'manual',
      originCommand: 'verify',
      reason: '发布前需要独立视觉验收',
      tooling: ['playwright', 'screenshots'],
      screensChecked: ['desktop-home', 'mobile-home'],
      statesChecked: ['loading', 'error'],
      status: 'PASS',
      summary: '桌面、移动端以及关键状态均已通过视觉验收。',
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

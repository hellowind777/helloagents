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

test('notify inject and semantic route cover standby and recovery hints', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-route-')
  const env = buildHomeEnv(home)
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const guardScript = join(pkgRoot, 'scripts', 'guard.mjs')

  writeSettings(home, { install_mode: 'standby' })

  let result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /HelloAGENTS \(Standby\)/)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 包根目录/)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 读取根目录/)
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /统一执行流程/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前命令技能文件已解析为：/)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]help[\\/]SKILL\.md/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不要再为同一个命令 skill 重复 Test-Path \/ Get-Content/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~wiki' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]wiki[\\/]SKILL\.md/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.hookSpecificOutput, undefined)

  writeText(join(project, '.helloagents', 'STATE.md'), '# activated\n')
  result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'resume' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/)
  assert.match(payload.hookSpecificOutput.additionalContext, /会话已恢复\/压缩/)
  assert.match(payload.hookSpecificOutput.additionalContext, /只有同一主线才按 STATE\.md 接续/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /语言无关的 ROUTE \/ TIER/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不依赖关键词表/)
  assert.match(payload.hookSpecificOutput.additionalContext, /Delivery Tier: T0=探索\/比较\/发散/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不要直接跳入 ~build/)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前活跃 plan \/ PRD 的 UI 决策/)
  assert.match(payload.hookSpecificOutput.additionalContext, /STATE\.md 只用于找回上次停在哪/)

  writeText(
    join(project, '.helloagents', 'plans', '202604040101_missing-state', 'requirements.md'),
    '# missing state requirements\n',
  )
  writeText(
    join(project, '.helloagents', 'plans', '202604040101_missing-state', 'plan.md'),
    '# missing state plan\n',
  )
  writeText(
    join(project, '.helloagents', 'plans', '202604040101_missing-state', 'tasks.md'),
    '# missing state tasks\n\n- [ ] repair snapshot\n',
  )
  writeText(
    join(project, '.helloagents', 'STATE.md'),
    [
      '# 恢复游标',
      '',
      '## 正在做什么',
      '继续当前功能实现',
      '',
    ].join('\n'),
  )

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'continue the existing feature flow' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /STATE\.md 提醒/)
  assert.match(payload.hookSpecificOutput.additionalContext, /未记录活跃方案路径/)
  assert.match(payload.hookSpecificOutput.additionalContext, /缺少“主线目标”/)
  assert.match(payload.hookSpecificOutput.additionalContext, /缺少“下一步”/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '先想想登录页还能有什么方向，比较几个方案' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /~idea=轻量探索/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~idea compare a few directions first' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]idea[\\/]SKILL\.md/)

  result = runNode(guardScript, ['pre-write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      tool_name: 'Write',
      tool_input: {
        file_path: join(project, 'scratch.md'),
        content: '# scratch\n',
      },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /~idea 是零副作用探索/)

  result = runNode(guardScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      tool_name: 'Bash',
      tool_input: { command: 'npm install react' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /side-effect command/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'run tests and do a security review for auth changes' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /~verify=审查\/验证/)
})

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
import { getSessionStatePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('CLI runtime entry dispatches Codex notify payloads', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-notify-')
  const env = buildHomeEnv(home)

  const result = runNode(join(pkgRoot, 'cli.mjs'), [
    'codex-notify',
    JSON.stringify({ type: 'noop', cwd: project }),
  ], {
    cwd: project,
    env,
  })

  assert.equal(result.status, 0, result.stderr || result.stdout)
})

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
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 运行根目录/)
  assert.match(payload.hookSpecificOutput.additionalContext, /本轮 HelloAGENTS 读取根目录/)
  assert.match(payload.hookSpecificOutput.additionalContext, /turnStateCommand/)
  assert.match(payload.hookSpecificOutput.additionalContext, /helloagents-turn-state write/)
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前命令技能文件已解析为：/)
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\/]commands[\\/]help[\\/]SKILL\.md/)
  assert.match(payload.hookSpecificOutput.additionalContext, /请直接读取这个 SKILL\.md/)

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

  writeText(getSessionStatePath(project), '# activated\n')
  result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'resume' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/)
  assert.match(payload.hookSpecificOutput.additionalContext, /会话已恢复\/压缩/)
  assert.match(payload.hookSpecificOutput.additionalContext, /先看当前用户消息，如果仍是同一任务/)

  const nested = join(project, 'packages', 'app')
  writeText(join(nested, 'index.js'), 'console.log("ok")\n')

  result = runNode(notifyScript, ['inject'], {
    cwd: nested,
    env,
    input: JSON.stringify({ cwd: nested, source: 'startup' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /## 统一执行流程/)

  result = runNode(notifyScript, ['route'], {
    cwd: nested,
    env,
    input: JSON.stringify({ cwd: nested, prompt: 'continue the existing feature flow' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /请根据用户请求的真实意图选路/)

  result = runNode(notifyScript, ['pre-compact'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /状态文件/)
  assert.match(payload.hookSpecificOutput.additionalContext, /只用于找回上次停在哪/)
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /读完即可接上工作/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /请根据用户请求的真实意图选路/)
  assert.match(payload.hookSpecificOutput.additionalContext, /不依赖关键词表/)
  assert.match(payload.hookSpecificOutput.additionalContext, /Delivery Tier: T0=探索\/比较/)
  assert.match(payload.hookSpecificOutput.additionalContext, /默认先走 ~plan \/ ~prd/)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前活跃 plan \/ PRD/)
  assert.match(payload.hookSpecificOutput.additionalContext, /状态文件只用于找回上次停在哪/)

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
    getSessionStatePath(project),
    [
      '# 恢复快照',
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
  assert.match(payload.hookSpecificOutput.additionalContext, /状态文件提醒/)
  assert.match(payload.hookSpecificOutput.additionalContext, /未记录活跃方案路径/)
  assert.match(payload.hookSpecificOutput.additionalContext, /缺少“主线目标”/)
  assert.match(payload.hookSpecificOutput.additionalContext, /缺少“下一步”/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '先想想登录页还能有什么方向，比较几个方案' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /~idea=只读探索/)

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
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /~idea 是只读探索/)

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
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /有副作用命令/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'run tests and do a security review for auth changes' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /~verify=审查\/验证/)
})

test('notify runtime uses host_install_modes before global install_mode', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-route-host-mode-')
  const env = buildHomeEnv(home)
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, {
    install_mode: 'standby',
    host_install_modes: {
      codex: 'global',
    },
  })

  let result = runNode(notifyScript, ['inject', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  })
  let payload = parseStdoutJson(result)
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /HelloAGENTS \(Standby\)/)
  assert.match(payload.hookSpecificOutput.additionalContext, /## 统一执行流程/)

  result = runNode(notifyScript, ['route', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /请根据用户请求的真实意图选路/)
})

test('notify route keeps command skills on the runtime root even if project-level skill dirs exist', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-route-')
  const env = buildHomeEnv(home)
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { install_mode: 'standby' })
  writeText(join(project, 'skills', 'helloagents', '.keep'), '')
  writeText(join(project, '.claude', 'skills', 'helloagents', '.keep'), '')
  writeText(join(project, '.gemini', 'skills', 'helloagents', '.keep'), '')
  writeText(join(project, '.codex', 'skills', 'helloagents', '.keep'), '')

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  let payload = parseStdoutJson(result)
  const runtimeSkillPath = join(pkgRoot, 'skills', 'commands', 'help', 'SKILL.md')
  assert.match(payload.hookSpecificOutput.additionalContext, new RegExp(runtimeSkillPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /skills[\\/]helloagents[\\/]skills[\\/]commands[\\/]help[\\/]SKILL\.md/)

  result = runNode(notifyScript, ['route', '--gemini'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, new RegExp(runtimeSkillPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /skills[\\/]helloagents[\\/]skills[\\/]commands[\\/]help[\\/]SKILL\.md/)

  result = runNode(notifyScript, ['route', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, new RegExp(runtimeSkillPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /skills[\\/]helloagents[\\/]skills[\\/]commands[\\/]help[\\/]SKILL\.md/)
})

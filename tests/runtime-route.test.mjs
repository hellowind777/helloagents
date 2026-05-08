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
  writeText,
} from './helpers/test-env.mjs'
import { normalizeNotifyPayload } from '../scripts/notify-payload.mjs'
import { getSessionEvidencePath, getSessionStatePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

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

test('notify payload normalization accepts Codex snake and kebab case fields', () => {
  const payload = normalizeNotifyPayload({
    session_id: 'session-1',
    'turn-id': 'turn-1',
    last_assistant_message: 'done',
    input_messages: [
      { content: [{ text: '~auto finish the task' }] },
    ],
  })

  assert.equal(payload.sessionId, 'session-1')
  assert.equal(payload.turnId, 'turn-1')
  assert.equal(payload.lastAssistantMessage, 'done')
  assert.equal(payload.prompt, '~auto finish the task')
})

test('Codex silent hooks do not emit additional context and de-duplicate Stop handling', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-silent-hooks-')
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')
  const hookPayload = {
    cwd: project,
    session_id: '12345678',
    turn_id: 'turn-1',
  }

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  let result = runNode(notifyScript, ['inject', '--codex', '--silent'], {
    cwd: project,
    env,
    input: JSON.stringify({ ...hookPayload, source: 'startup' }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.hookSpecificOutput, undefined)

  result = runNode(notifyScript, ['route', '--codex', '--silent'], {
    cwd: project,
    env,
    input: JSON.stringify({ ...hookPayload, prompt: '~auto continue until done' }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.hookSpecificOutput, undefined)

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      payload: hookPayload,
      role: 'main',
      kind: 'waiting',
      reasonCategory: 'missing-input',
      reason: '当前阶段已完成，等待用户下一步。',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify({
      ...hookPayload,
      last_assistant_message: '我先停在这里，等你决定下一步。',
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /显式 ~auto 本轮不应直接停下/)
  let evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.turnId, 'turn-1')
  assert.equal(evidence.source, 'stop')

  result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify(hookPayload),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)

  result = runNode(join(pkgRoot, 'cli.mjs'), [
    'codex-notify',
    JSON.stringify({ ...hookPayload, type: 'agent-turn-complete' }),
  ], {
    cwd: project,
    env,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')
})

test('Codex native notify writes closeout evidence before Stop and prevents double closeout', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-notify-first-')
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')
  const hookPayload = {
    cwd: project,
    session_id: '12345678',
    turn_id: 'turn-1',
    last_assistant_message: '任务已完成。',
  }

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      payload: hookPayload,
      role: 'main',
      kind: 'complete',
      phase: 'closeout',
    }),
  })
  parseStdoutJson(result)

  result = runNode(join(pkgRoot, 'cli.mjs'), [
    'codex-notify',
    JSON.stringify({ ...hookPayload, type: 'agent-turn-complete', client: 'codex-tui' }),
  ], {
    cwd: project,
    env,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')

  let evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.turnId, 'turn-1')
  assert.equal(evidence.source, 'codex-notify')
  assert.equal(evidence.turnKind, 'complete')

  result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify(hookPayload),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)

  evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.source, 'codex-notify')
})

test('Codex native notify consumes waiting closeout once and Stop does not synthesize complete', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-notify-waiting-')
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')
  const hookPayload = {
    cwd: project,
    session_id: '12345678',
    turn_id: 'turn-1',
    last_assistant_message: '缺少输入文件，当前无法继续。',
  }

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      payload: hookPayload,
      role: 'main',
      kind: 'waiting',
      phase: 'build',
      reasonCategory: 'missing-file',
      reason: '缺少 tests/fixtures/input.csv 文件，无法继续生成基线结果。',
      blocker: {
        target: 'tests/fixtures/input.csv',
        evidence: '读取基线输入文件时文件不存在。',
        requiredAction: '用户补充该文件或确认改用其他输入路径。',
      },
    }),
  })
  parseStdoutJson(result)

  result = runNode(join(pkgRoot, 'cli.mjs'), [
    'codex-notify',
    JSON.stringify({ ...hookPayload, type: 'agent-turn-complete', client: 'codex-tui' }),
  ], {
    cwd: project,
    env,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')

  let evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.source, 'codex-notify')
  assert.equal(evidence.turnKind, 'waiting')

  result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify(hookPayload),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)

  evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.source, 'codex-notify')
})

test('Codex managed Stop hook takes over complete closeout and native notify stays silent', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-codex-managed-stop-')
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')
  const hookPayload = {
    cwd: project,
    session_id: '12345678',
    turn_id: 'turn-1',
    last_assistant_message: '任务已完成。',
  }

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(
    join(home, '.codex', 'hooks.json'),
    JSON.stringify({
      hooks: {
        Stop: [
          {
            matcher: '',
            hooks: [
              { type: 'command', command: 'helloagents-js notify stop --codex' },
            ],
          },
        ],
      },
    }, null, 2) + '\n',
  )

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      payload: hookPayload,
      role: 'main',
      kind: 'complete',
      phase: 'closeout',
    }),
  })
  parseStdoutJson(result)

  result = runNode(join(pkgRoot, 'cli.mjs'), [
    'codex-notify',
    JSON.stringify({ ...hookPayload, type: 'agent-turn-complete', client: 'codex-tui' }),
  ], {
    cwd: project,
    env,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(result.stdout, '')

  result = runNode(notifyScript, ['stop', '--codex'], {
    cwd: project,
    env,
    input: JSON.stringify(hookPayload),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)

  const evidence = readJson(getSessionEvidencePath(project, 'codex-native-stop.json', {
    session: '12345678',
  }))
  assert.equal(evidence.turnId, 'turn-1')
  assert.equal(evidence.source, 'stop')
  assert.equal(evidence.turnKind, 'complete')
})

test('project active session keeps hook and local turn-state writes in one directory', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const project = createTempDir('helloagents-active-session-')
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  let result = runNode(notifyScript, ['route', '--codex', '--silent'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      session_id: 'codex-session-abcdef',
      turn_id: 'turn-1',
      prompt: '~plan build a demo',
    }),
  })
  parseStdoutJson(result)

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
    }),
  })
  const payload = parseStdoutJson(result)

  assert.match(payload.path, /[\\/]\.helloagents[\\/]sessions[\\/]workspace[\\/]abcdef[\\/]capsule\.json$/)
  const active = readJson(join(project, '.helloagents', 'sessions', 'active.json'))
  assert.equal(active.session, 'abcdef')
  assert.equal(active.aliases.xyz999, 'abcdef')
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

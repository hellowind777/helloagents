import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  writeJson,
  runNode,
  writeText,
} from './helpers/test-env.mjs'
import { getSessionStatePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('codex notify gates only main complete turns from turn-state', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { output_format: true })
  writeText(
    getSessionStatePath(project),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '完成当前审计收尾',
      '',
      '## 正在做什么',
      '整理当前方案包',
      '',
      '## 方案',
      '.helloagents/plans/202604100101_audit',
      '',
      '## 下一步',
      '补齐方案包并完成收尾',
      '',
    ].join('\n'),
  )
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'requirements.md'), '# audit requirements\n')
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'plan.md'), '# audit plan\n')
  writeText(join(project, '.helloagents', 'plans', '202604100101_audit', 'tasks.md'), '# audit tasks\n\n- [ ] still open\n')

  let result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'subagent',
      kind: 'complete',
      phase: 'verify',
    }),
  })
  parseStdoutJson(result)
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

  result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'plan',
      reasonCategory: 'missing-input',
      reason: '用户尚未给出当前审计范围。',
    }),
  })
  parseStdoutJson(result)
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')

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
  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '审计完成',
  })], {
    cwd: project,
    env,
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /未完成任务|缺少可信的结构化契约/)

  result = runNode(turnStateScript, ['read'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.state, null)

  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '等待后台终端完成',
  })], {
    cwd: project,
    env,
  })
  assert.equal(result.stdout, '')
})

test('stop allows structured waiting turn-state and clears it', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-waiting-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home)
  writeJson(join(project, 'package.json'), {
    name: 'turn-state-waiting-project',
    scripts: {
      build: 'node -e "process.exit(1)"',
    },
  })

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'clarify',
      reasonCategory: 'ambiguity',
      reason: '当前需求存在影响实现结果的真实歧义。',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '当前任务已完成，等待您的下一步指示。',
    }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)

  result = runNode(turnStateScript, ['read'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.state, null)
})

test('ordinary complete turns skip automatic Ralph Loop verification', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-fast-complete-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: true })
  writeJson(join(project, 'package.json'), {
    name: 'fast-complete-project',
    scripts: {
      test: 'node -e "process.exit(1)"',
    },
  })

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'closeout',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '任务已完成。',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)
})

test('explicit verify route still runs Ralph Loop verification', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-verify-route-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: true })
  writeJson(join(project, 'package.json'), {
    name: 'verify-route-project',
    scripts: {
      test: 'node -e "process.exit(1)"',
    },
  })

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      prompt: '~verify run checks',
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
      phase: 'verify',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '验证完成。',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /Ralph Loop/)
  assert.match(payload.reason, /npm run test/)
})

test('turn-state rejects waiting without blocker details', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-invalid-')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  const result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'clarify',
    }),
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stderr}${result.stdout}`, /requires reasonCategory and reason/)
})

test('turn-state writes pure cwd into the session capsule', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-scope-')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeText(join(project, '.helloagents', '.keep'), '')

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'verify',
    }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.path, /[\\/]\.helloagents[\\/]sessions[\\/]workspace[\\/]default[\\/]capsule\.json$/)
  assert.equal(payload.payload.cwd, project)
  assert.equal(payload.payload.key.endsWith('::workspace::default'), true)

  result = runNode(turnStateScript, ['read'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.state.cwd, project)
  assert.equal(payload.state.key.endsWith('::workspace::default'), true)
})

test('stable turn-state command entry writes state', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-cli-')
  const turnStateCli = join(pkgRoot, 'scripts', 'turn-state-cli.mjs')

  const result = runNode(turnStateCli, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
      phase: 'consolidate',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.payload.kind, 'complete')
  assert.equal(payload.payload.role, 'main')
})

test('stable turn-state command entry prefers the stable runtime root script', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-runtime-root-')
  const turnStateCli = join(pkgRoot, 'scripts', 'turn-state-cli.mjs')
  const runtimeScript = join(home, '.helloagents', 'helloagents', 'scripts', 'turn-state.mjs')

  writeText(runtimeScript, 'process.stdout.write(JSON.stringify({ source: "runtime-root" }))\n')

  const result = runNode(turnStateCli, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'complete',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.source, 'runtime-root')
})

test('stable turn-state command entry supports flags and help', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-flags-')
  const turnStateCli = join(pkgRoot, 'scripts', 'turn-state-cli.mjs')

  let result = runNode(turnStateCli, ['--help'], {
    cwd: project,
    env,
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /helloagents-turn-state write --kind complete --role main/)

  result = runNode(turnStateCli, [
    'write',
    '--cwd',
    project,
    '--kind',
    'waiting',
    '--role',
    'main',
    '--reason-category',
    'missing-input',
    '--reason',
    '用户尚未提供必要信息。',
  ], {
    cwd: project,
    env,
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.payload.kind, 'waiting')
  assert.equal(payload.payload.role, 'main')
  assert.equal(payload.payload.reasonCategory, 'missing-input')
  assert.equal(payload.payload.reason, '用户尚未提供必要信息。')
})

test('stop blocks explicit auto when turn-state is missing', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-stop-auto-missing-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home)

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      prompt: '~auto continue the current task until done',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '我先停在这里，等你决定下一步。',
    }),
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /显式 ~auto 本轮不应直接停下/)
  assert.match(payload.reason, /缺少主代理 turn-state/)
})

test('codex notify blocks explicit auto when turn-state is missing', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-codex-auto-missing-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { output_format: true })

  let result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      prompt: '~auto continue the current task until done',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['codex-notify', JSON.stringify({
    type: 'agent-turn-complete',
    client: 'codex-tui',
    cwd: project,
    'last-assistant-message': '我先停在这里，等你决定下一步。',
  })], {
    cwd: project,
    env,
  })

  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /显式 ~auto 本轮不应直接停下/)
  assert.match(payload.reason, /缺少主代理 turn-state/)
})

test('stop ignores completion-looking text when turn-state is missing', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-missing-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, { ralph_loop_enabled: false })
  writeText(
    join(project, '.helloagents', 'plans', '202604200101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [ ] 收尾验证',
      '',
    ].join('\n'),
  )

  const result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '当前任务已完成，等待您的下一步指示。',
    }),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(payload.decision, undefined)
})

test('stop delivery gate prefers structured turn-state over completion text', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-turn-state-stop-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')
  const turnStateScript = join(pkgRoot, 'scripts', 'turn-state.mjs')

  writeSettings(home, { ralph_loop_enabled: false })
  writeText(
    join(project, '.helloagents', 'plans', '202604200101_feature', 'tasks.md'),
    [
      '# feature',
      '',
      '## 任务列表',
      '- [ ] 收尾验证',
      '- [√] 已完成任务',
      '',
    ].join('\n'),
  )

  let result = runNode(turnStateScript, ['write'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      role: 'main',
      kind: 'waiting',
      phase: 'clarify',
      reasonCategory: 'ambiguity',
      reason: '当前需求存在影响实现结果的真实歧义。',
    }),
  })
  parseStdoutJson(result)

  result = runNode(notifyScript, ['stop'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '当前任务已完成，等待您的下一步指示。',
    }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)

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
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '收尾摘要已写入。',
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /未完成任务/)
})

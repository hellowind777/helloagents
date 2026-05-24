import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  REPO_ROOT,
  buildHomeEnv,
  createHomeFixture,
  createTempDir,
  runCommand,
  writeText,
} from './helpers/test-env.mjs'
import { writeSettings } from './helpers/runtime-test-helpers.mjs'
import { cleanupUserRuntimeRoot, getUserRuntimeRoot } from '../scripts/runtime-scope.mjs'
import { cleanupProjectSessions } from '../scripts/project-session-cleanup.mjs'

const RUNTIME_SCOPE_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'runtime-scope.mjs')).href
const RUNTIME_ARTIFACTS_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'runtime-artifacts.mjs')).href

function assertCommandOk(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function runModuleEval({ cwd, env, source }) {
  const result = runCommand(process.execPath, ['--input-type=module', '-e', source], {
    cwd,
    env,
  })
  assertCommandOk(result)
  return result.stdout ? JSON.parse(result.stdout) : null
}

test('home-level settings directory is not treated as an activated project', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  writeSettings(home)

  const payload = runModuleEval({
    cwd: home,
    env,
    source: `
      const { getRuntimeScope, isProjectRuntimeActive } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(home)}, { payload: { sessionId: 'abc123' } })
      process.stdout.write(JSON.stringify({
        active: isProjectRuntimeActive(${JSON.stringify(home)}),
        scope: scope.scope,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.active, false)
  assert.equal(payload.scope, 'user-runtime')
  assert.match(payload.sessionDir, /[\\/]\.helloagents[\\/]runtime[\\/]/)
})

test('activated project scope resolves from nested working directories', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-runtime-project-')
  const nested = join(project, 'packages', 'app')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(join(nested, 'index.js'), 'console.log("ok")\n')

  const payload = runModuleEval({
    cwd: nested,
    env,
    source: `
      const { getRuntimeScope, getProjectActivationDir } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(nested)}, { payload: { sessionId: 'abc123' } })
      process.stdout.write(JSON.stringify({
        scope: scope.scope,
        active: scope.active,
        cwd: scope.cwd,
        activationDir: getProjectActivationDir(${JSON.stringify(nested)}),
        statePath: scope.statePath,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.scope, 'project-session')
  assert.equal(payload.active, true)
  assert.equal(payload.cwd, project)
  assert.equal(payload.activationDir, join(project, '.helloagents'))
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', 'workspace', 'host-abc123'))
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'workspace', 'host-abc123', 'STATE.md'))
})

test('git detached head uses a commit-scoped workspace name', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-detached-session-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(join(project, 'README.md'), '# detached\n')
  assertCommandOk(runCommand('git', ['init'], { cwd: project, env }))
  assertCommandOk(runCommand('git', ['config', 'user.name', 'HelloAGENTS Test'], { cwd: project, env }))
  assertCommandOk(runCommand('git', ['config', 'user.email', 'helloagents@example.com'], { cwd: project, env }))
  assertCommandOk(runCommand('git', ['add', 'README.md'], { cwd: project, env }))
  assertCommandOk(runCommand('git', ['commit', '-m', 'init'], { cwd: project, env }))
  const head = runCommand('git', ['rev-parse', '--short', 'HEAD'], { cwd: project, env }).stdout.trim()
  assertCommandOk(runCommand('git', ['checkout', '--detach', 'HEAD'], { cwd: project, env }))

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, { payload: { sessionId: 'abc123' } })
      process.stdout.write(JSON.stringify({
        workspace: scope.workspace,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.workspace, `detached-${head}`)
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', `detached-${head}`, 'host-abc123'))
})

test('request identifiers do not create project session directories', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-request-session-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, { payload: { requestId: 'req-123456' } })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
        statePath: scope.statePath,
      }))
    `,
  })

  assert.equal(payload.session, '')
  assert.equal(payload.sessionMode, 'unidentified')
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', 'workspace', 'default'))
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'workspace', 'default', 'STATE.md'))
})

test('terminal environment identifiers create one alias-scoped project session directory', () => {
  const home = createHomeFixture()
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'wt-session-abcdef123456',
    TERM_SESSION_ID: 'term-session-abcdef123456',
  }
  const project = createTempDir('helloagents-terminal-session-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, { payload: {} })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
        statePath: scope.statePath,
      }))
    `,
  })

  assert.equal(payload.session, 'alias-abcdef12')
  assert.equal(payload.sessionMode, 'alias-session')
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', 'workspace', 'alias-abcdef12'))
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'workspace', 'alias-abcdef12', 'STATE.md'))
})

test('later payload conversation and thread identifiers reuse the same project session directory', () => {
  const home = createHomeFixture()
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const project = createTempDir('helloagents-session-identity-reuse-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  const first = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const { writeSessionCapsule } = await import(${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'scripts', 'session-capsule.mjs')).href)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { sessionId: 'main-session-abcdef123456' },
        ensureProjectLocal: true,
      })
      writeSessionCapsule(${JSON.stringify(project)}, { route: { skillName: 'plan' } }, {
        payload: { sessionId: 'main-session-abcdef123456' },
        ensureProjectLocal: true,
      })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  const second = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { conversationId: 'conversation-12345678' },
      })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  const third = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { threadId: 'thread-87654321' },
      })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(first.session, 'host-abcdef12')
  assert.equal(second.session, 'host-abcdef12')
  assert.equal(third.session, 'host-abcdef12')
  assert.equal(second.sessionMode, 'active-session')
  assert.equal(third.sessionMode, 'active-session')
  assert.equal(second.sessionDir, first.sessionDir)
  assert.equal(third.sessionDir, first.sessionDir)
})

test('later host session identifier reuses the active default project session directory', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-session-default-reuse-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  const first = runModuleEval({
    cwd: project,
    env,
    source: `
      const { writeSessionCapsule } = await import(${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'scripts', 'session-capsule.mjs')).href)})
      writeSessionCapsule(${JSON.stringify(project)}, { route: { skillName: 'build' } }, {
        payload: { prompt: '~build finish the task' },
        ensureProjectLocal: true,
      })
      const { getRuntimeScope, readJsonFile } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { prompt: '~build finish the task' },
      })
      const active = readJsonFile(${JSON.stringify(join(project, '.helloagents', 'sessions', 'active.json'))}, null)
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
        active,
      }))
    `,
  })

  const second = runModuleEval({
    cwd: project,
    env,
    source: `
      const { writeSessionCapsule } = await import(${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'scripts', 'session-capsule.mjs')).href)})
      writeSessionCapsule(${JSON.stringify(project)}, { route: { skillName: 'build' } }, {
        payload: { sessionId: 'main-session-abcdef123456' },
      })
      const { getRuntimeScope, readJsonFile } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { sessionId: 'main-session-abcdef123456' },
      })
      const active = readJsonFile(${JSON.stringify(join(project, '.helloagents', 'sessions', 'active.json'))}, null)
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
        active,
      }))
    `,
  })

  assert.equal(first.session, '')
  assert.equal(first.sessionMode, 'unidentified')
  assert.equal(first.sessionDir, join(project, '.helloagents', 'sessions', 'workspace', 'default'))
  assert.equal(first.active.session, 'default')
  assert.equal(first.active.sessionMode, 'default')
  assert.equal(first.active.hostHint.startsWith('ppid:'), true)
  assert.equal(second.session, 'default')
  assert.equal(second.sessionMode, 'active-session')
  assert.equal(second.sessionDir, first.sessionDir)
  assert.equal(second.active.session, 'default')
  assert.equal(second.active.aliases['session:abcdef12'], 'default')
  assert.equal(second.active.hostHint, first.active.hostHint)
})

test('resume reuses the current active project session directory when identifiers are absent', () => {
  const home = createHomeFixture()
  const env = {
    ...buildHomeEnv(home),
    WT_SESSION: 'terminal-session-xyz999',
  }
  const project = createTempDir('helloagents-session-resume-reuse-')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')

  const initial = runModuleEval({
    cwd: project,
    env,
    source: `
      const { writeSessionCapsule } = await import(${JSON.stringify(pathToFileURL(join(REPO_ROOT, 'scripts', 'session-capsule.mjs')).href)})
      writeSessionCapsule(${JSON.stringify(project)}, { route: { skillName: 'plan' } }, {
        payload: { sessionId: 'main-session-abcdef123456' },
        ensureProjectLocal: true,
      })
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { sessionId: 'main-session-abcdef123456' },
      })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  const resumed = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { source: 'resume' },
      })
      process.stdout.write(JSON.stringify({
        session: scope.session,
        sessionMode: scope.sessionMode,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(resumed.session, initial.session)
  assert.equal(resumed.sessionMode, 'active-session')
  assert.equal(resumed.sessionDir, initial.sessionDir)
})

test('user runtime cleanup removes expired transient sessions only', () => {
  const home = createHomeFixture()
  const runtimeRoot = getUserRuntimeRoot(home)
  const expiredDir = join(runtimeRoot, 'expired-session')
  const freshDir = join(runtimeRoot, 'fresh-session')
  const now = Date.now()
  const oldDate = new Date(now - 10 * 24 * 60 * 60 * 1000)

  writeText(join(expiredDir, 'STATE.md'), '# expired\n')
  writeText(join(freshDir, 'STATE.md'), '# fresh\n')
  mkdirSync(expiredDir, { recursive: true })
  utimesSync(expiredDir, oldDate, oldDate)

  const result = cleanupUserRuntimeRoot({
    home,
    now,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  })

  assert.equal(result.errors.length, 0)
  assert.ok(!existsSync(expiredDir))
  assert.ok(existsSync(freshDir))
  assert.deepEqual(readdirSync(runtimeRoot).sort(), ['fresh-session'])
})

test('unactivated runtime artifacts stay in the user-level transient directory', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-runtime-transient-')

  writeSettings(home)

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { writeRuntimeEvidence } = await import(${JSON.stringify(RUNTIME_ARTIFACTS_MODULE_URL)})
      const path = writeRuntimeEvidence(
        ${JSON.stringify(project)},
        'qa-review.json',
        { updatedAt: new Date().toISOString(), commands: [] },
        { payload: { sessionId: 'abc123' } },
      )
      process.stdout.write(JSON.stringify({ path }))
    `,
  })

  assert.match(payload.path, /[\\/]\.helloagents[\\/]runtime[\\/][^\\/]+[\\/]artifacts[\\/]qa-review\.json$/)
  assert.equal(existsSync(join(project, '.helloagents')), false)
})

test('ensured project-local runtime creates session state even without an existing local store', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-ensure-local-runtime-')

  writeSettings(home)

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(project)}, {
        payload: { prompt: '~build do work' },
        ensureProjectLocal: true,
      })
      process.stdout.write(JSON.stringify({
        scope: scope.scope,
        active: scope.active,
        statePath: scope.statePath,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.scope, 'project-session')
  assert.equal(payload.active, true)
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'workspace', 'default', 'STATE.md'))
  assert.equal(existsSync(payload.statePath), true)
})

test('ensured project-local runtime reuses the full-carrier project root from nested directories', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-ensure-local-initialized-project-')
  const nested = join(project, 'packages', 'app')

  writeSettings(home)
  writeText(
    join(project, 'CLAUDE.md'),
    [
      '<!-- HELLOAGENTS_PROFILE: full -->',
      '<!-- HELLOAGENTS_START -->',
      '# initialized project marker',
      '<!-- HELLOAGENTS_END -->',
      '',
    ].join('\n'),
  )
  writeText(join(nested, 'index.js'), 'console.log("ok")\n')

  const payload = runModuleEval({
    cwd: nested,
    env,
    source: `
      const { getRuntimeScope } = await import(${JSON.stringify(RUNTIME_SCOPE_MODULE_URL)})
      const scope = getRuntimeScope(${JSON.stringify(nested)}, {
        payload: { prompt: '~build do work' },
        ensureProjectLocal: true,
      })
      process.stdout.write(JSON.stringify({
        cwd: scope.cwd,
        statePath: scope.statePath,
        sessionDir: scope.sessionDir,
      }))
    `,
  })

  assert.equal(payload.cwd, project)
  assert.equal(payload.statePath, join(project, '.helloagents', 'sessions', 'workspace', 'default', 'STATE.md'))
  assert.equal(payload.sessionDir, join(project, '.helloagents', 'sessions', 'workspace', 'default'))
  assert.equal(existsSync(payload.statePath), true)
  assert.equal(existsSync(join(nested, '.helloagents')), false)
})

test('project session cleanup keeps active and recent state sessions, and removes stale or stateless leftovers', () => {
  const project = createTempDir('helloagents-project-session-cleanup-')
  const now = Date.now()
  const oldDate = new Date(now - 40 * 24 * 60 * 60 * 1000)

  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(join(project, '.helloagents', 'sessions', 'active.json'), JSON.stringify({
    workspace: 'workspace',
    session: 'active1',
    updatedAt: new Date().toISOString(),
  }))
  writeText(join(project, '.helloagents', 'sessions', 'workspace', 'active1', 'STATE.md'), '# active\n')
  writeText(join(project, '.helloagents', 'sessions', 'workspace', 'route1', 'route.txt'), 'route\n')
  writeText(join(project, '.helloagents', 'sessions', 'workspace', 'route1', 'events.jsonl'), '{}\n')
  writeText(join(project, '.helloagents', 'sessions', 'workspace', 'route1', 'artifacts', 'codex-native-stop.json'), '{}\n')
  writeText(join(project, '.helloagents', 'sessions', 'workspace', 'openroute', 'route.txt'), 'route\n')
  writeText(
    join(project, '.helloagents', 'sessions', 'workspace', 'seed1', 'STATE.md'),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '进入当前项目级执行流程',
      '',
      '## 正在做什么',
      '正在初始化当前会话运行态',
      '',
      '## 关键上下文',
      '由运行时自动创建；后续按实际任务重写',
      '',
      '## 下一步',
      '根据当前用户请求继续执行当前流程',
      '',
      '## 阻塞项',
      '（无）',
      '',
      '## 方案',
      '',
      '## 已标记技能',
      '',
    ].join('\n'),
  )
  writeText(join(project, '.helloagents', 'artifacts', 'claude-plugin-load.log'), 'debug\n')
  writeText(join(project, '.helloagents', 'sessions', '.1778250288817-e87c4ac5-a4aa-4120-bc2e-6caea4029dde.tmp'), 'tmp\n')
  mkdirSync(join(project, '.helloagents', 'sessions', 'workspace', 'empty1'), { recursive: true })
  utimesSync(join(project, '.helloagents', 'sessions', 'workspace', 'active1', 'STATE.md'), oldDate, oldDate)

  const result = cleanupProjectSessions(project, { now })

  assert.equal(result.errors.length, 0)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', 'workspace')), true)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', 'workspace', 'openroute')), false)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', 'workspace', 'route1')), false)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', 'workspace', 'empty1')), false)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', '.1778250288817-e87c4ac5-a4aa-4120-bc2e-6caea4029dde.tmp')), false)
  assert.equal((result.removedInactiveDirs.length + result.removedNoStateDirs.length + result.removedSeedDirs.length) > 0, true)
})

test('project session cleanup skips repeated scans inside cooldown window', () => {
  const project = createTempDir('helloagents-project-session-cleanup-cooldown-')
  const now = Date.now()

  writeText(join(project, '.helloagents', '.keep'), '')
  writeText(join(project, '.helloagents', 'sessions', 'active.json'), JSON.stringify({
    workspace: 'workspace',
    session: 'active1',
    cleanupCheckedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }))
  mkdirSync(join(project, '.helloagents', 'sessions', 'workspace', 'empty1'), { recursive: true })

  const result = cleanupProjectSessions(project, {
    now: now + 5_000,
    minIntervalMs: 60_000,
  })

  assert.equal(result.skipped, true)
  assert.equal(existsSync(join(project, '.helloagents', 'sessions', 'workspace', 'empty1')), true)
})

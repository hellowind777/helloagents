import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  REPO_ROOT,
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  runCommand,
  runNode,
  writeText,
} from './helpers/test-env.mjs'
import { parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

const PROJECT_STORAGE_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'project-storage.mjs')).href
const VERIFY_STATE_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'verify-state.mjs')).href
const WORKFLOW_PLAN_FILES_MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'workflow-plan-files.mjs')).href

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

test('repo-shared storage uses one shared knowledge dir across git worktrees while keeping local state dirs', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const repo = createTempDir('helloagents-storage-repo-')
  const worktree = createTempDir('helloagents-storage-worktree-')

  writeSettings(home, { project_store_mode: 'repo-shared' })
  writeText(join(repo, 'README.md'), '# shared repo\n')

  assertCommandOk(runCommand('git', ['init'], { cwd: repo, env }))
  assertCommandOk(runCommand('git', ['config', 'user.name', 'HelloAGENTS Test'], { cwd: repo, env }))
  assertCommandOk(runCommand('git', ['config', 'user.email', 'helloagents@example.com'], { cwd: repo, env }))
  assertCommandOk(runCommand('git', ['add', 'README.md'], { cwd: repo, env }))
  assertCommandOk(runCommand('git', ['commit', '-m', 'init'], { cwd: repo, env }))
  assertCommandOk(runCommand('git', ['worktree', 'add', worktree, '-b', 'storage-share'], { cwd: repo, env }))

  const payload = runModuleEval({
    cwd: repo,
    env,
    source: `
      const { getProjectStoreSummary } = await import(${JSON.stringify(PROJECT_STORAGE_MODULE_URL)})
      const main = getProjectStoreSummary(${JSON.stringify(repo)})
      const linked = getProjectStoreSummary(${JSON.stringify(worktree)})
      process.stdout.write(JSON.stringify({ main, linked }))
    `,
  })

  assert.equal(payload.main.projectStoreMode, 'repo-shared')
  assert.equal(payload.main.usesSharedStore, true)
  assert.equal(payload.main.storeDir, payload.linked.storeDir)
  assert.notEqual(payload.main.activationDir, payload.linked.activationDir)
  assert.notEqual(payload.main.statePath, payload.linked.statePath)
  assert.match(payload.main.storeDir, /[\\/]\.helloagents[\\/]projects[\\/]/)
})

test('repo-shared mode resolves shared verify.yaml and plan packages from local STATE aliases', () => {
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-storage-project-')
  const feature = '202604080101_shared-plan'

  writeSettings(home, { project_store_mode: 'repo-shared' })

  const summary = runModuleEval({
    cwd: project,
    env,
    source: `
      const { getProjectStoreSummary } = await import(${JSON.stringify(PROJECT_STORAGE_MODULE_URL)})
      process.stdout.write(JSON.stringify(getProjectStoreSummary(${JSON.stringify(project)})))
    `,
  })

  writeText(
    join(project, '.helloagents', 'STATE.md'),
    ['# 恢复快照', '', '## 主线目标', '验证共享知识库路径', '', '## 方案', `.helloagents/plans/${feature}`, ''].join('\n'),
  )
  writeText(join(summary.storeDir, 'verify.yaml'), 'commands:\n  - "npm run shared-test"\n')
  writeText(join(summary.storeDir, 'plans', feature, 'requirements.md'), '# shared requirements\n')
  writeText(join(summary.storeDir, 'plans', feature, 'plan.md'), '# shared plan\n')
  writeText(
    join(summary.storeDir, 'plans', feature, 'tasks.md'),
    ['# shared', '', '## 任务列表', '- [ ] 检查共享方案解析（涉及文件：src/demo.ts；完成标准：共享方案被识别；验证方式：npm run shared-test）', ''].join('\n'),
  )

  const payload = runModuleEval({
    cwd: project,
    env,
    source: `
      const { detectCommands } = await import(${JSON.stringify(VERIFY_STATE_MODULE_URL)})
      const { getWorkflowSnapshot } = await import(${JSON.stringify(WORKFLOW_PLAN_FILES_MODULE_URL)})
      const snapshot = getWorkflowSnapshot(${JSON.stringify(project)})
      const primaryPlan = snapshot.plans[0] || null
      process.stdout.write(JSON.stringify({
        commands: detectCommands(${JSON.stringify(project)}),
        statePath: snapshot.state.statePath,
        referencedPlanDir: snapshot.state.referencedPlanDir,
        planDir: primaryPlan?.dirPath || '',
        relativePath: primaryPlan?.relativePath || '',
        referencedByState: primaryPlan?.referencedByState || false,
      }))
    `,
  })

  assert.deepEqual(payload.commands, ['npm run shared-test'])
  assert.equal(payload.statePath, join(project, '.helloagents', 'STATE.md'))
  assert.equal(payload.planDir, join(summary.storeDir, 'plans', feature))
  assert.equal(payload.referencedPlanDir, join(summary.storeDir, 'plans', feature))
  assert.equal(payload.relativePath, `.helloagents/plans/${feature}`)
  assert.equal(payload.referencedByState, true)
})

test('notify inject and command routing expose repo-shared project storage hints', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-storage-notify-')
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs')

  writeSettings(home, {
    install_mode: 'standby',
    project_store_mode: 'repo-shared',
  })
  mkdirSync(join(project, '.helloagents'), { recursive: true })

  let result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  })
  let payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /当前项目存储/)
  assert.match(payload.hookSpecificOutput.additionalContext, /"project_store_mode": "repo-shared"/)
  assert.match(payload.hookSpecificOutput.additionalContext, /"knowledge_base_dir":/)

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~plan create a shared workflow plan' }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /project_store_mode=repo-shared/)
  assert.match(payload.hookSpecificOutput.additionalContext, /知识库\/方案目录改为/)
})

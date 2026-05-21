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
import { getSessionEvidencePath, parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('ralph loop covers build detection, breaker reset, and subagent fast-path filtering', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-qa-')
  const ralphScript = join(pkgRoot, 'scripts', 'ralph-loop.mjs')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeJson(join(project, 'package.json'), {
    name: 'qa-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(1)"',
    },
  })

  let result = runNode(ralphScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /npm run build/)
  assert.equal(readJson(getSessionEvidencePath(project, 'loop-breaker.json')).consecutive_failures, 1)

  writeJson(join(project, 'package.json'), {
    name: 'qa-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"',
    },
  })

  result = runNode(ralphScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.suppressOutput, true)
  assert.equal(readJson(getSessionEvidencePath(project, 'loop-breaker.json')).consecutive_failures, 0)
  assert.equal(readJson(getSessionEvidencePath(project, 'qa-review.json')).fastOnly, true)

  writeText(join(project, '.helloagents', 'verify.yaml'), 'commands:\n  - "npm run test"\n')
  result = runNode(ralphScript, ['subagent'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /未找到快速验证命令/)
})

test('ralph loop blocks HelloAGENTS wrapper in subagent output', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-subagent-output-')
  const ralphScript = join(pkgRoot, 'scripts', 'ralph-loop.mjs')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeJson(join(project, 'package.json'), {
    name: 'subagent-output-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
    },
  })

  const result = runNode(ralphScript, ['subagent'], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      lastAssistantMessage: '✅【HelloAGENTS】- 子任务已完成\n\n局部结果。\n\n🔄 下一步: 等待主代理汇总',
    }),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /子代理输出不应使用 HelloAGENTS 外层格式/)
})

test('ralph loop infers subagent mode from delegated payload aliases', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-subagent-alias-')
  const ralphScript = join(pkgRoot, 'scripts', 'ralph-loop.mjs')

  writeSettings(home)
  writeText(join(project, '.helloagents', '.keep'), '')
  writeJson(join(project, 'package.json'), {
    name: 'subagent-alias-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
    },
  })

  const result = runNode(ralphScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({
      cwd: project,
      parent_agent_id: 'parent-1',
      agent_role: 'worker',
      last_assistant_message: '✅【HelloAGENTS】- 子任务已完成\n\n局部结果。\n\n🔄 下一步: 等待主代理汇总',
    }),
  })
  const payload = parseStdoutJson(result)
  assert.equal(payload.decision, 'block')
  assert.match(payload.reason, /子代理输出不应使用 HelloAGENTS 外层格式/)
})

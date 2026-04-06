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
import { parseStdoutJson, writeSettings } from './helpers/runtime-test-helpers.mjs'

test('ralph loop covers build detection, breaker reset, and subagent fast-path filtering', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const project = createTempDir('helloagents-verify-')
  const ralphScript = join(pkgRoot, 'scripts', 'ralph-loop.mjs')

  writeSettings(home)
  writeJson(join(project, 'package.json'), {
    name: 'verify-project',
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
  assert.equal(readJson(join(project, '.helloagents', '.ralph-breaker.json')).consecutive_failures, 1)

  writeJson(join(project, 'package.json'), {
    name: 'verify-project',
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
  assert.equal(readJson(join(project, '.helloagents', '.ralph-breaker.json')).consecutive_failures, 0)
  assert.equal(readJson(join(project, '.helloagents', '.ralph-verify.json')).fastOnly, false)

  writeText(join(project, '.helloagents', 'verify.yaml'), 'commands:\n  - "npm run test"\n')
  result = runNode(ralphScript, ['subagent'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /未找到快速验证命令/)
})

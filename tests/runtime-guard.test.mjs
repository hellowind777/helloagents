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

test('guard blocks dangerous commands and warns on risky writes', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const env = buildHomeEnv(home)
  const guardScript = join(pkgRoot, 'scripts', 'guard.mjs')
  const warnProject = createTempDir('helloagents-guard-warn-')
  const gateProject = createTempDir('helloagents-guard-gate-')
  const planFirstProject = createTempDir('helloagents-guard-plan-')

  writeSettings(home)

  let result = runNode(guardScript, [], {
    env,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin dev' },
    }),
  })
  let payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /Force push/)

  result = runNode(guardScript, [], {
    env,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'TRUNCATE users' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /Table truncation/)

  result = runNode(guardScript, [], {
    env,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'cmd /c dir' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /Nested cmd invocation/)

  result = runNode(guardScript, [], {
    cwd: warnProject,
    env,
    input: JSON.stringify({
      cwd: warnProject,
      tool_name: 'Bash',
      tool_input: { command: 'npm publish' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /高风险操作提醒/)
  assert.match(payload.hookSpecificOutput.additionalContext, /Package publish command/)

  result = runNode(guardScript, [], {
    cwd: warnProject,
    env,
    input: JSON.stringify({
      cwd: warnProject,
      tool_name: 'Bash',
      tool_input: { command: 'powershell -Command "Write-Host 1; Write-Host 2; Write-Host 3; Write-Host 4"' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, undefined)
  assert.match(payload.hookSpecificOutput.additionalContext, /Shell 安全提醒/)
  assert.match(payload.hookSpecificOutput.additionalContext, /PowerShell inline script exceeds 3 logical lines/)

  writeText(
    getSessionStatePath(gateProject),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '完成发布前收尾并在验证通过后发布',
      '',
      '## 正在做什么',
      '继续发布前收尾',
      '',
      '## 方案',
      '.helloagents/plans/202604050201_release',
      '',
      '## 下一步',
      '完成收尾验证后再发布',
      '',
    ].join('\n'),
  )
  writeText(join(gateProject, '.helloagents', 'plans', '202604050201_release', 'requirements.md'), '# release requirements\n')
  writeText(join(gateProject, '.helloagents', 'plans', '202604050201_release', 'plan.md'), '# release plan\n')
  writeText(join(gateProject, '.helloagents', 'plans', '202604050201_release', 'tasks.md'), '# release tasks\n\n- [ ] 最终验证\n')
  writeJson(join(gateProject, '.helloagents', 'plans', '202604050201_release', 'contract.json'), {
    version: 1,
    source: 'plan',
    originCommand: 'plan',
    verifyMode: 'test-first',
    reviewerFocus: [],
    testerFocus: ['最终验证通过'],
    ui: {
      required: false,
      designContract: false,
      sourcePriority: [],
    },
  })

  result = runNode(guardScript, [], {
    cwd: gateProject,
    env,
    input: JSON.stringify({
      cwd: gateProject,
      tool_name: 'Bash',
      tool_input: { command: 'npm publish' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /VERIFY \/ CONSOLIDATE/)
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /~build -> ~verify/)

  writeText(join(planFirstProject, '.helloagents', 'plans', '202604050301_schema', 'requirements.md'), '# schema requirements\n')
  writeText(join(planFirstProject, '.helloagents', 'plans', '202604050301_schema', 'tasks.md'), '# schema tasks\n\n- [ ] plan first\n')
  writeText(
    getSessionStatePath(planFirstProject),
    [
      '# 恢复快照',
      '',
      '## 主线目标',
      '先补齐数据库变更方案，再执行迁移',
      '',
      '## 正在做什么',
      '准备数据库变更',
      '',
      '## 方案',
      '.helloagents/plans/202604050301_schema',
      '',
      '## 下一步',
      '先补齐方案包',
      '',
    ].join('\n'),
  )

  result = runNode(guardScript, [], {
    cwd: planFirstProject,
    env,
    input: JSON.stringify({
      cwd: planFirstProject,
      tool_name: 'Bash',
      tool_input: { command: 'prisma migrate deploy' },
    }),
  })
  payload = parseStdoutJson(result)
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /still requires ~plan before risky schema changes/)

  result = runNode(guardScript, ['post-write'], {
    env,
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: join(createTempDir('helloagents-write-'), '.env'),
        content: 'API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz"',
      },
    }),
  })
  payload = parseStdoutJson(result)
  assert.match(payload.hookSpecificOutput.additionalContext, /API secret key pattern detected/)
  assert.match(payload.hookSpecificOutput.additionalContext, /\.env file written but .*\.gitignore/)
})

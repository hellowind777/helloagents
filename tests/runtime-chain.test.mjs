import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readJson,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs';

function parseStdoutJson(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

function writeSettings(home, overrides = {}) {
  writeJson(join(home, '.helloagents', 'helloagents.json'), {
    output_language: '',
    output_format: true,
    notify_level: 0,
    ralph_loop_enabled: true,
    guard_enabled: true,
    kb_create_mode: 1,
    commit_attribution: '',
    install_mode: 'standby',
    ...overrides,
  });
}

test('notify route and inject cover standby, activated projects, and global mode', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const project = createTempDir('helloagents-project-');
  const env = buildHomeEnv(home);
  const notifyScript = join(pkgRoot, 'scripts', 'notify.mjs');

  writeSettings(home, { install_mode: 'standby' });

  let result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'startup' }),
  });
  let payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /HelloAGENTS \(Standby\)/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 包根目录/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 读取根目录/);
  assert.doesNotMatch(payload.hookSpecificOutput.additionalContext, /统一执行流程/);

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: '~help' }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前命令技能文件已解析为：/);
  assert.match(payload.hookSpecificOutput.additionalContext, /skills[\\\/]commands[\\\/]help[\\\/]SKILL\.md/);
  assert.match(payload.hookSpecificOutput.additionalContext, /不要再为同一个命令 skill 重复 Test-Path \/ Get-Content/);

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  });
  payload = parseStdoutJson(result);
  assert.equal(payload.suppressOutput, true);
  assert.equal(payload.hookSpecificOutput, undefined);

  writeText(join(project, '.helloagents', 'STATE.md'), '# activated\n');
  result = runNode(notifyScript, ['inject'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, source: 'resume' }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 包根目录/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 读取根目录/);
  assert.match(payload.hookSpecificOutput.additionalContext, /会话已恢复\/压缩/);

  result = runNode(notifyScript, ['route'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project, prompt: 'create a new app for expenses' }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /必须进入 ~design/);

  writeSettings(home, { install_mode: 'global' });
  const freshProject = createTempDir('helloagents-project-global-');
  result = runNode(notifyScript, ['inject'], {
    cwd: freshProject,
    env,
    input: JSON.stringify({ cwd: freshProject, source: 'startup' }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /统一执行流程/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 包根目录/);
  assert.match(payload.hookSpecificOutput.additionalContext, /当前 HelloAGENTS 读取根目录/);
});

test('guard blocks dangerous commands and warns on risky writes', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const env = buildHomeEnv(home);
  const guardScript = join(pkgRoot, 'scripts', 'guard.mjs');

  writeSettings(home);

  let result = runNode(guardScript, [], {
    env,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push --force origin dev' },
    }),
  });
  let payload = parseStdoutJson(result);
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(payload.hookSpecificOutput.permissionDecisionReason, /Force push/);

  result = runNode(guardScript, [], {
    env,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    }),
  });
  assert.equal(result.stdout, '');

  result = runNode(guardScript, ['post-write'], {
    env,
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: {
        file_path: join(createTempDir('helloagents-write-'), '.env'),
        content: 'API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz"',
      },
    }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /API secret key pattern detected/);
  assert.match(payload.hookSpecificOutput.additionalContext, /\.env file written but .*\.gitignore/);
});

test('ralph loop covers build detection, breaker reset, and subagent fast-path filtering', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const env = buildHomeEnv(home);
  const project = createTempDir('helloagents-verify-');
  const ralphScript = join(pkgRoot, 'scripts', 'ralph-loop.mjs');

  writeSettings(home);
  writeJson(join(project, 'package.json'), {
    name: 'verify-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(1)"',
    },
  });

  let result = runNode(ralphScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  });
  let payload = parseStdoutJson(result);
  assert.equal(payload.decision, 'block');
  assert.match(payload.reason, /npm run build/);
  assert.equal(readJson(join(project, '.helloagents', '.ralph-breaker.json')).consecutive_failures, 1);

  writeJson(join(project, 'package.json'), {
    name: 'verify-project',
    scripts: {
      lint: 'node -e "process.exit(0)"',
      typecheck: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
      build: 'node -e "process.exit(0)"',
    },
  });

  result = runNode(ralphScript, [], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  });
  payload = parseStdoutJson(result);
  assert.equal(payload.suppressOutput, true);
  assert.equal(readJson(join(project, '.helloagents', '.ralph-breaker.json')).consecutive_failures, 0);

  writeText(join(project, '.helloagents', 'verify.yaml'), 'commands:\n  - "npm run test"\n');
  result = runNode(ralphScript, ['subagent'], {
    cwd: project,
    env,
    input: JSON.stringify({ cwd: project }),
  });
  payload = parseStdoutJson(result);
  assert.match(payload.hookSpecificOutput.additionalContext, /未找到快速验证命令/);
});

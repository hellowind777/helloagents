#!/usr/bin/env node
/**
 * HelloAGENTS Ralph Loop — Quality verification gate
 * Runs on SubagentStop (Claude Code) and Stop (Codex CLI).
 * Auto-detects lint/test commands and blocks if they fail.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');
const CMD_TIMEOUT = 60_000; // 60s

// ── Settings ──────────────────────────────────────────────────────────
function readSettings() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch {}
  return {};
}

// ── Detect verification commands ──────────────────────────────────────
function loadVerifyYaml(cwd) {
  const f = join(cwd, '.helloagents', 'verify.yaml');
  if (!existsSync(f)) return null;
  try {
    const content = readFileSync(f, 'utf-8');
    const cmds = [];
    let inCmds = false;
    for (const line of content.split('\n')) {
      const s = line.trim();
      if (s.startsWith('commands:')) { inCmds = true; continue; }
      if (inCmds) {
        if (s.startsWith('- ') && !s.startsWith('# ')) {
          const cmd = s.slice(2).trim().replace(/^["']|["']$/g, '');
          if (cmd && !cmd.startsWith('#')) cmds.push(cmd);
        } else if (s && !s.startsWith('#')) break;
      }
    }
    return cmds.length ? cmds : null;
  } catch { return null; }
}

function detectFromPackageJson(cwd) {
  const f = join(cwd, 'package.json');
  if (!existsSync(f)) return [];
  try {
    const scripts = JSON.parse(readFileSync(f, 'utf-8')).scripts || {};
    return ['lint', 'typecheck', 'type-check', 'test']
      .filter(k => k in scripts)
      .map(k => `npm run ${k}`);
  } catch { return []; }
}

function detectFromPyproject(cwd) {
  const f = join(cwd, 'pyproject.toml');
  if (!existsSync(f)) return [];
  try {
    const content = readFileSync(f, 'utf-8');
    const cmds = [];
    if (content.includes('[tool.ruff')) cmds.push('ruff check .');
    if (content.includes('[tool.mypy')) cmds.push('mypy .');
    if (content.includes('[tool.pytest')) cmds.push('pytest --tb=short -q');
    return cmds;
  } catch { return []; }
}

function detectCommands(cwd) {
  const yaml = loadVerifyYaml(cwd);
  if (yaml?.length) return yaml;
  const pkg = detectFromPackageJson(cwd);
  if (pkg.length) return pkg;
  return detectFromPyproject(cwd);
}

// ── Circuit Breaker (consecutive failure tracking) ───────────────────
const BREAKER_FILE_NAME = '.ralph-breaker.json';

function getBreakerPath(cwd) {
  return join(cwd, '.helloagents', BREAKER_FILE_NAME);
}

function readBreaker(cwd) {
  try {
    return JSON.parse(readFileSync(getBreakerPath(cwd), 'utf-8'));
  } catch {
    return { consecutive_failures: 0, last_failure: null };
  }
}

function writeBreaker(cwd, state) {
  const dir = join(cwd, '.helloagents');
  try { mkdirSync(dir, { recursive: true }); } catch {}
  writeFileSync(getBreakerPath(cwd), JSON.stringify(state, null, 2));
}

function resetBreaker(cwd) {
  writeBreaker(cwd, { consecutive_failures: 0, last_failure: null });
}

// ── Progress Detection (git diff check) ──────────────────────────────

function hasGitChanges(cwd) {
  try {
    const diff = execSync('git diff --stat HEAD', {
      cwd, encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (diff) return true;
    // Also check staged changes
    const staged = execSync('git diff --stat --cached', {
      cwd, encoding: 'utf-8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return !!staged;
  } catch {
    return true; // If git fails, assume changes exist (don't block on git errors)
  }
}

// ── Run verification ──────────────────────────────────────────────────
const SHELL_OPERATORS = /[;&|`$(){}\n\r]/;

function runVerify(commands, cwd) {
  const failures = [];
  for (const cmd of commands) {
    if (SHELL_OPERATORS.test(cmd)) {
      failures.push({ cmd, output: 'Blocked: shell operators not allowed in verify commands' });
      continue;
    }
    try {
      execSync(cmd, { cwd, encoding: 'utf-8', timeout: CMD_TIMEOUT, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      // ENOENT = command or dependency not installed, skip instead of failing
      if (err.code === 'ENOENT' || (err.stderr && /ENOENT|not found|command not found/i.test(err.stderr))) {
        continue;
      }
      let output = ((err.stdout || '') + (err.stderr || '')).trim();
      if (output.length > 1000) output = output.slice(0, 1000) + '\n...(truncated)';
      failures.push({ cmd, output: output || `exit code ${err.status}` });
    }
  }
  return failures;
}

// ── Result Handlers ──────────────────────────────────────────────────

function handleSuccess(cwd, isSubagent) {
  resetBreaker(cwd);

  if (isSubagent) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStop',
        additionalContext: '子代理快速验证通过（lint/typecheck）。请控制器审查变更后继续。',
      },
      suppressOutput: true,
    }));
    return;
  }

  // Progress detection: warn if claiming done but no git changes
  if (!hasGitChanges(cwd)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: '⚠️ [Ralph Loop] 验证通过但未检测到代码变更（git diff 为空）。如果确实完成了编码任务，请确认变更已保存。',
      },
      suppressOutput: true,
    }));
  } else {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
  }
}

function handleFailure(failures, cwd) {
  const breaker = readBreaker(cwd);
  breaker.consecutive_failures += 1;
  breaker.last_failure = new Date().toISOString();
  writeBreaker(cwd, breaker);

  const breakerWarning = breaker.consecutive_failures >= 3
    ? `\n\n⚠️ [断路器] 已连续 ${breaker.consecutive_failures} 次验证失败。当前修复思路可能有误，建议：\n  1. 重新分析根因，不要继续在同一方向上硬修\n  2. 检查是否存在架构层面的问题\n  3. 考虑回退到上一个正常状态重新开始`
    : '';

  const details = failures.map(f => `\u2717 ${f.cmd}\n${f.output}`).join('\n\n');
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[Ralph Loop] Verification failed:\n\n${details}\n\nFix the issues above before completing.${breakerWarning}`,
    suppressOutput: true,
  }));
}

/** Filter commands to fast checks only for subagent mode. Returns null if no fast commands found. */
function filterSubagentCommands(commands) {
  const fast = commands.filter(cmd =>
    /lint|typecheck|type-check|ruff check|mypy|eslint|tsc/.test(cmd)
  );
  if (fast.length === 0) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStop',
        additionalContext: '子代理完成。未找到快速验证命令，请控制器手动审查变更。',
      },
      suppressOutput: true,
    }));
    return null;
  }
  return fast;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const settings = readSettings();
  if (settings.ralph_loop_enabled === false) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  const isSubagent = (process.argv[2] || '') === 'subagent';

  let data = {};
  try { data = JSON.parse(readFileSync(0, 'utf-8')); } catch {}
  const cwd = data.cwd || process.cwd();

  let commands = detectCommands(cwd);
  if (!commands?.length) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  if (isSubagent) {
    commands = filterSubagentCommands(commands);
    if (!commands) return;
  }

  const failures = runVerify(commands, cwd);
  if (failures.length === 0) handleSuccess(cwd, isSubagent);
  else handleFailure(failures, cwd);
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
});

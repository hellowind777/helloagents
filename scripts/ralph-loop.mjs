#!/usr/bin/env node
/**
 * HelloAGENTS Ralph Loop — Quality verification gate
 * Runs on SubagentStop (Claude Code) and Stop (Codex CLI).
 * Auto-detects lint/test commands and blocks if they fail.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { clearVerifyEvidence, detectCommands, hasUnsafeVerifyCommand, writeVerifyEvidence } from './verify-state.mjs';
import {
  getRuntimeEvidencePath,
  readRuntimeEvidence,
  writeRuntimeEvidence,
} from './runtime-artifacts.mjs';

const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');
const CMD_TIMEOUT = 60_000; // 60s

// Hook event name: read from env or infer from CLI mode + --gemini flag.
// Claude: SubagentStop/Stop, Gemini: AfterAgent/SessionEnd.
const IS_SUBAGENT = (process.argv[2] || '') === 'subagent';
const IS_GEMINI = process.argv.includes('--gemini');
const HOOK_EVENT = process.env.HELLOAGENTS_HOOK_EVENT
  || (IS_SUBAGENT ? (IS_GEMINI ? 'AfterAgent' : 'SubagentStop') : (IS_GEMINI ? 'SessionEnd' : 'Stop'));

// ── Settings ──────────────────────────────────────────────────────────
function readSettings() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch {}
  return {};
}

// ── Circuit Breaker (consecutive failure tracking) ───────────────────
const BREAKER_FILE_NAME = 'loop-breaker.json';

function readBreaker(cwd, options = {}) {
  return readRuntimeEvidence(cwd, BREAKER_FILE_NAME, options)
    || { consecutive_failures: 0, last_failure: null };
}

function writeBreaker(cwd, state, options = {}) {
  writeRuntimeEvidence(cwd, BREAKER_FILE_NAME, state, options);
}

function resetBreaker(cwd, options = {}) {
  writeBreaker(cwd, { consecutive_failures: 0, last_failure: null }, options);
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
function runVerify(commands, cwd) {
  const failures = [];
  for (const cmd of commands) {
    if (hasUnsafeVerifyCommand([cmd])) {
      failures.push({ cmd, output: '已阻止：验证命令不允许使用 shell 组合操作符' });
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
      if (output.length > 1000) output = output.slice(0, 1000) + '\n…已截断';
      failures.push({ cmd, output: output || `退出码 ${err.status}` });
    }
  }
  return failures;
}

/** Filter commands to fast checks only for subagent mode. Returns null if no fast commands found. */
function filterSubagentCommands(commands) {
  const fast = commands.filter(cmd =>
    /lint|typecheck|type-check|ruff check|mypy|eslint|tsc/.test(cmd)
  );
  if (fast.length === 0) {
    return {
      hookSpecificOutput: {
        hookEventName: HOOK_EVENT,
        additionalContext: '子代理完成。未找到快速验证命令，请控制器手动审查变更。',
      },
      suppressOutput: true,
    };
  }
  return { commands: fast };
}

export function evaluateRalphLoop(data = {}, runtime = {}) {
  const settings = readSettings();
  if (settings.ralph_loop_enabled === false) {
    return { suppressOutput: true };
  }

  const cwd = data.cwd || process.cwd();
  const runtimeOptions = { payload: data };
  const isSubagent = runtime.isSubagent ?? IS_SUBAGENT;
  const hookEventName = runtime.hookEventName || HOOK_EVENT;

  let commands = detectCommands(cwd);
  if (!commands?.length) {
    return { suppressOutput: true };
  }

  if (isSubagent) {
    const filtered = filterSubagentCommands(commands);
    if (!filtered?.commands) return filtered || { suppressOutput: true };
    commands = filtered.commands;
  }

  const failures = runVerify(commands, cwd);
  if (failures.length === 0) {
    resetBreaker(cwd, runtimeOptions);
    writeVerifyEvidence(cwd, {
      commands: detectCommands(cwd),
      fastOnly: isSubagent,
      source: isSubagent ? 'subagent' : 'stop',
    }, runtimeOptions);

    if (isSubagent) {
      return {
        hookSpecificOutput: {
          hookEventName,
          additionalContext: '子代理快速验证通过（lint/typecheck）。请控制器审查变更后继续。',
        },
        suppressOutput: true,
      };
    }

    if (!hasGitChanges(cwd)) {
      return {
        hookSpecificOutput: {
          hookEventName,
          additionalContext: '⚠️ [Ralph Loop] 验证通过但未检测到代码变更（git diff 为空）。如果确实完成了编码任务，请确认变更已保存。',
        },
        suppressOutput: true,
      };
    }

    return { suppressOutput: true };
  }

  clearVerifyEvidence(cwd, runtimeOptions);
  const breaker = readBreaker(cwd, runtimeOptions);
  breaker.consecutive_failures += 1;
  breaker.last_failure = new Date().toISOString();
  writeBreaker(cwd, breaker, runtimeOptions);

  const breakerWarning = breaker.consecutive_failures >= 3
    ? `\n\n⚠️ [断路器] 已连续 ${breaker.consecutive_failures} 次验证失败。当前修复思路可能有误，先处理：\n  1. 重新分析根因，不要继续在同一方向上硬修\n  2. 检查是否存在架构层面的问题\n  3. 考虑回退到上一个正常状态重新开始`
    : '';
  const details = failures.map(f => `\u2717 ${f.cmd}\n${f.output}`).join('\n\n');
  return {
    decision: 'block',
    reason: `[Ralph Loop] 验证失败：\n\n${details}\n\n请先修复以上问题，再报告完成。${breakerWarning}`,
    suppressOutput: true,
  };
}

// ── Main ──────────────────────────────────────────────────────────────
function main() {
  let data = {};
  try { data = JSON.parse(readFileSync(0, 'utf-8')); } catch {}
  process.stdout.write(JSON.stringify(evaluateRalphLoop(data)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `[Ralph Loop] 验证脚本执行异常，已暂停完成通知。\n原因：${error?.message || error}`,
      suppressOutput: true,
    }));
  }
}

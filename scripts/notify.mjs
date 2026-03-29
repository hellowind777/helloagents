#!/usr/bin/env node
// notify.mjs — Unified notification & bootstrap injection for HelloAGENTS
// Zero external dependencies, ES module, cross-platform

import { join, dirname } from 'node:path';
import { existsSync, readFileSync, readSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { playSound as _playSound, desktopNotify as _desktopNotify } from './notify-ui.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');

// Bind PKG_ROOT to UI functions
const playSound = (event) => _playSound(PKG_ROOT, event);
const desktopNotify = (event, extra) => _desktopNotify(PKG_ROOT, event, extra);

// ── Settings ────────────────────────────────────────────────────────────────

function readSettings() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch {}
  return {};
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readStdin() {
  try {
    const chunks = [];
    const buf = Buffer.alloc(4096);
    let n;
    const fd = process.stdin.fd;
    try {
      while ((n = readSync(fd, buf, 0, buf.length)) > 0) {
        chunks.push(buf.slice(0, n));
      }
    } catch {}
    const raw = Buffer.concat(chunks).toString('utf-8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function suppressedOutput(hookEventName, additionalContext) {
  output({
    hookSpecificOutput: {
      hookEventName,
      ...(additionalContext != null ? { additionalContext } : {}),
    },
    suppressOutput: true,
  });
}

function emptySuppress() {
  output({ suppressOutput: true });
}

// version-check: 预留，暂未实现
function versionCheckBackground() {}

/** Run Ralph Loop verification. Returns true if blocked (verification failed). */
function runRalphLoop(payload) {
  const settings = readSettings();
  if (settings.ralph_loop_enabled === false) return false;
  try {
    const rlPath = join(__dirname, 'ralph-loop.mjs');
    if (!existsSync(rlPath)) return false;
    const result = spawnSync(process.execPath, [rlPath], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      timeout: 120_000,
    });
    if (result.stdout) {
      const rlOut = JSON.parse(result.stdout);
      if (rlOut.decision === 'block') {
        output(rlOut);
        return true;
      }
    }
  } catch {}
  return false;
}

// ── Sub-command: pre-compact (PreCompact) ───────────────────────────────────

function cmdPreCompact() {
  const payload = readStdin();

  // Build a context summary to survive compaction
  const summaryParts = [];

  summaryParts.push('## HelloAGENTS 压缩摘要');
  summaryParts.push('以下信息在上下文压缩前保存，确保压缩后不丢失关键状态。');

  // Read STATE.md for current task state (highest priority)
  const cwd = payload.cwd || process.cwd();
  const statePath = join(cwd, '.helloagents', 'STATE.md');
  if (existsSync(statePath)) {
    try {
      const stateContent = readFileSync(statePath, 'utf-8');
      summaryParts.push('');
      summaryParts.push('## 恢复快照（从 STATE.md 读取，读完即可接上工作）');
      summaryParts.push(stateContent);
    } catch {}
  }

  // Re-inject bootstrap essentials (choose version based on mode/activation)
  const settings = readSettings();
  const isGlobal = settings.install_mode === 'global';
  const isActivated = existsSync(join(cwd, '.helloagents'));
  const bootstrapFile = (isGlobal || isActivated) ? 'bootstrap.md' : 'bootstrap-lite.md';

  let bootstrap = '';
  try { bootstrap = readFileSync(join(PKG_ROOT, bootstrapFile), 'utf-8'); } catch {}
  if (bootstrap) {
    summaryParts.push('');
    summaryParts.push('## 核心规则（从 bootstrap 重新注入）');
    summaryParts.push(bootstrap);
  }

  // Append user settings
  if (Object.keys(settings).length) {
    summaryParts.push('');
    summaryParts.push(`## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``);
  }

  const context = summaryParts.join('\n');
  suppressedOutput('PreCompact', context);
}

// ── Sub-command: route (UserPromptSubmit) ────────────────────────────────────

function cmdRoute() {
  const payload = readStdin();
  const prompt = (payload.prompt || '').trim();

  if (!prompt) {
    emptySuppress();
    return;
  }

  // Subagent tasks skip all routing
  if (/^\[子代理任务\]/.test(prompt)) {
    emptySuppress();
    return;
  }

  // Detect ~command patterns
  const cmdMatch = prompt.match(/^~(\w+)/);
  if (cmdMatch) {
    const skillName = cmdMatch[1];
    suppressedOutput('UserPromptSubmit',
      `用户使用了 ~${skillName} 命令。请读取 skills/commands/${skillName}/SKILL.md 并按其流程执行。`);
    return;
  }

  // Detect new project keywords → suggest ~design (only in global mode or activated projects)
  const cwd = payload.cwd || process.cwd();
  const settings = readSettings();
  const isGlobal = settings.install_mode === 'global';
  const isActivated = existsSync(join(cwd, '.helloagents'));

  if (isGlobal || isActivated) {
    const newProjectPatterns = [
      /(?:创建|新建|从零|搭建).*(?:项目|应用|系统|网站|游戏|工具|平台|小程序|APP)/,
      /(?:做|写|开发|实现)[一个]*.*(?:项目|应用|系统|网站|游戏|工具|平台|小程序|APP)/,
      /\b(build|create|design|make|new|start|init)\b.*\b(app|game|project|site|website|tool|system|platform)\b/i,
    ];

    for (const pat of newProjectPatterns) {
      if (pat.test(prompt)) {
        suppressedOutput('UserPromptSubmit',
          '检测到可能是新项目/新应用任务。根据 HelloAGENTS 路由规则，新项目必须进入 ~design 设计流程。请引导用户进入 ~design。');
        return;
      }
    }
  }

  emptySuppress();
}

// ── Sub-command: inject (SessionStart) ──────────────────────────────────────

function cmdInject() {
  const payload = readStdin();
  const source = payload.source || 'startup'; // startup | resume | clear | compact

  // Determine which bootstrap to inject based on mode and project state
  const cwd = payload.cwd || process.cwd();
  const settings = readSettings();
  const isGlobal = settings.install_mode === 'global';
  const isActivated = existsSync(join(cwd, '.helloagents'));
  const bootstrapFile = (isGlobal || isActivated) ? 'bootstrap.md' : 'bootstrap-lite.md';

  let bootstrap = '';
  try { bootstrap = readFileSync(join(PKG_ROOT, bootstrapFile), 'utf-8'); } catch {}

  // Read user settings and append to bootstrap
  const settingsBlock = Object.keys(settings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``
    : '';

  let context = bootstrap + settingsBlock;

  // resume/compact: 注入完整内容，因为上下文压缩后之前的规则已丢失
  // clear: 同理，上下文已清空
  if (source === 'resume' || source === 'compact') {
    context += '\n\n> ⚠️ 会话已恢复/压缩，请先读取 .helloagents/STATE.md 恢复工作状态。';
  }

  suppressedOutput('SessionStart', context || undefined);
  versionCheckBackground();
}

// ── Sub-command: stop (Combined Stop hook) ──────────────────────────────────
// Stop hook 由 notify.mjs 统一编排：先运行 ralph-loop 验证，再处理完成声明检测和通知。
// SubagentStop 则直接调用 ralph-loop.mjs（见 hooks.json），因为子代理只需验证不需通知。

function cmdStop() {
  const payload = readStdin();

  // 1. Run Ralph Loop verification (blocks if failed)
  if (runRalphLoop(payload)) {
    playSound('warning');
    desktopNotify('warning');
    return;
  }

  // 2. Notification (only if not blocked)
  const settings = readSettings();
  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete');

  emptySuppress();
}

// ── Sub-command: sound <event> ──────────────────────────────────────────────

function cmdSound() {
  const event = process.argv[3] || 'complete';
  playSound(event);
}

// ── Sub-command: desktop [msg] ──────────────────────────────────────────────

function cmdDesktop() {
  const event = process.argv[3] || 'complete';
  desktopNotify(event);
}

// ── Sub-command: codex-notify ───────────────────────────────────────────────

function cmdCodexNotify() {
  let data = {};
  try { data = JSON.parse(process.argv[3] || '{}'); } catch {}

  const type = data.type || '';
  const client = data.client || '';

  // Only play sounds for terminal TUI, skip IDE clients
  if (client && client !== 'codex-tui') return;

  if (type === 'approval-requested') {
    playSound('confirm');
    desktopNotify('confirm');
    return;
  }

  if (type !== 'agent-turn-complete') return;

  const lastMsg = data['last-assistant-message'] || '';
  const settings = readSettings();

  // Filter subagents: when output_format is enabled, only main agent includes marker
  if (settings.output_format !== false && !lastMsg.includes('【HelloAGENTS】')) return;

  const claimsComplete = /✅|完成|已修复|done|fixed|completed|finished/i.test(lastMsg);
  const cwd = data.cwd || process.cwd();

  // Ralph Loop verification on completion claims
  if (claimsComplete && runRalphLoop({ cwd })) {
    playSound('warning');
    desktopNotify('warning');
    return;
  }

  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete');

  versionCheckBackground();
}

// ── Sub-command: version-check ──────────────────────────────────────────────

function cmdVersionCheck() {
  // Placeholder for future remote version comparison
}

// ── Main Dispatch ───────────────────────────────────────────────────────────

const cmd = process.argv[2] || '';

switch (cmd) {
  case 'inject':        cmdInject(); break;
  case 'stop':          cmdStop(); break;
  case 'pre-compact':   cmdPreCompact(); break;
  case 'route':         cmdRoute(); break;
  case 'sound':         cmdSound(); break;
  case 'desktop':       cmdDesktop(); break;
  case 'codex-notify':  cmdCodexNotify(); break;
  case 'version-check': cmdVersionCheck(); break;
  default:
    process.stderr.write(`notify.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}

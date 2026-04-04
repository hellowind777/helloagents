#!/usr/bin/env node
// notify.mjs — Unified notification & bootstrap injection for HelloAGENTS
// Zero external dependencies, ES module, cross-platform

import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { playSound as _playSound, desktopNotify as _desktopNotify } from './notify-ui.mjs';
import { buildCompactionContext, buildInjectContext, buildRouteInstruction, detectNewProjectRoute } from './notify-context.mjs';
import { claimsTaskComplete, shouldIgnoreCodexNotifyClient, shouldIgnoreFormattedSubagent } from './notify-events.mjs';
import { readSettings, readStdinJson, output, suppressedOutput, emptySuppress, versionCheckBackground } from './notify-shared.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');
const HOST = process.argv.includes('--gemini')
  ? 'gemini'
  : process.argv.includes('--codex')
    ? 'codex'
    : 'claude';
const IS_GEMINI = HOST === 'gemini';
const EVENT_NAME = {
  SessionStart: 'SessionStart',
  UserPromptSubmit: IS_GEMINI ? 'BeforeAgent' : 'UserPromptSubmit',
  PreCompact: IS_GEMINI ? 'BeforeAgent' : 'PreCompact',
};

const playSound = (event) => _playSound(PKG_ROOT, event);
const desktopNotify = (event, extra) => _desktopNotify(PKG_ROOT, event, extra);

function getSettings() {
  return readSettings(CONFIG_FILE);
}

function runRalphLoop(payload) {
  const settings = getSettings();
  if (settings.ralph_loop_enabled === false) return false;
  try {
    const rlPath = join(__dirname, 'ralph-loop.mjs');
    if (!existsSync(rlPath)) return false;
    const result = spawnSync(process.execPath, [rlPath, ...(IS_GEMINI ? ['--gemini'] : [])], {
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

function resolveBootstrapFile(cwd, settings) {
  const isGlobal = settings.install_mode === 'global';
  const isActivated = existsSync(join(cwd, '.helloagents'));
  return (isGlobal || isActivated) ? 'bootstrap.md' : 'bootstrap-lite.md';
}

function cmdPreCompact() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings);
  const context = buildCompactionContext({
    payload,
    pkgRoot: PKG_ROOT,
    settings,
    bootstrapFile,
    host: HOST,
  });
  suppressedOutput(EVENT_NAME.PreCompact, context);
}

function cmdRoute() {
  const payload = readStdinJson();
  const prompt = (payload.prompt || '').trim();
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  if (!prompt) {
    emptySuppress();
    return;
  }
  if (/^\[子代理任务\]/.test(prompt)) {
    emptySuppress();
    return;
  }

  const cmdMatch = prompt.match(/^~(\w+)/);
  if (cmdMatch) {
    const skillName = cmdMatch[1];
    const extraRules = skillName === 'help'
      ? ' 这是 HelloAGENTS 的帮助命令，不是宿主 CLI 的内置帮助。适用条件：仅显示 HelloAGENTS 的帮助和当前设置；优先使用当前上下文中已注入的“当前用户设置”，只有上下文不存在该信息时才尝试读取 ~/.helloagents/helloagents.json；自动激活技能说明仅在全局模式，或当前项目已存在 .helloagents/（例如执行过 ~wiki 或 ~init）时生效。排除条件：不要调用宿主 CLI 的帮助工具（如 cli_help 或 /help），不要使用子代理，不要读取项目文件；若受工作区限制无法读取配置，必须明确说明并按已知默认值或已注入设置展示；纯标准模式未激活项目不会自动触发。'
      : '';
    suppressedOutput(EVENT_NAME.UserPromptSubmit, buildRouteInstruction({
      skillName,
      extraRules,
      cwd,
      pkgRoot: PKG_ROOT,
      host: HOST,
      settings,
    }));
    return;
  }

  const bootstrapFile = resolveBootstrapFile(cwd, settings);
  if (bootstrapFile === 'bootstrap.md') {
    const routeMessage = detectNewProjectRoute(prompt);
    if (routeMessage) {
      suppressedOutput(EVENT_NAME.UserPromptSubmit, routeMessage);
      return;
    }
  }

  emptySuppress();
}

function cmdInject() {
  const payload = readStdinJson();
  const source = payload.source || 'startup';
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings);

  let bootstrap = '';
  try {
    bootstrap = readFileSync(join(PKG_ROOT, bootstrapFile), 'utf-8');
  } catch {}

  const context = buildInjectContext({
    source,
    bootstrap,
    settings,
    pkgRoot: PKG_ROOT,
    host: HOST,
    cwd,
  });
  suppressedOutput(EVENT_NAME.SessionStart, context || undefined);
  versionCheckBackground();
}

function cmdStop() {
  const payload = readStdinJson();
  if (runRalphLoop(payload)) {
    playSound('warning');
    desktopNotify('warning');
    return;
  }

  const settings = getSettings();
  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete');
  emptySuppress();
}

function cmdSound() {
  playSound(process.argv[3] || 'complete');
}

function cmdDesktop() {
  desktopNotify(process.argv[3] || 'complete');
}

function cmdCodexNotify() {
  let data = {};
  try { data = JSON.parse(process.argv[3] || '{}'); } catch {}

  const type = data.type || '';
  const client = data.client || '';
  if (shouldIgnoreCodexNotifyClient(client)) return;

  if (type === 'approval-requested') {
    playSound('confirm');
    desktopNotify('confirm');
    return;
  }
  if (type !== 'agent-turn-complete') return;

  const lastMsg = data['last-assistant-message'] || '';
  const settings = getSettings();
  if (shouldIgnoreFormattedSubagent(lastMsg, settings.output_format !== false)) return;

  const cwd = data.cwd || process.cwd();
  if (claimsTaskComplete(lastMsg) && runRalphLoop({ cwd })) {
    playSound('warning');
    desktopNotify('warning');
    return;
  }

  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete');
  versionCheckBackground();
}

function cmdVersionCheck() {}

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

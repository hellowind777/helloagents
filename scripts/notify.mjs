#!/usr/bin/env node
// notify.mjs — Unified notification & bootstrap injection for HelloAGENTS
// Zero external dependencies, ES module, cross-platform

import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { playSound as _playSound, desktopNotify as _desktopNotify } from './notify-ui.mjs';
import { resolveNotificationSource } from './notify-source.mjs';
import { buildCompactionContext, buildInjectContext, buildRouteInstruction, buildSemanticRouteInstruction, resolveCanonicalCommandSkill } from './notify-context.mjs';
import { shouldIgnoreCodexNotifyClient } from './notify-events.mjs';
import { runGateScript } from './notify-gates.mjs';
import { handleRouteCommand, resolveBootstrapFile } from './notify-route.mjs';
import { readSettings, readStdinJson, output, suppressedOutput, emptySuppress } from './notify-shared.mjs';
import { clearRouteContext, writeRouteContext } from './runtime-context.mjs';
import { appendReplayEvent, startReplaySession } from './replay-state.mjs';
import { clearTurnState, readTurnState } from './turn-state.mjs';
import { getWorkflowRecommendation } from './workflow-state.mjs';

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

function normalizeNotifyLevel(value) {
  const level = Number(value);
  return [0, 1, 2, 3].includes(level) ? level : 0;
}

function notifyByLevel(event, extra, settings = getSettings()) {
  const level = normalizeNotifyLevel(settings.notify_level ?? 0);
  if (level === 2 || level === 3) playSound(event);
  if (level === 1 || level === 3) desktopNotify(event, extra);
}

function buildNotifyExtra(payload = {}, options = {}) {
  const source = resolveNotificationSource({
    host: HOST,
    cwd: payload.cwd || process.cwd(),
    payload,
  });
  return {
    message: options.message || '',
    sourceLabel: source.sourceLabel,
  };
}

function getSettings() {
  return readSettings(CONFIG_FILE);
}

function runRalphLoop(payload) {
  const settings = getSettings();
  if (settings.ralph_loop_enabled === false) return false;
  return runGateScript({
    payload,
    host: HOST,
    scriptPath: join(__dirname, 'ralph-loop.mjs'),
    args: IS_GEMINI ? ['--gemini'] : HOST === 'codex' ? ['--codex'] : [],
    source: 'ralph-loop',
    blockEvent: 'verify_gate_blocked',
    timeout: 120_000,
    appendReplayEvent,
    output,
  });
}

function runDeliveryGate(payload) {
  return runGateScript({
    payload,
    host: HOST,
    scriptPath: join(__dirname, 'delivery-gate.mjs'),
    source: 'delivery-gate',
    blockEvent: 'delivery_gate_blocked',
    timeout: 30_000,
    appendReplayEvent,
    output,
  });
}

function runTurnStopGate(payload) {
  return runGateScript({
    payload,
    host: HOST,
    scriptPath: join(__dirname, 'turn-stop-gate.mjs'),
    source: 'turn-stop-gate',
    blockEvent: 'turn_stop_blocked',
    timeout: 30_000,
    appendReplayEvent,
    output,
  });
}

function readMainTurnState(cwd) {
  const turnState = readTurnState(cwd);
  return turnState?.role === 'main' ? turnState : null;
}

function consumeMainTurnState(cwd, turnState) {
  if (turnState?.role === 'main') clearTurnState(cwd);
}

function shouldProcessCloseout(turnState) {
  if (turnState) return turnState.kind === 'complete';
  return false;
}

function cmdPreCompact() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings.install_mode);
  const context = buildCompactionContext({
    payload,
    pkgRoot: PKG_ROOT,
    settings,
    bootstrapFile,
    host: HOST,
  });
  appendReplayEvent(cwd, {
    host: HOST,
    event: 'pre_compact_snapshot',
    source: 'pre-compact',
    details: {
      bootstrapFile,
      installMode: settings.install_mode || '',
    },
  });
  suppressedOutput(EVENT_NAME.PreCompact, context);
}

function cmdRoute() {
  const payload = readStdinJson();
  clearTurnState(payload.cwd || process.cwd());
  handleRouteCommand({
    payload,
    host: HOST,
    pkgRoot: PKG_ROOT,
    settings: getSettings(),
    buildRouteInstruction,
    buildSemanticRouteInstruction,
    resolveCanonicalCommandSkill,
    writeRouteContext,
    clearRouteContext,
    appendReplayEvent,
    getWorkflowRecommendation,
    suppress: (context) => suppressedOutput(EVENT_NAME.UserPromptSubmit, context),
    emptySuppress,
  });
}

function cmdInject() {
  const payload = readStdinJson();
  const source = payload.source || 'startup';
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings.install_mode);

  let bootstrap = '';
  try {
    bootstrap = readFileSync(join(PKG_ROOT, bootstrapFile), 'utf-8');
  } catch {}

  startReplaySession(cwd, {
    host: HOST,
    source,
    bootstrapFile,
    installMode: settings.install_mode || '',
  });
  appendReplayEvent(cwd, {
    host: HOST,
    event: 'session_injected',
    source,
    details: {
      bootstrapFile,
      installMode: settings.install_mode || '',
      activatedProject: existsSync(join(cwd, '.helloagents')),
    },
  });
  const context = buildInjectContext({
    source,
    bootstrap,
    settings,
    pkgRoot: PKG_ROOT,
    host: HOST,
    cwd,
    payload,
  });
  clearRouteContext();
  clearTurnState(cwd);
  suppressedOutput(EVENT_NAME.SessionStart, context || undefined);
}

function cmdStop() {
  const payload = readStdinJson();
  const cwd = payload.cwd || process.cwd();
  const turnState = readMainTurnState(cwd);
  if (runTurnStopGate(payload)) {
    if (turnState && turnState.kind !== 'complete') consumeMainTurnState(cwd, turnState);
    return;
  }
  const shouldProcess = shouldProcessCloseout(turnState);
  if (shouldProcess && runRalphLoop(payload)) {
    consumeMainTurnState(cwd, turnState);
    notifyByLevel('warning', buildNotifyExtra(payload));
    return;
  }
  if (shouldProcess && runDeliveryGate(payload)) {
    consumeMainTurnState(cwd, turnState);
    notifyByLevel('warning', buildNotifyExtra(payload));
    return;
  }

  const settings = getSettings();
  if (shouldProcess) {
    notifyByLevel('complete', buildNotifyExtra(payload), settings);
  }
  consumeMainTurnState(cwd, turnState);
  clearRouteContext();
  emptySuppress();
}

function cmdSound() {
  playSound(process.argv[3] || 'complete');
}

function cmdDesktop() {
  desktopNotify(process.argv[3] || 'complete', buildNotifyExtra({ cwd: process.cwd() }));
}

function cmdCodexNotify() {
  let data = {};
  try { data = JSON.parse(process.argv[3] || '{}'); } catch {}

  const type = data.type || '';
  const client = data.client || '';
  if (shouldIgnoreCodexNotifyClient(client)) return;

  if (type === 'approval-requested') {
    notifyByLevel('confirm', buildNotifyExtra(data));
    return;
  }
  if (type !== 'agent-turn-complete') return;

  const cwd = data.cwd || process.cwd();
  const turnState = readMainTurnState(cwd);
  if (runTurnStopGate(data)) {
    if (turnState && turnState.kind !== 'complete') consumeMainTurnState(cwd, turnState);
    return;
  }
  if (!turnState) return;
  if (turnState.kind !== 'complete') {
    consumeMainTurnState(cwd, turnState);
    clearRouteContext();
    return;
  }

  const settings = getSettings();
  if (runRalphLoop(data)) {
    consumeMainTurnState(cwd, turnState);
    notifyByLevel('warning', buildNotifyExtra(data), settings);
    return;
  }
  if (runDeliveryGate(data)) {
    consumeMainTurnState(cwd, turnState);
    notifyByLevel('warning', buildNotifyExtra(data), settings);
    return;
  }

  notifyByLevel('complete', buildNotifyExtra(data), settings);
  consumeMainTurnState(cwd, turnState);
  clearRouteContext();
}

const cmd = process.argv[2] || '';

switch (cmd) {
  case 'inject':        cmdInject(); break;
  case 'stop':          cmdStop(); break;
  case 'pre-compact':   cmdPreCompact(); break;
  case 'route':         cmdRoute(); break;
  case 'sound':         cmdSound(); break;
  case 'desktop':       cmdDesktop(); break;
  case 'codex-notify':  cmdCodexNotify(); break;
  default:
    process.stderr.write(`notify.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}

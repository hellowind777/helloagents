#!/usr/bin/env node
// notify.mjs — Unified notification and rule injection for HelloAGENTS
// Zero external dependencies, ES module, cross-platform

import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { playSound as _playSound, desktopNotify as _desktopNotify } from './notify-ui.mjs';
import { beginCodexCloseoutClaim, finalizeCodexCloseoutClaim } from './notify-closeout.mjs';
import { resolveNotificationSource } from './notify-source.mjs';
import { buildCompactionContext, buildInjectContext, buildRouteInstruction, buildSemanticRouteInstruction, resolveCanonicalCommandSkill } from './notify-context.mjs';
import { resolveNotifyHost, shouldIgnoreCodexNotifyClient } from './notify-events.mjs';
import { runGateScript } from './notify-gates.mjs';
import { normalizeNotifyPayload } from './notify-payload.mjs';
import { cleanupProjectSessions } from './project-session-cleanup.mjs';
import { handleRouteCommand, resolveBootstrapFile } from './notify-route.mjs';
import { readSettings, readStdinJson, output, suppressedOutput, emptySuppress } from './notify-shared.mjs';
import { clearRouteContext, getApplicableRouteContext, writeRouteContext } from './runtime-context.mjs';
import { appendReplayEvent, startReplaySession } from './replay-state.mjs';
import { clearTurnState, readTurnState } from './turn-state.mjs';
import { getWorkflowRecommendation } from './workflow-state.mjs';
import { resolveSessionToken } from './session-token.mjs';
import { isProjectRuntimeActive } from './runtime-scope.mjs';
import { evaluateTurnStopGate } from './turn-stop-gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');
const cmd = process.argv[2] || '';
const HOST = resolveNotifyHost(process.argv);
const IS_GEMINI = HOST === 'gemini';
const IS_CODEX = HOST === 'codex';
const IS_SILENT = process.argv.includes('--silent');
const EVENT_NAME = {
  SessionStart: 'SessionStart',
  UserPromptSubmit: IS_GEMINI ? 'BeforeAgent' : 'UserPromptSubmit',
  PreCompact: IS_GEMINI ? 'BeforeAgent' : 'PreCompact',
};
const RALPH_LOOP_ROUTE_COMMANDS = new Set(['verify', 'loop']);

const playSound = (event) => _playSound(PKG_ROOT, event);
const desktopNotify = (event, extra) => _desktopNotify(PKG_ROOT, event, extra);

function normalizeNotifyLevel(value) {
  const level = Number(value);
  return [0, 1, 2, 3].includes(level) ? level : 0;
}

function notifyByLevel(event, extra, settings = getSettings()) {
  const level = normalizeNotifyLevel(settings.notify_level ?? 0);
  if (level === 1) desktopNotify(event, extra);
  if (level === 2) playSound(event);
  if (level === 3) {
    desktopNotify(event, extra);
    playSound(event);
  }
}

function readPayloadFromStdin() {
  return normalizeNotifyPayload(readStdinJson());
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

function shouldRunRalphLoop(cwd, turnState, payload = {}) {
  if (!turnState || turnState.kind !== 'complete') return false;
  if (turnState.requiresDeliveryGate) return true;
  const routeContext = getApplicableRouteContext({ cwd, payload });
  return RALPH_LOOP_ROUTE_COMMANDS.has(routeContext?.skillName);
}

function runRalphLoop(payload, { turnState } = {}) {
  const settings = getSettings();
  if (settings.ralph_loop_enabled === false) return false;
  const cwd = payload.cwd || process.cwd();
  if (!shouldRunRalphLoop(cwd, turnState, payload)) return false;
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
  try {
    const gateOutput = evaluateTurnStopGate(payload);
    if (gateOutput?.decision === 'block') {
      appendReplayEvent(payload.cwd || process.cwd(), {
        host: HOST,
        event: 'turn_stop_blocked',
        source: 'turn-stop-gate',
        reason: gateOutput.reason || '',
        payload,
      });
      output(gateOutput);
      return true;
    }
    return false;
  } catch (error) {
    appendReplayEvent(payload.cwd || process.cwd(), {
      host: HOST,
      event: 'runtime_gate_error',
      source: 'turn-stop-gate',
      reason: `[HelloAGENTS Runtime] turn-stop-gate 执行失败，已暂停完成通知。\n原因：${error?.message || error}`,
      payload,
    });
    output({
      decision: 'block',
      reason: `[HelloAGENTS Runtime] turn-stop-gate 执行失败，已暂停完成通知。\n原因：${error?.message || error}\n请修复脚本或重新运行验证后再报告完成。`,
      suppressOutput: true,
    });
    return true;
  }
}

function attachTurnSession(payload = {}, cwd = payload.cwd || process.cwd()) {
  const sessionId = resolveSessionToken({
    payload,
    env: process.env,
    ppid: process.ppid,
    allowPpidFallback: !isProjectRuntimeActive(cwd),
  });
  if (!sessionId || payload.sessionId) return payload;
  return { ...payload, sessionId };
}

function readMainTurnState(cwd, payload = {}) {
  const turnState = readTurnState(cwd, { payload });
  return turnState?.role === 'main' ? turnState : null;
}

function consumeMainTurnState(cwd, turnState, payload = {}) {
  if (turnState?.role === 'main') clearTurnState(cwd, { payload });
}

function shouldProcessCloseout(turnState) {
  if (turnState) return turnState.kind === 'complete';
  return false;
}

function processTurnCloseout(payload, turnPayload, turnState, settings = getSettings()) {
  const cwd = turnPayload.cwd || process.cwd();

  if (runTurnStopGate(turnPayload)) {
    if (turnState && turnState.kind !== 'complete') consumeMainTurnState(cwd, turnState, turnPayload);
    return { blocked: true };
  }

  if (!turnState) {
    notifyByLevel('complete', buildNotifyExtra(turnPayload), settings);
    clearRouteContext({ cwd, payload: turnPayload });
    return { blocked: false };
  }

  if (turnState.kind !== 'complete') {
    consumeMainTurnState(cwd, turnState, turnPayload);
    clearRouteContext({ cwd, payload: turnPayload });
    return { blocked: false };
  }

  if (runRalphLoop(turnPayload, { turnState })) {
    consumeMainTurnState(cwd, turnState, turnPayload);
    notifyByLevel('warning', buildNotifyExtra(payload), settings);
    return { blocked: true };
  }
  if (runDeliveryGate(turnPayload)) {
    consumeMainTurnState(cwd, turnState, turnPayload);
    notifyByLevel('warning', buildNotifyExtra(payload), settings);
    return { blocked: true };
  }

  notifyByLevel('complete', buildNotifyExtra(payload), settings);
  consumeMainTurnState(cwd, turnState, turnPayload);
  clearRouteContext({ cwd, payload: turnPayload });
  return { blocked: false };
}

function cmdPreCompact() {
  const payload = readPayloadFromStdin();
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings, HOST);
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
    payload,
    details: {
      bootstrapFile,
      installMode: settings.install_mode || '',
    },
  });
  suppressedOutput(EVENT_NAME.PreCompact, context);
}

function cmdRoute() {
  const payload = readPayloadFromStdin();
  clearTurnState(payload.cwd || process.cwd(), { payload });
  handleRouteCommand({
    payload,
    host: HOST,
    pkgRoot: PKG_ROOT,
    settings: getSettings(),
    buildRouteInstruction: IS_SILENT ? () => null : buildRouteInstruction,
    buildSemanticRouteInstruction: IS_SILENT ? () => null : buildSemanticRouteInstruction,
    resolveCanonicalCommandSkill,
    writeRouteContext,
    clearRouteContext,
    appendReplayEvent,
    getWorkflowRecommendation,
    suppress: (context) => IS_SILENT
      ? emptySuppress()
      : suppressedOutput(EVENT_NAME.UserPromptSubmit, context),
    emptySuppress,
  });
}

function cmdInject() {
  const payload = readPayloadFromStdin();
  const source = payload.source || 'startup';
  const cwd = payload.cwd || process.cwd();
  const settings = getSettings();
  const bootstrapFile = resolveBootstrapFile(cwd, settings, HOST);

  startReplaySession(cwd, {
    host: HOST,
    source,
    bootstrapFile,
    installMode: settings.install_mode || '',
    payload,
  });
  appendReplayEvent(cwd, {
    host: HOST,
    event: 'session_injected',
    source,
    payload,
    details: {
      bootstrapFile,
      installMode: settings.install_mode || '',
      activatedProject: isProjectRuntimeActive(cwd),
    },
  });
  clearRouteContext({ cwd, payload });
  clearTurnState(cwd, { payload });
  cleanupProjectSessions(cwd);
  if (IS_SILENT) {
    emptySuppress();
    return;
  }

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
    payload,
  });
  suppressedOutput(EVENT_NAME.SessionStart, context || undefined);
}

function cmdStop() {
  const payload = readPayloadFromStdin();
  const cwd = payload.cwd || process.cwd();
  const turnPayload = attachTurnSession(payload, cwd);
  const turnState = readMainTurnState(cwd, turnPayload);
  const closeoutClaim = IS_CODEX
    ? beginCodexCloseoutClaim(cwd, { payload: turnPayload, turnState, source: 'stop' })
    : null;
  if (IS_CODEX && !closeoutClaim?.claimed) {
    emptySuppress();
    return;
  }

  let handled = false;
  let result = { blocked: false };
  try {
    result = processTurnCloseout(payload, turnPayload, turnState, getSettings());
    handled = true;
  } finally {
    finalizeCodexCloseoutClaim(closeoutClaim, {
      handled,
      source: 'stop',
      event: 'stop',
      turnKind: turnState?.kind || '',
    });
  }
  if (result.blocked) return;
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
  data = normalizeNotifyPayload(data);
  const cwd = data.cwd || process.cwd();
  const turnPayload = attachTurnSession(data, cwd);

  const type = data.type || '';
  const client = data.client || '';
  if (shouldIgnoreCodexNotifyClient(client)) return;

  if (type === 'approval-requested') {
    notifyByLevel('confirm', buildNotifyExtra(data));
    return;
  }
  if (type !== 'agent-turn-complete') return;

  const turnState = readMainTurnState(cwd, turnPayload);
  const closeoutClaim = beginCodexCloseoutClaim(cwd, {
    payload: turnPayload,
    turnState,
    source: 'codex-notify',
  });
  if (!closeoutClaim.claimed) return;

  let handled = false;
  try {
    processTurnCloseout(data, turnPayload, turnState, getSettings());
    handled = true;
  } finally {
    finalizeCodexCloseoutClaim(closeoutClaim, {
      handled,
      source: 'codex-notify',
      event: type,
      turnKind: turnState?.kind || '',
    });
  }
}

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

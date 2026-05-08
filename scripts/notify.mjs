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
const CODEX_HOOKS_FILE = join(homedir(), '.codex', 'hooks.json');
const GATE_MODULE_LOADERS = {
  'turn-stop-gate': () => import('./turn-stop-gate.mjs'),
  'delivery-gate': () => import('./delivery-gate.mjs'),
  'ralph-loop': () => import('./ralph-loop.mjs'),
};
const gateEvaluatorCache = new Map();

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

function buildGateErrorReason(source, detail = '') {
  return [
    `[HelloAGENTS Runtime] ${source} 执行失败，已暂停完成通知。`,
    detail ? `原因：${detail}` : '',
    '请修复脚本或重新运行验证后再报告完成。',
  ].filter(Boolean).join('\n');
}

function emitInlineGateError(payload, source, detail = '') {
  const reason = buildGateErrorReason(source, detail);
  appendReplayEvent(payload.cwd || process.cwd(), {
    host: HOST,
    event: 'runtime_gate_error',
    source,
    reason,
    payload,
  });
  output({
    decision: 'block',
    reason,
    suppressOutput: true,
  });
  return true;
}

function stringifyStreamChunk(chunk, encoding) {
  if (typeof chunk === 'string') return chunk;
  if (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) {
    return Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : 'utf-8');
  }
  return String(chunk ?? '');
}

async function importGateModule(source) {
  const loader = GATE_MODULE_LOADERS[source];
  if (!loader) {
    throw new Error(`无法解析的 JSON：未知 gate 模块 ${source}。`);
  }

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let capturedStdout = '';
  let capturedStderr = '';

  process.stdout.write = (chunk, encoding, callback) => {
    capturedStdout += stringifyStreamChunk(chunk, encoding);
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  };
  process.stderr.write = (chunk, encoding, callback) => {
    capturedStderr += stringifyStreamChunk(chunk, encoding);
    if (typeof encoding === 'function') encoding();
    if (typeof callback === 'function') callback();
    return true;
  };

  try {
    const module = await loader();
    if (capturedStdout.trim() || capturedStderr.trim()) {
      throw new Error(`无法解析的 JSON：模块导入时输出了意外内容。${capturedStdout || capturedStderr}`);
    }
    return module;
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

async function loadGateEvaluator(source, exportName) {
  let evaluatorPromise = gateEvaluatorCache.get(source);
  if (!evaluatorPromise) {
    evaluatorPromise = importGateModule(source).then((module) => {
      const evaluate = module?.[exportName];
      if (typeof evaluate !== 'function') {
        throw new Error(`无法解析的 JSON：模块未导出 ${exportName}。`);
      }
      return evaluate;
    });
    gateEvaluatorCache.set(source, evaluatorPromise);
  }

  try {
    return await evaluatorPromise;
  } catch (error) {
    gateEvaluatorCache.delete(source);
    throw error;
  }
}

async function runInlineGate({ payload, source, blockEvent, exportName, evaluateArgs }) {
  let evaluate;
  try {
    evaluate = await loadGateEvaluator(source, exportName);
  } catch (error) {
    return emitInlineGateError(payload, source, error?.message || String(error));
  }

  let gateOutput;
  try {
    gateOutput = await evaluate(...evaluateArgs);
  } catch (error) {
    return emitInlineGateError(payload, source, error?.message || String(error));
  }

  if (!gateOutput || typeof gateOutput !== 'object' || Array.isArray(gateOutput)) {
    return emitInlineGateError(payload, source, '无法解析的 JSON：gate 返回值不是对象。');
  }

  if (gateOutput?.decision === 'block') {
    appendReplayEvent(payload.cwd || process.cwd(), {
      host: HOST,
      event: blockEvent,
      source,
      reason: gateOutput.reason || '',
      payload,
    });
    output(gateOutput);
    return true;
  }

  return false;
}

async function runRalphLoop(payload, { turnState } = {}) {
  const settings = getSettings();
  if (settings.ralph_loop_enabled === false) return false;
  const cwd = payload.cwd || process.cwd();
  if (!shouldRunRalphLoop(cwd, turnState, payload)) return false;
  return await runInlineGate({
    payload,
    source: 'ralph-loop',
    blockEvent: 'verify_gate_blocked',
    exportName: 'evaluateRalphLoop',
    evaluateArgs: [payload, {
      isSubagent: false,
      isGemini: IS_GEMINI,
      hookEventName: HOST === 'codex' ? 'Stop' : (IS_GEMINI ? 'SessionEnd' : 'Stop'),
    }],
  });
}

async function runDeliveryGate(payload) {
  return await runInlineGate({
    payload,
    source: 'delivery-gate',
    blockEvent: 'delivery_gate_blocked',
    exportName: 'evaluateDeliveryGate',
    evaluateArgs: [payload],
  });
}

async function runTurnStopGate(payload) {
  return await runInlineGate({
    payload,
    source: 'turn-stop-gate',
    blockEvent: 'turn_stop_blocked',
    exportName: 'evaluateTurnStopGate',
    evaluateArgs: [payload],
  });
}

function hasManagedCodexStopHook() {
  if (!IS_CODEX) return false;
  try {
    const hooksData = JSON.parse(readFileSync(CODEX_HOOKS_FILE, 'utf-8'));
    const groups = Array.isArray(hooksData?.hooks?.Stop) ? hooksData.hooks.Stop : [];
    return groups.some((group) => Array.isArray(group?.hooks) && group.hooks.some((handler) =>
      handler?.type === 'command'
      && typeof handler.command === 'string'
      && handler.command.includes('helloagents-js')
      && handler.command.includes('notify stop --codex'),
    ));
  } catch {
    return false;
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

async function processTurnCloseout(payload, turnPayload, turnState, settings = getSettings()) {
  const cwd = turnPayload.cwd || process.cwd();

  if (await runTurnStopGate(turnPayload)) {
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

  if (await runRalphLoop(turnPayload, { turnState })) {
    consumeMainTurnState(cwd, turnState, turnPayload);
    notifyByLevel('warning', buildNotifyExtra(payload), settings);
    return { blocked: true };
  }
  if (await runDeliveryGate(turnPayload)) {
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

async function cmdStop() {
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
    result = await processTurnCloseout(payload, turnPayload, turnState, getSettings());
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

async function cmdCodexNotify() {
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
  if (hasManagedCodexStopHook()) return;

  const turnState = readMainTurnState(cwd, turnPayload);
  const closeoutClaim = beginCodexCloseoutClaim(cwd, {
    payload: turnPayload,
    turnState,
    source: 'codex-notify',
  });
  if (!closeoutClaim.claimed) return;

  let handled = false;
  try {
    await processTurnCloseout(data, turnPayload, turnState, getSettings());
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

async function main() {
  switch (cmd) {
    case 'inject':        cmdInject(); break;
    case 'stop':          await cmdStop(); break;
    case 'pre-compact':   cmdPreCompact(); break;
    case 'route':         cmdRoute(); break;
    case 'sound':         cmdSound(); break;
    case 'desktop':       cmdDesktop(); break;
    case 'codex-notify':  await cmdCodexNotify(); break;
    default:
      process.stderr.write(`notify.mjs: unknown command "${cmd}"\n`);
      process.exit(1);
  }
}

await main();

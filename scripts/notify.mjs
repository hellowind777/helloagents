#!/usr/bin/env node
// notify.mjs — Unified notification & bootstrap injection for HelloAGENTS
// Zero external dependencies, ES module, cross-platform

import { join, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { playSound as _playSound, desktopNotify as _desktopNotify } from './notify-ui.mjs';
import { resolveNotificationSource } from './notify-source.mjs';
import { buildCompactionContext, buildInjectContext, buildRouteInstruction, buildSemanticRouteInstruction, resolveCanonicalCommandSkill } from './notify-context.mjs';
import { claimsTaskComplete, shouldIgnoreCodexNotifyClient, shouldIgnoreFormattedSubagent } from './notify-events.mjs';
import { handleRouteCommand, resolveBootstrapFile } from './notify-route.mjs';
import { readSettings, readStdinJson, output, suppressedOutput, emptySuppress } from './notify-shared.mjs';
import { clearRouteContext, writeRouteContext } from './runtime-context.mjs';
import { appendReplayEvent, startReplaySession } from './replay-state.mjs';
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
  try {
    const rlPath = join(__dirname, 'ralph-loop.mjs');
    if (!existsSync(rlPath)) return false;
    const hostFlag = IS_GEMINI ? ['--gemini'] : HOST === 'codex' ? ['--codex'] : [];
    const result = spawnSync(process.execPath, [rlPath, ...hostFlag], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      timeout: 120_000,
    });
    if (result.stdout) {
      const rlOut = JSON.parse(result.stdout);
      if (rlOut.decision === 'block') {
        appendReplayEvent(payload.cwd || process.cwd(), {
          host: HOST,
          event: 'verify_gate_blocked',
          source: 'ralph-loop',
          reason: rlOut.reason || '',
        });
        output(rlOut);
        return true;
      }
    }
  } catch {}
  return false;
}

function runDeliveryGate(payload) {
  try {
    const gatePath = join(__dirname, 'delivery-gate.mjs');
    if (!existsSync(gatePath)) return false;
    const result = spawnSync(process.execPath, [gatePath], {
      input: JSON.stringify(payload),
      encoding: 'utf-8',
      timeout: 30_000,
    });
    if (result.stdout) {
      const gateOut = JSON.parse(result.stdout);
      if (gateOut.decision === 'block') {
        appendReplayEvent(payload.cwd || process.cwd(), {
          host: HOST,
          event: 'delivery_gate_blocked',
          source: 'delivery-gate',
          reason: gateOut.reason || '',
        });
        output(gateOut);
        return true;
      }
    }
  } catch {}
  return false;
}

function readCompletionText(payload = {}) {
  return payload['last-assistant-message']
    || payload.last_assistant_message
    || payload.lastAssistantMessage
    || '';
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
  });
  clearRouteContext();
  suppressedOutput(EVENT_NAME.SessionStart, context || undefined);
}

function cmdStop() {
  const payload = readStdinJson();
  const lastMsg = readCompletionText(payload);
  const cwd = payload.cwd || process.cwd();
  clearRouteContext();
  if (runRalphLoop(payload)) {
    playSound('warning');
    desktopNotify('warning', buildNotifyExtra(payload));
    return;
  }
  if (claimsTaskComplete(lastMsg) && runDeliveryGate(payload)) {
    playSound('warning');
    desktopNotify('warning', buildNotifyExtra(payload));
    return;
  }

  const settings = getSettings();
  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete', buildNotifyExtra(payload));
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
    playSound('confirm');
    desktopNotify('confirm', buildNotifyExtra(data));
    return;
  }
  if (type !== 'agent-turn-complete') return;

  const lastMsg = data['last-assistant-message'] || '';
  const settings = getSettings();
  if (shouldIgnoreFormattedSubagent(lastMsg, settings.output_format !== false)) return;

  const cwd = data.cwd || process.cwd();
  if (claimsTaskComplete(lastMsg) && runRalphLoop({ cwd })) {
    playSound('warning');
    desktopNotify('warning', buildNotifyExtra(data));
    return;
  }
  if (claimsTaskComplete(lastMsg) && runDeliveryGate({ cwd })) {
    playSound('warning');
    desktopNotify('warning', buildNotifyExtra(data));
    return;
  }

  const level = settings.notify_level ?? 0;
  if (level === 2 || level === 3) playSound('complete');
  if (level === 1 || level === 3) desktopNotify('complete', buildNotifyExtra(data));
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

/**
 * Shared utilities for HelloAGENTS CLI installation scripts.
 * File operations, marker injection, settings merge/clean, hooks loading.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync,
         symlinkSync, lstatSync, unlinkSync, rmdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform } from 'node:os';

const IS_WIN = platform() === 'win32';

export function ensureDir(p) { mkdirSync(p, { recursive: true }); }
export function safeWrite(p, c) { ensureDir(dirname(p)); writeFileSync(p, c, 'utf-8'); }
export function safeRead(p) { try { return readFileSync(p, 'utf-8'); } catch { return null; } }
export function safeJson(p) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; } }
export function removeIfExists(p) { try { rmSync(p, { recursive: true, force: true }); } catch {} }
export function readJsonOrThrow(p, label = p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    throw new Error(`${label} JSON 解析失败: ${p}`);
  }
}
export function copyEntries(sourceRoot, targetRoot, entries) {
  for (const entry of entries) {
    const sourcePath = join(sourceRoot, entry);
    if (!existsSync(sourcePath)) continue;
    const targetPath = join(targetRoot, entry);
    ensureDir(dirname(targetPath));
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
  }
}

export function createLink(target, linkPath) {
  removeLink(linkPath);
  try {
    symlinkSync(target, linkPath, IS_WIN ? 'junction' : 'dir');
    return true;
  } catch { return false; }
}

export function removeLink(p) {
  try {
    const stat = lstatSync(p);
    if (IS_WIN && stat.isDirectory()) rmdirSync(p);
    else unlinkSync(p);
    return true;
  } catch { return false; }
}

// ── Marker injection ─────────────────────────────────────────────────

const MARKER = '<!-- HELLOAGENTS_START -->';
const MARKER_END = '<!-- HELLOAGENTS_END -->';
const MARKER_RE = new RegExp(`\\n*${MARKER}[\\s\\S]*?${MARKER_END}\\n*`, 'g');

/** Inject content wrapped in markers, preserving existing content outside markers. */
export function injectMarkedContent(filePath, content) {
  const existing = safeRead(filePath) || '';
  const wrapped = `\n${MARKER}\n${content}\n${MARKER_END}\n`;
  if (existing.includes(MARKER)) {
    safeWrite(filePath, existing.replace(MARKER_RE, wrapped));
  } else if (existing.trim()) {
    safeWrite(filePath, existing.trimEnd() + '\n' + wrapped);
  } else {
    safeWrite(filePath, wrapped.trim() + '\n');
  }
}

/** Remove marked content from a file. Deletes file if nothing remains. */
export function removeMarkedContent(filePath) {
  const existing = safeRead(filePath);
  if (!existing || !existing.includes(MARKER)) return;
  const cleaned = existing.replace(MARKER_RE, '\n').trim();
  if (cleaned) safeWrite(filePath, cleaned + '\n');
  else removeIfExists(filePath);
}

// ── Settings merge/clean ─────────────────────────────────────────────

/** Deep-merge helloagents hooks into a CLI's settings.json. Optionally merges permissions. */
export function mergeSettingsHooks(settingsPath, hooksData, extraPermissions) {
  const settings = safeJson(settingsPath) || {};

  if (extraPermissions?.length) {
    if (!settings.permissions) settings.permissions = {};
    if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
    for (const perm of extraPermissions) {
      if (!settings.permissions.allow.includes(perm)) settings.permissions.allow.push(perm);
    }
  }

  if (hooksData?.hooks) {
    if (!settings.hooks) settings.hooks = {};
    for (const [event, entries] of Object.entries(hooksData.hooks)) {
      if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
      settings.hooks[event] = settings.hooks[event].filter(e => !JSON.stringify(e).includes('helloagents'));
      settings.hooks[event].push(...entries);
    }
  }

  safeWrite(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/** Remove helloagents hooks (and optionally permissions) from a CLI's settings.json. */
export function cleanSettingsHooks(settingsPath, cleanPermissions = false) {
  const settings = safeJson(settingsPath);
  if (!settings) return;

  if (cleanPermissions && settings.permissions?.allow) {
    settings.permissions.allow = settings.permissions.allow.filter(p => !p.includes('helloagents'));
    if (!settings.permissions.allow.length) delete settings.permissions.allow;
    if (!Object.keys(settings.permissions).length) delete settings.permissions;
  }

  if (settings.hooks) {
    for (const [event, entries] of Object.entries(settings.hooks)) {
      if (!Array.isArray(entries)) continue;
      settings.hooks[event] = entries.filter(e => !JSON.stringify(e).includes('helloagents'));
      if (!settings.hooks[event].length) delete settings.hooks[event];
    }
    if (!Object.keys(settings.hooks).length) delete settings.hooks;
  }

  if (Object.keys(settings).length) {
    safeWrite(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  } else {
    removeIfExists(settingsPath);
  }
}

function rewriteHookCommandToCli(command = '', pathVar = '') {
  const replacements = new Map([
    [`node "${pathVar}/scripts/notify.mjs"`, 'helloagents-js notify'],
    [`node "${pathVar}/scripts/guard.mjs"`, 'helloagents-js guard'],
    [`node "${pathVar}/scripts/ralph-loop.mjs"`, 'helloagents-js ralph-loop'],
  ]);

  let next = command;
  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to);
  }
  return next;
}

function rewriteHookCommands(value, pathVar) {
  if (Array.isArray(value)) return value.map((item) => rewriteHookCommands(item, pathVar));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      key === 'command' && typeof entry === 'string'
        ? rewriteHookCommandToCli(entry, pathVar)
        : rewriteHookCommands(entry, pathVar),
    ]));
  }
  return value;
}

/** Read hooks source file and rewrite standby hooks to the stable CLI entrypoint. */
export function loadHooksWithCliEntry(pkgRoot, hooksFile, pathVar) {
  const src = safeRead(join(pkgRoot, 'hooks', hooksFile));
  if (!src) return null;
  return rewriteHookCommands(JSON.parse(src), pathVar);
}

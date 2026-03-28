#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero dependencies.
 */
'use strict';

import { homedir, platform } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync,
         symlinkSync, lstatSync, unlinkSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── Constants ────────────────────────────────────────────────────────────

const IS_WIN = platform() === 'win32';
const HOME = homedir();
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const HELLOAGENTS_HOME = join(HOME, '.helloagents');
const CONFIG_FILE = join(HELLOAGENTS_HOME, 'helloagents.json');

const DEFAULTS = {
  output_language: "",
  output_format: true,
  notify_level: 0,
  ralph_loop_enabled: true,
  guard_enabled: true,
  kb_create_mode: 1,
  commit_attribution: "",
};

let pkg = { version: '0.0.0' };
try { pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8')); } catch {}

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureDir(p) { mkdirSync(p, { recursive: true }); }
function safeWrite(p, c) { ensureDir(dirname(p)); writeFileSync(p, c, 'utf-8'); }
function safeRead(p) { try { return readFileSync(p, 'utf-8'); } catch { return null; } }
function safeJson(p) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; } }
function removeIfExists(p) { try { rmSync(p, { recursive: true, force: true }); } catch {} }

function createLink(target, linkPath) {
  removeLink(linkPath); // Clean up existing link/junction first
  try {
    if (IS_WIN) {
      execSync(`mklink /J "${linkPath}" "${target}"`, { stdio: 'ignore', shell: 'cmd.exe' });
    } else {
      symlinkSync(target, linkPath, 'dir');
    }
    return true;
  } catch { return false; }
}

function removeLink(p) {
  try {
    if (IS_WIN) {
      execSync(`rmdir "${p}"`, { stdio: 'ignore', shell: 'cmd.exe' });
    } else {
      unlinkSync(p);
    }
    return true;
  } catch { return false; }
}

const isCN = (() => {
  const lang = (process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '').toLowerCase();
  return lang.includes('zh') || lang.includes('cn');
})();
const msg = (cn, en) => isCN ? cn : en;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => console.error(`  ✗ ${m}`);

// ── Codex Install ────────────────────────────────────────────────────────

function installCodex() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false; // Codex not installed
  ensureDir(codexDir);

  // 1. Clean up legacy AGENTS.md injection (replaced by model_instructions_file)
  const agentsPath = join(codexDir, 'AGENTS.md');
  const existing = safeRead(agentsPath) || '';
  const marker = '<!-- HELLOAGENTS_START -->';
  const markerEnd = '<!-- HELLOAGENTS_END -->';
  if (existing.includes(marker)) {
    const cleaned = existing.replace(new RegExp(`\\n*${marker}[\\s\\S]*?${markerEnd}\\n*`, 'g'), '\n').trim();
    if (cleaned) safeWrite(agentsPath, cleaned);
    else removeIfExists(agentsPath);
  }

  // 2. config.toml
  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');

  // Add top-level keys by prepending (safe, no regex on TOML structure)
  function ensureTopLevel(key, value) {
    // Already has this key → update value
    const re = new RegExp(`^${key}\\s*=.*$`, 'm');
    if (re.test(toml)) {
      toml = toml.replace(re, `${key} = ${value}`);
    } else {
      // Prepend before first line, with blank line separator
      toml = `${key} = ${value}\n` + toml;
    }
  }

  ensureTopLevel('model_instructions_file', `"${join(PKG_ROOT, 'bootstrap.md').replace(/\\/g, '/')}"`);
  ensureTopLevel('notify', `["node", "${join(PKG_ROOT, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`);

  // Add blank line after our injected keys (before user config)
  toml = toml.replace(/^((?:notify|model_instructions_file)\s*=.*\n)((?:notify|model_instructions_file)\s*=.*\n)(?!\n)/, '$1$2\n');

  if (!toml.includes('[features]')) toml += '\n[features]\ncodex_hooks = true\n';
  else if (!toml.includes('codex_hooks')) toml = toml.replace('[features]', '[features]\ncodex_hooks = true');

  safeWrite(configPath, toml);

  // 3. Skills symlinks
  for (const base of [join(codexDir, 'skills'), join(HOME, '.agents', 'skills')]) {
    ensureDir(base);
    if (!createLink(join(PKG_ROOT, 'skills'), join(base, 'helloagents'))) {
      throw new Error(`Failed to create skills symlink: ${join(base, 'helloagents')}`);
    }
  }

  return true;
}

function uninstallCodex() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;

  // AGENTS.md
  const agentsPath = join(codexDir, 'AGENTS.md');
  const existing = safeRead(agentsPath) || '';
  const marker = '<!-- HELLOAGENTS_START -->';
  const markerEnd = '<!-- HELLOAGENTS_END -->';
  if (existing.includes(marker)) {
    const cleaned = existing.replace(new RegExp(`\\n*${marker}[\\s\\S]*?${markerEnd}\\n*`, 'g'), '\n').trim();
    if (cleaned) safeWrite(agentsPath, cleaned);
    else removeIfExists(agentsPath);
  }

  // config.toml
  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml.includes('helloagents') || toml.includes('HelloAGENTS') || toml.includes('codex_hooks')) {
    for (const pat of [/^model_instructions_file\s*=.*helloagents.*\n?/gm, /^notify\s*=.*codex-notify.*\n?/gm, /^codex_hooks\s*=.*\n?/gm]) {
      toml = toml.replace(pat, '');
    }
    toml = toml.replace(/\n{3,}/g, '\n\n');
    safeWrite(configPath, toml.trim() + '\n');
  }
  removeIfExists(configPath + '.bak');

  // Legacy hooks.json
  const hooksPath = join(codexDir, 'hooks.json');
  const hooks = safeJson(hooksPath);
  if (hooks?.hooks) {
    let changed = false;
    for (const [ev, handlers] of Object.entries(hooks.hooks)) {
      const filtered = handlers.filter(h => !h.hooks?.some(hk => (hk.command || '').toLowerCase().includes('helloagents')));
      if (filtered.length !== handlers.length) changed = true;
      if (filtered.length === 0) delete hooks.hooks[ev]; else hooks.hooks[ev] = filtered;
    }
    if (changed) {
      if (Object.keys(hooks.hooks).length === 0) removeIfExists(hooksPath);
      else safeWrite(hooksPath, JSON.stringify(hooks, null, 2));
    }
  }

  // Symlinks
  for (const p of [join(codexDir, 'skills', 'helloagents'), join(HOME, '.agents', 'skills', 'helloagents')]) {
    removeLink(p);
  }

  return true;
}

// ── Config ───────────────────────────────────────────────────────────────

function ensureConfig() {
  ensureDir(HELLOAGENTS_HOME);
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  } else {
    // Reconcile: add missing keys, remove obsolete keys, preserve user values
    const existing = safeJson(CONFIG_FILE) || {};
    const reconciled = {};
    for (const [key, val] of Object.entries(DEFAULTS)) {
      reconciled[key] = key in existing ? existing[key] : val;
    }
    // Only write if changed (key set or values differ)
    if (JSON.stringify(reconciled) !== JSON.stringify(existing)) {
      writeFileSync(CONFIG_FILE, JSON.stringify(reconciled, null, 2), 'utf-8');
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || '';

if (cmd === 'postinstall') {
  // npm postinstall: auto-configure detected CLIs
  console.log(`\n  HelloAGENTS v${pkg.version}\n`);
  ensureConfig();
  ok('~/.helloagents/helloagents.json');

  if (installCodex()) ok('Codex CLI configured');
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));

  console.log(msg(
    '\n  Claude Code 请使用: claude plugin add helloagents',
    '\n  Claude Code: claude plugin add helloagents'
  ));
  console.log();

} else if (cmd === 'preuninstall') {
  // npm preuninstall: clean up Codex config, preserve user settings
  console.log(`\n  HelloAGENTS — ${msg('正在清理', 'Cleaning up')}\n`);

  if (uninstallCodex()) ok(msg('Codex CLI 已清理', 'Codex CLI cleaned'));
  // Preserve ~/.helloagents/helloagents.json (user config survives update/uninstall)
  // User can manually delete ~/.helloagents/ if desired
  console.log(msg(
    '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）',
    '  ℹ ~/.helloagents/ preserved (delete manually if desired)'
  ));
  console.log();

} else if (cmd === 'sync-version') {
  // Sync version from package.json to plugin.json and marketplace.json
  const pluginPath = join(PKG_ROOT, '.claude-plugin', 'plugin.json');
  const marketPath = join(PKG_ROOT, '.claude-plugin', 'marketplace.json');
  const ver = pkg.version;

  const plugin = safeJson(pluginPath);
  if (plugin) { plugin.version = ver; safeWrite(pluginPath, JSON.stringify(plugin, null, 2) + '\n'); }

  const market = safeJson(marketPath);
  if (market?.plugins?.[0]) { market.plugins[0].version = ver; safeWrite(marketPath, JSON.stringify(market, null, 2) + '\n'); }

  ok(`Version synced to ${ver}`);

} else {
  // Manual invocation: show help
  console.log(`
HelloAGENTS v${pkg.version} — The orchestration kernel for AI CLIs

Claude Code:
  claude plugin add helloagents          ${msg('安装为 marketplace 插件', 'Install as marketplace plugin')}
  claude plugin remove helloagents       ${msg('卸载', 'Uninstall')}

Codex:
  npm install -g helloagents             ${msg('安装（自动配置 Codex）', 'Install (auto-configures Codex)')}
  npm update -g helloagents              ${msg('更新到最新版', 'Update to latest version')}
  npm uninstall -g helloagents           ${msg('卸载（自动清理）', 'Uninstall (auto-cleans)')}
`.trim());
}

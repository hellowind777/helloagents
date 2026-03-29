#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero dependencies.
 */
'use strict';

import { homedir, platform } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync,
         symlinkSync, lstatSync, unlinkSync, rmdirSync, copyFileSync } from 'node:fs';
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
  install_mode: "standby",  // "standby" | "global"
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
    symlinkSync(target, linkPath, IS_WIN ? 'junction' : 'dir');
    return true;
  } catch { return false; }
}

function removeLink(p) {
  try {
    const stat = lstatSync(p);
    if (IS_WIN && stat.isDirectory()) {
      // Junction on Windows: rmdirSync does not follow junction
      rmdirSync(p);
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

  // Choose bootstrap file based on install_mode
  const settings = safeJson(CONFIG_FILE) || {};
  const bootstrapFile = settings.install_mode === 'global' ? 'bootstrap.md' : 'bootstrap-lite.md';
  ensureTopLevel('model_instructions_file', `"${join(PKG_ROOT, bootstrapFile).replace(/\\/g, '/')}"`);
  ensureTopLevel('notify', `["node", "${join(PKG_ROOT, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`);

  // Add blank line after our injected keys (before user config)
  toml = toml.replace(/^((?:notify|model_instructions_file)\s*=.*\n)((?:notify|model_instructions_file)\s*=.*\n)(?!\n)/, '$1$2\n');

  if (!toml.includes('[features]')) toml += '\n[features]\ncodex_hooks = true\n';
  else if (!toml.includes('codex_hooks')) toml = toml.replace('[features]', '[features]\ncodex_hooks = true');

  safeWrite(configPath, toml);

  // 3. Write hooks.json → ~/.codex/hooks.json (Codex doesn't support hooks in plugin.json)
  // Codex has no path variable like ${CLAUDE_PLUGIN_ROOT}, so we write with absolute paths
  const codexHooksPath = join(codexDir, 'hooks.json');
  const srcHooksPath = join(PKG_ROOT, 'hooks', 'hooks.json');
  try {
    let hooksContent = readFileSync(srcHooksPath, 'utf-8');
    // Replace Claude Code path variable with absolute path (forward slashes for JSON)
    const absRoot = PKG_ROOT.replace(/\\/g, '/');
    hooksContent = hooksContent.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, absRoot);
    writeFileSync(codexHooksPath, hooksContent, 'utf-8');
  } catch {}

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

  // hooks.json (written file, not symlink)
  removeIfExists(join(codexDir, 'hooks.json'));

  // Legacy symlinks cleanup
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
    `\n  ✅ HelloAGENTS 已安装！\n\n` +
    `    Claude Code:  /plugin marketplace add hellowind777/helloagents\n` +
    `                  /plugin install helloagents@helloagents\n` +
    `    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents\n` +
    `    Codex:        ${existsSync(join(HOME, '.codex')) ? '已自动配置' : '安装 Codex CLI 后重新运行 npm install -g helloagents'}\n\n` +
    `  默认为标准模式（项目级按需激活）。切换模式：\n` +
    `    helloagents --global    全局模式（所有项目自动启用完整规则）\n` +
    `    helloagents --standby   标准模式（默认）`,
    `\n  ✅ HelloAGENTS installed!\n\n` +
    `    Claude Code:  /plugin marketplace add hellowind777/helloagents\n` +
    `                  /plugin install helloagents@helloagents\n` +
    `    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents\n` +
    `    Codex:        ${existsSync(join(HOME, '.codex')) ? 'Auto-configured' : 'Install Codex CLI then re-run npm install -g helloagents'}\n\n` +
    `  Default: standby mode (per-project activation). Switch modes:\n` +
    `    helloagents --global    Global mode (full rules for all projects)\n` +
    `    helloagents --standby   Standby mode (default)`
  ));
  console.log();

} else if (cmd === 'preuninstall') {
  // npm preuninstall: clean up Codex config, preserve user settings
  console.log(`\n  HelloAGENTS — ${msg('正在清理', 'Cleaning up')}\n`);

  if (uninstallCodex()) ok(msg('Codex CLI 已清理', 'Codex CLI cleaned'));
  // Preserve ~/.helloagents/helloagents.json (user config survives update/uninstall)
  console.log(msg(
    '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）\n' +
    '  ℹ 如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents\n' +
    '  ℹ 如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
    '  ℹ ~/.helloagents/ preserved (delete manually if desired)\n' +
    '  ℹ If Claude Code plugin installed, run: /plugin remove helloagents\n' +
    '  ℹ If Gemini CLI extension installed, run: gemini extensions uninstall helloagents'
  ));
  console.log();

} else if (cmd === 'sync-version') {
  // Sync version from package.json to all platform config files
  const ver = pkg.version;
  const targets = [
    join(PKG_ROOT, '.claude-plugin', 'plugin.json'),
    join(PKG_ROOT, '.codex-plugin', 'plugin.json'),
    join(PKG_ROOT, 'gemini-extension.json'),
  ];
  for (const p of targets) {
    const obj = safeJson(p);
    if (obj) { obj.version = ver; safeWrite(p, JSON.stringify(obj, null, 2) + '\n'); }
  }

  const marketPath = join(PKG_ROOT, '.claude-plugin', 'marketplace.json');
  const market = safeJson(marketPath);
  if (market?.plugins?.[0]) { market.plugins[0].version = ver; safeWrite(marketPath, JSON.stringify(market, null, 2) + '\n'); }

  ok(`Version synced to ${ver}`);

} else if (cmd === '--global' || cmd === '--standby') {
  // Mode switching
  const mode = cmd === '--global' ? 'global' : 'standby';
  ensureConfig();
  const config = safeJson(CONFIG_FILE) || {};
  config.install_mode = mode;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  ok(msg(`模式已切换为: ${mode}`, `Mode switched to: ${mode}`));

  // Update Codex config.toml if Codex is installed
  const codexDir = join(HOME, '.codex');
  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath);
  if (toml) {
    const bootstrapFile = mode === 'global' ? 'bootstrap.md' : 'bootstrap-lite.md';
    const newVal = `"${join(PKG_ROOT, bootstrapFile).replace(/\\/g, '/')}"`;
    const re = /^model_instructions_file\s*=.*$/m;
    if (re.test(toml)) {
      toml = toml.replace(re, `model_instructions_file = ${newVal}`);
    } else {
      toml = `model_instructions_file = ${newVal}\n` + toml;
    }
    writeFileSync(configPath, toml, 'utf-8');
    ok(msg('Codex config.toml 已更新', 'Codex config.toml updated'));
  }

  console.log(msg(
    mode === 'global'
      ? '  所有项目将自动启用完整 HelloAGENTS 规则。'
      : '  项目需通过 ~init 激活完整功能，未激活项目仅注入通用规则。',
    mode === 'global'
      ? '  All projects will use full HelloAGENTS rules.'
      : '  Projects need ~init to activate full features. Unactivated projects get lite rules only.'
  ));

} else {
  // Manual invocation: show help
  console.log(`
HelloAGENTS v${pkg.version} — The orchestration kernel for AI CLIs

${msg('安装', 'Install')}:
  Claude Code:  /plugin marketplace add hellowind777/helloagents
  Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents
  Codex:        npm install -g helloagents  ${msg('（自动配置）', '(auto-configures)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('全局模式（所有项目启用完整规则）', 'Global mode (full rules for all projects)')}
  helloagents --standby    ${msg('标准模式（项目级按需激活，默认）', 'Standby mode (per-project activation, default)')}

${msg('卸载', 'Uninstall')}:
  Claude Code:  /plugin remove helloagents
  Gemini CLI:   gemini extensions uninstall helloagents
  Codex:        npm uninstall -g helloagents
`.trim());
}

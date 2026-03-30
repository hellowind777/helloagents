#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero external dependencies.
 */
'use strict';

import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ensureDir, safeWrite, safeRead, safeJson, removeIfExists,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
  mergeSettingsHooks, cleanSettingsHooks, loadHooksWithAbsPath,
} from './scripts/cli-utils.mjs';

// ── Constants ────────────────────────────────────────────────────────────

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
  install_mode: "standby",
};

let pkg = { version: '0.0.0' };
try { pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf-8')); } catch {}

const isCN = (() => {
  const lang = (process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '').toLowerCase();
  return lang.includes('zh') || lang.includes('cn');
})();
const msg = (cn, en) => isCN ? cn : en;
const ok = (m) => console.log(`  ✓ ${m}`);

// ── Codex Install/Uninstall ─────────────────────────────────────────────

function installCodex(mode) {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  // 1. Inject bootstrap content into ~/.codex/AGENTS.md (like CLAUDE.md / GEMINI.md)
  const bootstrapFile = mode === 'global' ? 'bootstrap.md' : 'bootstrap-lite.md';
  const bootstrapContent = safeRead(join(PKG_ROOT, bootstrapFile));
  if (bootstrapContent) {
    injectMarkedContent(join(codexDir, 'AGENTS.md'), bootstrapContent);
  }

  // 2. config.toml
  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');

  function ensureTopLevel(key, value) {
    const re = new RegExp(`^${key}\\s*=.*$`, 'm');
    if (re.test(toml)) {
      toml = toml.replace(re, `${key} = ${value}`);
    } else {
      toml = `${key} = ${value}\n` + toml;
    }
  }

  ensureTopLevel('model_instructions_file', `"${join(PKG_ROOT, bootstrapFile).replace(/\\/g, '/')}"`);
  ensureTopLevel('notify', `["node", "${join(PKG_ROOT, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`);

  toml = toml.replace(/^((?:notify|model_instructions_file)\s*=.*\n)((?:notify|model_instructions_file)\s*=.*\n)(?!\n)/, '$1$2\n');

  if (!toml.includes('[features]')) toml += '\n[features]\ncodex_hooks = true\n';
  else if (!toml.includes('codex_hooks')) toml = toml.replace('[features]', '[features]\ncodex_hooks = true');

  safeWrite(configPath, toml);

  // 3. Write hooks.json with absolute paths
  const codexHooksPath = join(codexDir, 'hooks.json');
  const hooksData = loadHooksWithAbsPath(PKG_ROOT, 'hooks.json', '${CLAUDE_PLUGIN_ROOT}');
  if (hooksData) {
    try { writeFileSync(codexHooksPath, JSON.stringify(hooksData, null, 2), 'utf-8'); } catch {}
  }

  // 4. Symlink skills directory
  const codexSkillsLink = join(codexDir, 'helloagents');
  createLink(join(PKG_ROOT, 'skills'), codexSkillsLink);

  return true;
}

function uninstallCodex() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;

  removeMarkedContent(join(codexDir, 'AGENTS.md'));

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
  removeIfExists(join(codexDir, 'hooks.json'));
  removeLink(join(codexDir, 'helloagents'));

  // Legacy symlinks cleanup
  for (const p of [join(codexDir, 'skills', 'helloagents'), join(HOME, '.agents', 'skills', 'helloagents')]) {
    removeLink(p);
  }

  return true;
}

// ── Claude Code Standby Install/Uninstall ───────────────────────────────

function installClaudeStandby() {
  const claudeDir = join(HOME, '.claude');
  ensureDir(claudeDir);

  // 1. Inject bootstrap-lite.md content into ~/.claude/CLAUDE.md
  const bootstrapContent = safeRead(join(PKG_ROOT, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    injectMarkedContent(join(claudeDir, 'CLAUDE.md'), bootstrapContent);
  }

  // 2. Symlink skills directory: ~/.claude/helloagents → PKG_ROOT/skills/
  createLink(join(PKG_ROOT, 'skills'), join(claudeDir, 'helloagents'));

  // 3. Write hooks into ~/.claude/settings.json (with absolute paths)
  const settingsPath = join(claudeDir, 'settings.json');
  const hooksData = loadHooksWithAbsPath(PKG_ROOT, 'hooks.json', '${CLAUDE_PLUGIN_ROOT}');
  if (hooksData) {
    mergeSettingsHooks(settingsPath, hooksData, ['Read(~/.claude/helloagents/**)',]);
  }

  return true;
}

function uninstallClaudeStandby() {
  const claudeDir = join(HOME, '.claude');
  if (!existsSync(claudeDir)) return false;

  removeMarkedContent(join(claudeDir, 'CLAUDE.md'));
  removeLink(join(claudeDir, 'helloagents'));
  cleanSettingsHooks(join(claudeDir, 'settings.json'), true);

  return true;
}

// ── Gemini CLI Standby Install/Uninstall ────────────────────────────────

function installGeminiStandby() {
  const geminiDir = join(HOME, '.gemini');
  ensureDir(geminiDir);

  // 1. Inject bootstrap-lite.md content into ~/.gemini/GEMINI.md
  //    For Gemini, also append PKG_ROOT absolute path for skills resolution
  let bootstrapContent = safeRead(join(PKG_ROOT, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    const absSkillsPath = join(PKG_ROOT, 'skills').replace(/\\/g, '/');
    bootstrapContent += `\n\n<!-- HelloAGENTS skills absolute path: ${absSkillsPath} -->\n`;
    injectMarkedContent(join(geminiDir, 'GEMINI.md'), bootstrapContent);
  }

  // 2. Write hooks into ~/.gemini/settings.json
  const settingsPath = join(geminiDir, 'settings.json');
  const hooksData = loadHooksWithAbsPath(PKG_ROOT, 'hooks-gemini.json', '${extensionPath}');
  if (hooksData) mergeSettingsHooks(settingsPath, hooksData);

  return true;
}

function uninstallGeminiStandby() {
  const geminiDir = join(HOME, '.gemini');
  if (!existsSync(geminiDir)) return false;

  removeMarkedContent(join(geminiDir, 'GEMINI.md'));
  cleanSettingsHooks(join(geminiDir, 'settings.json'));
  // Clean up legacy standalone hooks file
  removeIfExists(join(geminiDir, 'helloagents-hooks.json'));

  return true;
}

// ── Config ───────────────────────────────────────────────────────────────

function ensureConfig() {
  ensureDir(HELLOAGENTS_HOME);
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
  } else {
    const existing = safeJson(CONFIG_FILE) || {};
    const reconciled = { ...existing };
    for (const [key, val] of Object.entries(DEFAULTS)) {
      if (!(key in reconciled)) reconciled[key] = val;
    }
    if (JSON.stringify(reconciled) !== JSON.stringify(existing)) {
      writeFileSync(CONFIG_FILE, JSON.stringify(reconciled, null, 2), 'utf-8');
    }
  }
}

// ── Install orchestration ────────────────────────────────────────────────

function installStandby() {
  if (installClaudeStandby()) ok(msg('Claude Code 已配置（standby 模式）', 'Claude Code configured (standby mode)'));
  if (installGeminiStandby()) ok(msg('Gemini CLI 已配置（standby 模式）', 'Gemini CLI configured (standby mode)'));
  if (installCodex('standby')) ok(msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function installGlobal() {
  // Global mode: Claude Code & Gemini use plugin/extension (user installs manually)
  // Clean up any standby artifacts first
  uninstallClaudeStandby();
  uninstallGeminiStandby();
  if (installCodex('global')) ok(msg('Codex CLI 已配置（global 模式）', 'Codex CLI configured (global mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function uninstallAll() {
  uninstallClaudeStandby();
  uninstallGeminiStandby();
  uninstallCodex();
}

// ── Main ─────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || '';

const codexStatus = () => existsSync(join(HOME, '.codex'))
  ? msg('已自动配置', 'Auto-configured')
  : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents');

const PLUGIN_CMDS = '    Claude Code:  /plugin marketplace add hellowind777/helloagents\n                  /plugin install helloagents@helloagents\n    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents';
const REMOVE_HINT = msg(
  '如已安装 Claude Code 插件，建议手动移除: /plugin remove helloagents\n  如已安装 Gemini CLI 扩展，建议手动移除: gemini extensions uninstall helloagents',
  'If Claude Code plugin installed, consider removing: /plugin remove helloagents\n  If Gemini CLI extension installed, consider removing: gemini extensions uninstall helloagents');

function printInstallMsg(mode, context) {
  const isSwitch = context === 'switch';
  if (mode === 'global') {
    if (!isSwitch) console.log(msg(
      `\n  ✅ HelloAGENTS 已安装（global 模式）！\n\n${PLUGIN_CMDS}\n    Codex:        ${codexStatus()}\n\n  切换模式：\n    helloagents --standby   标准模式（默认，非插件安装）`,
      `\n  ✅ HelloAGENTS installed (global mode)!\n\n${PLUGIN_CMDS}\n    Codex:        ${codexStatus()}\n\n  Switch modes:\n    helloagents --standby   Standby mode (default, non-plugin install)`));
    else console.log(msg(`  所有项目将自动启用完整 HelloAGENTS 规则。\n  请手动安装插件：\n${PLUGIN_CMDS}`,
      `  All projects will use full HelloAGENTS rules.\n  Please install plugins manually:\n${PLUGIN_CMDS}`));
  } else {
    if (!isSwitch) console.log(msg(
      `\n  ✅ HelloAGENTS 已安装（standby 模式）！\n\n    Claude Code:  已自动配置（~/.claude/CLAUDE.md + hooks）\n    Gemini CLI:   已自动配置（~/.gemini/GEMINI.md）\n    Codex:        ${codexStatus()}\n\n  standby 模式下，hello-* 技能不会自动触发。\n  在项目中使用 ~init 激活完整功能，或使用 ~command 按需调用。\n\n  切换模式：\n    helloagents --global    全局模式（安装插件，hello-* 自动触发）`,
      `\n  ✅ HelloAGENTS installed (standby mode)!\n\n    Claude Code:  Auto-configured (~/.claude/CLAUDE.md + hooks)\n    Gemini CLI:   Auto-configured (~/.gemini/GEMINI.md)\n    Codex:        ${codexStatus()}\n\n  In standby mode, hello-* skills won't auto-trigger.\n  Use ~init in a project to activate full features, or use ~command on demand.\n\n  Switch modes:\n    helloagents --global    Global mode (install plugin, hello-* auto-trigger)`));
    else console.log(msg(`  项目需通过 ~init 激活完整功能，未激活项目仅注入通用规则。\n  ${REMOVE_HINT}`,
      `  Projects need ~init to activate full features. Unactivated projects get lite rules only.\n  ${REMOVE_HINT}`));
  }
  if (!isSwitch) console.log();
}

if (cmd === 'postinstall') {
  console.log(`\n  HelloAGENTS v${pkg.version}\n`);
  ensureConfig();
  ok('~/.helloagents/helloagents.json');

  const settings = safeJson(CONFIG_FILE) || {};
  const mode = settings.install_mode || 'standby';
  if (mode === 'global') installGlobal(); else installStandby();
  printInstallMsg(mode, 'install');

} else if (cmd === 'preuninstall') {
  console.log(`\n  HelloAGENTS — ${msg('正在清理', 'Cleaning up')}\n`);
  uninstallAll();
  ok(msg('所有 CLI 配置已清理', 'All CLI configurations cleaned'));
  console.log(msg(
    '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）\n  ℹ 如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents\n  ℹ 如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
    '  ℹ ~/.helloagents/ preserved (delete manually if desired)\n  ℹ If Claude Code plugin installed, run: /plugin remove helloagents\n  ℹ If Gemini CLI extension installed, run: gemini extensions uninstall helloagents'));
  console.log();

} else if (cmd === 'sync-version') {
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
  const newMode = cmd === '--global' ? 'global' : 'standby';
  ensureConfig();
  const config = safeJson(CONFIG_FILE) || {};
  const oldMode = config.install_mode || 'standby';

  if (oldMode === newMode) {
    ok(msg(`当前已是 ${newMode} 模式`, `Already in ${newMode} mode`));
    process.exit(0);
  }

  config.install_mode = newMode;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  ok(msg(`模式已切换为: ${newMode}`, `Mode switched to: ${newMode}`));

  if (newMode === 'global') installGlobal(); else installStandby();
  printInstallMsg(newMode, 'switch');

} else {
  console.log(`
HelloAGENTS v${pkg.version} — The orchestration kernel for AI CLIs

${msg('安装', 'Install')}:
  npm install -g helloagents  ${msg('（默认 standby 模式，自动配置所有检测到的 CLI）', '(default standby mode, auto-configures all detected CLIs)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('全局模式（安装插件，hello-* 自动触发）', 'Global mode (install plugin, hello-* auto-trigger)')}
  helloagents --standby    ${msg('标准模式（非插件安装，hello-* 不自动触发，默认）', "Standby mode (non-plugin install, hello-* won't auto-trigger, default)")}

${msg('卸载', 'Uninstall')}:
  npm uninstall -g helloagents
  ${msg('如已安装插件，另需手动移除：', 'If plugins installed, also remove manually:')}
    Claude Code:  /plugin remove helloagents
    Gemini CLI:   gemini extensions uninstall helloagents
`.trim());
}

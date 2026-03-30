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
  readJsonOrThrow, copyEntries,
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
const CODEX_MARKETPLACE_NAME = 'local-plugins';
const CODEX_PLUGIN_NAME = 'helloagents';
const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
const CODEX_PLUGIN_CONFIG_HEADER = `[plugins."${CODEX_PLUGIN_KEY}"]`;
const CODEX_RUNTIME_ENTRIES = [
  '.codex-plugin',
  'assets',
  'bootstrap.md',
  'hooks',
  'LICENSE.md',
  'package.json',
  'README.md',
  'README_CN.md',
  'scripts',
  'skills',
  'templates',
];

// ── Codex Install/Uninstall ─────────────────────────────────────────────

function isTomlTableHeader(line) {
  const trimmed = String(line || '').trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

function normalizeToml(text) {
  const next = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return next ? `${next}\n` : '';
}

function upsertTopLevelTomlKey(text, key, value) {
  const re = new RegExp(`^${key}\\s*=.*$`, 'm');
  const next = re.test(text)
    ? String(text || '').replace(re, `${key} = ${value}`)
    : `${key} = ${value}\n${String(text || '')}`;
  return normalizeToml(next);
}

function readTopLevelTomlLine(text, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isTomlTableHeader(trimmed)) break;
    if (trimmed.startsWith(`${key} =`)) return trimmed;
  }
  return '';
}

function ensureTopLevelTomlLine(text, key, line) {
  const normalized = String(line || '').trim();
  if (!normalized) return normalizeToml(text);
  const value = normalized.slice(normalized.indexOf('=') + 1).trim();
  return upsertTopLevelTomlKey(text, key, value);
}

function readTomlKeyInSection(text, headerLine, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);
  if (headerIndex < 0) return '';

  const keyRe = new RegExp(`^\\s*${key}\\s*=.*$`);
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isTomlTableHeader(line)) break;
    if (keyRe.test(line)) return line.trim();
  }
  return '';
}

function removeTomlKeyInSection(text, headerLine, key) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);
  if (headerIndex < 0) return normalizeToml(text);

  const keyRe = new RegExp(`^\\s*${key}\\s*=`);
  const nextLines = [];
  let removed = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > headerIndex && isTomlTableHeader(line)) {
      nextLines.push(...lines.slice(index));
      break;
    }
    if (index > headerIndex && keyRe.test(line)) {
      removed = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!removed) return normalizeToml(text);
  return normalizeToml(nextLines.join('\n'));
}

function ensureTomlKeyInSection(text, headerLine, key, line) {
  const normalized = String(line || '').trim();
  if (!normalized) return normalizeToml(text);
  const value = normalized.slice(normalized.indexOf('=') + 1).trim();
  return upsertTomlKeyInSection(text, headerLine, key, value);
}

function upsertTomlKeyInSection(text, headerLine, key, value) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === headerLine);

  if (headerIndex < 0) {
    const base = normalizeToml(text).trimEnd();
    return base
      ? `${base}\n\n${headerLine}\n${key} = ${value}\n`
      : `${headerLine}\n${key} = ${value}\n`;
  }

  let endIndex = headerIndex + 1;
  while (endIndex < lines.length && !isTomlTableHeader(lines[endIndex])) {
    endIndex += 1;
  }

  const keyRe = new RegExp(`^\\s*${key}\\s*=`);
  let updated = false;
  for (let index = headerIndex + 1; index < endIndex; index += 1) {
    if (keyRe.test(lines[index])) {
      lines[index] = `${key} = ${value}`;
      updated = true;
      break;
    }
  }

  if (!updated) {
    lines.splice(endIndex, 0, `${key} = ${value}`);
  }

  return normalizeToml(lines.join('\n'));
}

function stripTomlSection(text, headerLine) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let removed = false;

  for (let index = 0; index < lines.length;) {
    if (lines[index].trim() === headerLine) {
      removed = true;
      index += 1;
      while (index < lines.length && !isTomlTableHeader(lines[index])) {
        index += 1;
      }
      continue;
    }

    kept.push(lines[index]);
    index += 1;
  }

  return {
    removed,
    text: normalizeToml(kept.join('\n')),
  };
}

function removeTopLevelTomlLines(text, shouldRemove) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  let currentSection = null;
  let removed = false;

  for (const line of lines) {
    if (isTomlTableHeader(line)) {
      currentSection = line.trim();
      kept.push(line);
      continue;
    }

    if (!currentSection && shouldRemove(line.trim())) {
      removed = true;
      continue;
    }

    kept.push(line);
  }

  return {
    removed,
    text: normalizeToml(kept.join('\n')),
  };
}

function upsertCodexPluginConfig(text) {
  const stripped = stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text.trimEnd();
  const block = `${CODEX_PLUGIN_CONFIG_HEADER}\nenabled = true`;
  return stripped ? `${stripped}\n\n${block}\n` : `${block}\n`;
}

function removeCodexPluginConfig(text) {
  return stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text;
}

function getDefaultCodexMarketplace() {
  return {
    name: CODEX_MARKETPLACE_NAME,
    interface: {
      displayName: 'Local Plugins',
    },
    plugins: [],
  };
}

function updateCodexMarketplace(marketplaceFile) {
  const marketplace = readJsonOrThrow(marketplaceFile, 'Codex marketplace 配置') || getDefaultCodexMarketplace();
  marketplace.name = CODEX_MARKETPLACE_NAME;
  marketplace.interface = marketplace.interface || { displayName: 'Local Plugins' };
  marketplace.plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];

  const nextEntry = {
    name: CODEX_PLUGIN_NAME,
    source: {
      source: 'local',
      path: `./plugins/${CODEX_PLUGIN_NAME}`,
    },
    policy: {
      installation: 'AVAILABLE',
      authentication: 'ON_INSTALL',
    },
    category: 'Coding',
  };

  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin?.name === CODEX_PLUGIN_NAME);
  if (existingIndex >= 0) {
    marketplace.plugins.splice(existingIndex, 1, nextEntry);
  } else {
    marketplace.plugins.push(nextEntry);
  }

  safeWrite(marketplaceFile, JSON.stringify(marketplace, null, 2) + '\n');
}

function removeCodexMarketplaceEntry(marketplaceFile) {
  if (!existsSync(marketplaceFile)) return false;
  const marketplace = readJsonOrThrow(marketplaceFile, 'Codex marketplace 配置');
  const plugins = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  const nextPlugins = plugins.filter((plugin) => plugin?.name !== CODEX_PLUGIN_NAME);
  if (nextPlugins.length === plugins.length) return false;
  if (!nextPlugins.length) {
    removeIfExists(marketplaceFile);
    return true;
  }
  marketplace.plugins = nextPlugins;
  safeWrite(marketplaceFile, JSON.stringify(marketplace, null, 2) + '\n');
  return true;
}

function rewriteCodexPluginHooks(pluginRoot) {
  const hooksData = loadHooksWithAbsPath(pluginRoot, 'hooks.json', '${CLAUDE_PLUGIN_ROOT}');
  if (!hooksData) return;
  safeWrite(join(pluginRoot, 'hooks', 'hooks.json'), JSON.stringify(hooksData, null, 2) + '\n');
}

function installCodexStandby() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  // 1. Inject bootstrap content into ~/.codex/AGENTS.md (like CLAUDE.md / GEMINI.md)
  const bootstrapFile = 'bootstrap-lite.md';
  const bootstrapContent = safeRead(join(PKG_ROOT, bootstrapFile));
  if (bootstrapContent) {
    injectMarkedContent(join(codexDir, 'AGENTS.md'), bootstrapContent);
  }

  // 2. config.toml
  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');

  toml = upsertTopLevelTomlKey(toml, 'model_instructions_file', `"${join(PKG_ROOT, bootstrapFile).replace(/\\/g, '/')}"`);
  toml = upsertTopLevelTomlKey(toml, 'notify', `["node", "${join(PKG_ROOT, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`);
  toml = upsertTomlKeyInSection(toml, '[features]', 'codex_hooks', 'true');

  safeWrite(configPath, toml);

  // 3. Write hooks.json with absolute paths
  const codexHooksPath = join(codexDir, 'hooks.json');
  const hooksData = loadHooksWithAbsPath(PKG_ROOT, 'hooks.json', '${CLAUDE_PLUGIN_ROOT}');
  if (hooksData) {
    try { writeFileSync(codexHooksPath, JSON.stringify(hooksData, null, 2), 'utf-8'); } catch {}
  }

  // 4. Symlink package root directory
  const codexPkgLink = join(codexDir, 'helloagents');
  createLink(PKG_ROOT, codexPkgLink);

  return true;
}

function uninstallCodexStandby() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;

  removeMarkedContent(join(codexDir, 'AGENTS.md'));

  const configPath = join(codexDir, 'config.toml');
  const backupToml = safeRead(configPath + '.bak') || '';
  let toml = safeRead(configPath) || '';
  if (toml.includes('helloagents') || toml.includes('HelloAGENTS')) {
    toml = removeTopLevelTomlLines(toml, (line) => {
      if (!line) return false;
      if (line.startsWith('model_instructions_file =') && line.includes('helloagents')) return true;
      if (line.startsWith('notify =') && line.includes('codex-notify')) return true;
      return false;
    }).text;
    toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
    toml = ensureTopLevelTomlLine(toml, 'model_instructions_file', readTopLevelTomlLine(backupToml, 'model_instructions_file'));
    toml = ensureTopLevelTomlLine(toml, 'notify', readTopLevelTomlLine(backupToml, 'notify'));
    toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
    if (toml.trim()) safeWrite(configPath, toml);
    else removeIfExists(configPath);
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

function installCodexGlobal() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;

  const pluginRoot = join(HOME, 'plugins', CODEX_PLUGIN_NAME);
  const installedPluginRoot = join(
    codexDir,
    'plugins',
    'cache',
    CODEX_MARKETPLACE_NAME,
    CODEX_PLUGIN_NAME,
    'local',
  );
  const marketplaceFile = join(HOME, '.agents', 'plugins', 'marketplace.json');
  const configPath = join(codexDir, 'config.toml');

  ensureDir(codexDir);
  removeIfExists(pluginRoot);
  removeIfExists(join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME));

  ensureDir(join(HOME, 'plugins'));
  ensureDir(installedPluginRoot);

  copyEntries(PKG_ROOT, pluginRoot, CODEX_RUNTIME_ENTRIES);
  copyEntries(PKG_ROOT, installedPluginRoot, CODEX_RUNTIME_ENTRIES);
  rewriteCodexPluginHooks(pluginRoot);
  rewriteCodexPluginHooks(installedPluginRoot);

  ensureDir(join(HOME, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');
  toml = upsertTopLevelTomlKey(
    toml,
    'model_instructions_file',
    `"${join(pluginRoot, 'bootstrap.md').replace(/\\/g, '/')}"`,
  );
  toml = upsertTomlKeyInSection(toml, '[features]', 'codex_hooks', 'true');
  toml = upsertCodexPluginConfig(toml);
  safeWrite(configPath, toml);

  return true;
}

function uninstallCodexGlobal() {
  const codexDir = join(HOME, '.codex');
  if (!existsSync(codexDir)) return false;

  const pluginRoot = join(HOME, 'plugins', CODEX_PLUGIN_NAME);
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME);
  const marketplaceFile = join(HOME, '.agents', 'plugins', 'marketplace.json');
  const configPath = join(codexDir, 'config.toml');

  removeIfExists(pluginRoot);
  removeIfExists(pluginCacheRoot);
  removeCodexMarketplaceEntry(marketplaceFile);

  const backupToml = safeRead(configPath + '.bak') || '';
  let toml = safeRead(configPath) || '';
  toml = removeCodexPluginConfig(toml);
  toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('model_instructions_file =')
    && line.includes('/plugins/helloagents/bootstrap.md')).text;
  toml = ensureTopLevelTomlLine(toml, 'model_instructions_file', readTopLevelTomlLine(backupToml, 'model_instructions_file'));
  toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeIfExists(configPath + '.bak');

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

  // 2. Symlink package root directory: ~/.claude/helloagents → PKG_ROOT/
  createLink(PKG_ROOT, join(claudeDir, 'helloagents'));

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
  const bootstrapContent = safeRead(join(PKG_ROOT, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    injectMarkedContent(join(geminiDir, 'GEMINI.md'), bootstrapContent);
  }

  // 2. Symlink package root directory: ~/.gemini/helloagents → PKG_ROOT/
  createLink(PKG_ROOT, join(geminiDir, 'helloagents'));

  // 3. Write hooks into ~/.gemini/settings.json
  const settingsPath = join(geminiDir, 'settings.json');
  const hooksData = loadHooksWithAbsPath(PKG_ROOT, 'hooks-gemini.json', '${extensionPath}');
  if (hooksData) mergeSettingsHooks(settingsPath, hooksData);

  return true;
}

function uninstallGeminiStandby() {
  const geminiDir = join(HOME, '.gemini');
  if (!existsSync(geminiDir)) return false;

  removeMarkedContent(join(geminiDir, 'GEMINI.md'));
  removeLink(join(geminiDir, 'helloagents'));
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
  uninstallCodexGlobal();
  if (installClaudeStandby()) ok(msg('Claude Code 已配置（standby 模式）', 'Claude Code configured (standby mode)'));
  if (installGeminiStandby()) ok(msg('Gemini CLI 已配置（standby 模式）', 'Gemini CLI configured (standby mode)'));
  if (installCodexStandby()) ok(msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function installGlobal() {
  // Global mode: Claude Code & Gemini use plugin/extension (user installs manually)
  // Clean up any standby artifacts first
  uninstallClaudeStandby();
  uninstallGeminiStandby();
  uninstallCodexStandby();
  if (installCodexGlobal()) ok(msg('Codex CLI 已安装原生本地插件（global 模式）', 'Codex CLI native local plugin installed (global mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function uninstallAll() {
  uninstallClaudeStandby();
  uninstallGeminiStandby();
  uninstallCodexStandby();
  uninstallCodexGlobal();
}

// ── Main ─────────────────────────────────────────────────────────────────

const cmd = process.argv[2] || '';

const codexStandbyStatus = () => existsSync(join(HOME, '.codex'))
  ? msg('已自动配置', 'Auto-configured')
  : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents');

const codexGlobalStatus = () => existsSync(join(HOME, '.codex'))
  ? msg('已自动安装原生本地插件', 'Native local plugin auto-installed')
  : msg('安装 Codex CLI 后重新运行 npm install -g helloagents', 'Install Codex CLI then re-run npm install -g helloagents');

const PLUGIN_CMDS = '    Claude Code:  /plugin marketplace add hellowind777/helloagents\n                  /plugin install helloagents@helloagents\n    Gemini CLI:   gemini extensions install https://github.com/hellowind777/helloagents';
const REMOVE_HINT = msg(
  '如已安装 Claude Code 插件，建议手动移除: /plugin remove helloagents\n  如已安装 Gemini CLI 扩展，建议手动移除: gemini extensions uninstall helloagents',
  'If Claude Code plugin installed, consider removing: /plugin remove helloagents\n  If Gemini CLI extension installed, consider removing: gemini extensions uninstall helloagents');

function printInstallMsg(mode, context) {
  const isSwitch = context === 'switch';
  if (mode === 'global') {
    if (!isSwitch) console.log(msg(
      `\n  ✅ HelloAGENTS 已安装（global 模式）！\n\n${PLUGIN_CMDS}\n    Codex:        ${codexGlobalStatus()}（~/.agents/plugins/marketplace.json + ~/plugins/helloagents）\n\n  切换模式：\n    helloagents --standby   标准模式（默认，非插件安装）`,
      `\n  ✅ HelloAGENTS installed (global mode)!\n\n${PLUGIN_CMDS}\n    Codex:        ${codexGlobalStatus()} (~/.agents/plugins/marketplace.json + ~/plugins/helloagents)\n\n  Switch modes:\n    helloagents --standby   Standby mode (default, non-plugin install)`));
    else console.log(msg(`  所有项目将自动启用完整 HelloAGENTS 规则。\n  Claude Code / Gemini 请手动安装插件；Codex 已自动走原生本地插件链路。`,
      `  All projects will use full HelloAGENTS rules.\n  Install Claude Code / Gemini plugins manually; Codex now uses the native local-plugin path automatically.`));
  } else {
    if (!isSwitch) console.log(msg(
      `\n  ✅ HelloAGENTS 已安装（standby 模式）！\n\n    Claude Code:  已自动配置（~/.claude/CLAUDE.md + hooks）\n    Gemini CLI:   已自动配置（~/.gemini/GEMINI.md）\n    Codex:        ${codexStandbyStatus()}\n\n  standby 模式下，hello-* 技能不会自动触发。\n  在项目中使用 ~init 激活完整功能，或使用 ~command 按需调用。\n\n  切换模式：\n    helloagents --global    全局模式（Claude/Gemini 装插件；Codex 自动装原生本地插件）`,
      `\n  ✅ HelloAGENTS installed (standby mode)!\n\n    Claude Code:  Auto-configured (~/.claude/CLAUDE.md + hooks)\n    Gemini CLI:   Auto-configured (~/.gemini/GEMINI.md)\n    Codex:        ${codexStandbyStatus()}\n\n  In standby mode, hello-* skills won't auto-trigger.\n  Use ~init in a project to activate full features, or use ~command on demand.\n\n  Switch modes:\n    helloagents --global    Global mode (manual plugins for Claude/Gemini; native local plugin auto-install for Codex)`));
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
  helloagents-js             ${msg('（稳定别名，避免与系统中同名可执行文件冲突）', '(stable alias to avoid conflicts with system executables of the same name)')}

${msg('模式切换', 'Mode switching')}:
  helloagents --global     ${msg('全局模式（Claude/Gemini 装插件；Codex 自动装原生本地插件）', 'Global mode (manual plugins for Claude/Gemini; native local plugin auto-install for Codex)')}
  helloagents --standby    ${msg('标准模式（非插件安装，hello-* 不自动触发，默认）', "Standby mode (non-plugin install, hello-* won't auto-trigger, default)")}

${msg('卸载', 'Uninstall')}:
  npm uninstall -g helloagents
  ${msg('如已安装插件，另需手动移除：', 'If plugins installed, also remove manually:')}
    Claude Code:  /plugin remove helloagents
    Gemini CLI:   gemini extensions uninstall helloagents
`.trim());
}

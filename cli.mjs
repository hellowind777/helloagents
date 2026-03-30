#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero external dependencies.
 */
'use strict';

import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { safeWrite, safeJson, ensureDir } from './scripts/cli-utils.mjs';
import { installCodexStandby, uninstallCodexStandby, installCodexGlobal, uninstallCodexGlobal } from './scripts/cli-codex.mjs';
import { installClaudeStandby, uninstallClaudeStandby, installGeminiStandby, uninstallGeminiStandby } from './scripts/cli-hosts.mjs';
import { DEFAULTS, ensureConfig, loadPackageVersion } from './scripts/cli-config.mjs';
import { createMessageHelpers, createInstallMessagePrinter } from './scripts/cli-messages.mjs';

const HOME = homedir();
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const HELLOAGENTS_HOME = join(HOME, '.helloagents');
const CONFIG_FILE = join(HELLOAGENTS_HOME, 'helloagents.json');
const pkg = loadPackageVersion(PKG_ROOT);

const isCN = (() => {
  const lang = (process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '').toLowerCase();
  return lang.includes('zh') || lang.includes('cn');
})();
const { msg, ok } = createMessageHelpers(isCN);
const { printHelp, printInstallMsg } = createInstallMessagePrinter({
  home: HOME,
  pkgVersion: pkg.version,
  msg,
});

function installStandby() {
  uninstallCodexGlobal(HOME);
  if (installClaudeStandby(HOME, PKG_ROOT)) ok(msg('Claude Code 已配置（standby 模式）', 'Claude Code configured (standby mode)'));
  if (installGeminiStandby(HOME, PKG_ROOT)) ok(msg('Gemini CLI 已配置（standby 模式）', 'Gemini CLI configured (standby mode)'));
  if (installCodexStandby(HOME, PKG_ROOT)) ok(msg('Codex CLI 已配置（standby 模式）', 'Codex CLI configured (standby mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function installGlobal() {
  uninstallClaudeStandby(HOME);
  uninstallGeminiStandby(HOME);
  uninstallCodexStandby(HOME);
  if (installCodexGlobal(HOME, PKG_ROOT)) ok(msg('Codex CLI 已安装原生本地插件（global 模式）', 'Codex CLI native local plugin installed (global mode)'));
  else console.log(msg('  - Codex CLI 未检测到，跳过', '  - Codex CLI not detected, skipped'));
}

function uninstallAll() {
  uninstallClaudeStandby(HOME);
  uninstallGeminiStandby(HOME);
  uninstallCodexStandby(HOME);
  uninstallCodexGlobal(HOME);
}

function syncVersion() {
  const ver = pkg.version;
  const targets = [
    join(PKG_ROOT, '.claude-plugin', 'plugin.json'),
    join(PKG_ROOT, '.codex-plugin', 'plugin.json'),
    join(PKG_ROOT, 'gemini-extension.json'),
  ];
  for (const path of targets) {
    const obj = safeJson(path);
    if (obj) {
      obj.version = ver;
      safeWrite(path, JSON.stringify(obj, null, 2) + '\n');
    }
  }
  const marketPath = join(PKG_ROOT, '.claude-plugin', 'marketplace.json');
  const market = safeJson(marketPath);
  if (market?.plugins?.[0]) {
    market.plugins[0].version = ver;
    safeWrite(marketPath, JSON.stringify(market, null, 2) + '\n');
  }
  ok(`Version synced to ${ver}`);
}

function switchMode(newMode) {
  ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir);
  const config = safeJson(CONFIG_FILE) || {};
  const oldMode = config.install_mode || DEFAULTS.install_mode;

  if (oldMode === newMode) {
    ok(msg(`当前已是 ${newMode} 模式`, `Already in ${newMode} mode`));
    process.exit(0);
  }

  config.install_mode = newMode;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  ok(msg(`模式已切换为: ${newMode}`, `Mode switched to: ${newMode}`));

  if (newMode === 'global') installGlobal();
  else installStandby();
  printInstallMsg(newMode, 'switch');
}

const cmd = process.argv[2] || '';

if (cmd === 'postinstall') {
  console.log(`\n  HelloAGENTS v${pkg.version}\n`);
  ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir);
  ok('~/.helloagents/helloagents.json');

  const settings = safeJson(CONFIG_FILE) || {};
  const mode = settings.install_mode || DEFAULTS.install_mode;
  if (mode === 'global') installGlobal();
  else installStandby();
  printInstallMsg(mode, 'install');
} else if (cmd === 'preuninstall') {
  console.log(`\n  HelloAGENTS — ${msg('正在清理', 'Cleaning up')}\n`);
  uninstallAll();
  ok(msg('所有 CLI 配置已清理', 'All CLI configurations cleaned'));
  console.log(msg(
    '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）\n  ℹ 如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents\n  ℹ 如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
    '  ℹ ~/.helloagents/ preserved (delete manually if desired)\n  ℹ If Claude Code plugin installed, run: /plugin remove helloagents\n  ℹ If Gemini CLI extension installed, run: gemini extensions uninstall helloagents',
  ));
  console.log();
} else if (cmd === 'sync-version') {
  syncVersion();
} else if (cmd === '--global' || cmd === '--standby') {
  switchMode(cmd === '--global' ? 'global' : 'standby');
} else {
  printHelp();
}

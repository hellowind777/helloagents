#!/usr/bin/env node
/**
 * HelloAGENTS CLI — Quality-driven orchestration kernel for AI CLIs.
 * Runs as npm lifecycle script (postinstall/preuninstall). Zero external dependencies.
 */
'use strict';

import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync } from 'node:fs';
import { safeRead, safeWrite, safeJson, ensureDir } from './scripts/cli-utils.mjs';
import {
  installCodexStandby,
  uninstallCodexStandby,
  installCodexGlobal,
  uninstallCodexGlobal,
  CODEX_MARKETPLACE_NAME,
  CODEX_PLUGIN_KEY,
  CODEX_PLUGIN_NAME,
} from './scripts/cli-codex.mjs';
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
const HOSTS = ['claude', 'gemini', 'codex'];
const HOST_ALIASES = new Map([
  ['all', 'all'],
  ['*', 'all'],
  ['claude', 'claude'],
  ['claude-code', 'claude'],
  ['gemini', 'gemini'],
  ['gemini-cli', 'gemini'],
  ['codex', 'codex'],
  ['codex-cli', 'codex'],
]);

function readSettings(shouldEnsure = false) {
  if (shouldEnsure) ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir);
  return safeJson(CONFIG_FILE) || {};
}

function writeSettings(settings) {
  ensureDir(HELLOAGENTS_HOME);
  writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function hasTrackedHostModes(settings) {
  return !!settings
    && typeof settings.host_install_modes === 'object'
    && !Array.isArray(settings.host_install_modes);
}

function getTrackedHostMode(settings, host) {
  return hasTrackedHostModes(settings) ? settings.host_install_modes[host] || '' : '';
}

function setTrackedHostMode(settings, host, mode) {
  if (!hasTrackedHostModes(settings)) settings.host_install_modes = {};
  settings.host_install_modes[host] = mode;
}

function clearTrackedHostMode(settings, host) {
  if (!hasTrackedHostModes(settings)) {
    settings.host_install_modes = {};
    return;
  }
  delete settings.host_install_modes[host];
}

function setAllTrackedHostModes(settings, mode) {
  settings.host_install_modes = Object.fromEntries(HOSTS.map((host) => [host, mode]));
}

function clearAllTrackedHostModes(settings) {
  settings.host_install_modes = {};
}

function normalizeHost(value = '') {
  return HOST_ALIASES.get(String(value || '').toLowerCase()) || '';
}

function parseModeFlag(args) {
  const hasGlobal = args.includes('--global');
  const hasStandby = args.includes('--standby');
  if (hasGlobal && hasStandby) {
    throw new Error(msg('不能同时指定 --global 和 --standby', 'Cannot use --global and --standby together'));
  }
  if (hasGlobal) return 'global';
  if (hasStandby) return 'standby';
  return '';
}

function parseLifecycleArgs(args) {
  const explicitMode = parseModeFlag(args);
  const wantsAll = args.includes('--all');
  const positionals = args.filter((arg) => !arg.startsWith('--'));
  const unknownFlags = args.filter((arg) =>
    arg.startsWith('--')
    && arg !== '--global'
    && arg !== '--standby'
    && arg !== '--all');
  if (unknownFlags.length) {
    throw new Error(msg(`未知参数: ${unknownFlags.join(', ')}`, `Unknown flags: ${unknownFlags.join(', ')}`));
  }
  if (wantsAll && positionals.length) {
    throw new Error(msg('`--all` 不能与具体 CLI 同时使用', '`--all` cannot be combined with a specific CLI'));
  }
  if (positionals.length > 1) {
    throw new Error(msg(`参数过多: ${positionals.join(' ')}`, `Too many arguments: ${positionals.join(' ')}`));
  }
  const host = normalizeHost(wantsAll ? 'all' : (positionals[0] || 'all'));
  if (!host) {
    throw new Error(msg(`不支持的 CLI: ${positionals[0]}`, `Unsupported CLI: ${positionals[0]}`));
  }
  return { host, explicitMode };
}

function hasHelloagentsMarker(filePath) {
  return (safeRead(filePath) || '').includes('HELLOAGENTS_START');
}

function hasHelloagentsSettings(filePath) {
  return JSON.stringify(safeJson(filePath) || {}).includes('helloagents');
}

function detectClaudeMode() {
  const claudeDir = join(HOME, '.claude');
  if (
    existsSync(join(claudeDir, 'helloagents'))
    || hasHelloagentsMarker(join(claudeDir, 'CLAUDE.md'))
    || hasHelloagentsSettings(join(claudeDir, 'settings.json'))
  ) {
    return 'standby';
  }
  return '';
}

function detectGeminiMode() {
  const geminiDir = join(HOME, '.gemini');
  if (
    existsSync(join(geminiDir, 'helloagents'))
    || hasHelloagentsMarker(join(geminiDir, 'GEMINI.md'))
    || hasHelloagentsSettings(join(geminiDir, 'settings.json'))
  ) {
    return 'standby';
  }
  return '';
}

function detectCodexMode() {
  const codexDir = join(HOME, '.codex');
  const codexConfig = safeRead(join(codexDir, 'config.toml')) || '';
  const marketplace = safeRead(join(HOME, '.agents', 'plugins', 'marketplace.json')) || '';
  if (
    existsSync(join(HOME, 'plugins', CODEX_PLUGIN_NAME))
    || existsSync(join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME))
    || marketplace.includes(`"name": "${CODEX_PLUGIN_NAME}"`)
    || codexConfig.includes(CODEX_PLUGIN_KEY)
    || codexConfig.includes(`/plugins/${CODEX_PLUGIN_NAME}/scripts/notify.mjs`)
  ) {
    return 'global';
  }
  if (
    existsSync(join(codexDir, 'helloagents'))
    || hasHelloagentsMarker(join(codexDir, 'AGENTS.md'))
    || codexConfig.includes('codex-notify')
    || codexConfig.includes('HelloAGENTS')
  ) {
    return 'standby';
  }
  return '';
}

function detectHostMode(host) {
  if (host === 'claude') return detectClaudeMode();
  if (host === 'gemini') return detectGeminiMode();
  if (host === 'codex') return detectCodexMode();
  return '';
}

function resolveHostMode(host, explicitMode, settings) {
  if (explicitMode) return explicitMode;
  return detectHostMode(host)
    || getTrackedHostMode(settings, host)
    || (!hasTrackedHostModes(settings) ? (settings.install_mode || '') : '')
    || DEFAULTS.install_mode;
}

function resolveInstallMode(explicitMode, settings) {
  return explicitMode || settings.install_mode || DEFAULTS.install_mode;
}

function getHostLabel(host) {
  if (host === 'claude') return 'Claude Code';
  if (host === 'gemini') return 'Gemini CLI';
  if (host === 'codex') return 'Codex CLI';
  return 'All CLIs';
}

function reportHostAction(action, host, mode, result = {}) {
  const label = getHostLabel(host);
  const isCleanup = action === 'cleanup' || action === 'uninstall';
  if (result.skipped) {
    console.log(msg(`  - ${label} 未检测到，跳过`, `  - ${label} not detected, skipped`));
  } else if (isCleanup) {
    ok(msg(`${label} 已清理（${mode} 模式）`, `${label} cleaned (${mode} mode)`));
  } else if (mode === 'standby') {
    ok(msg(`${label} 已配置（standby 模式）`, `${label} configured (standby mode)`));
  } else if (host === 'codex') {
    ok(msg(`${label} 已安装原生本地插件（global 模式）`, `${label} native local plugin installed (global mode)`));
  } else {
    ok(msg(`${label} 已切到 global 模式`, `${label} switched to global mode`));
  }

  if (result.noteCN || result.noteEN) {
    console.log(msg(`  ℹ ${result.noteCN}`, `  ℹ ${result.noteEN}`));
  }
}

function installHostStandby(host) {
  if (host === 'claude') {
    installClaudeStandby(HOME, PKG_ROOT);
    return {};
  }
  if (host === 'gemini') {
    installGeminiStandby(HOME, PKG_ROOT);
    return {};
  }
  uninstallCodexGlobal(HOME);
  if (!installCodexStandby(HOME, PKG_ROOT)) return { skipped: true };
  return {};
}

function installHostGlobal(host) {
  if (host === 'claude') {
    uninstallClaudeStandby(HOME);
    return {
      noteCN: 'Claude Code 的 global 模式需手动安装插件: /plugin marketplace add hellowind777/helloagents',
      noteEN: 'Claude Code global mode still needs a manual plugin install: /plugin marketplace add hellowind777/helloagents',
    };
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(HOME);
    return {
      noteCN: 'Gemini CLI 的 global 模式需手动安装扩展: gemini extensions install https://github.com/hellowind777/helloagents',
      noteEN: 'Gemini CLI global mode still needs a manual extension install: gemini extensions install https://github.com/hellowind777/helloagents',
    };
  }
  uninstallCodexStandby(HOME);
  if (!installCodexGlobal(HOME, PKG_ROOT)) return { skipped: true };
  return {};
}

function cleanupHostStandby(host) {
  if (host === 'claude') return { skipped: !uninstallClaudeStandby(HOME) };
  if (host === 'gemini') return { skipped: !uninstallGeminiStandby(HOME) };
  return { skipped: !uninstallCodexStandby(HOME) };
}

function cleanupHostGlobal(host) {
  if (host === 'claude') {
    uninstallClaudeStandby(HOME);
    return {
      noteCN: '如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents',
      noteEN: 'If the Claude Code plugin is installed, remove it manually: /plugin remove helloagents',
    };
  }
  if (host === 'gemini') {
    uninstallGeminiStandby(HOME);
    return {
      noteCN: '如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
      noteEN: 'If the Gemini CLI extension is installed, remove it manually: gemini extensions uninstall helloagents',
    };
  }
  return { skipped: !uninstallCodexGlobal(HOME) };
}

function runHostInstall(host, mode) {
  return mode === 'global' ? installHostGlobal(host) : installHostStandby(host);
}

function runHostCleanup(host, mode) {
  return mode === 'global' ? cleanupHostGlobal(host) : cleanupHostStandby(host);
}

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
  const config = readSettings(true);
  const oldMode = config.install_mode || DEFAULTS.install_mode;

  const isRefresh = oldMode === newMode;
  if (!isRefresh) {
    config.install_mode = newMode;
    ok(msg(`模式已切换为: ${newMode}`, `Mode switched to: ${newMode}`));
  } else {
    ok(msg(`当前已是 ${newMode} 模式，正在刷新安装`, `Already in ${newMode} mode, refreshing installation`));
  }

  if (newMode === 'global') installGlobal();
  else installStandby();
  setAllTrackedHostModes(config, newMode);
  writeSettings(config);
  printInstallMsg(newMode, isRefresh ? 'refresh' : 'switch');
}

function runScopedLifecycle(action, rawArgs) {
  const { host, explicitMode } = parseLifecycleArgs(rawArgs);

  if (host === 'all') {
    if (action === 'cleanup' || action === 'uninstall') {
      console.log(`\n  HelloAGENTS — ${msg('正在清理', 'Cleaning up')}\n`);
      uninstallAll();
      if (existsSync(CONFIG_FILE)) {
        const settings = readSettings();
        clearAllTrackedHostModes(settings);
        writeSettings(settings);
      }
      ok(msg('所有 CLI 配置已清理', 'All CLI configurations cleaned'));
      console.log(msg(
        '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）\n  ℹ 如已安装 Claude Code 插件，请手动执行: /plugin remove helloagents\n  ℹ 如已安装 Gemini CLI 扩展，请手动执行: gemini extensions uninstall helloagents',
        '  ℹ ~/.helloagents/ preserved (delete manually if desired)\n  ℹ If Claude Code plugin installed, run: /plugin remove helloagents\n  ℹ If Gemini CLI extension installed, run: gemini extensions uninstall helloagents',
      ));
      console.log();
      return;
    }

    const settings = readSettings(true);
    const mode = resolveInstallMode(explicitMode, settings);
    if (explicitMode) settings.install_mode = explicitMode;
    if (mode === 'global') installGlobal();
    else installStandby();
    setAllTrackedHostModes(settings, mode);
    writeSettings(settings);
    printInstallMsg(mode, action === 'update' ? 'refresh' : 'install');
    return;
  }

  const shouldEnsure = action === 'install' || action === 'update';
  const settings = readSettings(shouldEnsure);
  const mode = resolveHostMode(host, explicitMode, settings);
  const result = (action === 'cleanup' || action === 'uninstall')
    ? runHostCleanup(host, mode)
    : runHostInstall(host, mode);

  if (action === 'cleanup' || action === 'uninstall') {
    if (existsSync(CONFIG_FILE)) {
      clearTrackedHostMode(settings, host);
      writeSettings(settings);
    }
  } else {
    if (!result.skipped) {
      setTrackedHostMode(settings, host, mode);
      writeSettings(settings);
    }
  }

  reportHostAction(action, host, mode, result);
}

const argv = process.argv.slice(2);
const cmd = argv[0] || '';

if (cmd === 'postinstall') {
  console.log(`\n  HelloAGENTS v${pkg.version}\n`);
  ensureConfig(HELLOAGENTS_HOME, CONFIG_FILE, safeJson, ensureDir);
  ok('~/.helloagents/helloagents.json');

  const settings = readSettings();
  const mode = settings.install_mode || DEFAULTS.install_mode;
  console.log(msg(
    `  HelloAGENTS 包已安装，尚未自动部署到任何 CLI。\n  使用显式命令部署：\n    helloagents install codex --${mode}\n    helloagents install --all --${mode}\n`,
    `  HelloAGENTS package installed. No CLI targets were configured automatically.\n  Deploy explicitly with:\n    helloagents install codex --${mode}\n    helloagents install --all --${mode}\n`,
  ));
} else if (cmd === 'preuninstall') {
  runScopedLifecycle('cleanup', []);
} else if (cmd === 'sync-version') {
  syncVersion();
} else if (cmd === '--global' || cmd === '--standby') {
  switchMode(cmd === '--global' ? 'global' : 'standby');
} else if (['install', 'update', 'uninstall', 'cleanup', '--cleanup'].includes(cmd)) {
  try {
    runScopedLifecycle(cmd === '--cleanup' ? 'cleanup' : cmd, argv.slice(1));
  } catch (error) {
    console.error(`\n  ✗ ${error.message}\n`);
    process.exitCode = 1;
  }
} else {
  printHelp();
}

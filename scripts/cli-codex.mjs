import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import {
  ensureDir, safeRead, safeWrite, removeIfExists,
  readJsonOrThrow, copyEntries,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
} from './cli-utils.mjs';
import { ensureTimestampedBackup, readCodexBackup, removeCodexBackup } from './cli-codex-backup.mjs';
import {
  CODEX_MANAGED_TOML_COMMENT,
  CODEX_PLUGIN_CONFIG_HEADER,
  installCodexManagedTopLevelConfig,
  isManagedCodexBackupInstruction,
  isManagedCodexModelInstruction,
  isManagedCodexNotify,
  removeCodexPluginConfig,
  restoreCodexTopLevelConfig,
  upsertCodexPluginConfig,
} from './cli-codex-config.mjs';
import {
  readTopLevelTomlLine,
  readTomlKeyInSection,
  removeTomlKeyInSection,
  ensureTomlKeyInSection,
  removeTopLevelTomlLines,
} from './cli-toml.mjs';

export const CODEX_MARKETPLACE_NAME = 'local-plugins';
export const CODEX_PLUGIN_NAME = 'helloagents';
export const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
export { CODEX_MANAGED_TOML_COMMENT, CODEX_PLUGIN_CONFIG_HEADER };
export const CODEX_RUNTIME_CARRIER = 'AGENTS.md';
const CODEX_CONFIG_BASENAME = 'config.toml';
export const CODEX_RUNTIME_ENTRIES = [
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
  const removedHelloagents = nextPlugins.length !== plugins.length;
  const isManagedMarketplace = (marketplace?.name || CODEX_MARKETPLACE_NAME) === CODEX_MARKETPLACE_NAME;
  if (!nextPlugins.length && isManagedMarketplace) {
    removeIfExists(marketplaceFile);
    return removedHelloagents || true;
  }
  if (!removedHelloagents) return false;
  if (!nextPlugins.length) {
    removeIfExists(marketplaceFile);
    return true;
  }
  marketplace.plugins = nextPlugins;
  safeWrite(marketplaceFile, JSON.stringify(marketplace, null, 2) + '\n');
  return true;
}

function buildCodexRuntimeCarrier(bootstrapContent) {
  const normalized = String(bootstrapContent || '').trim();
  return normalized ? `${normalized}\n` : '';
}

function injectCodexRuntimeCarrier(filePath, bootstrapPath) {
  const bootstrapContent = safeRead(bootstrapPath);
  if (!bootstrapContent) return false;
  injectMarkedContent(filePath, buildCodexRuntimeCarrier(bootstrapContent).trimEnd());
  return true;
}

function writeCodexRuntimeCarrier(filePath, bootstrapPath) {
  const bootstrapContent = safeRead(bootstrapPath);
  if (!bootstrapContent) return false;
  safeWrite(filePath, buildCodexRuntimeCarrier(bootstrapContent));
  return true;
}

export function installCodexStandby(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  const codexAgentsPath = join(codexDir, CODEX_RUNTIME_CARRIER);
  injectCodexRuntimeCarrier(codexAgentsPath, join(pkgRoot, 'bootstrap-lite.md'));

  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);

  toml = installCodexManagedTopLevelConfig(toml, {
    modelInstructionsPath: codexAgentsPath,
    notifyScriptPath: join(pkgRoot, 'scripts', 'notify.mjs'),
  });
  safeWrite(configPath, toml);

  createLink(pkgRoot, join(codexDir, 'helloagents'));
  return true;
}

export function uninstallCodexStandby(home) {
  const codexDir = join(home, '.codex');
  let changed = false;

  if (existsSync(codexDir)) {
    removeMarkedContent(join(codexDir, 'AGENTS.md'));

    const configPath = join(codexDir, 'config.toml');
    const backupToml = readCodexBackup(configPath, CODEX_CONFIG_BASENAME);
    let toml = safeRead(configPath) || '';
    toml = removeTopLevelTomlLines(toml, (line) => {
      if (!line) return false;
      if (line.startsWith('model_instructions_file =') && isManagedCodexModelInstruction(line)) return true;
      if (line.startsWith('notify =') && line.includes('codex-notify')) return true;
      return false;
    }).text;
    toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
    const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
    const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
    toml = restoreCodexTopLevelConfig(toml, {
      modelInstructionsLine: isManagedCodexBackupInstruction(backupModelInstructions) ? '' : backupModelInstructions,
      notifyLine: isManagedCodexNotify(backupNotify) ? '' : backupNotify,
    });
    toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
    if (toml.trim()) safeWrite(configPath, toml);
    else removeIfExists(configPath);
    changed = true;
    removeCodexBackup(configPath, CODEX_CONFIG_BASENAME);
    removeIfExists(join(codexDir, 'hooks.json'));
    removeLink(join(codexDir, 'helloagents'));
    changed = true;
  }

  for (const path of [join(codexDir, 'skills', 'helloagents'), join(home, '.agents', 'skills', 'helloagents')]) {
    changed = removeLink(path) || changed;
  }

  return changed;
}

export function installCodexGlobal(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;

  const pluginRoot = join(home, 'plugins', CODEX_PLUGIN_NAME);
  const installedPluginRoot = join(
    codexDir,
    'plugins',
    'cache',
    CODEX_MARKETPLACE_NAME,
    CODEX_PLUGIN_NAME,
    'local',
  );
  const marketplaceFile = join(home, '.agents', 'plugins', 'marketplace.json');
  const configPath = join(codexDir, 'config.toml');

  ensureDir(codexDir);
  removeIfExists(pluginRoot);
  removeIfExists(join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME));

  ensureDir(join(home, 'plugins'));
  ensureDir(installedPluginRoot);

  copyEntries(pkgRoot, pluginRoot, CODEX_RUNTIME_ENTRIES);
  copyEntries(pkgRoot, installedPluginRoot, CODEX_RUNTIME_ENTRIES);
  writeCodexRuntimeCarrier(
    join(pluginRoot, CODEX_RUNTIME_CARRIER),
    join(pluginRoot, 'bootstrap.md'),
  );
  writeCodexRuntimeCarrier(
    join(installedPluginRoot, CODEX_RUNTIME_CARRIER),
    join(installedPluginRoot, 'bootstrap.md'),
  );
  const homeCarrierPath = join(codexDir, CODEX_RUNTIME_CARRIER);
  injectCodexRuntimeCarrier(homeCarrierPath, join(pkgRoot, 'bootstrap.md'));

  ensureDir(join(home, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);
  toml = installCodexManagedTopLevelConfig(toml, {
    modelInstructionsPath: homeCarrierPath,
    notifyScriptPath: join(pluginRoot, 'scripts', 'notify.mjs'),
  });
  toml = upsertCodexPluginConfig(toml);
  safeWrite(configPath, toml);

  return true;
}

export function uninstallCodexGlobal(home) {
  const codexDir = join(home, '.codex');

  const pluginRoot = join(home, 'plugins', CODEX_PLUGIN_NAME);
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME);
  const marketplaceFile = join(home, '.agents', 'plugins', 'marketplace.json');
  const configPath = join(codexDir, 'config.toml');

  removeIfExists(pluginRoot);
  removeIfExists(pluginCacheRoot);
  removeCodexMarketplaceEntry(marketplaceFile);
  removeMarkedContent(join(codexDir, 'AGENTS.md'));

  const backupToml = readCodexBackup(configPath, CODEX_CONFIG_BASENAME);
  let toml = safeRead(configPath) || '';
  toml = removeCodexPluginConfig(toml);
  toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('model_instructions_file =')
    && isManagedCodexModelInstruction(line)).text;
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('notify =')
    && line.includes('/plugins/helloagents/scripts/notify.mjs')).text;
  const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
  const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
  toml = restoreCodexTopLevelConfig(toml, {
    modelInstructionsLine: isManagedCodexBackupInstruction(backupModelInstructions) ? '' : backupModelInstructions,
    notifyLine: isManagedCodexNotify(backupNotify) ? '' : backupNotify,
  });
  toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeCodexBackup(configPath, CODEX_CONFIG_BASENAME);

  return true;
}

import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import {
  ensureDir, safeJson, safeRead, safeWrite, removeIfExists,
  readJsonOrThrow, copyEntries,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
  cleanSettingsHooks, loadHooksWithCliEntry, mergeSettingsHooks,
} from './cli-utils.mjs';
import { ensureTimestampedBackup, readCodexBackup, removeCodexBackup } from './cli-codex-backup.mjs';
import {
  CODEX_MANAGED_TOML_COMMENT,
  CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH,
  CODEX_PLUGIN_CONFIG_HEADER,
  installCodexManagedTopLevelConfig,
  installCodexManagedTuiConfig,
  isManagedCodexBackupInstruction,
  isManagedCodexGoalsFeature,
  isManagedCodexModelInstruction,
  isManagedCodexNotify,
  isManagedLegacyCodexHooksFeature,
  readCodexGoalsFeatureLine,
  readLegacyCodexHooksFeatureLine,
  removeCodexGoalsFeatureConfig,
  removeCodexManagedTuiConfig,
  removeLegacyManagedCodexHooksFeatureConfig,
  removeCodexPluginConfig,
  restoreCodexGoalsFeatureConfig,
  restoreCodexTopLevelConfig,
  upsertCodexPluginConfig,
} from './cli-codex-config.mjs';
import {
  cleanupManagedCodexHookTrust,
  syncManagedCodexHookTrust,
} from './cli-codex-hooks-state.mjs';
import {
  readTopLevelTomlLine,
  readTopLevelTomlBlock,
  removeTopLevelTomlLines,
} from './cli-toml.mjs';
import { buildRuntimeCarrier, readCarrierSettings } from './cli-runtime-carrier.mjs';

export const CODEX_MARKETPLACE_NAME = 'local-plugins';
export const CODEX_PLUGIN_NAME = 'helloagents';
export const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
export { CODEX_MANAGED_TOML_COMMENT, CODEX_PLUGIN_CONFIG_HEADER };
export const CODEX_RUNTIME_CARRIER = 'AGENTS.md';
const CODEX_CONFIG_BASENAME = 'config.toml';
const CODEX_HOOKS_BASENAME = 'hooks.json';
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
    marketplace.plugins = [];
    safeWrite(marketplaceFile, JSON.stringify(marketplace, null, 2) + '\n');
    return true;
  }
  marketplace.plugins = nextPlugins;
  safeWrite(marketplaceFile, JSON.stringify(marketplace, null, 2) + '\n');
  return true;
}

function injectCodexRuntimeCarrier(filePath, bootstrapPath, settings) {
  const bootstrapContent = safeRead(bootstrapPath);
  if (!bootstrapContent) return false;
  injectMarkedContent(filePath, buildRuntimeCarrier(bootstrapContent, settings).trimEnd());
  return true;
}

function writeCodexRuntimeCarrier(filePath, bootstrapPath, settings) {
  const bootstrapContent = safeRead(bootstrapPath);
  if (!bootstrapContent) return false;
  safeWrite(filePath, buildRuntimeCarrier(bootstrapContent, settings));
  return true;
}

function installCodexStandaloneHooks(home, pkgRoot) {
  const hooksData = loadHooksWithCliEntry(pkgRoot, 'hooks-codex.json', '${PLUGIN_ROOT}');
  if (!hooksData) return false;
  const hooksPath = join(home, '.codex', CODEX_HOOKS_BASENAME);
  mergeSettingsHooks(hooksPath, hooksData);
  syncManagedCodexHookTrust(join(home, '.codex', CODEX_CONFIG_BASENAME), hooksPath, safeJson(hooksPath));
  return true;
}

function cleanupCodexStandaloneHooks(home) {
  cleanupManagedCodexHookTrust(join(home, '.codex', CODEX_CONFIG_BASENAME));
  cleanSettingsHooks(join(home, '.codex', CODEX_HOOKS_BASENAME));
}

function cleanupCodexManagedConfig(configPath, { removePluginConfig = false } = {}) {
  const backupToml = readCodexBackup(configPath, CODEX_CONFIG_BASENAME);
  let toml = safeRead(configPath) || '';

  const currentModelInstructions = readTopLevelTomlLine(toml, 'model_instructions_file');
  const currentNotify = readTopLevelTomlBlock(toml, 'notify');
  const currentCodexGoalsFeature = readCodexGoalsFeatureLine(toml);
  const currentLegacyCodexHooksFeature = readLegacyCodexHooksFeatureLine(toml);

  const shouldRestoreModelInstructions = isManagedCodexModelInstruction(currentModelInstructions);
  const shouldRestoreNotify = isManagedCodexNotify(currentNotify);
  const shouldRestoreCodexGoalsFeature = isManagedCodexGoalsFeature(currentCodexGoalsFeature);
  const shouldRemoveLegacyCodexHooksFeature = isManagedLegacyCodexHooksFeature(currentLegacyCodexHooksFeature);

  if (removePluginConfig) {
    toml = removeCodexPluginConfig(toml);
  }
  if (shouldRestoreCodexGoalsFeature) {
    toml = removeCodexGoalsFeatureConfig(toml);
  }
  toml = removeCodexManagedTuiConfig(toml);
  if (shouldRemoveLegacyCodexHooksFeature) {
    toml = removeLegacyManagedCodexHooksFeatureConfig(toml);
  }
  if (shouldRestoreModelInstructions) {
    toml = removeTopLevelTomlLines(toml, (line) =>
      line.startsWith('model_instructions_file =') && isManagedCodexModelInstruction(line)).text;
  }
  if (shouldRestoreNotify) {
    toml = removeTopLevelTomlLines(toml, (line) =>
      line.startsWith('notify =') && isManagedCodexNotify(line)).text;
  }

  const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
  const backupNotify = readTopLevelTomlBlock(backupToml, 'notify');
  const backupCodexGoalsFeature = readCodexGoalsFeatureLine(backupToml);

  toml = restoreCodexTopLevelConfig(toml, {
    modelInstructionsLine: shouldRestoreModelInstructions && !isManagedCodexBackupInstruction(backupModelInstructions)
      ? backupModelInstructions
      : '',
    notifyLine: shouldRestoreNotify && !isManagedCodexNotify(backupNotify)
      ? backupNotify
      : '',
  });
  toml = restoreCodexGoalsFeatureConfig(toml, {
    codexGoalsLine: shouldRestoreCodexGoalsFeature && !isManagedCodexGoalsFeature(backupCodexGoalsFeature)
      ? backupCodexGoalsFeature
      : '',
  });

  return toml;
}

export function installCodexStandby(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  const settings = readCarrierSettings(home);
  const codexAgentsPath = join(codexDir, CODEX_RUNTIME_CARRIER);
  injectCodexRuntimeCarrier(codexAgentsPath, join(pkgRoot, 'bootstrap-lite.md'), settings);

  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);

  toml = installCodexManagedTopLevelConfig(toml, {
    modelInstructionsPath: CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH,
  });
  toml = installCodexManagedTuiConfig(toml);
  toml = removeLegacyManagedCodexHooksFeatureConfig(toml);
  safeWrite(configPath, toml);
  installCodexStandaloneHooks(home, pkgRoot);

  createLink(pkgRoot, join(codexDir, 'helloagents'));
  return true;
}

export function cleanupCodexGlobalResidueForStandby(home) {
  const codexDir = join(home, '.codex');
  const pluginRoot = join(home, 'plugins', CODEX_PLUGIN_NAME);
  const pluginCacheRoot = join(codexDir, 'plugins', 'cache', CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_NAME);
  const marketplaceFile = join(home, '.agents', 'plugins', 'marketplace.json');
  const configPath = join(codexDir, 'config.toml');

  removeIfExists(pluginRoot);
  removeIfExists(pluginCacheRoot);
  removeCodexMarketplaceEntry(marketplaceFile);

  const toml = removeCodexPluginConfig(safeRead(configPath) || '');
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);

  return true;
}

export function uninstallCodexStandby(home) {
  const codexDir = join(home, '.codex');
  let changed = false;

  if (existsSync(codexDir)) {
    removeMarkedContent(join(codexDir, 'AGENTS.md'));

    const configPath = join(codexDir, 'config.toml');
    const toml = cleanupCodexManagedConfig(configPath);
    if (toml.trim()) safeWrite(configPath, toml);
    else removeIfExists(configPath);
    changed = true;
    removeCodexBackup(configPath, CODEX_CONFIG_BASENAME);
    cleanupCodexStandaloneHooks(home);
    removeLink(join(codexDir, 'helloagents'));
    changed = true;
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

  const settings = readCarrierSettings(home);
  copyEntries(pkgRoot, pluginRoot, CODEX_RUNTIME_ENTRIES);
  copyEntries(pkgRoot, installedPluginRoot, CODEX_RUNTIME_ENTRIES);
  createLink(pluginRoot, join(codexDir, 'helloagents'));
  writeCodexRuntimeCarrier(
    join(pluginRoot, CODEX_RUNTIME_CARRIER),
    join(pluginRoot, 'bootstrap.md'),
    settings,
  );
  writeCodexRuntimeCarrier(
    join(installedPluginRoot, CODEX_RUNTIME_CARRIER),
    join(installedPluginRoot, 'bootstrap.md'),
    settings,
  );
  const homeCarrierPath = join(codexDir, CODEX_RUNTIME_CARRIER);
  injectCodexRuntimeCarrier(homeCarrierPath, join(pkgRoot, 'bootstrap.md'), settings);

  ensureDir(join(home, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);
  toml = installCodexManagedTopLevelConfig(toml, {
    modelInstructionsPath: CODEX_MANAGED_MODEL_INSTRUCTIONS_PATH,
  });
  toml = installCodexManagedTuiConfig(toml);
  toml = removeLegacyManagedCodexHooksFeatureConfig(toml);
  toml = upsertCodexPluginConfig(toml);
  safeWrite(configPath, toml);
  installCodexStandaloneHooks(home, pkgRoot);

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
  removeLink(join(codexDir, 'helloagents'));
  cleanupCodexStandaloneHooks(home);

  const toml = cleanupCodexManagedConfig(configPath, { removePluginConfig: true });
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeCodexBackup(configPath, CODEX_CONFIG_BASENAME);

  return true;
}

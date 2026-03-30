import { join } from 'node:path';
import { existsSync, copyFileSync, writeFileSync } from 'node:fs';
import {
  ensureDir, safeRead, safeWrite, removeIfExists,
  readJsonOrThrow, copyEntries,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
  loadHooksWithAbsPath,
} from './cli-utils.mjs';
import {
  upsertTopLevelTomlKey,
  readTopLevelTomlLine,
  ensureTopLevelTomlLine,
  readTomlKeyInSection,
  removeTomlKeyInSection,
  ensureTomlKeyInSection,
  upsertTomlKeyInSection,
  stripTomlSection,
  removeTopLevelTomlLines,
} from './cli-toml.mjs';

export const CODEX_MARKETPLACE_NAME = 'local-plugins';
export const CODEX_PLUGIN_NAME = 'helloagents';
export const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
export const CODEX_PLUGIN_CONFIG_HEADER = `[plugins."${CODEX_PLUGIN_KEY}"]`;
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

export function installCodexStandby(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  const bootstrapFile = 'bootstrap-lite.md';
  const bootstrapContent = safeRead(join(pkgRoot, bootstrapFile));
  if (bootstrapContent) {
    injectMarkedContent(join(codexDir, 'AGENTS.md'), bootstrapContent);
  }

  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');

  toml = upsertTopLevelTomlKey(toml, 'model_instructions_file', `"${join(pkgRoot, bootstrapFile).replace(/\\/g, '/')}"`);
  toml = upsertTopLevelTomlKey(toml, 'notify', `["node", "${join(pkgRoot, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`);
  toml = upsertTomlKeyInSection(toml, '[features]', 'codex_hooks', 'true');
  safeWrite(configPath, toml);

  const codexHooksPath = join(codexDir, 'hooks.json');
  const hooksData = loadHooksWithAbsPath(pkgRoot, 'hooks.json', '${CLAUDE_PLUGIN_ROOT}');
  if (hooksData) {
    writeFileSync(codexHooksPath, JSON.stringify(hooksData, null, 2), 'utf-8');
  }

  createLink(pkgRoot, join(codexDir, 'helloagents'));
  return true;
}

export function uninstallCodexStandby(home) {
  const codexDir = join(home, '.codex');
  let changed = false;

  if (existsSync(codexDir)) {
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
      changed = true;
    }
    removeIfExists(configPath + '.bak');
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
  rewriteCodexPluginHooks(pluginRoot);
  rewriteCodexPluginHooks(installedPluginRoot);

  ensureDir(join(home, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');
  toml = upsertTopLevelTomlKey(
    toml,
    'model_instructions_file',
    `"${join(pluginRoot, 'bootstrap.md').replace(/\\/g, '/')}"`,
  );
  toml = upsertTopLevelTomlKey(
    toml,
    'notify',
    `["node", "${join(pluginRoot, 'scripts', 'notify.mjs').replace(/\\/g, '/')}", "codex-notify"]`,
  );
  toml = upsertTomlKeyInSection(toml, '[features]', 'codex_hooks', 'true');
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

  const backupToml = safeRead(configPath + '.bak') || '';
  let toml = safeRead(configPath) || '';
  toml = removeCodexPluginConfig(toml);
  toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('model_instructions_file =')
    && line.includes('/plugins/helloagents/bootstrap.md')).text;
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('notify =')
    && line.includes('/plugins/helloagents/scripts/notify.mjs')).text;
  toml = ensureTopLevelTomlLine(toml, 'model_instructions_file', readTopLevelTomlLine(backupToml, 'model_instructions_file'));
  toml = ensureTopLevelTomlLine(toml, 'notify', readTopLevelTomlLine(backupToml, 'notify'));
  toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeIfExists(configPath + '.bak');

  return true;
}

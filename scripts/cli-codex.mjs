import { join } from 'node:path';
import { existsSync, copyFileSync } from 'node:fs';
import {
  ensureDir, safeRead, safeWrite, removeIfExists,
  readJsonOrThrow, copyEntries,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
} from './cli-utils.mjs';
import {
  upsertTopLevelTomlKey,
  readTopLevelTomlLine,
  ensureTopLevelTomlLine,
  readTomlKeyInSection,
  removeTomlKeyInSection,
  ensureTomlKeyInSection,
  stripTomlSection,
  removeTopLevelTomlLines,
} from './cli-toml.mjs';

export const CODEX_MARKETPLACE_NAME = 'local-plugins';
export const CODEX_PLUGIN_NAME = 'helloagents';
export const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
export const CODEX_PLUGIN_CONFIG_HEADER = `[plugins."${CODEX_PLUGIN_KEY}"]`;
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed';
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

function isManagedCodexModelInstruction(line = '') {
  const normalized = String(line || '').replace(/\\/g, '/');
  return line.includes('model_instructions_file')
    && (
      line.includes(CODEX_MANAGED_TOML_COMMENT)
      || /\/helloagents\/bootstrap(?:-lite)?\.md/i.test(normalized)
    );
}

function isManagedCodexNotify(line = '') {
  return line.includes('codex-notify') || (line.includes('helloagents') && line.includes('notify'));
}

function formatManagedCodexInstructionPath(path) {
  return `"${path.replace(/\\/g, '/')}" ${CODEX_MANAGED_TOML_COMMENT}`;
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

function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

function buildCodexRuntimeContext(runtimeRoot, mode) {
  const root = normalizePath(runtimeRoot);
  return [
    '## Codex 运行时上下文',
    `- 当前 HelloAGENTS 包根目录: ${root}`,
    `- 当前 HelloAGENTS 读取根目录: ${root}`,
    `- 当前命令技能目录: ${root}/skills/commands`,
    `- 当前模板目录: ${root}/templates`,
    `- 当前安装模式: ${mode}`,
    '- Codex 当前不启用 HelloAGENTS hooks：最新 Codex pre 源码下 hook 生命周期会在 TUI 中可见显示，且 suppressOutput 不会静默 SessionStart / UserPromptSubmit / Stop 等注入。请优先依赖本载体与上述固定目录，不要再假设存在静默 hook 注入。',
    '',
  ].join('\n');
}

function withCodexRuntimeContext(bootstrapContent, runtimeRoot, mode) {
  const context = buildCodexRuntimeContext(runtimeRoot, mode);
  return bootstrapContent ? `${context}\n${bootstrapContent}` : context;
}

function rewriteCodexBootstrap(filePath, runtimeRoot, mode) {
  const bootstrapContent = safeRead(filePath);
  if (!bootstrapContent) return;
  safeWrite(filePath, withCodexRuntimeContext(bootstrapContent, runtimeRoot, mode));
}

export function installCodexStandby(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  const bootstrapFile = 'bootstrap-lite.md';
  const codexAgentsPath = join(codexDir, 'AGENTS.md');
  const bootstrapContent = safeRead(join(pkgRoot, bootstrapFile));
  if (bootstrapContent) {
    injectMarkedContent(
      codexAgentsPath,
      withCodexRuntimeContext(bootstrapContent, join(codexDir, 'helloagents'), 'standby'),
    );
  }

  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');

  toml = upsertTopLevelTomlKey(
    toml,
    'model_instructions_file',
    formatManagedCodexInstructionPath(codexAgentsPath),
  );
  toml = upsertTopLevelTomlKey(toml, 'notify', `["node", "${normalizePath(join(pkgRoot, 'scripts', 'notify.mjs'))}", "codex-notify"]`);
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
    const backupToml = safeRead(configPath + '.bak') || '';
    let toml = safeRead(configPath) || '';
    if (toml.includes('helloagents') || toml.includes('HelloAGENTS')) {
      toml = removeTopLevelTomlLines(toml, (line) => {
        if (!line) return false;
        if (line.startsWith('model_instructions_file =') && isManagedCodexModelInstruction(line)) return true;
        if (line.startsWith('notify =') && line.includes('codex-notify')) return true;
        return false;
      }).text;
      toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
      const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
      const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
      toml = ensureTopLevelTomlLine(
        toml,
        'model_instructions_file',
        isManagedCodexModelInstruction(backupModelInstructions) ? '' : backupModelInstructions,
      );
      toml = ensureTopLevelTomlLine(
        toml,
        'notify',
        isManagedCodexNotify(backupNotify) ? '' : backupNotify,
      );
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
  rewriteCodexBootstrap(join(pluginRoot, 'bootstrap.md'), pluginRoot, 'global');
  rewriteCodexBootstrap(join(installedPluginRoot, 'bootstrap.md'), installedPluginRoot, 'global-cache');

  ensureDir(join(home, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  if (toml && !existsSync(configPath + '.bak')) copyFileSync(configPath, configPath + '.bak');
  toml = upsertTopLevelTomlKey(
    toml,
    'model_instructions_file',
    `"${normalizePath(join(pluginRoot, 'bootstrap.md'))}"`,
  );
  toml = upsertTopLevelTomlKey(
    toml,
    'notify',
    `["node", "${normalizePath(join(pluginRoot, 'scripts', 'notify.mjs'))}", "codex-notify"]`,
  );
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
  const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
  const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
  toml = ensureTopLevelTomlLine(
    toml,
    'model_instructions_file',
    isManagedCodexModelInstruction(backupModelInstructions) ? '' : backupModelInstructions,
  );
  toml = ensureTopLevelTomlLine(
    toml,
    'notify',
    isManagedCodexNotify(backupNotify) ? '' : backupNotify,
  );
  toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeIfExists(configPath + '.bak');

  return true;
}

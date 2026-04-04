import { join, dirname } from 'node:path';
import { existsSync, copyFileSync, readdirSync } from 'node:fs';
import {
  ensureDir, safeRead, safeWrite, removeIfExists,
  readJsonOrThrow, copyEntries,
  createLink, removeLink, injectMarkedContent, removeMarkedContent,
} from './cli-utils.mjs';
import {
  upsertTopLevelTomlKey,
  upsertTopLevelTomlBlock,
  readTopLevelTomlLine,
  readTopLevelTomlBlock,
  ensureTopLevelTomlLine,
  ensureTopLevelTomlBlock,
  readTomlKeyInSection,
  removeTomlKeyInSection,
  removeTopLevelTomlBlock,
  ensureTomlKeyInSection,
  stripTomlSection,
  removeTopLevelTomlLines,
} from './cli-toml.mjs';

export const CODEX_MARKETPLACE_NAME = 'local-plugins';
export const CODEX_PLUGIN_NAME = 'helloagents';
export const CODEX_PLUGIN_KEY = `${CODEX_PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`;
export const CODEX_PLUGIN_CONFIG_HEADER = `[plugins."${CODEX_PLUGIN_KEY}"]`;
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed';
export const CODEX_RUNTIME_CARRIER = 'AGENTS.md';
const CODEX_BACKUP_TIMESTAMP_RE = /^\d{8}-\d{6}$/;
const CODEX_CONFIG_BASENAME = 'config.toml';
const CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME = 'developer_instructions';
export const CODEX_DEVELOPER_INSTRUCTIONS = `CRITICAL: These are HelloAGENTS global defaults for Codex. Use them as the baseline for main-agent behavior. Spawned sub-agents should focus on the delegated task unless they are explicitly required to follow main-agent-only workflow.
If the current workspace contains a project-level AGENTS.md or other repo-specific instructions, treat those as the more specific and authoritative instructions. Use these global defaults only where they do not conflict. Standby/global behavior is determined by the active workspace instructions, not by this global default block.
If work was already in progress and earlier context was compressed, first restore the active project state from the most relevant project state files or other project-local context artifacts, then continue from the actual interruption point without restarting the workflow or repeating completed steps.`;
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

function formatBackupTimestamp(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getTimestampedBackupPath(filePath, backupBaseName) {
  return join(dirname(filePath), `${backupBaseName}_${formatBackupTimestamp()}.bak`);
}

function listTimestampedBackups(directory, backupBaseName) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.startsWith(`${backupBaseName}_`) && name.endsWith('.bak'))
    .filter((name) => CODEX_BACKUP_TIMESTAMP_RE.test(name.slice(backupBaseName.length + 1, -4)))
    .sort();
}

function getLatestTimestampedBackupPath(filePath, backupBaseName) {
  const directory = dirname(filePath);
  const backups = listTimestampedBackups(directory, backupBaseName);
  const latest = backups.at(-1);
  return latest ? join(directory, latest) : '';
}

function readLatestTimestampedBackup(filePath, backupBaseName) {
  const backupPath = getLatestTimestampedBackupPath(filePath, backupBaseName);
  return backupPath ? safeRead(backupPath) || '' : '';
}

function removeLatestTimestampedBackup(filePath, backupBaseName) {
  const backupPath = getLatestTimestampedBackupPath(filePath, backupBaseName);
  if (backupPath) removeIfExists(backupPath);
}

function ensureTimestampedBackup(filePath, backupBaseName) {
  if (!existsSync(filePath)) return '';
  const existingBackup = getLatestTimestampedBackupPath(filePath, backupBaseName);
  if (existingBackup) return existingBackup;
  const backupPath = getTimestampedBackupPath(filePath, backupBaseName);
  copyFileSync(filePath, backupPath);
  return backupPath;
}

function readCodexBackup(filePath, backupBaseName) {
  const latest = readLatestTimestampedBackup(filePath, backupBaseName);
  if (latest) return latest;
  const legacyPath = `${filePath}.bak`;
  return safeRead(legacyPath) || '';
}

function removeCodexBackup(filePath, backupBaseName) {
  removeLatestTimestampedBackup(filePath, backupBaseName);
  removeIfExists(`${filePath}.bak`);
}

function isManagedCodexStandbyInstructionPath(normalized = '') {
  return /\/\.codex\/AGENTS\.md/i.test(normalized)
    || /\/\.codex\/helloagents\/bootstrap-lite\.md/i.test(normalized);
}

function isManagedCodexGlobalInstructionPath(normalized = '') {
  return /\/plugins\/helloagents\/AGENTS\.md/i.test(normalized)
    || /\/plugins\/helloagents\/bootstrap\.md/i.test(normalized);
}

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
      || isManagedCodexStandbyInstructionPath(normalized)
      || isManagedCodexGlobalInstructionPath(normalized)
    );
}

function isManagedCodexNotify(line = '') {
  return line.includes('codex-notify') || (line.includes('helloagents') && line.includes('notify'));
}

function isManagedCodexBackupInstruction(line = '') {
  return line.includes(CODEX_MANAGED_TOML_COMMENT);
}

function formatManagedCodexDeveloperInstructions() {
  return `"""\n${CODEX_DEVELOPER_INSTRUCTIONS}\n"""`;
}

function backupUserCodexDeveloperInstructions(configPath, existingBlock) {
  if (!existingBlock || existingBlock.includes('HelloAGENTS')) return;
  const backupPath = getTimestampedBackupPath(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME);
  safeWrite(backupPath, `${existingBlock}\n`);
}

function sanitizeCodexDeveloperInstructionsBackup(block = '') {
  const normalized = String(block || '').trim();
  if (!normalized.startsWith('developer_instructions =')) return '';
  if (normalized.includes(CODEX_DEVELOPER_INSTRUCTIONS)) return '';
  return normalized;
}

function readCodexDeveloperInstructionsBackup(configPath) {
  return sanitizeCodexDeveloperInstructionsBackup(
    readCodexBackup(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME),
  );
}

function removeCodexDeveloperInstructionsBackup(configPath) {
  removeCodexBackup(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME);
}

function installCodexDeveloperInstructions(configPath, toml) {
  const existing = readTopLevelTomlBlock(toml, 'developer_instructions');
  backupUserCodexDeveloperInstructions(configPath, existing);
  return upsertTopLevelTomlBlock(toml, 'developer_instructions', formatManagedCodexDeveloperInstructions());
}

function uninstallCodexDeveloperInstructions(configPath, toml) {
  const existing = readTopLevelTomlBlock(toml, 'developer_instructions');
  if (!existing.includes('HelloAGENTS')) return toml;
  let next = removeTopLevelTomlBlock(toml, 'developer_instructions');
  const backupDeveloperInstructions = readCodexDeveloperInstructionsBackup(configPath);
  next = ensureTopLevelTomlBlock(next, 'developer_instructions', backupDeveloperInstructions);
  removeCodexDeveloperInstructionsBackup(configPath);
  return next;
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
  ].join('\n');
}

function buildCodexRuntimeCarrier(bootstrapContent, runtimeRoot, mode) {
  const context = buildCodexRuntimeContext(runtimeRoot, mode);
  return bootstrapContent ? `${context}\n\n${bootstrapContent.trim()}\n` : `${context}\n`;
}

function writeCodexRuntimeCarrier(filePath, bootstrapPath, runtimeRoot, mode) {
  const bootstrapContent = safeRead(bootstrapPath);
  if (!bootstrapContent) return false;
  safeWrite(filePath, buildCodexRuntimeCarrier(bootstrapContent, runtimeRoot, mode));
  return true;
}

export function installCodexStandby(home, pkgRoot) {
  const codexDir = join(home, '.codex');
  if (!existsSync(codexDir)) return false;
  ensureDir(codexDir);

  const codexAgentsPath = join(codexDir, CODEX_RUNTIME_CARRIER);
  const bootstrapContent = safeRead(join(pkgRoot, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    injectMarkedContent(
      codexAgentsPath,
      buildCodexRuntimeCarrier(bootstrapContent, join(codexDir, 'helloagents'), 'standby').trimEnd(),
    );
  }

  const configPath = join(codexDir, 'config.toml');
  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);

  toml = upsertTopLevelTomlKey(toml, 'notify', `["node", "${normalizePath(join(pkgRoot, 'scripts', 'notify.mjs'))}", "codex-notify"]`);
  toml = installCodexDeveloperInstructions(configPath, toml);
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
    if (toml.includes('helloagents') || toml.includes('HelloAGENTS')) {
      toml = removeTopLevelTomlLines(toml, (line) => {
        if (!line) return false;
        if (line.startsWith('model_instructions_file =') && isManagedCodexModelInstruction(line)) return true;
        if (line.startsWith('notify =') && line.includes('codex-notify')) return true;
        return false;
      }).text;
      toml = uninstallCodexDeveloperInstructions(configPath, toml);
      toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
      const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
      const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
      toml = ensureTopLevelTomlLine(
        toml,
        'model_instructions_file',
        isManagedCodexBackupInstruction(backupModelInstructions) ? '' : backupModelInstructions,
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
    pluginRoot,
    'global',
  );
  writeCodexRuntimeCarrier(
    join(installedPluginRoot, CODEX_RUNTIME_CARRIER),
    join(installedPluginRoot, 'bootstrap.md'),
    installedPluginRoot,
    'global-cache',
  );

  ensureDir(join(home, '.agents', 'plugins'));
  updateCodexMarketplace(marketplaceFile);

  let toml = safeRead(configPath) || '';
  ensureTimestampedBackup(configPath, CODEX_CONFIG_BASENAME);
  toml = upsertTopLevelTomlKey(
    toml,
    'notify',
    `["node", "${normalizePath(join(pluginRoot, 'scripts', 'notify.mjs'))}", "codex-notify"]`,
  );
  toml = upsertCodexPluginConfig(toml);
  toml = installCodexDeveloperInstructions(configPath, toml);
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

  const backupToml = readCodexBackup(configPath, CODEX_CONFIG_BASENAME);
  let toml = safeRead(configPath) || '';
  toml = removeCodexPluginConfig(toml);
  toml = uninstallCodexDeveloperInstructions(configPath, toml);
  toml = removeTomlKeyInSection(toml, '[features]', 'codex_hooks');
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('model_instructions_file =')
    && isManagedCodexModelInstruction(line)).text;
  toml = removeTopLevelTomlLines(toml, (line) =>
    line.startsWith('notify =')
    && line.includes('/plugins/helloagents/scripts/notify.mjs')).text;
  const backupModelInstructions = readTopLevelTomlLine(backupToml, 'model_instructions_file');
  const backupNotify = readTopLevelTomlLine(backupToml, 'notify');
  toml = ensureTopLevelTomlLine(
    toml,
    'model_instructions_file',
    isManagedCodexBackupInstruction(backupModelInstructions) ? '' : backupModelInstructions,
  );
  toml = ensureTopLevelTomlLine(
    toml,
    'notify',
    isManagedCodexNotify(backupNotify) ? '' : backupNotify,
  );
  toml = ensureTomlKeyInSection(toml, '[features]', 'codex_hooks', readTomlKeyInSection(backupToml, '[features]', 'codex_hooks'));
  if (toml.trim()) safeWrite(configPath, toml);
  else removeIfExists(configPath);
  removeCodexBackup(configPath, CODEX_CONFIG_BASENAME);

  return true;
}

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  ensureDir,
  safeRead,
  createLink,
  removeLink,
  injectMarkedContent,
  removeMarkedContent,
  mergeSettingsHooks,
  cleanSettingsHooks,
  loadHooksWithCliEntry,
} from './cli-utils.mjs';
import { buildRuntimeCarrier, readCarrierSettings } from './cli-runtime-carrier.mjs';

export function installClaudeStandby(home, pkgRoot) {
  const claudeDir = join(home, '.claude');
  ensureDir(claudeDir);

  const bootstrapContent = safeRead(join(pkgRoot, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    injectMarkedContent(
      join(claudeDir, 'CLAUDE.md'),
      buildRuntimeCarrier(bootstrapContent, readCarrierSettings(home)).trimEnd(),
    );
  }

  createLink(pkgRoot, join(claudeDir, 'helloagents'));

  const settingsPath = join(claudeDir, 'settings.json');
  const hooksData = loadHooksWithCliEntry(pkgRoot, 'hooks-claude.json', '${CLAUDE_PLUGIN_ROOT}');
  if (hooksData) {
    mergeSettingsHooks(settingsPath, hooksData, [
      'Read(~/.helloagents/helloagents/**)',
      'Read(~/.claude/helloagents/**)',
    ]);
  }

  return true;
}

export function uninstallClaudeStandby(home) {
  const claudeDir = join(home, '.claude');
  if (!existsSync(claudeDir)) return false;

  removeMarkedContent(join(claudeDir, 'CLAUDE.md'));
  removeLink(join(claudeDir, 'helloagents'));
  cleanSettingsHooks(join(claudeDir, 'settings.json'), true);

  return true;
}

export function installGeminiStandby(home, pkgRoot) {
  const geminiDir = join(home, '.gemini');
  ensureDir(geminiDir);

  const bootstrapContent = safeRead(join(pkgRoot, 'bootstrap-lite.md'));
  if (bootstrapContent) {
    injectMarkedContent(
      join(geminiDir, 'GEMINI.md'),
      buildRuntimeCarrier(bootstrapContent, readCarrierSettings(home)).trimEnd(),
    );
  }

  createLink(pkgRoot, join(geminiDir, 'helloagents'));

  const settingsPath = join(geminiDir, 'settings.json');
  const hooksData = loadHooksWithCliEntry(pkgRoot, 'hooks.json', '${extensionPath}');
  if (hooksData) mergeSettingsHooks(settingsPath, hooksData);

  return true;
}

export function uninstallGeminiStandby(home) {
  const geminiDir = join(home, '.gemini');
  if (!existsSync(geminiDir)) return false;

  removeMarkedContent(join(geminiDir, 'GEMINI.md'));
  removeLink(join(geminiDir, 'helloagents'));
  cleanSettingsHooks(join(geminiDir, 'settings.json'));

  return true;
}

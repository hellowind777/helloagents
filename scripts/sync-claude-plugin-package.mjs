import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_ROOT = join(REPO_ROOT, 'plugins', 'helloagents-claude');
const PACKAGE_ENTRIES = [
  'assets',
  'bootstrap-lite.md',
  'bootstrap.md',
  'package.json',
  'scripts',
  'skills',
  'templates',
];

function copyEntry(entry) {
  cpSync(join(REPO_ROOT, entry), join(PACKAGE_ROOT, entry), {
    recursive: true,
    force: true,
  });
}

function writeClaudePluginManifest() {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf-8'));
  delete manifest.hooks;
  mkdirSync(join(PACKAGE_ROOT, '.claude-plugin'), { recursive: true });
  writeFileSync(
    join(PACKAGE_ROOT, '.claude-plugin', 'plugin.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8',
  );
}

function writeClaudeHooks() {
  const hooks = readFileSync(join(REPO_ROOT, 'hooks', 'hooks-claude.json'), 'utf-8');
  mkdirSync(join(PACKAGE_ROOT, 'hooks'), { recursive: true });
  writeFileSync(join(PACKAGE_ROOT, 'hooks', 'hooks.json'), hooks, 'utf-8');
}

rmSync(PACKAGE_ROOT, { recursive: true, force: true });
mkdirSync(PACKAGE_ROOT, { recursive: true });
PACKAGE_ENTRIES.forEach(copyEntry);
writeClaudePluginManifest();
writeClaudeHooks();

console.log(`Synced Claude marketplace package to ${PACKAGE_ROOT}`);

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, realpathSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..', '..');

const PACKAGE_FIXTURE_ENTRIES = [
  '.claude-plugin',
  '.codex-plugin',
  'assets',
  'bootstrap-lite.md',
  'bootstrap.md',
  'cli.mjs',
  'gemini-extension.json',
  'hooks',
  'LICENSE.md',
  'package.json',
  'README.md',
  'README_CN.md',
  'scripts',
  'skills',
  'templates',
];

export function createTempDir(prefix = 'helloagents-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function createPackageFixture() {
  const root = createTempDir('helloagents-pkg-');
  for (const entry of PACKAGE_FIXTURE_ENTRIES) {
    cpSync(join(REPO_ROOT, entry), join(root, entry), { recursive: true, force: true });
  }
  return { root };
}

export function createHomeFixture() {
  const home = createTempDir('helloagents-home-');
  for (const dir of ['.claude', '.codex', '.gemini']) {
    mkdirSync(join(home, dir), { recursive: true });
  }
  return home;
}

export function writeText(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

export function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readText(filePath) {
  return readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

export function runNode(scriptPath, args = [], options = {}) {
  return runCommand(process.execPath, [scriptPath, ...args], options);
}

export function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
    encoding: 'utf-8',
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

export function buildHomeEnv(home) {
  const parsed = parse(home);
  return {
    HOME: home,
    USERPROFILE: home,
    HOMEDRIVE: parsed.root.replace(/[\\/]+$/, ''),
    HOMEPATH: home.slice(parsed.root.length - 1),
    HELLOAGENTS_NOTIFY_SESSION_ID: '',
    WT_SESSION: '',
    TERM_SESSION_ID: '',
    KITTY_WINDOW_ID: '',
    ALACRITTY_WINDOW_ID: '',
    WINDOWID: '',
    WEZTERM_PANE: '',
    TAB_ID: '',
    HELLOAGENTS_DISABLE_OS_NOTIFICATIONS: '1',
  };
}

export function realTarget(path) {
  return existsSync(path) ? realpathSync(path) : '';
}

export function listFiles(dirPath) {
  return existsSync(dirPath) ? readdirSync(dirPath) : [];
}

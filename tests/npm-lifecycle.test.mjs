import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readText,
  runCommand,
  writeJson,
  writeText,
} from './helpers/test-env.mjs';

import {
  CODEX_DEVELOPER_INSTRUCTIONS,
} from '../scripts/cli-codex.mjs';

function runNpm(args, cwd, env) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, 'npm_execpath is required for lifecycle testing');
  const result = runCommand(process.execPath, [npmCli, ...args], { cwd, env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test('npm global install plus explicit cleanup command removes lifecycle artifacts', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const prefix = createTempDir('helloagents-prefix-');
  const packDir = createTempDir('helloagents-pack-');
  const env = buildHomeEnv(home);

  writeText(join(home, '.claude', 'CLAUDE.md'), '# Claude custom\n');
  writeJson(join(home, '.claude', 'settings.json'), { permissions: { allow: ['Read(*)'] } });
  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n');
  writeText(join(home, '.codex', 'config.toml'), 'model_instructions_file = "C:/original/bootstrap.md"\n');

  runNpm(['pack', '--pack-destination', packDir], pkgRoot, env);
  const tarball = join(packDir, 'helloagents-3.0.0.tgz');

  runNpm(['install', '-g', '--prefix', prefix, tarball], pkgRoot, env);

  assert.ok(existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(existsSync(join(home, '.codex', 'helloagents')));
  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  const installedCodexConfig = readText(join(home, '.codex', 'config.toml'));
  assert.match(installedCodexConfig, /^developer_instructions = """/);
  assert.match(installedCodexConfig, new RegExp(CODEX_DEVELOPER_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const cleanup = runCommand(process.execPath, [join(pkgRoot, 'cli.mjs'), 'cleanup'], {
    cwd: pkgRoot,
    env,
  });
  assert.equal(cleanup.status, 0, cleanup.stderr || cleanup.stdout);

  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'config.toml')), /developer_instructions\s*=/);

  runNpm(['uninstall', '-g', '--prefix', prefix, 'helloagents'], pkgRoot, env);
});

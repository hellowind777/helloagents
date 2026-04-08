import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  createTempDir,
  readJson,
  readText,
  runCommand,
  writeJson,
  writeText,
} from './helpers/test-env.mjs';

const npmCli = process.env.npm_execpath;

function runNpm(args, cwd, env) {
  assert.ok(npmCli, 'npm_execpath is required for lifecycle testing');
  const result = runCommand(process.execPath, [npmCli, ...args], { cwd, env });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test('npm global install plus explicit cleanup command removes lifecycle artifacts', { skip: !npmCli }, () => {
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
  const tarball = join(packDir, `helloagents-${readJson(join(pkgRoot, 'package.json')).version}.tgz`);

  runNpm(['install', '-g', '--prefix', prefix, tarball], pkgRoot, env);

  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);

  const explicitInstall = runCommand(process.execPath, [join(pkgRoot, 'cli.mjs'), 'install', '--all', '--standby'], {
    cwd: pkgRoot,
    env,
  });
  assert.equal(explicitInstall.status, 0, explicitInstall.stderr || explicitInstall.stdout);

  assert.ok(existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(existsSync(join(home, '.codex', 'helloagents')));
  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  const installedCodexConfig = readText(join(home, '.codex', 'config.toml'));
  assert.match(installedCodexConfig, /model_instructions_file = ".*\/\.codex\/AGENTS\.md"/);
  assert.doesNotMatch(installedCodexConfig, /developer_instructions\s*=/);

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
  assert.match(readText(join(home, '.codex', 'config.toml')), /model_instructions_file = "C:\/original\/bootstrap\.md"/);

  runNpm(['uninstall', '-g', '--prefix', prefix, 'helloagents'], pkgRoot, env);
});

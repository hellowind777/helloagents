import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildHomeEnv,
  createHomeFixture,
  createPackageFixture,
  readJson,
  readText,
  realTarget,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs';

function runCli(pkgRoot, home, args) {
  const result = runNode(join(pkgRoot, 'cli.mjs'), args, {
    cwd: pkgRoot,
    env: buildHomeEnv(home),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function seedHostConfigs(home) {
  writeText(join(home, '.claude', 'CLAUDE.md'), '# Claude custom\n');
  writeJson(join(home, '.claude', 'settings.json'), {
    model: 'opus',
    permissions: {
      allow: ['Read(*)'],
    },
    hooks: {
      SessionStart: [
        {
          matcher: 'keep',
          hooks: [{ type: 'command', command: 'node "other-claude.mjs"', timeout: 1 }],
        },
      ],
    },
  });

  writeText(join(home, '.gemini', 'GEMINI.md'), '# Gemini custom\n');
  writeJson(join(home, '.gemini', 'settings.json'), {
    hooks: {
      SessionStart: [
        {
          matcher: 'keep',
          hooks: [{ type: 'command', command: 'node "other-gemini.mjs"', timeout: 1 }],
        },
      ],
    },
  });

  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n');
  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'model_instructions_file = "C:/original/bootstrap.md"',
      'notify = ["node", "C:/original/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  );
}

test('CLI lifecycle covers standby, global, update, cleanup, and config preservation', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['postinstall']);

  const configFile = join(home, '.helloagents', 'helloagents.json');
  assert.equal(readJson(configFile).install_mode, 'standby');

  const claudeMd = readText(join(home, '.claude', 'CLAUDE.md'));
  assert.match(claudeMd, /HELLOAGENTS_START/);
  assert.match(claudeMd, /skills\/helloagents\/skills\/commands/);
  assert.match(claudeMd, /# Claude custom/);

  const claudeSettings = readJson(join(home, '.claude', 'settings.json'));
  assert.ok(claudeSettings.permissions.allow.includes('Read(*)'));
  assert.ok(claudeSettings.permissions.allow.includes('Read(~/.claude/helloagents/**)'));
  assert.ok(claudeSettings.hooks.SessionStart.some((entry) => entry.matcher === 'keep'));
  assert.ok(claudeSettings.hooks.SessionStart.some((entry) => JSON.stringify(entry).includes('helloagents')));

  const geminiMd = readText(join(home, '.gemini', 'GEMINI.md'));
  assert.match(geminiMd, /HELLOAGENTS_START/);
  assert.match(geminiMd, /skills\/helloagents\/skills\/commands/);
  assert.match(geminiMd, /# Gemini custom/);
  assert.ok(readJson(join(home, '.gemini', 'settings.json')).hooks.BeforeAgent);

  const codexConfigPath = join(home, '.codex', 'config.toml');
  const codexConfig = readText(codexConfigPath);
  assert.match(codexConfig, /bootstrap-lite\.md/);
  assert.match(codexConfig, /codex-notify/);
  assert.match(codexConfig, /\[features\][\s\S]*codex_hooks = true/);
  assert.match(codexConfig, /experimental = true/);
  assert.ok(existsSync(`${codexConfigPath}.bak`));
  assert.equal(realTarget(join(home, '.claude', 'helloagents')), pkgRoot);
  assert.equal(realTarget(join(home, '.gemini', 'helloagents')), pkgRoot);
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), pkgRoot);

  writeText(join(pkgRoot, 'bootstrap-lite.md'), '# standby updated\n');
  assert.equal(readText(join(home, '.claude', 'helloagents', 'bootstrap-lite.md')), '# standby updated\n');

  runCli(pkgRoot, home, ['--global']);

  assert.equal(readJson(configFile).install_mode, 'global');
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')));

  const cleanedClaudeSettings = readJson(join(home, '.claude', 'settings.json'));
  assert.ok(cleanedClaudeSettings.permissions.allow.includes('Read(*)'));
  assert.ok(!cleanedClaudeSettings.permissions.allow.some((entry) => entry.includes('helloagents')));
  assert.ok(cleanedClaudeSettings.hooks.SessionStart.every((entry) => entry.matcher === 'keep'));

  const pluginRoot = join(home, 'plugins', 'helloagents');
  const pluginCacheRoot = join(home, '.codex', 'plugins', 'cache', 'local-plugins', 'helloagents', 'local');
  assert.ok(existsSync(pluginRoot));
  assert.ok(existsSync(pluginCacheRoot));
  assert.ok(existsSync(join(pluginRoot, 'README_CN.md')));

  const globalCodexConfig = readText(codexConfigPath);
  assert.match(globalCodexConfig, /plugins\/helloagents\/bootstrap\.md/);
  assert.match(globalCodexConfig, /plugins\/helloagents\/scripts\/notify\.mjs/);
  assert.match(globalCodexConfig, /\[plugins\."helloagents@local-plugins"\]\s+enabled = true/);

  const marketplace = readJson(join(home, '.agents', 'plugins', 'marketplace.json'));
  assert.ok(marketplace.plugins.some((plugin) => plugin.name === 'helloagents'));

  writeText(join(pkgRoot, 'bootstrap.md'), '# global updated\n');
  runCli(pkgRoot, home, ['--global']);
  assert.equal(readText(join(pluginRoot, 'bootstrap.md')), '# global updated\n');
  assert.equal(readText(join(pluginCacheRoot, 'bootstrap.md')), '# global updated\n');

  runCli(pkgRoot, home, ['--standby']);
  assert.equal(readJson(configFile).install_mode, 'standby');
  assert.ok(!existsSync(pluginRoot));
  assert.ok(!existsSync(pluginCacheRoot));
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
  assert.match(readText(codexConfigPath), /bootstrap-lite\.md/);
  assert.doesNotMatch(readText(codexConfigPath), /helloagents@local-plugins/);

  runCli(pkgRoot, home, ['preuninstall']);
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.gemini', 'GEMINI.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'hooks.json')));
  assert.ok(!existsSync(`${codexConfigPath}.bak`));
  assert.match(readText(codexConfigPath), /C:\/original\/bootstrap\.md/);
});

test('Codex global cleanup still removes marketplace and plugin roots when .codex is gone', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['postinstall']);
  runCli(pkgRoot, home, ['--global']);

  rmSync(join(home, '.codex'), { recursive: true, force: true });
  runCli(pkgRoot, home, ['preuninstall']);

  assert.ok(!existsSync(join(home, 'plugins', 'helloagents')));
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
});

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
  listFiles,
  runNode,
  writeJson,
  writeText,
} from './helpers/test-env.mjs';

import {
  CODEX_DEVELOPER_INSTRUCTIONS,
} from '../scripts/cli-codex.mjs';

function hasTimestampedBackup(home, baseName) {
  return listFiles(join(home, '.codex')).some((name) => new RegExp(`^${baseName}_\\d{8}-\\d{6}\\.bak$`).test(name));
}

function writeTimestampedBackup(home, baseName, content) {
  writeText(join(home, '.codex', `${baseName}_20260403-000000.bak`), content);
}

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
  const expectedCodexRuntimeRoot = join(home, '.codex', 'helloagents').replace(/\\/g, '/');

  runCli(pkgRoot, home, ['postinstall']);

  const configFile = join(home, '.helloagents', 'helloagents.json');
  assert.equal(readJson(configFile).install_mode, 'standby');
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.gemini', 'GEMINI.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));

  runCli(pkgRoot, home, ['install', '--all', '--standby']);

  const claudeMd = readText(join(home, '.claude', 'CLAUDE.md'));
  assert.match(claudeMd, /HELLOAGENTS_START/);
  assert.match(claudeMd, /skills\/helloagents\/skills\/commands/);
  assert.match(claudeMd, /当前已加载 HelloAGENTS 包根目录下的 skills\/commands/);
  assert.doesNotMatch(claudeMd, /当前CLI名称/);
  assert.doesNotMatch(claudeMd, /本文件所在目录\/skills\/commands/);
  assert.match(claudeMd, /# Claude custom/);

  const claudeSettings = readJson(join(home, '.claude', 'settings.json'));
  assert.ok(claudeSettings.permissions.allow.includes('Read(*)'));
  assert.ok(claudeSettings.permissions.allow.includes('Read(~/.claude/helloagents/**)'));
  assert.ok(claudeSettings.hooks.SessionStart.some((entry) => entry.matcher === 'keep'));
  assert.ok(claudeSettings.hooks.SessionStart.some((entry) => JSON.stringify(entry).includes('helloagents')));

  const geminiMd = readText(join(home, '.gemini', 'GEMINI.md'));
  assert.match(geminiMd, /HELLOAGENTS_START/);
  assert.match(geminiMd, /skills\/helloagents\/skills\/commands/);
  assert.match(geminiMd, /当前已加载 HelloAGENTS 包根目录下的 skills\/commands/);
  assert.doesNotMatch(geminiMd, /当前CLI名称/);
  assert.doesNotMatch(geminiMd, /本文件所在目录\/skills\/commands/);
  assert.match(geminiMd, /# Gemini custom/);
  assert.ok(readJson(join(home, '.gemini', 'settings.json')).hooks.BeforeAgent);

  const codexConfigPath = join(home, '.codex', 'config.toml');
  const codexConfig = readText(codexConfigPath);
  assert.match(codexConfig, /^developer_instructions = """/);
  assert.match(codexConfig, /\nnotify = \["node", ".*codex-notify"\]/);
  assert.doesNotMatch(codexConfig, /\[windows\][\s\S]*\nnotify = \[/);
  assert.match(codexConfig, /codex-notify/);
  assert.doesNotMatch(codexConfig, /codex_hooks = true/);
  assert.match(codexConfig, /experimental = true/);
  assert.doesNotMatch(codexConfig, /model_instructions_file\s*=\s*"[^"]*helloagents/i);
  assert.match(codexConfig, new RegExp(CODEX_DEVELOPER_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(!existsSync(join(home, '.codex', 'hooks.json')));
  const codexAgents = readText(join(home, '.codex', 'AGENTS.md'));
  assert.match(codexAgents, /HELLOAGENTS_START/);
  assert.match(codexAgents, /skills\/helloagents\/skills\/commands/);
  assert.match(codexAgents, /当前已加载 HelloAGENTS 包根目录下的 skills\/commands/);
  assert.match(codexAgents, new RegExp(expectedCodexRuntimeRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(codexAgents, /Codex 当前不启用 HelloAGENTS hooks/);
  assert.doesNotMatch(codexAgents, /当前CLI名称/);
  assert.doesNotMatch(codexAgents, /本文件所在目录\/skills\/commands/);
  assert.match(codexAgents, /# Codex custom/);
  assert.ok(hasTimestampedBackup(home, 'config.toml'));
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
  const expectedGlobalPluginRoot = pluginRoot.replace(/\\/g, '/');
  assert.ok(existsSync(pluginRoot));
  assert.ok(existsSync(pluginCacheRoot));
  assert.ok(existsSync(join(pluginRoot, 'README_CN.md')));
  assert.ok(existsSync(join(pluginRoot, 'AGENTS.md')));
  assert.ok(existsSync(join(pluginCacheRoot, 'AGENTS.md')));

  const globalCodexConfig = readText(codexConfigPath);
  assert.match(globalCodexConfig, /^developer_instructions = """/);
  assert.match(globalCodexConfig, /plugins\/helloagents\/scripts\/notify\.mjs/);
  assert.match(globalCodexConfig, /\[plugins\."helloagents@local-plugins"\]\s+enabled = true/);
  assert.doesNotMatch(globalCodexConfig, /codex_hooks = true/);
  assert.doesNotMatch(globalCodexConfig, /model_instructions_file\s*=\s*"[^"]*helloagents/i);
  assert.match(globalCodexConfig, new RegExp(CODEX_DEVELOPER_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const globalAgents = readText(join(pluginRoot, 'AGENTS.md'));
  assert.match(globalAgents, /# HelloAGENTS/);
  assert.match(globalAgents, new RegExp(expectedGlobalPluginRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(globalAgents, /Codex 当前不启用 HelloAGENTS hooks/);

  const marketplace = readJson(join(home, '.agents', 'plugins', 'marketplace.json'));
  assert.ok(marketplace.plugins.some((plugin) => plugin.name === 'helloagents'));

  writeText(join(pkgRoot, 'bootstrap.md'), '# global updated\n');
  runCli(pkgRoot, home, ['--global']);
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# global updated/);
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /Codex 当前不启用 HelloAGENTS hooks/);
  assert.match(readText(join(pluginCacheRoot, 'AGENTS.md')), /# global updated/);
  assert.match(readText(join(pluginCacheRoot, 'AGENTS.md')), /Codex 当前不启用 HelloAGENTS hooks/);

  runCli(pkgRoot, home, ['--standby']);
  assert.equal(readJson(configFile).install_mode, 'standby');
  assert.ok(!existsSync(pluginRoot));
  assert.ok(!existsSync(pluginCacheRoot));
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
  const restoredStandbyConfig = readText(codexConfigPath);
  assert.match(restoredStandbyConfig, /^developer_instructions = """/);
  assert.doesNotMatch(restoredStandbyConfig, /helloagents@local-plugins/);

  runCli(pkgRoot, home, ['preuninstall']);
  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.gemini', 'GEMINI.md')), /HELLOAGENTS_START/);
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.ok(!existsSync(join(home, '.codex', 'hooks.json')));
  assert.ok(!hasTimestampedBackup(home, 'config.toml'));
  const finalCodexConfig = readText(codexConfigPath);
  assert.match(finalCodexConfig, /C:\/original\/bootstrap\.md/);
  assert.doesNotMatch(finalCodexConfig, /developer_instructions\s*=/);
});

test('Codex global cleanup still removes marketplace and plugin roots when .codex is gone', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['postinstall']);
  runCli(pkgRoot, home, ['install', 'codex', '--standby']);
  runCli(pkgRoot, home, ['--global']);

  rmSync(join(home, '.codex'), { recursive: true, force: true });
  runCli(pkgRoot, home, ['preuninstall']);

  assert.ok(!existsSync(join(home, 'plugins', 'helloagents')));
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
});

test('Codex cleanup ignores contaminated backups and strips managed config lines', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      'unified_exec = true',
      '',
    ].join('\n'),
  );
  writeTimestampedBackup(
    home,
    'config.toml',
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'codex_hooks = true',
      '',
    ].join('\n'),
  );

  runCli(pkgRoot, home, ['cleanup']);

  const cleaned = readText(join(home, '.codex', 'config.toml'));
  assert.doesNotMatch(cleaned, /developer_instructions\s*=/);
  assert.doesNotMatch(cleaned, /codex-notify/);
  assert.doesNotMatch(cleaned, /codex_hooks = true/);
  assert.match(cleaned, /unified_exec = true/);
});

test('Codex standby preserves a user-owned model_instructions_file in backup and restores it on cleanup', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const userAgentsPath = join(home, '.codex', 'AGENTS.md').replace(/\\/g, '/');

  writeText(join(home, '.codex', 'AGENTS.md'), '# Codex custom\n');
  writeText(
    join(home, '.codex', 'config.toml'),
    `model_instructions_file = "${userAgentsPath}"\n`,
  );

  runCli(pkgRoot, home, ['postinstall']);
  runCli(pkgRoot, home, ['install', 'codex', '--standby']);

  const installedConfig = readText(join(home, '.codex', 'config.toml'));
  assert.match(installedConfig, /developer_instructions\s*=\s*"""/);
  assert.doesNotMatch(installedConfig, new RegExp(userAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(installedConfig.indexOf('developer_instructions = """') < installedConfig.indexOf('notify = ['));

  runCli(pkgRoot, home, ['cleanup']);

  assert.ok(!existsSync(join(home, '.codex', 'config.toml')));
  assert.equal(readText(join(home, '.codex', 'AGENTS.md')), '# Codex custom\n');
});

test('Codex standby preserves a user-owned developer_instructions block and restores it on cleanup', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      'user custom instructions',
      '"""',
      '[features]',
      'experimental = true',
      '',
    ].join('\n'),
  );

  runCli(pkgRoot, home, ['postinstall']);
  runCli(pkgRoot, home, ['install', 'codex', '--standby']);

  const installedConfig = readText(join(home, '.codex', 'config.toml'));
  assert.match(installedConfig, /developer_instructions\s*=\s*"""/);
  assert.match(installedConfig, new RegExp(CODEX_DEVELOPER_INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(hasTimestampedBackup(home, 'developer_instructions'));

  runCli(pkgRoot, home, ['cleanup']);

  const restoredConfig = readText(join(home, '.codex', 'config.toml'));
  assert.match(restoredConfig, /^developer_instructions = """\nuser custom instructions\n"""/);
  assert.ok(!hasTimestampedBackup(home, 'developer_instructions'));
});

test('Codex cleanup ignores contaminated developer_instructions backups', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();

  writeText(
    join(home, '.codex', 'config.toml'),
    [
      'developer_instructions = """',
      CODEX_DEVELOPER_INSTRUCTIONS,
      '"""',
      'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]',
      '',
      '[features]',
      'unified_exec = true',
      '',
    ].join('\n'),
  );
  writeTimestampedBackup(
    home,
    'developer_instructions',
    'notify = ["node", "D:/GitHub/dev/helloagents/scripts/notify.mjs", "codex-notify"]\n',
  );

  runCli(pkgRoot, home, ['cleanup', 'codex']);

  const cleaned = readText(join(home, '.codex', 'config.toml'));
  assert.doesNotMatch(cleaned, /^developer_instructions = \["node"/);
  assert.doesNotMatch(cleaned, /developer_instructions\s*=/);
  assert.doesNotMatch(cleaned, /codex-notify/);
  assert.match(cleaned, /unified_exec = true/);
  assert.ok(!hasTimestampedBackup(home, 'developer_instructions'));
});

test('single-host install and cleanup only touch the targeted CLI in standby mode by default', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const configFile = join(home, '.helloagents', 'helloagents.json');
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['install', 'claude']);

  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.ok(existsSync(join(home, '.claude', 'helloagents')));
  assert.doesNotMatch(readText(join(home, '.gemini', 'GEMINI.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')));
  assert.doesNotMatch(readText(join(home, '.codex', 'AGENTS.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.equal(readJson(configFile).host_install_modes.claude, 'standby');

  runCli(pkgRoot, home, ['cleanup', 'claude']);

  assert.doesNotMatch(readText(join(home, '.claude', 'CLAUDE.md')), /HELLOAGENTS_START/);
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')));
  assert.match(readText(join(home, '.gemini', 'GEMINI.md')), /# Gemini custom/);
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /# Codex custom/);
  assert.equal(readJson(configFile).host_install_modes.claude, undefined);
});

test('single-host update reuses tracked codex mode and cleanup leaves other CLIs intact', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const configFile = join(home, '.helloagents', 'helloagents.json');
  const pluginRoot = join(home, 'plugins', 'helloagents');
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['install', 'codex', '--global']);

  assert.ok(existsSync(pluginRoot));
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')));
  assert.equal(readJson(configFile).host_install_modes.codex, 'global');

  writeText(join(pkgRoot, 'bootstrap.md'), '# scoped global update\n');
  runCli(pkgRoot, home, ['update', 'codex']);
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# scoped global update/);

  runCli(pkgRoot, home, ['install', 'claude']);
  assert.ok(existsSync(join(home, '.claude', 'helloagents')));

  runCli(pkgRoot, home, ['cleanup', 'codex']);

  assert.ok(!existsSync(pluginRoot));
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
  assert.ok(existsSync(join(home, '.claude', 'helloagents')));
  assert.equal(readJson(configFile).host_install_modes.codex, undefined);
  assert.equal(readJson(configFile).host_install_modes.claude, 'standby');
});

test('single-host update infers the detected codex mode when tracked config is stale', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  const configFile = join(home, '.helloagents', 'helloagents.json');
  const pluginRoot = join(home, 'plugins', 'helloagents');
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['install', 'codex', '--global']);
  writeJson(configFile, {
    ...readJson(configFile),
    install_mode: 'standby',
    host_install_modes: {},
  });

  writeText(join(pkgRoot, 'bootstrap.md'), '# detected global refresh\n');
  runCli(pkgRoot, home, ['update', 'codex']);

  assert.ok(existsSync(pluginRoot));
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# detected global refresh/);
  assert.equal(readJson(configFile).host_install_modes.codex, 'global');
});

test('standby refresh updates injected carrier files for every CLI after bootstrap changes', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  seedHostConfigs(home);

  runCli(pkgRoot, home, ['install', '--all', '--standby']);

  writeText(join(pkgRoot, 'bootstrap-lite.md'), '# refreshed standby carrier\n');
  runCli(pkgRoot, home, ['update', '--all']);

  assert.match(readText(join(home, '.claude', 'CLAUDE.md')), /# refreshed standby carrier/);
  assert.match(readText(join(home, '.gemini', 'GEMINI.md')), /# refreshed standby carrier/);
  assert.match(readText(join(home, '.codex', 'AGENTS.md')), /# refreshed standby carrier/);
});

test('codex cleanup removes an empty local marketplace file left behind by prior global installs', () => {
  const { root: pkgRoot } = createPackageFixture();
  const home = createHomeFixture();
  seedHostConfigs(home);

  writeJson(join(home, '.agents', 'plugins', 'marketplace.json'), {
    name: 'local-plugins',
    interface: {
      displayName: 'Local Plugins',
    },
    plugins: [],
  });

  runCli(pkgRoot, home, ['cleanup', 'codex']);

  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')));
});

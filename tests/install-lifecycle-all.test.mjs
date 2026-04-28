import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { createHomeFixture, createPackageFixture, readJson, readText, realTarget, writeText } from './helpers/test-env.mjs'
import { hasTimestampedBackup, runCli, seedHostConfigs } from './helpers/cli-test-helpers.mjs'

test('CLI lifecycle covers standby, global, update, cleanup, and config preservation', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const runtimeRoot = join(home, '.helloagents', 'helloagents')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'])

  const configFile = join(home, '.helloagents', 'helloagents.json')
  assert.equal(readJson(configFile).install_mode, 'standby')
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')))

  runCli(pkgRoot, home, ['install', '--all', '--standby'])

  const claudeMd = readText(join(home, '.claude', 'CLAUDE.md'))
  assert.match(claudeMd, /HELLOAGENTS_START/)
  assert.match(claudeMd, /稳定运行根目录 `~\/\.helloagents\/helloagents`/)
  assert.match(claudeMd, /不要递归扫描 `\$HOME`、`Downloads`、项目目录或旧版本目录/)
  assert.match(claudeMd, /# Claude custom/)

  const geminiMd = readText(join(home, '.gemini', 'GEMINI.md'))
  assert.match(geminiMd, /HELLOAGENTS_START/)
  assert.match(geminiMd, /# Gemini custom/)

  const claudeSettingsText = JSON.stringify(readJson(join(home, '.claude', 'settings.json')))
  const geminiSettingsText = JSON.stringify(readJson(join(home, '.gemini', 'settings.json')))
  assert.match(claudeSettingsText, /helloagents-js notify/)
  assert.match(claudeSettingsText, /helloagents-js guard/)
  assert.doesNotMatch(claudeSettingsText, /scripts\/notify\.mjs/)
  assert.match(geminiSettingsText, /helloagents-js notify/)
  assert.match(geminiSettingsText, /helloagents-js guard/)
  assert.doesNotMatch(geminiSettingsText, /scripts\/notify\.mjs/)

  const codexConfigPath = join(home, '.codex', 'config.toml')
  const codexConfig = readText(codexConfigPath)
  assert.match(codexConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)
  assert.doesNotMatch(codexConfig, /developer_instructions\s*=/)
  assert.match(codexConfig, /codex-notify/)
  assert.match(codexConfig, /^model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed\nnotify = \["helloagents-js", "codex-notify"\] # helloagents-managed\n\n\[features\]\nexperimental = true\n/m)
  assert.ok(hasTimestampedBackup(home, 'config.toml'))
  assert.equal(realTarget(join(home, '.claude', 'helloagents')), runtimeRoot)
  assert.equal(realTarget(join(home, '.gemini', 'helloagents')), runtimeRoot)
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), runtimeRoot)

  writeText(join(runtimeRoot, 'bootstrap-lite.md'), '# standby updated\n')
  assert.equal(readText(join(home, '.claude', 'helloagents', 'bootstrap-lite.md')), '# standby updated\n')

  runCli(pkgRoot, home, ['--global'])

  assert.equal(readJson(configFile).install_mode, 'global')
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))

  const pluginRoot = join(home, 'plugins', 'helloagents')
  const pluginCacheRoot = join(home, '.codex', 'plugins', 'cache', 'local-plugins', 'helloagents', 'local')
  assert.ok(existsSync(pluginRoot))
  assert.ok(existsSync(pluginCacheRoot))
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), pluginRoot)
  assert.ok(existsSync(join(pluginRoot, 'AGENTS.md')))
  assert.ok(existsSync(join(pluginCacheRoot, 'AGENTS.md')))

  const globalCodexConfig = readText(codexConfigPath)
  assert.match(globalCodexConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)
  assert.match(globalCodexConfig, /^model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed\nnotify = \["helloagents-js", "codex-notify"\] # helloagents-managed\n\n\[features\]\nexperimental = true\n/m)
  assert.match(globalCodexConfig, /\[plugins\."helloagents@local-plugins"\]\s+enabled = true/)
  assert.doesNotMatch(globalCodexConfig, /developer_instructions\s*=/)

  writeText(join(pkgRoot, 'bootstrap.md'), '# global updated\n')
  runCli(pkgRoot, home, ['--global'])
  assert.match(readText(join(pluginRoot, 'AGENTS.md')), /# global updated/)
  assert.match(readText(join(pluginCacheRoot, 'AGENTS.md')), /# global updated/)

  runCli(pkgRoot, home, ['--standby'])
  assert.equal(readJson(configFile).install_mode, 'standby')
  assert.ok(!existsSync(pluginRoot))
  assert.ok(!existsSync(pluginCacheRoot))
  assert.ok(!existsSync(join(home, '.agents', 'plugins', 'marketplace.json')))
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), runtimeRoot)

  runCli(pkgRoot, home, ['preuninstall'])
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')))
  assert.ok(!hasTimestampedBackup(home, 'config.toml'))
  const finalCodexConfig = readText(codexConfigPath)
  assert.match(finalCodexConfig, /C:\/original\/bootstrap\.md/)
  assert.match(finalCodexConfig, /notify = \["node", "C:\/original\/notify\.mjs", "codex-notify"\]/)
  assert.doesNotMatch(finalCodexConfig, /developer_instructions\s*=/)
})

test('postinstall can deploy a selected host from npm environment variables', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const runtimeRoot = join(home, '.helloagents', 'helloagents')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'], {
    HELLOAGENTS_DEPLOY: '1',
    HELLOAGENTS_TARGET: 'claude',
    HELLOAGENTS_MODE: 'standby',
  })

  assert.ok(existsSync(join(home, '.claude', 'helloagents')))
  assert.equal(realTarget(join(home, '.claude', 'helloagents')), runtimeRoot)
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')))
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.claude, 'standby')
})

test('postinstall can deploy from compact HELLOAGENTS spec', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'], {
    HELLOAGENTS: 'codex:global',
  })

  const pluginRoot = join(home, 'plugins', 'helloagents')
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(existsSync(pluginRoot))
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), pluginRoot)
  assert.equal(readJson(join(home, '.helloagents', 'helloagents.json')).host_install_modes.codex, 'global')
})

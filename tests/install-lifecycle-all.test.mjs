import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { createHomeFixture, createPackageFixture, readJson, readText, realTarget, writeText } from './helpers/test-env.mjs'
import { hasTimestampedBackup, runCli, seedHostConfigs } from './helpers/cli-test-helpers.mjs'

test('CLI lifecycle covers standby, global, update, cleanup, and config preservation', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
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
  assert.match(claudeMd, /当前宿主 home 目录下的 `helloagents\/` 链接作为 `{HELLOAGENTS_READ_ROOT}`/)
  assert.match(claudeMd, /# Claude custom/)

  const geminiMd = readText(join(home, '.gemini', 'GEMINI.md'))
  assert.match(geminiMd, /HELLOAGENTS_START/)
  assert.match(geminiMd, /# Gemini custom/)

  const codexConfigPath = join(home, '.codex', 'config.toml')
  const codexAgentsPath = join(home, '.codex', 'AGENTS.md').replace(/\\/g, '/')
  const codexConfig = readText(codexConfigPath)
  assert.match(codexConfig, new RegExp(`model_instructions_file = "${codexAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.doesNotMatch(codexConfig, /developer_instructions\s*=/)
  assert.match(codexConfig, /codex-notify/)
  assert.match(codexConfig, /^model_instructions_file = ".*\/\.codex\/AGENTS\.md" # helloagents-managed\nnotify = \["node", ".*\/scripts\/notify\.mjs", "codex-notify"\]\n\n\[features\]\nexperimental = true\n/m)
  assert.ok(hasTimestampedBackup(home, 'config.toml'))
  assert.equal(realTarget(join(home, '.claude', 'helloagents')), pkgRoot)
  assert.equal(realTarget(join(home, '.gemini', 'helloagents')), pkgRoot)
  assert.equal(realTarget(join(home, '.codex', 'helloagents')), pkgRoot)

  writeText(join(pkgRoot, 'bootstrap-lite.md'), '# standby updated\n')
  assert.equal(readText(join(home, '.claude', 'helloagents', 'bootstrap-lite.md')), '# standby updated\n')

  runCli(pkgRoot, home, ['--global'])

  assert.equal(readJson(configFile).install_mode, 'global')
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))

  const pluginRoot = join(home, 'plugins', 'helloagents')
  const pluginCacheRoot = join(home, '.codex', 'plugins', 'cache', 'local-plugins', 'helloagents', 'local')
  assert.ok(existsSync(pluginRoot))
  assert.ok(existsSync(pluginCacheRoot))
  assert.ok(existsSync(join(pluginRoot, 'AGENTS.md')))
  assert.ok(existsSync(join(pluginCacheRoot, 'AGENTS.md')))

  const globalCodexConfig = readText(codexConfigPath)
  assert.match(globalCodexConfig, new RegExp(`model_instructions_file = "${codexAgentsPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(globalCodexConfig, /plugins\/helloagents\/scripts\/notify\.mjs/)
  assert.match(globalCodexConfig, /^model_instructions_file = ".*\/\.codex\/AGENTS\.md" # helloagents-managed\nnotify = \["node", ".*\/plugins\/helloagents\/scripts\/notify\.mjs", "codex-notify"\]\n\n\[features\]\nexperimental = true\n/m)
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

  runCli(pkgRoot, home, ['preuninstall'])
  assert.ok(!existsSync(join(home, '.claude', 'helloagents')))
  assert.ok(!existsSync(join(home, '.gemini', 'helloagents')))
  assert.ok(!existsSync(join(home, '.codex', 'helloagents')))
  assert.ok(!hasTimestampedBackup(home, 'config.toml'))
  const finalCodexConfig = readText(codexConfigPath)
  assert.match(finalCodexConfig, /C:\/original\/bootstrap\.md/)
  assert.doesNotMatch(finalCodexConfig, /developer_instructions\s*=/)
})

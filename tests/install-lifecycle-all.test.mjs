import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { CODEX_MANAGED_NOTIFY_VALUE } from '../scripts/cli-codex-config.mjs'
import { createHomeFixture, createPackageFixture, readJson, readText, realTarget, writeJson, writeText } from './helpers/test-env.mjs'
import { hasTimestampedBackup, runCli, seedHostConfigs } from './helpers/cli-test-helpers.mjs'

const MANAGED_NOTIFY_LINE = `notify = ${CODEX_MANAGED_NOTIFY_VALUE} # helloagents-managed`

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
  assert.doesNotMatch(claudeMd, /## 当前用户设置/)
  assert.match(claudeMd, /# Claude custom/)

  const geminiMd = readText(join(home, '.gemini', 'GEMINI.md'))
  assert.match(geminiMd, /HELLOAGENTS_START/)
  assert.doesNotMatch(geminiMd, /## 当前用户设置/)
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
  const codexAgents = readText(join(home, '.codex', 'AGENTS.md'))
  assert.doesNotMatch(codexAgents, /## 当前用户设置/)
  const codexConfig = readText(codexConfigPath)
  assert.match(codexConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)
  assert.doesNotMatch(codexConfig, /developer_instructions\s*=/)
  assert.match(codexConfig, /codex-notify/)
  assert.match(codexConfig, /\[tui\]\nnotifications = \["plan-mode-prompt"\] # helloagents-managed/)
  assert.ok(codexConfig.startsWith([
    'model_instructions_file = "~/.codex/AGENTS.md" # helloagents-managed',
    MANAGED_NOTIFY_LINE,
    '',
    '[features]',
    'experimental = true',
    '',
  ].join('\n')), codexConfig)
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
  assert.doesNotMatch(readText(join(pluginRoot, 'AGENTS.md')), /## 当前用户设置/)
  assert.doesNotMatch(readText(join(pluginCacheRoot, 'AGENTS.md')), /## 当前用户设置/)

  const globalCodexConfig = readText(codexConfigPath)
  assert.match(globalCodexConfig, /model_instructions_file = "~\/\.codex\/AGENTS\.md" # helloagents-managed/)
  assert.match(globalCodexConfig, /\[tui\]\nnotifications = \["plan-mode-prompt"\] # helloagents-managed/)
  assert.ok(globalCodexConfig.startsWith([
    'model_instructions_file = "~/.codex/AGENTS.md" # helloagents-managed',
    MANAGED_NOTIFY_LINE,
    '',
    '[features]',
    'experimental = true',
    '',
  ].join('\n')), globalCodexConfig)
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
  assert.doesNotMatch(finalCodexConfig, /plan-mode-prompt/)
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

test('runtime carrier does not snapshot helloagents config into persistent rules files', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  seedHostConfigs(home)

  writeJson(join(home, '.helloagents', 'helloagents.json'), {
    output_format: false,
    output_language: 'zh-CN',
  })

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['install', 'codex', '--standby'])

  const codexAgents = readText(join(home, '.codex', 'AGENTS.md'))
  assert.doesNotMatch(codexAgents, /## 当前用户设置/)
  assert.doesNotMatch(codexAgents, /"output_format": false/)
  assert.match(codexAgents, /输出格式只在缺少 `output_format` 已知值时触发读取/)
})

test('global mode switch records only successful host setup', () => {
  const { root: pkgRoot } = createPackageFixture()
  const home = createHomeFixture()
  const configFile = join(home, '.helloagents', 'helloagents.json')
  seedHostConfigs(home)

  runCli(pkgRoot, home, ['postinstall'])
  runCli(pkgRoot, home, ['--global'], {
    HELLOAGENTS_CLAUDE_CMD: join(home, 'missing-claude.cmd'),
    HELLOAGENTS_GEMINI_CMD: join(home, 'missing-gemini.cmd'),
  })

  const settings = readJson(configFile)
  assert.equal(settings.install_mode, 'global')
  assert.equal(settings.host_install_modes.claude, undefined)
  assert.equal(settings.host_install_modes.gemini, undefined)
  assert.equal(settings.host_install_modes.codex, 'global')
})

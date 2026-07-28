import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileExists, readJson, readText, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { hasMarkedBlock, readMarkedVersion } from '../../src/kernel/ownership.mjs'
import { findHost } from '../../src/hosts/registry.mjs'
import { runInstall, runUninstall, runUpdate } from '../../src/cli/install.mjs'
import { HOSTS } from '../../src/hosts/registry.mjs'
import { PACKAGE_VERSION, makeCtx, makeFakeHome } from '../helpers/env.mjs'

/** @param {string} id */
function host(id) {
  const found = findHost(id)
  assert.ok(found)
  return found
}

test('标准模式安装：载体写入内核，安装状态记录，重复安装幂等', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    const targets = [host('claude'), host('codex'), host('grok')]

    runInstall(ctx, targets, 'standard')
    runInstall(ctx, targets, 'standard')

    for (const target of targets) {
      const carrier = target.carrierPath(home)
      assert.ok(carrier && hasMarkedBlock(carrier), target.id)
      assert.equal(readMarkedVersion(carrier ?? ''), PACKAGE_VERSION, target.id)
      const text = readText(carrier ?? '') ?? ''
      assert.equal(text.split('HELLOAGENTS_START').length - 1, 1, `${target.id} 只应有一个受管块`)
      assert.ok(text.includes('简单优先'), `${target.id} 载体应包含内核内容`)
    }

    const state = /** @type {{ hosts: Record<string, { mode: string }> }} */ (
      readJson(join(home, '.helloagents', 'install.json'))
    )
    assert.equal(Object.keys(state.hosts).length, 3)
    assert.equal(state.hosts.claude?.mode, 'standard')
    assert.ok(fileExists(join(home, '.helloagents', 'app', 'prompts', 'kernel.md')))
    assert.ok(fileExists(join(home, '.helloagents', 'app', 'skills', 'hello-plan', 'SKILL.md')))
  } finally {
    cleanup()
  }
})

test('标准模式保留用户已有内容，卸载后完整还原', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    const carrier = host('claude').carrierPath(home) ?? ''
    writeTextAtomic(carrier, '# 我的个人规则\n\n重要内容。\n')

    runInstall(ctx, [host('claude')], 'standard')
    assert.ok((readText(carrier) ?? '').includes('# 我的个人规则'))

    runUninstall(ctx, [host('claude')], { all: true, purge: false })
    assert.equal(readText(carrier), '# 我的个人规则\n\n重要内容。\n')
    assert.equal(fileExists(join(home, '.helloagents', 'app')), false)
  } finally {
    cleanup()
  }
})

test('cursor 标准模式创建软链接与 hooks，全局模式下发清单、技能与内核规则', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx, lines } = makeCtx(home)
    runInstall(ctx, [host('cursor')], 'standard')
    // 标准模式：Cursor 无载体文件，但创建软链接和 hooks
    assert.ok(fileExists(join(home, '.cursor', 'helloagents')))
    assert.ok(fileExists(join(home, '.cursor', 'hooks.json')))

    runInstall(ctx, [host('cursor')], 'global')
    const pluginDir = join(home, '.cursor', 'plugins', 'local', 'helloagents')
    assert.ok(fileExists(join(pluginDir, '.cursor-plugin', 'plugin.json')))
    assert.ok(fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md')))

    const rule = readText(join(pluginDir, 'rules', 'helloagents-kernel.mdc')) ?? ''
    assert.ok(rule.startsWith('---\nalwaysApply: true\n---\n'), '规则文件缺少 alwaysApply frontmatter')
    assert.ok(!rule.includes('description:'), 'Cursor 缺陷：alwaysApply 与 description 同时存在会被降级')
    assert.ok(rule.includes('简单优先'), '规则文件应包含内核正文')

    // 插件目录只放 Cursor 认识的东西，运行副本的 CLI 与资源不进去。
    for (const noise of ['src', 'cli.mjs', 'assets', 'package.json', '.claude-plugin']) {
      assert.equal(fileExists(join(pluginDir, noise)), false, `插件目录不应包含 ${noise}`)
    }

    runUninstall(ctx, [host('cursor')], { all: false, purge: false })
    assert.equal(fileExists(pluginDir), false, '卸载后插件目录应被完整移除')
  } finally {
    cleanup()
  }
})

test('cursor 全局模式随 update 刷新到当前版本', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('cursor')], 'global')
    const ruleFile = join(home, '.cursor', 'plugins', 'local', 'helloagents', 'rules', 'helloagents-kernel.mdc')
    writeTextAtomic(ruleFile, '---\nalwaysApply: true\n---\n\n过期内容\n')

    runUpdate(ctx, HOSTS)
    assert.ok((readText(ruleFile) ?? '').includes('简单优先'))
  } finally {
    cleanup()
  }
})

test('update 刷新载体版本与运行副本', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('codex')], 'standard')

    const carrier = host('codex').carrierPath(home) ?? ''
    writeTextAtomic(
      carrier,
      (readText(carrier) ?? '').replace(`HelloAGENTS v${PACKAGE_VERSION}`, 'HelloAGENTS v3.9.9'),
    )
    assert.equal(readMarkedVersion(carrier), '3.9.9')

    runUpdate(ctx, HOSTS)
    assert.equal(readMarkedVersion(carrier), PACKAGE_VERSION)
  } finally {
    cleanup()
  }
})

test('codex 全局模式：写入插件快照、市场索引与 config 启用项', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('codex')], 'global')

    const pluginDir = join(home, 'plugins', 'helloagents')
    assert.ok(fileExists(join(pluginDir, '.codex-plugin', 'plugin.json')))
    assert.ok(fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md')))

    const marketplace = /** @type {{ plugins?: Array<{ name?: string }> } | null} */ (
      readJson(join(home, '.agents', 'plugins', 'marketplace.json'))
    )
    assert.ok(marketplace?.plugins?.some((entry) => entry.name === 'helloagents'))

    const config = readText(join(home, '.codex', 'config.toml')) ?? ''
    assert.ok(config.includes('[plugins."helloagents@local-plugins"]'))

    // 内核仍写入标准载体（可叠加）。
    const carrier = host('codex').carrierPath(home) ?? ''
    assert.ok(hasMarkedBlock(carrier))

    const state = /** @type {{ hosts: Record<string, { mode: string }> }} */ (
      readJson(join(home, '.helloagents', 'install.json'))
    )
    assert.equal(state.hosts.codex?.mode, 'global')

    runUninstall(ctx, [host('codex')], { all: false, purge: false })
    assert.equal(fileExists(pluginDir), false)
    assert.equal((readText(join(home, '.codex', 'config.toml')) ?? '').includes('helloagents@local-plugins'), false)
  } finally {
    cleanup()
  }
})

test('grok 全局模式：写入原生 local-marketplaces 市场快照', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('grok')], 'global')

    const marketRoot = join(home, '.grok', 'local-marketplaces', 'helloagents-marketplace')
    const pluginDir = join(marketRoot, 'plugins', 'helloagents')
    assert.ok(fileExists(join(marketRoot, '.grok-plugin', 'marketplace.json')))
    assert.ok(fileExists(join(pluginDir, 'plugin.json')))
    assert.ok(fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md')))
    assert.ok(hasMarkedBlock(host('grok').carrierPath(home) ?? ''))

    const config = readText(join(home, '.grok', 'config.toml')) ?? ''
    assert.ok(config.includes('helloagents-marketplace'))
    assert.ok(config.includes('[[marketplace.sources]]'))

    const state = /** @type {{ hosts: Record<string, { mode: string }> }} */ (
      readJson(join(home, '.helloagents', 'install.json'))
    )
    assert.equal(state.hosts.grok?.mode, 'global')

    runUninstall(ctx, [host('grok')], { all: false, purge: false })
    assert.equal(fileExists(pluginDir), false)
    assert.equal(fileExists(marketRoot), false)
  } finally {
    cleanup()
  }
})

test('claude 全局模式：写入 local-marketplaces 市场快照', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('claude')], 'global')

    const marketRoot = join(home, '.claude', 'plugins', 'local-marketplaces', 'helloagents-marketplace')
    const pluginDir = join(marketRoot, 'plugins', 'helloagents')
    assert.ok(fileExists(join(marketRoot, '.claude-plugin', 'marketplace.json')))
    assert.ok(fileExists(join(pluginDir, '.claude-plugin', 'plugin.json')))
    assert.ok(fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md')))
    assert.ok(hasMarkedBlock(host('claude').carrierPath(home) ?? ''))

    const state = /** @type {{ hosts: Record<string, { mode: string }> }} */ (
      readJson(join(home, '.helloagents', 'install.json'))
    )
    assert.equal(state.hosts.claude?.mode, 'global')

    runUninstall(ctx, [host('claude')], { all: false, purge: false })
    assert.equal(fileExists(pluginDir), false)
    assert.equal(fileExists(marketRoot), false)
  } finally {
    cleanup()
  }
})

test('hermes 全局模式：local-plugins 快照 + external_dirs 登记', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('hermes')], 'global')

    const pluginDir = join(home, '.hermes', 'local-plugins', 'helloagents')
    assert.ok(fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md')))
    assert.ok(fileExists(join(home, '.hermes', 'local-plugins', '.helloagents-installed.json')))

    const config = readText(join(home, '.hermes', 'config.yaml')) ?? ''
    assert.ok(config.includes('external_dirs:'))
    assert.ok(config.includes('helloagents') || config.includes('skills'))

    const state = /** @type {{ hosts: Record<string, { mode: string }> }} */ (
      readJson(join(home, '.helloagents', 'install.json'))
    )
    assert.equal(state.hosts.hermes?.mode, 'global')

    runUninstall(ctx, [host('hermes')], { all: false, purge: false })
    assert.equal(fileExists(pluginDir), false)
    assert.equal(fileExists(join(home, '.hermes', 'local-plugins', '.helloagents-installed.json')), false)
  } finally {
    cleanup()
  }
})

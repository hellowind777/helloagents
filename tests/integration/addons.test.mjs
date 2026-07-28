import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { readInstallState, writeInstallState } from '../../src/kernel/config.mjs'
import { readJson, readText, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { codexNotifyTopLevelState } from '../../src/hosts/codex-config.mjs'
import { findHost } from '../../src/hosts/registry.mjs'
import { applyAddon } from '../../src/cli/addons.mjs'
import { runInstall } from '../../src/cli/install.mjs'
import { makeCtx, makeFakeHome } from '../helpers/env.mjs'

/** @param {string} id */
function host(id) {
  const found = findHost(id)
  assert.ok(found)
  return found
}

/**
 * @param {import('../../src/cli/main.mjs').CliContext} ctx
 * @param {string} hostId
 * @param {'guard' | 'notify'} addon
 * @param {boolean} enable
 */
function toggle(ctx, hostId, addon, enable) {
  const state = readInstallState(ctx.home)
  const list = state.addons[addon]
  state.addons[addon] = enable ? [...new Set([...list, hostId])] : list.filter((id) => id !== hostId)
  const result = applyAddon(ctx, host(hostId), addon, enable, {
    guard: state.addons.guard.includes(hostId),
    notify: state.addons.notify.includes(hostId),
  })
  writeInstallState(ctx.home, state)
  return result
}

test('claude：guard 与 notify 写入 settings.json，停用后干净移除', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('claude')], 'standard')
    const settingsPath = join(home, '.claude', 'settings.json')
    writeTextAtomic(settingsPath, `${JSON.stringify({ model: 'opus' }, null, 2)}\n`)

    assert.equal(toggle(ctx, 'claude', 'guard', true).status, 'enabled')
    assert.equal(toggle(ctx, 'claude', 'notify', true).status, 'enabled')

    const settings = /** @type {{ model: string, hooks: Record<string, unknown[]> }} */ (
      readJson(settingsPath)
    )
    assert.equal(settings.model, 'opus')
    assert.equal(settings.hooks.PreToolUse?.length, 1)
    assert.equal(settings.hooks.Stop?.length, 1)
    assert.equal(settings.hooks.Notification?.length, 1)
    assert.ok(JSON.stringify(settings).includes('/src/addons/guard.mjs'))

    assert.equal(toggle(ctx, 'claude', 'guard', false).status, 'disabled')
    assert.equal(toggle(ctx, 'claude', 'notify', false).status, 'disabled')
    const after = /** @type {{ model: string, hooks?: unknown }} */ (readJson(settingsPath))
    assert.equal(after.model, 'opus')
    assert.equal(after.hooks, undefined)
  } finally {
    cleanup()
  }
})

test('grok：附加组件共用独立 hooks 文件，全部停用后文件删除', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('grok')], 'standard')
    const hooksPath = join(home, '.grok', 'hooks', 'helloagents.json')

    toggle(ctx, 'grok', 'guard', true)
    toggle(ctx, 'grok', 'notify', true)
    const config = /** @type {{ hooks: Record<string, unknown> }} */ (readJson(hooksPath))
    assert.ok(config.hooks.PreToolUse)
    assert.ok(config.hooks.Stop)

    toggle(ctx, 'grok', 'guard', false)
    const guardOff = /** @type {{ hooks: Record<string, unknown> }} */ (readJson(hooksPath))
    assert.equal(guardOff.hooks.PreToolUse, undefined)
    assert.ok(guardOff.hooks.Stop)

    toggle(ctx, 'grok', 'notify', false)
    assert.equal(readText(hooksPath), null)
  } finally {
    cleanup()
  }
})

test('cursor：hooks.json 中的用户条目不受影响', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('cursor')], 'global')
    const hooksPath = join(home, '.cursor', 'hooks.json')
    writeTextAtomic(
      hooksPath,
      `${JSON.stringify({ version: 1, hooks: { stop: [{ command: 'node /home/user/mine.mjs' }] } }, null, 2)}\n`,
    )

    toggle(ctx, 'cursor', 'guard', true)
    toggle(ctx, 'cursor', 'notify', true)
    const config = /** @type {{ hooks: Record<string, unknown[]> }} */ (readJson(hooksPath))
    assert.equal(config.hooks.preToolUse?.length, 1)
    assert.equal(config.hooks.stop?.length, 2)

    toggle(ctx, 'cursor', 'notify', false)
    const after = /** @type {{ hooks: Record<string, unknown[]> }} */ (readJson(hooksPath))
    assert.equal(after.hooks.stop?.length, 1)
    assert.ok(JSON.stringify(after.hooks.stop).includes('mine.mjs'))
  } finally {
    cleanup()
  }
})

test('codex：notify 写入受管行；用户已有配置时拒绝并保持原样', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    runInstall(ctx, [host('codex')], 'standard')
    const configPath = join(home, '.codex', 'config.toml')

    assert.equal(toggle(ctx, 'codex', 'notify', true).status, 'enabled')
    assert.equal(codexNotifyTopLevelState(readText(configPath)), 'managed')
    assert.equal(toggle(ctx, 'codex', 'notify', false).status, 'disabled')
    assert.equal(codexNotifyTopLevelState(readText(configPath)), 'none')

    writeTextAtomic(configPath, 'notify = ["my-notifier"]\n')
    const blocked = toggle(ctx, 'codex', 'notify', true)
    assert.equal(blocked.status, 'blocked')
    assert.equal(readText(configPath), 'notify = ["my-notifier"]\n')
  } finally {
    cleanup()
  }
})

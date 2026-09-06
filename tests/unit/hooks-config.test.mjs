import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJson, writeJsonAtomic } from '../../src/kernel/fsx.mjs'
import { appDir, toPosix } from '../../src/kernel/paths.mjs'
import {
  removeCursorHooks,
  removeSettingsHooks,
  upsertCursorHooks,
  upsertSettingsHooks,
} from '../../src/hosts/hooks-config.mjs'

function withTempDir(/** @type {(dir: string) => void} */ run) {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-hooks-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const HOME = '/home/tester'
const OWNED_COMMAND = `node "${toPosix(appDir(HOME))}/src/addons/guard.mjs" --host claude`

function ownedEntry() {
  return {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: OWNED_COMMAND, timeout: 5 }] },
    ],
  }
}

test('settings 形态：写入幂等，用户条目保留', () => {
  withTempDir((dir) => {
    const settingsPath = join(dir, 'settings.json')
    writeJsonAtomic(settingsPath, {
      permissions: { allow: ['Read'] },
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'node /home/tester/my-hook.mjs' }] },
        ],
      },
    })

    upsertSettingsHooks(settingsPath, ownedEntry(), { home: HOME })
    upsertSettingsHooks(settingsPath, ownedEntry(), { home: HOME })

    const settings = /** @type {{ permissions: object, hooks: { PreToolUse: unknown[] } }} */ (
      readJson(settingsPath)
    )
    assert.deepEqual(settings.permissions, { allow: ['Read'] })
    assert.equal(settings.hooks.PreToolUse.length, 2)
    assert.equal(JSON.stringify(settings).split('guard.mjs').length - 1, 1)
  })
})

test('settings 形态：只移除受管条目，事件清空后删除键', () => {
  withTempDir((dir) => {
    const settingsPath = join(dir, 'settings.json')
    upsertSettingsHooks(settingsPath, ownedEntry(), { home: HOME })
    const removed = removeSettingsHooks(settingsPath, { home: HOME })
    assert.equal(removed, 1)
    const settings = /** @type {Record<string, unknown> | null} */ (readJson(settingsPath))
    assert.equal(settings === null || settings.hooks === undefined, true)
  })
})

test('legacyOnly 只清理 3.x 条目，不动 4.x 条目', () => {
  withTempDir((dir) => {
    const settingsPath = join(dir, 'settings.json')
    writeJsonAtomic(settingsPath, {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/guard.mjs"' }],
          },
        ],
      },
    })
    upsertSettingsHooks(settingsPath, ownedEntry(), { home: HOME })

    const removed = removeSettingsHooks(settingsPath, { home: HOME, legacyOnly: true })
    assert.equal(removed, 1)
    const text = JSON.stringify(readJson(settingsPath))
    assert.ok(text.includes('guard.mjs'))
    assert.ok(!text.includes('CLAUDE_PLUGIN_ROOT'))
  })
})

test('cursor 形态：写入与移除按附加组件区分', () => {
  withTempDir((dir) => {
    const hooksPath = join(dir, 'hooks.json')
    const app = toPosix(appDir(HOME))
    upsertCursorHooks(
      hooksPath,
      { preToolUse: [{ command: `node "${app}/src/addons/guard.mjs" --host cursor`, timeout: 5 }] },
      { home: HOME, commandFilter: '/guard.mjs' },
    )
    upsertCursorHooks(
      hooksPath,
      { stop: [{ command: `node "${app}/src/addons/notify.mjs" stop --host cursor`, timeout: 10 }] },
      { home: HOME, commandFilter: '/notify.mjs' },
    )

    removeCursorHooks(hooksPath, { home: HOME, commandFilter: '/guard.mjs' })
    const config = /** @type {{ hooks: Record<string, unknown[]> }} */ (readJson(hooksPath))
    assert.equal(config.hooks.preToolUse, undefined)
    assert.equal(config.hooks.stop?.length, 1)
  })
})

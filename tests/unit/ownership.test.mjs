import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readText, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import {
  buildMarkedBlock,
  hasMarkedBlock,
  isLegacyHookCommand,
  isOwnedHookCommand,
  readMarkedVersion,
  removeMarkedBlock,
  upsertMarkedBlock,
} from '../../src/kernel/ownership.mjs'
import { appDir } from '../../src/kernel/paths.mjs'

function withTempDir(/** @type {(dir: string) => void} */ run) {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-ownership-'))
  try {
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('标记块的写入、替换与版本读取', () => {
  withTempDir((dir) => {
    const file = join(dir, 'CLAUDE.md')
    assert.equal(upsertMarkedBlock(file, buildMarkedBlock('内核内容', '4.0.0')), 'created')
    assert.equal(readMarkedVersion(file), '4.0.0')

    assert.equal(upsertMarkedBlock(file, buildMarkedBlock('新内核', '4.0.1')), 'replaced')
    const text = readText(file) ?? ''
    assert.ok(text.includes('新内核'))
    assert.ok(!text.includes('内核内容'))
    assert.equal(readMarkedVersion(file), '4.0.1')
  })
})

test('用户内容在注入与移除后保持原样', () => {
  withTempDir((dir) => {
    const file = join(dir, 'AGENTS.md')
    writeTextAtomic(file, '# 用户自己的规则\n\n保持不动。\n')
    assert.equal(upsertMarkedBlock(file, buildMarkedBlock('内核', '4.0.0')), 'appended')
    assert.ok(hasMarkedBlock(file))

    assert.equal(removeMarkedBlock(file), true)
    assert.equal(readText(file), '# 用户自己的规则\n\n保持不动。\n')
    assert.equal(removeMarkedBlock(file), false)
  })
})

test('只包含受管内容的文件在移除后被删除', () => {
  withTempDir((dir) => {
    const file = join(dir, 'AGENTS.md')
    upsertMarkedBlock(file, buildMarkedBlock('内核', '4.0.0'))
    removeMarkedBlock(file)
    assert.equal(readText(file), null)
  })
})

test('hooks 命令归属：按运行副本路径判断，而不是字符串嗅探', () => {
  const home = '/home/tester'
  const owned = `node "${appDir(home).replaceAll('\\', '/')}/src/addons/guard.mjs" --host claude`
  assert.equal(isOwnedHookCommand(owned, home), true)
  assert.equal(isOwnedHookCommand('node /opt/my-helloagents-fork/hook.mjs', home), false)
  assert.equal(isOwnedHookCommand('echo helloagents', home), false)
})

test('3.x 遗留命令识别', () => {
  assert.equal(isLegacyHookCommand('node "${CLAUDE_PLUGIN_ROOT}/scripts/notify.mjs" stop'), true)
  assert.equal(isLegacyHookCommand('helloagents-js guard'), false, 'helloagents-js 在 4.x 中仍使用，不应识别为遗留')
  assert.equal(isLegacyHookCommand('node /home/user/.helloagents/helloagents/scripts/guard.mjs'), true)
  assert.equal(isLegacyHookCommand('npm run build'), false)
})

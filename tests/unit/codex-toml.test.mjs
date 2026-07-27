import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readText, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import {
  MANAGED_SUFFIX,
  buildNotifyLine,
  codexNotifyState,
  disableCodexNotify,
  enableCodexNotify,
} from '../../src/hosts/codex-toml.mjs'

function withTempConfig(/** @type {(configPath: string) => void} */ run) {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-toml-'))
  try {
    run(join(dir, 'config.toml'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const APP = '/home/tester/.helloagents/app'

test('空配置：创建文件并写入受管行', () => {
  withTempConfig((configPath) => {
    const result = enableCodexNotify(configPath, APP)
    assert.equal(result.ok, true)
    assert.equal(codexNotifyState(configPath), 'managed')
    const text = readText(configPath) ?? ''
    assert.ok(text.includes(MANAGED_SUFFIX))
    assert.ok(text.includes('notify.mjs'))
  })
})

test('受管行写在第一个表头之前，用户内容不动', () => {
  withTempConfig((configPath) => {
    writeTextAtomic(configPath, 'model = "gpt-5"\n\n[mcp_servers.docs]\ncommand = "docs-server"\n')
    enableCodexNotify(configPath, APP)
    const lines = (readText(configPath) ?? '').split('\n')
    const notifyIndex = lines.findIndex((line) => line.startsWith('notify'))
    const headerIndex = lines.findIndex((line) => line.startsWith('[mcp_servers'))
    assert.ok(notifyIndex >= 0 && headerIndex > notifyIndex)
    assert.ok(lines.includes('model = "gpt-5"'))
    assert.ok(lines.includes('command = "docs-server"'))
  })
})

test('用户已有 notify 配置时不覆盖', () => {
  withTempConfig((configPath) => {
    writeTextAtomic(configPath, 'notify = ["my-notifier"]\n')
    const result = enableCodexNotify(configPath, APP)
    assert.equal(result.ok, false)
    assert.equal(result.state, 'user')
    assert.equal(readText(configPath), 'notify = ["my-notifier"]\n')
  })
})

test('宽容匹配：行首空白与等号间距不影响识别', () => {
  withTempConfig((configPath) => {
    writeTextAtomic(configPath, '  notify   = ["my-notifier"]\n')
    assert.equal(codexNotifyState(configPath), 'user')
  })
})

test('重复启用不产生重复行；停用后干净移除', () => {
  withTempConfig((configPath) => {
    writeTextAtomic(configPath, 'model = "gpt-5"\n')
    enableCodexNotify(configPath, APP)
    enableCodexNotify(configPath, APP)
    const text = readText(configPath) ?? ''
    assert.equal(text.split('\n').filter((line) => line.startsWith('notify')).length, 1)

    assert.equal(disableCodexNotify(configPath), 1)
    assert.equal(codexNotifyState(configPath), 'none')
    assert.ok((readText(configPath) ?? '').includes('model = "gpt-5"'))
  })
})

test('生成的路径使用正斜杠', () => {
  const line = buildNotifyLine('C:\\Users\\测试用户\\.helloagents\\app')
  assert.ok(!line.includes('\\'))
  assert.ok(line.includes('C:/Users/测试用户/.helloagents/app'))
})

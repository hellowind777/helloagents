import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJson, readText, writeJsonAtomic, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { createTranslator, detectLanguage } from '../../src/kernel/i18n.mjs'
import { MESSAGES } from '../../src/kernel/messages.mjs'
import { readInstallState, writeInstallState } from '../../src/kernel/config.mjs'
import { makeFakeHome } from '../helpers/env.mjs'

test('安装来源：往返保留、旧状态兼容、拒绝损坏的 Git 来源', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const state = readInstallState(home)
    assert.equal(state.source, undefined)
    for (const source of /** @type {import('../../src/kernel/config.mjs').InstallSource[]} */ ([
      { type: 'npm' }, { type: 'git', url: 'https://example.com/repo.git', branch: 'main', path: home },
    ])) {
      writeInstallState(home, { ...state, source })
      assert.deepEqual(readInstallState(home).source, source)
    }
    writeJsonAtomic(join(home, '.helloagents', 'install.json'), { ...state, source: { type: 'git' } })
    assert.throws(() => readInstallState(home), /Invalid installation source/)
  } finally { cleanup() }
})

test('原子写入：内容完整且无临时文件残留', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-fsx-'))
  try {
    const file = join(dir, 'deep', 'value.json')
    writeJsonAtomic(file, { name: '中文内容', list: [1, 2, 3] })
    assert.deepEqual(readJson(file), { name: '中文内容', list: [1, 2, 3] })
    writeTextAtomic(file, '覆盖后的文本\n')
    assert.equal(readText(file), '覆盖后的文本\n')
    assert.deepEqual(
      readdirSync(join(dir, 'deep')).filter((name) => name.includes('.tmp-')),
      [],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('损坏的 JSON 返回 null 而不是抛出', () => {
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-fsx-'))
  try {
    const file = join(dir, 'broken.json')
    writeTextAtomic(file, '{ not json')
    assert.equal(readJson(file), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('语言检测：显式指定优先，其次区域设置', () => {
  assert.equal(detectLanguage({ HELLOAGENTS_LANG: 'cn' }), 'cn')
  assert.equal(detectLanguage({ HELLOAGENTS_LANG: 'en', LANG: 'zh_CN.UTF-8' }), 'en')
  assert.equal(detectLanguage({ LANG: 'zh_CN.UTF-8' }), 'cn')
  assert.equal(detectLanguage({ LANG: 'en_US.UTF-8' }), 'en')
  assert.equal(detectLanguage({}), 'en')
})

test('翻译：变量替换与缺失键回退', () => {
  const t = createTranslator('cn')
  assert.ok(t('cli.unknownHost', { host: 'x', hosts: 'claude' }).includes('x'))
  assert.equal(t('不存在的键'), '不存在的键')
})

test('文案目录：源码中引用的键全部登记，且中英文都有值', () => {
  for (const [key, entry] of Object.entries(MESSAGES)) {
    assert.ok(entry.cn.trim().length > 0, `缺少中文文案：${key}`)
    assert.ok(entry.en.trim().length > 0, `缺少英文文案：${key}`)
  }
})

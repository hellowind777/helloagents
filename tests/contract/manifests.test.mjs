import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readJson } from '../../src/kernel/fsx.mjs'
import { MANIFEST_FILES } from '../../src/cli/sync-version.mjs'
import { PACKAGE_VERSION, REPO_ROOT } from '../helpers/env.mjs'

test('插件清单版本与 package.json 一致', () => {
  for (const relative of MANIFEST_FILES) {
    const manifest = /** @type {{ version?: string, plugins?: Array<{ version?: string }> } | null} */ (
      readJson(join(REPO_ROOT, relative))
    )
    assert.ok(manifest, `${relative} 缺失或不是合法 JSON`)
    if (typeof manifest.version === 'string') {
      assert.equal(manifest.version, PACKAGE_VERSION, relative)
    }
    for (const plugin of manifest.plugins ?? []) {
      assert.equal(plugin.version, PACKAGE_VERSION, relative)
    }
  }
})

test('package.json 保持零依赖', () => {
  const pkg = /** @type {{ dependencies?: object, devDependencies?: object }} */ (
    readJson(join(REPO_ROOT, 'package.json'))
  )
  assert.equal(pkg.dependencies, undefined)
  assert.equal(pkg.devDependencies, undefined)
})

test('dsh bundle 清单完整：manifest、补丁与插件入口齐备', () => {
  const pkg = /** @type {{ files?: string[], exports?: Record<string, string>, dsh?: { bundle?: { patch?: string } } }} */ (
    readJson(join(REPO_ROOT, 'package.json'))
  )
  assert.ok(pkg.dsh?.bundle?.patch, 'package.json 缺少 dsh.bundle.patch')
  const patchPath = join(REPO_ROOT, pkg.dsh.bundle.patch ?? '')
  assert.ok(existsSync(patchPath), `补丁文件不存在：${patchPath}`)
  const patch = readFileSync(patchPath, 'utf8')
  assert.ok(patch.includes('id: helloagents'), '补丁缺少插件行')
  assert.ok(patch.includes('name: helloagents/dsh'), '补丁行应通过包名解析插件入口')
  // dsh 用 Node ESM 加载补丁行 name；目录导入不受支持，必须有 exports 子路径映射到文件
  assert.equal(pkg.exports?.['./dsh'], './dsh/index.js', 'exports 缺少 ./dsh 子路径')
  assert.ok(existsSync(join(REPO_ROOT, pkg.exports?.['./dsh'] ?? '')), 'exports 目标文件缺失')
  assert.ok(pkg.files?.includes('dsh/'), 'files 字段缺少 dsh/')
  assert.ok(existsSync(join(REPO_ROOT, 'dsh', 'index.js')), 'dsh/index.js 缺失')
})

test('dsh 插件入口：导出 name/inject/apply，frontmatter 解析覆盖全部技能', async () => {
  const module = await import(pathToFileURL(join(REPO_ROOT, 'dsh', 'index.js')).href)
  assert.equal(module.name, 'helloagents')
  assert.deepEqual(module.inject, ['systemPrompt', 'skills'])
  assert.equal(typeof module.apply, 'function')

  // 用桩上下文验证 apply 注册内核与 23 个技能，且技能目录与契约测试一致。
  /** @type {Array<{ name?: string, text?: string }>} */
  const sections = []
  /** @type {Array<{ name?: string, description?: string, content?: string }>} */
  const skills = []
  const ctx = {
    systemPrompt: { section: (/** @type {unknown} */ section) => sections.push(/** @type {any} */ (section)) },
    skills: { register: (/** @type {unknown} */ skill) => skills.push(/** @type {any} */ (skill)) },
    logger: { info: () => {} },
  }
  module.apply(ctx)

  assert.equal(sections.length, 1)
  const kernel = /** @type {{ text?: string }} */ (sections[0])
  assert.ok((kernel.text ?? '').includes('HelloAGENTS'), '内核段落应包含内核正文')

  const expected = 23
  assert.equal(skills.length, expected)
  for (const skill of skills) {
    const entry = /** @type {{ name?: string, description?: string, content?: string }} */ (skill)
    assert.match(entry.name ?? '', /^hello-[a-z-]+$/, '技能名应为 kebab-case hello-*')
    assert.ok(entry.description && entry.description.length > 10, `${entry.name} 缺少描述`)
    assert.ok(entry.content && !(entry.content ?? '').includes('name:'), `${entry.name} 正文应已剥离 frontmatter`)
  }
  const names = skills.map((skill) => skill.name ?? '')
  assert.equal(new Set(names).size, expected, '技能名不应重复')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
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

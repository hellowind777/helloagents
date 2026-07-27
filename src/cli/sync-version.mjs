/**
 * 清单版本同步：把插件清单里的版本号对齐到 package.json。
 * --check 只校验不修改，供发布流水线做门禁。
 */
import { join } from 'node:path'
import { readJson, writeJsonAtomic } from '../kernel/fsx.mjs'

/** 需要同步版本号的清单文件。 */
export const MANIFEST_FILES = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/plugin.json',
]

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} version
 * @returns {boolean} 是否有改动
 */
function applyVersion(manifest, version) {
  let changed = false
  if (typeof manifest.version === 'string' && manifest.version !== version) {
    manifest.version = version
    changed = true
  }
  if (Array.isArray(manifest.plugins)) {
    for (const plugin of manifest.plugins) {
      if (plugin && typeof plugin === 'object' && typeof plugin.version === 'string' && plugin.version !== version) {
        plugin.version = version
        changed = true
      }
    }
  }
  return changed
}

/**
 * @param {Record<string, unknown>} manifest
 * @param {string} version
 */
function versionMatches(manifest, version) {
  if (typeof manifest.version === 'string' && manifest.version !== version) return false
  if (Array.isArray(manifest.plugins)) {
    for (const plugin of manifest.plugins) {
      if (plugin && typeof plugin === 'object' && typeof plugin.version === 'string' && plugin.version !== version) {
        return false
      }
    }
  }
  return true
}

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {{ check: boolean }} options
 * @returns {number} 进程退出码
 */
export function runSyncVersion(ctx, options) {
  /** @type {string[]} */
  const touched = []
  for (const relative of MANIFEST_FILES) {
    const filePath = join(ctx.packageRoot, relative)
    const manifest = /** @type {Record<string, unknown> | null} */ (readJson(filePath))
    if (!manifest) continue
    if (options.check) {
      if (!versionMatches(manifest, ctx.version)) touched.push(relative)
    } else if (applyVersion(manifest, ctx.version)) {
      writeJsonAtomic(filePath, manifest)
      touched.push(relative)
    }
  }
  if (options.check) {
    if (touched.length > 0) {
      ctx.log(ctx.t('version.checkFailed', { files: touched.join('、') }))
      return 1
    }
    ctx.log(ctx.t('version.checkOk', { version: ctx.version }))
    return 0
  }
  if (touched.length > 0) {
    ctx.log(ctx.t('version.synced', { version: ctx.version, files: touched.join('、') }))
  } else {
    ctx.log(ctx.t('version.checkOk', { version: ctx.version }))
  }
  return 0
}

/**
 * 运行副本同步：把当前包内容复制到 ~/.helloagents/app。
 * 采用“临时目录整体替换”的方式，避免半新半旧的中间状态。
 */
import { renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { copyPath, ensureDir, fileExists, readJson, removePath, withRetry } from '../kernel/fsx.mjs'
import { samePath } from '../kernel/paths.mjs'

/** 运行副本需要包含的条目。 */
export const APP_ENTRIES = [
  'cli.mjs',
  'src',
  'prompts',
  'skills',
  'hooks',
  'assets',
  'dsh',
  '.claude-plugin',
  '.cursor-plugin',
  'package.json',
  'LICENSE.md',
]

/**
 * @param {string} appDirPath
 * @returns {string | null}
 */
export function appVersion(appDirPath) {
  const pkg = /** @type {{ version?: string } | null} */ (readJson(join(appDirPath, 'package.json')))
  return pkg?.version ?? null
}

/**
 * 同步运行副本，返回同步后的版本号。
 * 当前进程若已经运行在副本目录内，则跳过同步。
 * @param {string} packageRootPath
 * @param {string} appDirPath
 * @returns {string | null}
 */
export function syncApp(packageRootPath, appDirPath) {
  if (fileExists(appDirPath) && samePath(packageRootPath, appDirPath)) {
    return appVersion(appDirPath)
  }
  const parent = dirname(appDirPath)
  ensureDir(parent)
  const staging = join(parent, `.app-staging-${process.pid}-${Date.now().toString(36)}`)
  ensureDir(staging)
  try {
    for (const entry of APP_ENTRIES) {
      const source = join(packageRootPath, entry)
      if (fileExists(source)) copyPath(source, join(staging, entry))
    }
    removePath(appDirPath)
    withRetry(() => renameSync(staging, appDirPath))
  } catch (error) {
    removePath(staging)
    throw error
  }
  return appVersion(appDirPath)
}

/** @param {string} appDirPath */
export function removeApp(appDirPath) {
  removePath(appDirPath)
}

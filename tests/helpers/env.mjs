/**
 * 测试辅助：临时主目录与命令行上下文。
 * 通过 HELLOAGENTS_HOME 环境变量实现隔离，测试之间互不影响。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson } from '../../src/kernel/fsx.mjs'
import { createTranslator } from '../../src/kernel/i18n.mjs'
import { appDir } from '../../src/kernel/paths.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const pkg = /** @type {{ version: string }} */ (readJson(join(REPO_ROOT, 'package.json')))
export const PACKAGE_VERSION = pkg.version

/** 创建临时主目录，并把 HELLOAGENTS_HOME 指向它。 */
export function makeFakeHome() {
  const home = mkdtempSync(join(tmpdir(), 'helloagents-test-'))
  const previous = process.env.HELLOAGENTS_HOME
  process.env.HELLOAGENTS_HOME = home
  return {
    home,
    cleanup() {
      if (previous === undefined) delete process.env.HELLOAGENTS_HOME
      else process.env.HELLOAGENTS_HOME = previous
      rmSync(home, { recursive: true, force: true })
    },
  }
}

/**
 * 构造命令行上下文；log 输出收集到数组便于断言。
 * @param {string} home
 */
export function makeCtx(home) {
  /** @type {string[]} */
  const lines = []
  return {
    ctx: {
      home,
      app: appDir(home),
      packageRoot: REPO_ROOT,
      version: PACKAGE_VERSION,
      t: createTranslator('cn'),
      log: (/** @type {string} */ line) => {
        lines.push(line)
      },
    },
    lines,
  }
}

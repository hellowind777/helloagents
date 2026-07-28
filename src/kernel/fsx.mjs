/**
 * 文件系统基础操作。
 * 统一约定：全部读写使用 UTF-8；写入一律走临时文件加改名的原子方式；
 * Windows 下文件被占用（杀毒软件、编辑器锁定）时按指数退避重试。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'])
const RETRY_ATTEMPTS = 6

/** @param {number} ms */
function sleepSync(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    // 忙等——等待时间很短（最长约 640ms），仅用于重试退避
  }
}

/**
 * 执行可能因文件占用而暂时失败的操作，失败后退避重试。
 * @template T
 * @param {() => T} action
 * @returns {T}
 */
export function withRetry(action) {
  /** @type {unknown} */
  let lastError = null
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      return action()
    } catch (error) {
      lastError = error
      const code = /** @type {{ code?: string }} */ (error)?.code
      if (!code || !RETRYABLE_CODES.has(code)) throw error
      sleepSync(20 * 2 ** attempt)
    }
  }
  throw lastError
}

/** @param {string} path */
export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

/** @param {string} path */
export function fileExists(path) {
  return existsSync(path)
}

/**
 * 读取文本文件；文件不存在或不可读时返回 null。
 * @param {string} path
 * @returns {string | null}
 */
export function readText(path) {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

/**
 * 读取 JSON 文件；文件缺失或内容不是合法 JSON 时返回 null。
 * @param {string} path
 * @returns {unknown}
 */
export function readJson(path) {
  const text = readText(path)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * 原子写入文本：先写临时文件，再改名覆盖目标。
 * @param {string} path
 * @param {string} content
 */
export function writeTextAtomic(path, content) {
  ensureDir(dirname(path))
  const tempPath = `${path}.tmp-${process.pid}-${Date.now().toString(36)}`
  writeFileSync(tempPath, content, 'utf-8')
  try {
    withRetry(() => renameSync(tempPath, path))
  } catch (error) {
    rmSync(tempPath, { force: true })
    throw error
  }
}

/**
 * 原子写入 JSON（两空格缩进，结尾换行）。
 * @param {string} path
 * @param {unknown} value
 */
export function writeJsonAtomic(path, value) {
  writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * 删除文件或目录；目标不存在时静默返回。
 * @param {string} path
 */
export function removePath(path) {
  try {
    withRetry(() => rmSync(path, { recursive: true, force: true }))
  } catch {
    // 删除失败不阻断主流程，由调用方通过 doctor 复查。
  }
}

/**
 * 递归复制目录或文件。
 * @param {string} source
 * @param {string} target
 */
export function copyPath(source, target) {
  ensureDir(dirname(target))
  cpSync(source, target, { recursive: true, force: true })
}

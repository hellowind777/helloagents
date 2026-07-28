/**
 * 所有权识别。
 * 载体文件（AGENTS.md、CLAUDE.md 等）中归 HelloAGENTS 管理的内容由一对标记包裹，
 * 标记之外的用户内容永不改动。hooks 命令的归属按“命令是否指向运行副本目录”判断，
 * 不做任意字符串嗅探，避免误删用户自己的配置。
 */
import { appDir, toPosix } from './paths.mjs'
import { fileExists, readText, removePath, writeTextAtomic } from './fsx.mjs'

export const MARKER_START = '<!-- HELLOAGENTS_START -->'
export const MARKER_END = '<!-- HELLOAGENTS_END -->'

const MARKER_PATTERN = new RegExp(`[\\r\\n]*${MARKER_START}[\\s\\S]*?${MARKER_END}[\\r\\n]*`, 'g')
const VERSION_PATTERN = /<!-- HelloAGENTS v([0-9A-Za-z.-]+) -->/

/**
 * 构造带版本注释的受管内容块。
 * @param {string} content
 * @param {string} version
 */
export function buildMarkedBlock(content, version) {
  return `${MARKER_START}\n<!-- HelloAGENTS v${version} -->\n${String(content).trim()}\n${MARKER_END}`
}

/**
 * 写入或替换文件中的受管内容块，保留标记之外的用户内容。
 * @param {string} filePath
 * @param {string} block buildMarkedBlock 的产物
 * @returns {'created' | 'replaced' | 'appended'}
 */
export function upsertMarkedBlock(filePath, block) {
  const existing = readText(filePath)
  if (existing === null || existing.trim() === '') {
    writeTextAtomic(filePath, `${block}\n`)
    return 'created'
  }
  if (existing.includes(MARKER_START)) {
    writeTextAtomic(filePath, existing.replace(MARKER_PATTERN, `\n${block}\n`))
    return 'replaced'
  }
  writeTextAtomic(filePath, `${existing.trimEnd()}\n\n${block}\n`)
  return 'appended'
}

/**
 * 移除文件中的受管内容块；移除后文件为空则删除文件。
 * @param {string} filePath
 * @returns {boolean} 是否发生了移除
 */
export function removeMarkedBlock(filePath) {
  const existing = readText(filePath)
  if (existing === null || !existing.includes(MARKER_START)) return false
  const remainder = existing.replace(MARKER_PATTERN, '\n').trim()
  if (remainder) {
    writeTextAtomic(filePath, `${remainder}\n`)
  } else {
    removePath(filePath)
  }
  return true
}

/** @param {string} filePath */
export function hasMarkedBlock(filePath) {
  const text = readText(filePath)
  return text !== null && text.includes(MARKER_START)
}

/**
 * 读取受管内容块中的版本号；无块或无版本注释时返回 null。
 * @param {string} filePath
 * @returns {string | null}
 */
export function readMarkedVersion(filePath) {
  const text = readText(filePath)
  if (!text || !text.includes(MARKER_START)) return null
  const start = text.indexOf(MARKER_START)
  const end = text.indexOf(MARKER_END, start)
  if (end < 0) return null
  const match = text.slice(start, end).match(VERSION_PATTERN)
  return match ? (match[1] ?? null) : null
}

/**
 * 判断一条 hooks 命令是否由当前版本的 HelloAGENTS 写入：
 * 命令内容指向运行副本目录即视为受管，或包含 helloagents-js 可执行文件。
 * @param {string} command
 * @param {string} home
 */
export function isOwnedHookCommand(command, home) {
  const value = toPosix(String(command || ''))
  const appPath = toPosix(appDir(home))
  if (appPath.length > 0 && value.includes(appPath)) return true
  return value.includes('helloagents-js')
}

/**
 * 3.x 遗留 hooks 命令的识别特征。仅用于 migrate 与 doctor 对
 * hook 命令字符串的判断，范围明确，不用于其他内容。
 */
export const LEGACY_COMMAND_SIGNS = [
  '/scripts/notify.mjs',
  '/scripts/guard.mjs',
  '/scripts/ralph-loop.mjs',
  '/scripts/cursor-hook.mjs',
  'helloagents-turn-state',
  '.helloagents/helloagents/',
]

/** @param {string} command */
export function isLegacyHookCommand(command) {
  const value = toPosix(String(command || ''))
  return LEGACY_COMMAND_SIGNS.some((sign) => value.includes(sign))
}

/** @param {string} filePath */
export function markedBlockExistsOnDisk(filePath) {
  return fileExists(filePath) && hasMarkedBlock(filePath)
}

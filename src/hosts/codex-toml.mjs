/**
 * Codex CLI 的 config.toml 受管行读写。
 * 只管理一整行 notify 配置，行尾带管理标记；其余内容一律不改动。
 * 顶层键必须写在第一个表头之前，插入位置据此选择。
 * 键名匹配采用宽容写法（允许行首空白与等号两侧任意空白），
 * 避免 3.x 时代三种匹配规则不一致导致的重复键问题。
 */
import { join } from 'node:path'
import { readText, writeTextAtomic } from '../kernel/fsx.mjs'
import { toPosix } from '../kernel/paths.mjs'

export const MANAGED_SUFFIX = '# helloagents-managed'

const NOTIFY_KEY_PATTERN = /^\s*notify\s*=/
const TABLE_HEADER_PATTERN = /^\s*\[/

/**
 * 生成受管的 notify 行。路径使用正斜杠，避免 TOML 字符串转义问题。
 * @param {string} appDirPath
 */
export function buildNotifyLine(appDirPath) {
  const script = toPosix(join(appDirPath, 'src', 'addons', 'notify.mjs'))
  return `notify = ["node", "${script}", "codex"] ${MANAGED_SUFFIX}`
}

/** @param {string} line */
function isManagedLine(line) {
  return line.trimEnd().endsWith(MANAGED_SUFFIX)
}

/**
 * 读取 notify 配置状态。
 * @param {string} configPath
 * @returns {'managed' | 'user' | 'none'}
 */
export function codexNotifyState(configPath) {
  const text = readText(configPath)
  if (text === null) return 'none'
  let inTopLevel = true
  for (const line of text.split(/\r?\n/)) {
    if (TABLE_HEADER_PATTERN.test(line)) inTopLevel = false
    if (!inTopLevel) continue
    if (NOTIFY_KEY_PATTERN.test(line)) return isManagedLine(line) ? 'managed' : 'user'
  }
  return 'none'
}

/**
 * 启用受管 notify 行。
 * 已有用户自己的 notify 配置时不做任何修改，交由调用方提示手动合并。
 * @param {string} configPath
 * @param {string} appDirPath
 * @returns {{ ok: boolean, state: 'managed' | 'user' }}
 */
export function enableCodexNotify(configPath, appDirPath) {
  const managedLine = buildNotifyLine(appDirPath)
  const text = readText(configPath)
  if (text === null) {
    writeTextAtomic(configPath, `${managedLine}\n`)
    return { ok: true, state: 'managed' }
  }
  const lines = text.split(/\r?\n/)
  let inTopLevel = true
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (TABLE_HEADER_PATTERN.test(line)) inTopLevel = false
    if (!inTopLevel) break
    if (NOTIFY_KEY_PATTERN.test(line)) {
      if (!isManagedLine(line)) return { ok: false, state: 'user' }
      lines[index] = managedLine
      writeTextAtomic(configPath, lines.join('\n'))
      return { ok: true, state: 'managed' }
    }
  }
  const headerIndex = lines.findIndex((line) => TABLE_HEADER_PATTERN.test(line))
  if (headerIndex < 0) {
    const body = text.endsWith('\n') || text === '' ? text : `${text}\n`
    writeTextAtomic(configPath, `${body}${managedLine}\n`)
  } else {
    lines.splice(headerIndex, 0, managedLine)
    writeTextAtomic(configPath, lines.join('\n'))
  }
  return { ok: true, state: 'managed' }
}

/**
 * 移除全部受管行。
 * @param {string} configPath
 * @returns {number} 移除的行数
 */
export function disableCodexNotify(configPath) {
  const text = readText(configPath)
  if (text === null) return 0
  const lines = text.split(/\r?\n/)
  const kept = lines.filter((line) => !isManagedLine(line))
  const removed = lines.length - kept.length
  if (removed > 0) writeTextAtomic(configPath, kept.join('\n'))
  return removed
}

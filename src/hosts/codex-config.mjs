/**
 * Codex config.toml 受管内容管理。
 * 负责以下顶层键与段的写入、更新、移除：
 *   model_instructions_file — 指向 ~/.codex/AGENTS.md，确保 Codex 始终加载内核
 *   notify — 注册 agent-turn-complete 回调命令
 *   [features] hooks — 启用 hooks 功能
 *   [tui] notifications — TUI 通知偏好
 *   [hooks.state] — 各 hook 的信任哈希
 *
 * 所有受管行尾均带 # helloagents-managed 标记，便于识别与清理。
 * 安装前会备份原始 config.toml，卸载时恢复。
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { readdirSync } from 'node:fs'
import { copyPath, fileExists, readText, removePath, writeTextAtomic } from '../kernel/fsx.mjs'
import { toPosix } from '../kernel/paths.mjs'

// ── 常量和标记 ────────────────────────────────────────────────────────
export const MANAGED_TOML_SUFFIX = '# helloagents-managed'
export const MANAGED_MODEL_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md'
const MANAGED_NOTIFY_BIN = 'helloagents-js'
const MANAGED_NOTIFY_ARG = 'codex-notify'

const FEATURES_HEADER = '[features]'
const TUI_HEADER = '[tui]'
const HOOK_STATE_HEADER_RE = /^\[hooks\.state\."((?:\\.|[^"])*)"\](?:\s*#.*)?$/

// 命令参数别名映射，兼容旧版短写
const COMMAND_ALIASES = { do: 'build', design: 'plan', review: 'qa', idea: 'ask' }

// ── TOML 行级工具 ─────────────────────────────────────────────────────
function isTableHeader(line) {
  return /^\s*\[/.test(line.trim())
}

function splitTopLevel(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let end = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (isTableHeader(lines[i])) { end = i; break }
  }
  return { top: lines.slice(0, end), sections: lines.slice(end) }
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 在顶层区域（第一个表头之前）按顺序更新指定键的值行。
 * 已存在的同名键先移除，再在指定位置插入新行；不存在的键追加到末尾。
 * @param {string} text
 * @param {Array<{ key: string, line: string }>} entries
 * @returns {string}
 */
function upsertOrderedTopLevel(text, entries) {
  const { top, sections } = splitTopLevel(text)
  // 移除已有的同名受管行
  const keySet = new Set(entries.map((e) => e.key))
  const kept = top.filter((line) => {
    for (const key of keySet) {
      if (line.trim().startsWith(`${key} =`) || line.trim().startsWith(`${key}=`)) return false
    }
    return true
  })
  // 追加新行
  const body = [...kept, ...entries.map((e) => e.line)].join('\n')
  const remainder = sections.join('\n')
  const result = body && remainder ? `${body}\n\n${remainder}` : body || remainder
  return normalize(result) ? `${normalize(result)}\n` : ''
}

/**
 * 在指定段（[header]）中更新或插入一个键值行。
 * 段不存在时在文件末尾新建。
 * @param {string} text
 * @param {string} header - 例如 '[features]'
 * @param {string} key
 * @param {string} line
 * @returns {string}
 */
function upsertSectionLine(text, header, key, line) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  // 查找目标段
  let sectionStart = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === header) { sectionStart = i; continue }
    if (sectionStart >= 0 && isTableHeader(lines[i])) { sectionEnd = i; break }
  }
  if (sectionStart < 0) {
    // 段不存在，在末尾追加
    const base = normalize(text)
    const block = `${header}\n${line}`
    return base ? `${base}\n\n${block}\n` : `${block}\n`
  }
  // 在段内 upsert
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    if (lines[i].trim().startsWith(`${key} =`) || lines[i].trim().startsWith(`${key}=`)) {
      lines[i] = line
      return `${normalize(lines.join('\n'))}\n`
    }
  }
  // 在段末尾插入
  let insertAt = sectionEnd
  while (insertAt > sectionStart + 1 && !lines[insertAt - 1].trim()) insertAt -= 1
  lines.splice(insertAt, 0, line)
  return `${normalize(lines.join('\n'))}\n`
}

/**
 * 从指定段中移除匹配的键值行。移除后段为空则同时移除段头。
 * @param {string} text
 * @param {string} header
 * @param {string} key
 * @param {(line: string) => boolean} shouldRemove
 * @returns {string}
 */
function removeSectionLine(text, header, key, shouldRemove) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let sectionStart = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === header) { sectionStart = i; continue }
    if (sectionStart >= 0 && isTableHeader(lines[i])) { sectionEnd = i; break }
  }
  if (sectionStart < 0) return `${normalize(text)}\n`
  // 查找并移除
  let removed = false
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    if ((lines[i].trim().startsWith(`${key} =`) || lines[i].trim().startsWith(`${key}=`)) && shouldRemove(lines[i].trim())) {
      lines.splice(i, 1)
      sectionEnd -= 1
      removed = true
      break
    }
  }
  if (!removed) return `${normalize(text)}\n`
  // 检查段是否为空
  const remaining = lines.slice(sectionStart + 1, sectionEnd).filter((l) => l.trim()).length
  if (remaining === 0) {
    lines.splice(sectionStart, sectionEnd - sectionStart)
  }
  return `${normalize(lines.join('\n'))}\n`
}

/**
 * 移除受管的 [hooks.state.*] 段：标记可能在段头行（新格式）或内容行（旧格式），
 * 两种都处理。移除段头及其后续内容行，直到遇到下一个表头。
 * @param {string} text
 * @returns {string}
 */
function removeManagedHookStateSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let inManagedHookState = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = /** @type {string} */ (lines[i])
    const match = HOOK_STATE_HEADER_RE.exec(line.trim())
    if (match) {
      // 先检查段头行是否有标记，再检查后续内容行是否有标记
      let hasManagedMarker = line.includes(MANAGED_TOML_SUFFIX)
      if (!hasManagedMarker) {
        for (let j = i + 1; j < lines.length && !isTableHeader(lines[j]); j += 1) {
          if (lines[j] && lines[j].includes(MANAGED_TOML_SUFFIX)) {
            hasManagedMarker = true
            break
          }
        }
      }
      inManagedHookState = hasManagedMarker
      if (inManagedHookState) continue
      out.push(line)
      continue
    }
    if (inManagedHookState && isTableHeader(line)) {
      inManagedHookState = false
    }
    if (inManagedHookState) continue
    out.push(line)
  }
  return normalize(out.join('\n'))
}

/**
 * 移除所有 key 在给定集合中的 [hooks.state.*] 段（无论有无管理标记）。
 * Codex 在首次启用 hooks 时会自动生成 trust 条目，若其 key 与我们受管条目的
 * key 重合，不预先移除将导致 TOML 重复键错误。
 * @param {string} text
 * @param {Set<string>} keys 要移除的段 key 集合（未转义的原始 key）
 * @returns {string}
 */
function removeHookStateSectionsByKeys(text, keys) {
  if (keys.size === 0) return text
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let inTargetSection = false
  for (const line of lines) {
    const match = HOOK_STATE_HEADER_RE.exec(line.trim())
    if (match) {
      // TOML 段头 key 是转义后的（\\→\，\"→"），比较前需反转义
      const sectionKey = unescapeTomlKey(match[1] ?? '')
      inTargetSection = keys.has(sectionKey)
      if (inTargetSection) continue
      out.push(line)
      continue
    }
    if (inTargetSection && isTableHeader(line)) {
      inTargetSection = false
    }
    if (inTargetSection) continue
    out.push(line)
  }
  return normalize(out.join('\n'))
}

/**
 * 反转义 TOML 基本字符串中的转义序列（\\、\"、\n 等）。
 * @param {string} key
 * @returns {string}
 */
function unescapeTomlKey(key) {
  return key.replace(/\\(.)/g, (_, c) => c)
}

function readSectionLine(text, header, key) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let inSection = false
  for (const line of lines) {
    if (line.trim() === header) { inSection = true; continue }
    if (inSection && isTableHeader(line)) break
    if (inSection && (line.trim().startsWith(`${key} =`) || line.trim().startsWith(`${key}=`))) {
      return line.trim()
    }
  }
  return ''
}

// ── 受管行构造 ────────────────────────────────────────────────────────
function managedModelInstructionsLine() {
  return `model_instructions_file = "${MANAGED_MODEL_INSTRUCTIONS_PATH}" ${MANAGED_TOML_SUFFIX}`
}

function managedNotifyLine() {
  return `notify = ["${MANAGED_NOTIFY_BIN}", "${MANAGED_NOTIFY_ARG}"] ${MANAGED_TOML_SUFFIX}`
}

function managedHooksFeatureLine() {
  return `hooks = true ${MANAGED_TOML_SUFFIX}`
}

const MANAGED_TUI_NOTIFICATIONS_LINE = `notifications = ["plan-mode-prompt"] ${MANAGED_TOML_SUFFIX}`

// ── hooks.state trust hash ─────────────────────────────────────────────

/**
 * 从 hooks.json 中提取我们管理的 hook 条目，计算每条的身份哈希并生成
 * [hooks.state."<key>"] 段。
 * @param {string} hooksPath — hooks.json 的路径
 * @param {unknown} hooksData — hooks.json 解析后的对象
 * @returns {Array<{ key: string, trustedHash: string, enabled?: boolean }>}
 */
export function buildManagedHookTrustEntries(hooksPath, hooksData) {
  const hooks = hooksData && typeof hooksData === 'object' && !Array.isArray(hooksData)
    ? /** @type {Record<string, unknown>} */ (hooksData).hooks
    : null
  if (!hooks || typeof hooks !== 'object') return []

  const entries = []
  for (const [eventName, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    groups.forEach((group, groupIndex) => {
      const handlers = Array.isArray(group?.hooks) ? group.hooks : []
      handlers.forEach((handler, handlerIndex) => {
        const command = typeof handler?.command === 'string' ? handler.command : ''
        if (!command.includes('helloagents')) return
        const key = `${hooksPath}:${eventName.toLowerCase()}:${groupIndex}:${handlerIndex}`
        const identity = {
          event_name: eventName.toLowerCase(),
          hooks: [{
            type: 'command',
            command,
            timeout: Number(handler?.timeout) || 600,
            async: Boolean(handler?.async),
          }],
        }
        const trustedHash = `sha256:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
        entries.push({ key, trustedHash })
      })
    })
  }
  return entries
}

/**
 * 将信任哈希条目序列化为 TOML 段。
 * @param {Array<{ key: string, trustedHash: string }>} entries
 * @returns {string}
 */
function serializeHookStateBlocks(entries) {
  return entries.map((e) =>
    `[hooks.state."${e.key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"] ${MANAGED_TOML_SUFFIX}\ntrusted_hash = "${e.trustedHash}"`
  ).join('\n\n')
}

/**
 * 同步 hooks.state 段：先移除所有与受管条目 key 重合的既存段（无论有无管理标记），
 * 再写入新的受管段。避免 Codex 自动生成的 trust 条目与受管条目键冲突。
 * @param {string} text — 当前 config.toml 内容
 * @param {Array<{ key: string, trustedHash: string }>} entries
 * @returns {string}
 */
function syncHookStateSections(text, entries) {
  if (entries.length === 0) return removeManagedHookStateSections(text)
  // 先移除受管段，再移除与受管条目 key 重合的非受管段
  let cleaned = removeManagedHookStateSections(text)
  const managedKeys = new Set(entries.map((e) => e.key))
  if (managedKeys.size > 0) {
    cleaned = removeHookStateSectionsByKeys(cleaned, managedKeys)
  }
  const base = cleaned.trim()
  const blocks = serializeHookStateBlocks(entries)
  return base ? `${base}\n\n${blocks}\n` : `${blocks}\n`
}

// ── 公开 API ───────────────────────────────────────────────────────────

/**
 * 安装受管的 config.toml 顶层配置与段。
 * @param {string} configPath — ~/.codex/config.toml
 * @param {string} hooksPath — ~/.codex/hooks.json（用于计算 trust hash）
 * @param {unknown} hooksData — hooks.json 的内容
 * @param {string} backupDir — 备份存放目录
 * @param {boolean} hooksEnabled — 是否启用 hooks（默认 true）
 * @returns {boolean} 是否有修改
 */
export function installCodexManagedConfig(configPath, hooksPath, hooksData, backupDir, hooksEnabled = true) {
  const existing = readText(configPath)

  let text = existing || ''

  // 顶层键：model_instructions_file、notify
  text = upsertOrderedTopLevel(text, [
    { key: 'model_instructions_file', line: managedModelInstructionsLine() },
    { key: 'notify', line: managedNotifyLine() },
  ])

  // [features] hooks
  if (hooksEnabled) {
    text = upsertSectionLine(text, FEATURES_HEADER, 'hooks', managedHooksFeatureLine())
  }

  // [tui] notifications
  text = upsertSectionLine(text, TUI_HEADER, 'notifications', MANAGED_TUI_NOTIFICATIONS_LINE)

  // [hooks.state] 信任哈希
  const trustEntries = buildManagedHookTrustEntries(hooksPath, hooksData)
  text = syncHookStateSections(text, trustEntries)

  writeTextAtomic(configPath, text)
  return true
}

/**
 * 移除 config.toml 中所有受管内容，恢复备份中的原始值。
 * @param {string} configPath
 * @param {string} backupDir
 * @returns {boolean} 是否有修改
 */
export function uninstallCodexManagedConfig(configPath, backupDir) {
  // 查找最新时间戳备份
  let backup = null
  if (fileExists(backupDir)) {
    try {
      const backups = readdirSync(backupDir)
        .filter((name) => /^config\.toml_\d{8}-\d{6}\.bak$/.test(name))
        .sort()
      if (backups.length > 0) {
        backup = readText(join(backupDir, backups[backups.length - 1]))
      }
    } catch { /* 读取失败则跳过恢复 */ }
  }
  const existing = readText(configPath)

  if (!fileExists(configPath)) return false

  // 有备份则恢复备份（仅替换顶层键）
  if (backup !== null) {
    const { top: backupTop } = splitTopLevel(backup)
    let text = existing || ''
    const { sections } = splitTopLevel(text)
    // 用备份中非受管的顶层键替换当前顶层
    const restoredTop = backupTop.filter((line) => {
      const trimmed = line.trim()
      return !trimmed.includes(MANAGED_TOML_SUFFIX) &&
        (trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify'))
    })
    // 移除当前受管顶层键
    const cleanedTop = (text ? text.replace(/\r\n/g, '\n').split('\n') : [])
      .slice(0, splitTopLevel(text).top.length)
      .filter((line) => {
        const trimmed = line.trim()
        return !trimmed.includes(MANAGED_TOML_SUFFIX) &&
          !(trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify'))
      })
    const mergedTop = [...cleanedTop, ...restoredTop].join('\n')
    text = mergedTop && sections.join('\n') ? `${mergedTop}\n\n${sections.join('\n')}` : mergedTop || sections.join('\n')
  }

  // 移除受管段
  text = removeSectionLine(text, FEATURES_HEADER, 'hooks', (l) => l.includes(MANAGED_TOML_SUFFIX))
  text = removeSectionLine(text, TUI_HEADER, 'notifications', (l) => l.includes(MANAGED_TOML_SUFFIX))
  text = removeManagedHookStateSections(text)

  // 清理备份
  removePath(backupDir)

  if (text.trim()) {
    // 检查是否与原始内容相同（避免无意义的写入）
    if (existing !== null && normalize(text) === normalize(existing)) return false
    writeTextAtomic(configPath, `${normalize(text)}\n`)
  } else {
    removePath(configPath)
  }
  return true
}

/**
 * 更新 hooks.state 信任哈希（hooks.json 变更时调用）。
 * @param {string} configPath
 * @param {string} hooksPath
 * @param {unknown} hooksData
 * @returns {boolean}
 */
export function syncCodexHookTrust(configPath, hooksPath, hooksData) {
  const existing = readText(configPath)
  if (existing === null) return false
  const entries = buildManagedHookTrustEntries(hooksPath, hooksData)
  const updated = syncHookStateSections(existing, entries)
  if (normalize(updated) === normalize(existing)) return false
  writeTextAtomic(configPath, updated)
  return true
}

// ── 状态查询 ───────────────────────────────────────────────────────────

/** @param {string | null} text */
export function codexModelInstructionsState(text) {
  if (!text) return 'none'
  for (const line of text.split(/\r?\n/)) {
    if (isTableHeader(line)) break
    if (line.trim().startsWith('model_instructions_file')) {
      return line.includes(MANAGED_TOML_SUFFIX) ? 'managed' : 'user'
    }
  }
  return 'none'
}

/** @param {string | null} text */
export function codexNotifyTopLevelState(text) {
  if (!text) return 'none'
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let inTop = true
  for (const line of lines) {
    if (isTableHeader(line)) { inTop = false; continue }
    if (!inTop) continue
    const trimmed = line.trim()
    if (trimmed.startsWith('notify') && (trimmed.includes('='))) {
      if (trimmed.includes(MANAGED_TOML_SUFFIX)) return 'managed'
      return 'user'
    }
  }
  return 'none'
}

/**
 * 读取 config.toml 中 hooks 功能的启用状态。
 * @param {string | null} text
 * @returns {boolean}
 */
export function codexHooksFeatureEnabled(text) {
  if (!text) return false
  const line = readSectionLine(text, FEATURES_HEADER, 'hooks')
  if (!line) return false
  return /=\s*true\b/.test(line)
}

// ── 命令路由（供 notify route 使用）──────────────────────────────────

/**
 * 解析 ~command 获取规范技能名。
 * @param {string} command — 例如 'plan'、'build'、'do'
 * @returns {string}
 */
export function resolveCanonicalCommandSkill(command) {
  return COMMAND_ALIASES[command] || command
}

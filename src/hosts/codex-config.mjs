/**
 * Codex config.toml 受管内容管理。
 * 负责以下顶层键与段的写入、更新、移除：
 *   model_instructions_file — 指向 ~/.codex/AGENTS.md，确保 Codex 始终加载内核
 *   notify — 注册 agent-turn-complete 回调命令
 *   [features] hooks — 启用 hooks 功能
 *   [tui] notifications — TUI 通知偏好
 *
 * 所有受管行尾均带 # helloagents-managed 标记，便于识别与清理。
 * 安装前会备份原始 config.toml，卸载时恢复。
 *
 * 注意：Codex 0.145.0 起不再通过 config.toml 的 [hooks.state.*] 段管理 hook 信任，
 * 信任由 Codex 内部数据库（state_5.sqlite）管理，用户在首次安装后手动信任一次即持久生效。
 */
import { join } from 'node:path'
import { readdirSync } from 'node:fs'
import { fileExists, readText, removePath, writeTextAtomic } from '../kernel/fsx.mjs'

// ── 常量和标记 ────────────────────────────────────────────────────────
export const MANAGED_TOML_SUFFIX = '# helloagents-managed'
export const MANAGED_MODEL_INSTRUCTIONS_PATH = '~/.codex/AGENTS.md'
const MANAGED_NOTIFY_BIN = 'helloagents-js'
const MANAGED_NOTIFY_ARG = 'codex-notify'

const FEATURES_HEADER = '[features]'
const TUI_HEADER = '[tui]'

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
 * 受管行置顶，其余顶层键排在后面。
 * @param {string} text
 * @param {Array<{ key: string, line: string }>} entries
 * @returns {string}
 */
function upsertOrderedTopLevel(text, entries) {
  const { top, sections } = splitTopLevel(text)
  const keySet = new Set(entries.map((e) => e.key))
  const kept = top.filter((line) => {
    for (const key of keySet) {
      if (line.trim().startsWith(`${key} =`) || line.trim().startsWith(`${key}=`)) return false
    }
    return true
  })
  const body = [...entries.map((e) => e.line), ...kept].join('\n')
  const remainder = sections.join('\n')
  const result = body && remainder ? `${body}\n\n${remainder}` : body || remainder
  return normalize(result) ? `${normalize(result)}\n` : ''
}

/**
 * 在指定段（[header]）中更新或插入一个键值行。
 * 段不存在时在文件末尾新建。
 */
function upsertSectionLine(text, header, key, line) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let sectionStart = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === header) { sectionStart = i; continue }
    if (sectionStart >= 0 && isTableHeader(lines[i])) { sectionEnd = i; break }
  }
  if (sectionStart < 0) {
    const base = normalize(text)
    const block = `${header}\n${line}`
    return base ? `${base}\n\n${block}\n` : `${block}\n`
  }
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    if (lines[i].trim().startsWith(`${key} =`) || lines[i].trim().startsWith(`${key}=`)) {
      lines[i] = line
      return `${normalize(lines.join('\n'))}\n`
    }
  }
  let insertAt = sectionEnd
  while (insertAt > sectionStart + 1 && !lines[insertAt - 1].trim()) insertAt -= 1
  lines.splice(insertAt, 0, line)
  return `${normalize(lines.join('\n'))}\n`
}

/**
 * 从指定段中移除匹配的键值行。移除后段为空则同时移除段头。
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
  const remaining = lines.slice(sectionStart + 1, sectionEnd).filter((l) => l.trim()).length
  if (remaining === 0) {
    lines.splice(sectionStart, sectionEnd - sectionStart)
  }
  return `${normalize(lines.join('\n'))}\n`
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

// ── 公开 API ───────────────────────────────────────────────────────────

/**
 * 安装受管的 config.toml 顶层配置与段。
 * @param {string} configPath — ~/.codex/config.toml
 * @param {string} backupDir — 备份存放目录
 * @param {boolean} hooksEnabled — 是否启用 hooks（默认 true）
 * @returns {boolean} 是否有修改
 */
export function installCodexManagedConfig(configPath, backupDir, hooksEnabled = true) {
  const existing = readText(configPath)

  let text = existing || ''

  // 顶层键：model_instructions_file、notify（置顶）
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
    const restoredTop = backupTop.filter((line) => {
      const trimmed = line.trim()
      return !trimmed.includes(MANAGED_TOML_SUFFIX) &&
        (trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify'))
    })
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

  // 清理备份
  removePath(backupDir)

  if (text.trim()) {
    if (existing !== null && normalize(text) === normalize(existing)) return false
    writeTextAtomic(configPath, `${normalize(text)}\n`)
  } else {
    removePath(configPath)
  }
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

/** @param {string | null} text */
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

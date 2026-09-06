/**
 * Codex config.toml 受管内容管理。
 * 负责以下顶层键与段的写入、更新、移除：
 *   model_instructions_file — 指向 ~/.codex/AGENTS.md，确保 Codex 始终加载内核
 *   notify — 注册 agent-turn-complete 回调命令
 *   [features] hooks — 启用 hooks 功能
 *   [tui] notifications — TUI 通知偏好
 *   [hooks.state.*] — 各 hook 的信任哈希，安装后自动受信
 *
 * 所有受管行尾均带 # helloagents-managed 标记，便于识别与清理。
 * 安装前会备份原始 config.toml，卸载时恢复。
 */
import { createHash } from 'node:crypto'
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

// ── hooks 信任：事件名映射与 matcher 规则 ─────────────────────────────
const HOOK_EVENT_KEY = {
  PreToolUse: 'pre_tool_use',
  PermissionRequest: 'permission_request',
  PostToolUse: 'post_tool_use',
  PreCompact: 'pre_compact',
  PostCompact: 'post_compact',
  SessionStart: 'session_start',
  UserPromptSubmit: 'user_prompt_submit',
  Stop: 'stop',
}

/** 这些事件的身份计算中需包含 matcher 字段 */
const EVENTS_WITH_MATCHER = new Set([
  'PreToolUse', 'PermissionRequest', 'PostToolUse',
  'PreCompact', 'PostCompact', 'SessionStart',
])

const HOOK_STATE_HEADER_RE = /^\[hooks\.state\."((?:\\.|[^"])*)"\](?:\s*#.*)?$/

// ── TOML 行级工具 ─────────────────────────────────────────────────────

/**
 * 检查 config.toml 顶层是否已有 notify 行引用了 helloagents-js 命令，
 * 即使该行被外部工具（如 ChatGPT App CUA）包裹也视为已覆盖。
 * 用于避免覆盖外部工具的 wrapper 配置。
 * @param {string | null} text
 * @returns {boolean}
 */
function existingNotifyCoversHelloagents(text) {
  if (!text) return false
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^\s*\[/.test(trimmed)) break
    if ((trimmed.startsWith('notify =') || trimmed.startsWith('notify=')) && trimmed.includes('helloagents-js')) {
      return true
    }
  }
  return false
}

/** @param {string} line */
function isTableHeader(line) {
  return /^\s*\[/.test(line.trim())
}

/** @param {string} text */
function splitTopLevel(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let end = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    if (isTableHeader(lines[i] ?? '')) { end = i; break }
  }
  return { top: lines.slice(0, end), sections: lines.slice(end) }
}

/** @param {string} text */
function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 在顶层区域（第一个表头之前）按顺序更新指定键的值行。
 * 受管行置顶，其余顶层键排在后面。
 * @param {string} text
 * @param {Array<{key: string, line: string}>} entries
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
  const managedPart = entries.map((e) => e.line).join('\n')
  const keptPart = kept.join('\n')
  const body = managedPart && keptPart ? `${managedPart}\n\n${keptPart}` : managedPart || keptPart
  const remainder = sections.join('\n')
  const result = body && remainder ? `${body}\n\n${remainder}` : body || remainder
  return normalize(result) ? `${normalize(result)}\n` : ''
}

/** @param {string} text @param {string} header @param {string} key @param {string} line */
function upsertSectionLine(text, header, key, line) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let sectionStart = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i] ?? ''
    if (current.trim() === header) { sectionStart = i; continue }
    if (sectionStart >= 0 && isTableHeader(current)) { sectionEnd = i; break }
  }
  if (sectionStart < 0) {
    const base = normalize(text)
    const block = `${header}\n${line}`
    return base ? `${base}\n\n${block}\n` : `${block}\n`
  }
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    const current = lines[i] ?? ''
    if (current.trim().startsWith(`${key} =`) || current.trim().startsWith(`${key}=`)) {
      lines[i] = line
      return `${normalize(lines.join('\n'))}\n`
    }
  }
  let insertAt = sectionEnd
  while (insertAt > sectionStart + 1 && !(lines[insertAt - 1] ?? '').trim()) insertAt -= 1
  lines.splice(insertAt, 0, line)
  return `${normalize(lines.join('\n'))}\n`
}

/** @param {string} text @param {string} header @param {string} key @param {(line: string) => boolean} shouldRemove */
function removeSectionLine(text, header, key, shouldRemove) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let sectionStart = -1
  let sectionEnd = lines.length
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i] ?? ''
    if (current.trim() === header) { sectionStart = i; continue }
    if (sectionStart >= 0 && isTableHeader(current)) { sectionEnd = i; break }
  }
  if (sectionStart < 0) return `${normalize(text)}\n`
  let removed = false
  for (let i = sectionStart + 1; i < sectionEnd; i += 1) {
    const current = (lines[i] ?? '').trim()
    if ((current.startsWith(`${key} =`) || current.startsWith(`${key}=`)) && shouldRemove(current)) {
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

/** @param {string} text @param {string} header @param {string} key */
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

// ── TOML 转义 / 反转义 ────────────────────────────────────────────────
/** @param {unknown} value */
function escapeTomlBasicString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** @param {unknown} value */
function unescapeTomlBasicString(value) {
  return String(value || '').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

// ── JSON 规范化（按键排序，确保哈希稳定） ─────────────────────────────
/** @param {unknown} value @returns {unknown} */
function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .filter(([, item]) => item !== undefined).map(([key, item]) => [key, canonicalizeJson(item)]))
}

// ── hooks 信任哈希计算 ────────────────────────────────────────────────

/**
 * 收集 config.toml 中所有 hooks.state 段的信息。
 * @param {string} text
 */
function collectHookStateSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const sections = []
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? ''
    const match = HOOK_STATE_HEADER_RE.exec(current.trim())
    if (!match) continue
    let end = lines.length
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (isTableHeader(lines[cursor] ?? '')) { end = cursor; break }
    }
    const bodyLines = lines.slice(index + 1, end)
    const trustedHashLine = bodyLines.find((line) => /^\s*trusted_hash\s*=/.test(line))
    const trustedHashMatch = trustedHashLine?.match(/^\s*trusted_hash\s*=\s*"((?:\\.|[^"])*)"/)
    sections.push({
      key: unescapeTomlBasicString(match[1]),
      start: index,
      end,
      trustedHash: trustedHashMatch ? unescapeTomlBasicString(trustedHashMatch[1]) : '',
      managed: current.includes(MANAGED_TOML_SUFFIX)
        || bodyLines.some((line) => line.includes(MANAGED_TOML_SUFFIX)),
    })
    index = end - 1
  }
  return { lines, sections }
}

/** @param {string} text @param {(section: ReturnType<typeof collectHookStateSections>['sections'][number]) => boolean} shouldRemove */
function removeHookStateSections(text, shouldRemove) {
  const { lines, sections } = collectHookStateSections(text)
  if (!sections.length) return normalize(text)
  const removedStarts = new Set(sections.filter(shouldRemove).map((s) => s.start))
  if (!removedStarts.size) return normalize(text)
  const kept = []
  for (let index = 0; index < lines.length;) {
    const section = sections.find((item) => item.start === index)
    if (!section) { kept.push(lines[index]); index += 1; continue }
    if (!removedStarts.has(section.start)) {
      kept.push(...lines.slice(section.start, section.end))
    }
    index = section.end
  }
  return normalize(kept.join('\n'))
}

/** @param {{key: string, trustedHash: string}} entry */
function serializeHookStateBlock(entry) {
  return `[hooks.state."${escapeTomlBasicString(entry.key)}"] ${MANAGED_TOML_SUFFIX}\ntrusted_hash = "${escapeTomlBasicString(entry.trustedHash)}"`
}

/** @param {string} text @param {Array<{key: string, trustedHash: string}>} entries */
function appendHookStateBlocks(text, entries) {
  if (!entries.length) return normalize(text)
  const blocks = entries.map(serializeHookStateBlock).join('\n\n')
  const base = text.replace(/\r\n/g, '\n').trimEnd()
  return normalize(base ? `${base}\n\n${blocks}` : blocks)
}

/**
 * 从 hooks.json 中提取我们管理的 hook 条目，计算信任哈希。
 * 使用与 Codex 一致的身份格式：snake_case 事件名 + 排序 JSON keys +
 * 对 SessionStart 等事件包含 matcher 字段。
 * @param {string} hooksPath
 * @param {unknown} hooksData
 */
export function buildManagedHookTrustEntries(hooksPath, hooksData) {
  const hooks = hooksData && typeof hooksData === 'object' && !Array.isArray(hooksData)
    ? /** @type {Record<string, unknown>} */ (hooksData).hooks
    : null
  if (!hooks || typeof hooks !== 'object') return []

  /** @type {Array<{ key: string, trustedHash: string }>} */
  const entries = []
  for (const [eventName, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    groups.forEach((group, groupIndex) => {
      const inner = group && typeof group === 'object' ? group.hooks : undefined
      const handlers = Array.isArray(inner) ? /** @type {unknown[]} */ (inner) : []
      handlers.forEach((handler, handlerIndex) => {
        if (!handler || typeof handler !== 'object') return
        const cmd = /** @type {{ command?: string }} */ (handler)
        if (typeof cmd.command !== 'string' || !cmd.command.includes('helloagents')) return

        const matcher = EVENTS_WITH_MATCHER.has(eventName)
          ? String(/** @type {{ matcher?: string }} */ (group).matcher ?? '')
          : undefined

        /** @type {Record<string, unknown>} */
        const identity = {
          event_name: HOOK_EVENT_KEY[/** @type {keyof typeof HOOK_EVENT_KEY} */ (eventName)],
          ...(matcher !== undefined ? { matcher } : {}),
          hooks: [{
            type: 'command',
            command: cmd.command,
            timeout: Number(/** @type {{ timeout?: number }} */ (handler).timeout) || 600,
            async: Boolean(/** @type {{ async?: boolean }} */ (handler).async),
          }],
        }
        const key = `${hooksPath}:${HOOK_EVENT_KEY[/** @type {keyof typeof HOOK_EVENT_KEY} */ (eventName)]}:${groupIndex}:${handlerIndex}`
        const serialized = JSON.stringify(canonicalizeJson(identity))
        const trustedHash = `sha256:${createHash('sha256').update(serialized).digest('hex')}`
        entries.push({ key, trustedHash })
      })
    })
  }
  return entries
}

/**
 * 同步 hooks.state 信任段：移除受管旧段及 key 重合的非受管段，写入新受管段。
 * @param {string} text
 * @param {Array<{key: string, trustedHash: string}>} entries
 */
function syncHookStateSections(text, entries) {
  if (!entries.length) {
    // 无受管 hook 时清理所有受管段
    return removeHookStateSections(text, (section) => section.managed)
  }
  const keySet = new Set(entries.map((e) => e.key))
  let cleaned = removeHookStateSections(
    text,
    (section) => section.managed || keySet.has(section.key),
  )
  return appendHookStateBlocks(cleaned, entries)
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
 * 安装受管的 config.toml 顶层配置与段，含 hooks.state 信任哈希。
 * @param {string} configPath — ~/.codex/config.toml
 * @param {string} hooksPath — ~/.codex/hooks.json（用于计算 trust hash）
 * @param {unknown} hooksData — hooks.json 的内容
 * @param {string} backupDir — 备份存放目录
 * @param {boolean} [hooksEnabled=true]
 * @returns {boolean} 是否有修改
 */
export function installCodexManagedConfig(configPath, hooksPath, hooksData, backupDir, hooksEnabled = true) {
  const existing = readText(configPath)
  let text = existing || ''

  // 顶层键：model_instructions_file、notify（置顶）
  // 如果 config 中已有 notify 行引用了 helloagents-js（包括被 ChatGPT App
  // 等外部工具包裹的情形），则跳过写入，避免覆盖外部 wrapper 破坏其功能。
  const topEntries = [
    { key: 'model_instructions_file', line: managedModelInstructionsLine() },
  ]
  if (!existingNotifyCoversHelloagents(text)) {
    topEntries.push({ key: 'notify', line: managedNotifyLine() })
  }
  text = upsertOrderedTopLevel(text, topEntries)

  // [features] hooks — Codex 默认开启 hooks，仅当用户显式关闭时才覆盖为 true
  if (hooksEnabled && isHooksFeatureDisabled(existing)) {
    text = upsertSectionLine(text, FEATURES_HEADER, 'hooks', managedHooksFeatureLine())
  }

  // [tui] notifications
  text = upsertSectionLine(text, TUI_HEADER, 'notifications', MANAGED_TUI_NOTIFICATIONS_LINE)

  // [hooks.state] 信任哈希（使用与 Codex 一致的身份格式自动预信任 hook）
  const trustEntries = buildManagedHookTrustEntries(hooksPath, hooksData)
  text = syncHookStateSections(text, trustEntries)

  writeTextAtomic(configPath, text)
  return true
}

/**
 * 移除 config.toml 中所有受管内容；若有安装前备份，则恢复其中的
 * model_instructions_file / notify 原始值。
 * @param {string} configPath
 * @param {string} backupDir
 */
export function uninstallCodexManagedConfig(configPath, backupDir) {
  let backup = null
  if (fileExists(backupDir)) {
    try {
      const backups = readdirSync(backupDir)
        .filter((name) => /^config\.toml_\d{8}-\d{6}\.bak$/.test(name))
        .sort()
      const latest = backups.at(-1)
      if (latest) {
        backup = readText(join(backupDir, latest))
      }
    } catch { /* 读取失败则跳过恢复 */ }
  }
  const existing = readText(configPath)
  if (!fileExists(configPath)) return false

  let text = existing || ''
  const { top, sections } = splitTopLevel(text)

  // 去掉受管顶层键；有备份时再去掉同名键，以便从备份恢复用户原值
  let cleanedTop = top.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return true
    const isTarget =
      trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify')
    if (!isTarget) return true
    if (trimmed.includes(MANAGED_TOML_SUFFIX)) return false
    // 无备份时保留用户自有（非受管）同名键；有备份时统一从备份恢复
    return backup === null
  })

  if (backup !== null) {
    const { top: backupTop } = splitTopLevel(backup)
    const restoredTop = backupTop.filter((line) => {
      const trimmed = line.trim()
      return (
        !trimmed.includes(MANAGED_TOML_SUFFIX) &&
        (trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify'))
      )
    })
    cleanedTop = cleanedTop.filter((line) => {
      const trimmed = line.trim()
      return !(trimmed.startsWith('model_instructions_file') || trimmed.startsWith('notify'))
    })
    cleanedTop = [...cleanedTop, ...restoredTop]
  }

  const mergedTop = cleanedTop.join('\n')
  const sectionBody = sections.join('\n')
  text = mergedTop && sectionBody ? `${mergedTop}\n\n${sectionBody}` : mergedTop || sectionBody

  text = removeSectionLine(text, FEATURES_HEADER, 'hooks', (l) => l.includes(MANAGED_TOML_SUFFIX))
  text = removeSectionLine(text, TUI_HEADER, 'notifications', (l) => l.includes(MANAGED_TOML_SUFFIX))
  text = removeHookStateSections(text, (section) => section.managed)
  removePath(backupDir)

  if (text.trim()) {
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

/**
 * @param {string | null} text
 * @returns {'none' | 'managed' | 'user' | 'wrapped'}
 *   - 'managed': 我们写入的受管行，带 # helloagents-managed 标记
 *   - 'wrapped': 外部工具（如 ChatGPT App）包裹了 notify，但命令链中仍引用 helloagents-js
 *   - 'user': 用户自有的 notify 行，未引用 helloagents-js
 *   - 'none': 不存在 notify 行
 */
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
      if (trimmed.includes('helloagents-js')) return 'wrapped'
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

/**
 * 检查 hooks 是否被显式设为 false。
 * Codex 默认开启 hooks，未设置时等同于开启。
 * 仅当用户显式写了 hooks = false 时才返回 true。
 * @param {string | null} text
 */
export function isHooksFeatureDisabled(text) {
  if (!text) return false
  const line = readSectionLine(text, FEATURES_HEADER, 'hooks')
  if (!line) return false
  return /=\s*false\b/.test(line)
}

/**
 * 宿主 hooks 配置的读写。
 * 两种文件形态：
 * 1. settings 形态（Claude Code 的 settings.json）：
 *    { hooks: { 事件名: [ { matcher, hooks: [ { type, command, timeout } ] } ] } }
 * 2. cursor 形态（~/.cursor/hooks.json）：
 *    { version: 1, hooks: { 事件名: [ { command, timeout } ] } }
 * 归属判断只看命令是否指向运行副本目录（或 3.x 遗留特征），其余条目一律不动。
 */
import { readJson, writeTextAtomic } from '../kernel/fsx.mjs'
import { isLegacyHookCommand, isOwnedHookCommand } from '../kernel/ownership.mjs'

/**
 * @typedef {Object} OwnershipOptions
 * @property {string} home
 * @property {boolean} [includeLegacy] 同时匹配 3.x 遗留条目
 * @property {boolean} [legacyOnly] 只匹配 3.x 遗留条目（迁移场景）
 * @property {string} [commandFilter] 仅处理命令中包含该片段的条目（用于按附加组件区分）
 */

/**
 * @param {unknown} command
 * @param {OwnershipOptions} options
 */
function matchesOwnership(command, options) {
  const value = String(command || '')
  const owned =
    options.legacyOnly === true
      ? isLegacyHookCommand(value)
      : isOwnedHookCommand(value, options.home) ||
        (options.includeLegacy === true && isLegacyHookCommand(value))
  if (!owned) return false
  if (options.commandFilter) return value.includes(options.commandFilter)
  return true
}

/**
 * settings 形态中的一组条目是否归我们管理。
 * @param {{ hooks?: Array<{ command?: string }> }} group
 * @param {OwnershipOptions} options
 */
function groupMatches(group, options) {
  const inner = Array.isArray(group?.hooks) ? group.hooks : []
  return inner.some((hook) => matchesOwnership(hook?.command, options))
}

/**
 * 写入 settings 形态的 hooks 条目：先移除受管旧条目，再追加新条目。
 * @param {string} settingsPath
 * @param {Record<string, unknown[]>} entriesByEvent
 * @param {OwnershipOptions} options
 */
export function upsertSettingsHooks(settingsPath, entriesByEvent, options) {
  const raw = readJson(settingsPath)
  const settings =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {}
  const hooksRaw = settings.hooks
  const hooks =
    hooksRaw && typeof hooksRaw === 'object' && !Array.isArray(hooksRaw)
      ? /** @type {Record<string, unknown>} */ (hooksRaw)
      : {}
  settings.hooks = hooks
  for (const [event, entries] of Object.entries(entriesByEvent)) {
    const existing = Array.isArray(hooks[event]) ? /** @type {unknown[]} */ (hooks[event]) : []
    hooks[event] = [
      ...existing.filter((group) => !groupMatches(/** @type {never} */ (group), options)),
      ...entries,
    ]
  }
  writeTextAtomic(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
}

/**
 * 移除 settings 形态中归我们管理的条目。
 * @param {string} settingsPath
 * @param {OwnershipOptions} options
 * @returns {number} 移除的条目数
 */
export function removeSettingsHooks(settingsPath, options) {
  const raw = readJson(settingsPath)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const settings = /** @type {Record<string, unknown>} */ (raw)
  const hooks = settings.hooks
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return 0
  const hooksRecord = /** @type {Record<string, unknown>} */ (hooks)
  let removed = 0
  for (const [event, groups] of Object.entries(hooksRecord)) {
    if (!Array.isArray(groups)) continue
    const kept = groups.filter((group) => {
      const matches = groupMatches(/** @type {never} */ (group), options)
      if (matches) removed += 1
      return !matches
    })
    if (kept.length > 0) {
      hooksRecord[event] = kept
    } else {
      delete hooksRecord[event]
    }
  }
  if (Object.keys(hooksRecord).length === 0) delete settings.hooks
  if (removed > 0) writeTextAtomic(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
  return removed
}

/**
 * 写入 cursor 形态的 hooks 条目。
 * @param {string} hooksPath
 * @param {Record<string, Array<{ command: string, timeout: number }>>} entriesByEvent
 * @param {OwnershipOptions} options
 */
export function upsertCursorHooks(hooksPath, entriesByEvent, options) {
  const raw = readJson(hooksPath)
  const config =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, unknown>} */ (raw) : {}
  if (typeof config.version !== 'number') config.version = 1
  const hooksRaw = config.hooks
  const hooks =
    hooksRaw && typeof hooksRaw === 'object' && !Array.isArray(hooksRaw)
      ? /** @type {Record<string, unknown>} */ (hooksRaw)
      : {}
  config.hooks = hooks
  for (const [event, entries] of Object.entries(entriesByEvent)) {
    const existing = Array.isArray(hooks[event]) ? /** @type {Array<{ command?: string }>} */ (hooks[event]) : []
    hooks[event] = [...existing.filter((entry) => !matchesOwnership(entry?.command, options)), ...entries]
  }
  writeTextAtomic(hooksPath, `${JSON.stringify(config, null, 2)}\n`)
}

/**
 * 移除 cursor 形态中归我们管理的条目。
 * @param {string} hooksPath
 * @param {OwnershipOptions} options
 * @returns {number}
 */
export function removeCursorHooks(hooksPath, options) {
  const raw = readJson(hooksPath)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const config = /** @type {Record<string, unknown>} */ (raw)
  const hooks = config.hooks
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return 0
  const hooksRecord = /** @type {Record<string, unknown>} */ (hooks)
  let removed = 0
  for (const [event, entries] of Object.entries(hooksRecord)) {
    if (!Array.isArray(entries)) continue
    const kept = entries.filter((entry) => {
      const matches = matchesOwnership(/** @type {{ command?: string }} */ (entry)?.command, options)
      if (matches) removed += 1
      return !matches
    })
    if (kept.length > 0) {
      hooksRecord[event] = kept
    } else {
      delete hooksRecord[event]
    }
  }
  if (Object.keys(hooksRecord).length === 0) delete config.hooks
  if (removed > 0) writeTextAtomic(hooksPath, `${JSON.stringify(config, null, 2)}\n`)
  return removed
}

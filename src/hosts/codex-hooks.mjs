/**
 * Codex hooks.json 受管内容管理。
 * 负责 ~/.codex/hooks.json 中 HelloAGENTS 条目的写入、合并与清理。
 * 格式遵循 Codex 的 standalone hooks 规范：{ version: 1, hooks: { EventName: [...] } }。
 *
 * hook 命令行统一使用 helloagents-js notify <子命令> --host codex 格式，
 * 不写死绝对路径，与 config.toml 的 notify 配置保持一致。
 */
import { readJson, removePath, writeJsonAtomic } from '../kernel/fsx.mjs'

// hooks.json 中归我们管理的 hook。每条至少包含 type: command 且 command 中含 helloagents。
function isManagedHookHandler(handler) {
  return handler && typeof handler === 'object' &&
    handler.type === 'command' &&
    typeof handler.command === 'string' &&
    handler.command.includes('helloagents')
}

/**
 * 将我们的 hook 条目合并到现有 hooks.json 中：
 *   已有的事件名下先移除旧的受管条目，再追加新条目；
 *   不受我们管理的事件与条目保持原样。
 * @param {string} hooksPath
 * @param {Record<string, Array<{ matcher?: string, hooks: Array<{ type: string, command: string, timeout?: number }> }>>} managedHooks
 * @returns {boolean} 是否发生了修改
 */
export function installCodexHooks(hooksPath, managedHooks) {
  const existing = /** @type {{ version?: number, hooks?: Record<string, unknown[]> } | null} */ (readJson(hooksPath))
  const config = {
    hooks: /** @type {Record<string, unknown[]>} */ (existing?.hooks || {}),
  }

  let changed = false
  for (const [event, newGroups] of Object.entries(managedHooks)) {
    const current = Array.isArray(config.hooks[event]) ? config.hooks[event] : []
    // 过滤掉已有的受管条目
    const kept = current.filter((group) => {
      if (!group || typeof group !== 'object') return true
      const inner = Array.isArray(/** @type {{hooks?: unknown[]}} */ (group).hooks)
        ? /** @type {{hooks?: unknown[]}} */ (group).hooks
        : []
      return !inner.some(isManagedHookHandler)
    })
    const merged = [...kept, ...newGroups]
    if (JSON.stringify(merged) !== JSON.stringify(current)) changed = true
    config.hooks[event] = merged
  }

  if (changed) writeJsonAtomic(hooksPath, config)
  return changed
}

/**
 * 移除 hooks.json 中归我们管理的全部条目。若某事件名下已无条目则删除该事件。
 * 若整个 hooks 对象为空则删除文件。
 * @param {string} hooksPath
 * @returns {boolean}
 */
export function uninstallCodexHooks(hooksPath) {
  const existing = /** @type {{ version?: number, hooks?: Record<string, unknown[]> } | null} */ (readJson(hooksPath))
  if (!existing || !existing.hooks) return false

  let changed = false
  /** @type {Record<string, unknown[]>} */
  const cleaned = {}
  for (const [event, groups] of Object.entries(existing.hooks)) {
    if (!Array.isArray(groups)) { cleaned[event] = groups; continue }
    const kept = groups.filter((group) => {
      if (!group || typeof group !== 'object') return true
      const inner = Array.isArray(/** @type {{hooks?: unknown[]}} */ (group).hooks)
        ? /** @type {{hooks?: unknown[]}} */ (group).hooks
        : []
      return !inner.some(isManagedHookHandler)
    })
    if (kept.length !== groups.length) changed = true
    if (kept.length > 0) cleaned[event] = kept
  }

  if (!changed) return false
  if (Object.keys(cleaned).length === 0) {
    removePath(hooksPath)
  } else {
    writeJsonAtomic(hooksPath, { hooks: cleaned })
  }
  return true
}

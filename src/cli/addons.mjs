/**
 * 附加组件（guard 危险拦截、notify 完成提醒）的启停。
 * 每个宿主按注册表声明的能力接入；不支持的组合直接明示，不做模拟。
 */
import { join } from 'node:path'
import { readJson, readText, removePath, writeTextAtomic } from '../kernel/fsx.mjs'
import { toPosix } from '../kernel/paths.mjs'
import { codexNotifyTopLevelState } from '../hosts/codex-config.mjs'
import {
  removeCursorHooks,
  removeSettingsHooks,
  upsertCursorHooks,
  upsertSettingsHooks,
} from '../hosts/hooks-config.mjs'

/** @typedef {import('../hosts/registry.mjs').HostAdapter} HostAdapter */
/** @typedef {'guard' | 'notify'} AddonName */

/**
 * @typedef {Object} AddonResult
 * @property {'enabled' | 'disabled' | 'unsupported' | 'blocked'} status
 * @property {string} [detail]
 */

/** @param {string} app @param {string} script @param {string[]} args */
function hookCommand(app, script, args) {
  return `node "${toPosix(join(app, 'src', 'addons', script))}" ${args.join(' ')}`.trim()
}

/**
 * settings 形态（Claude Code）的条目。
 * @param {string} app
 * @param {AddonName} addon
 * @param {string} hostId
 * @returns {Record<string, unknown[]>}
 */
function settingsEntries(app, addon, hostId) {
  if (addon === 'guard') {
    return {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [
            { type: 'command', command: hookCommand(app, 'guard.mjs', ['--host', hostId]), timeout: 5 },
          ],
        },
      ],
    }
  }
  return {
    Stop: [
      {
        matcher: '',
        hooks: [
          { type: 'command', command: hookCommand(app, 'notify.mjs', ['stop', '--host', hostId]), timeout: 10 },
        ],
      },
    ],
    Notification: [
      {
        matcher: '',
        hooks: [
          {
            type: 'command',
            command: hookCommand(app, 'notify.mjs', ['notification', '--host', hostId]),
            timeout: 10,
          },
        ],
      },
    ],
  }
}

/**
 * Grok 使用独立的 hooks 文件，基础条目与附加组件条目共存：
 * 仅增删附加组件条目，基础条目保持不动；两个组件都停用时仅移除附加组件条目。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {HostAdapter} host
 * @param {{ guard: boolean, notify: boolean }} enabled
 */
function writeGrokHooksFile(ctx, host, enabled) {
  const filePath = host.grokHooksPath(ctx.home)
  if (!filePath) return
  _writeManagedHooksFile(ctx, 'grok', filePath, enabled)
}

/**
 * Hermes 使用独立的 hooks 文件，格式与 Grok 一致：
 * 仅增删附加组件条目，基础条目保持不动；两个组件都停用时仅移除附加组件条目。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {HostAdapter} host
 * @param {{ guard: boolean, notify: boolean }} enabled
 */
function writeHermesHooksFile(ctx, host, enabled) {
  const filePath = host.hermesHooksPath(ctx.home)
  if (!filePath) return
  _writeManagedHooksFile(ctx, 'hermes', filePath, enabled)
}

/**
 * 写入受管 hooks JSON 文件，仅增删附加组件条目，基础条目保持不动。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {string} hostId
 * @param {string} filePath
 * @param {{ guard: boolean, notify: boolean }} enabled
 */
function _writeManagedHooksFile(ctx, hostId, filePath, enabled) {
  /** @param {unknown} command */
  const isAddonCommand = (command) => {
    const value = String(command || '')
    return value.includes('/guard.mjs') || value.includes('/notify.mjs')
  }
  const existing = /** @type {{ version?: number, hooks?: Record<string, unknown[]> } | null} */ (readJson(filePath))
  const current = existing && typeof existing.hooks === 'object' && existing.hooks
    ? /** @type {Record<string, unknown[]>} */ (existing.hooks)
    : {}
  /** @type {Record<string, unknown[]>} */
  const merged = {}
  for (const [event, groups] of Object.entries(current)) {
    if (!Array.isArray(groups)) continue
    const kept = groups.filter((group) => {
      if (!group || typeof group !== 'object') return true
      const inner = Array.isArray(/** @type {{hooks?: unknown}} */ (group).hooks)
        ? /** @type {Array<{command?: unknown}>} */ (/** @type {{hooks?: unknown}} */ (group).hooks)
        : []
      if (inner.length === 0) return true
      return !inner.some((hook) => isAddonCommand(hook?.command))
    })
    if (kept.length > 0) merged[event] = kept
  }
  if (enabled.guard) {
    merged.PreToolUse = [
      ...(merged.PreToolUse ?? []),
      {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: hookCommand(ctx.app, 'guard.mjs', ['--host', hostId]), timeout: 5 },
        ],
      },
    ]
  }
  if (enabled.notify) {
    merged.Stop = [
      ...(merged.Stop ?? []),
      {
        matcher: '',
        hooks: [
          { type: 'command', command: hookCommand(ctx.app, 'notify.mjs', ['stop', '--host', hostId]), timeout: 10 },
        ],
      },
    ]
  }
  if (Object.keys(merged).length === 0) {
    removePath(filePath)
    return
  }
  const version = typeof existing?.version === 'number' ? existing.version : 1
  writeTextAtomic(filePath, `${JSON.stringify({ version, hooks: merged }, null, 2)}\n`)
}

/**
 * cursor 形态的条目。
 * @param {string} app
 * @param {AddonName} addon
 * @returns {Record<string, Array<{ command: string, timeout: number }>>}
 */
function cursorEntries(app, addon) {
  if (addon === 'guard') {
    return {
      preToolUse: [{ command: hookCommand(app, 'guard.mjs', ['--host', 'cursor']), timeout: 5 }],
    }
  }
  return {
    stop: [{ command: hookCommand(app, 'notify.mjs', ['stop', '--host', 'cursor']), timeout: 10 }],
  }
}

/**
 * 当前宿主两个组件的启用状态（依据安装状态记录）。
 * @param {import('../kernel/config.mjs').InstallState} state
 * @param {string} hostId
 */
export function enabledAddons(state, hostId) {
  return {
    guard: state.addons.guard.includes(hostId),
    notify: state.addons.notify.includes(hostId),
  }
}

/**
 * 启用或停用一个附加组件。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {HostAdapter} host
 * @param {AddonName} addon
 * @param {boolean} enable
 * @param {{ guard: boolean, notify: boolean }} enabledAfter 本次操作之后的目标状态
 * @returns {AddonResult}
 */
export function applyAddon(ctx, host, addon, enable, enabledAfter) {
  if (!host.capabilities[addon]) return { status: 'unsupported' }

  if (host.id === 'codex') {
    const configPath = host.codexConfigPath(ctx.home)
    if (!configPath) return { status: 'unsupported' }
    if (enable) {
      const existing = readText(configPath)
      const state = codexNotifyTopLevelState(existing)
      if (state === 'user') return { status: 'blocked', detail: 'user-notify-exists' }
      if (state === 'managed' || state === 'wrapped') return { status: 'enabled' }
      // 不存在受管行，写入一行
      const line = 'notify = ["helloagents-js", "codex-notify"] # helloagents-managed'
      writeTextAtomic(configPath, `${existing || ''}\n${line}\n`)
      return { status: 'enabled' }
    }
    // 禁用：移除受管 notify 行
    const existing = readText(configPath)
    if (existing) {
      const lines = existing.replace(/\r\n/g, '\n').split('\n')
      const kept = lines.filter((l) => !(l.includes('notify') && l.includes('# helloagents-managed')))
      const result = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
      if (result) writeTextAtomic(configPath, `${result}\n`)
      else removePath(configPath)
    }
    return { status: 'disabled' }
  }

  if (host.id === 'grok') {
    writeGrokHooksFile(ctx, host, enabledAfter)
    return { status: enable ? 'enabled' : 'disabled' }
  }

  if (host.id === 'hermes') {
    writeHermesHooksFile(ctx, host, enabledAfter)
    return { status: enable ? 'enabled' : 'disabled' }
  }

  if (host.id === 'cursor') {
    const hooksPath = host.cursorHooksPath(ctx.home)
    if (!hooksPath) return { status: 'unsupported' }
    const filter = addon === 'guard' ? '/guard.mjs' : '/notify.mjs'
    if (enable) {
      upsertCursorHooks(hooksPath, cursorEntries(ctx.app, addon), { home: ctx.home, commandFilter: filter })
    } else {
      removeCursorHooks(hooksPath, { home: ctx.home, commandFilter: filter })
    }
    return { status: enable ? 'enabled' : 'disabled' }
  }

  const settingsPath = host.settingsPath(ctx.home)
  if (!settingsPath) return { status: 'unsupported' }
  const filter = addon === 'guard' ? '/guard.mjs' : '/notify.mjs'
  if (enable) {
    upsertSettingsHooks(settingsPath, settingsEntries(ctx.app, addon, host.id), {
      home: ctx.home,
      commandFilter: filter,
    })
  } else {
    removeSettingsHooks(settingsPath, { home: ctx.home, commandFilter: filter })
  }
  return { status: enable ? 'enabled' : 'disabled' }
}

/**
 * 检查附加组件在宿主上的落盘状态是否与安装记录一致。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {HostAdapter} host
 * @param {AddonName} addon
 * @returns {boolean}
 */
export function addonPresent(ctx, host, addon) {
  const filter = addon === 'guard' ? '/guard.mjs' : '/notify.mjs'
  /** @param {unknown} value */
  const containsOwnedCommand = (value) => {
    const text = JSON.stringify(value ?? {})
    return text.includes(toPosix(ctx.app)) && text.includes(filter)
  }
  if (host.id === 'codex') {
    const configPath = host.codexConfigPath(ctx.home)
    if (!configPath) return false
    const state = codexNotifyTopLevelState(readText(configPath))
    return state === 'managed' || state === 'wrapped'
  }
  if (host.id === 'grok') return containsOwnedCommand(readJson(host.grokHooksPath(ctx.home) ?? ''))
  if (host.id === 'hermes') return containsOwnedCommand(readJson(host.hermesHooksPath(ctx.home) ?? ''))
  if (host.id === 'cursor') return containsOwnedCommand(readJson(host.cursorHooksPath(ctx.home) ?? ''))
  return containsOwnedCommand(readJson(host.settingsPath(ctx.home) ?? ''))
}

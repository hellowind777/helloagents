/**
 * 附加组件（guard 危险拦截、notify 完成提醒）的启停。
 * 每个宿主按注册表声明的能力接入；不支持的组合直接明示，不做模拟。
 */
import { join } from 'node:path'
import { readJson, removePath, writeTextAtomic } from '../kernel/fsx.mjs'
import { toPosix } from '../kernel/paths.mjs'
import { codexNotifyState, disableCodexNotify, enableCodexNotify } from '../hosts/codex-toml.mjs'
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
 * Grok 使用独立的 hooks 文件，文件整体归我们管理：
 * 按当前启用的组件重写全文；两个组件都停用时删除文件。
 * @param {import('./main.mjs').CliContext} ctx
 * @param {HostAdapter} host
 * @param {{ guard: boolean, notify: boolean }} enabled
 */
function writeGrokHooksFile(ctx, host, enabled) {
  const filePath = host.grokHooksPath(ctx.home)
  if (!filePath) return
  if (!enabled.guard && !enabled.notify) {
    removePath(filePath)
    return
  }
  /** @type {Record<string, unknown[]>} */
  const hooks = {}
  if (enabled.guard) {
    hooks.PreToolUse = [
      {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: hookCommand(ctx.app, 'guard.mjs', ['--host', 'grok']), timeout: 5 },
        ],
      },
    ]
  }
  if (enabled.notify) {
    hooks.Stop = [
      {
        matcher: '',
        hooks: [
          { type: 'command', command: hookCommand(ctx.app, 'notify.mjs', ['stop', '--host', 'grok']), timeout: 10 },
        ],
      },
    ]
  }
  writeTextAtomic(filePath, `${JSON.stringify({ version: 1, hooks }, null, 2)}\n`)
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
      const result = enableCodexNotify(configPath, ctx.app)
      if (!result.ok) return { status: 'blocked', detail: 'user-notify-exists' }
      return { status: 'enabled' }
    }
    disableCodexNotify(configPath)
    return { status: 'disabled' }
  }

  if (host.id === 'grok') {
    writeGrokHooksFile(ctx, host, enabledAfter)
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
    return configPath ? codexNotifyState(configPath) === 'managed' : false
  }
  if (host.id === 'grok') return containsOwnedCommand(readJson(host.grokHooksPath(ctx.home) ?? ''))
  if (host.id === 'cursor') return containsOwnedCommand(readJson(host.cursorHooksPath(ctx.home) ?? ''))
  return containsOwnedCommand(readJson(host.settingsPath(ctx.home) ?? ''))
}

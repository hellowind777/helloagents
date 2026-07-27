/**
 * 宿主注册表：四个宿主的能力声明与文件路径，全项目唯一来源。
 * 安装、卸载、体检、文档中的宿主矩阵都从这里取数。
 */
import { join } from 'node:path'

/**
 * @typedef {'claude' | 'codex' | 'grok' | 'cursor'} HostId
 *
 * @typedef {Object} HostCapabilities
 * @property {boolean} inject 支持注入方式（用户级载体文件）
 * @property {boolean} plugin 支持插件方式（宿主原生插件或扩展）
 * @property {boolean} guard 支持危险命令拦截附加组件
 * @property {boolean} notify 支持完成提醒附加组件
 *
 * @typedef {Object} HostAdapter
 * @property {HostId} id
 * @property {string} label
 * @property {string[]} aliases
 * @property {HostCapabilities} capabilities
 * @property {(home: string) => string | null} carrierPath 注入方式的载体文件
 * @property {(home: string) => string | null} settingsPath settings 形态 hooks 所在文件
 * @property {(home: string) => string | null} cursorHooksPath cursor 形态 hooks 所在文件
 * @property {(home: string) => string | null} grokHooksPath grok 独立 hooks 文件
 * @property {(home: string) => string | null} codexConfigPath Codex 的 config.toml
 */

/** @type {HostAdapter[]} */
export const HOSTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    aliases: ['claude-code', 'cc'],
    capabilities: { inject: true, plugin: true, guard: true, notify: true },
    carrierPath: (home) => join(home, '.claude', 'CLAUDE.md'),
    settingsPath: (home) => join(home, '.claude', 'settings.json'),
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    codexConfigPath: () => null,
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    aliases: ['codex-cli'],
    capabilities: { inject: true, plugin: false, guard: false, notify: true },
    carrierPath: (home) => join(home, '.codex', 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    codexConfigPath: (home) => join(home, '.codex', 'config.toml'),
  },
  {
    id: 'grok',
    label: 'Grok Build',
    aliases: ['grok-build'],
    capabilities: { inject: true, plugin: false, guard: true, notify: true },
    carrierPath: (home) => join(home, '.grok', 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: (home) => join(home, '.grok', 'hooks', 'helloagents.json'),
    codexConfigPath: () => null,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    aliases: [],
    capabilities: { inject: false, plugin: true, guard: true, notify: true },
    carrierPath: () => null,
    settingsPath: () => null,
    cursorHooksPath: (home) => join(home, '.cursor', 'hooks.json'),
    grokHooksPath: () => null,
    codexConfigPath: () => null,
  },
]

/** 全部宿主标识。 */
export const HOST_IDS = HOSTS.map((host) => host.id)

/**
 * 按标识或别名查找宿主。
 * @param {string} name
 * @returns {HostAdapter | null}
 */
export function findHost(name) {
  const value = String(name || '').trim().toLowerCase()
  return HOSTS.find((host) => host.id === value || host.aliases.includes(value)) ?? null
}

/**
 * 支持某项能力的宿主列表。
 * @param {keyof HostCapabilities} capability
 */
export function hostsWithCapability(capability) {
  return HOSTS.filter((host) => host.capabilities[capability])
}

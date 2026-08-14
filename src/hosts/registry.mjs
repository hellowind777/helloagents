/**
 * 宿主注册表：各宿主的能力声明与文件路径，全项目唯一来源。
 * 安装、卸载、体检、文档中的宿主矩阵都从这里取数。
 */
import { join } from 'node:path'

/**
 * DeepSeek Harness 宿主目录。$DSH_HOME 环境变量优先；
 * 测试隔离（HELLOAGENTS_HOME）下固定为 home/.dsh。
 * @param {string} home
 * @returns {string}
 */
export function resolveDshHome(home) {
  if (process.env.HELLOAGENTS_HOME) return join(home, '.dsh')
  const env = String(process.env.DSH_HOME || '').trim()
  return env || join(home, '.dsh')
}

/**
 * @typedef {'claude' | 'codex' | 'grok' | 'cursor' | 'hermes' | 'dsh'} HostId
 *
 * @typedef {Object} HostCapabilities
 * @property {boolean} standard 支持标准模式（用户级载体文件）
 * @property {boolean} global 支持全局模式（宿主原生插件市场）
 * @property {boolean} guard 支持危险命令拦截附加组件
 * @property {boolean} notify 支持完成提醒附加组件
 *
 * @typedef {Object} HostAdapter
 * @property {HostId} id
 * @property {string} label
 * @property {string[]} aliases
 * @property {HostCapabilities} capabilities
 * @property {(home: string) => string | null} carrierPath 标准模式的载体文件
 * @property {(home: string) => string | null} settingsPath settings 形态 hooks 所在文件
 * @property {(home: string) => string | null} cursorHooksPath cursor 形态 hooks 所在文件
 * @property {(home: string) => string | null} grokHooksPath grok 独立 hooks 文件
 * @property {(home: string) => string | null} hermesHooksPath Hermes 独立 hooks 文件
 * @property {(home: string) => string | null} codexConfigPath Codex 的 config.toml
 */

/** @type {HostAdapter[]} */
export const HOSTS = [
  {
    id: 'claude',
    label: 'Claude Code',
    aliases: ['claude-code', 'cc'],
    capabilities: { standard: true, global: true, guard: true, notify: true },
    carrierPath: (home) => join(home, '.claude', 'CLAUDE.md'),
    settingsPath: (home) => join(home, '.claude', 'settings.json'),
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    hermesHooksPath: () => null,
    codexConfigPath: () => null,
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    aliases: ['codex-cli'],
    capabilities: { standard: true, global: true, guard: true, notify: true },
    carrierPath: (home) => join(home, '.codex', 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    hermesHooksPath: () => null,
    codexConfigPath: (home) => join(home, '.codex', 'config.toml'),
  },
  {
    id: 'grok',
    label: 'Grok Build',
    aliases: ['grok-build'],
    capabilities: { standard: true, global: true, guard: true, notify: true },
    carrierPath: (home) => join(home, '.grok', 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: (home) => join(home, '.grok', 'hooks', 'helloagents.json'),
    hermesHooksPath: () => null,
    codexConfigPath: () => null,
  },
  {
    id: 'hermes',
    label: 'Hermes',
    aliases: ['hm'],
    capabilities: { standard: true, global: true, guard: true, notify: true },
    carrierPath: (home) => join(home, '.hermes', 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    hermesHooksPath: (home) => join(home, '.hermes', 'hooks', 'helloagents.json'),
    codexConfigPath: () => null,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    aliases: [],
    capabilities: { standard: true, global: true, guard: true, notify: true },
    carrierPath: () => null,
    settingsPath: () => null,
    cursorHooksPath: (home) => join(home, '.cursor', 'hooks.json'),
    grokHooksPath: () => null,
    hermesHooksPath: () => null,
    codexConfigPath: () => null,
  },
  {
    id: 'dsh',
    label: 'DeepSeek Harness',
    aliases: ['deepseek-harness', 'harness', 'deepseek'],
    capabilities: { standard: true, global: true, guard: false, notify: false },
    // dsh-agent-instructions 原生读取 $DSH_HOME/AGENTS.md
    carrierPath: (home) => join(resolveDshHome(home), 'AGENTS.md'),
    settingsPath: () => null,
    cursorHooksPath: () => null,
    grokHooksPath: () => null,
    hermesHooksPath: () => null,
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

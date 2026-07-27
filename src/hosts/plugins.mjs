/**
 * 各宿主插件方式的安装与卸载。
 * 原则：优先调用宿主自带命令；命令缺失或失败时返回手动步骤，不静默失败。
 */
import { join } from 'node:path'
import { copyPath, fileExists, readJson, removePath, writeTextAtomic } from '../kernel/fsx.mjs'
import { readKernelText } from './carriers.mjs'
import { runHostCommand } from './native.mjs'

export const CLAUDE_PLUGIN_ID = 'helloagents@helloagents'

/**
 * @typedef {Object} PluginResult
 * @property {boolean} ok
 * @property {string} [manualSteps] 自动执行失败时的手动步骤说明
 */

/**
 * Claude Code：注册本地市场并安装插件。
 * @param {string} appDirPath
 * @returns {PluginResult}
 */
export function installClaudePlugin(appDirPath) {
  const marketplace = runHostCommand('claude', ['plugin', 'marketplace', 'add', appDirPath])
  const install = marketplace.missing
    ? marketplace
    : runHostCommand('claude', ['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', 'user'])
  if (!marketplace.missing && install.ok) return { ok: true }
  return {
    ok: false,
    manualSteps: `claude plugin marketplace add "${appDirPath}" && claude plugin install ${CLAUDE_PLUGIN_ID}`,
  }
}

/** @returns {PluginResult} */
export function uninstallClaudePlugin() {
  const uninstall = runHostCommand('claude', ['plugin', 'uninstall', CLAUDE_PLUGIN_ID])
  runHostCommand('claude', ['plugin', 'marketplace', 'remove', 'helloagents'])
  if (uninstall.ok || uninstall.missing) return { ok: true }
  return {
    ok: false,
    manualSteps: `claude plugin uninstall ${CLAUDE_PLUGIN_ID} && claude plugin marketplace remove helloagents`,
  }
}

/** Cursor 本地插件目录。官方约定即为 ~/.cursor/plugins/local/<插件名>/。 @param {string} home */
export function cursorPluginDir(home) {
  return join(home, '.cursor', 'plugins', 'local', 'helloagents')
}

/** 内核在 Cursor 插件中的规则文件。 @param {string} pluginDir */
export function cursorRuleFile(pluginDir) {
  return join(pluginDir, 'rules', 'helloagents-kernel.mdc')
}

/** @param {string} pluginDir */
function isOurCursorPlugin(pluginDir) {
  const manifest = /** @type {{ name?: string } | null} */ (
    readJson(join(pluginDir, '.cursor-plugin', 'plugin.json'))
  )
  return manifest?.name === 'helloagents'
}

/**
 * 内核转成 Cursor 规则文件内容。
 * 只写 alwaysApply、不写 description：Cursor 已知缺陷是二者同时存在时，
 * 规则会被降级为「按需取用」而不是始终生效。
 * @param {string} kernelText
 */
export function buildCursorRule(kernelText) {
  return `---\nalwaysApply: true\n---\n\n${kernelText.trimEnd()}\n`
}

/**
 * Cursor：生成本地插件目录。
 * 只放 Cursor 认识的三样东西——清单、技能、规则；运行副本的 CLI 与资源不进插件目录。
 * 附加组件的 hooks 指向 ~/.helloagents/app，不依赖这里。
 * @param {string} home
 * @param {string} appDirPath
 * @returns {PluginResult}
 */
export function installCursorPlugin(home, appDirPath) {
  const target = cursorPluginDir(home)
  if (fileExists(target) && !isOurCursorPlugin(target)) {
    return { ok: false, manualSteps: `目标目录已被其他内容占用，请先移除：${target}` }
  }
  const kernel = readKernelText(appDirPath)
  if (kernel === null) {
    return { ok: false, manualSteps: `运行副本缺少内核文件：${join(appDirPath, 'prompts', 'kernel.md')}` }
  }
  removePath(target)
  copyPath(join(appDirPath, '.cursor-plugin'), join(target, '.cursor-plugin'))
  copyPath(join(appDirPath, 'skills'), join(target, 'skills'))
  writeTextAtomic(cursorRuleFile(target), buildCursorRule(kernel))
  return { ok: true }
}

/**
 * @param {string} home
 * @returns {PluginResult}
 */
export function uninstallCursorPlugin(home) {
  const target = cursorPluginDir(home)
  if (!fileExists(target)) return { ok: true }
  if (!isOurCursorPlugin(target)) return { ok: true }
  removePath(target)
  return { ok: true }
}

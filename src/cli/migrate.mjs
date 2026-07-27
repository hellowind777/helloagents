/**
 * 从 3.x 迁移：清理旧版本写入用户机器的全部内容。
 * 原则：只清理能明确识别为 3.x 产物的条目；不能确认归属的内容一律不动并提示人工确认。
 */
import { join } from 'node:path'
import { readInstallState, writeInstallState } from '../kernel/config.mjs'
import { fileExists, readText, removePath, writeTextAtomic } from '../kernel/fsx.mjs'
import { helloagentsRoot, installStatePath } from '../kernel/paths.mjs'
import {
  hasMarkedBlock,
  isLegacyHookCommand,
  readMarkedVersion,
  removeMarkedBlock,
} from '../kernel/ownership.mjs'
import { MANAGED_SUFFIX } from '../hosts/codex-toml.mjs'
import { removeCursorHooks, removeSettingsHooks } from '../hosts/hooks-config.mjs'
import { cursorPluginDir } from '../hosts/plugins.mjs'
import { HOSTS } from '../hosts/registry.mjs'

/**
 * 清理 config.toml 中 3.x 写入的受管行与 hook 信任段。
 * 只删除带管理标记且内容能识别为 3.x 的行；用户自己的配置不动。
 * @param {string} configPath
 * @returns {{ removed: number, userNotifyMentionsHelloagents: boolean }}
 */
export function cleanLegacyCodexConfig(configPath) {
  const text = readText(configPath)
  if (text === null) return { removed: 0, userNotifyMentionsHelloagents: false }
  const lines = text.split(/\r?\n/)
  /** @type {string[]} */
  const kept = []
  let removed = 0
  let inLegacySection = false
  let userNotifyMentionsHelloagents = false

  for (const line of lines) {
    const isHeader = /^\s*\[/.test(line)
    if (isHeader) inLegacySection = false
    if (/^\s*\[hooks\.state\./.test(line)) {
      inLegacySection = true
      removed += 1
      continue
    }
    if (inLegacySection) {
      removed += 1
      continue
    }
    const managed = line.trimEnd().endsWith(MANAGED_SUFFIX)
    if (managed && isLegacyHookCommand(line)) {
      removed += 1
      continue
    }
    if (!managed && /^\s*notify\s*=/.test(line) && line.includes('helloagents')) {
      userNotifyMentionsHelloagents = true
    }
    kept.push(line)
  }

  if (removed > 0) writeTextAtomic(configPath, kept.join('\n'))
  return { removed, userNotifyMentionsHelloagents }
}

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {string} projectDir
 */
export function runMigrate(ctx, projectDir) {
  /** @type {string[]} */
  const cleaned = []
  /** @param {string} item */
  const record = (item) => {
    cleaned.push(item)
    ctx.log(ctx.t('migrate.item', { item }))
  }

  for (const host of HOSTS) {
    const carrier = host.carrierPath(ctx.home)
    if (carrier && hasMarkedBlock(carrier) && readMarkedVersion(carrier) === null) {
      removeMarkedBlock(carrier)
      record(carrier)
    }
    const settingsPath = host.settingsPath(ctx.home)
    if (settingsPath && removeSettingsHooks(settingsPath, { home: ctx.home, legacyOnly: true }) > 0) {
      record(settingsPath)
    }
    const cursorHooks = host.cursorHooksPath(ctx.home)
    if (cursorHooks && removeCursorHooks(cursorHooks, { home: ctx.home, legacyOnly: true }) > 0) {
      record(cursorHooks)
    }
    const codexConfig = host.codexConfigPath(ctx.home)
    if (codexConfig) {
      const result = cleanLegacyCodexConfig(codexConfig)
      if (result.removed > 0) record(codexConfig)
      if (result.userNotifyMentionsHelloagents) {
        ctx.log(ctx.t('migrate.codexManualNotify', { path: codexConfig }))
      }
    }
  }

  // Gemini CLI 已不再是宿主，它下面的一切都按残留处理：
  // GEMINI.md 里的受管块无论版本号一律移除，settings.json 只清 3.x 的 hooks。
  const geminiCarrier = join(ctx.home, '.gemini', 'GEMINI.md')
  if (hasMarkedBlock(geminiCarrier)) {
    removeMarkedBlock(geminiCarrier)
    record(geminiCarrier)
  }
  const geminiSettings = join(ctx.home, '.gemini', 'settings.json')
  if (removeSettingsHooks(geminiSettings, { home: ctx.home, legacyOnly: true }) > 0) {
    record(geminiSettings)
  }
  const state = readInstallState(ctx.home)
  if (state.hosts.gemini) {
    delete state.hosts.gemini
    state.addons.guard = state.addons.guard.filter((id) => id !== 'gemini')
    state.addons.notify = state.addons.notify.filter((id) => id !== 'gemini')
    writeInstallState(ctx.home, state)
    record(`${installStatePath(ctx.home)} (gemini)`)
    ctx.log(ctx.t('migrate.geminiExtension'))
  }
  const codexHooksJson = join(ctx.home, '.codex', 'hooks.json')
  if (removeSettingsHooks(codexHooksJson, { home: ctx.home, legacyOnly: true }) > 0) {
    record(codexHooksJson)
  }
  const grokLegacyHooks = join(ctx.home, '.grok', 'hooks', 'helloagents.json')
  if (fileExists(grokLegacyHooks) && isLegacyHookCommand(readText(grokLegacyHooks) ?? '')) {
    removePath(grokLegacyHooks)
    record(grokLegacyHooks)
  }
  const legacyCursorPlugin = cursorPluginDir(ctx.home)
  if (fileExists(join(legacyCursorPlugin, 'scripts'))) {
    removePath(legacyCursorPlugin)
    record(legacyCursorPlugin)
  }

  const root = helloagentsRoot(ctx.home)
  for (const leftover of ['helloagents', 'helloagents.json', 'runtime', 'host-projections']) {
    const target = join(root, leftover)
    if (fileExists(target)) {
      removePath(target)
      record(target)
    }
  }

  const projectSessions = join(projectDir, '.helloagents', 'sessions')
  if (fileExists(projectSessions)) {
    removePath(projectSessions)
    record(projectSessions)
  }

  if (cleaned.length === 0) {
    ctx.log(ctx.t('migrate.nothing'))
  } else {
    ctx.log(ctx.t('migrate.done', { count: cleaned.length }))
  }
}

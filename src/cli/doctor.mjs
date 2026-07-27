/**
 * 体检：对照安装记录检查实际落盘状态，并识别 3.x 残留。
 * 结论使用稳定的问题编号（code），文案与编号分离，便于测试与脚本消费。
 */
import { join } from 'node:path'
import { readInstallState } from '../kernel/config.mjs'
import { fileExists, readJson, readText } from '../kernel/fsx.mjs'
import { helloagentsRoot, installStatePath } from '../kernel/paths.mjs'
import { hasMarkedBlock, isLegacyHookCommand, readMarkedVersion } from '../kernel/ownership.mjs'
import { codexNotifyState } from '../hosts/codex-toml.mjs'
import { cursorPluginDir, cursorRuleFile } from '../hosts/plugins.mjs'
import { HOSTS, findHost } from '../hosts/registry.mjs'
import { carrierStatus } from '../hosts/carriers.mjs'
import { addonPresent, enabledAddons } from './addons.mjs'
import { appVersion } from './runtime-app.mjs'

/**
 * @typedef {Object} DoctorIssue
 * @property {string} code
 * @property {'error' | 'warn'} level
 * @property {string} host
 * @property {string} message
 */

/**
 * @typedef {Object} DoctorReport
 * @property {string} version
 * @property {{ path: string, version: string | null, status: 'ok' | 'missing' | 'outdated' }} app
 * @property {DoctorIssue[]} issues
 * @property {string[]} legacy 3.x 残留的所在位置
 */

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @returns {DoctorReport}
 */
export function buildDoctorReport(ctx) {
  const state = readInstallState(ctx.home)
  /** @type {DoctorIssue[]} */
  const issues = []
  /** @type {string[]} */
  const legacy = []

  const currentAppVersion = appVersion(ctx.app)
  /** @type {DoctorReport['app']} */
  const app = {
    path: ctx.app,
    version: currentAppVersion,
    status:
      currentAppVersion === null ? 'missing' : currentAppVersion === ctx.version ? 'ok' : 'outdated',
  }
  if (Object.keys(state.hosts).length > 0 && app.status !== 'ok') {
    issues.push({
      code: `app-${app.status}`,
      level: 'error',
      host: '-',
      message: `${ctx.app} (${currentAppVersion ?? 'missing'})`,
    })
  }

  for (const [hostId, install] of Object.entries(state.hosts)) {
    const host = findHost(hostId)
    if (!host) continue

    const carrier = host.carrierPath(ctx.home)
    if (carrier) {
      const status = carrierStatus(carrier, ctx.version)
      if (status !== 'ok') {
        issues.push({
          code: `carrier-${status}`,
          level: status === 'missing' ? 'error' : 'warn',
          host: host.id,
          message: carrier,
        })
      }
    }

    if (install.mode === 'plugin' && host.id === 'cursor') {
      const pluginDir = cursorPluginDir(ctx.home)
      const ruleFile = cursorRuleFile(pluginDir)
      const manifest = /** @type {{ version?: string } | null} */ (
        readJson(join(pluginDir, '.cursor-plugin', 'plugin.json'))
      )
      if (!manifest || !fileExists(join(pluginDir, 'skills'))) {
        issues.push({ code: 'plugin-missing', level: 'error', host: host.id, message: pluginDir })
      } else if (!fileExists(ruleFile)) {
        issues.push({ code: 'plugin-rule-missing', level: 'error', host: host.id, message: ruleFile })
      } else if (manifest.version !== ctx.version) {
        issues.push({
          code: 'plugin-outdated',
          level: 'warn',
          host: host.id,
          message: `${pluginDir} (${manifest.version ?? 'unknown'})`,
        })
      }
    }

    const addons = enabledAddons(state, host.id)
    for (const addon of /** @type {const} */ (['guard', 'notify'])) {
      if (!addons[addon]) continue
      if (host.id === 'codex' && addon === 'notify') {
        const configPath = host.codexConfigPath(ctx.home)
        const notifyState = configPath ? codexNotifyState(configPath) : 'none'
        if (notifyState === 'user') {
          issues.push({ code: 'addon-notify-user-conflict', level: 'warn', host: host.id, message: configPath ?? '' })
        } else if (notifyState !== 'managed') {
          issues.push({ code: 'addon-notify-missing', level: 'error', host: host.id, message: configPath ?? '' })
        }
        continue
      }
      if (!addonPresent(ctx, host, addon)) {
        issues.push({ code: `addon-${addon}-missing`, level: 'error', host: host.id, message: '' })
      }
    }
  }

  const root = helloagentsRoot(ctx.home)
  for (const leftover of ['helloagents', 'helloagents.json', 'runtime', 'host-projections']) {
    if (fileExists(join(root, leftover))) legacy.push(join(root, leftover))
  }
  for (const host of HOSTS) {
    const carrier = host.carrierPath(ctx.home)
    if (carrier && hasMarkedBlock(carrier) && readMarkedVersion(carrier) === null) {
      legacy.push(carrier)
    }
    for (const configFile of [host.settingsPath(ctx.home), host.cursorHooksPath(ctx.home)]) {
      if (!configFile) continue
      const text = JSON.stringify(readJson(configFile) ?? {})
      if (isLegacyHookCommand(text)) legacy.push(configFile)
    }
    const codexConfig = host.codexConfigPath(ctx.home)
    if (codexConfig) {
      const text = readText(codexConfig) ?? ''
      if (text.split(/\r?\n/).some((line) => isLegacyHookCommand(line))) legacy.push(codexConfig)
    }
  }
  for (const hooksDir of ['.grok', '.hermes']) {
    const hooksFile = join(ctx.home, hooksDir, 'hooks', 'helloagents.json')
    if (fileExists(hooksFile) && isLegacyHookCommand(readText(hooksFile) ?? '')) {
      legacy.push(hooksFile)
    }
  }
  const legacyCursorPlugin = cursorPluginDir(ctx.home)
  if (fileExists(join(legacyCursorPlugin, 'scripts'))) legacy.push(legacyCursorPlugin)
  // Gemini CLI 已不再是宿主，它留下的一切都算残留。
  const geminiCarrier = join(ctx.home, '.gemini', 'GEMINI.md')
  if (hasMarkedBlock(geminiCarrier)) legacy.push(geminiCarrier)
  if (state.hosts.gemini) legacy.push(`${installStatePath(ctx.home)} (gemini)`)

  return { version: ctx.version, app, issues, legacy: [...new Set(legacy)] }
}

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {{ json: boolean }} options
 * @returns {number} 进程退出码
 */
export function runDoctor(ctx, options) {
  const report = buildDoctorReport(ctx)
  if (options.json) {
    ctx.log(JSON.stringify(report, null, 2))
  } else {
    const errors = report.issues.filter((issue) => issue.level === 'error').length
    const warnings = report.issues.filter((issue) => issue.level === 'warn').length
    if (report.issues.length === 0 && report.legacy.length === 0) {
      ctx.log(ctx.t('doctor.ok'))
    } else {
      ctx.log(ctx.t('doctor.issues', { errors, warnings }))
      for (const issue of report.issues) {
        ctx.log(`  [${issue.level}] ${issue.host} ${issue.code} ${issue.message}`.trimEnd())
      }
      if (errors > 0) ctx.log(ctx.t('doctor.hint.reinstall'))
      if (report.legacy.length > 0) {
        for (const item of report.legacy) ctx.log(`  [legacy] ${item}`)
        ctx.log(ctx.t('doctor.hint.migrate'))
      }
    }
  }
  return report.issues.some((issue) => issue.level === 'error') ? 1 : 0
}

/**
 * 体检：对照安装记录检查实际落盘状态，并识别 3.x 残留。
 * 结论使用稳定的问题编号（code），文案与编号分离，便于测试与脚本消费。
 */
import { join } from 'node:path'
import { readInstallState } from '../kernel/config.mjs'
import { fileExists, readJson, readText } from '../kernel/fsx.mjs'
import { helloagentsRoot, installStatePath } from '../kernel/paths.mjs'
import { hasMarkedBlock, isLegacyHookCommand, readMarkedVersion } from '../kernel/ownership.mjs'
import { isHooksFeatureDisabled, codexModelInstructionsState, codexNotifyTopLevelState, MANAGED_TOML_SUFFIX } from '../hosts/codex-config.mjs'
import {
  claudeMarketplacePluginDir,
  codexPluginDir,
  cursorPluginDir,
  cursorRuleFile,
  grokMarketplacePluginDir,
  hermesPluginDir,
  resolveHermesHome,
} from '../hosts/plugins.mjs'
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

    if (install.mode === 'global') {
      let pluginDir = ''
      let manifestPath = ''
      if (host.id === 'claude') {
        pluginDir = claudeMarketplacePluginDir(ctx.home)
        manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json')
      } else if (host.id === 'codex') {
        pluginDir = codexPluginDir(ctx.home)
        manifestPath = join(pluginDir, '.codex-plugin', 'plugin.json')
      } else if (host.id === 'grok') {
        pluginDir = grokMarketplacePluginDir(ctx.home)
        manifestPath = join(pluginDir, 'plugin.json')
      } else if (host.id === 'cursor') {
        pluginDir = cursorPluginDir(ctx.home)
        manifestPath = join(pluginDir, '.cursor-plugin', 'plugin.json')
      } else if (host.id === 'hermes') {
        const hermesHome = resolveHermesHome(ctx.home)
        pluginDir = hermesPluginDir(hermesHome)
        manifestPath = join(pluginDir, 'skills')
      }
      if (pluginDir) {
        const manifest = /** @type {{ version?: string } | null} */ (readJson(manifestPath))
        const skillsOk = fileExists(join(pluginDir, 'skills', 'hello-plan', 'SKILL.md'))
        if (!skillsOk && !fileExists(join(pluginDir, 'skills'))) {
          issues.push({ code: 'plugin-missing', level: 'error', host: host.id, message: pluginDir })
        } else if (manifest && manifest.version && manifest.version !== ctx.version) {
          issues.push({ code: 'plugin-outdated', level: 'warn', host: host.id, message: `${pluginDir} (${manifest.version})` })
        }
        // Cursor 额外检查规则文件
        if (host.id === 'cursor') {
          const ruleFile = cursorRuleFile(pluginDir)
          if (!fileExists(ruleFile)) {
            issues.push({ code: 'plugin-rule-missing', level: 'error', host: host.id, message: ruleFile })
          }
        }
      }
    }

    // 标准层基础落盘（全局模式叠加在标准层之上，两种模式都检查）
    {
      const linkPath = join(ctx.home, `.${host.id}`, 'helloagents')
      if (!fileExists(linkPath)) {
        issues.push({ code: 'symlink-missing', level: 'warn', host: host.id, message: linkPath })
      }

      let hooksPath = ''
      if (host.id === 'claude') hooksPath = String(host.settingsPath(ctx.home) || '')
      else if (host.id === 'codex') hooksPath = join(ctx.home, '.codex', 'hooks.json')
      else if (host.id === 'grok') hooksPath = join(ctx.home, '.grok', 'hooks', 'helloagents.json')
      else if (host.id === 'cursor') hooksPath = join(ctx.home, '.cursor', 'hooks.json')

      if (hooksPath) {
        const hooksData = readJson(hooksPath)
        if (!hooksData || !hooksData.hooks) {
          issues.push({ code: 'hooks-missing', level: 'error', host: host.id, message: hooksPath })
        }
      }

      // Codex 专属：config.toml 受管条目
      if (host.id === 'codex') {
        const configPath = String(host.codexConfigPath(ctx.home))
        const configText = readText(configPath)
        if (codexModelInstructionsState(configText) !== 'managed') {
          issues.push({ code: 'codex-model-instructions-missing', level: 'error', host: host.id, message: configPath })
        }
        if (isHooksFeatureDisabled(configText)) {
          issues.push({ code: 'codex-hooks-feature-disabled', level: 'warn', host: host.id, message: configPath })
        }
      }
    }

    const addons = enabledAddons(state, host.id)
    for (const addon of /** @type {const} */ (['guard', 'notify'])) {
      if (!addons[addon]) continue
      if (host.id === 'codex' && addon === 'notify') {
        const configPath = host.codexConfigPath(ctx.home)
        const configText = configPath ? readText(configPath) : null
        const notifyState = configPath ? codexNotifyTopLevelState(configText) : 'none'
        if (notifyState === 'user') {
          issues.push({ code: 'addon-notify-user-conflict', level: 'warn', host: host.id, message: configPath ?? '' })
        } else if (notifyState !== 'managed' && notifyState !== 'wrapped') {
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
      // 仅标记无法识别为当前版本受管的旧版 hooks 为遗留
      if (isLegacyHookCommand(text) && !text.includes('helloagents-js')) legacy.push(configFile)
    }
    const codexConfig = host.codexConfigPath(ctx.home)
    if (codexConfig) {
      const text = readText(codexConfig) ?? ''
      // 跳过带管理标记的行——那是当前版本写入的，不是 3.x 残留
      if (text.split(/\r?\n/).some((line) => isLegacyHookCommand(line) && !line.includes(MANAGED_TOML_SUFFIX))) legacy.push(codexConfig)
    }
  }
  for (const hooksDir of ['.grok', '.hermes']) {
    const hooksFile = join(ctx.home, hooksDir, 'hooks', 'helloagents.json')
    const hooksText = readText(hooksFile) ?? ''
    if (fileExists(hooksFile) && isLegacyHookCommand(hooksText) && !hooksText.includes('helloagents-js')) {
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

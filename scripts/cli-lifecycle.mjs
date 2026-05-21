import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULTS, ensureConfig } from './cli-config.mjs'
import {
  detectHostMode as detectRuntimeHostMode,
  getHostLabel as resolveHostLabel,
  normalizeHost as normalizeLifecycleHost,
} from './cli-host-detect.mjs'
import { installAllHosts, runHostLifecycle } from './cli-lifecycle-hosts.mjs'
import { ensureDir, safeJson, safeWrite } from './cli-utils.mjs'

export const HOSTS = ['claude', 'gemini', 'codex']

const runtime = {
  home: '',
  pkgRoot: '',
  sourceRoot: '',
  helloagentsHome: '',
  configFile: '',
  pkgVersion: '',
  msg: (cn, en) => en || cn,
  ok: console.log,
  printInstallMsg: () => {},
}

export function initCliLifecycle(options) {
  Object.assign(runtime, options)
}

function sanitizeSettings(settings = {}) {
  const next = settings && typeof settings === 'object' ? { ...settings } : {}
  const tracked = next.host_install_modes
  if (!tracked || typeof tracked !== 'object' || Array.isArray(tracked)) {
    next.host_install_modes = {}
    return next
  }
  next.host_install_modes = Object.fromEntries(
    Object.entries(tracked).filter(([host, mode]) => HOSTS.includes(host) && typeof mode === 'string' && mode),
  )
  return next
}

export function readSettings(shouldEnsure = false) {
  if (shouldEnsure) ensureConfig(runtime.helloagentsHome, runtime.configFile, safeJson, ensureDir)
  return sanitizeSettings(safeJson(runtime.configFile) || {})
}

function writeSettings(settings) {
  const sanitized = sanitizeSettings(settings)
  ensureDir(runtime.helloagentsHome)
  writeFileSync(runtime.configFile, JSON.stringify(sanitized, null, 2), 'utf-8')
}

function hasTrackedHostModes(settings) {
  return !!settings && typeof settings.host_install_modes === 'object' && !Array.isArray(settings.host_install_modes)
}

export function getTrackedHostMode(settings, host) {
  return hasTrackedHostModes(settings) ? settings.host_install_modes[host] || '' : ''
}

function setTrackedHostMode(settings, host, mode) {
  if (!hasTrackedHostModes(settings)) settings.host_install_modes = {}
  settings.host_install_modes[host] = mode
}

function clearTrackedHostMode(settings, host) {
  if (!hasTrackedHostModes(settings)) {
    settings.host_install_modes = {}
    return
  }
  delete settings.host_install_modes[host]
}

function clearAllTrackedHostModes(settings) {
  settings.host_install_modes = {}
}

function syncTrackedHostMode(settings, host, result, mode) {
  if (!result?.skipped && result?.ok !== false) {
    setTrackedHostMode(settings, host, mode)
    return
  }
  if (result?.trackedModeOnFailure) {
    setTrackedHostMode(settings, host, result.trackedModeOnFailure)
    return
  }
  clearTrackedHostMode(settings, host)
}

function syncCleanupTrackedHostMode(settings, host, result) {
  if (result?.trackedModeOnFailure) {
    setTrackedHostMode(settings, host, result.trackedModeOnFailure)
    return
  }
  clearTrackedHostMode(settings, host)
}

export function normalizeHost(value = '') {
  return normalizeLifecycleHost(value)
}

function parseModeFlag(args) {
  const hasGlobal = args.includes('--global')
  const hasStandby = args.includes('--standby')
  if (hasGlobal && hasStandby) {
    throw new Error(runtime.msg('不能同时指定 --global 和 --standby', 'Cannot use --global and --standby together'))
  }
  if (hasGlobal) return 'global'
  if (hasStandby) return 'standby'
  return ''
}

function parseLifecycleArgs(args) {
  const explicitMode = parseModeFlag(args)
  const wantsAll = args.includes('--all')
  const positionals = args.filter((arg) => !arg.startsWith('--'))
  const unknownFlags = args.filter((arg) => arg.startsWith('--') && !['--global', '--standby', '--all'].includes(arg))
  if (unknownFlags.length) {
    throw new Error(runtime.msg(`未知参数: ${unknownFlags.join(', ')}`, `Unknown flags: ${unknownFlags.join(', ')}`))
  }
  if (wantsAll && positionals.length) {
    throw new Error(runtime.msg('`--all` 不能与具体 CLI 同时使用', '`--all` cannot be combined with a specific CLI'))
  }
  if (positionals.length > 1) {
    throw new Error(runtime.msg(`参数过多: ${positionals.join(' ')}`, `Too many arguments: ${positionals.join(' ')}`))
  }
  const host = normalizeLifecycleHost(wantsAll ? 'all' : (positionals[0] || 'all'))
  if (!host) {
    throw new Error(runtime.msg(`不支持的 CLI: ${positionals[0]}`, `Unsupported CLI: ${positionals[0]}`))
  }
  return { host, explicitMode }
}

export function detectHostMode(host) {
  return detectRuntimeHostMode(host, runtime)
}

export function getHostLabel(host) {
  return resolveHostLabel(host)
}

function resolvePreviousHostMode(settings, host) {
  return detectHostMode(host) || getTrackedHostMode(settings, host) || ''
}

function buildPreviousHostModes(settings) {
  return Object.fromEntries(HOSTS.map((host) => [host, resolvePreviousHostMode(settings, host)]))
}

function resolveHostMode(host, explicitMode, settings) {
  if (explicitMode) return explicitMode
  return detectHostMode(host)
    || getTrackedHostMode(settings, host)
    || DEFAULTS.install_mode
}

function resolveInstallMode(explicitMode, settings) {
  return explicitMode || settings.install_mode || DEFAULTS.install_mode
}


export function syncVersion() {
  const packageRoot = runtime.sourceRoot || runtime.pkgRoot
  const targets = [
    join(packageRoot, '.claude-plugin', 'plugin.json'),
    join(packageRoot, '.codex-plugin', 'plugin.json'),
    join(packageRoot, 'gemini-extension.json'),
  ]
  for (const path of targets) {
    const obj = safeJson(path)
    if (!obj) continue
    obj.version = runtime.pkgVersion
    safeWrite(path, JSON.stringify(obj, null, 2) + '\n')
  }
  const marketPath = join(packageRoot, '.claude-plugin', 'marketplace.json')
  const market = safeJson(marketPath)
  if (market?.plugins?.[0]?.version) {
    market.plugins[0].version = runtime.pkgVersion
    safeWrite(marketPath, JSON.stringify(market, null, 2) + '\n')
  }
  runtime.ok(`Version synced to ${runtime.pkgVersion}`)
}

export function switchMode(newMode) {
  const config = readSettings(true)
  const oldMode = config.install_mode || DEFAULTS.install_mode
  const isRefresh = oldMode === newMode
  const previousModes = buildPreviousHostModes(config)

  if (!isRefresh) {
    config.install_mode = newMode
    runtime.ok(runtime.msg(`模式已切换为: ${newMode}`, `Mode switched to: ${newMode}`))
  } else {
    runtime.ok(runtime.msg(`当前已是 ${newMode} 模式，正在刷新安装`, `Already in ${newMode} mode, refreshing installation`))
  }

  const results = installAllHosts(runtime, newMode, { previousModes })
  clearAllTrackedHostModes(config)
  for (const host of HOSTS) {
    syncTrackedHostMode(config, host, results?.[host], newMode)
  }
  writeSettings(config)
  runtime.printInstallMsg(newMode, isRefresh ? 'refresh' : 'switch')
}

function runAllHostsLifecycle(action, explicitMode) {
  if (action === 'cleanup' || action === 'uninstall') {
    console.log(`\n  HelloAGENTS — ${runtime.msg('正在清理', 'Cleaning up')}\n`)
    const settings = existsSync(runtime.configFile) ? readSettings() : {}
    const results = {}
    for (const host of HOSTS) {
      const mode = explicitMode || resolveHostMode(host, '', settings)
      results[host] = runHostLifecycle(runtime, action, host, mode, {
        previousMode: resolvePreviousHostMode(settings, host),
      })
    }
    if (existsSync(runtime.configFile)) {
      for (const host of HOSTS) {
        syncCleanupTrackedHostMode(settings, host, results[host])
      }
      writeSettings(settings)
    }
    const hasFailures = Object.values(results).some((result) => result?.ok === false)
    runtime.ok(runtime.msg(
      hasFailures ? '部分 CLI 仍需手动清理' : '所有 CLI 配置已清理',
      hasFailures ? 'Some CLI cleanup still needs manual action' : 'All CLI configurations cleaned',
    ))
    console.log(runtime.msg(
      '  ℹ ~/.helloagents/ 已保留（如需彻底清理请手动删除）\n  ℹ 已自动尝试移除 Claude/Gemini 插件或扩展；如宿主命令不可用，请手动执行对应移除命令',
      '  ℹ ~/.helloagents/ preserved (delete manually if desired)\n  ℹ Claude/Gemini plugin or extension removal was attempted automatically; if host commands are unavailable, remove them manually',
    ))
    console.log()
    return
  }

  const settings = readSettings(true)
  const previousModes = buildPreviousHostModes(settings)
  if (!explicitMode) {
    for (const host of HOSTS) {
      const mode = resolveHostMode(host, '', settings)
      const result = runHostLifecycle(runtime, action, host, mode, {
        previousMode: previousModes[host],
      })
      syncTrackedHostMode(settings, host, result, mode)
    }
    writeSettings(settings)
    const modes = Object.values(settings.host_install_modes || {})
    const displayMode = modes.length && modes.every((mode) => mode === modes[0])
      ? modes[0]
      : settings.install_mode || DEFAULTS.install_mode
    runtime.printInstallMsg(displayMode, action === 'update' ? 'refresh' : 'install')
    return
  }

  const mode = resolveInstallMode(explicitMode, settings)
  if (explicitMode) settings.install_mode = explicitMode
  const results = installAllHosts(runtime, mode, { previousModes })
  settings.host_install_modes = {}
  for (const host of HOSTS) {
    syncTrackedHostMode(settings, host, results?.[host], mode)
  }
  writeSettings(settings)
  runtime.printInstallMsg(mode, action === 'update' ? 'refresh' : 'install')
}

export function runScopedLifecycle(action, rawArgs) {
  const { host, explicitMode } = parseLifecycleArgs(rawArgs)
  if (host === 'all') {
    runAllHostsLifecycle(action, explicitMode)
    return
  }

  const shouldEnsure = action === 'install' || action === 'update'
  const settings = readSettings(shouldEnsure)
  const mode = resolveHostMode(host, explicitMode, settings)
  const result = runHostLifecycle(runtime, action, host, mode, {
    previousMode: resolvePreviousHostMode(settings, host),
  })

  if (action === 'cleanup' || action === 'uninstall') {
    if (existsSync(runtime.configFile)) {
      syncCleanupTrackedHostMode(settings, host, result)
      writeSettings(settings)
    }
  } else if (!result.skipped) {
    syncTrackedHostMode(settings, host, result, mode)
    writeSettings(settings)
  }
}

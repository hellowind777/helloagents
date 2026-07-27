/**
 * 安装、卸载与更新。
 * 内核注入对所有具备载体文件的宿主统一执行；插件方式在此之上叠加宿主原生插件。
 * 切换安装方式时先移除旧方式的落盘内容，再写入新方式。
 */
import { readInstallState, writeInstallState } from '../kernel/config.mjs'
import { removePath } from '../kernel/fsx.mjs'
import { helloagentsRoot } from '../kernel/paths.mjs'
import { injectKernel, readKernelText, removeKernel } from '../hosts/carriers.mjs'
import {
  installClaudePlugin,
  installCursorPlugin,
  uninstallClaudePlugin,
  uninstallCursorPlugin,
} from '../hosts/plugins.mjs'
import { applyAddon, enabledAddons } from './addons.mjs'
import { removeApp, syncApp } from './runtime-app.mjs'

/** @typedef {import('../hosts/registry.mjs').HostAdapter} HostAdapter */
/** @typedef {import('./main.mjs').CliContext} CliContext */

/**
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 * @returns {{ ok: boolean, manualSteps?: string }}
 */
function installHostPlugin(ctx, host) {
  if (host.id === 'claude') return installClaudePlugin(ctx.app)
  if (host.id === 'cursor') return installCursorPlugin(ctx.home, ctx.app)
  return { ok: false }
}

/**
 * @param {CliContext} ctx
 * @param {HostAdapter} host
 */
function uninstallHostPlugin(ctx, host) {
  if (host.id === 'claude') return uninstallClaudePlugin()
  if (host.id === 'cursor') return uninstallCursorPlugin(ctx.home)
  return { ok: true }
}

/**
 * 安装到指定宿主。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} targets
 * @param {'inject' | 'plugin' | null} requestedMode
 */
export function runInstall(ctx, targets, requestedMode) {
  const version = syncApp(ctx.packageRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(`内核文件缺失（kernel file missing）: ${ctx.app}/prompts/kernel.md`)

  const state = readInstallState(ctx.home)
  let installedCount = 0

  for (const host of targets) {
    const desired = requestedMode ?? (host.capabilities.plugin ? 'plugin' : 'inject')
    if (!host.capabilities[desired]) {
      const supported = ['inject', 'plugin'].filter(
        (mode) => host.capabilities[/** @type {'inject' | 'plugin'} */ (mode)],
      )
      ctx.log(
        ctx.t('install.mode.unsupported', {
          host: host.label,
          mode: desired,
          supported: supported.join('、') || '-',
        }),
      )
      continue
    }

    const prior = state.hosts[host.id]
    if (prior && prior.mode !== desired) {
      if (prior.mode === 'plugin') uninstallHostPlugin(ctx, host)
      ctx.log(ctx.t('install.switched', { host: host.label, from: prior.mode, to: desired }))
    }

    let finalMode = desired
    if (desired === 'plugin') {
      const result = installHostPlugin(ctx, host)
      if (result.ok) {
        ctx.log(ctx.t('install.plugin.done', { host: host.label }))
      } else {
        if (result.manualSteps) {
          ctx.log(ctx.t('install.plugin.manual', { host: host.label, steps: result.manualSteps }))
        }
        if (host.capabilities.inject) {
          finalMode = 'inject'
          ctx.log(ctx.t('install.plugin.fallback', { host: host.label }))
        } else {
          continue
        }
      }
    }

    const carrier = host.carrierPath(ctx.home)
    if (carrier) {
      injectKernel(carrier, kernel, ctx.version)
      ctx.log(ctx.t('install.inject.done', { host: host.label, path: carrier }))
    }

    state.hosts[host.id] = {
      mode: finalMode,
      version: ctx.version,
      updatedAt: new Date().toISOString(),
    }
    installedCount += 1

    const addons = enabledAddons(state, host.id)
    if (addons.guard) applyAddon(ctx, host, 'guard', true, addons)
    if (addons.notify) applyAddon(ctx, host, 'notify', true, addons)
  }

  writeInstallState(ctx.home, state)
  ctx.log(ctx.t('install.summary', { count: installedCount }))
}

/**
 * 从指定宿主卸载；--all 时同时删除运行副本。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} targets
 * @param {{ all: boolean, purge: boolean }} options
 */
export function runUninstall(ctx, targets, options) {
  const state = readInstallState(ctx.home)

  for (const host of targets) {
    applyAddon(ctx, host, 'guard', false, { guard: false, notify: state.addons.notify.includes(host.id) })
    applyAddon(ctx, host, 'notify', false, { guard: false, notify: false })
    state.addons.guard = state.addons.guard.filter((id) => id !== host.id)
    state.addons.notify = state.addons.notify.filter((id) => id !== host.id)

    const carrier = host.carrierPath(ctx.home)
    if (carrier) removeKernel(carrier)
    if (state.hosts[host.id]?.mode === 'plugin' || host.capabilities.plugin) {
      uninstallHostPlugin(ctx, host)
    }
    delete state.hosts[host.id]
    ctx.log(ctx.t('uninstall.host.done', { host: host.label }))
  }

  writeInstallState(ctx.home, state)

  if (options.all) {
    removeApp(ctx.app)
    ctx.log(ctx.t('uninstall.app.removed', { path: ctx.app }))
    if (options.purge) {
      removePath(helloagentsRoot(ctx.home))
    } else {
      ctx.log(ctx.t('uninstall.config.kept', { path: helloagentsRoot(ctx.home) }))
    }
  }
}

/**
 * 刷新运行副本与全部已安装宿主。
 * @param {CliContext} ctx
 * @param {HostAdapter[]} allHosts
 */
export function runUpdate(ctx, allHosts) {
  const state = readInstallState(ctx.home)
  const installed = allHosts.filter((host) => state.hosts[host.id])
  if (installed.length === 0) {
    ctx.log(ctx.t('update.nothing'))
    return
  }
  const version = syncApp(ctx.packageRoot, ctx.app)
  ctx.log(ctx.t('app.synced', { path: ctx.app, version: version ?? ctx.version }))
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(`内核文件缺失（kernel file missing）: ${ctx.app}/prompts/kernel.md`)

  for (const host of installed) {
    const carrier = host.carrierPath(ctx.home)
    if (carrier) injectKernel(carrier, kernel, ctx.version)
    if (state.hosts[host.id]?.mode === 'plugin' && host.id === 'cursor') {
      installCursorPlugin(ctx.home, ctx.app)
    }
    const addons = enabledAddons(state, host.id)
    if (addons.guard) applyAddon(ctx, host, 'guard', true, addons)
    if (addons.notify) applyAddon(ctx, host, 'notify', true, addons)
    const entry = state.hosts[host.id]
    if (entry) {
      entry.version = ctx.version
      entry.updatedAt = new Date().toISOString()
    }
  }

  writeInstallState(ctx.home, state)
  ctx.log(ctx.t('update.done', { count: installed.length, version: ctx.version }))
}

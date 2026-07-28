/**
 * 命令行入口：参数解析与命令分发。
 */
import { join } from 'node:path'
import { readInstallState, readUserConfig, writeInstallState } from '../kernel/config.mjs'
import { readJson } from '../kernel/fsx.mjs'
import { createTranslator, detectLanguage } from '../kernel/i18n.mjs'
import { appDir, packageRoot, userHome } from '../kernel/paths.mjs'
import { HOSTS, HOST_IDS, findHost } from '../hosts/registry.mjs'
import { applyAddon, enabledAddons } from './addons.mjs'
import { runDoctor } from './doctor.mjs'
import { runHelp } from './help.mjs'
import { runInit } from './init.mjs'
import { runInstall, runUninstall, runUpdate } from './install.mjs'
import { runMigrate } from './migrate.mjs'
import { runSyncVersion } from './sync-version.mjs'

/**
 * @typedef {Object} CliContext
 * @property {string} home
 * @property {string} app 运行副本目录
 * @property {string} packageRoot
 * @property {string} version
 * @property {(key: string, vars?: Record<string, string | number>) => string} t
 * @property {(line: string) => void} log
 */

const KNOWN_FLAGS = new Set([
  '--all', '--inject', '--plugin', '--standard', '--global',
  '--json', '--purge', '--check',
])

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Set<string>} */
  const flags = new Set()
  /** @type {string[]} */
  const positionals = []
  let lang = ''
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index] ?? ''
    if (value === '--lang') {
      lang = argv[index + 1] ?? ''
      index += 1
    } else if (KNOWN_FLAGS.has(value)) {
      flags.add(value)
    } else if (value.startsWith('--')) {
      flags.add(value)
    } else {
      positionals.push(value)
    }
  }
  return { flags, positionals, lang }
}

/**
 * @param {CliContext} ctx
 * @param {string[]} names
 * @param {boolean} all
 */
function resolveTargets(ctx, names, all) {
  if (all) return [...HOSTS]
  if (names.length === 0) throw new Error(ctx.t('cli.noTargets'))
  return names.map((name) => {
    const host = findHost(name)
    if (!host) throw new Error(ctx.t('cli.unknownHost', { host: name, hosts: HOST_IDS.join('、') }))
    return host
  })
}

/**
 * 附加组件命令：helloagents guard on|off [宿主…]
 * @param {CliContext} ctx
 * @param {'guard' | 'notify'} addon
 * @param {string[]} positionals
 */
function runAddonCommand(ctx, addon, positionals) {
  const action = positionals[0]
  if (action !== 'on' && action !== 'off') {
    throw new Error(ctx.t('cli.unknownCommand', { command: `${addon} ${action ?? ''}`.trim() }))
  }
  const enable = action === 'on'
  const state = readInstallState(ctx.home)
  const names = positionals.slice(1)
  const targets =
    names.length > 0
      ? resolveTargets(ctx, names, false)
      : HOSTS.filter((host) => state.hosts[host.id] && host.capabilities[addon])
  if (targets.length === 0) {
    ctx.log(ctx.t('addon.noHosts', { addon }))
    return
  }
  for (const host of targets) {
    if (!host.capabilities[addon]) {
      ctx.log(ctx.t('addon.unsupported', { host: host.label, addon }))
      continue
    }
    const list = state.addons[addon]
    const nextList = enable ? [...new Set([...list, host.id])] : list.filter((id) => id !== host.id)
    state.addons[addon] = nextList
    const result = applyAddon(ctx, host, addon, enable, enabledAddons(state, host.id))
    if (result.status === 'blocked' && result.detail === 'user-notify-exists') {
      state.addons[addon] = list
      const configPath = host.codexConfigPath(ctx.home) ?? ''
      ctx.log(
        ctx.t('addon.codexUserNotify', {
          line: `notify = ["node", "${ctx.app.replaceAll('\\', '/')}/src/addons/notify.mjs", "codex"]`,
        }),
      )
      ctx.log(`  ${configPath}`)
      continue
    }
    if (result.status === 'unsupported') {
      state.addons[addon] = list
      ctx.log(ctx.t('addon.unsupported', { host: host.label, addon }))
      continue
    }
    ctx.log(ctx.t(enable ? 'addon.enabled' : 'addon.disabled', { host: host.label, addon }))
  }
  writeInstallState(ctx.home, state)
}

/**
 * @param {string[]} argv
 * @returns {number} 进程退出码
 */
export function runCli(argv) {
  const { flags, positionals, lang } = parseArgs(argv)
  const home = userHome()
  const root = packageRoot()
  const pkg = /** @type {{ version?: string } | null} */ (readJson(join(root, 'package.json')))
  const config = readUserConfig(home)
  const language =
    lang === 'cn' || lang === 'en' ? lang : (config.language ?? detectLanguage(process.env))
  const t = createTranslator(language)

  /** @type {CliContext} */
  const ctx = {
    home,
    app: appDir(home),
    packageRoot: root,
    version: pkg?.version ?? '0.0.0',
    t,
    log: (line) => console.log(line),
  }

  const command = positionals[0] ?? 'help'
  const rest = positionals.slice(1)

  try {
    // 优先处理 --version、--help（会被 flag 解析吞掉，到不了 switch 分支）。
    if (command === 'help' && (flags.has('--version') || flags.has('-v'))) {
      ctx.log(ctx.version)
      return 0
    }
    if (command === 'help' && (flags.has('--help') || flags.has('-h'))) {
      runHelp(ctx, language)
      return 0
    }

    switch (command) {
      case 'install': {
        if ((flags.has('--inject') || flags.has('--standard')) && (flags.has('--plugin') || flags.has('--global'))) {
          throw new Error(t('cli.modeConflict'))
        }
        const mode = (flags.has('--inject') || flags.has('--standard')) ? 'standard'
          : (flags.has('--plugin') || flags.has('--global')) ? 'global' : null
        runInstall(ctx, resolveTargets(ctx, rest, flags.has('--all')), mode)
        return 0
      }
      case 'uninstall': {
        const all = flags.has('--all')
        runUninstall(ctx, resolveTargets(ctx, rest, all), { all, purge: flags.has('--purge') })
        return 0
      }
      case 'update':
        runUpdate(ctx, rest.length > 0 ? resolveTargets(ctx, rest, false) : HOSTS)
        return 0
      case 'init':
        runInit(ctx, process.cwd())
        return 0
      case 'doctor':
        return runDoctor(ctx, { json: flags.has('--json') })
      case 'migrate':
        runMigrate(ctx, process.cwd())
        return 0
      case 'guard':
      case 'notify':
        runAddonCommand(ctx, command, rest)
        return 0
      case 'sync-version':
        return runSyncVersion(ctx, { check: flags.has('--check') })
      case 'version':
      case '--version':
      case '-v':
        ctx.log(ctx.version)
        return 0
      case 'help':
      case '--help':
      case '-h':
        runHelp(ctx, language)
        return 0
      default:
        ctx.log(t('cli.unknownCommand', { command }))
        runHelp(ctx, language)
        return 1
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`✗ ${t('cli.error', { message })}`)
    return 1
  }
}

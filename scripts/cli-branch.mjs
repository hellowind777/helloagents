import { spawnSync } from 'node:child_process'

import { normalizeHost } from './cli-lifecycle.mjs'

const DEFAULT_REPO_SPEC = 'github:hellowind777/helloagents'

function runCommand(command, args) {
  const needsShell = process.platform === 'win32' && /\.cmd$/i.test(command)
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    errors: 'replace',
    shell: needsShell,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function parseModeFlag(args) {
  const hasGlobal = args.includes('--global')
  const hasStandby = args.includes('--standby')
  if (hasGlobal && hasStandby) throw new Error('Cannot use --global and --standby together')
  if (hasGlobal) return 'global'
  if (hasStandby) return 'standby'
  return ''
}

function parseTarget(args) {
  const wantsAll = args.includes('--all')
  const positionals = args.filter((arg) => !arg.startsWith('--'))
  if (!positionals.length) throw new Error('Missing branch or ref')
  if (wantsAll && positionals.length > 1) {
    throw new Error('`--all` cannot be combined with a specific CLI')
  }

  const branch = positionals[0]
  const host = wantsAll ? 'all' : normalizeHost(positionals[1] || 'all')
  if (!host) throw new Error(`Unsupported CLI: ${positionals[1]}`)
  if (positionals.length > 2) throw new Error(`Too many arguments: ${positionals.join(' ')}`)
  return { branch, host }
}

function parseBranchArgs(args) {
  const unknownFlags = args.filter((arg) => (
    arg.startsWith('--') && !['--global', '--standby', '--all'].includes(arg)
  ))
  if (unknownFlags.length) throw new Error(`Unknown flags: ${unknownFlags.join(', ')}`)
  return {
    ...parseTarget(args),
    mode: parseModeFlag(args),
  }
}

function buildPackageSpec(ref) {
  if (/^(github:|git\+|https?:|file:)/i.test(ref)) return ref
  return `${DEFAULT_REPO_SPEC}#${ref}`
}

function buildUpdateArgs({ host, mode }) {
  return [
    'update',
    host === 'all' ? '--all' : host,
    ...(mode ? [`--${mode}`] : []),
  ]
}

export function runBranchSwitch(args, options = {}) {
  const parsed = parseBranchArgs(args)
  const npmCommand = options.npmCommand || process.env.HELLOAGENTS_NPM_CMD || 'npm'
  const helloagentsCommand = options.helloagentsCommand || process.env.HELLOAGENTS_BIN_CMD || 'helloagents'

  const packageSpec = buildPackageSpec(parsed.branch)
  runCommand(npmCommand, ['install', '-g', packageSpec])
  runCommand(helloagentsCommand, buildUpdateArgs(parsed))
}

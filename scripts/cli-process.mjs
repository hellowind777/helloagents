import { spawnSync } from 'node:child_process'

/**
 * Run a command on all platforms, including Windows .cmd/.bat files, without
 * relying on child_process shell=true argument concatenation.
 */
export function spawnCommandSync(command, args = [], options = {}) {
  const normalizedArgs = Array.isArray(args) ? args.map((arg) => String(arg)) : []
  const isWindowsShellScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(String(command || ''))
  if (!isWindowsShellScript) {
    return spawnSync(command, normalizedArgs, options)
  }

  const comspec = process.env.ComSpec || 'cmd.exe'
  return spawnSync(comspec, ['/d', '/s', '/c', String(command || ''), ...normalizedArgs], options)
}

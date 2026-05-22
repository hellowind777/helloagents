#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PKG_ROOT = join(__dirname, '..')
const PLAT = platform()

function shellQuote(value = '') {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export function resolveSoundPath(event = '', pkgRoot = PKG_ROOT) {
  const filePath = join(pkgRoot, 'assets', 'sounds', `${event}.wav`)
  return existsSync(filePath) ? filePath : ''
}

export function buildWindowsSoundCommand(filePath = '') {
  return `(New-Object System.Media.SoundPlayer '${String(filePath || '').replace(/'/g, "''")}').PlaySync()`
}

function playWindows(filePath) {
  const result = spawnSync('powershell', [
    '-NoProfile',
    '-c',
    buildWindowsSoundCommand(filePath),
  ], {
    encoding: 'utf-8',
    windowsHide: true,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'PowerShell sound playback failed').trim())
  }
}

function playMac(filePath) {
  const result = spawnSync('afplay', [filePath], {
    encoding: 'utf-8',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'afplay failed').trim())
  }
}

function playLinux(filePath) {
  const script = `if command -v aplay >/dev/null 2>&1; then aplay -q ${shellQuote(filePath)}; elif command -v paplay >/dev/null 2>&1; then paplay ${shellQuote(filePath)}; else printf '\\a'; fi`
  const result = spawnSync('sh', ['-c', script], {
    encoding: 'utf-8',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'Linux sound playback failed').trim())
  }
}

export function playSoundEvent(event = '', pkgRoot = PKG_ROOT) {
  const soundPath = resolveSoundPath(event, pkgRoot)
  if (!soundPath) {
    process.stderr.write('\x07')
    return false
  }

  if (PLAT === 'win32') {
    playWindows(soundPath)
    return true
  }
  if (PLAT === 'darwin') {
    playMac(soundPath)
    return true
  }

  playLinux(soundPath)
  return true
}

function main() {
  const event = process.argv[2] || 'complete'
  try {
    playSoundEvent(event)
  } catch {
    process.stderr.write('\x07')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

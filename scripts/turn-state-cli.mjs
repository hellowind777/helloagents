#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'turn-state.mjs')
const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  windowsHide: true,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(typeof result.status === 'number' ? result.status : 1)

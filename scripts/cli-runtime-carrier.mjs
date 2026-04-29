import { join } from 'node:path'

import { safeJson } from './cli-utils.mjs'

export function readCarrierSettings(home) {
  return safeJson(join(home, '.helloagents', 'helloagents.json')) || {}
}

export function buildRuntimeCarrier(bootstrapContent, settings = {}) {
  void settings
  const normalized = String(bootstrapContent || '').trim()
  if (!normalized) return ''

  return `${normalized}\n`
}

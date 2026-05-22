import { join } from 'node:path'

import { safeJson, withCarrierProfile } from './cli-utils.mjs'

export function readCarrierSettings(home) {
  return safeJson(join(home, '.helloagents', 'helloagents.json')) || {}
}

export function buildRuntimeCarrier(bootstrapContent, settings = {}, options = {}) {
  void settings
  const normalized = String(bootstrapContent || '').trim()
  if (!normalized) return ''

  return withCarrierProfile(normalized, options.profile || '')
}

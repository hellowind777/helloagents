import { join } from 'node:path'

import { DEFAULTS } from './cli-config.mjs'
import { safeJson } from './cli-utils.mjs'

const CARRIER_SETTING_KEYS = [
  'output_language',
  'output_format',
  'notify_level',
  'ralph_loop_enabled',
  'guard_enabled',
  'kb_create_mode',
  'project_store_mode',
  'commit_attribution',
]

function pickCarrierSettings(settings) {
  const merged = { ...DEFAULTS, ...(settings || {}) }
  return Object.fromEntries(CARRIER_SETTING_KEYS.map((key) => [key, merged[key]]))
}

export function readCarrierSettings(home) {
  return pickCarrierSettings(safeJson(join(home, '.helloagents', 'helloagents.json')) || {})
}

export function buildRuntimeCarrier(bootstrapContent, settings = {}) {
  const normalized = String(bootstrapContent || '').trim()
  if (!normalized) return ''

  const carrierSettings = pickCarrierSettings(settings)
  const snapshot = Object.keys(carrierSettings).length
    ? `\n\n## 当前用户设置\n\`\`\`json\n${JSON.stringify(carrierSettings, null, 2)}\n\`\`\``
    : ''

  return `${normalized}${snapshot}\n`
}

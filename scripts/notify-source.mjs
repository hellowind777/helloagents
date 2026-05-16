import { basename, normalize, resolve } from 'node:path'

import { resolveSessionToken } from './session-token.mjs'

const HOST_LABELS = {
  codex: 'Codex',
  claude: 'Claude Code',
  gemini: 'Gemini',
}

function normalizePath(filePath = '') {
  if (!filePath) return ''
  try {
    return normalize(resolve(filePath))
  } catch {
    return filePath
  }
}

function readStringCandidate(input, key) {
  if (!input || typeof input !== 'object') return ''
  const value = input[key]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

function resolveProjectLabel(cwd = '') {
  const normalized = normalizePath(cwd)
  if (!normalized) return ''
  const label = basename(normalized)
  return label || normalized.replace(/\\/g, '/')
}

export function resolveNotificationSource({
  host = '',
  cwd = '',
  payload = {},
  env = process.env,
  ppid = process.ppid,
} = {}) {
  const hostLabel = HOST_LABELS[host] || 'Agent'
  const projectLabel = resolveProjectLabel(readStringCandidate(payload, 'cwd') || cwd)
  const sessionToken = resolveSessionToken({ payload, env, ppid })
  const parts = [hostLabel]

  if (projectLabel) parts.push(projectLabel)
  if (sessionToken) parts.push(`会话 ${sessionToken}`)

  return {
    hostLabel,
    projectLabel,
    sessionToken,
    sourceLabel: parts.join(' · '),
  }
}

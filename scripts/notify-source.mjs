import { basename, normalize, resolve } from 'node:path'

const HOST_LABELS = {
  codex: 'Codex',
  claude: 'Claude Code',
  gemini: 'Gemini',
}

const PAYLOAD_SESSION_KEYS = [
  'sessionId',
  'session_id',
  'session',
  'conversationId',
  'conversation_id',
  'conversation',
  'threadId',
  'thread_id',
  'thread',
  'windowId',
  'window_id',
  'window',
  'tabId',
  'tab_id',
  'tab',
  'requestId',
  'request_id',
]

const ENV_SESSION_KEYS = [
  'HELLOAGENTS_NOTIFY_SESSION_ID',
  'WT_SESSION',
  'TERM_SESSION_ID',
  'KITTY_WINDOW_ID',
  'ALACRITTY_WINDOW_ID',
  'WINDOWID',
  'WEZTERM_PANE',
  'TAB_ID',
]

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

function sanitizeSessionToken(value = '') {
  const raw = String(value).trim().replace(/^[#:\s]+/, '')
  const segments = raw
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  const cleaned = segments.length > 1
    ? segments[segments.length - 1]
    : raw.replace(/[^a-zA-Z0-9_-]/g, '')

  if (!cleaned) return ''
  if (/^\d+$/.test(cleaned)) return cleaned
  return cleaned.slice(0, 8)
}

function resolveSessionToken(payload, env, ppid) {
  for (const key of PAYLOAD_SESSION_KEYS) {
    const value = sanitizeSessionToken(readStringCandidate(payload, key))
    if (value) return value
  }

  for (const key of ENV_SESSION_KEYS) {
    const value = sanitizeSessionToken(env?.[key] || '')
    if (value) return value
  }

  return ppid ? String(ppid) : ''
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
  const sessionToken = resolveSessionToken(payload, env, ppid)
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

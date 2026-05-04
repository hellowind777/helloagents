const PAYLOAD_SESSION_KEYS = [
  'sessionId',
  'session_id',
  'session',
  'conversationId',
  'conversation_id',
  'conversation',
  'threadId',
  'thread_id',
  'thread-id',
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

function readStringCandidate(input, key) {
  if (!input || typeof input !== 'object') return ''
  const value = input[key]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return ''
}

export function sanitizeSessionToken(value = '') {
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

export function resolveSessionToken({
  payload = {},
  env = process.env,
  ppid = process.ppid,
  allowPpidFallback = true,
} = {}) {
  for (const key of PAYLOAD_SESSION_KEYS) {
    const value = sanitizeSessionToken(readStringCandidate(payload, key))
    if (value) return value
  }

  for (const key of ENV_SESSION_KEYS) {
    const value = sanitizeSessionToken(env?.[key] || '')
    if (value) return value
  }

  return allowPpidFallback && ppid ? String(ppid) : ''
}

export { ENV_SESSION_KEYS, PAYLOAD_SESSION_KEYS }

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
]

const PROJECT_SESSION_PAYLOAD_KEYS = [
  'sessionId',
  'session_id',
  'session',
]

const PROJECT_CONVERSATION_PAYLOAD_KEYS = [
  'conversationId',
  'conversation_id',
  'conversation',
]

const PROJECT_THREAD_PAYLOAD_KEYS = [
  'threadId',
  'thread_id',
  'thread-id',
  'thread',
]

const PROJECT_PAYLOAD_SESSION_KEYS = [
  ...PROJECT_SESSION_PAYLOAD_KEYS,
  ...PROJECT_CONVERSATION_PAYLOAD_KEYS,
  ...PROJECT_THREAD_PAYLOAD_KEYS,
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

const PROJECT_ENV_SESSION_KEYS = [
  'HELLOAGENTS_NOTIFY_SESSION_ID',
]

const PROJECT_ALIAS_ENV_SESSION_KEYS = [
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

function resolveTokenFromKeys(input, keys = []) {
  for (const key of keys) {
    const value = sanitizeSessionToken(readStringCandidate(input, key))
    if (value) return value
  }
  return ''
}

export function resolveSessionToken({
  payload = {},
  env = process.env,
  ppid = process.ppid,
  allowPpidFallback = true,
} = {}) {
  const payloadToken = resolveTokenFromKeys(payload, PAYLOAD_SESSION_KEYS)
  if (payloadToken) return payloadToken

  const envToken = resolveTokenFromKeys(env, ENV_SESSION_KEYS)
  if (envToken) return envToken

  return allowPpidFallback && ppid ? String(ppid) : ''
}

export function resolveProjectSessionToken({
  payload = {},
  env = process.env,
} = {}) {
  const payloadToken = resolveTokenFromKeys(payload, PROJECT_PAYLOAD_SESSION_KEYS)
  if (payloadToken) return payloadToken
  return resolveTokenFromKeys(env, PROJECT_ENV_SESSION_KEYS)
}

export function resolveProjectSessionAliasToken({
  env = process.env,
} = {}) {
  return resolveTokenFromKeys(env, PROJECT_ALIAS_ENV_SESSION_KEYS)
}

export {
  ENV_SESSION_KEYS,
  PAYLOAD_SESSION_KEYS,
  PROJECT_ALIAS_ENV_SESSION_KEYS,
  PROJECT_CONVERSATION_PAYLOAD_KEYS,
  PROJECT_ENV_SESSION_KEYS,
  PROJECT_PAYLOAD_SESSION_KEYS,
  PROJECT_SESSION_PAYLOAD_KEYS,
  PROJECT_THREAD_PAYLOAD_KEYS,
}

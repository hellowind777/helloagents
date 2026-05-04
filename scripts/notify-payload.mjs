const PAYLOAD_KEY_ALIASES = {
  'thread-id': 'threadId',
  thread_id: 'threadId',
  'turn-id': 'turnId',
  turn_id: 'turnId',
  'session-id': 'sessionId',
  session_id: 'sessionId',
  'last-assistant-message': 'lastAssistantMessage',
  last_assistant_message: 'lastAssistantMessage',
  'input-messages': 'inputMessages',
  input_messages: 'inputMessages',
  hook_event_name: 'hookEventName',
  permission_mode: 'permissionMode',
  stop_hook_active: 'stopHookActive',
  'goal-id': 'goalId',
  goal_id: 'goalId',
}

function assignAlias(target, source, sourceKey, targetKey) {
  if (!Object.prototype.hasOwnProperty.call(source, sourceKey)) return
  if (target[targetKey] !== undefined) return
  target[targetKey] = source[sourceKey]
}

function readMessageText(entry) {
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object') return ''
  if (typeof entry.text === 'string') return entry.text
  if (typeof entry.content === 'string') return entry.content
  if (Array.isArray(entry.content)) {
    return entry.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export function normalizeNotifyPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const normalized = { ...payload }

  for (const [sourceKey, targetKey] of Object.entries(PAYLOAD_KEY_ALIASES)) {
    assignAlias(normalized, payload, sourceKey, targetKey)
  }

  if (!normalized.prompt && Array.isArray(normalized.inputMessages)) {
    normalized.prompt = normalized.inputMessages
      .map(readMessageText)
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return normalized
}

export { PAYLOAD_KEY_ALIASES }

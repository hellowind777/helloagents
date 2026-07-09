#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeNotifyPayload } from './notify-payload.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EVENT = String(process.argv[2] || '').trim().toLowerCase()

const EVENT_CONFIG = {
  'session-start': {
    script: 'notify.mjs',
    args: ['inject', '--cursor'],
    hookEventName: 'sessionStart',
  },
  'pre-tool-use': {
    script: 'guard.mjs',
    args: ['--cursor'],
    hookEventName: 'preToolUse',
  },
  'post-tool-use': {
    script: 'guard.mjs',
    args: ['post-write', '--cursor'],
    hookEventName: 'postToolUse',
  },
  'pre-compact': {
    script: 'notify.mjs',
    args: ['pre-compact', '--cursor'],
    hookEventName: 'preCompact',
  },
  'subagent-stop': {
    script: 'ralph-loop.mjs',
    args: ['subagent', '--cursor'],
    hookEventName: 'subagentStop',
  },
  stop: {
    script: 'notify.mjs',
    args: ['stop', '--cursor'],
    hookEventName: 'stop',
  },
}

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

function resolveWorkspaceRoot(payload = {}) {
  if (typeof payload.cwd === 'string' && payload.cwd.trim()) return payload.cwd.trim()
  if (Array.isArray(payload.workspace_roots)) {
    const first = payload.workspace_roots.find((entry) => typeof entry === 'string' && entry.trim())
    if (first) return first.trim()
  }
  const envRoot = String(process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || '').trim()
  return envRoot || process.cwd()
}

function normalizeCursorPayload(payload = {}, hookEventName = '') {
  const normalized = normalizeNotifyPayload(payload)
  normalized.cwd = resolveWorkspaceRoot(payload)
  if (!normalized.hook_event_name && hookEventName) normalized.hook_event_name = hookEventName
  if (!normalized.hookEventName && hookEventName) normalized.hookEventName = hookEventName

  if (!normalized.tool_name) {
    if (typeof payload.command === 'string' && payload.command.trim()) {
      normalized.tool_name = 'Shell'
      normalized.tool_input = {
        ...(normalized.tool_input && typeof normalized.tool_input === 'object' ? normalized.tool_input : {}),
        command: payload.command,
      }
    } else if (typeof payload.file_path === 'string' && payload.file_path.trim()) {
      normalized.tool_name = hookEventName === 'postToolUse' ? 'Write' : 'Read'
      normalized.tool_input = {
        ...(normalized.tool_input && typeof normalized.tool_input === 'object' ? normalized.tool_input : {}),
        file_path: payload.file_path,
        content: payload.content,
      }
    }
  }

  if (
    normalized.tool_output === undefined
    && typeof payload.tool_output === 'string'
  ) {
    normalized.tool_output = payload.tool_output
  }

  return normalized
}

function runInternalScript(scriptName, args, payload, hookEventName) {
  const result = spawnSync(process.execPath, [join(__dirname, scriptName), ...args], {
    input: JSON.stringify(normalizeCursorPayload(payload, hookEventName)),
    encoding: 'utf-8',
    env: {
      ...process.env,
      HELLOAGENTS_HOOK_EVENT: hookEventName,
    },
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '').trim() || `${scriptName} exited with code ${result.status}`)
  }

  const stdout = String(result.stdout || '').trim()
  if (!stdout) return {}
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(`Invalid JSON from ${scriptName}: ${stdout}`)
  }
}

function buildErrorResponse(event, error) {
  const reason = `[HelloAGENTS Cursor Hook] ${error?.message || error}`
  if (event === 'pre-tool-use') {
    return {
      permission: 'deny',
      user_message: reason,
      agent_message: reason,
    }
  }
  if (event === 'session-start') {
    return {
      additional_context: reason,
    }
  }
  return {}
}

function translatePermissionResponse(result = {}) {
  const denialReason = result?.hookSpecificOutput?.permissionDecisionReason || result?.reason || ''
  if (result?.hookSpecificOutput?.permissionDecision === 'deny' || result?.decision === 'block') {
    return {
      permission: 'deny',
      user_message: denialReason || '[HelloAGENTS] Operation blocked.',
      agent_message: denialReason || '[HelloAGENTS] Operation blocked.',
    }
  }
  return {}
}

function translateCursorResponse(event, result = {}) {
  if (event === 'session-start') {
    const additionalContext = result?.hookSpecificOutput?.additionalContext
    return additionalContext ? { additional_context: additionalContext } : {}
  }
  if (event === 'pre-tool-use') {
    return translatePermissionResponse(result)
  }
  if (event === 'post-tool-use') {
    const additionalContext = result?.hookSpecificOutput?.additionalContext
    return additionalContext ? { additional_context: additionalContext } : {}
  }
  if (event === 'stop' || event === 'subagent-stop') {
    if (result?.decision === 'block' && result?.reason) {
      return {
        followup_message: result.reason,
      }
    }
    return {}
  }
  return {}
}

function main() {
  const config = EVENT_CONFIG[EVENT]
  if (!config) {
    process.stderr.write(`cursor-hook.mjs: unknown event "${EVENT}"\n`)
    process.exit(1)
  }

  const payload = readStdinJson()
  try {
    const result = runInternalScript(config.script, config.args, payload, config.hookEventName)
    process.stdout.write(JSON.stringify(translateCursorResponse(EVENT, result)))
  } catch (error) {
    process.stdout.write(JSON.stringify(buildErrorResponse(EVENT, error)))
  }
}

main()

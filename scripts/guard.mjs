#!/usr/bin/env node
/**
 * HelloAGENTS Guard — Dangerous command blocker + L2 semantic security scan
 * Runs on PreToolUse hook for Bash/shell commands.
 * Runs on PostToolUse hook for Write/Edit (L2 scan).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { appendReplayEvent } from './replay-state.mjs'
import {
  DANGEROUS_PATTERNS,
  scanDangerousPackages,
  scanEnvCoverage,
  scanForSecrets,
  scanHighRiskCommands,
  scanShellSafetyWarnings,
  scanUnrequestedFiles,
} from './guard-rules.mjs'

const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json')
const IS_GEMINI = process.argv.includes('--gemini')
const HOST = IS_GEMINI ? 'gemini' : 'claude'
const HOOK_EVENT = process.env.HELLOAGENTS_HOOK_EVENT
  || (
    process.argv.includes('post-write')
      ? (IS_GEMINI ? 'AfterModel' : 'PostToolUse')
      : (IS_GEMINI ? 'BeforeTool' : 'PreToolUse')
  )

function readSettings() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function readHookInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

function emitHookPayload(payload) {
  process.stdout.write(JSON.stringify(payload))
}

function emitGuardEvent(cwd, event, source, reason, details = {}, payload = {}) {
  appendReplayEvent(cwd, {
    host: HOST,
    event,
    source,
    reason,
    details,
    payload,
  })
}

function buildPostWriteWarnings(data) {
  const content = data.tool_input?.content || data.tool_input?.new_string || ''
  const filePath = data.tool_input?.file_path || ''
  return [
    ...scanUnrequestedFiles(filePath, data.tool_name),
    ...(content ? [...scanForSecrets(content), ...scanDangerousPackages(content, filePath)] : []),
    ...scanEnvCoverage(filePath),
  ]
}

function postWriteScan(data) {
  if (readSettings().guard_enabled === false) return
  const warnings = buildPostWriteWarnings(data)
  if (warnings.length === 0) return

  emitHookPayload({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      additionalContext: `⚠️ [HelloAGENTS L2 安全扫描] 检测到潜在问题:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}\n请检查以上问题。`,
    },
  })
  emitGuardEvent(data.cwd || process.cwd(), 'guard_warning', 'post-write', '', {
    warnings,
    guardType: 'post-write-l2',
  }, data)
}

function handleDangerousCommand(data, command) {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (!pattern.test(command)) continue
    emitHookPayload({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENT,
          permissionDecision: 'deny',
          permissionDecisionReason: `[HelloAGENTS Guard] 已阻止：${reason}\n命令：${command.slice(0, 200)}`,
        },
    })
    emitGuardEvent(data.cwd || process.cwd(), 'guard_blocked', 'command', reason, {
      command: command.slice(0, 200),
      guardType: 'dangerous-command',
    }, data)
    return true
  }
  return false
}

function handleShellCommand(data) {
  const toolName = (data.tool_name || '').toLowerCase()
  if (!['bash', 'shell', 'terminal', 'command'].some((name) => toolName.includes(name))) return

  const command = data.tool_input?.command || data.tool_input?.input || ''
  if (!command) return

  if (handleDangerousCommand(data, command)) return

  const highRiskWarnings = scanHighRiskCommands(command).map((w) => w.reason)
  const shellSafetyWarnings = scanShellSafetyWarnings(command)

  if (highRiskWarnings.length === 0 && shellSafetyWarnings.length === 0) return

  const sections = []
  if (highRiskWarnings.length > 0) {
    sections.push(`⚠️ [HelloAGENTS 高风险操作提醒] 检测到高风险命令:\n${highRiskWarnings.map((w) => `  - ${w}`).join('\n')}\n以上为提醒，不中断执行。`)
  }
  if (shellSafetyWarnings.length > 0) {
    sections.push(`⚠️ [HelloAGENTS Shell 安全提醒] 检测到需要关注的命令写法:\n${shellSafetyWarnings.map((w) => `  - ${w}`).join('\n')}\n当前仅提示，不中断执行。`)
  }

  emitHookPayload({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      additionalContext: sections.join('\n\n'),
    },
  })

  const cwd = data.cwd || process.cwd()
  if (highRiskWarnings.length > 0) {
    emitGuardEvent(cwd, 'guard_warning', 'command', '', {
      guardType: 'high-risk-warning',
      command: command.slice(0, 200),
      warnings: highRiskWarnings,
    }, data)
  }
  if (shellSafetyWarnings.length > 0) {
    emitGuardEvent(cwd, 'guard_warning', 'command', '', {
      guardType: 'shell-safety-warning',
      command: command.slice(0, 200),
      warnings: shellSafetyWarnings,
    }, data)
  }
}

async function main() {
  const mode = process.argv[2] || ''
  const data = readHookInput()

  if (mode === 'pre-write') return
  if (mode === 'post-write') {
    postWriteScan(data)
    return
  }
  if (readSettings().guard_enabled === false) return
  handleShellCommand(data)
}

main().catch((error) => {
  const reason = `[HelloAGENTS Guard] 守卫脚本执行异常，已阻止本次操作以避免静默放行。\n原因：${error?.message || error}`
  emitHookPayload({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })
  process.stderr.write(`${reason}\n`)
  process.exitCode = 1
})
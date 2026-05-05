#!/usr/bin/env node
/**
 * HelloAGENTS Guard — Dangerous command blocker + L2 semantic security scan
 * Runs on PreToolUse hook for Bash/shell commands.
 * Runs on PostToolUse hook for Write/Edit (L2 scan).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

import { buildStateSyncHint, getWorkflowRecommendation } from './workflow-state.mjs'
import { getApplicableRouteContext } from './runtime-context.mjs'
import { appendReplayEvent } from './replay-state.mjs'
import {
  DANGEROUS_PATTERNS,
  IDEA_SIDE_EFFECT_COMMAND_PATTERNS,
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

function buildHighRiskGate(matches, cwd, payload = {}) {
  const workflowOptions = { payload }
  const stateSyncHint = buildStateSyncHint(cwd, workflowOptions)
  if (stateSyncHint) {
    return {
      reason: `[HelloAGENTS Guard] 已阻止 T3 命令：项目恢复状态尚未同步。\n${stateSyncHint}`,
    }
  }

  const recommendation = getWorkflowRecommendation(cwd, workflowOptions)
  if (!recommendation) return null
  if (matches.some((match) => match.gate === 'post-verify')) {
    return {
      reason: `[HelloAGENTS Guard] 已阻止 T3 命令：当前工作流尚未进入 VERIFY / CONSOLIDATE。\n当前工作流：${recommendation.summary}\n处理路径：${recommendation.nextPath}\n${recommendation.guidance}`,
    }
  }
  if (matches.some((match) => match.gate === 'plan-first') && recommendation.nextCommand === 'plan') {
    return {
      reason: `[HelloAGENTS Guard] 已阻止 T3 命令：高风险 schema 变更前仍需先完成 ~plan。\n当前工作流：${recommendation.summary}\n处理路径：${recommendation.nextPath}\n${recommendation.guidance}`,
    }
  }
  return null
}

function buildIdeaBoundaryReason(kind) {
  return `[HelloAGENTS Guard] 已阻止 ~idea 中的${kind}。\n当前路由：~idea 是只读探索；先停留在比较方案。若要写文件、改代码、创建知识库或执行有副作用的命令，请先升级到 ~plan / ~build / ~prd / ~auto。`
}

function detectIdeaBoundaryContext(data) {
  return getApplicableRouteContext({
    cwd: data.cwd || process.cwd(),
    filePath: data.tool_input?.file_path || '',
    payload: data,
  })
}

function emitIdeaBoundaryBlock(data, kind, target) {
  const reason = `${buildIdeaBoundaryReason(kind)}\n${target}`
  emitHookPayload({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })
  emitGuardEvent(
    data.cwd || process.cwd(),
    'guard_blocked',
    kind === 'write' ? 'pre-write' : 'command',
    buildIdeaBoundaryReason(kind),
    {
      command: kind === '有副作用命令' ? target.replace(/^命令：\s*/, '') : '',
      target: kind === '写入操作' ? target.replace(/^目标：\s*/, '') : '',
      guardType: kind === '写入操作' ? 'idea-write-boundary' : 'idea-command-boundary',
    },
    data,
  )
}

function preWriteGuard(data) {
  if (readSettings().guard_enabled === false) return
  if (!detectIdeaBoundaryContext(data)?.zeroSideEffect) return
  emitIdeaBoundaryBlock(data, '写入操作', `目标：${data.tool_input?.file_path || '未知文件'}`)
}

function buildPostWriteWarnings(data) {
  const content = data.tool_input?.content || data.tool_input?.new_string || ''
  const filePath = data.tool_input?.file_path || ''
  return [
    ...(detectIdeaBoundaryContext(data)?.zeroSideEffect
      ? ['~idea 本轮要求只读探索；检测到写入文件的工具调用，请回到探索输出，或升级到 ~plan / ~build / ~prd / ~auto 后再修改文件']
      : []),
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

function handleHighRiskCommand(data, command) {
  const warnings = scanHighRiskCommands(command)
  if (warnings.length === 0) return []

  const cwd = data.cwd || process.cwd()
  const gate = buildHighRiskGate(warnings, cwd, data)
  if (gate) {
    emitHookPayload({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENT,
        permissionDecision: 'deny',
        permissionDecisionReason: `${gate.reason}\n命令：${command.slice(0, 200)}`,
      },
    })
    emitGuardEvent(cwd, 'guard_blocked', 'command', gate.reason, {
      command: command.slice(0, 200),
      guardType: 'high-risk-gate',
      matches: warnings.map((warning) => warning.reason),
    }, data)
    return null
  }
  return warnings.map((warning) => warning.reason)
}

function emitShellWarnings(data, command, highRiskWarnings, shellSafetyWarnings) {
  const sections = []
  if (highRiskWarnings.length > 0) {
    sections.push(`⚠️ [HelloAGENTS 高风险操作提醒] 检测到高风险命令:\n${highRiskWarnings.map((warning) => `  - ${warning}`).join('\n')}\n请确认已完成相应规划/审查并获得必要授权。`)
  }
  if (shellSafetyWarnings.length > 0) {
    sections.push(`⚠️ [HelloAGENTS Shell 安全提醒] 检测到需要关注的命令写法:\n${shellSafetyWarnings.map((warning) => `  - ${warning}`).join('\n')}\n当前仅提示，不中断执行。`)
  }
  if (sections.length === 0) return

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

function handleShellCommand(data) {
  const toolName = (data.tool_name || '').toLowerCase()
  if (!['bash', 'shell', 'terminal', 'command'].some((name) => toolName.includes(name))) return

  const command = data.tool_input?.command || data.tool_input?.input || ''
  if (!command) return

  if (detectIdeaBoundaryContext(data)?.zeroSideEffect) {
    for (const pattern of IDEA_SIDE_EFFECT_COMMAND_PATTERNS) {
      if (!pattern.test(command)) continue
      emitIdeaBoundaryBlock(data, '有副作用命令', `命令：${command.slice(0, 200)}`)
      return
    }
  }

  if (handleDangerousCommand(data, command)) return
  const highRiskWarnings = handleHighRiskCommand(data, command)
  if (highRiskWarnings === null) return

  const shellSafetyWarnings = scanShellSafetyWarnings(command)
  emitShellWarnings(data, command, highRiskWarnings, shellSafetyWarnings)
}

async function main() {
  const mode = process.argv[2] || ''
  const data = readHookInput()

  if (mode === 'pre-write') {
    preWriteGuard(data)
    return
  }
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

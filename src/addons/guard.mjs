#!/usr/bin/env node
/**
 * guard 附加组件：在工具执行前拦截危险命令。
 * 仅依据规则清单判断（src/kernel/security-rules.mjs），
 * 规则与内核提示词中的阻断清单保持同步。
 * 失败策略：输入不可解析时放行并在标准错误留痕；自身运行异常时拒绝执行（宁可误拦，不可静默放行）。
 */
import { readFileSync } from 'node:fs'
import { evaluateCommand } from '../kernel/security-rules.mjs'

const HOST = readFlagValue('--host') || 'claude'
const LANGUAGE = detectLanguageLite()

/** @param {string} name */
function readFlagValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? '') : ''
}

function detectLanguageLite() {
  const forced = String(process.env.HELLOAGENTS_LANG || '').toLowerCase()
  if (forced.startsWith('cn') || forced.startsWith('zh')) return 'cn'
  if (forced.startsWith('en')) return 'en'
  const locale = `${process.env.LANG || ''} ${process.env.LC_ALL || ''}`.toLowerCase()
  return locale.includes('zh') || locale.includes('cn') ? 'cn' : 'en'
}

/** @returns {Record<string, unknown>} */
function readHookInput() {
  try {
    if (process.stdin.isTTY) return {}
    const raw = readFileSync(0, 'utf-8').trim()
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (error) {
    process.stderr.write(`helloagents guard: 输入解析失败（input parse failed）: ${String(error)}\n`)
    return {}
  }
}

/** @param {unknown} payload */
function emit(payload) {
  process.stdout.write(JSON.stringify(payload))
}

/** @param {string} reason */
function emitDeny(reason) {
  if (HOST === 'cursor') {
    emit({ permission: 'deny', user_message: reason, agent_message: reason })
    return
  }
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })
}

/** @param {string} context */
function emitContext(context) {
  if (HOST === 'cursor') return
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: context,
    },
  })
}

/**
 * 从 hook 输入中取出待执行的命令；非命令类工具返回空。
 * @param {Record<string, unknown>} payload
 */
function extractCommand(payload) {
  const toolName = String(payload.tool_name || payload.toolName || '').toLowerCase()
  const toolInput = /** @type {Record<string, unknown>} */ (
    payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {}
  )
  const direct = typeof payload.command === 'string' ? payload.command : ''
  const fromTool =
    typeof toolInput.command === 'string'
      ? toolInput.command
      : typeof toolInput.input === 'string'
        ? toolInput.input
        : ''
  if (toolName) {
    const isCommandTool = ['bash', 'shell', 'terminal', 'command'].some((name) => toolName.includes(name))
    return isCommandTool ? fromTool || direct : ''
  }
  return fromTool || direct
}

function main() {
  const payload = readHookInput()
  const command = extractCommand(payload)
  if (!command) return

  const { block, warnings } = evaluateCommand(command)
  if (block) {
    const reason =
      LANGUAGE === 'cn'
        ? `[HelloAGENTS guard] 已阻止：${block.reason.cn}\n命令：${command.slice(0, 200)}\n如确需执行，请说明意图并让用户手动执行或放行。`
        : `[HelloAGENTS guard] Blocked: ${block.reason.en}\nCommand: ${command.slice(0, 200)}\nIf this is intentional, explain why and let the user run or approve it manually.`
    emitDeny(reason)
    return
  }
  if (warnings.length > 0) {
    const lines = warnings.map((warning) =>
      LANGUAGE === 'cn' ? `- ${warning.reason.cn}` : `- ${warning.reason.en}`,
    )
    const header =
      LANGUAGE === 'cn'
        ? '[HelloAGENTS guard] 高风险操作提醒（未拦截，请核对）：'
        : '[HelloAGENTS guard] High-risk operation notice (not blocked; please verify):'
    emitContext(`${header}\n${lines.join('\n')}`)
  }
}

try {
  main()
} catch (error) {
  const reason =
    LANGUAGE === 'cn'
      ? `[HelloAGENTS guard] 组件运行异常，已阻止本次操作以避免静默放行。原因：${error instanceof Error ? error.message : String(error)}`
      : `[HelloAGENTS guard] The guard failed unexpectedly; the operation was blocked to avoid silently letting it through. Reason: ${error instanceof Error ? error.message : String(error)}`
  emitDeny(reason)
  process.stderr.write(`${reason}\n`)
  process.exitCode = 1
}

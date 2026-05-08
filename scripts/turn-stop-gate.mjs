import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { getApplicableRouteContext } from './runtime-context.mjs'
import { readTurnState } from './turn-state.mjs'
import { getWorkflowRecommendation } from './workflow-state.mjs'

const ENFORCED_COMMANDS = new Set(['auto', 'loop'])
const ALLOWED_STOP_REASON_CATEGORIES = [
  'ambiguity',
  'missing-input',
  'missing-file',
  'missing-credential',
  'unauthorized-side-effect',
  'high-risk-confirmation',
  'external-dependency',
  'error',
]

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

function buildWorkflowHint(cwd) {
  const recommendation = getWorkflowRecommendation(cwd)
  if (!recommendation) return ''
  return [
    `当前工作流：${recommendation.summary}`,
    `应执行路径：${recommendation.nextPath}`,
    recommendation.guidance,
  ].filter(Boolean).join('\n')
}

function buildBlockReason(routeContext, detail, cwd) {
  const commandLabel = `~${routeContext.skillName}`
  const workflowHint = buildWorkflowHint(cwd)
  return [
    `[HelloAGENTS Runtime] 显式 ${commandLabel} 本轮不应直接停下。`,
    detail,
    workflowHint,
    '若无真实阻塞，请继续沿当前路径执行。',
    `若确需停下，先调用 \`helloagents-turn-state write --kind waiting --role main --reason-category <category> --reason "..."\` 写结构化状态；阻塞则把 \`waiting\` 改为 \`blocked\`。`,
    `允许的 \`reasonCategory\`：${ALLOWED_STOP_REASON_CATEGORIES.join(' | ')}。`,
  ].filter(Boolean).join('\n')
}

function getLastAssistantMessage(payload = {}) {
  return String(
    payload.lastAssistantMessage
    || payload.last_assistant_message
    || payload['last-assistant-message']
    || '',
  ).trim()
}

function countMatches(text, pattern) {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function validateFormattedCloseoutMessage(routeContext, payload, cwd) {
  const message = getLastAssistantMessage(payload)
  if (!message || !message.includes('【HelloAGENTS】')) return ''

  const firstNonEmptyLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstNonEmptyLine || !/^[💡⚡🔵✅❓⚠️❌]【HelloAGENTS】- /.test(firstNonEmptyLine)) {
    return buildBlockReason(
      routeContext,
      '最终收尾消息使用了 HelloAGENTS 外层格式，但首个非空行不是规范标题行。',
      cwd,
    )
  }

  if (countMatches(message, /[💡⚡🔵✅❓⚠️❌]【HelloAGENTS】-/g) > 1) {
    return buildBlockReason(
      routeContext,
      '最终收尾消息重复输出了 HelloAGENTS 标题；请把所有内容合并到同一个外层块内。',
      cwd,
    )
  }

  if (countMatches(message, /^🔄 下一步:/gm) > 1) {
    return buildBlockReason(
      routeContext,
      '最终收尾消息重复输出了 `🔄 下一步`；请只保留一个真实下一步。',
      cwd,
    )
  }

  return ''
}

function getMainTurnState(cwd, payload = {}) {
  const turnState = readTurnState(cwd, { payload })
  return turnState?.role === 'main' ? turnState : null
}

function hasStructuredBlocker(turnState) {
  const blocker = turnState?.blocker
  return Boolean(
    blocker
    && typeof blocker === 'object'
    && blocker.target
    && blocker.evidence
    && blocker.requiredAction,
  )
}

function validateTurnState(routeContext, turnState, cwd, payload = {}) {
  if (!turnState) {
    return buildBlockReason(routeContext, '缺少主代理 turn-state。', cwd)
  }
  if (turnState.kind === 'complete') {
    const formatReason = validateFormattedCloseoutMessage(routeContext, payload, cwd)
    if (formatReason) return formatReason
    return ''
  }
  if (turnState.kind === 'waiting' || turnState.kind === 'blocked') {
    if (turnState.reasonCategory && turnState.reason) {
      if (!hasStructuredBlocker(turnState)) {
        return buildBlockReason(
          routeContext,
          '当前 waiting/blocked 缺少结构化 `blocker.target`、`blocker.evidence` 或 `blocker.requiredAction`，不能证明存在可核实的真实阻塞。',
          cwd,
        )
      }
      return ''
    }
    return buildBlockReason(
      routeContext,
      `当前 turn-state 为 \`${turnState.kind}\`，但缺少 \`reasonCategory\` 或 \`reason\`。`,
      cwd,
    )
  }
  return buildBlockReason(routeContext, `当前 turn-state 为 \`${turnState.kind}\`，不能作为本轮结束状态。`, cwd)
}

export function evaluateTurnStopGate(payload = {}) {
  const cwd = payload.cwd || process.cwd()
  const routeContext = getApplicableRouteContext({ cwd, payload })

  if (!routeContext || !ENFORCED_COMMANDS.has(routeContext.skillName)) {
    return { decision: 'continue' }
  }

  const reason = validateTurnState(routeContext, getMainTurnState(cwd, payload), cwd, payload)
  return reason ? { decision: 'block', reason } : { decision: 'continue' }
}

function main() {
  const payload = readStdinJson()
  process.stdout.write(JSON.stringify(evaluateTurnStopGate(payload)))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

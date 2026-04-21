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
    `建议路径：${recommendation.nextPath}`,
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
    `若确需停下，先调用 \`scripts/turn-state.mjs write\` 写结构化状态：\`kind=waiting\` 或 \`kind=blocked\`，并同时填写 \`reasonCategory\` 与 \`reason\`。`,
    `允许的 \`reasonCategory\`：${ALLOWED_STOP_REASON_CATEGORIES.join(' | ')}。`,
  ].filter(Boolean).join('\n')
}

function getMainTurnState(cwd) {
  const turnState = readTurnState(cwd)
  return turnState?.role === 'main' ? turnState : null
}

function validateTurnState(routeContext, turnState, cwd) {
  if (!turnState) {
    return buildBlockReason(routeContext, '缺少主代理 turn-state。', cwd)
  }
  if (turnState.kind === 'complete') {
    return ''
  }
  if (turnState.kind === 'waiting' || turnState.kind === 'blocked') {
    if (turnState.reasonCategory && turnState.reason) {
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

function main() {
  const payload = readStdinJson()
  const cwd = payload.cwd || process.cwd()
  const routeContext = getApplicableRouteContext({ cwd })

  if (!routeContext || !ENFORCED_COMMANDS.has(routeContext.skillName)) {
    process.stdout.write(JSON.stringify({ decision: 'continue' }))
    return
  }

  const reason = validateTurnState(routeContext, getMainTurnState(cwd), cwd)
  process.stdout.write(JSON.stringify(reason ? { decision: 'block', reason } : { decision: 'continue' }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

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

function validateTurnState(routeContext, turnState, cwd) {
  if (!turnState) {
    return buildBlockReason(routeContext, '缺少主代理 turn-state。', cwd)
  }
  if (turnState.kind === 'complete') {
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

function main() {
  const payload = readStdinJson()
  const cwd = payload.cwd || process.cwd()
  const routeContext = getApplicableRouteContext({ cwd, payload })

  if (!routeContext || !ENFORCED_COMMANDS.has(routeContext.skillName)) {
    process.stdout.write(JSON.stringify({ decision: 'continue' }))
    return
  }

  const reason = validateTurnState(routeContext, getMainTurnState(cwd, payload), cwd)
  process.stdout.write(JSON.stringify(reason ? { decision: 'block', reason } : { decision: 'continue' }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

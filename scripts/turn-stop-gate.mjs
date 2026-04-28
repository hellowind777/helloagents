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
const SOFT_HANDOFF_PATTERNS = [
  /下一步|后续|继续(推进|执行)?|阶段(性)?(汇报|小结|收口|完成)|先停|停在这里|等待.*(指示|继续|下一步)/i,
  /checkpoint|probe|handoff/i,
]
const CONCRETE_BLOCKER_PATTERNS = [
  /缺少|未提供|尚未(提供|给出|确认)|找不到|不存在|无法|不能|失败|报错|错误|异常|超时/i,
  /文件|路径|目录|配置|命令|测试|构建|服务|网络|接口|依赖|权限|授权|凭据|密钥|token|api\s*key/i,
  /高风险|不可逆|生产|数据库|选择|范围|目标|输入|数据|歧义|冲突|external|credential|permission|timeout|not found|no such|failed|error/i,
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
    `若确需停下，先调用 \`node "{HELLOAGENTS_READ_ROOT}/scripts/turn-state.mjs" write\` 写结构化状态：\`kind=waiting\` 或 \`kind=blocked\`，并同时填写 \`reasonCategory\` 与 \`reason\`。`,
    `允许的 \`reasonCategory\`：${ALLOWED_STOP_REASON_CATEGORIES.join(' | ')}。`,
  ].filter(Boolean).join('\n')
}

function getMainTurnState(cwd) {
  const turnState = readTurnState(cwd)
  return turnState?.role === 'main' ? turnState : null
}

function getLastAssistantMessage(payload = {}) {
  return payload.lastAssistantMessage || payload['last-assistant-message'] || payload.message || ''
}

function isSoftHandoffOnly(turnState, payload) {
  const text = [turnState?.reason, getLastAssistantMessage(payload)]
    .filter(Boolean)
    .join('\n')
  if (!text) return false
  const looksLikeHandoff = SOFT_HANDOFF_PATTERNS.some((pattern) => pattern.test(text))
  if (!looksLikeHandoff) return false
  return !CONCRETE_BLOCKER_PATTERNS.some((pattern) => pattern.test(text))
}

function validateTurnState(routeContext, turnState, cwd, payload = {}) {
  if (!turnState) {
    return buildBlockReason(routeContext, '缺少主代理 turn-state。', cwd)
  }
  if (turnState.kind === 'complete') {
    return ''
  }
  if (turnState.kind === 'waiting' || turnState.kind === 'blocked') {
    if (turnState.reasonCategory && turnState.reason) {
      if (isSoftHandoffOnly(turnState, payload)) {
        return buildBlockReason(
          routeContext,
          '当前 waiting/blocked 更像阶段性交接或“下一步”建议，未说明可核实的真实阻塞。',
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
  const routeContext = getApplicableRouteContext({ cwd })

  if (!routeContext || !ENFORCED_COMMANDS.has(routeContext.skillName)) {
    process.stdout.write(JSON.stringify({ decision: 'continue' }))
    return
  }

  const reason = validateTurnState(routeContext, getMainTurnState(cwd), cwd, payload)
  process.stdout.write(JSON.stringify(reason ? { decision: 'block', reason } : { decision: 'continue' }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

import { basename } from 'node:path'

import {
  buildQaFocusHintFromSnapshot,
  buildStateRoleHintFromSnapshot,
  buildStateSyncHintFromSnapshot,
  buildUiContractHint,
  getWorkflowSnapshot,
  readStateSnapshot,
  listPlanPackages,
} from './workflow-core.mjs'
import {
  buildDeliveryActionFromSnapshot,
  buildDeliveryGateHintFromSnapshot,
  buildOrchestrationHintFromSnapshot,
  buildRecommendation,
} from './workflow-recommendation.mjs'

export function getDeliveryAction(cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = buildRecommendation(snapshot, cwd, options)
  return buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)
}

export function getWorkflowRecommendation(cwd, options = {}) {
  return buildRecommendation(getWorkflowSnapshot(cwd, options), cwd, options)
}

export function buildStateSyncHint(cwd, options = {}) {
  return buildStateSyncHintFromSnapshot(getWorkflowSnapshot(cwd, options))
}

export function buildDeliveryGateHint(cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  return buildDeliveryGateHintFromSnapshot(snapshot, cwd, buildRecommendation(snapshot, cwd, options))
}

export function buildWorkflowRouteHint(cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = buildRecommendation(snapshot, cwd, options)
  const stateSyncHint = buildStateSyncHintFromSnapshot(snapshot)
  const stateRoleHint = buildStateRoleHintFromSnapshot(snapshot)
  const orchestrationHint = buildOrchestrationHintFromSnapshot(snapshot, cwd, recommendation)
  const uiContractHint = buildUiContractHint(cwd, snapshot)

  if (!recommendation) {
    return [stateRoleHint, stateSyncHint, uiContractHint].filter(Boolean).join(' ')
  }

  const suffix = [stateRoleHint, stateSyncHint, orchestrationHint, uiContractHint].filter(Boolean).join(' ')
  if (recommendation.stage === 'consolidate') {
    return `${recommendation.summary} 当前应直接进入收尾与归档。执行路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
  }
  return `${recommendation.summary} 当前应执行 ~${recommendation.nextCommand}。执行路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
}

function buildCommandRouteMessage(skillName, recommendation, qaFocusHint) {
  if (skillName === 'auto') {
    return recommendation.stage === 'consolidate'
      ? `当前工作流约束：${recommendation.summary} 本次 ~auto 应直接完成当前收尾。${recommendation.guidance} 未命中阻塞判定前不要停下，也不要把收尾动作写成“下一步建议”。`
      : `当前工作流约束：${recommendation.summary} 本次 ~auto 的执行主路径：${recommendation.nextPath}。${recommendation.guidance} 命中主路径后继续执行后续阶段；未触发阻塞判定前不要停下，也不要把阶段结果写成“下一步建议”。`
  }
  if (skillName === 'loop') {
    return `当前工作流约束：用户已显式使用 ~loop，应把它视为长任务入口，默认按“/goal -> ~auto -> ~qa”直接推进。现有工作流只作上下文参考：${recommendation.summary} ${recommendation.guidance} 若当前宿主不支持 /goal，则按 ~auto 持续推进，并在交付前强制进入 ~qa。未命中阻塞判定前不要停下，也不要把阶段结果写成“下一步建议”。`
  }
  if (skillName === 'plan') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前不该重开 ~plan；除非用户明确要求重规划、改方向或新增范围，否则直接进入收尾与归档。`
    }
    return recommendation.nextCommand === 'plan'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~plan。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该继续 ~plan；先按 ~${recommendation.nextCommand} 处理。只有在用户明确要求重规划、改方向或新增范围时，才继续 ~plan。`
  }
  if (skillName === 'build') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前不该继续 ~build；除非用户明确提出新增实现范围，否则直接进入收尾与归档。`
    }
    return recommendation.nextCommand === 'build'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~build。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该继续 ~build；先按 ~${recommendation.nextCommand} 处理。只有在用户明确提出新增实现范围时，才继续 ~build。`
  }
  if (skillName === 'qa') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前应直接进入收尾与归档。${recommendation.guidance}`
    }
    return recommendation.nextCommand === 'qa'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~qa。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该把 ~qa 当成越级入口；先按 ~${recommendation.nextCommand} 处理。即使执行 ~qa，也不能越过当前工作流边界。${qaFocusHint ? ` 若本次只是阶段内收尾，${qaFocusHint}` : ''}`
  }
  return `当前工作流约束：${recommendation.summary} 当前应执行 ~${recommendation.nextCommand}。${recommendation.guidance}`
}

export function buildCommandRouteHint(skillName, cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = buildRecommendation(snapshot, cwd, options)
  const contextHints = [
    buildStateRoleHintFromSnapshot(snapshot),
    buildStateSyncHintFromSnapshot(snapshot),
    buildOrchestrationHintFromSnapshot(snapshot, cwd, recommendation),
    buildUiContractHint(cwd, snapshot),
  ].filter(Boolean)

  if (!recommendation) {
    return contextHints.join(' ')
  }

  const message = buildCommandRouteMessage(skillName, recommendation, buildQaFocusHintFromSnapshot(snapshot))
  return [message, ...contextHints].join(' ')
}

export { readStateSnapshot, listPlanPackages, getWorkflowSnapshot }

export function describePlanForLogs(planEntry) {
  if (!planEntry) return ''
  return basename(planEntry.dirPath)
}

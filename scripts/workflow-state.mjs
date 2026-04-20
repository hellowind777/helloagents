import { basename } from 'node:path'

import {
  buildStateRoleHintFromSnapshot,
  buildStateSyncHintFromSnapshot,
  buildUiContractHint,
  buildVerifyModeHintFromSnapshot,
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
  const recommendation = buildRecommendation(snapshot, cwd)
  return buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)
}

export function getWorkflowRecommendation(cwd, options = {}) {
  return buildRecommendation(getWorkflowSnapshot(cwd, options), cwd)
}

export function buildStateSyncHint(cwd, options = {}) {
  return buildStateSyncHintFromSnapshot(getWorkflowSnapshot(cwd, options))
}

export function buildDeliveryGateHint(cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  return buildDeliveryGateHintFromSnapshot(snapshot, cwd, buildRecommendation(snapshot, cwd))
}

export function buildWorkflowRouteHint(cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = buildRecommendation(snapshot, cwd)
  const stateSyncHint = buildStateSyncHintFromSnapshot(snapshot)
  const stateRoleHint = buildStateRoleHintFromSnapshot(snapshot)
  const orchestrationHint = buildOrchestrationHintFromSnapshot(snapshot, cwd, recommendation)
  const uiContractHint = buildUiContractHint(cwd, snapshot)

  if (!recommendation) {
    return [stateRoleHint, stateSyncHint, uiContractHint].filter(Boolean).join(' ')
  }

  const suffix = [stateRoleHint, stateSyncHint, orchestrationHint, uiContractHint].filter(Boolean).join(' ')
  if (recommendation.stage === 'consolidate') {
    return `${recommendation.summary} 当前应直接进入 CONSOLIDATE。执行路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
  }
  return `${recommendation.summary} 当前应执行 ~${recommendation.nextCommand}。执行路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
}

function buildCommandRouteMessage(skillName, recommendation, verifyModeHint) {
  if (skillName === 'auto') {
    return recommendation.stage === 'consolidate'
      ? `当前工作流约束：${recommendation.summary} 本次 ~auto 应直接完成当前收尾。${recommendation.guidance} 未命中阻塞判定前不要停下，也不要把收尾动作写成“下一步建议”。`
      : `当前工作流约束：${recommendation.summary} 本次 ~auto 的执行主路径：${recommendation.nextPath}。${recommendation.guidance} 命中主路径后继续执行后续阶段；未触发阻塞判定前不要停下，也不要把阶段结果写成“下一步建议”。`
  }
  if (skillName === 'loop') {
    return `当前工作流约束：用户已显式使用 ~loop，应按 ~loop 的循环规则直接执行。现有工作流只作上下文参考：${recommendation.summary} ${recommendation.guidance} 除非达到迭代上限、达成目标或命中阻塞判定，否则不要停下，也不要把单轮结果写成“下一步建议”。`
  }
  if (skillName === 'plan') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前不该重开 ~plan；除非用户明确要求重规划、改方向或新增范围，否则直接进入 CONSOLIDATE。`
    }
    return recommendation.nextCommand === 'plan'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~plan。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该继续 ~plan；先按 ~${recommendation.nextCommand} 处理。只有在用户明确要求重规划、改方向或新增范围时，才继续 ~plan。`
  }
  if (skillName === 'build') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前不该继续 ~build；除非用户明确提出新增实现范围，否则直接进入 CONSOLIDATE。`
    }
    return recommendation.nextCommand === 'build'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~build。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该继续 ~build；先按 ~${recommendation.nextCommand} 处理。只有在用户明确提出新增实现范围时，才继续 ~build。`
  }
  if (skillName === 'verify') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前应直接进入 CONSOLIDATE。${recommendation.guidance}`
    }
    return recommendation.nextCommand === 'verify'
      ? `当前工作流约束：${recommendation.summary} 当前应执行 ~verify。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前不该把 ~verify 当成越级入口；先按 ~${recommendation.nextCommand} 处理。即使执行 ~verify，也不能越过当前工作流边界。${verifyModeHint ? ` 若本次仅做阶段内审查或验真，${verifyModeHint}` : ''}`
  }
  return `当前工作流约束：${recommendation.summary} 当前应执行 ~${recommendation.nextCommand}。${recommendation.guidance}`
}

export function buildCommandRouteHint(skillName, cwd, options = {}) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = buildRecommendation(snapshot, cwd)
  const contextHints = [
    buildStateRoleHintFromSnapshot(snapshot),
    buildStateSyncHintFromSnapshot(snapshot),
    buildOrchestrationHintFromSnapshot(snapshot, cwd, recommendation),
    buildUiContractHint(cwd, snapshot),
  ].filter(Boolean)

  if (!recommendation) {
    return contextHints.join(' ')
  }

  const message = buildCommandRouteMessage(skillName, recommendation, buildVerifyModeHintFromSnapshot(snapshot))
  return [message, ...contextHints].join(' ')
}

export { readStateSnapshot, listPlanPackages, getWorkflowSnapshot }

export function describePlanForLogs(planEntry) {
  if (!planEntry) return ''
  return basename(planEntry.dirPath)
}

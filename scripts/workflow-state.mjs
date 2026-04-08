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

export function getDeliveryAction(cwd) {
  const snapshot = getWorkflowSnapshot(cwd)
  const recommendation = buildRecommendation(snapshot, cwd)
  return buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)
}

export function getWorkflowRecommendation(cwd) {
  return buildRecommendation(getWorkflowSnapshot(cwd), cwd)
}

export function buildStateSyncHint(cwd) {
  return buildStateSyncHintFromSnapshot(getWorkflowSnapshot(cwd))
}

export function buildDeliveryGateHint(cwd) {
  const snapshot = getWorkflowSnapshot(cwd)
  return buildDeliveryGateHintFromSnapshot(snapshot, cwd, buildRecommendation(snapshot, cwd))
}

export function buildWorkflowRouteHint(cwd) {
  const snapshot = getWorkflowSnapshot(cwd)
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
    return `${recommendation.summary} 当前建议下一阶段：CONSOLIDATE。推荐路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
  }
  return `${recommendation.summary} 当前建议下一命令：~${recommendation.nextCommand}。推荐路径：${recommendation.nextPath}。${recommendation.guidance}${suffix ? ` ${suffix}` : ''}`
}

function buildCommandRouteMessage(skillName, recommendation, verifyModeHint) {
  if (skillName === 'auto') {
    return recommendation.stage === 'consolidate'
      ? `当前工作流约束：${recommendation.summary} 当前建议下一阶段：CONSOLIDATE。${recommendation.guidance} 若本次明确使用 ~auto，则在未命中阻塞判定时直接完成当前收尾，不再额外停下询问。`
      : `当前工作流约束：${recommendation.summary} 当前建议主路径：${recommendation.nextPath}。${recommendation.guidance} 若本次明确使用 ~auto，则命中主路径后继续衔接后续阶段，除非触发阻塞判定，否则不要在方案/PRD 阶段额外停下。`
  }
  if (skillName === 'plan') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前更推荐的下一阶段其实是 CONSOLIDATE。只有在用户明确要求重规划、改方向或新增范围时，才继续 ~plan。`
    }
    return recommendation.nextCommand === 'plan'
      ? `当前工作流约束：${recommendation.summary} 当前建议下一命令：~plan。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前更推荐的下一命令其实是 ~${recommendation.nextCommand}。只有在用户明确要求重规划、改方向或新增范围时，才继续 ~plan。`
  }
  if (skillName === 'build') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前更推荐的下一阶段其实是 CONSOLIDATE。只有在用户明确提出新增实现范围时，才继续 ~build。`
    }
    return recommendation.nextCommand === 'build'
      ? `当前工作流约束：${recommendation.summary} 当前建议下一命令：~build。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前更推荐的下一命令其实是 ~${recommendation.nextCommand}。只有在用户明确提出新增实现范围时，才继续 ~build。`
  }
  if (skillName === 'verify') {
    if (recommendation.stage === 'consolidate') {
      return `当前工作流约束：${recommendation.summary} 当前建议下一阶段：CONSOLIDATE。${recommendation.guidance}`
    }
    return recommendation.nextCommand === 'verify'
      ? `当前工作流约束：${recommendation.summary} 当前建议下一命令：~verify。${recommendation.guidance}`
      : `当前工作流约束：${recommendation.summary} 当前更推荐的下一命令其实是 ~${recommendation.nextCommand}。即使执行 ~verify，也不能越过当前工作流边界。${verifyModeHint ? ` 若本次仅做阶段内审查或验真，${verifyModeHint}` : ''}`
  }
  return `当前工作流约束：${recommendation.summary} 当前建议下一命令：~${recommendation.nextCommand}。${recommendation.guidance}`
}

export function buildCommandRouteHint(skillName, cwd) {
  const snapshot = getWorkflowSnapshot(cwd)
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

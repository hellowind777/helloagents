import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  getWorkflowSnapshot,
  listPlanPackages,
  normalizeTaskFile,
  readStateSnapshot,
} from './workflow-plan-files.mjs'
import { getAdvisorRequirement, getVisualValidationRequirement } from './plan-contract.mjs'
import { describeProjectStoreFile, getProjectDesignContractPath } from './project-storage.mjs'

export function getTargetPlans(snapshot) {
  return snapshot.activePlans.length > 0 ? snapshot.activePlans : snapshot.plans
}
export function classifyPlan(plan) {
  if (!plan) {
    return {
      status: 'none',
      details: [],
    }
  }

  const details = [
    ...plan.missingFiles.map((file) => `缺少 ${file}`),
    ...plan.templateIssues,
  ]

  if (details.length > 0) {
    return {
      status: 'incomplete',
      details,
    }
  }

  if (plan.taskSummary.total === 0) {
    return {
      status: 'missing-task-checklist',
      details: ['tasks.md 尚未形成可执行 checklist'],
    }
  }

  if (plan.taskSummary.open > 0) {
    return {
      status: 'in-progress',
      details: plan.taskSummary.items
        .filter((item) => item.status === 'open')
        .slice(0, 3)
        .map((item) => item.text),
      openCount: plan.taskSummary.open,
    }
  }

  return {
    status: 'closed',
    details: [],
  }
}

export function determineVerifyMode(plan) {
  if (!plan) return null

  if (plan.contractIssues.length > 0) {
    return {
      mode: 'metadata-first',
      reason: '方案包缺少可信的结构化契约',
      guidance: '验证分流：当前还不适合直接进入 reviewer / tester；先回到 ~plan / ~prd 补齐 `contract.json`，明确 `verifyMode`、`reviewerFocus` 和 `testerFocus`。',
    }
  }

  if (plan.contract?.verifyMode === 'review-first') {
    const reviewerFocus = plan.contract.reviewerFocus.join('；')
    const testerFocus = plan.contract.testerFocus.join('；')
    return {
      mode: 'review-first',
      reason: '方案契约已明确要求审查优先',
      guidance: `验证分流：当前更适合审查优先；先执行 reviewer / hello-review 范围审查，再交给 tester / hello-verify 跑完整验证。${reviewerFocus ? ` reviewer 重点：${reviewerFocus}。` : ''}${testerFocus ? ` tester 重点：${testerFocus}。` : ''}`.trim(),
    }
  }

  if (plan.taskSummary.underSpecifiedCount > 0) {
    return {
      mode: 'metadata-first',
      reason: 'tasks.md 仍缺少可信的任务元数据',
      guidance: '验证分流：当前还不适合直接进入 reviewer / tester；先补齐 tasks.md 中每个任务的“涉及文件”“完成标准”和“验证方式”。',
    }
  }

  return {
    mode: 'test-first',
    reason: '方案契约已明确验证主路径，且任务契约已完整',
    guidance: `验证分流：当前更适合测试优先；先执行 tester / hello-verify 跑完整验证，再针对失败点或关键边界补充 hello-review。${plan.contract?.testerFocus?.length ? ` tester 重点：${plan.contract.testerFocus.join('；')}。` : ''}`.trim(),
  }
}

function collectStateSyncIssues(snapshot) {
  const issues = []
  const hasPlans = snapshot.plans.length > 0
  const state = snapshot.state

  if (!hasPlans) {
    return issues
  }

  if (!state.exists) {
    issues.push('当前已存在方案包，但 `.helloagents/STATE.md` 缺失')
    return issues
  }

  if (!state.referencedPlanDir) {
    issues.push('当前已存在方案包，但 `STATE.md` 未记录活跃方案路径')
  }
  if (!state.sections['主线目标']) {
    issues.push('`STATE.md` 缺少“主线目标”')
  }
  if (!state.sections['正在做什么']) {
    issues.push('`STATE.md` 缺少“正在做什么”')
  }
  if (!state.sections['下一步']) {
    issues.push('`STATE.md` 缺少“下一步”')
  }

  return issues
}

export function buildVerifyModeHintFromSnapshot(snapshot) {
  const plan = getTargetPlans(snapshot)[0]
  if (!plan) return ''
  if (!plan.planSections['风险与验证'] && plan.taskSummary.total === 0) return ''
  return determineVerifyMode(plan)?.guidance || ''
}
export function buildStateSyncHintFromSnapshot(snapshot) {
  const issues = collectStateSyncIssues(snapshot)
  if (issues.length === 0) return ''
  return `STATE.md 提醒：${issues.join('；')}；继续项目级流程、收尾或进入压缩前先同步恢复快照。`
}

export function buildStateRoleHintFromSnapshot(snapshot) {
  if (!snapshot.state.exists || snapshot.plans.length > 0) return ''
  return '恢复约束：当前仅检测到 `.helloagents/STATE.md`；先以当前用户消息、显式命令和代码事实确认主线，STATE.md 只用于找回上次停在哪，不是当前任务的自动授权或唯一判断依据。'
}

export function buildUiContractHint(cwd, snapshot) {
  const targetPlans = getTargetPlans(snapshot)
  const hasDesignContract = existsSync(getProjectDesignContractPath(cwd))
  const hasPrdUiArtifact = targetPlans.some((plan) => existsSync(join(plan.dirPath, 'prd', '03-ui-design.md')))
  const hasUiContract = targetPlans.some((plan) => plan.contract?.ui?.required)
  const styleAdvisorRequired = targetPlans.some((plan) => getAdvisorRequirement(plan.contract).styleRequired)
  const visualValidationRequired = targetPlans.some((plan) => getVisualValidationRequirement(plan.contract).required)

  if (!hasDesignContract && !hasPrdUiArtifact && !hasUiContract) {
    return ''
  }

  const extraHints = []
  if (styleAdvisorRequired) {
    extraHints.push('若当前 UI 契约要求 style advisor，收尾前需复用 `.helloagents/.ralph-advisor.json` 留下独立复查证据')
  }
  if (visualValidationRequired) {
    extraHints.push('若当前 UI 契约要求视觉验收，收尾前需写 `.helloagents/.ralph-visual.json` 记录关键视口、状态与结论')
  }
  return `UI 约束提示：如本次属于视觉/交互链路，设计决策优先级固定为：当前活跃 plan.md / prd/03-ui-design.md → ${describeProjectStoreFile(cwd, 'DESIGN.md')} → hello-ui。${extraHints.length > 0 ? ` ${extraHints.join('；')}。` : ''}`
}

export { normalizeTaskFile, readStateSnapshot, listPlanPackages, getWorkflowSnapshot }

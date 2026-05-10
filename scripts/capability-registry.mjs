import { existsSync } from 'node:fs'

import { getAdvisorRequirement, getVisualValidationRequirement } from './plan-contract.mjs'
import { describeProjectStoreFile, getProjectDesignContractPath } from './project-storage.mjs'
import { getWorkflowRecommendation, getWorkflowSnapshot } from './workflow-state.mjs'

function getPrimaryPlan(snapshot) {
  return snapshot.activePlans[0] || snapshot.plans[0] || null
}

export function selectCapabilities({ cwd, skillName = '', options = {} }) {
  const snapshot = getWorkflowSnapshot(cwd, options)
  const recommendation = getWorkflowRecommendation(cwd, options)
  const plan = getPrimaryPlan(snapshot)
  const advisorRequirement = getAdvisorRequirement(plan?.contract)
  const visualRequirement = getVisualValidationRequirement(plan?.contract)
  const capabilities = []

  if (skillName === 'plan' || skillName === 'prd' || recommendation?.nextCommand === 'plan') {
    capabilities.push({
      id: 'plan-contract',
      description: '结构化契约：仅在规划/PRD 场景使用 `scripts/plan-contract.mjs write` 写 `contract.json`，不要只把验证路径留在自然语言说明里。',
    })
  }
  if (advisorRequirement.required) {
    capabilities.push({
      id: 'advisor-artifact',
      description: advisorRequirement.styleRequired
        ? '风格 advisor：当前 UI 契约要求进入收尾前复查设计方向，并写当前会话 `artifacts/advisor.json` 记录 reason、focus、consultedSources 与结论。'
        : '独立 advisor：当前契约要求进入收尾前写当前会话 `artifacts/advisor.json`，记录 advisor reason、focus、consultedSources 与结论。',
    })
  }
  if (plan?.contract?.verifyMode === 'review-first') {
    capabilities.push({
      id: 'review-evaluator',
      description: '审查优先：当前验证主路径是 review-first，先做 hello-review，再做 hello-verify。',
    })
  }
  if (plan?.contract?.ui?.required || existsSync(getProjectDesignContractPath(cwd))) {
    capabilities.push({
      id: 'design-contract',
      description: `UI 契约：仅在 UI 场景按需读取当前 plan.md / prd/03-ui-design.md、${describeProjectStoreFile(cwd, 'DESIGN.md')} 与 hello-ui；同时所有 UI 任务都必须满足 UI 质量基线。`,
    })
  }
  if (visualRequirement.required) {
    capabilities.push({
      id: 'visual-evaluator',
      description: '视觉验收：当前 UI 契约要求进入收尾前写当前会话 `artifacts/visual.json`，记录 tooling、screensChecked、statesChecked、status 与 summary。',
    })
  }

  return capabilities
}

export function buildCapabilityHint({ cwd, skillName = '', options = {} }) {
  const capabilities = selectCapabilities({ cwd, skillName, options })
  if (capabilities.length === 0) return ''
  return `按需能力：${capabilities.map((entry) => `${entry.id}=${entry.description}`).join(' ')}`
}

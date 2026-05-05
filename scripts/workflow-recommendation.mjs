import { getCloseoutEvidenceStatus } from './closeout-state.mjs'
import { getAdvisorEvidenceStatus } from './advisor-state.mjs'
import { getAdvisorRequirement, getVisualValidationRequirement } from './plan-contract.mjs'
import { getReviewEvidenceStatus } from './review-state.mjs'
import { getVisualEvidenceStatus } from './visual-state.mjs'
import { getVerifyEvidenceStatus } from './verify-state.mjs'
import {
  classifyPlan,
  determineVerifyMode,
  getTargetPlans,
  normalizeTaskFile,
} from './workflow-core.mjs'

function getClosedPlanEvidenceStatus(cwd, plan, options = {}) {
  const verifyMode = determineVerifyMode(plan)
  const advisorRequirement = getAdvisorRequirement(plan.contract)
  const visualRequirement = getVisualValidationRequirement(plan.contract)
  const verificationStatus = getVerifyEvidenceStatus(cwd, options)
  const reviewStatus = getReviewEvidenceStatus(cwd, {
    required: verifyMode?.mode === 'review-first',
    ...options,
  })
  const advisorStatus = getAdvisorEvidenceStatus(cwd, {
    required: advisorRequirement.required,
    focus: advisorRequirement.focus,
    ...options,
  })
  const visualStatus = getVisualEvidenceStatus(cwd, {
    required: visualRequirement.required,
    screens: visualRequirement.screens,
    states: visualRequirement.states,
    ...options,
  })
  const verifyReady = !verificationStatus.required || verificationStatus.status === 'valid'
  const reviewReady = !reviewStatus.required || reviewStatus.status === 'valid'
  const advisorReady = !advisorStatus.required || advisorStatus.status === 'valid'
  const visualReady = !visualStatus.required || visualStatus.status === 'valid'
  const closeoutStatus = getCloseoutEvidenceStatus(cwd, {
    required: verifyReady && reviewReady && advisorReady && visualReady,
    ...options,
  })

  return {
    verifyMode,
    advisorRequirement,
    visualRequirement,
    verificationStatus,
    reviewStatus,
    advisorStatus,
    visualStatus,
    closeoutStatus,
    verifyReady,
    reviewReady,
    advisorReady,
    visualReady,
    closeoutReady: !closeoutStatus.required || closeoutStatus.status === 'valid',
  }
}

function buildConsolidateAction(recommendation) {
  if (recommendation.mode === 'closeout-pending') {
    return {
      phase: 'consolidate',
      mode: recommendation.mode,
      routeHint: recommendation.guidance,
      gateHint: '交付把关：审查与验证证据已满足；先写当前会话 `artifacts/closeout.json` 记录需求覆盖与交付清单，再更新 `state_path` 并归档后才可交付。',
    }
  }

  return {
    phase: 'consolidate',
    mode: recommendation.mode || 'ready',
    routeHint: recommendation.guidance,
    gateHint: '交付把关：当前已具备收尾证据；更新 `state_path`、知识文件并归档后即可交付。',
  }
}

function buildVerifyAction(plan, verifyMode) {
  if (!verifyMode) return null
  const advisorRequirement = getAdvisorRequirement(plan.contract)
  const visualRequirement = getVisualValidationRequirement(plan.contract)
  const extraChecks = []
  if (advisorRequirement.required) {
    extraChecks.push('完成独立 advisor / style advisor 复查并写入当前会话 `artifacts/advisor.json`')
  }
  if (visualRequirement.required) {
    extraChecks.push('完成视觉验收并写入当前会话 `artifacts/visual.json`')
  }
  const gateSuffix = extraChecks.length > 0 ? ` ${extraChecks.join('，')}，再进入 CONSOLIDATE。` : ''
  if (verifyMode.mode === 'review-first') {
    return {
      phase: 'verify',
      mode: verifyMode.mode,
      routeHint: verifyMode.guidance,
      gateHint: `交付把关：进入 CONSOLIDATE 前，必须先完成 reviewer / hello-review 范围审查，再完成 tester / hello-verify 全量验证，并留下最新验证证据；两步都通过后才可交付。${gateSuffix}`.trim(),
    }
  }
  if (verifyMode.mode === 'metadata-first') {
    return {
      phase: 'verify',
      mode: verifyMode.mode,
      routeHint: verifyMode.guidance,
      gateHint: plan.contractIssues.length > 0
        ? '交付把关：当前还不能进入 CONSOLIDATE；先补齐 `contract.json` 中的 `verifyMode`、`reviewerFocus`、`testerFocus`，再进入 reviewer / tester。'
        : '交付把关：当前还不能进入 CONSOLIDATE；先补齐 tasks.md 中每个任务的“涉及文件”“完成标准”和“验证方式”，再进入 reviewer / tester。',
    }
  }

  return {
    phase: 'verify',
    mode: verifyMode.mode,
    routeHint: verifyMode.guidance,
    gateHint: `交付把关：进入 CONSOLIDATE 前，先完成 tester / hello-verify 全量验证并留下最新验证证据，再针对失败点或关键边界补充 hello-review；确认通过后才可交付。${gateSuffix}`.trim(),
  }
}

export function buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation = buildRecommendation(snapshot, cwd)) {
  if (!recommendation) return null

  if (recommendation.stage === 'consolidate') {
    return buildConsolidateAction(recommendation)
  }

  const plan = getTargetPlans(snapshot)[0]
  if (recommendation.nextCommand === 'verify' && plan) {
    return buildVerifyAction(plan, determineVerifyMode(plan))
  }
  if (recommendation.nextCommand === 'build') {
    return {
      phase: 'build',
      gateHint: '交付把关：当前还不能报告完成；先回到 ~build 完成剩余任务，再进入 ~verify。',
    }
  }
  if (recommendation.nextCommand === 'plan') {
    return {
      phase: 'plan',
      gateHint: '交付把关：当前还不能报告完成；先回到 ~plan 修复或补齐当前方案包，再进入 ~build / ~verify。',
    }
  }

  return null
}

export function buildDeliveryGateHintFromSnapshot(snapshot, cwd, recommendation = buildRecommendation(snapshot, cwd)) {
  return buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)?.gateHint || ''
}

function buildPlanRecommendation(scopeLabel, plan, classification) {
  return {
    scopeLabel,
    plan,
    status: classification.status,
    details: classification.details,
    nextCommand: 'plan',
    nextPath: '~plan -> ~build / ~verify',
    summary: classification.status === 'incomplete'
      ? `${scopeLabel} "${plan.planName}" 仍不完整（${classification.details.join('；')}）。`
      : `${scopeLabel} "${plan.planName}" 尚未形成可执行任务清单。`,
    guidance: classification.status === 'incomplete'
      ? '优先先走 ~plan 修复或补全当前方案包，再进入实现或验证；不要把不完整的结构化产物直接当成可交付依据。'
      : '先回到 ~plan 补齐 tasks.md 的原子任务，再进入实现、验证或收尾。',
  }
}

function buildInProgressRecommendation(scopeLabel, plan, classification) {
  return {
    scopeLabel,
    plan,
    status: classification.status,
    details: classification.details,
    nextCommand: 'build',
    nextPath: '~build -> ~verify',
    summary: `${scopeLabel} "${plan.planName}" 仍有 ${classification.openCount} 个未完成任务。`,
    guidance: '若用户是在继续当前功能、落实既有方案、或让你“继续做完”，优先复用现有 requirements.md / plan.md / tasks.md 进入 ~build；完成当前实现后再进入 ~verify。除非用户明确要求重规划或现有方案已失效，不要重新回到 ~idea。',
  }
}

function buildClosedRecommendation(scopeLabel, plan, cwd, options = {}) {
  const closedPlanEvidence = getClosedPlanEvidenceStatus(cwd, plan, options)
  if (closedPlanEvidence.verifyMode?.mode === 'metadata-first') {
    return {
      scopeLabel,
      plan,
      status: 'closed',
      nextCommand: 'verify',
      nextPath: '~verify -> CONSOLIDATE',
      summary: `${scopeLabel} "${plan.planName}" 的任务已全部闭合，但验证契约仍未结构化。`,
      guidance: closedPlanEvidence.verifyMode.guidance,
    }
  }

  if (
    closedPlanEvidence.advisorStatus.required
    && closedPlanEvidence.advisorStatus.status !== 'valid'
    && closedPlanEvidence.visualStatus.required
    && closedPlanEvidence.visualStatus.status !== 'valid'
  ) {
    return {
      scopeLabel,
      plan,
      status: 'closed',
      nextCommand: 'verify',
      nextPath: '~verify -> CONSOLIDATE',
      summary: `${scopeLabel} "${plan.planName}" 的任务已闭合，但当前 UI 契约仍要求独立 advisor 复查与视觉验收。`,
      guidance: '先在 ~verify 阶段完成独立 advisor / style advisor 复查，并写入当前会话 `artifacts/advisor.json`；再完成视觉验收并写入当前会话 `artifacts/visual.json`，记录 reason、tooling、screensChecked、statesChecked、status 与 summary；两项都通过后再进入 CONSOLIDATE。',
    }
  }

  if (closedPlanEvidence.advisorStatus.required && closedPlanEvidence.advisorStatus.status !== 'valid') {
    return {
      scopeLabel,
      plan,
      status: 'closed',
      nextCommand: 'verify',
      nextPath: '~verify -> CONSOLIDATE',
      summary: `${scopeLabel} "${plan.planName}" 的任务已闭合，但当前契约仍要求独立 advisor 复查。`,
      guidance: '先在 ~verify 阶段完成独立 advisor / style advisor 复查，并写入当前会话 `artifacts/advisor.json` 记录复查原因、focus、来源与结论；advisor 通过后再进入 CONSOLIDATE。',
    }
  }

  if (closedPlanEvidence.visualStatus.required && closedPlanEvidence.visualStatus.status !== 'valid') {
    return {
      scopeLabel,
      plan,
      status: 'closed',
      nextCommand: 'verify',
      nextPath: '~verify -> CONSOLIDATE',
      summary: `${scopeLabel} "${plan.planName}" 的任务已闭合，但当前 UI 契约仍要求视觉验收。`,
      guidance: '先在 ~verify 阶段完成视觉验收，并写入当前会话 `artifacts/visual.json` 记录 reason、tooling、screensChecked、statesChecked、status 与 summary；视觉验收通过后再进入 CONSOLIDATE。',
    }
  }

  if (closedPlanEvidence.verifyReady && closedPlanEvidence.reviewReady && closedPlanEvidence.advisorReady && closedPlanEvidence.visualReady) {
    return {
      scopeLabel,
      plan,
      status: 'closed',
      stage: 'consolidate',
      mode: closedPlanEvidence.closeoutReady ? 'ready' : 'closeout-pending',
      nextCommand: 'verify',
      nextPath: 'CONSOLIDATE',
      summary: closedPlanEvidence.closeoutReady
        ? `${scopeLabel} "${plan.planName}" 的任务与交付证据已闭合。`
        : `${scopeLabel} "${plan.planName}" 的任务、审查与验证已闭合。`,
      guidance: closedPlanEvidence.closeoutReady
        ? '当前进入 CONSOLIDATE：更新 `state_path`、知识文件并归档方案后即可交付；不要无故重开新的方案包或重新跑一遍无关验证。'
        : '当前进入 CONSOLIDATE：先写当前会话 `artifacts/closeout.json` 记录需求覆盖与交付清单，再更新 `state_path` 并归档后交付。',
    }
  }

  return {
    scopeLabel,
    plan,
    status: 'closed',
    nextCommand: 'verify',
    nextPath: '~verify -> CONSOLIDATE',
    summary: `${scopeLabel} "${plan.planName}" 的任务已全部闭合。`,
    guidance: '若用户是在做收尾、验真、复查或准备交付，优先走 ~verify 或 CONSOLIDATE；不要无故重开新的方案包。',
  }
}

export function buildRecommendation(snapshot, cwd = process.cwd(), options = {}) {
  const plan = getTargetPlans(snapshot)[0]
  if (!plan) return null

  const classification = classifyPlan(plan)
  const scopeLabel = snapshot.activePlans.length > 0 ? '当前活跃方案包' : '当前存在的方案包'

  if (classification.status === 'incomplete' || classification.status === 'missing-task-checklist') {
    return buildPlanRecommendation(scopeLabel, plan, classification)
  }
  if (classification.status === 'in-progress') {
    return buildInProgressRecommendation(scopeLabel, plan, classification)
  }
  if (classification.status === 'closed') {
    return buildClosedRecommendation(scopeLabel, plan, cwd, options)
  }
  return null
}

function findDisjointOpenTaskPair(plan) {
  const openTasks = plan?.taskSummary?.items?.filter((item) => item.status === 'open') || []
  const tasksWithFiles = openTasks.filter((item) => item.files.length > 0)

  for (let i = 0; i < tasksWithFiles.length; i += 1) {
    const left = tasksWithFiles[i]
    const leftFiles = new Set(left.files.map(normalizeTaskFile))
    for (let j = i + 1; j < tasksWithFiles.length; j += 1) {
      const right = tasksWithFiles[j]
      const overlaps = right.files.some((filePath) => leftFiles.has(normalizeTaskFile(filePath)))
      if (!overlaps) {
        return [left, right]
      }
    }
  }

  return null
}

function buildBuildOrchestrationHint(plan) {
  if (plan.taskSummary.underSpecifiedOpenCount > 0) {
    return '编排提示：当前开放任务里仍有条目缺少“涉及文件”“完成标准”或“验证方式”；并行分派或进入可信交付前，先补齐 tasks.md。'
  }

  const openTasks = plan.taskSummary.items.filter((item) => item.status === 'open')
  if (openTasks.length < 2) return ''

  const pair = findDisjointOpenTaskPair(plan)
  if (pair) {
    const describeTask = (task) => `${task.text}（${task.files.slice(0, 2).join(', ')}${task.validation ? `；验证：${task.validation}` : ''}）`
    return `编排提示：检测到可并行的开放任务；如需提速，可先读取 hello-subagent 再按 tasks.md 分派。任务A：${describeTask(pair[0])}；任务B：${describeTask(pair[1])}。`
  }
  if (openTasks.every((item) => item.files.length === 0)) {
    return '编排提示：当前有多个开放任务，但 tasks.md 尚未写清契约元数据；考虑子代理并行前先补足文件路径、完成标准与验证方式。'
  }
  return '编排提示：当前仍有多个开放任务，但文件范围存在重叠；暂不并行子代理，优先串行推进。'
}

export function buildOrchestrationHintFromSnapshot(snapshot, cwd, recommendation = buildRecommendation(snapshot, cwd)) {
  const plan = getTargetPlans(snapshot)[0]
  if (!plan || !recommendation) return ''

  if (recommendation.nextCommand === 'build') {
    return buildBuildOrchestrationHint(plan)
  }
  if (recommendation.nextCommand === 'verify' && plan.taskSummary.total >= 1) {
    const action = buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)
    if (action?.phase === 'verify') {
      return `编排提示：当前已进入收尾；${[action.routeHint, action.gateHint].filter(Boolean).join(' ')}`
    }
  }
  if (recommendation.stage === 'consolidate') {
    const action = buildDeliveryActionFromSnapshot(snapshot, cwd, recommendation)
    if (action?.phase === 'consolidate') {
      return `编排提示：当前已进入 CONSOLIDATE；${[action.routeHint, action.gateHint].filter(Boolean).join(' ')}`
    }
  }
  return ''
}

#!/usr/bin/env node
/**
 * HelloAGENTS Delivery Gate — workflow-aware completion gate
 * Blocks "done" style close-out messages when the active plan package is still open
 * or when the plan artifacts are incomplete enough that delivery is not trustworthy.
 */
import { readFileSync } from 'node:fs'
import { getAdvisorEvidenceStatus } from './advisor-state.mjs'
import { getCloseoutEvidenceStatus } from './closeout-state.mjs'
import { getAdvisorRequirement, getVisualValidationRequirement } from './plan-contract.mjs'
import { getVisualEvidenceStatus } from './visual-state.mjs'
import { buildDeliveryGateHint, getDeliveryAction, getWorkflowRecommendation, getWorkflowSnapshot } from './workflow-state.mjs'
import { getReviewEvidenceStatus } from './review-state.mjs'
import { getVerifyEvidenceStatus } from './verify-state.mjs'

function selectGatePlans(snapshot) {
  if (snapshot.activePlans.length > 0) return snapshot.activePlans
  return snapshot.plans
}

function buildUnderSpecifiedDetails(entry) {
  return entry.taskSummary.underSpecifiedItems
    .slice(0, 3)
    .map((item) => {
      const missing = []
      if (item.files.length === 0) missing.push('missing files')
      if (!item.acceptance) missing.push('missing acceptance')
      if (!item.validation) missing.push('missing validation')
      return `${item.text} (${missing.join(', ')})`
    })
}

function collectTaskMetadataIssues(entry, issues) {
  if (entry.taskSummary.underSpecifiedCount === 0) return
  issues.push({
    type: 'under-specified-tasks',
    planName: entry.planName,
    details: buildUnderSpecifiedDetails(entry),
    extraCount: Math.max(entry.taskSummary.underSpecifiedCount - 3, 0),
  })
}

function collectPlanIssues(planEntries) {
  const issues = []

  for (const entry of planEntries) {
    if (entry.missingFiles.length > 0) {
      issues.push({
        type: 'missing-files',
        planName: entry.planName,
        details: entry.missingFiles.map((file) => `missing ${file}`),
      })
    }

    if (entry.templateIssues.length > 0) {
      issues.push({
        type: 'template-placeholders',
        planName: entry.planName,
        details: entry.templateIssues,
      })
    }

    if (entry.taskSummary.total === 0) {
      issues.push({
        type: 'missing-task-checklist',
        planName: entry.planName,
        details: ['tasks.md does not contain any checklist items'],
      })
      continue
    }

    if (entry.taskSummary.open > 0) {
      issues.push({
        type: 'unfinished-tasks',
        planName: entry.planName,
        details: entry.taskSummary.items
          .filter((item) => item.status === 'open')
          .slice(0, 3)
          .map((item) => item.text),
        extraCount: Math.max(entry.taskSummary.open - 3, 0),
      })
    }
    collectTaskMetadataIssues(entry, issues)

    if (entry.contractIssues.length > 0) {
      issues.push({
        type: 'missing-contract',
        planName: entry.planName,
        details: entry.contractIssues,
      })
    }
  }

  return issues
}

function collectEvidenceIssues(issues, verificationStatus, reviewStatus, advisorStatus, visualStatus, closeoutStatus) {
  if (verificationStatus?.required && verificationStatus.status !== 'valid') {
    issues.push({
      type: 'missing-verify-evidence',
      planName: 'delivery',
      details: verificationStatus.details,
    })
  }

  if (reviewStatus?.required && reviewStatus.status !== 'valid') {
    issues.push({
      type: 'missing-review-evidence',
      planName: 'delivery',
      details: reviewStatus.details,
    })
  }
  if (advisorStatus?.required && advisorStatus.status !== 'valid') {
    issues.push({
      type: 'missing-advisor-evidence',
      planName: 'delivery',
      details: advisorStatus.details,
    })
  }
  if (visualStatus?.required && visualStatus.status !== 'valid') {
    issues.push({
      type: 'missing-visual-evidence',
      planName: 'delivery',
      details: visualStatus.details,
    })
  }

  if (issues.length === 0 && closeoutStatus?.required && closeoutStatus.status !== 'valid') {
    issues.push({
      type: 'missing-closeout-evidence',
      planName: 'delivery',
      details: closeoutStatus.details,
    })
  }
}

function collectGateIssues(planEntries, verificationStatus, reviewStatus, advisorStatus, visualStatus, closeoutStatus) {
  const issues = collectPlanIssues(planEntries)
  collectEvidenceIssues(issues, verificationStatus, reviewStatus, advisorStatus, visualStatus, closeoutStatus)
  return issues
}

function issueHeading(issue) {
  switch (issue.type) {
    case 'missing-files':
      return 'active plan package is missing required artifacts'
    case 'template-placeholders':
      return 'active plan package still contains template placeholders'
    case 'missing-task-checklist':
      return 'active plan package has no executable tasks'
    case 'unfinished-tasks':
      return 'active plan package still has unfinished tasks'
    case 'under-specified-tasks':
      return 'active plan package has under-specified task metadata'
    case 'missing-contract':
      return 'active plan package is missing a trustworthy structured contract'
    case 'missing-verify-evidence':
      return 'current workflow is missing fresh verification evidence'
    case 'missing-review-evidence':
      return 'current workflow is missing fresh review evidence'
    case 'missing-advisor-evidence':
      return 'current workflow is missing fresh advisor evidence'
    case 'missing-visual-evidence':
      return 'current workflow is missing fresh visual validation evidence'
    case 'missing-closeout-evidence':
      return 'current workflow is missing fresh closeout evidence'
    default:
      return 'active plan package is not ready for delivery'
  }
}

function buildBlockReason(issues, recommendation, gateHint) {
  const lines = ['[Delivery Gate] Delivery is blocked because the current workflow state is not closed yet:']

  for (const issue of issues) {
    lines.push(`- ${issue.planName}: ${issueHeading(issue)}`)
    for (const detail of issue.details) {
      lines.push(`  - ${detail}`)
    }
    if (issue.extraCount) {
      lines.push(`  - ...and ${issue.extraCount} more`)
    }
  }

  lines.push('')
  if (recommendation?.nextPath) {
    lines.push(`Recommended path: ${recommendation.nextPath}`)
  }
  if (issues.some((issue) => issue.type === 'missing-closeout-evidence')) {
    lines.push('Next closeout step: write `.helloagents/.ralph-closeout.json` with `requirementsCoverage` and `deliveryChecklist` before reporting completion.')
  }
  if (issues.some((issue) => issue.type === 'missing-visual-evidence')) {
    lines.push('Next visual step: write `.helloagents/.ralph-visual.json` with `tooling`, `screensChecked`, `statesChecked`, `status`, and `summary` before reporting completion.')
  }
  if (gateHint) {
    lines.push(gateHint)
  }
  lines.push('Do not report completion yet. First finish or explicitly close the remaining tasks, or repair the active plan package so it becomes a trustworthy delivery record.')
  return lines.join('\n')
}

function main() {
  let data = {}
  try {
    data = JSON.parse(readFileSync(0, 'utf-8'))
  } catch {}
  const cwd = data.cwd || process.cwd()
  const workflowOptions = { payload: data }
  const snapshot = getWorkflowSnapshot(cwd, workflowOptions)
  const recommendation = getWorkflowRecommendation(cwd, workflowOptions)
  const verificationStatus = getVerifyEvidenceStatus(cwd)
  const deliveryAction = getDeliveryAction(cwd, workflowOptions)
  const gatePlans = selectGatePlans(snapshot)
  const reviewStatus = getReviewEvidenceStatus(cwd, {
    required: deliveryAction?.phase === 'verify' && deliveryAction?.mode === 'review-first',
  })
  if (gatePlans.length === 0) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }))
    return
  }

  const advisorRequirements = gatePlans.map((entry) => getAdvisorRequirement(entry.contract))
  const advisorStatus = getAdvisorEvidenceStatus(cwd, {
    required: advisorRequirements.some((entry) => entry.required),
    focus: advisorRequirements.flatMap((entry) => entry.focus || []),
  })
  const visualRequirements = gatePlans.map((entry) => getVisualValidationRequirement(entry.contract))
  const visualStatus = getVisualEvidenceStatus(cwd, {
    required: visualRequirements.some((entry) => entry.required),
    screens: visualRequirements.flatMap((entry) => entry.screens || []),
    states: visualRequirements.flatMap((entry) => entry.states || []),
  })
  const closeoutRequired = (
    gatePlans.every((entry) => entry.missingFiles.length === 0 && entry.templateIssues.length === 0 && entry.taskSummary.total > 0 && entry.taskSummary.open === 0 && entry.taskSummary.underSpecifiedCount === 0)
    && (!verificationStatus.required || verificationStatus.status === 'valid')
    && (!reviewStatus.required || reviewStatus.status === 'valid')
    && (!advisorStatus.required || advisorStatus.status === 'valid')
    && (!visualStatus.required || visualStatus.status === 'valid')
  )
  const closeoutStatus = getCloseoutEvidenceStatus(cwd, {
    required: closeoutRequired,
  })

  const issues = collectGateIssues(gatePlans, verificationStatus, reviewStatus, advisorStatus, visualStatus, closeoutStatus)
  if (issues.length === 0) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }))
    return
  }

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: buildBlockReason(issues, recommendation, buildDeliveryGateHint(cwd, workflowOptions)),
    suppressOutput: true,
  }))
}

main()

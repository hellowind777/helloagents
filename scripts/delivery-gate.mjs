#!/usr/bin/env node
/**
 * HelloAGENTS Delivery Gate — workflow-aware completion gate
 * Blocks "done" style close-out messages when the active plan package is still open
 * or when the plan artifacts are incomplete enough that delivery is not trustworthy.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getAdvisorEvidenceStatus } from './advisor-state.mjs'
import { getCloseoutEvidenceStatus } from './closeout-state.mjs'
import { getAdvisorRequirement, getVisualValidationRequirement } from './plan-contract.mjs'
import { getVisualEvidenceStatus } from './visual-state.mjs'
import { buildDeliveryGateHint, getDeliveryAction, getWorkflowRecommendation, getWorkflowSnapshot } from './workflow-state.mjs'
import { getReviewEvidenceStatus } from './review-state.mjs'
import { getVerifyEvidenceStatus } from './verify-state.mjs'
import { buildDeliveryBlockReason, buildUnderSpecifiedDetails } from './delivery-gate-messages.mjs'

function selectGatePlans(snapshot) {
  if (snapshot.activePlans.length > 0) return snapshot.activePlans
  return snapshot.plans
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
        details: entry.missingFiles.map((file) => `缺少 ${file}`),
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
        details: ['tasks.md 没有可执行检查项'],
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

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

export function evaluateDeliveryGate(data = {}) {
  const cwd = data.cwd || process.cwd()
  const workflowOptions = { payload: data }
  const snapshot = getWorkflowSnapshot(cwd, workflowOptions)
  const recommendation = getWorkflowRecommendation(cwd, workflowOptions)
  const verificationStatus = getVerifyEvidenceStatus(cwd, workflowOptions)
  const deliveryAction = getDeliveryAction(cwd, workflowOptions)
  const gatePlans = selectGatePlans(snapshot)
  const reviewStatus = getReviewEvidenceStatus(cwd, {
    required: deliveryAction?.phase === 'verify' && deliveryAction?.mode === 'review-first',
    ...workflowOptions,
  })
  if (gatePlans.length === 0) {
    return { suppressOutput: true }
  }

  const advisorRequirements = gatePlans.map((entry) => getAdvisorRequirement(entry.contract))
  const advisorStatus = getAdvisorEvidenceStatus(cwd, {
    required: advisorRequirements.some((entry) => entry.required),
    focus: advisorRequirements.flatMap((entry) => entry.focus || []),
    ...workflowOptions,
  })
  const visualRequirements = gatePlans.map((entry) => getVisualValidationRequirement(entry.contract))
  const visualStatus = getVisualEvidenceStatus(cwd, {
    required: visualRequirements.some((entry) => entry.required),
    screens: visualRequirements.flatMap((entry) => entry.screens || []),
    states: visualRequirements.flatMap((entry) => entry.states || []),
    ...workflowOptions,
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
    ...workflowOptions,
  })

  const issues = collectGateIssues(gatePlans, verificationStatus, reviewStatus, advisorStatus, visualStatus, closeoutStatus)
  if (issues.length === 0) {
    return { suppressOutput: true }
  }

  return {
    decision: 'block',
    reason: buildDeliveryBlockReason(issues, recommendation, buildDeliveryGateHint(cwd, workflowOptions)),
    suppressOutput: true,
  }
}

function main() {
  process.stdout.write(JSON.stringify(evaluateDeliveryGate(readStdinJson())))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

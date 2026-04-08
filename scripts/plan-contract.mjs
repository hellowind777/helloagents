import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectPlanDir } from './project-storage.mjs'

export const PLAN_CONTRACT_FILE_NAME = 'contract.json'
const VALID_VERIFY_MODES = new Set(['test-first', 'review-first'])
const VALID_ADVISOR_SOURCES = new Set(['claude', 'codex', 'gemini'])

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean))]
}

function normalizeVerifyMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return VALID_VERIFY_MODES.has(normalized) ? normalized : ''
}

function normalizeUiStyleAdvisorContract(input = {}) {
  return {
    required: Boolean(input.required),
    reason: typeof input.reason === 'string' ? input.reason.trim() : '',
    focus: normalizeStringArray(input.focus),
  }
}

function normalizeUiVisualValidationContract(input = {}) {
  return {
    required: Boolean(input.required),
    reason: typeof input.reason === 'string' ? input.reason.trim() : '',
    screens: normalizeStringArray(input.screens),
    states: normalizeStringArray(input.states),
  }
}

function normalizeUiContract(input = {}) {
  const styleAdvisor = normalizeUiStyleAdvisorContract(input.styleAdvisor)
  const visualValidation = normalizeUiVisualValidationContract(input.visualValidation)
  const sourcePriority = normalizeStringArray(input.sourcePriority)
  const designContract = Boolean(input.designContract)

  return {
    required: Boolean(input.required)
      || designContract
      || sourcePriority.length > 0
      || styleAdvisor.required
      || visualValidation.required,
    designContract,
    sourcePriority,
    styleAdvisor,
    visualValidation,
  }
}

function normalizeAdvisorSources(values) {
  return normalizeStringArray(values).filter((value) => VALID_ADVISOR_SOURCES.has(value))
}

function normalizeAdvisorContract(input = {}) {
  return {
    required: Boolean(input.required),
    reason: typeof input.reason === 'string' ? input.reason.trim() : '',
    focus: normalizeStringArray(input.focus),
    preferredSources: normalizeAdvisorSources(input.preferredSources),
  }
}

function resolvePlanDir(cwd, input = {}) {
  const rawPlanDir = typeof input.planDir === 'string' ? input.planDir.trim() : ''
  if (!rawPlanDir) return ''
  return resolveProjectPlanDir(cwd, rawPlanDir)
}

export function getPlanContractPath(planDir) {
  return join(planDir, PLAN_CONTRACT_FILE_NAME)
}

export function readPlanContract(planDir) {
  try {
    return JSON.parse(readFileSync(getPlanContractPath(planDir), 'utf-8'))
  } catch {
    return null
  }
}

export function normalizePlanContract(input = {}) {
  return {
    version: 1,
    source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : 'manual',
    originCommand: typeof input.originCommand === 'string' ? input.originCommand.trim() : '',
    verifyMode: normalizeVerifyMode(input.verifyMode),
    reviewerFocus: normalizeStringArray(input.reviewerFocus),
    testerFocus: normalizeStringArray(input.testerFocus),
    ui: normalizeUiContract(input.ui),
    advisor: normalizeAdvisorContract(input.advisor),
  }
}

export function getAdvisorRequirement(contract = null) {
  const normalized = normalizePlanContract(contract || {})
  const advisor = normalized.advisor || normalizeAdvisorContract()
  const styleAdvisor = normalized.ui?.styleAdvisor || normalizeUiStyleAdvisorContract()

  return {
    required: Boolean(advisor.required || styleAdvisor.required),
    genericRequired: advisor.required,
    styleRequired: styleAdvisor.required,
    reason: [advisor.reason, styleAdvisor.reason].filter(Boolean).join('；'),
    focus: normalizeStringArray([...advisor.focus, ...styleAdvisor.focus]),
    preferredSources: advisor.preferredSources,
  }
}

export function getVisualValidationRequirement(contract = null) {
  const normalized = normalizePlanContract(contract || {})
  return normalized.ui?.visualValidation || normalizeUiVisualValidationContract()
}

export function getPlanContractIssues(contract = null) {
  if (!contract) {
    return ['missing contract.json']
  }

  const normalized = normalizePlanContract(contract)
  const advisorRequirement = getAdvisorRequirement(normalized)
  const visualValidation = getVisualValidationRequirement(normalized)
  const issues = []
  if (!normalizeVerifyMode(normalized.verifyMode)) {
    issues.push('contract.json missing valid verifyMode')
  }
  if (normalizeStringArray(normalized.testerFocus).length === 0) {
    issues.push('contract.json missing testerFocus')
  }
  if (normalizeVerifyMode(normalized.verifyMode) === 'review-first' && normalizeStringArray(normalized.reviewerFocus).length === 0) {
    issues.push('contract.json missing reviewerFocus for review-first flow')
  }
  if (normalized.ui?.required && normalizeStringArray(normalized.ui.sourcePriority).length === 0) {
    issues.push('contract.json missing ui.sourcePriority')
  }
  if (normalized.ui?.styleAdvisor?.required && !String(normalized.ui.styleAdvisor.reason || '').trim()) {
    issues.push('contract.json missing ui.styleAdvisor.reason')
  }
  if (normalized.ui?.styleAdvisor?.required && normalizeStringArray(normalized.ui.styleAdvisor.focus).length === 0) {
    issues.push('contract.json missing ui.styleAdvisor.focus')
  }
  if (visualValidation.required && !String(visualValidation.reason || '').trim()) {
    issues.push('contract.json missing ui.visualValidation.reason')
  }
  if (visualValidation.required && visualValidation.screens.length === 0 && visualValidation.states.length === 0) {
    issues.push('contract.json missing ui.visualValidation.screens or ui.visualValidation.states')
  }
  if (advisorRequirement.genericRequired && !String(normalized.advisor.reason || '').trim()) {
    issues.push('contract.json missing advisor.reason')
  }
  if (advisorRequirement.genericRequired && normalizeStringArray(normalized.advisor.focus).length === 0) {
    issues.push('contract.json missing advisor.focus')
  }
  if (advisorRequirement.genericRequired && normalizeAdvisorSources(normalized.advisor.preferredSources).length === 0) {
    issues.push('contract.json missing advisor.preferredSources')
  }
  return issues
}

export function writePlanContract(planDir, input = {}) {
  mkdirSync(planDir, { recursive: true })
  const payload = {
    updatedAt: new Date().toISOString(),
    ...normalizePlanContract(input),
  }
  writeFileSync(getPlanContractPath(planDir), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  return payload
}

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf-8'))
  } catch {
    return {}
  }
}

function main() {
  const command = process.argv[2] || ''
  if (command !== 'write') return

  const input = readStdinJson()
  const cwd = input.cwd || process.cwd()
  const planDir = resolvePlanDir(cwd, input)
  if (!planDir) {
    process.stdout.write(JSON.stringify({
      suppressOutput: true,
      error: 'planDir is required',
    }))
    return
  }

  const payload = writePlanContract(planDir, input)
  process.stdout.write(JSON.stringify({
    suppressOutput: true,
    path: getPlanContractPath(planDir),
    payload,
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}

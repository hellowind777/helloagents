import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

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

function normalizeUiContract(input = {}) {
  return {
    required: Boolean(input.required),
    designContract: Boolean(input.designContract),
    sourcePriority: normalizeStringArray(input.sourcePriority),
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

  if (isAbsolute(rawPlanDir)) {
    return normalize(rawPlanDir)
  }

  if (rawPlanDir.startsWith('.helloagents/')) {
    return normalize(join(cwd, rawPlanDir))
  }

  if (rawPlanDir.startsWith('.helloagents\\')) {
    return normalize(join(cwd, rawPlanDir))
  }

  if (rawPlanDir.startsWith('plans/')) {
    return normalize(join(cwd, '.helloagents', rawPlanDir))
  }

  if (rawPlanDir.startsWith('plans\\')) {
    return normalize(join(cwd, '.helloagents', rawPlanDir))
  }

  const fromCwd = normalize(join(cwd, rawPlanDir))
  if (existsSync(fromCwd)) {
    return fromCwd
  }

  return normalize(join(cwd, '.helloagents', 'plans', rawPlanDir))
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

export function getPlanContractIssues(contract = null) {
  if (!contract) {
    return ['missing contract.json']
  }

  const issues = []
  if (!normalizeVerifyMode(contract.verifyMode)) {
    issues.push('contract.json missing valid verifyMode')
  }
  if (normalizeStringArray(contract.testerFocus).length === 0) {
    issues.push('contract.json missing testerFocus')
  }
  if (normalizeVerifyMode(contract.verifyMode) === 'review-first' && normalizeStringArray(contract.reviewerFocus).length === 0) {
    issues.push('contract.json missing reviewerFocus for review-first flow')
  }
  if (contract.ui?.required && normalizeStringArray(contract.ui.sourcePriority).length === 0) {
    issues.push('contract.json missing ui.sourcePriority')
  }
  if (contract.advisor?.required && !String(contract.advisor.reason || '').trim()) {
    issues.push('contract.json missing advisor.reason')
  }
  if (contract.advisor?.required && normalizeStringArray(contract.advisor.focus).length === 0) {
    issues.push('contract.json missing advisor.focus')
  }
  if (contract.advisor?.required && normalizeAdvisorSources(contract.advisor.preferredSources).length === 0) {
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

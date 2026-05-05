import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'

import { getPlanContractIssues, readPlanContract } from './plan-contract.mjs'
import {
  getProjectPlansDir,
  getProjectSessionStateScope,
  resolveProjectPlanDir,
} from './project-storage.mjs'

const PLAN_TEMPLATE_MARKERS = {
  'requirements.md': [
    /# \{项目\/功能名称\} — 需求/,
    /\[解决什么问题？给谁用？\]/,
    /\[必须有什么？不需要什么？\]/,
  ],
  'plan.md': [
    /# \{项目\/功能名称\} — 实施规划/,
    /\[本次要解决的问题、范围边界、验收目标\]/,
    /\[关键决策及理由\]/,
    /\[功能完成时必须为真的条件、关键验收点、reviewer \/ tester 关注边界\]/,
  ],
  'tasks.md': [
    /# \{项目\/功能名称\} — 任务分解/,
    /\[按执行顺序排列，每个任务独立可验证\]/,
    /- \[ \] 任务1（AFK\/HITL）：端到端行为描述/,
  ],
}

function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function parseMarkdownSections(content = '') {
  const sections = {}
  let currentTitle = ''
  let currentLines = []

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/)
    if (match) {
      if (currentTitle) {
        sections[currentTitle] = currentLines.join('\n').trim()
      }
      currentTitle = match[1].trim()
      currentLines = []
      continue
    }
    if (currentTitle) {
      currentLines.push(line)
    }
  }

  if (currentTitle) {
    sections[currentTitle] = currentLines.join('\n').trim()
  }

  return sections
}

function normalizePlanRef(rawValue) {
  return (rawValue || '')
    .replace(/[`'"]/g, '')
    .split(/\r?\n/)[0]
    .trim()
}

function resolvePlanDir(cwd, rawValue) {
  const value = normalizePlanRef(rawValue)
  if (!value || value === '（无）' || value === '(无)') return ''

  if (isAbsolute(value)) {
    return normalize(value.replace(/[\\/]+$/, ''))
  }

  const match = value.match(/(?:\.helloagents[\\/])?plans[\\/][^\s/\\]+/)
  if (!match) return ''
  return resolveProjectPlanDir(cwd, match[0])
}

function splitTaskMetaValues(rawValue = '') {
  return rawValue
    .split(/[，,、]/)
    .map((value) => value.replace(/[`'"]/g, '').trim())
    .filter(Boolean)
}

export function normalizeTaskFile(filePath = '') {
  return filePath.replace(/\\/g, '/').replace(/[`'"]/g, '').trim().toLowerCase()
}

function extractTaskFiles(text = '') {
  const explicitMatch = text.match(/涉及文件\s*[:：]\s*([^)）;；]+)/)
  if (explicitMatch) {
    return splitTaskMetaValues(explicitMatch[1])
  }

  const matches = text.match(/(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)?/g) || []
  return [...new Set(matches.map((value) => value.trim()))]
}

function extractTaskValidation(text = '') {
  const validationMatch = text.match(/验证方式\s*[:：]\s*([^)）]+)/)
  return validationMatch ? validationMatch[1].trim() : ''
}

function extractTaskAcceptance(text = '') {
  const acceptanceMatch = text.match(/完成标准\s*[:：]\s*([^)）;；]+)/)
  return acceptanceMatch ? acceptanceMatch[1].trim() : ''
}

function summarizeTasks(taskPath) {
  if (!existsSync(taskPath)) {
    return {
      exists: false,
      total: 0,
      open: 0,
      done: 0,
      skipped: 0,
      cancelled: 0,
      items: [],
    }
  }

  const items = []
  for (const rawLine of readText(taskPath).split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = line.match(/^-\s+\[([^\]])\]\s+(.+)$/)
    if (!match) continue
    const marker = match[1]
    const text = match[2].trim()
    let status = 'open'

    if (marker === '√') status = 'done'
    else if (marker === '-') status = 'skipped'
    else if (marker.toUpperCase() === 'X') status = 'cancelled'

    items.push({
      status,
      text,
      files: extractTaskFiles(text),
      acceptance: extractTaskAcceptance(text),
      validation: extractTaskValidation(text),
    })
  }

  return {
    exists: true,
    total: items.length,
    open: items.filter((item) => item.status === 'open').length,
    done: items.filter((item) => item.status === 'done').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    underSpecifiedCount: items.filter((item) => item.files.length === 0 || !item.acceptance || !item.validation).length,
    underSpecifiedOpenCount: items.filter((item) => item.status === 'open' && (item.files.length === 0 || !item.acceptance || !item.validation)).length,
    underSpecifiedItems: items.filter((item) => item.files.length === 0 || !item.acceptance || !item.validation),
    items,
  }
}

function findTemplateIssues(fileName, filePath) {
  if (!existsSync(filePath)) return []
  const content = readText(filePath)
  return (PLAN_TEMPLATE_MARKERS[fileName] || [])
    .filter((pattern) => pattern.test(content))
    .map(() => `${fileName} 仍包含模板占位内容`)
}

function comparePlanEntries(a, b) {
  return a.planName.localeCompare(b.planName)
}

export function readStateSnapshot(cwd, options = {}) {
  const stateScope = getProjectSessionStateScope(cwd, options)
  const statePath = stateScope.statePath
  const exists = existsSync(statePath)
  const content = readText(statePath)
  const sections = parseMarkdownSections(content)
  const referencedPlanDir = resolvePlanDir(cwd, sections['方案'])

  return {
    statePath,
    stateScope: stateScope.stateScope,
    stateSessionToken: stateScope.stateSessionToken,
    stateSessionMode: stateScope.stateSessionMode,
    stateWorkspace: stateScope.stateWorkspace,
    sessionScoped: stateScope.stateScope === 'session',
    exists,
    content,
    sections,
    referencedPlanDir,
  }
}

export function listPlanPackages(cwd) {
  const plansDir = getProjectPlansDir(cwd)
  if (!existsSync(plansDir)) return []

  return readdirSync(plansDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dirPath = join(plansDir, entry.name)
      const filePaths = {
        requirementsPath: join(dirPath, 'requirements.md'),
        planPath: join(dirPath, 'plan.md'),
        taskPath: join(dirPath, 'tasks.md'),
      }
      const missingFiles = Object.entries({
        'requirements.md': filePaths.requirementsPath,
        'plan.md': filePaths.planPath,
        'tasks.md': filePaths.taskPath,
      })
        .filter(([, pathValue]) => !existsSync(pathValue))
        .map(([name]) => name)
      const taskSummary = summarizeTasks(filePaths.taskPath)
      const planSections = parseMarkdownSections(readText(filePaths.planPath))
      const contract = readPlanContract(dirPath)
      const contractIssues = getPlanContractIssues(contract)
      const templateIssues = [
        ...findTemplateIssues('requirements.md', filePaths.requirementsPath),
        ...findTemplateIssues('plan.md', filePaths.planPath),
        ...findTemplateIssues('tasks.md', filePaths.taskPath),
      ]

      return {
        planName: entry.name,
        dirPath,
        relativePath: `.helloagents/plans/${entry.name}`,
        missingFiles,
        planSections,
        taskSummary,
        contract,
        contractIssues,
        templateIssues,
      }
    })
    .sort(comparePlanEntries)
}

export function getWorkflowSnapshot(cwd, options = {}) {
  const state = readStateSnapshot(cwd, options)
  const plans = listPlanPackages(cwd).map((entry) => ({
    ...entry,
    referencedByState: state.referencedPlanDir ? normalize(entry.dirPath) === normalize(state.referencedPlanDir) : false,
  }))

  const activePlans = state.referencedPlanDir
    ? plans.filter((entry) => entry.referencedByState)
    : plans

  return {
    state,
    plans,
    activePlans,
  }
}

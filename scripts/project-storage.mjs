import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path'

import { DEFAULTS } from './cli-config.mjs'
import {
  PROJECT_DIR_NAME,
  getProjectActivationDir,
  getProjectSessionScope,
  normalizeRuntimeOptions,
} from './runtime-scope.mjs'
import {
  getSessionArtifactPath,
  getSessionArtifactRelativePath,
} from './session-capsule.mjs'

const PROJECTS_DIR_NAME = 'projects'
const PROJECT_STORE_MODES = new Set(['local', 'repo-shared'])

function safeJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function runGitRevParse(cwd, args = []) {
  try {
    return execFileSync('git', ['rev-parse', ...args], {
      cwd,
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function resolveGitTopLevel(cwd) {
  const absolute = runGitRevParse(cwd, ['--path-format=absolute', '--show-toplevel'])
  if (absolute) return normalize(absolute)

  const raw = runGitRevParse(cwd, ['--show-toplevel'])
  return raw ? normalize(resolve(cwd, raw)) : ''
}

function resolveGitCommonDir(cwd, repoRoot = '') {
  const absolute = runGitRevParse(cwd, ['--path-format=absolute', '--git-common-dir'])
  if (absolute) return normalize(absolute)

  const raw = runGitRevParse(cwd, ['--git-common-dir'])
  if (!raw) return ''
  if (isAbsolute(raw)) return normalize(raw)
  return normalize(resolve(repoRoot || cwd, raw))
}

function sanitizeRepoName(value = '') {
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'project'
}

function buildProjectKey(cwd) {
  const repoRoot = resolveGitTopLevel(cwd)
  const commonDir = resolveGitCommonDir(cwd, repoRoot)
  const commonDirName = commonDir && basename(commonDir).toLowerCase() === '.git'
    ? basename(dirname(commonDir))
    : basename(commonDir || '')
  const repoName = sanitizeRepoName(commonDirName || basename(repoRoot || cwd))
  const keySource = commonDir || repoRoot || normalize(resolve(cwd))
  const hash = createHash('sha1').update(keySource.toLowerCase()).digest('hex').slice(0, 12)

  return {
    repoName,
    hash,
    key: `${repoName}-${hash}`,
    repoRoot,
    commonDir,
    keySource,
  }
}

function normalizeStoreRelativePath(relativePath = '') {
  return String(relativePath)
    .replace(/[`'"]/g, '')
    .trim()
    .replace(/^\.helloagents[\\/]+/, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
}

function formatPromptPath(pathValue = '') {
  return pathValue ? normalize(pathValue).replace(/\\/g, '/') : ''
}

export function normalizeProjectStoreMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PROJECT_STORE_MODES.has(normalized) ? normalized : DEFAULTS.project_store_mode
}

export function getProjectConfigPath() {
  return join(homedir(), PROJECT_DIR_NAME, 'helloagents.json')
}

export function getProjectStoreMode() {
  const settings = safeJson(getProjectConfigPath()) || {}
  return normalizeProjectStoreMode(settings.project_store_mode)
}

export function getProjectSessionStateScope(cwd, options = {}) {
  const scope = getProjectSessionScope(cwd, normalizeRuntimeOptions(options))

  return {
    stateScope: 'session',
    stateSessionToken: scope.session,
    stateSessionMode: scope.sessionMode,
    stateWorkspace: scope.workspace || scope.branch,
    sessionDir: scope.sessionDir,
    statePath: scope.statePath,
  }
}

export function getProjectStatePath(cwd, options = {}) {
  return getProjectSessionStateScope(cwd, options).statePath
}

export function getProjectEvidenceDir(cwd, options = {}) {
  return getProjectSessionScope(cwd, normalizeRuntimeOptions(options)).artifactsDir
}

export function getProjectEvidencePath(cwd, fileName, options = {}) {
  return getSessionArtifactPath(cwd, fileName, options)
}

export function getProjectEvidenceRelativePath(cwd, fileName, options = {}) {
  return getSessionArtifactRelativePath(cwd, fileName, options)
}

export function isRepoSharedProjectStore(cwd) {
  return getProjectStoreMode(cwd) === 'repo-shared'
}

export function getProjectStoreDir(cwd) {
  if (!isRepoSharedProjectStore(cwd)) {
    return getProjectActivationDir(cwd)
  }

  const projectKey = buildProjectKey(cwd)
  return join(homedir(), PROJECT_DIR_NAME, PROJECTS_DIR_NAME, projectKey.key)
}

export function getProjectStoreSummary(cwd, options = {}) {
  const activationDir = getProjectActivationDir(cwd)
  const storeDir = getProjectStoreDir(cwd)
  const stateScope = getProjectSessionStateScope(cwd, options)
  const artifactsDir = getProjectEvidenceDir(cwd, options)
  const projectKey = buildProjectKey(cwd)
  const projectStoreMode = getProjectStoreMode(cwd)

  return {
    projectStoreMode,
    activationDir,
    storeDir,
    statePath: stateScope.statePath,
    stateScope: stateScope.stateScope,
    stateSessionToken: stateScope.stateSessionToken,
    stateSessionMode: stateScope.stateSessionMode,
    stateWorkspace: stateScope.stateWorkspace,
    sessionStateDir: stateScope.sessionDir,
    artifactsDir,
    usesSharedStore: projectStoreMode === 'repo-shared',
    projectKey: projectKey.key,
    repoRoot: projectKey.repoRoot,
    commonDir: projectKey.commonDir,
    promptActivationDir: formatPromptPath(activationDir),
    promptStoreDir: formatPromptPath(storeDir),
    promptStatePath: formatPromptPath(stateScope.statePath),
    promptSessionStateDir: formatPromptPath(stateScope.sessionDir),
    promptArtifactsDir: formatPromptPath(artifactsDir),
  }
}

export function getProjectKnowledgeFilePath(cwd, fileName) {
  return join(getProjectStoreDir(cwd), fileName)
}

export function getProjectDesignContractPath(cwd) {
  return getProjectKnowledgeFilePath(cwd, 'DESIGN.md')
}

export function getProjectVerifyYamlPath(cwd) {
  return getProjectKnowledgeFilePath(cwd, 'verify.yaml')
}

export function getProjectPlansDir(cwd) {
  return join(getProjectStoreDir(cwd), 'plans')
}

export function resolveProjectPlanDir(cwd, rawPlanDir = '') {
  const value = String(rawPlanDir).replace(/[`'"]/g, '').trim().replace(/[\\/]+$/, '')
  if (!value) return ''

  if (isAbsolute(value)) {
    return normalize(value)
  }

  if (value.startsWith('.helloagents/')) {
    return normalize(join(getProjectStoreDir(cwd), normalizeStoreRelativePath(value)))
  }

  if (value.startsWith('.helloagents\\')) {
    return normalize(join(getProjectStoreDir(cwd), normalizeStoreRelativePath(value)))
  }

  if (value.startsWith('plans/')) {
    return normalize(join(getProjectStoreDir(cwd), normalizeStoreRelativePath(value)))
  }

  if (value.startsWith('plans\\')) {
    return normalize(join(getProjectStoreDir(cwd), normalizeStoreRelativePath(value)))
  }

  const fromCwd = normalize(join(cwd, value))
  if (existsSync(fromCwd)) {
    return fromCwd
  }

  return normalize(join(getProjectPlansDir(cwd), value))
}

export function describeProjectStoreFile(cwd, relativePath = '') {
  const normalizedRelativePath = normalizeStoreRelativePath(relativePath)
  const logicalPath = normalizedRelativePath ? `.helloagents/${normalizedRelativePath}` : '.helloagents/'
  if (!isRepoSharedProjectStore(cwd)) {
    return `\`${logicalPath}\``
  }

  const actualPath = formatPromptPath(join(getProjectStoreDir(cwd), normalizedRelativePath))
  return `逻辑路径 \`${logicalPath}\`（实际存储：\`${actualPath}\`）`
}

export function buildProjectStorageHint(cwd, options = {}) {
  const summary = getProjectStoreSummary(cwd, options)
  const hints = []
  hints.push(`当前状态文件写入 \`${summary.promptStatePath}\``)
  if (summary.stateSessionMode === 'default') {
    hints.push(`当前宿主未提供稳定会话标识，因此使用工作区默认位置 \`${summary.stateSessionToken}\``)
  }
  if (summary.usesSharedStore) {
    hints.push(`项目存储：\`project_store_mode=repo-shared\`；本地激活/会话运行态目录仍是 \`${summary.promptActivationDir}\`，知识库/方案目录改为 \`${summary.promptStoreDir}\``)
  }
  return hints.join('。') + (hints.length > 0 ? '。' : '')
}

export function buildProjectStorageBlock(cwd, options = {}) {
  const summary = getProjectStoreSummary(cwd, options)
  if (!summary.usesSharedStore && !existsSync(summary.activationDir)) {
    return ''
  }

  const details = {
    project_store_mode: summary.projectStoreMode,
    activation_dir: summary.promptActivationDir,
    state_scope: summary.stateScope,
    state_path: summary.promptStatePath,
    state_workspace: summary.stateWorkspace,
    state_session_token: summary.stateSessionToken,
    state_session_mode: summary.stateSessionMode,
    session_state_dir: summary.promptSessionStateDir,
    artifacts_dir: summary.promptArtifactsDir,
    knowledge_base_dir: summary.promptStoreDir,
    uses_shared_store: summary.usesSharedStore,
  }

  const explanations = []
  explanations.push('说明：状态文件只使用 `state_path`。')
  if (summary.stateSessionMode === 'default') {
    explanations.push('说明：当前宿主未提供稳定会话标识，因此使用工作区默认位置。')
  }
  if (summary.usesSharedStore) {
    explanations.push('说明：状态文件与会话产物写本地激活目录；`context.md`、`guidelines.md`、`DESIGN.md`、`verify.yaml`、`modules/`、`plans/`、`archive/` 写知识库/方案目录。')
  } else {
    explanations.push('说明：当前使用项目本地 `.helloagents/` 作为激活目录、知识库目录和方案目录。')
  }

  return [
    '## 当前项目存储',
    '```json',
    JSON.stringify(details, null, 2),
    '```',
    ...explanations,
  ].join('\n')
}

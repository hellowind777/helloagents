import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'node:path'

import { DEFAULTS } from './cli-config.mjs'
import { resolveSessionToken } from './session-token.mjs'

export const PROJECT_DIR_NAME = '.helloagents'
const PROJECTS_DIR_NAME = 'projects'
const PROJECT_SESSIONS_DIR_NAME = 'sessions'
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

function runGitCommand(cwd, args = []) {
  try {
    return execFileSync('git', args, {
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

function sanitizeStateScopeSegment(value = '', fallback = '') {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return normalized || fallback
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

function resolveGitBranchName(cwd) {
  const branchName = runGitRevParse(cwd, ['--abbrev-ref', 'HEAD'])
  if (branchName && branchName !== 'HEAD') return branchName

  const symbolicBranchName = runGitCommand(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  if (symbolicBranchName && symbolicBranchName !== 'HEAD') return symbolicBranchName
  return ''
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

export function getProjectActivationDir(cwd) {
  return join(cwd, PROJECT_DIR_NAME)
}

export function getProjectLegacyStatePath(cwd) {
  return join(getProjectActivationDir(cwd), 'STATE.md')
}

export function getProjectSessionStateScope(cwd, {
  payload = {},
  env = process.env,
  ppid = process.ppid,
} = {}) {
  const legacyStatePath = getProjectLegacyStatePath(cwd)
  const sessionToken = resolveSessionToken({
    payload,
    env,
    ppid,
    allowPpidFallback: false,
  })

  if (!sessionToken) {
    return {
      stateScope: 'project',
      stateSessionToken: '',
      stateBranch: '',
      sessionDir: '',
      legacyStatePath,
      statePath: legacyStatePath,
    }
  }

  const branchName = sanitizeStateScopeSegment(resolveGitBranchName(cwd), 'detached')
  const sessionDir = join(
    getProjectActivationDir(cwd),
    PROJECT_SESSIONS_DIR_NAME,
    branchName,
    sanitizeStateScopeSegment(sessionToken, 'session'),
  )

  return {
    stateScope: 'session',
    stateSessionToken: sessionToken,
    stateBranch: branchName,
    sessionDir,
    legacyStatePath,
    statePath: join(sessionDir, 'STATE.md'),
  }
}

export function getProjectStatePath(cwd, options = {}) {
  return getProjectSessionStateScope(cwd, options).statePath
}

export function getProjectStateCandidates(cwd, options = {}) {
  const scope = getProjectSessionStateScope(cwd, options)
  return scope.statePath === scope.legacyStatePath
    ? [scope.statePath]
    : [scope.statePath, scope.legacyStatePath]
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
  const projectKey = buildProjectKey(cwd)
  const projectStoreMode = getProjectStoreMode(cwd)

  return {
    projectStoreMode,
    activationDir,
    storeDir,
    statePath: stateScope.statePath,
    legacyStatePath: stateScope.legacyStatePath,
    stateScope: stateScope.stateScope,
    stateSessionToken: stateScope.stateSessionToken,
    stateBranch: stateScope.stateBranch,
    sessionStateDir: stateScope.sessionDir,
    usesSharedStore: projectStoreMode === 'repo-shared',
    projectKey: projectKey.key,
    repoRoot: projectKey.repoRoot,
    commonDir: projectKey.commonDir,
    promptActivationDir: formatPromptPath(activationDir),
    promptStoreDir: formatPromptPath(storeDir),
    promptStatePath: formatPromptPath(stateScope.statePath),
    promptLegacyStatePath: formatPromptPath(stateScope.legacyStatePath),
    promptSessionStateDir: formatPromptPath(stateScope.sessionDir),
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

export function buildProjectStorageHint(cwd) {
  const summary = getProjectStoreSummary(cwd)
  const hints = []
  if (summary.stateScope === 'session') {
    hints.push(`当前会话的 STATE.md 独立写入 \`${summary.promptStatePath}\`；仅在缺少会话标识或兼容旧项目时才回退 \`${summary.promptLegacyStatePath}\``)
  }
  if (summary.usesSharedStore) {
    hints.push(`项目存储：\`project_store_mode=repo-shared\`；本地激活/运行态目录仍是 \`${summary.promptActivationDir}\`，知识库/方案目录改为 \`${summary.promptStoreDir}\``)
  }
  return hints.join('。') + (hints.length > 0 ? '。' : '')
}

export function buildProjectStorageBlock(cwd) {
  const summary = getProjectStoreSummary(cwd)
  if (!summary.usesSharedStore && !existsSync(summary.activationDir)) {
    return ''
  }

  const details = {
    project_store_mode: summary.projectStoreMode,
    activation_dir: summary.promptActivationDir,
    state_scope: summary.stateScope,
    state_path: summary.promptStatePath,
    legacy_state_path: summary.promptLegacyStatePath,
    state_branch: summary.stateBranch,
    state_session_token: summary.stateSessionToken,
    session_state_dir: summary.promptSessionStateDir,
    knowledge_base_dir: summary.promptStoreDir,
    uses_shared_store: summary.usesSharedStore,
  }

  const explanations = []
  if (summary.stateScope === 'session') {
    explanations.push('说明：当前会话的 STATE.md 独立写入 `state_path`；读写恢复快照时优先使用该路径，不要回写 `legacy_state_path`。')
  }
  if (summary.usesSharedStore) {
    explanations.push('说明：`STATE.md` 与 `.ralph-*.json` 继续写本地激活目录；`context.md`、`guidelines.md`、`DESIGN.md`、`verify.yaml`、`modules/`、`plans/`、`archive/` 写知识库/方案目录。')
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

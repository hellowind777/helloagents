import {
  createTimestampedBackupPath,
  readCodexBackup,
  removeCodexBackup,
} from './cli-codex-backup.mjs'
import { safeWrite } from './cli-utils.mjs'
import {
  ensureTopLevelTomlBlock,
  readTopLevelTomlBlock,
  removeTopLevelTomlBlock,
  stripTomlSection,
  upsertTopLevelTomlBlock,
} from './cli-toml.mjs'

export const CODEX_PLUGIN_CONFIG_HEADER = '[plugins."helloagents@local-plugins"]'
export const CODEX_MANAGED_TOML_COMMENT = '# helloagents-managed'
const CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME = 'developer_instructions'

export const CODEX_DEVELOPER_INSTRUCTIONS = `CRITICAL: These are HelloAGENTS global defaults for Codex. Use them as the baseline for main-agent behavior. Spawned sub-agents should focus on the delegated task unless they are explicitly required to follow main-agent-only workflow.
If the current workspace contains a project-level AGENTS.md or other repo-specific instructions, treat those as the more specific and authoritative instructions. Use these global defaults only where they do not conflict. Standby/global behavior is determined by the active workspace instructions, not by this global default block.
If work was already in progress and earlier context was compressed, first restore the active project state from the most relevant project state files or other project-local context artifacts, then continue from the actual interruption point without restarting the workflow or repeating completed steps.`

export function isManagedCodexStandbyInstructionPath(normalized = '') {
  return /\/\.codex\/helloagents\/bootstrap-lite\.md/i.test(normalized)
}

export function isManagedCodexGlobalInstructionPath(normalized = '') {
  return /\/plugins\/helloagents\/AGENTS\.md/i.test(normalized)
    || /\/plugins\/helloagents\/bootstrap\.md/i.test(normalized)
}

export function upsertCodexPluginConfig(text) {
  const stripped = stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text.trimEnd()
  const block = `${CODEX_PLUGIN_CONFIG_HEADER}\nenabled = true`
  return stripped ? `${stripped}\n\n${block}\n` : `${block}\n`
}

export function removeCodexPluginConfig(text) {
  return stripTomlSection(text, CODEX_PLUGIN_CONFIG_HEADER).text
}

export function isManagedCodexModelInstruction(line = '') {
  const normalized = String(line || '').replace(/\\/g, '/')
  return line.includes('model_instructions_file')
    && (
      line.includes(CODEX_MANAGED_TOML_COMMENT)
      || isManagedCodexStandbyInstructionPath(normalized)
      || isManagedCodexGlobalInstructionPath(normalized)
    )
}

export function isManagedCodexNotify(line = '') {
  return line.includes('codex-notify') || (line.includes('helloagents') && line.includes('notify'))
}

export function isManagedCodexBackupInstruction(line = '') {
  return line.includes(CODEX_MANAGED_TOML_COMMENT)
}

function formatManagedCodexDeveloperInstructions() {
  return `"""\n${CODEX_DEVELOPER_INSTRUCTIONS}\n"""`
}

function backupUserCodexDeveloperInstructions(configPath, existingBlock) {
  if (!existingBlock || existingBlock.includes('HelloAGENTS')) return
  safeWrite(createTimestampedBackupPath(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME), `${existingBlock}\n`)
}

function sanitizeCodexDeveloperInstructionsBackup(block = '') {
  const normalized = String(block || '').trim()
  if (!normalized.startsWith('developer_instructions =')) return ''
  if (normalized.includes(CODEX_DEVELOPER_INSTRUCTIONS)) return ''
  return normalized
}

function readCodexDeveloperInstructionsBackup(configPath) {
  return sanitizeCodexDeveloperInstructionsBackup(
    readCodexBackup(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME),
  )
}

function removeCodexDeveloperInstructionsBackup(configPath) {
  removeCodexBackup(configPath, CODEX_DEVELOPER_INSTRUCTIONS_BACKUP_BASENAME)
}

export function installCodexDeveloperInstructions(configPath, toml) {
  const existing = readTopLevelTomlBlock(toml, 'developer_instructions')
  backupUserCodexDeveloperInstructions(configPath, existing)
  return upsertTopLevelTomlBlock(toml, 'developer_instructions', formatManagedCodexDeveloperInstructions())
}

export function uninstallCodexDeveloperInstructions(configPath, toml) {
  const existing = readTopLevelTomlBlock(toml, 'developer_instructions')
  if (!existing.includes('HelloAGENTS')) return toml
  let next = removeTopLevelTomlBlock(toml, 'developer_instructions')
  const backupDeveloperInstructions = readCodexDeveloperInstructionsBackup(configPath)
  next = ensureTopLevelTomlBlock(next, 'developer_instructions', backupDeveloperInstructions)
  removeCodexDeveloperInstructionsBackup(configPath)
  return next
}

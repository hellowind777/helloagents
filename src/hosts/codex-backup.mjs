/**
 * Codex config.toml 备份与恢复。
 *
 * 安装前将原始文件以时间戳命名复制到 ~/.helloagents/backups/codex/ 下，
 * 保留最近 5 份备份用于回滚。卸载时恢复最新一份，完全卸载时清理全部。
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { copyPath, ensureDir, fileExists, removePath } from '../kernel/fsx.mjs'
import { helloagentsRoot } from '../kernel/paths.mjs'

const MAX_BACKUPS = 5

/** @param {string} home */
function backupDir(home) {
  return join(helloagentsRoot(home), 'backups', 'codex')
}

/**
 * 生成时间戳文件名：config.toml_20260728-143052.bak
 * @returns {string}
 */
function timestampedName() {
  const now = new Date()
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `config.toml_${date}-${time}.bak`
}

/**
 * 列出备份目录中所有时间戳备份文件，按文件名升序（旧→新）。
 * @param {string} dir
 * @returns {string[]}
 */
function listBackups(dir) {
  if (!fileExists(dir)) return []
  try {
    return readdirSync(dir)
      .filter((name) => /^config\.toml_\d{8}-\d{6}\.bak$/.test(name))
      .sort()
  } catch {
    return []
  }
}

/**
 * 删除超出保留数量的旧备份。
 * @param {string} dir
 */
function pruneBackups(dir) {
  const backups = listBackups(dir)
  while (backups.length > MAX_BACKUPS) {
    removePath(join(dir, /** @type {string} */ (backups.shift())))
  }
}

/**
 * 备份 config.toml —— 始终创建新的时间戳副本。
 * @param {string} home
 * @param {string} configPath
 */
export function backupCodexConfig(home, configPath) {
  if (!fileExists(configPath)) return
  const dir = backupDir(home)
  ensureDir(dir)
  const dest = join(dir, timestampedName())
  copyPath(configPath, dest)
  pruneBackups(dir)
}

/**
 * 卸载时清理全部备份文件。
 * @param {string} home
 */
export function removeCodexBackups(home) {
  removePath(backupDir(home))
}

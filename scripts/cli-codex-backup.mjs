import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { removeIfExists, safeRead } from './cli-utils.mjs'

const CODEX_BACKUP_TIMESTAMP_RE = /^\d{8}-\d{6}$/

function formatBackupTimestamp(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function createTimestampedBackupPath(filePath, backupBaseName) {
  return join(dirname(filePath), `${backupBaseName}_${formatBackupTimestamp()}.bak`)
}

function listTimestampedBackups(directory, backupBaseName) {
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter((name) => name.startsWith(`${backupBaseName}_`) && name.endsWith('.bak'))
    .filter((name) => CODEX_BACKUP_TIMESTAMP_RE.test(name.slice(backupBaseName.length + 1, -4)))
    .sort()
}

function getLatestTimestampedBackupPath(filePath, backupBaseName) {
  const backups = listTimestampedBackups(dirname(filePath), backupBaseName)
  const latest = backups.at(-1)
  return latest ? join(dirname(filePath), latest) : ''
}

function readLatestTimestampedBackup(filePath, backupBaseName) {
  const backupPath = getLatestTimestampedBackupPath(filePath, backupBaseName)
  return backupPath ? safeRead(backupPath) || '' : ''
}

function removeLatestTimestampedBackup(filePath, backupBaseName) {
  const backupPath = getLatestTimestampedBackupPath(filePath, backupBaseName)
  if (backupPath) removeIfExists(backupPath)
}

export function ensureTimestampedBackup(filePath, backupBaseName) {
  if (!existsSync(filePath)) return ''
  const existingBackup = getLatestTimestampedBackupPath(filePath, backupBaseName)
  if (existingBackup) return existingBackup
  const backupPath = createTimestampedBackupPath(filePath, backupBaseName)
  copyFileSync(filePath, backupPath)
  return backupPath
}

export function readCodexBackup(filePath, backupBaseName) {
  const latest = readLatestTimestampedBackup(filePath, backupBaseName)
  if (latest) return latest
  return safeRead(`${filePath}.bak`) || ''
}

export function removeCodexBackup(filePath, backupBaseName) {
  removeLatestTimestampedBackup(filePath, backupBaseName)
  removeIfExists(`${filePath}.bak`)
}

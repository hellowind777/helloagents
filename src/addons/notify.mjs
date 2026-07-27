#!/usr/bin/env node
/**
 * notify 附加组件：回合结束与等待确认时播放提示音、发送桌面通知。
 * 纯体验组件，不参与任何流程控制。
 * Windows 端一律通过 PowerShell 的 -EncodedCommand 传递脚本（UTF-16LE Base64），
 * 避免代码页差异导致中文路径或文案乱码。
 * 测试通道：HELLOAGENTS_NOTIFY_TEST_LOG 指定文件时只记录不外发；
 * HELLOAGENTS_DISABLE_OS_NOTIFICATIONS=1 时完全静默。
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLATFORM = process.platform
const HOME = String(process.env.HELLOAGENTS_HOME || '').trim() || homedir()

const args = process.argv.slice(2)
const HOST = readFlagValue('--host') || (args[0] === 'codex' ? 'codex' : 'claude')

/** @param {string} name */
function readFlagValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? (args[index + 1] ?? '') : ''
}

function detectLanguageLite() {
  const forced = String(process.env.HELLOAGENTS_LANG || '').toLowerCase()
  if (forced.startsWith('cn') || forced.startsWith('zh')) return 'cn'
  if (forced.startsWith('en')) return 'en'
  const locale = `${process.env.LANG || ''} ${process.env.LC_ALL || ''}`.toLowerCase()
  return locale.includes('zh') || locale.includes('cn') ? 'cn' : 'en'
}
const LANGUAGE = detectLanguageLite()

/** @returns {{ sound: boolean, desktop: boolean }} */
function readNotifyConfig() {
  try {
    const raw = JSON.parse(readFileSync(join(HOME, '.helloagents', 'config.json'), 'utf-8'))
    return {
      sound: raw?.notify?.sound !== false,
      desktop: raw?.notify?.desktop !== false,
    }
  } catch {
    return { sound: true, desktop: true }
  }
}

/** @returns {Record<string, unknown>} */
function readStdinJson() {
  try {
    if (process.stdin.isTTY) return {}
    const raw = readFileSync(0, 'utf-8').trim()
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * @param {'sound' | 'desktop'} channel
 * @param {string} event
 * @returns {boolean} 已被测试通道接管
 */
function recordTestTransport(channel, event) {
  const logPath = String(process.env.HELLOAGENTS_NOTIFY_TEST_LOG || '').trim()
  if (!logPath) return false
  try {
    appendFileSync(logPath, `${JSON.stringify({ channel, event, host: HOST })}\n`)
  } catch {
    // 测试日志写入失败不影响主流程。
  }
  return true
}

/** @param {string} command @param {string[]} commandArgs */
function runDetached(command, commandArgs) {
  try {
    const child = spawn(command, commandArgs, { stdio: 'ignore', detached: true, windowsHide: true })
    child.on('error', () => {})
    child.unref()
  } catch {
    process.stderr.write('')
  }
}

/** @param {string} script PowerShell 脚本文本 */
function runPowerShell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  runDetached('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded])
}

/** @param {string} value */
function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** @param {string} value AppleScript 字符串转义：先反斜杠，后引号。 */
function escapeAppleScript(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

/** @param {string} value POSIX shell 单引号转义。 */
function shellQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** @param {string} event */
function playSound(event) {
  if (process.env.HELLOAGENTS_DISABLE_OS_NOTIFICATIONS === '1') return
  if (recordTestTransport('sound', event)) return
  const wav = join(PACKAGE_ROOT, 'assets', 'sounds', `${event === 'notification' ? 'confirm' : 'complete'}.wav`)
  if (!existsSync(wav)) {
    process.stderr.write('')
    return
  }
  if (PLATFORM === 'win32') {
    runPowerShell(`(New-Object System.Media.SoundPlayer '${wav.replaceAll("'", "''")}').PlaySync()`)
  } else if (PLATFORM === 'darwin') {
    runDetached('afplay', [wav])
  } else {
    runDetached('sh', [
      '-c',
      `if command -v paplay >/dev/null 2>&1; then paplay ${shellQuote(wav)}; elif command -v aplay >/dev/null 2>&1; then aplay -q ${shellQuote(wav)}; else printf '\\a'; fi`,
    ])
  }
}

/**
 * @param {string} event
 * @param {string} detail
 */
function desktopNotify(event, detail) {
  if (process.env.HELLOAGENTS_DISABLE_OS_NOTIFICATIONS === '1') return
  if (recordTestTransport('desktop', event)) return
  const title = 'HelloAGENTS'
  const body =
    event === 'notification'
      ? LANGUAGE === 'cn'
        ? '等待你的确认'
        : 'Waiting for your confirmation'
      : LANGUAGE === 'cn'
        ? '本轮任务已结束'
        : 'The current turn has finished'
  const text = detail ? `${body}：${detail}` : body

  if (PLATFORM === 'win32') {
    const appId = 'HelloAGENTS.Notify'
    const iconPath = join(PACKAGE_ROOT, 'assets', 'icons', 'icon.png')
    const iconXml = existsSync(iconPath)
      ? `<image placement="appLogoOverride" src="${escapeXml(iconPath)}" />`
      : ''
    const script = [
      `$regKey = 'HKCU:\\Software\\Classes\\AppUserModelId\\${appId}'`,
      `if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null; Set-ItemProperty -Path $regKey -Name 'DisplayName' -Value 'HelloAGENTS' -Force }`,
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null`,
      `[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null`,
      `$xml = '<toast><visual><binding template="ToastGeneric">${iconXml}<text>${escapeXml(title)}</text><text>${escapeXml(text)}</text></binding></visual></toast>'`,
      `$doc = New-Object Windows.Data.Xml.Dom.XmlDocument`,
      `$doc.LoadXml($xml)`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${appId}').Show([Windows.UI.Notifications.ToastNotification]::new($doc))`,
    ].join('\n')
    runPowerShell(script)
  } else if (PLATFORM === 'darwin') {
    runDetached('osascript', [
      '-e',
      `display notification "${escapeAppleScript(text)}" with title "${escapeAppleScript(title)}"`,
    ])
  } else {
    runDetached('sh', [
      '-c',
      `if command -v notify-send >/dev/null 2>&1; then notify-send ${shellQuote(title)} ${shellQuote(text)}; else printf '\\a'; fi`,
    ])
  }
}

function main() {
  /** @type {'stop' | 'notification' | null} */
  let event = null
  let detail = ''

  if (args[0] === 'codex') {
    let payload = /** @type {Record<string, unknown>} */ ({})
    const rawPayload = args.find((value, index) => index > 0 && !value.startsWith('--'))
    try {
      payload = rawPayload ? JSON.parse(rawPayload) : {}
    } catch {
      payload = {}
    }
    const type = String(payload.type || '')
    if (type === 'agent-turn-complete') event = 'stop'
    else if (type === 'approval-requested') event = 'notification'
    detail = String(payload['last-assistant-message'] || payload.message || '')
  } else {
    const name = String(args[0] || '').toLowerCase()
    if (name === 'stop') event = 'stop'
    else if (name === 'notification') event = 'notification'
    const payload = readStdinJson()
    detail = typeof payload.message === 'string' ? payload.message : ''
  }

  if (event) {
    detail = detail.replaceAll(/\s+/g, ' ').trim().slice(0, 150)
    const config = readNotifyConfig()
    if (config.sound) playSound(event)
    if (config.desktop) desktopNotify(event, detail)
  }

  if (HOST === 'cursor') process.stdout.write('{}')
}

try {
  main()
} catch (error) {
  process.stderr.write(`helloagents notify: ${error instanceof Error ? error.message : String(error)}\n`)
  if (HOST === 'cursor') process.stdout.write('{}')
}

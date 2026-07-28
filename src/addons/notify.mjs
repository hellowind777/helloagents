#!/usr/bin/env node
/**
 * notify 附加组件：回合通知、命令路由与会话初始化。
 *
 * 子命令：
 *   route      — UserPromptSubmit hook：检测 ~command 并路由到对应技能
 *   inject     — SessionStart hook：轻量初始化
 *   stop       — Stop hook：回合结束提醒（音效 + 桌面通知）
 *   codex-notify — Codex 原生的 agent-turn-complete 事件处理
 *   sound      — 单独播放音效（阻塞模式，测试用）
 *   desktop    — 单独发送桌面通知（测试用）
 *
 * Codex hooks 协议：标准输出写 JSON，由 Codex 读取后解释。
 *   路由命中时输出 hookSpecificOutput.systemMessage 注入上下文；
 *   未命中或 silence 模式时输出空 systemMessage。
 *
 * 命令行格式：
 *   helloagents-js notify route --host codex
 *   （从 stdin 读取 Codex hook 传入的 JSON payload）
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveCanonicalCommandSkill } from '../hosts/codex-config.mjs'

// ── 常量和路径 ─────────────────────────────────────────────────────────
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PLATFORM = process.platform
const HOME = String(process.env.HELLOAGENTS_HOME || '').trim() || homedir()

const args = process.argv.slice(2)
const SUBCOMMAND = args[0] || ''
const HOST = readFlag('--host') || (args[0] === 'codex' ? 'codex' : 'claude')
const SILENT = args.includes('--silent')

// ~command 别名映射
const COMMAND_ALIASES = { do: 'build', design: 'plan', review: 'qa', idea: 'ask' }

/** @param {string} name */
function readFlag(name) {
  const index = args.indexOf(name)
  return index >= 0 ? (args[index + 1] ?? '') : ''
}

function detectLanguage() {
  const forced = String(process.env.HELLOAGENTS_LANG || '').toLowerCase()
  if (forced.startsWith('cn') || forced.startsWith('zh')) return 'cn'
  if (forced.startsWith('en')) return 'en'
  const locale = `${process.env.LANG || ''} ${process.env.LC_ALL || ''}`.toLowerCase()
  return locale.includes('zh') || locale.includes('cn') ? 'cn' : 'en'
}
const LANG = detectLanguage()

// ── 工具函数 ───────────────────────────────────────────────────────────

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

/** @param {Record<string, unknown>} payload */
function emit(payload) {
  process.stdout.write(JSON.stringify(payload))
}

/** 空抑制：告诉 Codex 无需干预。各 hook 事件通用，不指定 hookEventName。 */
function emptySuppress() {
  emit({ suppressOutput: true })
}

/**
 * 向 Codex 注入上下文消息（路由命中时）。
 * @param {string} eventName
 * @param {string} message
 */
function injectContext(eventName, message) {
  emit({ hookSpecificOutput: { hookEventName: eventName, systemMessage: message } })
}

// ── 通知功能 ───────────────────────────────────────────────────────────

/**
 * 测试通道：设置 HELLOAGENTS_NOTIFY_TEST_LOG 时只记录日志，
 * 不实际播放声音或发送桌面通知。返回 true 表示已被测试通道接管。
 * @param {'sound' | 'desktop'} channel
 * @param {string} event
 * @returns {boolean}
 */
function recordTestTransport(channel, event) {
  const logPath = String(process.env.HELLOAGENTS_NOTIFY_TEST_LOG || '').trim()
  if (!logPath) return false
  try { appendFileSync(logPath, JSON.stringify({ channel, event, host: HOST }) + '\n') } catch { /* 忽略 */ }
  return true
}

/** @param {string} event */
function notifySound(event) {
  if (process.env.HELLOAGENTS_DISABLE_OS_NOTIFICATIONS === '1') return
  if (recordTestTransport('sound', event)) return
  const file = event === 'notification' ? 'confirm.wav' : 'complete.wav'
  const wav = join(PACKAGE_ROOT, 'assets', 'sounds', file)
  if (!existsSync(wav)) { process.stderr.write('\x07'); return }
  if (PLATFORM === 'win32') {
    const escaped = wav.replaceAll("'", "''").replaceAll('[', '`[').replaceAll(']', '`]')
    const script = `(New-Object System.Media.SoundPlayer '${escaped}').PlaySync()`
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      stdio: 'ignore', detached: true, windowsHide: true,
    })
    child.on('error', () => { process.stderr.write('\x07') })
    child.unref()
  } else if (PLATFORM === 'darwin') {
    spawn('afplay', [wav], { stdio: 'ignore', detached: true }).unref()
  } else {
    spawn('sh', ['-c', `if command -v paplay >/dev/null 2>&1; then paplay '${wav.replaceAll("'", "'\\''")}'; elif command -v aplay >/dev/null 2>&1; then aplay -q '${wav.replaceAll("'", "'\\''")}'; else printf '\\a'; fi`], { stdio: 'ignore', detached: true }).unref()
  }
}

/** @param {string} event @param {string} detail */
function notifyDesktop(event, detail) {
  if (process.env.HELLOAGENTS_DISABLE_OS_NOTIFICATIONS === '1') return
  if (recordTestTransport('desktop', event)) return
  const title = 'HelloAGENTS'
  const body = event === 'notification'
    ? (LANG === 'cn' ? '等待你的确认' : 'Waiting for your confirmation')
    : (LANG === 'cn' ? '本轮任务已结束' : 'The current turn has finished')
  const text = detail ? `${body}：${detail}` : body

  if (PLATFORM === 'win32') {
    const appId = 'HelloAGENTS.Notify'
    const iconPath = join(PACKAGE_ROOT, 'assets', 'icons', 'icon.png')
    const iconXml = existsSync(iconPath)
      ? `<image placement="appLogoOverride" src="${iconPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}" />`
      : ''
    const script = [
      `$regKey = 'HKCU:\\Software\\Classes\\AppUserModelId\\${appId}'`,
      `if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null; Set-ItemProperty -Path $regKey -Name 'DisplayName' -Value 'HelloAGENTS' -Force }`,
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null`,
      `[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null`,
      `$xml = '<toast><visual><binding template="ToastGeneric">${iconXml}<text>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text><text>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></binding></visual></toast>'`,
      `$doc = New-Object Windows.Data.Xml.Dom.XmlDocument`,
      `$doc.LoadXml($xml)`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${appId}').Show([Windows.UI.Notifications.ToastNotification]::new($doc))`,
    ].join('\n')
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { stdio: 'ignore', detached: true, windowsHide: true }).unref()
  } else if (PLATFORM === 'darwin') {
    spawn('osascript', ['-e', `display notification "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with title "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`], { stdio: 'ignore', detached: true }).unref()
  } else {
    spawn('sh', ['-c', `if command -v notify-send >/dev/null 2>&1; then notify-send '${title.replaceAll("'", "'\\''")}' '${text.replaceAll("'", "'\\''")}'; else printf '\\a'; fi`], { stdio: 'ignore', detached: true }).unref()
  }
}

// ── 路由逻辑 ───────────────────────────────────────────────────────────

/**
 * 解析 ~command 并生成路由指令。
 * @param {string} prompt
 * @returns {{ skillName: string, canonicalName: string } | null}
 */
function parseCommand(prompt) {
  const trimmed = prompt.trim()
  const match = trimmed.match(/^~(\w[\w-]*)/)
  if (!match) return null
  const raw = match[1]
  const canonical = COMMAND_ALIASES[raw] || raw
  return { skillName: raw, canonicalName: `hello-${canonical}` }
}

/**
 * 生成路由上下文消息。告诉模型读取对应技能文件并严格按照其流程执行。
 * @param {string} skillName — 用户输入的原始命令名
 * @param {string} canonicalName — 规范技能名（hello-xxx）
 * @param {string} home
 * @returns {string}
 */
function buildRouteInstruction(skillName, canonicalName, home) {
  const skillPath = join(home, '.codex', 'helloagents', 'skills', canonicalName, 'SKILL.md')
    .replaceAll('\\', '/')
  return [
    `[HelloAGENTS] 检测到命令 ~${skillName}，已自动路由到 ${canonicalName} 技能。`,
    `请立即读取技能文件 \`${skillPath}\`，`,
    `严格按照该技能定义的流程执行，不要自行探索或猜测。`,
    canonicalName === 'hello-help'
      ? '这是 HelloAGENTS 自带的帮助命令，不是宿主 CLI 的内置帮助。仅展示 HelloAGENTS 的用法和当前设置，不调用宿主的帮助工具，不使用子代理，不读取项目文件。'
      : '',
  ].filter(Boolean).join(' ')
}

// ── 子命令处理 ─────────────────────────────────────────────────────────

function cmdRoute() {
  const payload = readStdinJson()
  const prompt = String(payload.prompt || '').trim()

  if (SILENT) { emptySuppress(); return }
  if (!prompt) { emptySuppress(); return }

  const parsed = parseCommand(prompt)
  if (!parsed) { emptySuppress(); return }

  const instruction = buildRouteInstruction(parsed.skillName, parsed.canonicalName, HOME)
  injectContext('UserPromptSubmit', instruction)
}

function cmdInject() {
  // SessionStart: 轻量初始化，暂无需要持久化的状态
  if (SILENT) { emptySuppress(); return }
  emptySuppress()
}

function cmdStop() {
  const payload = readStdinJson()
  const detail = typeof payload.message === 'string'
    ? [...payload.message.replace(/\s+/g, ' ').trim()].slice(0, 150).join('')
    : ''
  notifySound('stop')
  notifyDesktop('stop', detail)
  if (HOST === 'cursor') {
    process.stdout.write('{}')
  } else if (HOST === 'codex') {
    emptySuppress()
  }
}

function cmdCodexNotify() {
  let data = {}
  try {
    const rawArg = args.find((v, i) => i > 0 && !v.startsWith('--'))
    data = rawArg ? JSON.parse(rawArg) : readStdinJson()
  } catch { data = {} }

  const type = String(data.type || '')
  if (type === 'approval-requested') {
    notifySound('notification')
    notifyDesktop('notification', '')
    return
  }
  if (type !== 'agent-turn-complete') return
  // 仅当不存在 Stop hook 时才在此处处理（避免重复通知）
  notifySound('stop')
  notifyDesktop('stop', '')
}

function cmdSound() {
  notifySound(args[1] || 'stop')
}

function cmdDesktop() {
  notifyDesktop(args[1] || 'stop', '')
}

// ── 入口 ───────────────────────────────────────────────────────────────

function main() {
  switch (SUBCOMMAND) {
    case 'route':        cmdRoute(); break
    case 'inject':       cmdInject(); break
    case 'stop':         cmdStop(); break
    case 'codex-notify':
    case 'codex':       cmdCodexNotify(); break
    case 'sound':        cmdSound(); break
    case 'desktop':      cmdDesktop(); break
    default:
      process.stderr.write(`helloagents notify: 未知子命令 "${SUBCOMMAND}"\n`)
      process.exit(1)
  }
}

try {
  main()
} catch (error) {
  process.stderr.write(`helloagents notify: ${error instanceof Error ? error.message : String(error)}\n`)
  if (HOST === 'cursor') emit({})
  process.exitCode = 1
}

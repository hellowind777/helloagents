import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PACKAGE_VERSION, REPO_ROOT } from '../helpers/env.mjs'

/**
 * @param {string[]} args
 * @param {{ input?: string, env?: Record<string, string> }} [options]
 */
function runNode(args, options = {}) {
  return spawnSync(process.execPath, args, {
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    input: options.input,
    env: { ...process.env, ...options.env },
    timeout: 20000,
  })
}

test('help 与 version 命令', () => {
  const help = runNode([join(REPO_ROOT, 'cli.mjs'), 'help'], { env: { HELLOAGENTS_LANG: 'cn' } })
  assert.equal(help.status, 0)
  assert.ok(help.stdout.includes('用法'))
  assert.ok(help.stdout.includes('install'))

  const helpEn = runNode([join(REPO_ROOT, 'cli.mjs'), 'help'], { env: { HELLOAGENTS_LANG: 'en' } })
  assert.ok(helpEn.stdout.includes('Usage'))

  const version = runNode([join(REPO_ROOT, 'cli.mjs'), 'version'])
  assert.equal(version.stdout.trim(), PACKAGE_VERSION)

  const unknown = runNode([join(REPO_ROOT, 'cli.mjs'), 'not-a-command'])
  assert.equal(unknown.status, 1)
})

test('guard：危险命令拒绝，超过 4KB 的输入正常解析', () => {
  const guardPath = join(REPO_ROOT, 'src', 'addons', 'guard.mjs')
  const bigPayload = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'git reset --hard HEAD~1', description: 'x'.repeat(9000) },
  })
  const denied = runNode([guardPath, '--host', 'claude'], { input: bigPayload })
  assert.equal(denied.status, 0)
  const deniedPayload = JSON.parse(denied.stdout)
  assert.equal(deniedPayload.hookSpecificOutput.permissionDecision, 'deny')

  const safePayload = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'npm test', description: 'x'.repeat(9000) },
  })
  const allowed = runNode([guardPath, '--host', 'claude'], { input: safePayload })
  assert.equal(allowed.status, 0)
  assert.equal(allowed.stdout, '')

  const cursorDenied = runNode([guardPath, '--host', 'cursor'], {
    input: JSON.stringify({ command: 'rm -rf /' }),
  })
  assert.equal(JSON.parse(cursorDenied.stdout).permission, 'deny')
})

test('notify：测试通道记录声音与桌面通知，cursor 返回空对象', () => {
  const notifyPath = join(REPO_ROOT, 'src', 'addons', 'notify.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'helloagents-notify-'))
  const logPath = join(dir, 'notify.log')
  try {
    const stop = runNode([notifyPath, 'stop', '--host', 'cursor'], {
      input: '{}',
      env: { HELLOAGENTS_NOTIFY_TEST_LOG: logPath, HELLOAGENTS_HOME: dir },
    })
    assert.equal(stop.status, 0)
    assert.equal(stop.stdout, '{}')

    runNode([notifyPath, 'codex', JSON.stringify({ type: 'agent-turn-complete' })], {
      env: { HELLOAGENTS_NOTIFY_TEST_LOG: logPath, HELLOAGENTS_HOME: dir },
    })

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n').map((line) => JSON.parse(line))
    assert.ok(lines.some((entry) => entry.channel === 'sound' && entry.host === 'cursor'))
    assert.ok(lines.some((entry) => entry.channel === 'desktop' && entry.host === 'codex'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('npm 包内容：关键文件在列，测试与旧产物不在列', () => {
  // Windows 上 npm 是 npm.cmd，Node 不做 PATHEXT 解析，必须走 shell 才能拉起。
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    encoding: 'utf-8',
    cwd: REPO_ROOT,
    timeout: 60000,
    shell: process.platform === 'win32',
  })
  assert.equal(pack.status, 0, pack.stderr ?? String(pack.error ?? 'npm pack 未能启动'))
  const report = JSON.parse(pack.stdout)
  // npm >=11 输出对象 { "pkgname": {...} }，老版本输出数组 [{...}]
  const entry = Array.isArray(report) ? report[0] : Object.values(report)[0]
  const files = new Set(entry.files.map((/** @type {{ path: string }} */ file) => file.path))
  for (const required of [
    'cli.mjs',
    'src/cli/main.mjs',
    'src/addons/guard.mjs',
    'prompts/kernel.md',
    'skills/hello-plan/SKILL.md',
    'skills/hello-ui/SKILL.md',
    'dsh/index.js',
    'dsh/cordis.patch.yml',
    '.claude-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
    'package.json',
  ]) {
    assert.ok(files.has(required), `npm 包缺少 ${required}`)
  }
  for (const excluded of [
    'bootstrap.md',
    'scripts/notify.mjs',
    'tests/smoke/cli.test.mjs',
    'gemini-extension.json',
  ]) {
    assert.ok(!files.has(excluded), `npm 包不应包含 ${excluded}`)
  }
})

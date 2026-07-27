/**
 * 调用宿主自带的命令行工具（目前只有 claude）。
 * Windows 下按 .cmd、.exe 追加候选；不经过 shell，避免转义问题。
 */
import { spawnSync } from 'node:child_process'
import { IS_WINDOWS } from '../kernel/paths.mjs'

/**
 * @typedef {Object} HostCommandResult
 * @property {boolean} ok 命令存在且退出码为 0
 * @property {boolean} missing 命令不存在
 * @property {string} output 标准输出与标准错误合并后的文本
 */

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ timeout?: number }} [options]
 * @returns {HostCommandResult}
 */
export function runHostCommand(command, args, options = {}) {
  const candidates = IS_WINDOWS ? [command, `${command}.cmd`, `${command}.exe`] : [command]
  for (const candidate of candidates) {
    const result = spawnSync(candidate, args, {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: options.timeout ?? 60000,
    })
    if (result.error) {
      const code = /** @type {{ code?: string }} */ (result.error).code
      if (code === 'ENOENT') continue
      return { ok: false, missing: false, output: result.error.message }
    }
    return {
      ok: result.status === 0,
      missing: false,
      output: `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
    }
  }
  return { ok: false, missing: true, output: '' }
}

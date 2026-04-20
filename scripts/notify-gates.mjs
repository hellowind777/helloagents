import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function truncateText(value = '') {
  const text = String(value || '').trim()
  return text.length > 1000 ? `${text.slice(0, 1000)}\n...(truncated)` : text
}

function buildGateErrorReason(source, detail = '') {
  return [
    `[HelloAGENTS Runtime] ${source} 执行失败，已暂停完成通知。`,
    detail ? `原因：${detail}` : '',
    '请修复脚本或重新运行验证后再报告完成。',
  ].filter(Boolean).join('\n')
}

function emitGateError({
  payload,
  host,
  source,
  reason,
  appendReplayEvent,
  output,
}) {
  appendReplayEvent(payload.cwd || process.cwd(), {
    host,
    event: 'runtime_gate_error',
    source,
    reason,
  })
  output({
    decision: 'block',
    reason,
    suppressOutput: true,
  })
  return true
}

export function runGateScript({
  payload,
  host,
  scriptPath,
  args = [],
  source,
  blockEvent,
  timeout,
  appendReplayEvent,
  output,
}) {
  if (!existsSync(scriptPath)) {
    return emitGateError({
      payload,
      host,
      source,
      reason: buildGateErrorReason(source, `脚本不存在：${scriptPath}`),
      appendReplayEvent,
      output,
    })
  }

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout,
  })

  if (result.error) {
    return emitGateError({
      payload,
      host,
      source,
      reason: buildGateErrorReason(source, result.error.message),
      appendReplayEvent,
      output,
    })
  }

  if (result.status !== 0) {
    const detail = truncateText(`${result.stderr || ''}\n${result.stdout || ''}`) || `退出码 ${result.status}`
    return emitGateError({
      payload,
      host,
      source,
      reason: buildGateErrorReason(source, detail),
      appendReplayEvent,
      output,
    })
  }

  const stdout = String(result.stdout || '').trim()
  if (!stdout) {
    return emitGateError({
      payload,
      host,
      source,
      reason: buildGateErrorReason(source, '脚本未返回有效结果'),
      appendReplayEvent,
      output,
    })
  }

  let gateOutput
  try {
    gateOutput = JSON.parse(stdout)
  } catch {
    return emitGateError({
      payload,
      host,
      source,
      reason: buildGateErrorReason(source, `脚本返回了无法解析的 JSON：${truncateText(stdout)}`),
      appendReplayEvent,
      output,
    })
  }

  if (gateOutput.decision === 'block') {
    appendReplayEvent(payload.cwd || process.cwd(), {
      host,
      event: blockEvent,
      source,
      reason: gateOutput.reason || '',
    })
    output(gateOutput)
    return true
  }

  return false
}

export function shouldIgnoreCodexNotifyClient(client) {
  return !!client && client !== 'codex-tui';
}

export function shouldIgnoreFormattedSubagent(lastMsg, outputFormatEnabled) {
  return outputFormatEnabled && !lastMsg.includes('【HelloAGENTS】');
}

export function claimsTaskComplete(lastMsg) {
  return /✅|完成|已修复|done|fixed|completed|finished/i.test(lastMsg);
}

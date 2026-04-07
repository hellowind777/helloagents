export function shouldIgnoreCodexNotifyClient(client) {
  return !!client && client !== 'codex-tui';
}

export function shouldIgnoreFormattedSubagent(lastMsg, outputFormatEnabled) {
  return outputFormatEnabled && !lastMsg.includes('【HelloAGENTS】');
}

export function claimsTaskComplete(lastMsg) {
  if (!lastMsg) return false;
  if (/^✅【HelloAGENTS】- .*(当前任务已完成|任务已完成|已修复|完成交付|done|fixed|completed|finished)/im.test(lastMsg)) {
    return true;
  }
  return /(当前任务已完成|任务已完成|已全部完成|已修复|修复完成|\b(done|fixed|completed|finished)\b)/i.test(lastMsg);
}

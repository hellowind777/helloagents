export function shouldIgnoreCodexNotifyClient(client) {
  return !!client && client !== 'codex-tui';
}

export function shouldIgnoreFormattedSubagent(lastMsg, outputFormatEnabled) {
  return outputFormatEnabled && !lastMsg.includes('【HelloAGENTS】');
}

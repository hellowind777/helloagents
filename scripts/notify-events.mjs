export function shouldIgnoreCodexNotifyClient(client) {
  if (!client) return false;
  const normalized = String(client).trim().toLowerCase().replace(/[_\s]+/g, '-');
  return normalized !== 'codex' && !normalized.startsWith('codex-');
}

export function shouldIgnoreFormattedSubagent(lastMsg, outputFormatEnabled) {
  return outputFormatEnabled && !lastMsg.includes('【HelloAGENTS】');
}

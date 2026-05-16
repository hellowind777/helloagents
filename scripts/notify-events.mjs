export function shouldIgnoreCodexNotifyClient(client) {
  if (!client) return false;
  const normalized = String(client).trim().toLowerCase().replace(/[_\s]+/g, '-');
  return normalized !== 'codex' && !normalized.startsWith('codex-');
}

export function shouldIgnoreFormattedSubagent(lastMsg, outputFormatEnabled) {
  return outputFormatEnabled && !lastMsg.includes('【HelloAGENTS】');
}

export function resolveNotifyHost(argv = []) {
  const args = Array.from(argv, (value) => String(value || ''));
  const command = args[2] || args[0] || '';
  if (args.includes('--gemini')) return 'gemini';
  if (args.includes('--codex') || command === 'codex-notify') return 'codex';
  return 'claude';
}

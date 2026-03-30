#!/usr/bin/env node
/**
 * HelloAGENTS Guard — Dangerous command blocker + L2 semantic security scan
 * Runs on PreToolUse hook for Bash/shell commands.
 * Runs on PostToolUse hook for Write/Edit (L2 scan).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_FILE = join(homedir(), '.helloagents', 'helloagents.json');

// Hook event name: read from env or infer from CLI mode + --gemini flag.
// Claude: PreToolUse/PostToolUse, Gemini: BeforeTool/AfterModel.
const IS_GEMINI = process.argv.includes('--gemini');
const IS_POST_WRITE = process.argv.includes('post-write');
const HOOK_EVENT = process.env.HELLOAGENTS_HOOK_EVENT
  || (IS_POST_WRITE ? (IS_GEMINI ? 'AfterModel' : 'PostToolUse') : (IS_GEMINI ? 'BeforeTool' : 'PreToolUse'));

function readSettings() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch {}
  return {};
}

const DANGEROUS_PATTERNS = [
  // Destructive file operations (including sudo prefix and long options)
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~|\*)/, reason: 'Recursive delete of critical path' },
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?(\/|~|\*)/, reason: 'Recursive delete of critical path' },
  { pattern: /(sudo\s+)?rm\s+--recursive/, reason: 'Recursive delete (long option)' },
  { pattern: /(sudo\s+)?rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\.\.?(\s|$)/, reason: 'Recursive delete of current/parent directory' },
  // Force push
  { pattern: /git\s+push\s+(-f|--force)/, reason: 'Force push (specify branch explicitly)' },
  // Hard reset
  { pattern: /git\s+reset\s+--hard/, reason: 'Hard reset (destructive operation)' },
  // Database destruction
  { pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i, reason: 'Database destruction command' },
  { pattern: /TRUNCATE\s+TABLE/i, reason: 'Table truncation' },
  // Dangerous system commands
  { pattern: /chmod\s+777/, reason: 'World-writable permissions' },
  { pattern: /mkfs\b/, reason: 'Filesystem format command' },
  { pattern: /dd\s+.*of=\/dev\//, reason: 'Direct device write' },
  // Redis flush
  { pattern: /FLUSHALL|FLUSHDB/i, reason: 'Redis data flush' },
];

// ── L2 Semantic Security Patterns (advisory, non-blocking) ──────────────────

const SECRET_PATTERNS = [
  { pattern: /AKIA[0-9A-Z]{16}/, reason: 'AWS Access Key ID detected' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, reason: 'GitHub Personal Access Token detected' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, reason: 'GitHub Fine-grained PAT detected' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/, reason: 'API secret key pattern detected (sk-)' },
  { pattern: /key-[a-zA-Z0-9]{20,}/, reason: 'API key pattern detected (key-)' },
  { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, reason: 'Private key detected' },
  { pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i, reason: 'Hardcoded password detected' },
  { pattern: /secret\s*[:=]\s*["'][^"']{4,}["']/i, reason: 'Hardcoded secret detected' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, reason: 'Google API Key detected' },
  { pattern: /xox[bpras]-[0-9a-zA-Z\-]+/, reason: 'Slack Token detected' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]+/, reason: 'JWT token detected' },
  { pattern: /(postgres|mysql|mongodb(\+srv)?):\/\/[^:]+:[^@]+@/i, reason: 'Database connection string with credentials detected' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, reason: 'Stripe Secret Key detected' },
  { pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/, reason: 'Anthropic API Key detected' },
];

function scanForSecrets(content) {
  const warnings = [];
  for (const { pattern, reason } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      warnings.push(reason);
    }
  }
  return warnings;
}

// ── Post-Write L2 Scan ──────────────────────────────────────────────────────
// Triggered by PostToolUse matcher: Write|Edit|NotebookEdit (see hooks.json).
// If Claude Code adds new file-writing tools, update the matcher accordingly.

/** Check for unrequested file creation (Write tool only). */
function scanUnrequestedFiles(filePath, toolName) {
  if (!filePath || toolName?.toLowerCase() !== 'write') return [];
  const basename = filePath.split(/[/\\]/).pop() || '';
  const UNREQUESTED_PATTERNS = [
    { pattern: /^(SUMMARY|NOTES|TODO|SCRATCH|TEMP)\.(md|txt)$/i, reason: `Unrequested file creation: ${basename}` },
    { pattern: /^README.*\.md$/i, test: () => {
      const depth = filePath.replace(/\\/g, '/').split('/').length;
      return depth > 4;
    }, reason: `Suspicious README creation in nested path: ${basename}` },
  ];
  const warnings = [];
  for (const { pattern, test, reason } of UNREQUESTED_PATTERNS) {
    if (pattern.test(basename) && (!test || test())) warnings.push(reason);
  }
  return warnings;
}

/** Check for dangerous npm scripts and unsafe dependency patterns. */
function scanDangerousPackages(content, filePath) {
  const warnings = [];
  if (filePath.endsWith('package.json')) {
    const dangerousScripts = /("(preinstall|postinstall|preuninstall)")\s*:\s*"[^"]*\b(curl|wget|bash|sh|eval|exec)\b/i;
    if (dangerousScripts.test(content)) {
      warnings.push('Potentially dangerous lifecycle script in package.json (preinstall/postinstall with curl/wget/bash/eval)');
    }
  }
  const unsafeInstall = /npm install\s+[^-].*--ignore-scripts\s*=\s*false|pip install\s+--trusted-host|pip install\s+http:/i;
  if (unsafeInstall.test(content)) {
    warnings.push('Unsafe dependency installation pattern detected');
  }
  return warnings;
}

/** Check if .env file is covered by .gitignore. */
function scanEnvCoverage(filePath) {
  if (!filePath.endsWith('.env') && !filePath.includes('.env.')) return [];
  let dir = dirname(filePath);
  for (let i = 0; i < 10; i++) {
    try {
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
      return gitignore.includes('.env') ? [] : ['.env file written but .gitignore does not contain .env pattern'];
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return ['.env file written but no .gitignore found'];
}

function postWriteScan(data) {
  const settings = readSettings();
  if (settings.guard_enabled === false) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  const content = data.tool_input?.content || data.tool_input?.new_string || '';
  const filePath = data.tool_input?.file_path || '';

  if (!content && !filePath) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  const warnings = [
    ...scanUnrequestedFiles(filePath, data.tool_name),
    ...(content ? [...scanForSecrets(content), ...scanDangerousPackages(content, filePath)] : []),
    ...scanEnvCoverage(filePath),
  ];

  // L2 is advisory (warn, not block): uses additionalContext to surface warnings
  // to the AI, matching bootstrap.md's "警告用户" directive for L2 patterns.
  if (warnings.length > 0) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENT,
        additionalContext: `⚠️ [HelloAGENTS L2 安全扫描] 检测到潜在问题:\n${warnings.map(w => `  - ${w}`).join('\n')}\n请检查以上问题。`,
      },
      suppressOutput: true,
    }));
    return;
  }

  process.stdout.write(JSON.stringify({ suppressOutput: true }));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // Check if running in post-write mode (PostToolUse)
  const mode = process.argv[2] || '';
  if (mode === 'post-write') {
    let data = {};
    try {
      const input = readFileSync(0, 'utf-8');
      data = JSON.parse(input);
    } catch {}
    postWriteScan(data);
    return;
  }

  const settings = readSettings();
  if (settings.guard_enabled === false) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  let data = {};
  try {
    const input = readFileSync(0, 'utf-8');
    data = JSON.parse(input);
  } catch {}

  // Only check Bash/shell tool calls
  const toolName = (data.tool_name || '').toLowerCase();
  if (!['bash', 'shell', 'terminal', 'command'].some(t => toolName.includes(t))) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  const command = data.tool_input?.command || data.tool_input?.input || '';
  if (!command) {
    process.stdout.write(JSON.stringify({ suppressOutput: true }));
    return;
  }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      // PreToolUse requires hookSpecificOutput.permissionDecision (not top-level decision)
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: HOOK_EVENT,
          permissionDecision: 'deny',
          permissionDecisionReason: `[HelloAGENTS Guard] Blocked: ${reason}\nCommand: ${command.slice(0, 200)}`,
        },
      }));
      return;
    }
  }

  process.stdout.write(JSON.stringify({ suppressOutput: true }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
});

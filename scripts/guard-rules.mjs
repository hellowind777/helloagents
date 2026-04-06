import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DANGEROUS_PATTERNS = [
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~|\*)/, reason: 'Recursive delete of critical path' },
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?(\/|~|\*)/, reason: 'Recursive delete of critical path' },
  { pattern: /(sudo\s+)?rm\s+--recursive/, reason: 'Recursive delete (long option)' },
  { pattern: /(sudo\s+)?rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\.\.?(\s|$)/, reason: 'Recursive delete of current/parent directory' },
  { pattern: /git\s+push\s+(-f|--force)/, reason: 'Force push (specify branch explicitly)' },
  { pattern: /git\s+reset\s+--hard/, reason: 'Hard reset (destructive operation)' },
  { pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i, reason: 'Database destruction command' },
  { pattern: /TRUNCATE\s+TABLE/i, reason: 'Table truncation' },
  { pattern: /chmod\s+777/, reason: 'World-writable permissions' },
  { pattern: /mkfs\b/, reason: 'Filesystem format command' },
  { pattern: /dd\s+.*of=\/dev\//, reason: 'Direct device write' },
  { pattern: /FLUSHALL|FLUSHDB/i, reason: 'Redis data flush' },
]

export const HIGH_RISK_COMMAND_PATTERNS = [
  { pattern: /\bnpm\s+publish\b/i, reason: 'Package publish command', gate: 'post-verify' },
  { pattern: /\bgh\s+release\s+create\b/i, reason: 'Release publication command', gate: 'post-verify' },
  { pattern: /\bterraform\s+(apply|destroy)\b/i, reason: 'Infrastructure apply/destroy command', gate: 'post-verify' },
  { pattern: /\b(kubectl|helm)\s+(apply|delete|upgrade|rollback|set|rollout)\b/i, reason: 'Cluster deployment command', gate: 'post-verify' },
  { pattern: /\b(prisma|drizzle-kit|sequelize-cli|typeorm)\b.*\b(migrate|migration)\b/i, reason: 'Database migration command', gate: 'plan-first' },
  { pattern: /\b(vercel|wrangler|netlify|flyctl|fly)\b.*\b(deploy|publish)\b/i, reason: 'Deployment command', gate: 'post-verify' },
]

export const IDEA_SIDE_EFFECT_COMMAND_PATTERNS = [
  /\b(git\s+(add|commit|merge|rebase|cherry-pick|push|pull|stash|restore|checkout|switch))\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|remove|uninstall|update|up|upgrade|publish|version)\b/i,
  /\b(mkdir|md|touch|cp|copy|mv|move|ren|rename|del|erase|rm|rmdir)\b/i,
  /\b(new-item|copy-item|move-item|remove-item|rename-item|set-content|add-content|out-file)\b/i,
  /(^|[^\w])>>?($|[^\w])/,
]

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
]

export function scanForSecrets(content) {
  const warnings = []
  for (const { pattern, reason } of SECRET_PATTERNS) {
    if (pattern.test(content)) warnings.push(reason)
  }
  return warnings
}

export function scanHighRiskCommands(command) {
  const warnings = []
  for (const entry of HIGH_RISK_COMMAND_PATTERNS) {
    if (entry.pattern.test(command)) {
      warnings.push({ ...entry })
    }
  }
  return warnings
}

export function scanUnrequestedFiles(filePath, toolName) {
  if (!filePath || toolName?.toLowerCase() !== 'write') return []
  const basename = filePath.split(/[/\\]/).pop() || ''
  const warnings = []

  const patterns = [
    { pattern: /^(SUMMARY|NOTES|TODO|SCRATCH|TEMP)\.(md|txt)$/i, reason: `Unrequested file creation: ${basename}` },
    {
      pattern: /^README.*\.md$/i,
      matches: () => filePath.replace(/\\/g, '/').split('/').length > 4,
      reason: `Suspicious README creation in nested path: ${basename}`,
    },
  ]

  for (const entry of patterns) {
    if (entry.pattern.test(basename) && (!entry.matches || entry.matches())) {
      warnings.push(entry.reason)
    }
  }
  return warnings
}

export function scanDangerousPackages(content, filePath) {
  const warnings = []
  if (filePath.endsWith('package.json')) {
    const dangerousScripts = /("(preinstall|postinstall|preuninstall)")\s*:\s*"[^"]*\b(curl|wget|bash|sh|eval|exec)\b/i
    if (dangerousScripts.test(content)) {
      warnings.push('Potentially dangerous lifecycle script in package.json (preinstall/postinstall with curl/wget/bash/eval)')
    }
  }
  const unsafeInstall = /npm install\s+[^-].*--ignore-scripts\s*=\s*false|pip install\s+--trusted-host|pip install\s+http:/i
  if (unsafeInstall.test(content)) {
    warnings.push('Unsafe dependency installation pattern detected')
  }
  return warnings
}

export function scanEnvCoverage(filePath) {
  if (!filePath.endsWith('.env') && !filePath.includes('.env.')) return []
  let dir = dirname(filePath)
  for (let i = 0; i < 10; i += 1) {
    try {
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8')
      return gitignore.includes('.env') ? [] : ['.env file written but .gitignore does not contain .env pattern']
    } catch {
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return ['.env file written but no .gitignore found']
}

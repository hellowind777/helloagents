import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DANGEROUS_PATTERNS = [
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~|\*)/, reason: '递归删除关键路径' },
  { pattern: /(sudo\s+)?rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?(\/|~|\*)/, reason: '递归删除关键路径' },
  { pattern: /(sudo\s+)?rm\s+--recursive/, reason: '递归删除命令' },
  { pattern: /(sudo\s+)?rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\.\.?(\s|$)/, reason: '递归删除当前目录或父目录' },
  { pattern: /\bcmd(?:\.exe)?\s*\/c\b/i, reason: '嵌套 cmd 会绕过 PowerShell 安全规则' },
  { pattern: /\bStart-Process\s+cmd(?:\.exe)?\b/i, reason: '嵌套 cmd 会绕过 PowerShell 安全规则' },
  { pattern: /git\s+push\s+(-f|--force)/, reason: '强制推送风险高，必须明确分支与授权' },
  { pattern: /git\s+reset\s+--hard/, reason: '硬重置会丢弃本地变更' },
  { pattern: /DROP\s+(DATABASE|TABLE|SCHEMA)/i, reason: '数据库破坏性命令' },
  { pattern: /\bTRUNCATE(?:\s+TABLE)?\b/i, reason: '表数据清空命令' },
  { pattern: /chmod\s+777/, reason: '全局可写权限风险高' },
  { pattern: /mkfs\b/, reason: '文件系统格式化命令' },
  { pattern: /dd\s+.*of=\/dev\//, reason: '直接写入设备' },
  { pattern: /FLUSHALL|FLUSHDB/i, reason: 'Redis 数据清空命令' },
]

export const HIGH_RISK_COMMAND_PATTERNS = [
  { pattern: /\bnpm\s+publish\b/i, reason: '包发布命令', gate: 'post-verify' },
  { pattern: /\bgh\s+release\s+create\b/i, reason: '发布 release 命令', gate: 'post-verify' },
  { pattern: /\bterraform\s+(apply|destroy)\b/i, reason: '基础设施变更命令', gate: 'post-verify' },
  { pattern: /\b(kubectl|helm)\s+(apply|delete|upgrade|rollback|set|rollout)\b/i, reason: '集群变更命令', gate: 'post-verify' },
  { pattern: /\b(prisma|drizzle-kit|sequelize-cli|typeorm)\b.*\b(migrate|migration)\b/i, reason: '数据库迁移命令', gate: 'plan-first' },
  { pattern: /\b(vercel|wrangler|netlify|flyctl|fly)\b.*\b(deploy|publish)\b/i, reason: '部署命令', gate: 'post-verify' },
]

export const IDEA_SIDE_EFFECT_COMMAND_PATTERNS = [
  /\b(git\s+(add|commit|merge|rebase|cherry-pick|push|pull|stash|restore|checkout|switch))\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|remove|uninstall|update|up|upgrade|publish|version)\b/i,
  /\b(mkdir|md|touch|cp|copy|mv|move|ren|rename|del|erase|rm|rmdir)\b/i,
  /\b(new-item|copy-item|move-item|remove-item|rename-item|set-content|add-content|out-file)\b/i,
  /(^|[^\w])>>?($|[^\w])/,
]

const SECRET_PATTERNS = [
  { pattern: /AKIA[0-9A-Z]{16}/, reason: '检测到 AWS Access Key ID' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, reason: '检测到 GitHub Personal Access Token' },
  { pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/, reason: '检测到 GitHub Fine-grained PAT' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/, reason: '检测到 API secret key（sk-）' },
  { pattern: /key-[a-zA-Z0-9]{20,}/, reason: '检测到 API key（key-）' },
  { pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, reason: '检测到私钥' },
  { pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i, reason: '检测到硬编码密码' },
  { pattern: /secret\s*[:=]\s*["'][^"']{4,}["']/i, reason: '检测到硬编码密钥' },
  { pattern: /AIza[0-9A-Za-z\-_]{35}/, reason: '检测到 Google API Key' },
  { pattern: /xox[bpras]-[0-9a-zA-Z\-]+/, reason: '检测到 Slack Token' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]+/, reason: '检测到 JWT token' },
  { pattern: /(postgres|mysql|mongodb(\+srv)?):\/\/[^:]+:[^@]+@/i, reason: '检测到包含凭据的数据库连接串' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, reason: '检测到 Stripe Secret Key' },
  { pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/, reason: '检测到 Anthropic API Key' },
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

export function scanShellSafetyWarnings(command = '') {
  const warnings = []
  const normalized = String(command || '')

  if (/\bpowershell(?:\.exe)?\b/i.test(normalized) && /\s-Command\b/i.test(normalized)) {
    const inlineScript = normalized.split(/\s-Command\b/i).slice(1).join(' ').trim()
    const logicalLines = inlineScript
      .split(/[;\r\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (logicalLines.length > 3) {
      warnings.push('PowerShell 内联脚本超过 3 个逻辑行，请改用临时 .ps1 文件')
    }
  }

  const fileOps = normalized.match(/\b(remove-item|move-item|copy-item|new-item|set-content|add-content|out-file|mkdir|md|touch|cp|copy|mv|move|ren|rename|del|erase|rm|rmdir)\b/ig) || []
  if (fileOps.length > 1 && /[;\r\n]/.test(normalized)) {
    warnings.push('单条 shell 命令串联了多个文件操作，请拆成独立命令')
  }

  return warnings
}

export function scanUnrequestedFiles(filePath, toolName) {
  if (!filePath || toolName?.toLowerCase() !== 'write') return []
  const basename = filePath.split(/[/\\]/).pop() || ''
  const warnings = []

  const patterns = [
    { pattern: /^(SUMMARY|NOTES|TODO|SCRATCH|TEMP)\.(md|txt)$/i, reason: `检测到未请求的文件创建：${basename}` },
    {
      pattern: /^README.*\.md$/i,
      matches: () => filePath.replace(/\\/g, '/').split('/').length > 4,
      reason: `检测到嵌套路径中的可疑 README 创建：${basename}`,
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
      warnings.push('package.json 中存在潜在危险的生命周期脚本（preinstall/postinstall 调用 curl、wget、bash 或 eval）')
    }
  }
  const unsafeInstall = /npm install\s+[^-].*--ignore-scripts\s*=\s*false|pip install\s+--trusted-host|pip install\s+http:/i
  if (unsafeInstall.test(content)) {
    warnings.push('检测到不安全的依赖安装写法')
  }
  return warnings
}

export function scanEnvCoverage(filePath) {
  if (!filePath.endsWith('.env') && !filePath.includes('.env.')) return []
  let dir = dirname(filePath)
  for (let i = 0; i < 10; i += 1) {
    try {
      const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8')
      return gitignore.includes('.env') ? [] : ['写入了 .env 文件，但 .gitignore 未包含 .env 规则']
    } catch {
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return ['写入了 .env 文件，但未找到 .gitignore']
}

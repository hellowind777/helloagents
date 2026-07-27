/**
 * 危险命令规则。guard 附加组件与内核提示词共用这一份清单，
 * 契约测试保证两处不会失去同步。
 *
 * 设计原则：只在命令语境内判断；先剥离引号包裹的提交信息等文本参数，
 * 再做匹配，避免“提交信息里出现敏感词”这类误报。必要的固定清单予以保留，
 * 匹配逻辑按语义（命令结构、参数、目标路径）而不是按孤立关键词。
 */

/**
 * @typedef {Object} RuleHit
 * @property {string} id
 * @property {{ cn: string, en: string }} reason
 */

/**
 * 剥离命令中作为文本参数的引号内容（例如 git commit -m "……"），
 * 这些内容不参与危险判断。
 * @param {string} command
 */
export function stripTextArguments(command) {
  return String(command || '').replace(
    /(\s(?:-m|-am|--message)(?:\s+|=))("[^"]*"|'[^']*')/g,
    '$1""',
  )
}

/**
 * 解析出 rm 命令的参数并判断是否属于大范围递归删除。
 * @param {string} command
 * @returns {boolean}
 */
function isBroadRecursiveRemove(command) {
  const segments = String(command).split(/[;&|]+/)
  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/)
    if (tokens[0] !== 'rm' && !(tokens[0] === 'sudo' && tokens[1] === 'rm')) continue
    const args = tokens.slice(tokens[0] === 'sudo' ? 2 : 1)
    const flags = args.filter((token) => token.startsWith('-')).join(' ')
    const recursive = /r/i.test(flags.replace(/--\S+/g, (m) => (m === '--recursive' ? 'r' : '')))
      || flags.includes('--recursive')
    const force = flags.includes('f') || flags.includes('--force')
    if (!recursive || !force) continue
    const targets = args.filter((token) => !token.startsWith('-')).map((token) => token.replace(/["']/g, ''))
    const broad = targets.some(
      (target) =>
        target === '/' ||
        target === '~' ||
        target === '~/' ||
        target === '.' ||
        target === './' ||
        target === '..' ||
        target === '*' ||
        target === './*' ||
        /^[A-Za-z]:[\\/]?$/.test(target),
    )
    if (broad || targets.length === 0) return true
  }
  return false
}

/**
 * git push 强推保护分支的判断（--force-with-lease 不拦截）。
 * @param {string} command
 */
function isForcePushToProtected(command) {
  const value = String(command)
  if (!/\bgit\s+push\b/.test(value)) return false
  const hasForce = /(?:^|\s)(?:--force(?!-with-lease)|-f)(?:\s|$)/.test(value)
  if (!hasForce) return false
  return /\b(?:main|master)\b/.test(value)
}

/** 阻断规则：命中即拒绝执行。 */
export const BLOCK_RULES = [
  {
    id: 'rm-recursive-broad',
    test: isBroadRecursiveRemove,
    reason: {
      cn: '大范围递归删除（rm -rf 指向根目录、主目录、当前目录或通配全量）',
      en: 'Broad recursive delete (rm -rf targeting root, home, current directory, or a wildcard)',
    },
  },
  {
    id: 'git-push-force-protected',
    test: isForcePushToProtected,
    reason: {
      cn: '强制推送保护分支（git push --force 到 main/master）',
      en: 'Force push to a protected branch (git push --force to main/master)',
    },
  },
  {
    id: 'git-reset-hard',
    test: (/** @type {string} */ command) => /\bgit\s+reset\s+--hard\b/.test(command),
    reason: {
      cn: 'git reset --hard 会丢弃未提交的修改',
      en: 'git reset --hard discards uncommitted changes',
    },
  },
  {
    id: 'sql-drop-or-truncate',
    test: (/** @type {string} */ command) =>
      /\b(?:drop\s+(?:database|table)|truncate\s+table)\s+[`"'[]?\w/i.test(command),
    reason: {
      cn: '破坏性数据库语句（DROP DATABASE / DROP TABLE / TRUNCATE TABLE）',
      en: 'Destructive database statement (DROP DATABASE / DROP TABLE / TRUNCATE TABLE)',
    },
  },
  {
    id: 'chmod-777',
    test: (/** @type {string} */ command) => /\bchmod\s+(?:-R\s+)?0?777\b/.test(command),
    reason: {
      cn: 'chmod 777 会放开全部权限',
      en: 'chmod 777 opens full permissions to everyone',
    },
  },
  {
    id: 'mkfs',
    test: (/** @type {string} */ command) => /\bmkfs(?:\.\w+)?\b/.test(command),
    reason: {
      cn: '格式化文件系统（mkfs）',
      en: 'Filesystem format (mkfs)',
    },
  },
  {
    id: 'dd-to-device',
    test: (/** @type {string} */ command) => /\bdd\b[^\n]*\bof=\/dev\//.test(command),
    reason: {
      cn: 'dd 直接写入设备（of=/dev/…）',
      en: 'dd writing directly to a device (of=/dev/…)',
    },
  },
  {
    id: 'redis-flush',
    test: (/** @type {string} */ command) => /\b(?:FLUSHALL|FLUSHDB)\b/i.test(command),
    reason: {
      cn: '清空 Redis 数据（FLUSHALL / FLUSHDB）',
      en: 'Flush Redis data (FLUSHALL / FLUSHDB)',
    },
  },
]

/** 提醒规则：不拦截，只提示核对。 */
export const WARN_RULES = [
  {
    id: 'rm-recursive',
    test: (/** @type {string} */ command) =>
      /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*|--recursive)\b/.test(command) && !isBroadRecursiveRemove(command),
    reason: {
      cn: '递归删除，请先确认目标路径正确',
      en: 'Recursive delete; confirm the target path first',
    },
  },
  {
    id: 'git-clean-force',
    test: (/** @type {string} */ command) => /\bgit\s+clean\s+-[a-zA-Z]*f/.test(command),
    reason: {
      cn: 'git clean -f 会删除未跟踪文件',
      en: 'git clean -f deletes untracked files',
    },
  },
  {
    id: 'pipe-to-shell',
    test: (/** @type {string} */ command) => /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sh|bash|zsh)\b/.test(command),
    reason: {
      cn: '下载内容直接交给 shell 执行，请确认来源可信',
      en: 'Piping downloaded content into a shell; verify the source is trusted',
    },
  },
  {
    id: 'force-push-other',
    test: (/** @type {string} */ command) =>
      /\bgit\s+push\b/.test(command) &&
      /(?:^|\s)(?:--force(?!-with-lease)|-f)(?:\s|$)/.test(command) &&
      !isForcePushToProtected(command),
    reason: {
      cn: '强制推送非保护分支，请确认远端没有他人的新提交',
      en: 'Force pushing a non-protected branch; make sure no one else pushed new commits',
    },
  },
]

/**
 * 评估一条命令。
 * @param {string} command
 * @returns {{ block: RuleHit | null, warnings: RuleHit[] }}
 */
export function evaluateCommand(command) {
  const cleaned = stripTextArguments(command)
  for (const rule of BLOCK_RULES) {
    if (rule.test(cleaned)) return { block: { id: rule.id, reason: rule.reason }, warnings: [] }
  }
  const warnings = WARN_RULES.filter((rule) => rule.test(cleaned)).map((rule) => ({
    id: rule.id,
    reason: rule.reason,
  }))
  return { block: null, warnings }
}

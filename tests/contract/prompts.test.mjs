import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BLOCK_RULES } from '../../src/kernel/security-rules.mjs'
import { MESSAGES } from '../../src/kernel/messages.mjs'
import { REPO_ROOT } from '../helpers/env.mjs'

const KERNEL_PATH = join(REPO_ROOT, 'prompts', 'kernel.md')
const kernel = readFileSync(KERNEL_PATH, 'utf-8')

/** ~命令的短写；技能正式名是 hello- 前缀加短写。 */
const COMMAND_ALIASES = ['plan', 'build', 'auto', 'prd', 'qa', 'eva', 'ask', 'init', 'commit', 'clean', 'help']
const COMMAND_SKILLS = COMMAND_ALIASES.map((alias) => `hello-${alias}`)
const QUALITY_SKILLS = [
  'hello-ui',
  'hello-test',
  'hello-security',
  'hello-debug',
  'hello-arch',
  'hello-api',
  'hello-data',
  'hello-perf',
  'hello-errors',
  'hello-write',
  'hello-reflect',
  'hello-subagent',
]

// 个别技能允许更大的正文预算（hello-eva 是收编的完整审计技能，附 references 参考文件）。
const LINE_BUDGETS = { 'hello-eva': 200 }

/**
 * 取出 frontmatter 正文。容忍 CRLF：仓库以 .gitattributes 固定 LF，
 * 但工作区可能因历史设置或打补丁产生 CRLF，断言应指向内容问题而不是换行符。
 * @param {string} text
 * @returns {string | null}
 */
function frontmatterOf(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  return match ? (match[1] ?? '') : null
}

test('内核不超过 150 行', () => {
  const lines = kernel.trimEnd().split('\n').length
  assert.ok(lines <= 150, `内核 ${lines} 行，超出 150 行预算`)
})

test('内核的阻断清单与 guard 规则同步', () => {
  const cues = {
    'rm-recursive-broad': 'rm -rf',
    'git-push-force-protected': 'git push --force',
    'git-reset-hard': 'git reset --hard',
    'sql-drop-or-truncate': 'DROP DATABASE',
    'chmod-777': 'chmod 777',
    mkfs: 'mkfs',
    'dd-to-device': 'dd of=/dev/',
    'redis-flush': 'FLUSHALL',
  }
  for (const rule of BLOCK_RULES) {
    const cue = cues[/** @type {keyof typeof cues} */ (rule.id)]
    assert.ok(cue, `阻断规则 ${rule.id} 缺少内核对照词，请同步更新本测试与内核`)
    assert.ok(kernel.includes(cue), `内核安全底线缺少规则 ${rule.id} 的描述（${cue}）`)
  }
})

test('内核命令表覆盖全部命令技能', () => {
  for (const alias of COMMAND_ALIASES) {
    assert.ok(kernel.includes(`~${alias}`), `内核命令表缺少 ~${alias}`)
  }
  for (const name of [...COMMAND_SKILLS, ...QUALITY_SKILLS]) {
    assert.ok(kernel.includes(name), `内核缺少技能正式名 ${name}`)
  }
})

test('命令技能的描述同时认短写与全称', () => {
  const skillsDir = join(REPO_ROOT, 'skills')
  for (const alias of COMMAND_ALIASES) {
    const text = readFileSync(join(skillsDir, `hello-${alias}`, 'SKILL.md'), 'utf-8')
    const description = frontmatterOf(text) ?? ''
    assert.ok(description.includes(`~${alias} 或 ~hello-${alias}`), `hello-${alias} 的描述缺少两种触发写法`)
  }
})

test('技能目录完整，frontmatter 规范，禁用内容不出现', () => {
  const skillsDir = join(REPO_ROOT, 'skills')
  const found = readdirSync(skillsDir).filter((name) => statSync(join(skillsDir, name)).isDirectory())
  assert.deepEqual(found.sort(), [...COMMAND_SKILLS, ...QUALITY_SKILLS].sort())

  for (const name of found) {
    const filePath = join(skillsDir, name, 'SKILL.md')
    const text = readFileSync(filePath, 'utf-8')
    const body = frontmatterOf(text)
    assert.ok(body !== null, `${name}/SKILL.md 缺少 frontmatter`)
    assert.equal(body?.match(/^name: (.+)$/m)?.[1]?.trim(), name, `${name} 的 name 字段与目录不一致`)
    const descIndex = (body ?? '').indexOf('description:')
    assert.ok(descIndex >= 0, `${name} 缺少 description`)
    assert.ok(
      (body ?? '').slice(descIndex + 'description:'.length).trim().length > 10,
      `${name} 的 description 过短`,
    )
    const lineCount = text.trimEnd().split('\n').length
    const budget = LINE_BUDGETS[/** @type {keyof typeof LINE_BUDGETS} */ (name)] ?? 90
    assert.ok(lineCount <= budget, `${name}/SKILL.md ${lineCount} 行，超出预算 ${budget}`)
    for (const banned of ['【HelloAGENTS】', 'turn-state', 'closeout', '[√]', '[-] ']) {
      assert.ok(!text.includes(banned), `${name}/SKILL.md 含禁用内容：${banned}`)
    }
  }
})

test('提示词文件中文双引号成对出现', () => {
  const targets = [KERNEL_PATH]
  const skillsDir = join(REPO_ROOT, 'skills')
  for (const name of readdirSync(skillsDir)) {
    const filePath = join(skillsDir, name, 'SKILL.md')
    if (statSync(join(skillsDir, name)).isDirectory()) targets.push(filePath)
  }
  for (const filePath of targets) {
    const text = readFileSync(filePath, 'utf-8')
    const open = (text.match(/“/g) ?? []).length
    const close = (text.match(/”/g) ?? []).length
    assert.equal(open, close, `${filePath} 的中文双引号不成对（“ ${open} 个，” ${close} 个）`)
    const asciiQuoteInChinese = text
      .split('\n')
      .filter((line) => !line.includes('`'))
      .filter((line) => /[一-鿿]"|"[一-鿿]/.test(line))
    assert.deepEqual(
      asciiQuoteInChinese,
      [],
      `${filePath} 在中文语境中使用了半角双引号，应改为全角“”`,
    )
  }
})

test('源码引用的文案键在目录中全部存在', () => {
  /** @type {string[]} */
  const missing = []
  const walk = (/** @type {string} */ dir) => {
    for (const name of readdirSync(dir)) {
      const filePath = join(dir, name)
      if (statSync(filePath).isDirectory()) {
        walk(filePath)
        continue
      }
      if (!name.endsWith('.mjs')) continue
      const source = readFileSync(filePath, 'utf-8')
      for (const match of source.matchAll(/\bt\('([^']+)'/g)) {
        const key = match[1] ?? ''
        if (!(key in MESSAGES)) missing.push(`${filePath}: ${key}`)
      }
      for (const match of source.matchAll(/ctx\.t\('([^']+)'/g)) {
        const key = match[1] ?? ''
        if (!(key in MESSAGES)) missing.push(`${filePath}: ${key}`)
      }
    }
  }
  walk(join(REPO_ROOT, 'src'))
  assert.deepEqual(missing, [])
})

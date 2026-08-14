/**
 * helloagents 的 DeepSeek Harness（dsh）插件入口。
 *
 * 自包含：内核注册为系统提示词段落（persona 层），23 个技能注册为运行时技能，
 * 由 dsh 原生的 skill 目录与 skill 工具暴露给模型。零依赖：仅用 Node 内置模块，
 * 插件模块本身不 import 任何第三方包；inject 声明让加载器保证服务就绪。
 *
 * 两种布局共用同一文件：npm 包（helloagents/dsh/index.js）与本地快照
 * （<dshHome>/plugins/helloagents/dsh/index.js），skills 与 prompts 均在上一级。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'helloagents'
export const inject = ['systemPrompt', 'skills']

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/** 解析 SKILL.md 的 frontmatter（仅 name/description 两个字段，支持 >- 折叠块）。 */
function parseSkill(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) return null
  const lines = (match[1] ?? '').split(/\r?\n/)
  /** @type {Record<string, string>} */
  const fields = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const kv = line.match(/^([a-z-]+):\s*(.*)$/)
    if (!kv) continue
    const key = String(kv[1])
    const value = String(kv[2])
    const folded = value.match(/^[>|]-?$/)
    if (!folded) {
      fields[key] = value.trim()
      continue
    }
    // YAML 块标量：收集缩进行；>- 折叠为空格连接，| 保留换行。
    const chunks = []
    while (index + 1 < lines.length && /^\s/.test(lines[index + 1] ?? '')) {
      index += 1
      chunks.push((lines[index] ?? '').trim())
    }
    fields[key] = folded[0] === '>' ? chunks.join(' ') : chunks.join('\n')
  }
  return { name: fields.name, description: fields.description, content: text.slice(match[0].length).trim() }
}

/** 读取并解析技能目录中全部 SKILL.md。 */
function loadSkills() {
  const skillsDir = join(ROOT, 'skills')
  /** @type {Array<{ name: string, description: string, content: string }>} */
  const skills = []
  for (const entry of readdirSync(skillsDir)) {
    const file = join(skillsDir, entry, 'SKILL.md')
    let stat = null
    try {
      stat = statSync(file)
    } catch {
      continue
    }
    if (!stat.isFile()) continue
    const parsed = parseSkill(readFileSync(file, 'utf8'))
    if (parsed?.name && parsed?.description) skills.push(parsed)
  }
  return skills
}

/**
 * @param {any} ctx dsh 的 cordis 上下文（运行时注入，零依赖不引入类型包）
 */
export function apply(ctx) {
  const kernel = readFileSync(join(ROOT, 'prompts', 'kernel.md'), 'utf8').trim()
  ctx.systemPrompt.section({ name: 'helloagents-kernel', order: 0, text: kernel })

  const skills = loadSkills()
  for (const skill of skills) {
    ctx.skills.register({ name: skill.name, description: skill.description, content: skill.content })
  }
  ctx.logger.info(`[helloagents] kernel section + ${skills.length} skills registered`)
}

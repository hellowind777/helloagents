/**
 * 项目初始化：把内核写入项目根目录的 AGENTS.md，并建立最小知识库。
 * AGENTS.md 是跨工具的通用规则载体，随代码仓库分发给整个团队。
 */
import { join } from 'node:path'
import { copyPath, ensureDir, fileExists } from '../kernel/fsx.mjs'
import { injectKernel, readKernelText } from '../hosts/carriers.mjs'
import { syncApp } from './runtime-app.mjs'

/** 初始化时从模板建立的知识库文件。 */
const KB_FILES = ['context.md', 'guidelines.md']

/**
 * @param {import('./main.mjs').CliContext} ctx
 * @param {string} projectDir
 */
export function runInit(ctx, projectDir) {
  syncApp(ctx.packageRoot, ctx.app)
  const kernel = readKernelText(ctx.app)
  if (!kernel) throw new Error(`内核文件缺失（kernel file missing）: ${ctx.app}/prompts/kernel.md`)

  const carrier = join(projectDir, 'AGENTS.md')
  injectKernel(carrier, kernel, ctx.version)

  const kbDir = join(projectDir, '.helloagents')
  ensureDir(join(kbDir, 'plans'))
  ensureDir(join(kbDir, 'archive'))
  /** @type {string[]} */
  const existing = []
  for (const name of KB_FILES) {
    const target = join(kbDir, name)
    if (fileExists(target)) {
      existing.push(name)
      continue
    }
    copyPath(join(ctx.app, 'prompts', 'templates', name), target)
  }

  ctx.log(ctx.t('init.done', { carrier, kb: kbDir }))
  if (existing.length > 0) ctx.log(ctx.t('init.kbExists', { files: existing.join('、') }))
}

/**
 * DeepSeek Harness（dsh）宿主适配。
 *
 * 标准模式：内核写入 $DSH_HOME/AGENTS.md（dsh-agent-instructions 原生读取），
 *   技能同步到 $DSH_HOME/skills/（dsh-skill-filesystem 原生发现，user-dsh 层）。
 * 全局模式：本地 bundle 快照（$DSH_HOME/plugins/helloagents/）+ home 级补丁层
 *   （$DSH_HOME/cordis.patch.yml）注册插件行——dsh 官方文档定义的机器级配置层，
 *   对每个 profile 生效，不依赖 pnpm；同时 npm 包自带 dsh.bundle 清单，
 *   用户也可用 `dsh plugin --profile <name> add helloagents` 安装。
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  copyPath,
  ensureDir,
  fileExists,
  readJson,
  readText,
  removePath,
  writeJsonAtomic,
  writeTextAtomic,
} from '../kernel/fsx.mjs'
import { resolveDshHome } from './registry.mjs'

export const DSH_PLUGIN_ID = 'helloagents'
export const DSH_PATCH_START = '# helloagents-managed'
export const DSH_PATCH_END = '# /helloagents-managed'

/** @param {string} home */
export function dshSkillsDir(home) {
  return join(resolveDshHome(home), 'skills')
}

/** @param {string} home */
export function dshPluginDir(home) {
  return join(resolveDshHome(home), 'plugins', DSH_PLUGIN_ID)
}

/** @param {string} home */
export function dshHomePatchPath(home) {
  return join(resolveDshHome(home), 'cordis.patch.yml')
}

/**
 * 把运行副本中的技能同步到 dsh 原生技能目录。
 * 只管理 hello-* 技能，不触碰用户自己的技能。
 * @param {string} home
 * @param {string} appDirPath
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function syncDshSkills(home, appDirPath) {
  const source = join(appDirPath, 'skills')
  if (!fileExists(source)) {
    return { ok: false, reason: `运行副本缺少 skills 目录：${source}` }
  }
  const targetRoot = dshSkillsDir(home)
  ensureDir(targetRoot)
  // 先移除旧快照中的 hello-* 技能，再写入当前版本。
  for (const entry of listSkillNames(source)) {
    removePath(join(targetRoot, entry))
    copyPath(join(source, entry), join(targetRoot, entry))
  }
  return { ok: true }
}

/**
 * 从 dsh 原生技能目录移除 helloagents 安装的技能。
 * 只删除与运行副本技能同名（hello-* 且确实由安装写入）的目录，
 * 不触碰用户自己的技能。
 * @param {string} home
 * @param {string} appDirPath
 */
export function removeDshSkills(home, appDirPath) {
  const targetRoot = dshSkillsDir(home)
  if (!fileExists(targetRoot)) return
  for (const name of listSkillNames(join(appDirPath, 'skills'))) {
    removePath(join(targetRoot, name))
  }
}

/**
 * 只返回目录名，忽略扁平文件（dsh 也支持 <name>.md，但 helloagents 全部是目录 bundle）。
 * @param {string} skillsDir
 */
function listSkillNames(skillsDir) {
  if (!fileExists(skillsDir)) return []
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

/**
 * 构建本地 bundle 快照。布局镜像 npm 包：
 * plugins/helloagents/{package.json, cordis.patch.yml, dsh/index.js, skills/, prompts/kernel.md}
 * @param {string} home
 * @param {string} appDirPath
 * @returns {{ ok: true, root: string } | { ok: false, reason: string }}
 */
function buildDshPluginSnapshot(home, appDirPath) {
  const root = dshPluginDir(home)
  const sourceDsh = join(appDirPath, 'dsh')
  if (!fileExists(sourceDsh)) {
    return { ok: false, reason: `运行副本缺少 dsh 插件目录：${sourceDsh}` }
  }
  const meta = /** @type {{ version?: string } | null} */ (readJson(join(appDirPath, 'package.json')))
  removePath(root)
  ensureDir(root)
  copyPath(sourceDsh, join(root, 'dsh'))
  copyPath(join(appDirPath, 'skills'), join(root, 'skills'))
  copyPath(join(appDirPath, 'prompts', 'kernel.md'), join(root, 'prompts', 'kernel.md'))
  writeJsonAtomic(join(root, 'package.json'), {
    name: 'dsh-helloagents',
    version: meta?.version ?? '0.0.0',
    private: true,
    type: 'module',
    description: 'HelloAGENTS — thinking-activation layer for DeepSeek Harness.',
    exports: { './dsh': './dsh/index.js' },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  })
  writeTextAtomic(
    join(root, 'cordis.patch.yml'),
    `# dsh-helloagents 本地 bundle 补丁：通过 exports 子路径解析到 dsh/index.js。\n- insert:\n    - id: ${DSH_PLUGIN_ID}\n      name: dsh-helloagents/dsh\n`,
  )
  return { ok: true, root }
}

/**
 * 构造 home 补丁层中归 helloagents 管理的行块。
 * name 必须是 Node ESM 可加载的 specifier：Windows 绝对路径会被当作 URL
 * 协议（d:）解析失败，因此统一写成 file:// URL，两种加载路径均可用。
 * @param {string} entryPath 插件入口的绝对路径
 */
function buildDshPatchBlock(entryPath) {
  return `${DSH_PATCH_START}\n- insert:\n    - id: ${DSH_PLUGIN_ID}\n      name: '${pathToFileURL(entryPath).href.replaceAll("'", "''")}'\n${DSH_PATCH_END}`
}

/**
 * 在 $DSH_HOME/cordis.patch.yml 中写入或替换受管行块；文件不存在则创建。
 * @param {string} home
 * @param {string} entryPath
 */
function upsertDshHomePatch(home, entryPath) {
  const path = dshHomePatchPath(home)
  const block = buildDshPatchBlock(entryPath)
  const existing = readText(path)
  if (existing === null || existing.trim() === '') {
    writeTextAtomic(path, `${block}\n`)
    return
  }
  const pattern = new RegExp(
    `\\r?\\n*${escapeRegex(DSH_PATCH_START)}[\\s\\S]*?${escapeRegex(DSH_PATCH_END)}\\r?\\n*`,
    'g',
  )
  if (existing.includes(DSH_PATCH_START)) {
    writeTextAtomic(path, existing.replace(pattern, `\n${block}\n`).trimEnd() + '\n')
  } else {
    writeTextAtomic(path, `${existing.trimEnd()}\n\n${block}\n`)
  }
}

/** @param {string} text */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 从 home 补丁层移除受管行块；移除后文件为空则删除文件。
 * @param {string} home
 */
export function removeDshHomePatch(home) {
  const path = dshHomePatchPath(home)
  const existing = readText(path)
  if (existing === null || !existing.includes(DSH_PATCH_START)) return
  const pattern = new RegExp(
    `\\r?\\n*${escapeRegex(DSH_PATCH_START)}[\\s\\S]*?${escapeRegex(DSH_PATCH_END)}\\r?\\n*`,
    'g',
  )
  const remainder = existing.replace(pattern, '\n').trim()
  if (remainder) writeTextAtomic(path, `${remainder}\n`)
  else removePath(path)
}

/**
 * dsh 全局模式：本地 bundle 快照 + home 补丁层注册。
 * @param {string} home
 * @param {string} appDirPath
 * @returns {import('./plugins.mjs').PluginResult}
 */
export function installDshPlugin(home, appDirPath) {
  const built = buildDshPluginSnapshot(home, appDirPath)
  if (!built.ok) return { ok: false, manualSteps: built.reason }
  upsertDshHomePatch(home, join(built.root, 'dsh', 'index.js'))
  return { ok: true }
}

/** @param {string} home */
export function uninstallDshPlugin(home) {
  removeDshHomePatch(home)
  removePath(dshPluginDir(home))
  return { ok: true }
}

/**
 * home 补丁层中受管行块的状态。
 * @param {string} home
 * @returns {'managed' | 'missing' | 'none'}
 */
export function dshHomePatchState(home) {
  const text = readText(dshHomePatchPath(home))
  if (text === null) return 'none'
  return text.includes(DSH_PATCH_START) ? 'managed' : 'missing'
}

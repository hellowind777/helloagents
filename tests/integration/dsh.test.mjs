import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { ensureDir, fileExists, readText, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { resolveDshHome } from '../../src/hosts/registry.mjs'
import { syncApp } from '../../src/cli/runtime-app.mjs'
import {
  dshHomePatchPath,
  dshHomePatchState,
  dshPluginDir,
  dshSkillsDir,
  installDshPlugin,
  removeDshHomePatch,
  removeDshSkills,
  syncDshSkills,
  uninstallDshPlugin,
} from '../../src/hosts/dsh-config.mjs'
import { makeCtx, makeFakeHome, REPO_ROOT } from '../helpers/env.mjs'

test('dsh 标准模式技能同步：写入 hello-* 技能，卸载只删同名目录', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)

    const synced = syncDshSkills(home, ctx.app)
    assert.equal(synced.ok, false, '运行副本缺少技能时应报错')

    const appSkills = join(ctx.app, 'skills')
    ensureDir(appSkills)

    // 模拟运行副本中的两个技能 + 一个用户自己的技能
    for (const name of ['hello-plan', 'hello-qa']) {
      ensureDir(join(appSkills, name))
      writeTextAtomic(join(appSkills, name, 'SKILL.md'), `---\nname: ${name}\ndescription: 测试技能\n---\n\n正文\n`)
    }
    const skillsRoot = dshSkillsDir(home)
    ensureDir(join(skillsRoot, 'my-own-skill'))
    writeTextAtomic(join(skillsRoot, 'my-own-skill', 'SKILL.md'), '---\nname: my-own-skill\ndescription: 用户的\n---\n')

    assert.equal(syncDshSkills(home, ctx.app).ok, true)
    assert.ok(fileExists(join(skillsRoot, 'hello-plan', 'SKILL.md')))
    assert.ok(fileExists(join(skillsRoot, 'hello-qa', 'SKILL.md')))

    // 更新时旧内容被替换
    writeTextAtomic(join(appSkills, 'hello-plan', 'SKILL.md'), '---\nname: hello-plan\ndescription: 新版\n---\n新正文\n')
    syncDshSkills(home, ctx.app)
    assert.equal(readText(join(skillsRoot, 'hello-plan', 'SKILL.md')), '---\nname: hello-plan\ndescription: 新版\n---\n新正文\n')

    removeDshSkills(home, ctx.app)
    assert.equal(fileExists(join(skillsRoot, 'hello-plan')), false)
    assert.equal(fileExists(join(skillsRoot, 'hello-qa')), false)
    assert.ok(fileExists(join(skillsRoot, 'my-own-skill', 'SKILL.md')), '用户自己的技能不能被删除')
  } finally {
    cleanup()
  }
})

test('dsh 全局模式：bundle 快照 + home 补丁层注册，卸载完整还原', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    syncApp(REPO_ROOT, ctx.app)
    const pluginRoot = dshPluginDir(home)

    const installed = installDshPlugin(home, ctx.app)
    assert.equal(installed.ok, true)
    assert.ok(fileExists(join(pluginRoot, 'dsh', 'index.js')))
    assert.ok(fileExists(join(pluginRoot, 'skills', 'hello-plan', 'SKILL.md')))
    assert.ok(fileExists(join(pluginRoot, 'prompts', 'kernel.md')))
    assert.ok(fileExists(join(pluginRoot, 'package.json')))
    assert.ok(fileExists(join(pluginRoot, 'cordis.patch.yml')))

    const patchPath = dshHomePatchPath(home)
    const patch = readText(patchPath) ?? ''
    assert.ok(patch.includes('helloagents-managed'))
    assert.ok(patch.includes('id: helloagents'))
    assert.ok(patch.includes('dsh/index.js'))
    // 入口必须写成 file:// URL：Windows 绝对路径在 ESM 下会被当作 d: 协议解析失败
    assert.ok(patch.includes('file:///'), '补丁行 name 应为 file:// URL')
    assert.equal(dshHomePatchState(home), 'managed')

    // 重复安装幂等：不产生重复行
    installDshPlugin(home, ctx.app)
    assert.equal(((readText(patchPath) ?? '').match(/# helloagents-managed/g) ?? []).length, 1)

    // 用户在补丁层的内容不受影响
    writeTextAtomic(patchPath, `${patch}# 我的个人补丁\n- id: my-row\n  name: my-plugin\n`)
    installDshPlugin(home, ctx.app)
    const merged = readText(patchPath) ?? ''
    assert.ok(merged.includes('# 我的个人补丁'))
    assert.ok(merged.includes('id: my-row'))

    uninstallDshPlugin(home)
    assert.equal(fileExists(pluginRoot), false)
    assert.equal(dshHomePatchState(home), 'missing', '文件残留用户内容但已无受管块')
    const after = readText(patchPath) ?? ''
    assert.ok(after.includes('# 我的个人补丁'), '卸载后用户内容保留')
    assert.ok(!after.includes('helloagents-managed'))
  } finally {
    cleanup()
  }
})

test('dsh home 补丁层：卸载后为空则删除文件，用户内容在则保留', () => {
  const { home, cleanup } = makeFakeHome()
  try {
    const { ctx } = makeCtx(home)
    syncApp(REPO_ROOT, ctx.app)
    installDshPlugin(home, ctx.app)
    const patchPath = dshHomePatchPath(home)
    assert.ok(fileExists(patchPath))
    removeDshHomePatch(home)
    assert.equal(fileExists(patchPath), false, '文件只剩受管块时应删除')

    // 有用户内容时保留
    writeTextAtomic(patchPath, '# 用户补丁\n- id: other\n  name: other-plugin\n')
    installDshPlugin(home, ctx.app)
    removeDshHomePatch(home)
    assert.ok(fileExists(patchPath))
    assert.ok(!(readText(patchPath) ?? '').includes('helloagents-managed'))
  } finally {
    cleanup()
  }
})

test('dsh 宿主目录：HELLOAGENTS_HOME 隔离优先于 DSH_HOME', () => {
  const { home, cleanup } = makeFakeHome()
  const previous = process.env.DSH_HOME
  try {
    process.env.DSH_HOME = join(home, 'elsewhere-dsh')
    assert.equal(resolveDshHome(home), join(home, '.dsh'), '测试隔离下固定为 home/.dsh')
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    cleanup()
  }
})

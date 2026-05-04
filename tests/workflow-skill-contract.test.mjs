import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { REPO_ROOT, readText } from './helpers/test-env.mjs'

function listSkillFiles(dirPath) {
  const files = []
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...listSkillFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath)
    }
  }
  return files
}

test('workflow skill contracts stay aligned with command aliases and artifacts', () => {
  const helloagents = readText(join(REPO_ROOT, 'skills', 'helloagents', 'SKILL.md'))
  assert.match(helloagents, /公共阶段边界以当前已加载 bootstrap 为准/)
  assert.match(helloagents, /ROUTE\/TIER→SPEC→PLAN→BUILD→VERIFY→CONSOLIDATE/)
  assert.match(helloagents, /ROUTE \/ TIER \/ SPEC 阶段/)
  assert.match(helloagents, /BUILD 开始时读取/)
  assert.match(helloagents, /所有 UI 任务先受当前 bootstrap 的 UI 质量基线约束/)
  assert.match(helloagents, /project_store_mode=repo-shared/)
  assert.match(helloagents, /style advisor \/ visual validation/)
  assert.match(helloagents, /遵循当前 bootstrap 的等待输入规则/)
  assert.match(helloagents, /不得把等待输入包装成完成态/)
  assert.match(helloagents, /helloagents-turn-state write --kind complete --role main/)
  assert.match(helloagents, /普通问候、普通问答、T0 只读分析和一次性解释不调用/)
  assert.match(helloagents, /不要查找、读取或拼接 `turn-state\.mjs` 源码路径/)
  assert.match(helloagents, /blocker\.target/)
  assert.match(helloagents, /`🔄 下一步` 写真实动作/)
  assert.match(helloagents, /已获授权且可继续执行时不得收尾/)
  assert.match(helloagents, /子代理不得写 turn-state/)
  assert.match(helloagents, /`~do` → 直接按 `~build` 的 command skill 路径读取并执行/)
  assert.match(helloagents, /`~design` → 直接按 `~plan` 的 command skill 路径读取并执行/)
  assert.match(helloagents, /`~review` → 直接按 `~verify` 的 command skill 路径读取并执行/)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'do', 'SKILL.md')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'design', 'SKILL.md')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'review', 'SKILL.md')), false)
  for (const commandName of readdirSync(join(REPO_ROOT, 'skills', 'commands'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)) {
    assert.match(helloagents, new RegExp(`\`~${commandName}\``), `helloagents command index should include ~${commandName}`)
  }

  const helloUi = readText(join(REPO_ROOT, 'skills', 'hello-ui', 'SKILL.md'))
  assert.match(helloUi, /不是 UI 质量的唯一来源/)
  assert.match(helloUi, /UI 质量基线负责所有 UI 任务的基础水准/)
  assert.match(helloUi, /设计契约优先级/)
  assert.match(helloUi, /plan\.md/)
  assert.match(helloUi, /\.helloagents\/DESIGN\.md/)
  assert.match(helloUi, /核心职责/)
  assert.match(helloUi, /设计简报/)
  assert.match(helloUi, /实现映射/)
  assert.match(helloUi, /视觉验收/)
  assert.match(helloUi, /最小设计契约/)
  assert.match(helloUi, /artifacts\/advisor\.json/)
  assert.match(helloUi, /artifacts\/visual\.json/)
  assert.match(helloUi, /scripts\/visual-state\.mjs write/)
  assert.doesNotMatch(helloUi, /深层职责/)
  assert.doesNotMatch(helloUi, /深层设计 brief/)

  const helloDebug = readText(join(REPO_ROOT, 'skills', 'hello-debug', 'SKILL.md'))
  assert.match(helloDebug, /反馈循环优先/)
  assert.match(helloDebug, /可证伪/)
  assert.match(helloDebug, /临时观测点/)
  assert.match(helloDebug, /测试切入点/)

  const helloTest = readText(join(REPO_ROOT, 'skills', 'hello-test', 'SKILL.md'))
  assert.match(helloTest, /垂直切片/)
  assert.match(helloTest, /公共接口/)
  assert.match(helloTest, /外部可观察行为/)
  assert.match(helloTest, /不锁定实现细节/)

  const idea = readText(join(REPO_ROOT, 'skills', 'commands', 'idea', 'SKILL.md'))
  assert.match(idea, /不创建或更新当前项目存储中的 `state_path`/)
  assert.match(idea, /项目级规则文件/)
  assert.doesNotMatch(idea, /项目根载体/)
  assert.match(idea, /不执行会改变工作区或外部状态的命令/)
  assert.match(idea, /不在 `~idea` 内偷偷写文件/)

  const helloReview = readText(join(REPO_ROOT, 'skills', 'hello-review', 'SKILL.md'))
  assert.match(helloReview, /审查结束时必须单独给出一行“审查结论：\.\.\.”/)
  assert.match(helloReview, /scripts\/review-state\.mjs write/)
  assert.match(helloReview, /`outcome`（`clean` \/ `findings`）/)
  assert.match(helloReview, /未发现阻塞问题/)

  const helloVerify = readText(join(REPO_ROOT, 'skills', 'hello-verify', 'SKILL.md'))
  assert.match(helloVerify, /artifacts\/review\.json/)
  assert.match(helloVerify, /artifacts\/visual\.json/)
  assert.match(helloVerify, /artifacts\/closeout\.json/)
  assert.match(helloVerify, /contract\.json/)
  assert.match(helloVerify, /scripts\/closeout-state\.mjs write/)
  assert.match(helloVerify, /helloagents-turn-state write --kind complete --role main/)
  assert.match(helloVerify, /scripts\/visual-state\.mjs write/)
  assert.match(helloVerify, /blocker\.target/)
  assert.match(helloVerify, /本地版本检查点/)
  assert.match(helloVerify, /非只读任务完成验证且产生工作区变更时/)
  assert.match(helloVerify, /使用当前回复语言生成简洁 conventional commit message/)
  assert.match(helloVerify, /执行 `git commit`/)
  assert.match(helloVerify, /不自动远程 `git push`/)
  assert.match(helloVerify, /requirementsCoverage/)
  assert.match(helloVerify, /deliveryChecklist/)
  assert.match(helloVerify, /PASS` \/ `BLOCKED/)
  assert.match(helloVerify, /完成标准/)
  assert.match(helloVerify, /复跑最初的复现循环/)
  assert.match(helloVerify, /公共接口和用户可观察行为/)
  assert.match(helloVerify, /目标偏移检查/)
  assert.doesNotMatch(helloVerify, /Ralph Loop/)
  assert.doesNotMatch(helloVerify, /APGD/)

  const auto = readText(join(REPO_ROOT, 'skills', 'commands', 'auto', 'SKILL.md'))
  assert.match(auto, /当前工作流优先/)
  assert.match(auto, /推荐下一命令 \/ 主路径/)
  assert.match(auto, /活跃方案包不完整或缺少任务清单 → 先 `~plan`/)
  assert.match(auto, /活跃方案包仍在执行 → 先 `~build`/)
  assert.match(auto, /`T3` 高风险或不可逆操作默认不直接进入 `~build`/)
  assert.match(auto, /纯审查\/纯验证请求才可先进入 `~verify`/)
  assert.match(auto, /不要在 `~auto` 内另建一套关键词路由表/)
  assert.match(auto, /不依赖关键词命中做机械分流/)
  assert.match(auto, /默认持续推进直到完成交付/)
  assert.match(auto, /不再额外询问“是否开始执行”/)
  assert.match(auto, /不得把 `🔄 下一步` 当作阶段交接或继续执行占位/)
  assert.match(auto, /不得把“给出方案”“给出任务列表”“未执行修改”“等待下一步确认”“给出建议下一步”当作 `~auto` 的默认完成态/)
  assert.doesNotMatch(auto, /只做选路/)

  const plan = readText(join(REPO_ROOT, 'skills', 'commands', 'plan', 'SKILL.md'))
  assert.match(plan, /执行 `~plan` 时，通用阶段边界按当前已加载 bootstrap 执行/)
  assert.match(plan, /按当前已加载 bootstrap 的“.helloagents\/ 文件读取优先级”和“项目文件”规则恢复上下文/)
  assert.match(plan, /先读取 `state_path`/)
  assert.match(plan, /按当前已加载 bootstrap 的 `\.helloagents\/` 与流程状态规则，确保最小项目状态已建立/)
  assert.match(plan, /`contract\.json`/)
  assert.match(plan, /scripts\/plan-contract\.mjs write/)
  assert.match(plan, /ui\.styleAdvisor\.required/)
  assert.match(plan, /ui\.visualValidation\.required/)
  assert.match(plan, /知识库完整创建与归档按当前已加载 bootstrap 的后续规则执行/)
  assert.match(plan, /“主线目标”写本次规划要完成的目标/)
  assert.match(plan, /完成定义/)
  assert.match(plan, /完成标准、验证方式/)
  assert.match(plan, /领域语言/)
  assert.match(plan, /端到端垂直切片/)
  assert.match(plan, /AFK/)
  assert.match(plan, /HITL/)
  assert.match(plan, /如果当前任务来自 `~auto`/)
  assert.match(plan, /不再追加一次“是否开始执行”的询问/)
  assert.match(plan, /`~design` 是 `~plan` 的兼容别名/)
  assert.match(plan, /只有在 `~auto` 内触发其语义时/)
  assert.match(plan, /显式 `~plan` 或 `~design`/)
  assert.match(plan, /下一步写清待确认的执行动作/)
  assert.doesNotMatch(plan, /ROUTE \/ SPEC 前置/)
  assert.doesNotMatch(plan, /统一处理/)

  const verify = readText(join(REPO_ROOT, 'skills', 'commands', 'verify', 'SKILL.md'))
  assert.match(verify, /当前工作流约束/)
  assert.match(verify, /不能越过当前方案包边界/)
  assert.match(verify, /审查、验真和交付收尾/)
  assert.match(verify, /验证契约/)
  assert.match(verify, /`requirements\.md`、`plan\.md`、`tasks\.md`、`contract\.json`/)
  assert.match(verify, /scripts\/review-state\.mjs write/)
  assert.match(verify, /当前上下文中已注入“验证分流”/)
  assert.match(verify, /默认先做全量验证/)
  assert.match(verify, /立即补做 `hello-review`/)
  assert.match(verify, /artifacts\/advisor\.json/)
  assert.match(verify, /artifacts\/visual\.json/)
  assert.match(verify, /scripts\/visual-state\.mjs write/)
  assert.match(verify, /requirements 是否覆盖、tasks 中每项“完成标准”是否满足/)
  assert.match(verify, /合同核对结论/)
  assert.match(verify, /不能把“命令通过”直接等同于“风险已解除”/)
  assert.match(verify, /进入当前已加载 bootstrap 的 CONSOLIDATE 收尾/)

  const build = readText(join(REPO_ROOT, 'skills', 'commands', 'build', 'SKILL.md'))
  assert.match(build, /执行 `~build` 时，通用阶段边界按当前已加载 bootstrap 执行/)
  assert.match(build, /优先按当前已加载 bootstrap 的“.helloagents\/ 文件读取优先级”恢复当前任务/)
  assert.match(build, /先读取 `state_path`/)
  assert.match(build, /“完成标准”当作本轮实现约束/)
  assert.match(build, /`contract\.json`/)
  assert.match(build, /其余项目知识库与相关代码文件，按 bootstrap 的项目上下文规则按需读取/)
  assert.match(build, /当前工作流约束/)
  assert.match(build, /只有推荐仍为 `~build`/)
  assert.match(build, /按当前实现需要读取对应的 hello-\* 技能/)
  assert.match(build, /进入 `~verify`/)
  assert.match(build, /按当前已加载 bootstrap 的 VERIFY \/ CONSOLIDATE 规则执行/)
  assert.doesNotMatch(build, /读取 PLAN 阶段所需的 hello-\* 技能/)
  assert.doesNotMatch(build, /需要时同步知识库、`CHANGELOG\.md`、modules 文档与反思/)

  const help = readText(join(REPO_ROOT, 'skills', 'commands', 'help', 'SKILL.md'))
  assert.match(help, /纯标准模式未激活项目不会自动触发这些技能/)
  assert.match(help, /UI 质量基线约束/)
  assert.match(help, /project_store_mode/)

  const bootstrapFull = readText(join(REPO_ROOT, 'bootstrap.md'))
  assert.match(bootstrapFull, /项目级规则文件（`AGENTS\.md`、`CLAUDE\.md`、`\.gemini\/GEMINI\.md`）/)
  assert.doesNotMatch(bootstrapFull, /项目根 AGENTS\.md/)

  const bootstrapLite = readText(join(REPO_ROOT, 'bootstrap-lite.md'))
  assert.match(bootstrapLite, /项目级规则文件（`AGENTS\.md`、`CLAUDE\.md`、`\.gemini\/GEMINI\.md`）/)
  assert.doesNotMatch(bootstrapLite, /项目根 AGENTS\.md/)

  const readme = readText(join(REPO_ROOT, 'README.md'))
  assert.match(readme, /UI quality baseline/)
  assert.match(readme, /hello-ui` adds deeper design-contract execution, design-system mapping, and visual validation on top of that baseline/)
  assert.match(readme, /artifacts\/visual\.json/)
  assert.match(readme, /refreshes project-level HelloAGENTS package-root links/)
  assert.match(readme, /project-level rule files/)
  assert.doesNotMatch(readme, /Codex project skill link at `\.codex\/skills\/helloagents`/)
  assert.doesNotMatch(readme, /Writing UI code\? → `hello-ui` activates/)

  const readmeCn = readText(join(REPO_ROOT, 'README_CN.md'))
  assert.match(readmeCn, /UI 质量基线/)
  assert.match(readmeCn, /`hello-ui` 会在该基线之上补充设计契约执行、设计系统映射与视觉验收/)
  assert.match(readmeCn, /artifacts\/visual\.json/)
  assert.match(readmeCn, /刷新各宿主项目级 HelloAGENTS 包根链接/)
  assert.match(readmeCn, /项目级规则文件/)
  assert.doesNotMatch(readmeCn, /刷新 Codex 项目技能链接 `\.codex\/skills\/helloagents`/)
  assert.doesNotMatch(readmeCn, /写 UI 代码？→ `hello-ui` 激活/)

  const prd = readText(join(REPO_ROOT, 'skills', 'commands', 'prd', 'SKILL.md'))
  assert.match(prd, /执行 `~prd` 时，通用阶段边界按当前已加载 bootstrap 执行/)
  assert.match(prd, /执行 `~prd` 时，不读取 `~plan` 的 command skill/)
  assert.match(prd, /按当前已加载 bootstrap 的“.helloagents\/ 文件读取优先级”和“项目文件”规则恢复上下文/)
  assert.match(prd, /先读取 `state_path`/)
  assert.match(prd, /按当前已加载 bootstrap 的 `\.helloagents\/` 与流程状态规则，确保最小项目状态已建立/)
  assert.match(prd, /`contract\.json`/)
  assert.match(prd, /scripts\/plan-contract\.mjs write/)
  assert.match(prd, /ui\.styleAdvisor\.required/)
  assert.match(prd, /ui\.visualValidation\.required/)
  assert.match(prd, /“主线目标”写本次 PRD 要完成的产品 \/ 功能目标/)
  assert.match(prd, /完成标准[、与]验证方式/)
  assert.match(prd, /领域语言/)
  assert.match(prd, /端到端垂直切片/)
  assert.match(prd, /AFK \/ HITL/)
  assert.match(prd, /如果当前任务来自 `~auto`/)
  assert.match(prd, /不再额外询问一次“是否开始执行”/)
  assert.doesNotMatch(prd, /SPEC 前置/)
  assert.doesNotMatch(prd, /本 skill 自包含/)

  const wiki = readText(join(REPO_ROOT, 'skills', 'commands', 'wiki', 'SKILL.md'))
  assert.match(wiki, /仅创建、补全或同步项目知识库/)
  assert.match(wiki, /目录结构、模板格式和状态文件重写规则按当前已加载 bootstrap 执行/)
  assert.match(wiki, /不写入项目级规则文件，也不创建项目级 HelloAGENTS 包根链接/)
  assert.match(wiki, /project_store_mode=repo-shared/)
  assert.match(wiki, /初始“主线目标”只写当前知识库初始化 \/ 同步目标/)
  assert.match(wiki, /只记录当前知识库任务/)
  assert.match(wiki, /不创建任何项目级 HelloAGENTS 包根链接/)
  assert.match(wiki, /项目级规则文件/)
  assert.doesNotMatch(wiki, /非载体项目/)
  assert.doesNotMatch(wiki, /\.codex\/skills\/helloagents/)

  const init = readText(join(REPO_ROOT, 'skills', 'commands', 'init', 'SKILL.md'))
  assert.match(init, /目录结构、模板格式和状态文件规则按当前已加载 bootstrap 执行/)
  assert.match(init, /项目级规则文件/)
  assert.doesNotMatch(init, /项目根载体/)
  assert.match(init, /初始“主线目标”写当前初始化任务/)
  assert.match(init, /只记录当前初始化任务/)
  assert.match(init, /各宿主项目级 HelloAGENTS 包根链接/)
  assert.match(init, /用于项目级规则定位 HelloAGENTS 的 `skills\/`、`templates\/` 和 `scripts\/`/)
  assert.match(init, /\.claude\/skills\/helloagents/)
  assert.match(init, /\.gemini\/skills\/helloagents/)
  assert.match(init, /\.codex\/skills\/helloagents/)

  const clean = readText(join(REPO_ROOT, 'skills', 'commands', 'clean', 'SKILL.md'))
  assert.match(clean, /方案包归档、临时文件清理和状态文件更新范围按当前已加载 bootstrap 执行/)
  assert.match(clean, /只有任务清单无法判断时/)
  assert.match(clean, /按 bootstrap 的归档规则/)
  assert.match(clean, /不删除知识文件或项目级设计契约/)

  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /ROUTE\/TIER→SPEC→PLAN→BUILD→VERIFY→CONSOLIDATE/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /涉及公共阶段边界、阻塞判定与收尾要求的部分，仍按当前已加载 bootstrap 执行/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /必须维护这个状态文件/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /主线目标=当前优化目标/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /除非达到迭代上限或命中阻塞判定，否则继续执行/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /不把 `🔄 下一步` 当作单轮结果或继续执行占位/)
  assert.match(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /\/goal` 只作为外层长程续跑与预算控制/)
  assert.doesNotMatch(readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md')), /不要停止。不要询问是否继续。/)

  const commit = readText(join(REPO_ROOT, 'skills', 'commands', 'commit', 'SKILL.md'))
  assert.match(commit, /知识库同步与状态文件更新范围按当前已加载 bootstrap 的 CONSOLIDATE \/ 流程状态规则执行/)
  assert.match(commit, /缺少 `commit_attribution` \/ `kb_create_mode`/)
  assert.match(commit, /按 bootstrap 的“已有则更新”规则同步当前已提交状态/)
  assert.match(commit, /同步范围与更新格式按当前已加载 bootstrap 的 CONSOLIDATE 阶段执行/)
})

test('runtime rule files avoid maintainer-facing prose', () => {
  const runtimeFiles = [
    join(REPO_ROOT, 'bootstrap.md'),
    join(REPO_ROOT, 'bootstrap-lite.md'),
    ...listSkillFiles(join(REPO_ROOT, 'skills')),
  ]

  const bannedPatterns = [
    /唯一规则源/,
    /不再单独维护/,
    /并行阶段定义/,
    /本 skill 只描述/,
    /本 skill 只覆盖/,
    /不在此重复改写/,
    /维护说明/,
    /作者说明/,
    /重构说明/,
  ]

  for (const filePath of runtimeFiles) {
    const content = readText(filePath)
    for (const pattern of bannedPatterns) {
      assert.doesNotMatch(content, pattern, `${filePath} should avoid maintainer-facing prose: ${pattern}`)
    }
  }
})

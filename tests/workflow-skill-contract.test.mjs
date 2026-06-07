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

test('workflow skills stay aligned with the new qa-review architecture', () => {
  const helloagents = readText(join(REPO_ROOT, 'skills', 'helloagents', 'SKILL.md'))
  assert.match(helloagents, /【子代理短路】/)
  assert.match(helloagents, /立即跳过本 skill 后续仅面向主代理的规则/)
  assert.match(helloagents, /选路与分层→目标澄清→规划→实现→质量闭环→收尾与归档/)
  assert.doesNotMatch(helloagents, /ROUTE\/TIER→SPEC→PLAN→BUILD→QA→CONSOLIDATE/)
  assert.match(helloagents, /qa-review 的质量铁律/)
  assert.match(helloagents, /`~qa`/)
  assert.match(helloagents, /`~office`/)
  assert.match(helloagents, /`~do` → 直接按 `~build` 的 command skill 路径读取并执行/)
  assert.match(helloagents, /`~design` → 直接按 `~plan` 的 command skill 路径读取并执行/)
  assert.match(helloagents, /`~review` → 直接按 `~qa` 的 command skill 路径读取并执行/)
  assert.doesNotMatch(helloagents, /`~global`/)
  assert.doesNotMatch(helloagents, /`~wiki`/)
  assert.doesNotMatch(helloagents, /hello-review/)
  assert.doesNotMatch(helloagents, /hello-verify/)

  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'global')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'wiki')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'commands', 'verify')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'hello-review')), false)
  assert.equal(existsSync(join(REPO_ROOT, 'skills', 'hello-verify')), false)

  const init = readText(join(REPO_ROOT, 'skills', 'commands', 'init', 'SKILL.md'))
  assert.match(init, /初始化项目工作流并同步知识库/)
  assert.match(init, /HELLOAGENTS_PROFILE: full/)
  assert.match(init, /AGENTS\.md/)
  assert.match(init, /CLAUDE\.md/)
  assert.match(init, /\.gemini\/GEMINI\.md/)
  assert.doesNotMatch(init, /与 ~wiki 同义/)

  const qaReview = readText(join(REPO_ROOT, 'skills', 'qa-review', 'SKILL.md'))
  assert.match(qaReview, /统一质量审查/)
  assert.match(qaReview, /`standard`/)
  assert.match(qaReview, /`deep`/)
  assert.match(qaReview, /`artifacts\/qa-review\.json`/)
  assert.match(qaReview, /`qaMode`/)
  assert.match(qaReview, /`qaFocus`/)

  const auto = readText(join(REPO_ROOT, 'skills', 'commands', 'auto', 'SKILL.md'))
  assert.match(auto, /~idea \/ ~office \/ ~plan \/ ~build \/ ~qa \/ ~prd/)
  assert.match(auto, /纯质量审查、验真或收尾请求才可先进入 `~qa`/)
  assert.match(auto, /主路径一旦确定/)
  assert.match(auto, /先完成 `~qa` 与 HelloAGENTS 收尾，再标记 goal complete/)
  assert.doesNotMatch(auto, /ROUTE \/ TIER/)
  assert.doesNotMatch(auto, /~verify/)

  const office = readText(join(REPO_ROOT, 'skills', 'commands', 'office', 'SKILL.md'))
  assert.match(office, /价值与范围评估命令/)
  assert.match(office, /不创建 `\.helloagents\/`/)
  assert.match(office, /最小可验证切口/)
  assert.match(office, /不建议做/)
  assert.match(office, /值得做，但先做最小切口/)

  const plan = readText(join(REPO_ROOT, 'skills', 'commands', 'plan', 'SKILL.md'))
  assert.match(plan, /`qaMode`、`qaFocus`/)
  assert.match(plan, /端到端垂直切片/)
  assert.match(plan, /AFK/)
  assert.match(plan, /HITL/)
  assert.doesNotMatch(plan, /verifyMode/)

  const prd = readText(join(REPO_ROOT, 'skills', 'commands', 'prd', 'SKILL.md'))
  assert.match(prd, /`qaMode`、`qaFocus`/)
  assert.match(prd, /端到端垂直切片/)
  assert.match(prd, /AFK \/ HITL/)
  assert.doesNotMatch(prd, /QA \/ CONSOLIDATE/)
  assert.doesNotMatch(prd, /verifyMode/)

  const build = readText(join(REPO_ROOT, 'skills', 'commands', 'build', 'SKILL.md'))
  assert.match(build, /进入 `~qa`/)
  assert.match(build, /`qaMode`、`qaFocus`/)
  assert.match(build, /局部验证与修复循环/)
  assert.doesNotMatch(build, /QA \/ CONSOLIDATE/)
  assert.doesNotMatch(build, /hello-verify/)
  assert.doesNotMatch(build, /hello-review/)

  const qa = readText(join(REPO_ROOT, 'skills', 'commands', 'qa', 'SKILL.md'))
  assert.match(qa, /统一质量命令/)
  assert.match(qa, /读取 `skills\/qa-review\/SKILL\.md`/)
  assert.match(qa, /`contract\.json` 中声明的 `qaMode` \/ `qaFocus`/)
  assert.match(qa, /`artifacts\/qa-review\.json`/)
  assert.match(qa, /`scripts\/closeout-state\.mjs write`/)
  assert.doesNotMatch(qa, /CONSOLIDATE/)

  const commit = readText(join(REPO_ROOT, 'skills', 'commands', 'commit', 'SKILL.md'))
  assert.match(commit, /规范化 Git 提交 \+ 知识库同步/)
  assert.doesNotMatch(commit, /CONSOLIDATE/)

  const help = readText(join(REPO_ROOT, 'skills', 'commands', 'help', 'SKILL.md'))
  assert.match(help, /\| ~init \| 初始化项目工作流并同步知识库 \|/)
  assert.match(help, /\| ~office \| 价值与范围评估/)
  assert.match(help, /\| ~qa \| 统一质量总入口/)
  assert.match(help, /完成时：qa-review, hello-reflect/)
  assert.doesNotMatch(help, /~wiki/)
  assert.doesNotMatch(help, /~global/)
  assert.doesNotMatch(help, /~verify/)
  assert.match(help, /`~review` → 等同 `~qa`/)

  const loop = readText(join(REPO_ROOT, 'skills', 'commands', 'loop', 'SKILL.md'))
  assert.match(loop, /\/goal -> ~auto -> ~qa/)
  assert.match(loop, /不再维护独立的指标实验循环/)
  assert.match(loop, /最终质量闭环交给 `~qa`/)
  assert.doesNotMatch(loop, /CONSOLIDATE/)
  assert.doesNotMatch(loop, /hello-verify/)

  assert.doesNotMatch(init, /full carrier/)
})

test('README and bootstrap docs expose qa-review instead of the old split review+verify path', () => {
  const readme = readText(join(REPO_ROOT, 'README.md'))
  assert.match(readme, /`qa-review`/)
  assert.match(readme, /`~qa`/)
  assert.match(readme, /`~office`/)
  assert.match(readme, /`~init`/)
  assert.match(readme, /artifacts\/qa-review\.json/)
  assert.match(readme, /Routing and tiering → Goal clarification → Planning → Implementation → Quality loop → Closeout and archive/)
  assert.match(readme, /always-on core-rule layer in `bootstrap.md` \/ `bootstrap-lite.md`/)
  assert.match(readme, /`~review` → `~qa`/)
  assert.match(readme, /`qaMode`, `qaFocus`, optional advisor checks, and optional visual validation/)
  assert.doesNotMatch(readme, /ROUTE \/ TIER → SPEC → PLAN → BUILD → QA → CONSOLIDATE/)
  assert.doesNotMatch(readme, /reviewer\/tester focus/)
  assert.doesNotMatch(readme, /`~wiki`/)
  assert.doesNotMatch(readme, /`~global`/)
  assert.doesNotMatch(readme, /hello-review/)
  assert.doesNotMatch(readme, /hello-verify/)
  assert.doesNotMatch(readme, /~verify/)

  const readmeCn = readText(join(REPO_ROOT, 'README_CN.md'))
  assert.match(readmeCn, /`qa-review`/)
  assert.match(readmeCn, /`~qa`/)
  assert.match(readmeCn, /`~office`/)
  assert.match(readmeCn, /`~init`/)
  assert.match(readmeCn, /artifacts\/qa-review\.json/)
  assert.match(readmeCn, /选路与分层 → 目标澄清 → 规划 → 实现 → 质量闭环 → 收尾与归档/)
  assert.doesNotMatch(readmeCn, /ROUTE \/ TIER → SPEC → PLAN → BUILD → QA → CONSOLIDATE/)
  assert.match(readmeCn, /`bootstrap\.md` \/ `bootstrap-lite\.md` 这层默认启用一组常驻核心规则/)
  assert.match(readmeCn, /`~review` → `~qa`/)
  assert.match(readmeCn, /`qaMode`、`qaFocus`、可选 advisor 检查和可选视觉验收/)
  assert.doesNotMatch(readmeCn, /reviewer\/tester 关注点/)
  assert.doesNotMatch(readmeCn, /`~wiki`/)
  assert.doesNotMatch(readmeCn, /`~global`/)
  assert.doesNotMatch(readmeCn, /hello-review/)
  assert.doesNotMatch(readmeCn, /hello-verify/)
  assert.doesNotMatch(readmeCn, /~verify/)

  const bootstrap = readText(join(REPO_ROOT, 'bootstrap.md'))
  assert.match(bootstrap, /【子代理短路】/)
  assert.match(bootstrap, /立即跳过本文件后续仅面向主代理的规则/)
  assert.match(bootstrap, /只使用当前回复语言表达所有用户可见文本/)
  assert.match(bootstrap, /首次说明后固定一个称呼/)
  assert.match(bootstrap, /文件名、目录名、路径、标记名、配置键/)
  assert.match(bootstrap, /涉及判断与取舍时，先判断约束是否真实，再给干净目标，最后再谈迁移路径。/)
  assert.match(bootstrap, /若明显被当前实现、旧命名、旧目录、半成品结构或兼容压力拖住，先切到终局倒推或零遗留视角，重看正确目标。/)
  assert.match(bootstrap, /公开 API、持久化数据、已文档化集成、用户承诺、部署与合规要求等才算真实约束；内部调用方、旧命名、旧目录结构、半成品实现和“改动会很大”不自动成立。/)
  assert.match(bootstrap, /保留、合并、延后、删除、替换或先证明/)
  assert.match(bootstrap, /#### 6\. 收尾与归档/)
  assert.doesNotMatch(bootstrap, /CONSOLIDATE/)
  assert.doesNotMatch(bootstrap, /Delivery Tier/)

  const bootstrapLite = readText(join(REPO_ROOT, 'bootstrap-lite.md'))
  assert.match(bootstrapLite, /【子代理短路】/)
  assert.match(bootstrapLite, /立即跳过本文件后续仅面向主代理的规则/)
  assert.match(bootstrapLite, /只使用当前回复语言表达所有用户可见文本/)
  assert.match(bootstrapLite, /文件名、目录名、路径、标记名、配置键/)
  assert.match(bootstrapLite, /涉及判断与取舍时，先判断约束是否真实，再给干净目标，最后再谈迁移路径。/)
  assert.match(bootstrapLite, /若明显被当前实现、旧命名、旧目录、半成品结构或兼容压力拖住，先切到终局倒推或零遗留视角，重看正确目标。/)
  assert.match(bootstrapLite, /公开 API、持久化数据、已文档化集成、用户承诺、部署与合规要求等才算真实约束；内部调用方、旧命名、旧目录结构、半成品实现和“改动会很大”不自动成立。/)
  assert.doesNotMatch(bootstrapLite, /Delivery Tier/)

  const help = readText(join(REPO_ROOT, 'skills', 'commands', 'help', 'SKILL.md'))
  assert.match(help, /核心规则默认生效：HelloAGENTS 会通过 `bootstrap\.md` \/ `bootstrap-lite\.md` 在运行时持续执行方案纠偏与语言纪律/)

  const arch = readText(join(REPO_ROOT, 'skills', 'hello-arch', 'SKILL.md'))
  assert.match(arch, /区分真实外部契约与内部实现惯性：公开 API、持久化数据、已文档化集成、用户承诺等真实契约要评估兼容与迁移/)
  assert.doesNotMatch(arch, /保持向后兼容，除非明确要求破坏性变更/)
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
    /当前已加载 bootstrap/,
    /当前 bootstrap/,
    /bootstrap 的/,
    /按 bootstrap/,
    /命中 bootstrap/,
    /遵守 bootstrap/,
    /bootstrap 中定义/,
    /当前已加载 HelloAGENTS/,
    /HelloAGENTS 规则的/,
    /HelloAGENTS 规则中/,
    /规则的.*规则/,
    /规则中的.*规则/,
  ]

  for (const filePath of runtimeFiles) {
    const content = readText(filePath)
    for (const pattern of bannedPatterns) {
      assert.doesNotMatch(content, pattern, `${filePath} should avoid maintainer-facing prose: ${pattern}`)
    }
  }
})

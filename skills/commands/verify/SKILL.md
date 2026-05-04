---
name: ~verify
description: 验证总入口 — 审查、lint、typecheck、test、build 与修复循环（~verify 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~verify [scope]

## 流程

0. 先对齐当前工作流状态：
   - 若当前上下文中已注入“当前工作流约束”或“当前建议下一命令”，先服从它
   - 即使命令通过，也不能越过当前方案包边界：不完整方案包不能视为可信交付记录，未闭合方案包不能被整体报告为已完成
   - 当推荐路径已进入 `~verify` / 收尾时，优先把本命令用于审查、验真和交付收尾
   - 若当前存在活跃方案包，先读取 `requirements.md`、`plan.md`、`tasks.md`、`contract.json`，把它们当作本轮验证契约；不要只看命令结果
   - 若本轮运行在 Codex active goal 下，按 active goal 关联方案包和 `state_path` 复核范围；`/goal` 只负责续跑，不改变验证契约
   - 若 `contract.json` 声明 `advisor.required=true` 或 `ui.styleAdvisor.required=true`，则本轮还必须补齐当前会话 `artifacts/advisor.json`；advisor / style advisor 都是可选能力，不是默认常驻步骤
   - 若 `contract.json` 声明 `ui.visualValidation.required=true`，则本轮还必须补齐当前会话 `artifacts/visual.json`；视觉验收优先用截图/浏览器工具，没有工具时才降级为结构化代码级自检
1. 先决定验证分流：
   - 若当前上下文中已注入“验证分流”，先按该分流执行
   - 用户显式使用 `~review` 时，即使本轮没有注入分流，也按审查优先起步
   - 若没有注入分流、也不是 `~review`，默认先做全量验证；执行中一旦发现高风险流程、关键权限/配置/迁移/发布边界或明显未覆盖的风险点，立即补做 `hello-review`
2. 审查优先模式：
   - 获取变更范围：无参数默认未提交变更；`staged` 代表暂存区；指定文件/目录则只审查对应范围
   - 按 hello-* 技能查找路径读取 `hello-review` SKILL.md，执行逐文件审查
   - 高风险流程除显式范围外，还要主动补查相关配置、迁移、权限、部署或安全边界文件，不能只盯住单个功能文件
   - 审查结论确定后，立即调用 `scripts/review-state.mjs write` 写当前会话 `artifacts/review.json`；用结构化字段记录 `outcome`、`conclusion`、`findings`、`fileReferences`，不要让后续检查脚本再从自然语言消息里猜结论
3. 全量验证模式或审查后继续验证：
   - 读取 `hello-verify` SKILL.md
   - 按其“验证命令来源”优先级检测命令
   - 逐个运行所有检测到的命令
   - 收集每个命令的输出和退出码
   - 对照当前契约逐项核对：requirements 是否覆盖、tasks 中每项“完成标准”是否满足、`plan.md` 中风险与设计约束是否被验证、`contract.json` 中声明的 `verifyMode` / reviewer / tester 关注边界是否已被覆盖
   - 若 Codex active goal 存在，还要确认 `tasks.md` 的 AFK/HITL 边界：仍有可执行 AFK 项时，不进入 complete；只在目标、任务、验证和收尾都闭合后标记 goal complete
   - 若 `advisor.required=true` 或 `ui.styleAdvisor.required=true`，在进入收尾前调用 `scripts/advisor-state.mjs write` 写当前会话 `artifacts/advisor.json`；记录触发原因、focus、consultedSources、结论与建议，禁止只在自然语言里留一段 advisor 意见
   - 若 `ui.visualValidation.required=true`，在进入收尾前调用 `scripts/visual-state.mjs write` 写当前会话 `artifacts/visual.json`；记录 `reason`、`tooling`、`screensChecked`、`statesChecked`、`status`、`summary`、`findings` 与 `recommendations`
4. 汇总报告：
   - ✅ 通过的审查项 / 命令
   - ❌ 失败的审查项 / 命令 + 错误详情
   - 合同核对结论：哪些需求 / 任务完成标准已满足，哪些仍未满足
   - 修复建议
   - 高风险流程额外说明：不能把“命令通过”直接等同于“风险已解除”；若仍存在未验证的风险边界、待授权操作或不可逆步骤，必须明确列出并停下

## 失败处理
- 有失败 → 逐个修复，修复后重新运行对应审查或验证
- 全部通过 → 进入当前已加载 bootstrap 的 CONSOLIDATE 收尾；若 Codex active goal 的目标也已满足，再标记 goal complete，并按交付边界报告完成

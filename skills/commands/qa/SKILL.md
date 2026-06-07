---
name: ~qa
description: 统一质量命令 — 审查、命令验证、阻断修复、回归验证与收尾前质量闭环（~qa 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~qa [scope]

## 流程

0. 先对齐当前工作流状态：
   - 若当前上下文中已注入“当前工作流约束”或“当前推荐下一命令”，先服从它
   - 即使命令通过，也不能越过当前方案包边界：不完整方案包不能视为可信交付记录
   - 当前存在活跃方案包时，先读取 `requirements.md`、`plan.md`、`tasks.md`、`contract.json`
   - 若当前运行在 Codex active goal 下，按 active goal 关联方案包和 `state_path` 复核范围；`/goal` 只负责续跑，不改变质量契约
   - 若 `contract.json` 声明 `advisor.required=true` 或 `ui.styleAdvisor.required=true`，则本次质量闭环还必须补齐当前会话 `artifacts/advisor.json`
   - 若 `contract.json` 声明 `ui.visualValidation.required=true`，则本次质量闭环还必须补齐当前会话 `artifacts/visual.json`
1. 读取 `skills/qa-review/SKILL.md`
2. 先确定本次范围：
   - 无参数默认当前未提交变更
   - `staged` 代表暂存区
   - 指定文件/目录则只审查对应范围
   - 高风险流程除显式范围外，还要主动补查相关配置、迁移、权限、部署或安全边界文件
3. 执行统一 qa-review：
   - 先做质量审查
   - 再运行验证命令
   - 有阻断问题或命令失败 → 修复 → 重新验证
   - 直到质量闭环通过，或命中真实阻塞
4. 对照当前契约逐项核对：
   - requirements 是否覆盖
   - tasks 中每项“完成标准”是否满足
   - `plan.md` 中风险与设计约束是否被验证
   - `contract.json` 中声明的 `qaMode` / `qaFocus` 是否已被本次质量闭环覆盖
   - 若 Codex active goal 存在，还要确认 `tasks.md` 的 AFK/HITL 边界：仍有可执行 AFK 项时，不进入 complete
5. 写结构化证据：
   - 立即调用 `scripts/qa-review-state.mjs write` 写当前会话 `artifacts/qa-review.json`
   - 若 `advisor.required=true` 或 `ui.styleAdvisor.required=true`，调用 `scripts/advisor-state.mjs write`
   - 若 `ui.visualValidation.required=true`，调用 `scripts/visual-state.mjs write`
   - 若当前准备进入最终收尾，优先调用 `scripts/closeout-state.mjs write`
6. 汇总：
   - ✅ 通过的审查项 / 命令
   - ❌ 失败的审查项 / 命令 + 修复结果
   - 仍未满足的阻断项
   - 是否已满足进入收尾与归档的条件

## 失败处理

- 有失败 → 逐个修复，修复后重新运行对应审查或验证
- 全部通过 → 按当前已加载的 HelloAGENTS 规则进入收尾与归档；若 Codex active goal 的目标也已满足，再标记 goal complete，并按交付边界报告完成

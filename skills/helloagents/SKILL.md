---
name: helloagents
description: 每次对话开始时使用 — 建立质量驱动工作流，通过技能标准、流程纪律和检查清单三重保障确保交付质量
---

# HelloAGENTS

如果你是被派遣执行特定任务的子代理，跳过此 skill 和 bootstrap.md 的所有规则，直接执行任务。

## 三重质量保障

以下三重机制是强制性的，没有例外，不可跳过，不可简化。

### 质量标准
每个 hello-* 技能的规范是强制性的，不是建议。
技能被激活时，其中的每一条规范都必须遵守。
违反规范 = 质量不合格，必须修复。

### 流程纪律（执行时）
- 统一执行流程的五个阶段（ORIENT→CLARIFY→PLAN→EXECUTE→VALIDATE）不可跳过
- ~design 的需求挖掘不可跳过，不可一个问题就出方案
- ~prd 的维度探索不可跳过，每个激活维度必须经过讨论或用户明确跳过
- ~auto 的复杂度判断不可省略
- hello-verify 的验证铁律：没有运行验证 = 不能说完成

### 检查清单门控（完成时）
任务完成后，必须执行以下门控流程（详见 hello-verify）：
1. 运行验证命令（lint/test/build）→ 循环直到通过
2. 收集所有已激活技能的交付检查清单
3. 逐项验证，每项标记 [√] 并附带证据，不适用的项标记 [-] 并说明原因
4. 有未通过项 → 修复后重新检查
5. 全部通过 → 才能报告完成

未经门控就报告完成 = 违反 HelloAGENTS 核心规则。

## 技能加载规则（渐进式披露）

技能分三层加载，严格按需，不提前读取：

Layer 1 — 元数据（启动时已知，不需要读取文件）：
仅凭下方列表中的名称和描述判断技能是否可能相关。

Layer 2 — 完整技能（进入对应阶段时读取 SKILL.md）：
当任务进入某个阶段且该阶段需要某技能的规范时，才读取该技能的 SKILL.md。

Layer 3 — 资源文件（技能内引用时读取）：
技能 SKILL.md 中引用的 templates/、modules/*.md 等文件，仅在技能明确要求时读取。

禁止行为：
- 禁止在 ORIENT/CLARIFY 阶段读取实现类技能（hello-ui/hello-test/hello-verify 等）
- 禁止因为"可能用到"就提前读取技能文件——等到真正需要时再读
- ~command 命令只读取对应的 command SKILL.md，不连带读取其他技能

## 技能索引（仅元数据）

### 编码时（EXECUTE 阶段按需读取）
- hello-ui — 构建 UI/页面/组件时
- hello-api — 构建/修改 API 时
- hello-data — 数据库/迁移/事务时
- hello-security — 涉及认证/密钥/权限时
- hello-errors — 错误处理/日志/重试时
- hello-perf — 性能优化/查询/缓存时
- hello-arch — 重构/架构决策时
- hello-test — 编写测试时（TDD：EXECUTE 开始时读取）

### 特定场景（触发时读取）
- hello-debug — 调试错误/修复 bug/排查失败时
- hello-subagent — 使用子代理执行任务时
- hello-write — 撰写文档/报告/方案等非编码文本时
- hello-review — 审查代码/检查变更时

### 完成时（VALIDATE 阶段读取）
- hello-verify — 声称完成前（必定读取）
- hello-reflect — 符合触发条件时（详见 hello-reflect SKILL.md）

## 命令路由

用户使用 `~command` 时，读取对应 skill：
- `~auto` → skills/commands/auto/SKILL.md
- `~design` → skills/commands/design/SKILL.md
- `~prd` → skills/commands/prd/SKILL.md
- `~loop` → skills/commands/loop/SKILL.md
- `~init` → skills/commands/init/SKILL.md
- `~test` → skills/commands/test/SKILL.md
- `~verify` → skills/commands/verify/SKILL.md
- `~review` → skills/commands/review/SKILL.md
- `~commit` → skills/commands/commit/SKILL.md
- `~clean` → skills/commands/clean/SKILL.md
- `~help` → skills/commands/help/SKILL.md

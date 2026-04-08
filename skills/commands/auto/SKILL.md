---
name: ~auto
description: 自动选路命令 — 根据任务自动选择 ~idea / ~plan / ~build / ~verify / ~prd 的组合路径（~auto 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~auto <任务描述>

`~auto` 是自动选路命令。它根据任务类型、复杂度、风险等级与项目状态，自动在 `~idea`、`~plan`、`~build`、`~verify`、`~prd` 之间选择合适路径。
`~auto` 只做选路。路径一旦确定，立即读取对应 command skill 并按其流程执行。

## 铁律
- 不为了“自动化”而强行走重流程
- 复杂度与风险不足以支撑更重路径时，优先选更轻但能保证质量的路线
- `T3` 高风险或不可逆链路默认不直接进入 `~build`；优先先走 `~plan` 或 `~prd`，纯审查/纯验证请求才可先进入 `~verify`
- 选路一旦确定，立即读取对应 command skill，避免重复探索
- 选路不替代授权；涉及外部副作用或高风险不可逆操作时，仍遵守 bootstrap 的阻塞判定与确认规则
- 优先消费当前上下文已注入的 ROUTE / TIER、当前工作流约束与项目状态；不要在 `~auto` 内另建一套关键词路由表

## 流程

### 0. 当前工作流优先

- 若当前上下文已注入“当前工作流提示”或“当前工作流约束”，优先服从其中的推荐下一命令 / 主路径
- 默认原则：
  - 活跃方案包不完整或缺少任务清单 → 先 `~plan`
  - 活跃方案包仍在执行 → 先 `~build`，完成当前实现后再 `~verify`
  - 活跃方案包已闭合 → 先 `~verify` 或收尾
- 只有当用户明确要求换方向、重做方案，或现有方案已失效时，才偏离当前推荐重新规划

### 1. 选路

- 先按当前上下文里已注入的 ROUTE / TIER 语义约束判断，不依赖关键词命中做机械分流
- 若当前轮没有足够的注入约束，再结合以下信号补足判断：影响范围、风险等级、是否需要 artifact、是否已有活跃方案包、用户是否只想先比较方向
- 选路优先级：
  - 纯探索 / 点子 / 方向比较 → `~idea`
  - 明确要求验证 / 审查 / 跑检查 → `~verify`
  - 0 到 1 / 产品级 / 多维规格 → `~prd`
  - 多文件功能 / 架构变更 / 新项目规划 → `~plan`
  - 明确修复 / 小范围实现 / 现有方案落地 → `~build`

### 2. 按 Tier 校正

- `T0` → 保持在 `~idea`，不创建项目文件
- `T1` → 在 `~build` / `~verify` 间选择最短可交付路径
- `T2` → 需要 artifact 或范围未完全收敛时优先 `~plan`
- `T3` → 纯审查/验真走 `~verify`；其余默认 `~plan` 或 `~prd`，待方案与风险边界明确后再进入实现

### 3. 读取对应命令并执行

- 选中 `idea` → 读取 `skills/commands/idea/SKILL.md`
- 选中 `plan` → 读取 `skills/commands/plan/SKILL.md`
- 选中 `build` → 读取 `skills/commands/build/SKILL.md`
- 选中 `verify` → 读取 `skills/commands/verify/SKILL.md`
- 选中 `prd` → 读取 `skills/commands/prd/SKILL.md`

不要额外读取未选中的 command skill。

---
name: ~auto
description: 总控编排命令 — 自动选择 ~idea / ~plan / ~build / ~verify / ~prd 的组合路径（~auto 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~auto <任务描述>

`~auto` 是总控编排命令。它根据任务类型、复杂度、风险等级与项目状态，自动在 `~idea`、`~plan`、`~build`、`~verify`、`~prd` 之间选择合适路径。

本 skill 本身不承载具体实现规范；它的职责是选路。选定路径后，读取对应 command skill 并按其流程执行。

## 铁律
- 不为了“自动化”而强行走重流程
- 复杂度与风险不足以支撑更重路径时，优先选更轻但能保证质量的路线
- 选路一旦确定，立即读取对应 command skill，避免重复探索

## 流程

### 1. ROUTE / TIER

先判断 Delivery Tier，再决定走哪条命令路径：

- `T0`：只读探索、点子比较、方向发散
- `T1`：明确的小范围实现或显式验证
- `T2`：多文件功能、结构化规划、新项目
- `T3`：高风险或不可逆链路（权限、安全、支付、数据库、生产发布等）

高一档的 Tier 可以覆盖低一档的流程强度，不能反向降级。

### 2. 判断任务类型

按以下优先级判断：

- 纯探索 / 点子 / 方向比较 → `~idea`
- 明确要求验证 / 审查 / 跑检查 → `~verify`
- 0 到 1 / 产品级 / 多维规格 → `~prd`
- 多文件功能 / 架构变更 / 新项目规划 → `~plan`
- 明确修复 / 小范围实现 / 现有方案落地 → `~build`

### 3. 复杂度与风险校正

若初始判断仍不稳，使用以下信号校正：

- 影响范围：单文件 / 多文件 / 跨模块 / 跨系统
- 是否涉及新依赖、数据库 schema、权限、安全、发布链路
- 是否需要结构化 artifact 才能安全推进
- 是否已有活跃方案包
- 是否只是先想方向，不希望进入执行

### 4. 读取对应命令并执行

- 选中 `idea` → 读取 `skills/commands/idea/SKILL.md`
- 选中 `plan` → 读取 `skills/commands/plan/SKILL.md`
- 选中 `build` → 读取 `skills/commands/build/SKILL.md`
- 选中 `verify` → 读取 `skills/commands/verify/SKILL.md`
- 选中 `prd` → 读取 `skills/commands/prd/SKILL.md`

不要额外读取未选中的 command skill。

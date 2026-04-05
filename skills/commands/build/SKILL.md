---
name: ~build
description: 执行实现工作流 — 基于当前需求或现有方案包完成实现、验证与状态同步（~build 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~build [description]

`~build` 是执行实现命令。它负责读取现有需求、方案包与项目上下文，完成实现、局部验证、修复循环与状态同步。

## 铁律
- 默认先定位上下文与范围，再修改代码
- 已有方案包时，优先按方案包执行，不重复发明方案
- 没有运行验证，不能报告完成
- 遇到高风险或阻塞情况立即停下确认

## 流程

### 1. 恢复与定位（ROUTE / TIER）

- 优先读取 `.helloagents/STATE.md`
- 若存在最近的活跃方案包，读取对应的：
  - `requirements.md`
  - `plan.md`
  - `tasks.md`
- 按需读取 `.helloagents/context.md`、`.helloagents/guidelines.md`、`.helloagents/verify.yaml`
- 若任务涉及 UI，按以下优先级读取并遵循：当前活跃 `plan.md` / PRD 中的 UI 决策 > `.helloagents/DESIGN.md` > `hello-ui` 通用规则
- 若已激活项目且当前任务属于整页新建、设计系统改造、或跨多个组件的视觉重做，但 `.helloagents/DESIGN.md` 不存在，先按模板创建最小设计契约，再继续大规模实现

如果 `.helloagents/` 不存在：
- 创建最小 `.helloagents/` 与 `STATE.md`
- 仅补足执行当前任务所需的最小状态，不自动展开完整知识库

### 2. 需求与范围确认（SPEC）

- 若用户提供的是明确执行任务，直接确认范围
- 若当前活跃方案包已能覆盖需求，按方案执行
- 若仍存在真实歧义，仅询问阻塞执行的关键决策

### 3. 执行实现（BUILD）

- 根据任务拆解逐步修改
- 读取 PLAN 阶段所需的 hello-* 技能并遵循其规范
- 编码任务遵循：
  - 先补测试或最小验证手段，再写实现
  - 每次编辑后主动跑确定性检查
- 可并行任务通过子代理执行，但不同子代理不得改同一文件

### 4. 验证与修复循环（VERIFY）

- 读取 `hello-verify` SKILL.md
- 运行 lint / typecheck / test / build 等验证
- 若失败，修复后重跑
- 若涉及 review 场景，可按需读取 `hello-review`

### 5. 状态与交付同步（CONSOLIDATE）

- 重写 `.helloagents/STATE.md`
- 有方案包时同步任务状态
- 需要时同步知识库、`CHANGELOG.md`、modules 文档与反思
- 满足归档条件时交给 bootstrap 中的后续规则处理

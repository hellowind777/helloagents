---
name: ~build
description: 执行实现工作流 — 基于当前需求或现有方案包完成实现、验证与状态同步（~build 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~build [description]

`~build` 是执行实现命令。它负责读取现有需求、方案包与项目上下文，完成实现、局部验证、修复循环，并把结果交给后续验证与收尾。
执行 `~build` 时，通用阶段边界按当前已加载的 HelloAGENTS 规则执行；本 skill 负责补充实现前定位、实现约束，以及进入 `~verify` / 收尾前的实现边界。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：状态文件只使用 `state_path`；会话证据使用当前 `state_path` 所在目录下的 `artifacts/*.json`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md`、`verify.yaml` 与方案包按当前上下文中已注入的项目知识/方案目录解析。

## 铁律
- 默认先定位上下文与范围，再修改代码
- 已有方案包时，优先按方案包执行，不重复发明方案
- 没有运行验证，不能报告完成
- 遇到高风险或阻塞情况立即停下确认

## 流程

### 1. 恢复与定位

- 优先按当前已加载的 HelloAGENTS 规则恢复当前任务，并遵循“.helloagents/ 文件读取优先级”；若当前消息明确要继续上次任务、会话刚经历恢复 / 压缩，或本轮运行在 Codex active goal 下，先读取 `state_path`，再用当前用户消息、活跃方案包 / PRD 与代码事实确认当前任务
- 若存在最近的活跃方案包，读取对应的：
  - `requirements.md`
  - `plan.md`
  - `tasks.md`
  - `contract.json`
  - 实现时优先把 `tasks.md` 中每个任务的“完成标准”当作本轮实现约束，不要只按任务标题猜测范围
  - `contract.json` 存在时，优先按其中的 `verifyMode`、`reviewerFocus`、`testerFocus` 理解后续验证边界
- 若本轮运行在 Codex active goal 下，按 `tasks.md` 未完成项、`contract.json` 与 `state_path` 恢复实现位置；不要自动创建新 goal，也不要把 goal 目标原文替代方案包
- 若当前上下文中已注入“当前工作流约束”或“当前推荐下一命令”，先服从它；只有推荐仍为 `~build`，或用户明确提出新增实现范围时，才继续 `~build`
- 其余项目知识库与相关代码文件，按 HelloAGENTS 项目上下文要求读取
- 若任务涉及 UI，按以下优先级读取并遵循：当前活跃 `plan.md` / PRD 中的 UI 决策 > 逻辑 `.helloagents/DESIGN.md`（实际路径按当前项目存储模式解析） > 已读取的 `hello-ui` 规则；同时所有 UI 任务都必须满足 UI 质量基线
- 若已激活项目且当前任务属于整页新建、设计系统改造、或跨多个组件的视觉重做，但逻辑 `.helloagents/DESIGN.md` 不存在，先按模板创建最小设计契约，再继续大规模实现

如果 `.helloagents/` 不存在：
- 按当前已加载的 HelloAGENTS 规则创建 `.helloagents/` 与最小流程状态
- 仅补足执行当前任务所需的最小状态，不自动展开完整知识库

### 2. 需求与范围确认

- 若用户提供的是明确执行任务，直接确认范围
- 若当前活跃方案包已能覆盖需求，按方案执行
- 若仍存在真实歧义，仅询问阻塞执行的关键决策

### 3. 执行实现

- 根据任务拆解逐步修改
- 按当前实现需要读取对应的 hello-* 技能，并遵循其规范
- 编码任务遵循：
  - 先补测试或最小验证手段，再写实现
  - 每次编辑后主动跑确定性检查
- 可并行任务通过子代理执行，但不同子代理不得改同一文件

### 4. 验证与修复循环

- 读取 `hello-verify` SKILL.md
- 运行 lint / typecheck / test / build 等验证
- 若失败，修复后重跑
- 若涉及 review 场景，可按需读取 `hello-review`

### 5. 交付前处理

- 有方案包时，只同步本次实现直接影响的任务状态；未完成项保持打开
- 当前实现已闭合、且需要进入交付或收尾时，转入 `~verify`
- 若 Codex active goal 仍有未完成 AFK 任务，继续下一项可执行任务；若目标已满足，先转入 `~verify` 与 HelloAGENTS 收尾，再标记 goal complete
- 状态文件、知识库、`CHANGELOG.md`、modules 文档与归档边界，按当前已加载的 HelloAGENTS 规则进入 VERIFY / CONSOLIDATE
- 不在 `~build` 内把仍未闭合的方案包整体报告为已完成

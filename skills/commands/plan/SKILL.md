---
name: ~plan
description: 结构化规划工作流 — 需求澄清、方案确认、任务分解与方案包生成（~plan 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~plan [description]

`~plan` 是实现前的主规划命令。它负责需求澄清、方案设计、任务拆解与方案写入；直接显式执行 `~plan` 时，默认停在“形成可执行方案”，只有用户明确授权继续时才继续执行。
执行 `~plan` 时，通用阶段边界按当前已加载 bootstrap 执行；本 skill 负责补充 `~plan` 的需求澄清、方案确认、方案包写入与继续执行要求。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：状态文件只使用 `state_path`；会话证据使用当前 `state_path` 所在目录下的 `artifacts/*.json`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md` 与 `plans/` / `archive/` 按当前上下文中已注入的项目知识/方案目录解析。

## 铁律
- 在用户确认方案之前，禁止编写任何实现代码、创建任何实现文件、或执行任何实现操作
- 需求澄清阶段不读取实现类技能（hello-ui / hello-test / hello-verify 等），需求明确后再按需读取
- 方案必须整理为可执行产物，不停留在泛化建议
- 若当前任务来自 `~auto`，则“开始执行”视为已包含在 `~auto` 授权内；方案包写入后默认继续执行，只有命中阻塞判定时才停下。`~design` 是 `~plan` 的兼容别名，只有在 `~auto` 内触发其语义时才默认继续进入 `~build`
- 涉及 UI 时，当前方案包中的 UI 决策优先于 `.helloagents/DESIGN.md`；`.helloagents/DESIGN.md`（按当前项目存储模式解析）优先于通用 UI 规则

## 流程

### 1. 上下文收集与需求澄清准备

已有项目：
- 按当前已加载 bootstrap 的“.helloagents/ 文件读取优先级”和“项目文件”规则恢复上下文；若当前消息明确要继续上次任务，或会话刚经历恢复 / 压缩，先读取 `state_path`，再用当前用户消息、显式命令、活跃方案包 / PRD 与代码事实确认当前任务
- 在需求澄清前，至少确认 `.helloagents/context.md`、`.helloagents/guidelines.md`（按当前项目存储模式解析）；涉及 UI 时，如存在 `.helloagents/DESIGN.md`（按当前项目存储模式解析），一并读取现有设计契约
- 只扫描与当前需求直接相关的代码文件，用于形成假设和识别约束

全新项目（无 `.helloagents/` 目录）：
- 跳过项目级上下文读取，直接进入需求澄清

### 2. 需求澄清

目标：通过自然对话明确目的、约束、成功标准与验收边界。

根据项目类型选择模式：

**假设模式**（已有代码库，优先使用）：
- 先读取 5-15 个相关文件，基于代码证据形成假设
- 用 2-4 轮确认关键假设
- 低置信度假设必须明确询问
- 发现用户用词与 `.helloagents/context.md` 的领域语言冲突时，立即澄清并统一术语

**交互模式**（全新项目或信息不足）：
- 每次只问一个问题，优先使用选择题
- 只确认真正影响执行路径的关键决策
- 每个问题给出推荐选项和理由

涉及视觉/交互/体验的问题时：
- 选项必须体现当前前沿水准
- 每个选项都要有具体、可执行的视觉特征描述

### 3. 方案确认

基于已确认需求，给出 2-3 个可行方案：
- 每个方案说明架构思路与关键取舍
- 标注推荐方案及理由
- 让用户选择或修正

涉及 UI 的方案：
- 读取 `hello-ui` SKILL.md
- 将视觉、交互、设计系统要求纳入方案
- 区分“本次 feature 的 UI 决策”和“项目级稳定设计契约”：前者写入 `plan.md`，后者同步到 `.helloagents/DESIGN.md`（按当前项目存储模式解析）

### 4. 方案细化

用户确认方向后，一次性输出完整可执行方案：
- 架构与文件结构
- 完成定义（功能完成时必须为真的条件、关键验收点、验证主路径= `test-first` 或 `review-first`、reviewer / tester 各自要验证什么）
- 数据流与错误处理
- 验证策略
- 涉及 UI 时的设计方向、状态覆盖与 `DESIGN.md` 更新点
- 涉及项目特有概念时，同步确认标准术语、避免用语和关键关系，必要时更新 `.helloagents/context.md` 的“领域语言”区块（按当前项目存储模式解析）

### 5. 写入方案包

将确认的方案写入本地项目：
- 按当前已加载 bootstrap 的 `.helloagents/` 与流程状态规则，确保最小项目状态已建立
- 创建方案包目标目录：`.helloagents/plans/YYYYMMDDHHMM_{feature}/`（按当前项目存储模式解析；repo-shared 时写入当前项目方案目录）
- 以 `{HELLOAGENTS_READ_ROOT}/templates/plans/` 为源模板，在上述方案包目标目录内写入：
  - `requirements.md`
  - `plan.md`
  - `tasks.md`
  - `contract.json`
- 写 `contract.json` 时，至少落成以下字段：`verifyMode`、`reviewerFocus`、`testerFocus`；涉及 UI 时再写 `ui.required`、`ui.designContract` 与 `ui.sourcePriority`
- 只有在 UI 方向确需先明确时，才额外写 `ui.styleAdvisor.required`、`ui.styleAdvisor.reason` 与 `ui.styleAdvisor.focus`；它复用当前会话 `artifacts/advisor.json`，不是默认常驻步骤
- 只有在 UI 验收确有收益时，才额外写 `ui.visualValidation.required`、`ui.visualValidation.reason`、`ui.visualValidation.screens` 与 `ui.visualValidation.states`；不要把视觉验收扩成所有 UI 任务的固定步骤
- 只有在 `T3`、非 UI 的高风险审查或确需额外跨模型建议时，才写 `advisor.required`、`advisor.reason`、`advisor.focus` 与 `advisor.preferredSources`；不要把 advisor 变成默认常驻流程
- 使用 `scripts/plan-contract.mjs write` 写 `contract.json`，不要让后续检查脚本再从 `plan.md` 的自然语言说明里猜验证主路径
- 在 `tasks.md` 中保留 “Codex /goal 执行入口”，内容必须引用当前方案包路径、AFK/HITL 边界、完成前验证与 HelloAGENTS 收尾；不要把普通 PRD 原文当作 `/goal` 目标
- 涉及 UI 的项目：生成或更新 `.helloagents/DESIGN.md`（按当前项目存储模式解析）；若原文件不存在，先按模板建立最小设计契约，再写入已确认的稳定设计决策
- 重写 `state_path`，其中“主线目标”写本次规划要完成的目标，不保留其他任务的内容

知识库完整创建与归档按当前已加载 bootstrap 的后续规则执行。

### 6. 执行决策

展示方案摘要后，仅在是否进入执行仍构成阻塞决策时才询问用户：
- 开始执行 → 继续进入 `~build`
- 修改方案 → 返回方案细化
- 暂不执行，保留方案 → 更新 `state_path`；“主线目标”写当前已确认方案要解决的问题，下一步写为“方案已确认；执行需用户明确启动”

如果用户已明确表示继续执行，则视为授权成立，可直接继续执行。
如果当前任务来自 `~auto`，且方案包已足够支撑实现、也未命中阻塞判定，则默认直接进入 `~build`，不再追加一次“是否开始执行”的询问。
如果当前任务是显式 `~plan` 或 `~design`，且尚未获得执行授权，最终收尾必须按当前 bootstrap 输出格式使用 `❓【HelloAGENTS】- 等待输入`（`output_format=false` 时保持自然输出），并在 `🔄 下一步` 写清待确认的执行动作。

## 方案包要求

方案包中的 `tasks.md` 必须满足：
- 每个任务默认是端到端垂直切片，能交付一个可验证行为；除非确有技术前置，否则不按“数据库 / API / UI / 测试”横向拆分
- 每个任务标注 `AFK` 或 `HITL`：`AFK` 表示代理可独立完成，`HITL` 表示需要用户决策、外部凭据、人工视觉确认或手动验收
- 明确文件路径、预期变更、完成标准、验证方式与依赖关系
- 每个任务可独立验证；厚任务必须拆成更薄的可验收切片
- “Codex /goal 执行入口”只作为长程执行提示，不计入任务列表；入口必须让 Codex 按已拆好的 `tasks.md` 执行，而不是直接消费未拆分需求文档

方案包中的 `contract.json` 必须满足：
- `verifyMode` 只能是 `test-first` 或 `review-first`
- `testerFocus` 必填
- `review-first` 时 `reviewerFocus` 必填
- 涉及 UI 时显式写出 UI 契约来源优先级
- 若启用 `ui.styleAdvisor`，必须写清触发原因与 focus
- 若启用 `ui.visualValidation`，必须写清触发原因，以及至少一组关键 screens 或 states
- 仅在明确需要独立 advisor 时，才填写 advisor 区块；填写后必须写清触发原因、focus 与优先来源

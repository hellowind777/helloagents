---
name: ~prd
description: 完整 PRD 生成 — 头脑风暴式交互，逐维度挖掘，生成现代产品需求文档（~prd 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~prd [description]

执行 `~prd` 时，不读取 `~plan` 的 command skill；只有当前流程明确需要时，才继续读取对应的 hello-* 技能。
执行 `~prd` 时，通用阶段边界按当前已加载的 HelloAGENTS 规则执行；本 skill 负责补充规格探索、PRD 写入与继续执行要求。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：状态文件只使用 `state_path`；会话证据使用当前 `state_path` 所在目录下的 `artifacts/*.json`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md` 与 `plans/` / `archive/` 按当前上下文中已注入的项目知识/方案目录解析。

## 铁律
- 在用户确认方案之前，禁止编写任何实现代码、创建任何文件、或执行任何实现操作。
- 每个维度的选项必须体现当前前沿水准。若当前已加载的 HelloAGENTS 规则含审美/体验要求则遵循其要求；否则至少给出具体、可执行、非泛化的视觉特征，不确定时主动搜索查阅。
- 用户说"跳过"某维度 → 跳过，不生成该文件。不强迫用户讨论不关心的维度。
- 大项目检测：涉及多个独立子系统时，先帮用户分解为子项目，每个子项目走独立的 ~prd 循环。
- 若当前任务来自 `~auto`，则 PRD / 任务 / 契约写入后默认继续执行；只有真实阻塞时才停在规格阶段。
- 涉及 UI 时，`prd/03-ui-design.md` 负责记录本次产品/功能的 UI 决策；项目级稳定设计契约同步写入 `.helloagents/DESIGN.md`（按当前项目存储模式解析）

## PRD 维度清单

按编号排列，每个维度对应一个模板文件（templates/plans/prd/）：

| 编号 | 文件 | 维度 | 说明 |
|------|------|------|------|
| 00 | 00-overview.md | 产品概述 | 愿景、用户画像、痛点、成功指标、范围与非目标 |
| 01 | 01-user-stories.md | 用户故事 | 用户旅程、故事列表、边缘场景、验收标准 |
| 02 | 02-functional.md | 功能需求 | 功能清单(MoSCoW)、业务规则、数据模型、API 契约、状态机 |
| 03 | 03-ui-design.md | UI/UX 设计 | 设计风格、Token、布局、组件、动效、暗色模式、设计约束 |
| 04 | 04-technical.md | 技术架构 | 技术选型、架构图、文件结构、依赖、数据库、ADR |
| 05 | 05-nonfunctional.md | 非功能需求 | 性能、安全、可用性、可扩展性、可观测性 |
| 06 | 06-i18n-l10n.md | 国际化与本地化 | 语言列表、文本外部化、RTL、格式化、文化适配 |
| 07 | 07-accessibility.md | 无障碍 | WCAG 级别、键盘导航、屏幕阅读器、对比度、动效减弱 |
| 08 | 08-content.md | 内容策略 | 文案风格、错误信息、空状态、帮助文档、SEO |
| 09 | 09-testing.md | 测试策略 | 测试金字塔、关键场景、性能测试、兼容性矩阵 |
| 10 | 10-deployment.md | 部署与运维 | 环境规划、CI/CD、发布策略、回滚、配置管理、数据迁移 |
| 11 | 11-legal-privacy.md | 法律与隐私 | GDPR/CCPA、用户同意、数据保留、第三方共享、许可证 |
| 12 | 12-timeline.md | 里程碑 | 阶段划分(MVP/V1/V2)、里程碑、依赖与风险、资源需求 |

## 维度激活矩阵

根据项目类型自动判断维度优先级（必选/推荐/可选）：

| 项目类型 | 必选 | 推荐 | 可选 |
|---------|------|------|------|
| Web App | 00,01,02,03,04,09 | 05,06,07,08 | 10,11,12 |
| Mobile App | 00,01,02,03,04,07,09 | 05,06,08 | 10,11,12 |
| API/Backend | 00,02,04,05,09 | 10,11 | 01,08,12 |
| CLI Tool | 00,02,04,09 | 05,08 | 10,12 |
| Library/SDK | 00,02,04,09 | 08 | 05,10,12 |
| 桌面应用 | 00,01,02,03,04,09 | 05,07,08 | 06,10,11,12 |
| 游戏 | 00,01,02,03,04,09 | 05,08 | 10,12 |
| 混合 | 取各子类型的并集 | — | — |

## 流程

### 1. 上下文收集

已有项目：
- 按当前已加载的 HelloAGENTS 规则恢复上下文，并遵循“.helloagents/ 文件读取优先级”和“项目文件”要求；若当前消息明确要继续上次任务，或会话刚经历恢复 / 压缩，先读取 `state_path`，再用当前用户消息、显式命令、活跃方案包 / PRD 与代码事实确认当前任务
- 在进入维度探索前，至少确认 `.helloagents/context.md`、`.helloagents/guidelines.md`，并只扫描与当前产品范围直接相关的代码和配置
- 若 `.helloagents/context.md` 已有领域语言，PRD 中统一沿用；发现术语冲突或歧义时，先澄清再写入

全新项目（无 .helloagents/ 目录）：
- 跳过，直接进入项目定位

### 2. 项目定位（快速，1-2 轮）

目标：快速锁定项目类型和 PRD 范围。

a. 理解用户的初始描述
b. 确认项目类型（Web App / Mobile / API / CLI / Library / 桌面 / 游戏 / 混合）
c. 根据维度激活矩阵，列出本项目的必选/推荐/可选维度
d. 询问用户：推荐维度是否需要？可选维度是否需要？
e. 确定最终的维度列表

### 3. 维度探索（头脑风暴，核心阶段）

按维度编号顺序，逐个展开讨论。每个维度的交互模式：

a. AI 先给出该维度的行业最佳实践参考和推荐方案
b. 用户确认/修改/补充
c. AI 总结该维度的决策结果，进入下一个维度

交互原则：
- 每个维度内，每次只问一个问题，偏好选择题
- 用户说"跳过" → 跳过该维度，不生成对应文件
- 用户说"默认" → AI 按推荐方案填充，快速过
- 用户说"展开" → 深入讨论该维度的子项
- 维度之间可以回溯：用户说"回到 03" → 重新讨论 UI/UX 设计
- 涉及项目特有概念时，确认标准术语、避免用语和关键关系；不要把泛化技术词写入领域语言

选项质量要求：
- 涉及视觉/交互/体验的问题时，选项必须体现当前前沿设计水准
- 不确定当前前沿趋势时，主动搜索查阅最新设计案例和技术能力后再给出选项
- 每个选项必须包含具体的视觉特征描述，不接受泛化标签

### 4. 写入方案包

将讨论结果写入本地项目：
- 按当前已加载的 HelloAGENTS 规则建立 `.helloagents/` 与最小流程状态；这是方案包写入的前置操作，不受 kb_create_mode 开关控制
- 创建 `.helloagents/plans/YYYYMMDDHHMM_{feature}/prd/`（按当前项目存储模式解析）
- 按 templates/plans/prd/ 的模板格式，仅写入用户未跳过的维度文件
- 生成 tasks.md（每个任务默认是端到端垂直切片，标注 AFK / HITL、依赖、具体文件路径、预期变更、完成标准与验证方式；任务独立可验证）
- 在 `tasks.md` 中保留 “Codex /goal 执行入口”，让 Codex 按已拆分任务、验收边界和 `contract.json` 执行；不要把完整 PRD 原文直接当作 `/goal` 目标
- 生成 decisions.md（贯穿全程的决策日志）
- 生成 `contract.json`（至少包含 `verifyMode`、`reviewerFocus`、`testerFocus`；涉及 UI 时补 `ui.required`、`ui.designContract`、`ui.sourcePriority`；仅在确需先明确审美方向时再补 `ui.styleAdvisor.required`、`ui.styleAdvisor.reason`、`ui.styleAdvisor.focus`；仅在确需视觉验收时再补 `ui.visualValidation.required`、`ui.visualValidation.reason`、`ui.visualValidation.screens`、`ui.visualValidation.states`；仅在确需独立 advisor 时，再补 `advisor.required`、`advisor.reason`、`advisor.focus`、`advisor.preferredSources`）
- 使用 `scripts/plan-contract.mjs write` 写 `contract.json`，不要只把验证路径留在自然语言说明里
- 涉及 UI 的项目：生成或更新 `.helloagents/DESIGN.md`（按当前项目存储模式解析）；若原文件不存在，先按模板建立最小设计契约，再同步已确认的稳定 UI 决策
- 重写 `state_path`，其中“主线目标”写本次 PRD 要完成的产品 / 功能目标，不保留其他任务的内容

输出 PRD 完整度摘要：已覆盖 N/13 个维度，建议后续补充的维度（如有）。

### 5. 执行决策

展示 PRD 摘要后，仅在是否进入执行仍构成阻塞决策时才询问用户：
- 开始执行 → 重写 `state_path`（“主线目标”保持当前 PRD 目标，下一步设为第一个任务的具体动作）
- 修改 PRD / 补充维度 → 回到对应维度继续讨论
- 暂不执行，保留方案 → 重写 `state_path`（“主线目标”保持当前 PRD 目标，下一步设为“方案已确认；执行需用户明确启动”）

如果用户已对当前 PRD 或继续执行作出明确同意，视为执行授权成立，可直接进入执行，或按需先补一轮 `~plan` 明确实现方案。
如果当前任务来自 `~auto`，且 PRD 已整理成可执行任务、也未命中阻塞判定，则默认继续进入 `~build`，必要时先补一轮轻量 `~plan`，不再额外询问一次“是否开始执行”。
如果当前任务是显式 `~prd`，且尚未获得执行授权，最终收尾必须使用完整 HelloAGENTS 外层格式（`output_format=false` 时保持自然输出）：首行使用 `❓【HelloAGENTS】- 等待输入`，正文说明 PRD / 任务 / 契约结果，末行以 `🔄 下一步: ...` 写清待确认动作。

### 6. 继续执行

按 tasks.md 逐项完成，每项进入当前已加载的 HelloAGENTS 统一执行流程，完成后同步重写 `state_path`。
任务状态标记仅写入 tasks.md、验收清单或验证结果；普通说明、方案解释、状态汇报不用 [√] / [-] / [ ]。
所有任务完成后进入当前已加载的 HelloAGENTS VERIFY / CONSOLIDATE 收尾阶段。
可并行的任务标记后用子代理并行执行（不同子代理不改同一文件）。
执行过程中遇到阻塞（依赖缺失、指令不清、验证反复失败）→ 立即停下询问用户，不猜测。
执行过程中遇到高风险操作（删除文件/修改配置/数据库变更）→ 暂停确认。

## 方案包结构

~prd 生成的方案包结构：

```
plans/YYYYMMDDHHMM_{feature}/
├── prd/                    # PRD 文档（按维度生成）
│   ├── 00-overview.md
│   ├── 01-user-stories.md  # 仅用户未跳过的维度
│   ├── 02-functional.md
│   └── ...
├── contract.json           # 机器可消费的验证 / 审查契约
├── tasks.md                # 端到端垂直切片任务
└── decisions.md            # 决策日志
```

## 文档限制

| 文件类型 | 上限 |
|---------|------|
| 单个维度文件（prd/*.md） | ≤150 行 |
| tasks.md | ≤100 行 |
| decisions.md | ≤80 行 |
| 方案包总计 | ≤1500 行 |

- 只记录决策和约束，不记录讨论过程
- 用表格和列表，不用段落叙述
- 单文件超限 → 拆分为子文件（如 `02-functional-api.md`），主文件保留摘要和链接

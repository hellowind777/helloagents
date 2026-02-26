<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**一个会持续推进到实现与验证完成的多 CLI 工作流系统。**

[![Version](https://img.shields.io/badge/version-2.2.15-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/workflow_commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

## 目录

- [为什么选择 HelloAGENTS](#为什么选择-helloagents)
- [与旧仓库相比有哪些变化](#与旧仓库相比有哪些变化)
- [功能特性](#功能特性)
- [前后对比（贪吃蛇示例）](#前后对比贪吃蛇示例)
- [快速开始](#快速开始)
- [工作原理](#工作原理)
- [仓库结构说明](#仓库结构说明)
- [聊天内工作流命令](#聊天内工作流命令)
- [FAQ](#faq)
- [故障排除](#故障排除)
- [版本历史](#版本历史)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 为什么选择 HelloAGENTS

很多助手可以分析任务，但经常在真正交付前停下。HelloAGENTS 增加了严格的路由、阶段执行和验收闸门。

| 挑战 | 没有 HelloAGENTS | 使用 HelloAGENTS |
|---|---|---|
| 停在方案阶段 | 只给建议 | 推进到实现与验证 |
| 输出格式漂移 | 每次结构可能变化 | 统一路由和阶段链 |
| 高风险操作 | 容易误执行破坏命令 | EHRB 风险检测与升级拦截 |
| 知识连续性 | 上下文容易散落 | 内置知识库与会话记忆 |
| 可复用性 | 依赖一次性提示词 | 命令化工作流可复用 |

<div align="center">
  <img src="./readme_images/06-divider.svg" width="420" alt="divider">
</div>

## 与旧仓库相比有哪些变化

相较于旧版多 bundle 发布形态，v2.x 已转为 package-first 形态，架构也发生了根本性变化。

| 维度 | 旧仓库 | 当前仓库 |
|---|---|---|
| 分发形态 | 多 bundle 目录，每个 CLI 一份 | 统一 Python 包 + 安装器 CLI |
| 安装方式 | 手工复制配置与技能目录 | pip/uv 安装 + `helloagents` 交互菜单 |
| 路由系统 | 三层路由（Context → Tools → Intent） | 五维度评分路由（R0–R3） |
| 工作流阶段 | 4 阶段（Evaluate、Analyze、Design、Develop） | 3 阶段（Evaluate、Design、Develop）+ R1 快速流程，支持子代理调度 |
| 代理系统 | 无 | RLM 5 个专有角色 + 原生子代理 + Session 隔离 |
| 记忆系统 | 无持久化 | 三层记忆：L0 用户、L1 项目知识库、L2 会话 |
| 安全检测 | 基础 EHRB | 三层 EHRB（关键词 + 语义 + 工具输出） |
| Hooks | 无 | 自动部署生命周期钩子（Claude Code 9 事件 + Codex CLI notify） |
| 目标 CLI | 5 个 | 6 个：codex、claude、gemini、qwen、grok、opencode |
| 工作流命令 | 12 个 | 15 个 |

> ⚠️ **迁移提醒：** 由于 v2.x 的仓库结构与安装方式已调整，旧版本已迁移到归档仓库：**helloagents-archive**
> https://github.com/hellowind777/helloagents-archive

## 功能特性

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**RLM 子代理编排**

5 个专有角色（reviewer、synthesizer、kb_keeper、pkg_keeper、writer）+ 宿主 CLI 原生子代理（探索/实现/测试/设计）按任务复杂度自动调度，每个 CLI 实例独立 Session 隔离。任务通过 DAG 依赖分析按层并行派发。支持跨 CLI 并行调度和 Agent Teams 协作模式。

**收益：** 复杂任务由对口专家角色分工处理，支持并行执行提升效率。
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**五维度路由（R0–R3）**

每条输入按动作需求、目标定位度、决策需求、影响范围、EHRB 风险五个维度评分，路由到 R0 直接响应、R1 快速流程、R2 简化流程或 R3 标准流程。

**收益：** 简单问题秒回，复杂任务走完整流程。
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**三层安全检测（EHRB）**

关键词扫描、语义分析、工具输出检测三层拦截破坏性操作，交互模式和委托模式均强制用户确认。

**收益：** 零配置的默认安全保护。
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**三层记忆模型**

L0 用户记忆（全局偏好）、L1 项目知识库（代码变更自动同步）、L2 会话摘要（阶段切换时自动持久化）。

**收益：** 上下文跨会话、跨项目延续。
</td>
</tr>
</table>

### 可核验数据

- 6 个 CLI 目标来自 helloagents/cli.py
- 15 个工作流命令来自 helloagents/functions
- 5 个 RLM 角色来自 helloagents/rlm/roles
- 2 个阶段定义来自 helloagents/stages
- 5 个核心服务来自 helloagents/services
- 4 个规则模块来自 helloagents/rules
- 9 个辅助脚本来自 helloagents/scripts
- 2 个 Hooks 配置来自 helloagents/hooks
- 10 个知识库/方案模板来自 helloagents/templates

## 前后对比（贪吃蛇示例）

<table>
<tr>
<td width="50%" valign="top" align="center">

**Without HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="Snake demo without HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**With HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="Snake demo with HelloAGENTS" width="520">

</td>
</tr>
</table>

## 快速开始

### 方式 A：一键安装脚本（推荐）

**macOS / Linux：**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell：**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> 脚本会自动检测 `uv` 或 `pip` 安装 HelloAGENTS 包，安装完成后自动弹出交互菜单，按提示选择目标 CLI 即可。重复执行等同于更新。

**更新：**

    helloagents update

### 方式 B：npx（Node.js >= 16）

    npx helloagents

> 安装 Python 包后自动弹出交互菜单。也可以直接指定：`npx helloagents install codex`（或使用 `npx -y` 自动下载安装，无需确认）

> 需要 Python >= 3.10。首次安装后，直接使用原生 `helloagents` 命令即可。

> **致谢：** 感谢 @setsuna1106 慷慨转让 npm `helloagents` 包所有权。

### 方式 C：UV（隔离环境）

**第 0 步 — 先安装 UV（已安装可跳过）：**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> 安装 UV 后请重启终端，使 `uv` 命令生效。

> ⚠️ Windows PowerShell 5.1 不支持 `&&` 连接符，请分开执行两条命令，或升级到 [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows)。

**安装并选择目标（一条命令）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> 安装包后自动弹出交互菜单，选择要安装的目标 CLI。也可以直接指定：`helloagents install codex`

**更新：**

    helloagents update

### 方式 D：pip（需要 Python >= 3.10）

**安装并选择目标（一条命令）：**

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents

> 安装包后自动弹出交互菜单，选择要安装的目标 CLI。也可以直接指定：`helloagents install codex`

**更新：**

    pip install --upgrade git+https://github.com/hellowind777/helloagents.git

### 安装到 CLI 工具

    helloagents                  # 交互菜单，按提示选择

    helloagents install codex    # 直接指定目标

    helloagents install --all    # 安装到所有已检测的 CLI

### 验证命令

    helloagents status

    helloagents version

### 卸载命令

    helloagents uninstall codex

    helloagents uninstall --all

### 清理缓存命令

    helloagents clean

### Codex CLI 示例

**首次安装：**

    # 一键脚本（推荐，装完自动弹出交互菜单）
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx（或使用 npx -y 自动下载安装）
    npx helloagents install codex

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install codex

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install codex

**后续更新（自动同步已安装目标）：**

    helloagents update

> ⚠️ **Codex CLI config.toml 兼容提示：** 以下设置可能影响 HelloAGENTS 正常运行：
> - `[features]` 中的 `steer = true` — 会改变输入提交行为，可能干扰工作流交互
> - `[features]` 中的 `child_agents_md = true` — 实验性功能，会注入额外指令，可能与 HelloAGENTS 冲突
> - `project_doc_max_bytes` 过小 — 默认 32KB，AGENTS.md 超出会被截断（安装时已自动调整为 131072）
> - `agent_max_depth = 1` — 限制子代理嵌套深度，建议保持默认或设为 ≥2
> - `agent_max_threads` 过小 — 默认 6，过低会限制并行子代理调度
> - `[features]` 中的 `multi_agent = true` — 需开启才能使用子代理编排功能
> - Collab 子代理调度为实验性特性，需 Codex CLI 开启特性门控后方可使用

### Claude Code 示例

**首次安装：**

    # 一键脚本（推荐，装完自动弹出交互菜单）
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx（或使用 npx -y 自动下载安装）
    npx helloagents install claude

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install claude

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install claude

**后续更新（自动同步已安装目标）：**

    helloagents update

> 💡 **Claude Code 子代理编排配置提示：**
> - 子代理（Task 工具）开箱即用，无需额外配置
> - Agent Teams 协作模式需设置环境变量：`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
> - 并行子代理数量由模型自动管理，无需用户配置上限

### Beta 分支

如需安装 `beta` 分支，在仓库 URL 后追加 `@beta`：

    # 一键脚本（装完自动弹出交互菜单）
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

    # npx（或使用 npx -y 自动下载安装）
    npx helloagents@beta

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents && helloagents

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git@beta && helloagents

## 工作原理

1. 安装包（脚本/pip/uv）并执行 `helloagents` 弹出交互菜单选择目标 CLI（也可直接 `helloagents install <target>`）。安装时自动部署 Hooks 和 SKILL.md。
2. 在 AI 聊天中，每条输入按五个维度评分并路由到 R0–R3。
3. R2/R3 任务进入阶段链：EVALUATE → DESIGN → DEVELOP。R1 快速流程直接处理单点操作。
4. RLM 根据任务复杂度调度原生子代理和专有角色。有依赖关系的任务通过 DAG 拓扑排序按层并行派发。
5. EHRB 在每个步骤扫描破坏性操作，高风险行为需用户明确确认。Hooks 可提供额外的工具调用前安全预检。
6. 三层记忆（用户 / 项目知识库 / 会话）跨会话保持上下文。
7. 阶段链完成后输出可验证结果，并可选同步知识库。

## 仓库结构说明

- AGENTS.md：路由与工作流协议
- SKILL.md：CLI 目标的技能发现元数据
- pyproject.toml：包元数据（v2.2.15）
- helloagents/cli.py：安装器入口
- helloagents/functions：工作流命令
- helloagents/stages：design、develop
- helloagents/services：knowledge、package、memory 等服务
- helloagents/rules：state、cache、tools、scaling 规则
- helloagents/rlm：角色库与编排辅助
- helloagents/hooks：Claude Code 与 Codex CLI 钩子配置
- helloagents/scripts：自动化脚本
- helloagents/templates：知识库与方案模板

## 聊天内工作流命令

这些命令运行在 AI 聊天中，不是系统终端命令。

| 命令 | 作用 |
|---|---|
| ~auto | 全自动工作流 |
| ~plan | 规划与方案包生成 |
| ~exec | 执行已有方案包 |
| ~init | 初始化知识库 |
| ~upgradekb | 升级知识结构 |
| ~clean / ~cleanplan | 清理工作流产物 |
| ~test / ~review / ~validatekb | 质量检查 |
| ~commit | 基于上下文生成提交信息 |
| ~rollback | 回滚工作流状态 |
| ~rlm | 角色编排命令（spawn / agents / resume / team） |
| ~status / ~help | 状态与帮助 |

## FAQ

- Q: 这是 Python CLI 还是提示词包？
  A: 两者都是。CLI 管安装，工作流行为由 AGENTS.md 与 helloagents 文档定义。

- Q: 应该安装哪个目标？
  A: 按你使用的 CLI 选择：codex、claude、gemini、qwen、grok、opencode。

- Q: 已有规则文件会怎样？
  A: 非 HelloAGENTS 文件会先备份再替换。

- Q: RLM 是什么？
  A: Role Language Model — 子代理编排系统，5 个专有角色 + 原生子代理，支持 DAG 并行调度与标准化 prompt/返回格式。

- Q: 工作流知识库存在哪里？
  A: 项目内 `.helloagents/` 目录，代码变更时自动同步。

- Q: 记忆能跨会话保持吗？
  A: 能。L0 用户记忆全局共享，L1 项目知识库按项目存储，L2 会话摘要在阶段切换时自动保存。

- Q: Hooks 是什么？
  A: 安装时自动部署的生命周期钩子。Claude Code 支持 9 个事件钩子（安全预检、进度快照、KB 同步等），Codex CLI 支持 notify 钩子（版本更新检查）。全部可选，无 Hooks 环境下功能正常降级。

- Q: Agent Teams 是什么？
  A: Claude Code 实验性多代理协作模式。多个 Claude Code 实例作为 teammates 协作，共享任务列表和邮箱通信，映射到 RLM 角色体系。不可用时自动退回标准 Task 子代理模式。

## 故障排除

- command not found：确认安装路径已加入 PATH
- package version unknown：先安装包获取元数据
- target not detected：先启动目标 CLI 生成配置目录
- custom rules overwritten：在 CLI 配置目录中使用时间戳备份恢复
- images not rendering：保持相对路径并提交 readme_images 目录

## 版本历史

### v2.2.15（当前版本）

- 重构评估维度体系，新增维度隔离规则，合格门槛调优至 8/10。选项以用户需求为导向，按风格方向而非复杂度分级（如 UI 设计提供不同风格而非简单/中等/复杂）；推荐项指向最完整的成果方案，由推荐原则与评分标准推导生成而非硬编码
- 方案构思要求实现路径与成果设计方向同时差异化，子代理独立输出含呈现方向/风格/体验的完整方案
- 方案评估标准优化：用户价值权重始终不低于其他单项，评估维度按项目上下文动态调整
- 全任务类型适配：评估、追问、方案设计的术语从编程专用泛化至文档、设计、常规任务等全场景
- 新增子代理 DAG 依赖调度，任务按拓扑排序分层并行派发，支持失败传播
- 子代理并行数量动态化，按独立工作单元数自动决定，消除硬编码上限
- 统一输出格式规范，评分明细、追问选项、确认信息结构化显示
- 精简执行路径，缩短阶段链路径，模块按需加载粒度细化至步骤级
- Codex CLI memory 上限调整为 128 KiB，防止规则文件被截断
- 优化推荐选项生成规则、方案差异化要求与评估评分标准

### v2.2.14

- 任务执行 DAG 依赖调度（depends_on、拓扑排序、按层并行派发+失败传播）
- 分级重试与子代理标准返回格式，含 scope 校验
- 子代理编排范式：四步法、prompt 模板、行为约束（路由跳过、输出格式）
- 执行路径明确化：R1 升级触发条件显式化、DESIGN 重试上限、DEVELOP 入口/出口条件
- 工作流规则审计：术语与格式一致性修正、冗余内容清理

### v2.2.13

- R3 方案构思默认≥3 并行，并行批次上限调整为≤6，明确子代理数量原则（数量=独立工作单元数，禁止模糊用词），README 新增子代理编排配置提示

### v2.2.12

- 全面并行化子代理编排，G10 扩展覆盖所有流程和命令，消除硬编码子代理数量，新增通用并行信息收集原则

### v2.2.11

- 三阶段门控模型重构，合并分析到设计阶段（评估→设计→开发），优化标准流程停顿点并修复子代理编排一致性

### v2.2.10

- 精简子代理角色，对接各 CLI 原生多代理编排

### v2.2.9

- Windows 文件锁定全面修复，安装/更新/卸载/清理均支持预防性解锁和重命名旁路

### v2.2.8

- Codex CLI 注意力优化，使其更稳定的按照helloagents运行

### v2.2.7

- **G12 Hooks 集成规范：** Claude Code 9个生命周期钩子 + Codex CLI notify 钩子
- **Hooks 自动部署：** 安装/卸载时自动部署和清理 Hooks 配置，无需手动复制
- **Codex CLI 原生子代理：** G10 新增 spawn_agent 调用协议和跨CLI并行调度规则
- **Agent Teams 协议：** G10 新增 Claude Code 多角色协作协议
- **SKILL 技能集成：** SKILL.md 自动部署到所有 CLI 目标的技能发现目录
- **RLM 命令扩展：** 新增 ~rlm agents/resume/team 子命令，支持多角色并行调度
- **阶段并行优化：** develop 阶段新增并行规则，design 阶段串行标注
- **Memory v2 桥接：** 新增 Codex Memory v2 桥接协议
- **脚本模块化：** 提取 config_helpers.py 模块

### v2.2.5

- **RLM 子代理系统：** 5 个专有角色 + 原生子代理，自动调度 + Session 隔离
- **五维度路由（R0–R3）：** 替代旧版三层路由
- **三阶段工作流 + R1 快速流程：** 阶段链（评估→设计→开发）与 R1 快速流程并行
- **三层记忆：** L0 用户偏好、L1 项目知识库、L2 会话摘要
- **三层 EHRB：** 关键词 + 语义 + 工具输出安全检测
- **Package-first 安装器：** pip/uv 安装 + `helloagents` 交互菜单
- **15 个工作流命令：** 新增 ~rlm、~validatekb、~status
- **6 个 CLI 目标：** 新增 OpenCode 支持
- **交互式安装菜单：** 一条命令多选目标 CLI
- **自动语言检测：** CLI 提示根据系统 locale 自动切换中英文
- **Windows 编码修复：** 全平台 UTF-8 安全的子进程处理
- **知识库服务：** 结构化项目文档，代码变更自动同步
- **注意力服务：** 活状态跟踪与进度快照

### v2.0.1（旧多 bundle 基线版本）

- 多 bundle 分发，手工复制安装
- 三层路由（Context → Tools → Intent）
- 4 个工作流阶段、12 个命令、5 个 CLI 目标
- 无子代理系统、无持久化记忆

## 参与贡献

贡献规则与 PR 清单见 CONTRIBUTING.md。

## 许可证

本项目采用双许可：代码遵循 Apache-2.0，文档遵循 CC BY 4.0。详见 [LICENSE.md](./LICENSE.md)。

---

<div align="center">

如果这个项目对你有帮助，欢迎点 Star。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持

</div>

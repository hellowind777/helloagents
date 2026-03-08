<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**让 AI 不止于分析，而是持续推进到实现与验证完成。**

[![Version](https://img.shields.io/badge/version-2.3.5-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> [!IMPORTANT]
> **需要旧版本的 HelloAGENTS？** 旧版代码库已迁移至独立归档仓库：[helloagents-archive](https://github.com/hellowind777/helloagents-archive)

## 目录

- [前后对比](#前后对比)
- [核心能力](#核心能力)
  - [子代理原生映射](#子代理原生映射)
- [快速开始](#快速开始)
- [配置](#配置)
- [工作原理](#工作原理)
- [聊天内工作流命令](#聊天内工作流命令)
- [使用指南](#使用指南)
- [仓库结构](#仓库结构)
- [FAQ](#faq)
- [故障排除](#故障排除)
- [版本历史](#版本历史)
- [参与贡献](#参与贡献)
- [许可证](#许可证)
- [下一步](#下一步)

---

## 前后对比

<table>
<tr>
<td width="50%" valign="top" align="center">

**未使用 HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="未使用 HelloAGENTS 的贪吃蛇演示" width="520">

</td>
<td width="50%" valign="top" align="center">

**使用 HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="使用 HelloAGENTS 的贪吃蛇演示" width="520">

</td>
</tr>
</table>

| 挑战 | 未使用 HelloAGENTS | 使用 HelloAGENTS |
|------|-------------------|-----------------|
| 止步于规划 | 给出建议后结束 | 持续推进到实现与验证 |
| 输出漂移 | 每次提示结构不同 | 统一路由与阶段链 |
| 高风险操作 | 容易误执行破坏性命令 | EHRB 风险检测与升级 |
| 知识延续 | 上下文分散丢失 | 内置知识库与会话记忆 |
| 可复用性 | 逐次提示重复劳动 | 命令化可复用工作流 |

## 核心能力

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**子代理自动编排（RLM）**

3 个专业角色（reviewer / writer / brainstormer）+ 宿主 CLI 原生子代理（explore / code / brainstorm），根据任务复杂度自动调度。任务通过 DAG 依赖分析进行拓扑排序，按层并行派发，支持跨 CLI 并行调度与 Agent Teams 协作。

**你的收益：** 复杂任务自动拆解，由合适的专家角色处理，可并行时自动并行。
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**结构化工作流（评估→设计→开发）**

每条输入经五维评分路由至 R0 直答、R1 快速流、R2 简化流或 R3 标准流。R2/R3 进入完整阶段链，每个阶段有明确的进入条件、交付物和验证门控。支持交互模式与全自动委托模式。

**你的收益：** 按需投入——简单问题秒回，复杂任务走完整流程，每步可验证。
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**三层安全检测（EHRB）**

关键词扫描、语义分析、工具输出检查，在执行前拦截破坏性操作。交互模式和委托模式均强制用户确认。

**你的收益：** 零配置的安全默认保护。
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**双层记忆模型**

L0 用户记忆（全局偏好）、L1 项目知识库（从代码自动同步的结构化文档）。

**你的收益：** 上下文跨会话、跨项目持续保留。
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**可扩展性与自定义**

语音提示（5 种事件音效）、自定义命令扩展（`.helloagents/commands/*.md`）、用户自定义工具编排（子代理、skills、MCP 服务器、插件），以及灵活的配置选项。所有功能在 6 个 CLI 目标上均可使用，并支持优雅降级。

**你的收益：** 根据团队需求定制工作流，无需 fork 代码库。
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**多 CLI 支持**

一套规则适用于 Claude Code、Codex CLI、OpenCode、Gemini CLI、Qwen CLI 和 Grok CLI。自动功能检测和优雅降级确保无论 CLI 能力如何都能获得一致体验。

**你的收益：** 在不同 CLI 之间切换无需重新学习工作流或重新配置规则。
</td>
</tr>
</table>

### 子代理原生映射

| CLI | 原生子代理机制 | RLM 映射方式 |
|-----|---------------|-------------|
| Claude Code | Task tool（explore / code / shell） | 直接映射，支持 Agent Teams 协作 |
| Codex CLI | spawn_agent / Collab（多线程） | spawn_agent 并行调度，CSV 批量编排 |
| OpenCode | 内置 agent 模式 | 降级为顺序执行 |
| Gemini CLI | 内置工具调用 | 降级为顺序执行 |
| Qwen CLI | 内置工具调用 | 降级为顺序执行 |
| Grok CLI | 内置工具调用 | 降级为顺序执行 |

此外，HelloAGENTS 还提供：**五维路由评分**（行动需求、目标可定位性、决策需求、影响范围、EHRB 风险）自动决定每条输入的处理深度；**6 个 CLI 目标**（Claude Code / Codex CLI / OpenCode / Gemini CLI / Qwen CLI / Grok CLI）一套规则多端复用；**Hooks 集成**（Claude Code 11 个生命周期钩子 + Codex CLI notify 钩子 + Gemini/Grok CLI 钩子）无 Hooks 环境自动降级。

### CLI 兼容性速查表

| CLI | 推荐版本 | 主要特性 | 配置说明 |
|-----|---------|---------|---------|
| **Claude Code** | 最新版 | Agent Teams、11 个生命周期钩子、自动记忆 | Agent Teams 模式需设置 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| **Codex CLI** | 0.110+ | spawn_agent、CSV 批量、collaboration_modes | 启用子代理、CSV 编排，设置 `project_doc_max_bytes >= 131072` |
| **OpenCode** | 最新版 | 内置 agent 模式 | 降级为顺序执行 |
| **Gemini CLI** | 最新版 | 内置工具调用 | 降级为顺序执行 |
| **Qwen CLI** | 最新版 | 内置工具调用 | 降级为顺序执行 |
| **Grok CLI** | 最新版 | 内置工具调用 | 降级为顺序执行 |

<details>
<summary>📋 各 CLI 详细说明（点击展开）</summary>

**Codex CLI 配置：**
- 启用子代理和 CSV 编排功能
- 在 config.toml 中设置 `project_doc_max_bytes = 131072`
- 配置 `developer_instructions` 以提升路由协议优先级
- 启用 `collaboration_modes` 以使用 TUI 交互选择（v0.110+）
- 配置 `nickname_candidates` 以实现角色识别
- 如使用并行工作流，配置 CSV 批量处理

**Claude Code 设置：**
- Agent Teams 模式需设置环境变量 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- 11 个生命周期钩子在安装时自动配置（SessionStart、UserPromptSubmit、SubagentStart/Stop、PostToolUse、Stop、TeammateIdle、PreCompact、PreToolUse、SessionEnd、PostToolUseFailure）
- 自动记忆功能默认启用

**其他 CLI：**
- OpenCode/Gemini/Qwen/Grok 使用顺序执行降级
- 所有功能均支持优雅降级
- Hooks 可能在部分平台上不可用

</details>

## 快速开始

> 💡 **选择你的安装方式：**
> - **首次使用** → 方式 A（一键脚本，推荐）
> - **Node.js 开发者** → 方式 B（npx）
> - **Python 开发者** → 方式 D（pip）
> - **需要隔离环境** → 方式 C（UV）

> ⚠️ **前置要求：** 各 AI CLI（Codex CLI / Claude Code 等）需升级到最新版本，并开启相关功能开关（如子代理、CSV 编排等），才能使用 HelloAGENTS 的全部能力。各 CLI 的 VSCode 插件版本更新较慢，部分新功能需等待插件更新后才可使用。详见下方各 CLI 的兼容性说明。

> ⚠️ **Windows PowerShell 5.1** 不支持 `&&` 连接符。请将 `&&` 两侧命令分开执行，或升级到 [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows)。

### 方式 A：一键安装脚本（推荐）

**macOS / Linux：**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell：**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> 脚本自动检测 `uv` 或 `pip`，安装 HelloAGENTS 包后启动交互式菜单选择目标 CLI。重复运行即为更新。

**更新：** 重新运行上方安装命令即可。

**卸载：** `uv tool uninstall helloagents` 或 `pip uninstall helloagents`（取决于脚本检测到的工具）

**切换分支：**

    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

### 方式 B：npx（Node.js >= 16）

    npx helloagents

> 通过 pip 安装 Python 包后启动交互式菜单。也可直接指定：`npx helloagents install codex`（或用 `npx -y` 跳过确认）

> 需要 Python >= 3.10。首次安装后可直接使用 `helloagents` 命令。

> **致谢：** 感谢 @setsuna1106 慷慨转让 npm `helloagents` 包所有权。

**更新：** `npx helloagents@latest`

**卸载：** `pip uninstall helloagents`

**切换分支：** `npx helloagents@beta`

### 方式 C：UV（隔离环境）

**步骤 0 — 先安装 UV（已安装可跳过）：**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> 安装 UV 后请重启终端以使 `uv` 命令生效。

**安装并选择目标（一条命令）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> 安装包后启动交互式菜单选择目标 CLI。也可直接指定：`helloagents install codex`

**更新：** `uv tool install --from git+https://github.com/hellowind777/helloagents helloagents --force`

**卸载：** `uv tool uninstall helloagents`

**切换分支：** `uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents --force`

### 方式 D：pip（Python >= 3.10）

**安装并选择目标（一条命令）：**

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents

> 安装包后启动交互式菜单选择目标 CLI。也可直接指定：`helloagents install codex`

**更新：** `pip install --upgrade git+https://github.com/hellowind777/helloagents.git`

**卸载：** `pip uninstall helloagents`

**切换分支：** `pip install --upgrade git+https://github.com/hellowind777/helloagents.git@beta`

### HelloAGENTS 命令（安装后可用）

> ⚠️ 以下命令依赖已安装的包。若远程更新导致异常，请使用上方对应安装方式的原生命令操作。

    helloagents                  # 交互式菜单
    helloagents install codex    # 直接指定目标
    helloagents install --all    # 安装到所有已检测的 CLI
    helloagents status           # 查看安装状态
    helloagents version          # 查看版本
    helloagents update           # 更新 + 自动同步所有目标
    helloagents update beta      # 切换分支 + 自动同步
    helloagents uninstall codex  # 卸载指定目标
    helloagents uninstall --all  # 卸载所有目标
    helloagents clean            # 清理缓存

### Codex CLI 示例

**首次安装：**

    # 一键脚本（推荐，安装后自动启动交互式菜单）
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx（或用 npx -y 跳过确认）
    npx helloagents install codex

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install codex

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install codex

**后续更新（自动同步已安装目标）：**

    helloagents update

> ⚠️ **Codex CLI config.toml 兼容性说明：**
> - `[features]` `child_agents_md = true` — 实验性功能，可能与 HelloAGENTS 冲突
> - `project_doc_max_bytes` 过低 — 默认 32KB，AGENTS.md 会被截断（安装时自动设为 131072）
> - `agent_max_depth = 1` — 限制子代理嵌套深度，建议保持默认或 ≥2
> - `agent_max_threads` 过低 — 默认 6，较低值限制并行子代理调度（CSV 批量模式建议 ≥16）
> - `[features]` `multi_agent = true` — 必须启用才能使用子代理编排
> - `[features]` `sqlite = true` — CSV 批量编排（spawn_agents_on_csv）必须启用
> - Collab 子代理调度需要启用 Codex CLI 对应功能开关
>
> 💡 **最佳实践：**
> - Codex 0.110+ 推荐以获得完整功能（collaboration_modes、nickname_candidates）
> - HelloAGENTS 在 Codex CLI 中体验最佳 — 支持 `high` 及以下推理程度，**不支持 `xhigh` 推理**（可能导致指令跟随异常）
> - 建议使用终端/CLI 版本的 Codex。VSCode 插件因官方更新节奏较慢，部分新功能（如 CSV 批量编排、Collab 多代理协作等）需等待插件更新后才可使用

### Claude Code 示例

**首次安装：**

    # 一键脚本（推荐）
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx
    npx helloagents install claude

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install claude

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install claude

**后续更新：**

    helloagents update

> 💡 **Claude Code 子代理编排提示：**
> - 子代理（Task tool）开箱即用，无需额外配置
> - Agent Teams 协作模式需设置环境变量：`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
> - 并行子代理数量由模型自动管理，无需用户侧限制配置

## 配置

安装后可通过 `config.json` 自定义工作流行为。只需包含要覆盖的键，缺省项使用默认值。

**存储位置（优先级从高到低）：**

1. 项目级：`{项目根目录}/.helloagents/config.json` — 仅当前项目生效
2. 全局级：`~/.helloagents/config.json` — 所有项目生效
3. 内置默认值

**配置项：**

| 键 | 类型 | 默认值 | 说明 |
|----|------|--------|------|
| `OUTPUT_LANGUAGE` | string | `zh-CN` | AI 输出和知识库文件的语言 |
| `KB_CREATE_MODE` | int | `2` | 知识库创建模式：`0`=关闭，`1`=按需（提示运行 ~init），`2`=代码变更时自动创建/更新，`3`=始终自动创建 |
| `BILINGUAL_COMMIT` | int | `1` | 提交信息语言：`0`=仅 OUTPUT_LANGUAGE，`1`=OUTPUT_LANGUAGE + 英文 |
| `EVAL_MODE` | int | `1` | 澄清提问模式：`1`=渐进式（每轮 1 题，最多 5 轮），`2`=一次性（所有低分维度一起问，最多 3 轮） |
| `UPDATE_CHECK` | int | `72` | 更新检查缓存有效期（小时）：`0`=关闭 |
| `CSV_BATCH_MAX` | int | `16` | CSV 批量编排最大并发数：`0`=关闭，上限 64（仅 Codex CLI） |

**示例：**

```json
{
  "KB_CREATE_MODE": 0,
  "EVAL_MODE": 2
}
```

> 文件不存在或解析失败时静默跳过，使用默认值。未知键会输出警告并忽略。

### 常见配置场景

<details>
<summary>📝 纯英文项目</summary>

```json
{
  "OUTPUT_LANGUAGE": "en-US",
  "BILINGUAL_COMMIT": 0
}
```
所有 AI 输出、知识库文件和提交信息均为纯英文。
</details>

<details>
<summary>🚫 禁用自动创建知识库</summary>

```json
{
  "KB_CREATE_MODE": 0
}
```
知识库不会自动创建。需要时使用 `~init` 命令手动创建。
</details>

<details>
<summary>⚡ 高并发批量处理（Codex CLI）</summary>

```json
{
  "CSV_BATCH_MAX": 32
}
```
将 CSV 批量并行处理数从 16 提升到 32（最大 64）。需要 Codex CLI 启用 CSV 编排功能。
</details>

<details>
<summary>🔕 禁用更新检查</summary>

```json
{
  "UPDATE_CHECK": 0
}
```
完全跳过版本更新检查（不建议在生产环境使用）。
</details>

<details>
<summary>💬 一次性澄清模式</summary>

```json
{
  "EVAL_MODE": 2
}
```
一次性询问所有澄清问题（最多 3 个），而非渐进式（每轮 1 个问题，最多 5 轮）。
</details>

## 工作原理

**简单来说：** HelloAGENTS 根据任务复杂度自动选择处理深度，简单问题快速响应，复杂任务走完整的评估→设计→开发流程，全程有安全检查和记忆保留。

**详细流程：**

1. **安装部署** — 运行 `helloagents` 选择目标 CLI，自动部署配置文件和钩子
2. **智能路由** — 每条输入自动评分，简单问题直接回答，复杂任务进入结构化流程
3. **阶段推进** — 复杂任务按"评估→设计→开发"阶段链推进，每个阶段有明确交付物
4. **自动编排** — 系统根据任务复杂度自动调度子代理和专业角色，可并行时自动并行
5. **安全防护** — 每步扫描破坏性操作，高风险动作需用户确认
6. **记忆保留** — 用户偏好、项目知识、会话上下文跨会话持续保留
7. **验证完成** — 阶段链以验证通过的输出完成，自动同步知识库

## 聊天内工作流命令

以下命令在 AI 聊天中使用，而非系统终端。

**常用命令：**

| 命令 | 用途 |
|------|------|
| ~auto | 全自动工作流 |
| ~plan | 规划并生成方案包 |
| ~exec | 执行已有方案包 |
| ~init | 初始化知识库 |
| ~commit | 根据上下文生成提交信息 |
| ~status / ~help | 状态与帮助 |

**质量检查：**

| 命令 | 用途 |
|------|------|
| ~test | 运行项目测试 |
| ~review | 代码审查 |
| ~validatekb | 验证知识库 |

**高级功能：**

| 命令 | 用途 |
|------|------|
| ~upgradekb | 升级知识库结构 |
| ~clean / ~cleanplan | 清理工作流产物 |
| ~rollback | 回滚工作流状态 |
| ~rlm | 角色编排（spawn / agents / resume / team） |

## 使用指南

### 三种工作流模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `~auto` | 从需求到实现的全自动流程（评估→设计→开发→验证） | 明确需求，希望一步到位 |
| `~plan` | 仅规划，生成方案包后停止，不写代码 | 想先审查方案再决定是否实施 |
| `~exec` | 跳过评估和设计，直接执行已有方案包 | `~plan` 审查通过后继续实施 |

典型工作流：先 `~plan` 生成方案 → 审查确认 → `~exec` 执行实施。也可直接 `~auto` 一步完成。

### 交互模式与委托模式

`~auto` 或 `~plan` 确认时可选择执行模式：

- **交互模式（默认）：** 在关键决策点暂停等待确认（方案选择、失败处理等）
- **委托模式（全自动）：** 自动推进所有阶段，自动选择推荐选项，仅在 EHRB 风险检测时中断
- **仅规划委托：** 全自动但止步于设计阶段，不进入开发

不使用 `~` 命令时，直接输入需求会自动路由至 R0–R3 级别处理。

### 需求评估与追问

R2/R3 任务进入执行前，系统会对需求进行四维评分（需求范围 0–3、交付规格 0–3、实现条件 0–2、验收标准 0–2，满分 10）。总分 ≥ 8 直接进入确认，< 8 则触发追问：

- `EVAL_MODE=1`（默认，渐进式）：每轮问 1 个最低分维度，最多 5 轮
- `EVAL_MODE=2`（一次性）：所有低分维度一起问，最多 3 轮

已有代码库中可推断的上下文会自动计入评分。如果需求已经足够明确，可以说"跳过评估 / 直接做"跳过追问环节。

### 设计阶段并行方案

R3 标准流的设计阶段会派发 3–6 个子代理，各自独立生成竞争性实现方案。主代理从用户价值、方案合理性、风险（含 EHRB）、实现成本四个维度评估所有方案，权重根据项目特征动态调整（如性能敏感项目提高合理性权重，MVP 项目提高成本权重）。

- 交互模式：用户选择方案或要求重新生成（最多 1 次重试）
- 委托模式：自动选择推荐方案
- R2 简化流跳过多方案比较，直接进入规划

### 开发阶段自动依赖管理

开发阶段会自动检测项目的包管理器（通过 lockfile 识别：`yarn.lock` → yarn、`uv.lock` → uv、`Gemfile.lock` → bundler 等），并处理依赖问题：

- 已声明但缺失的依赖：自动安装
- 任务需要的新依赖：自动添加并更新依赖声明文件
- 不确定的依赖：询问用户后再安装

### 质量验证（Ralph Loop 与 Break-loop）

**Ralph Loop**（Claude Code，通过 SubagentStop Hook）：子代理完成代码修改后，自动运行项目验证命令。验证失败时阻断子代理退出，要求修复（最多 1 次重试循环）。验证命令来源优先级：`.helloagents/verify.yaml` → `package.json` scripts → 自动检测。

**Break-loop**（深度根因分析）：当任务经过 Ralph Loop + 至少 1 次手动修复仍反复失败时触发，执行五维根因分析：

1. 根因分类（逻辑错误 / 类型不匹配 / 缺失依赖 / 环境问题 / 设计缺陷）
2. 为什么之前的修复没有生效
3. 预防机制建议
4. 系统性扫描——其他模块是否存在同类问题
5. 经验教训记录到验收报告

### 自定义命令扩展

在项目目录下创建 `.helloagents/commands/` 并放入 Markdown 文件，文件名即为命令名：

    .helloagents/commands/deploy.md  →  ~deploy
    .helloagents/commands/release.md →  ~release

文件内容定义该命令的执行规则。系统会自动应用轻量门控（需求理解 + EHRB 检查）。

### 智能提交（~commit）

`~commit` 不只是生成提交信息，还包括：

- 分析 `git diff` 自动生成 Conventional Commits 格式的提交信息
- 预提交质量检查（代码-文档一致性、测试覆盖、验证命令）
- 自动排除敏感文件（`.env`、`*.pem`、`*.key` 等），不会执行 `git add .`
- 提交前展示文件清单，支持排除
- 可选：仅本地提交 / 提交+推送 / 提交+推送+创建 PR
- `BILINGUAL_COMMIT=1` 时生成双语提交信息

### 手动调用子代理角色

除自动调度外，可手动指定角色执行任务：

    ~rlm spawn reviewer "审查 src/api/ 的安全性"
    ~rlm spawn writer "生成 API 接口文档"
    ~rlm spawn reviewer,writer "分析并记录认证模块"   # 并行多角色

可用角色：`reviewer`（代码审查）、`writer`（文档撰写）、`brainstormer`（多方案构思对比）。

### 多终端协作

多个终端（可跨不同 CLI）共享任务列表协同工作：

    # 终端 A
    hellotasks=my-project codex

    # 终端 B
    hellotasks=my-project claude

启用后可用命令：

    ~rlm tasks                  # 查看共享任务列表
    ~rlm tasks available        # 查看可认领任务
    ~rlm tasks claim <id>       # 认领任务
    ~rlm tasks complete <id>    # 标记完成
    ~rlm tasks add "任务标题"    # 添加新任务

任务存储在 `{KB_ROOT}/tasks/` 下，通过文件锁防止并发冲突。

### KB 自动同步与 CHANGELOG

知识库在以下时机自动同步：

- 每个开发阶段完成后，主代理同步模块文档以反映实际代码
- 每个 R1/R2/R3 任务完成后，CHANGELOG 自动追加条目
- 会话结束时（Claude Code Stop Hook），异步设置 KB 同步标志

CHANGELOG 使用语义版本号（X.Y.Z），版本来源优先级：用户指定 → 项目文件（package.json、pyproject.toml 等，支持 15+ 语言/框架）→ git tag → 上一条 CHANGELOG 条目 → 0.1.0。R1 快速路径的变更记录在"快速修改"分类下，附带 file:line 范围。

`KB_CREATE_MODE` 控制自动行为：`0`=关闭、`1`=按需提示、`2`=代码变更时自动（默认）、`3`=始终自动。

### Worktree 隔离

当多个子代理需要同时修改同一文件的不同区域时（仅 Claude Code），系统自动使用 `Task(isolation="worktree")` 为每个子代理创建独立的 git worktree，避免 Edit 工具冲突。主代理在合并阶段统一合并所有 worktree 的变更。仅在子代理有文件写入重叠时启用，只读任务不使用。

### CSV 批量编排（Codex CLI）

当同一执行层存在 ≥6 个结构相同的任务时，系统自动将 `tasks.md` 转为任务 CSV，通过 `spawn_agents_on_csv` 并行派发。每个 worker 接收各自的行数据 + 指令模板，独立执行并汇报结果。

- 进度通过 `agent_job_progress` 事件实时追踪（pending/running/completed/failed/ETA）
- 状态持久化到 SQLite，支持崩溃恢复
- 部分失败仍导出结果，附带失败摘要
- 异构任务自动回退到 `spawn_agent` 逐个派发
- 通过 `CSV_BATCH_MAX` 配置并发上限（默认 16，最大 64，设为 0 关闭）

### 更新检查

每次会话首条响应时，系统静默检查是否有新版本可用。检查结果缓存在 `~/.helloagents/.update_cache`，有效期由 `UPDATE_CHECK` 配置（默认 72 小时，设为 0 关闭）。有新版本时在响应末尾显示 `⬆️ 新版本 {version} 可用`。检查过程中的任何错误都会静默跳过，不影响正常使用。

## 仓库结构

- AGENTS.md：路由与工作流协议
- SKILL.md：CLI 目标的技能发现元数据
- pyproject.toml：包元数据（v2.3.5）
- helloagents/cli.py：CLI 入口
- helloagents/_common.py：共享常量与工具函数
- helloagents/core/：CLI 管理模块（安装、卸载、更新、状态、调度器、钩子设置）
- helloagents/functions：命令定义（15 个）
- helloagents/stages：设计、开发阶段定义
- helloagents/services：知识库、方案包、记忆等核心服务
- helloagents/rules：状态机、缓存、工具、扩展、子代理协议
- helloagents/rlm：角色库与编排辅助
- helloagents/hooks：Claude Code、Codex CLI、Gemini CLI、Grok CLI Hooks 配置
- helloagents/scripts：自动化脚本（声音通知、进度快照、安全防护等）
- helloagents/agents：子代理定义（3 个 RLM 角色）
- helloagents/user/commands：自定义命令模板
- helloagents/assets：音频资源（5 种事件音效）
- helloagents/templates：KB 和方案模板

## FAQ

**问：这是 Python CLI 工具还是提示词包？**

答：两者兼有。CLI 负责安装和更新管理，工作流行为来自 AGENTS.md 和文档文件。可以理解为：交付系统 + 智能工作流协议。

**问：应该安装哪个目标？**

答：选择你正在使用的 CLI：`codex`（Codex CLI）、`claude`（Claude Code）、`gemini`（Gemini CLI）、`qwen`（Qwen CLI）、`grok`（Grok CLI）或 `opencode`（OpenCode）。可以用 `helloagents install --all` 安装到所有目标。详见[CLI 兼容性速查表](#cli-兼容性速查表)。

**问：如果规则文件已存在怎么办？**

答：HelloAGENTS 会在替换前自动备份非 HelloAGENTS 文件。备份带时间戳，存储在 CLI 配置目录中，随时可以恢复。

**问：什么是 RLM？**

答：Role Language Model——HelloAGENTS 的子代理编排系统。包含 3 个专业角色（reviewer、writer、brainstormer）+ 原生 CLI 子代理。任务通过 DAG 依赖分析调度，可并行时自动并行。详见[使用指南](#使用指南)。

**问：项目知识存储在哪里？**

答：在项目本地的 `.helloagents/` 目录中。知识库在代码变更时自动同步（由 `KB_CREATE_MODE` 配置控制）。包含模块文档、CHANGELOG 和自定义命令。详见 [KB 自动同步与 CHANGELOG](#kb-自动同步与-changelog)。

**问：记忆能跨会话保留吗？**

答：能。通过双层记忆：L0 用户记忆（全局偏好，存于 `~/.helloagents/`）、L1 项目知识库（按项目存于 `.helloagents/`）。即使关闭重开 CLI，上下文依然保留。

**问：什么是 Hooks？**

答：安装时自动部署的生命周期钩子。Claude Code 有 11 个事件钩子（安全检查、危险命令防护、进度快照、KB 同步、语音通知、工具失败恢复等）；Codex CLI 有 notify 钩子用于更新检查和语音通知；Gemini CLI 和 Grok CLI 有上下文注入、进度快照和语音通知钩子。全部可选——无 Hooks 时功能自动降级，无需手动配置。

**问：什么是 Agent Teams？**

答：Claude Code 实验性功能，多个 Claude Code 实例作为队友协作，共享任务列表和邮箱通信。通过 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 启用。不可用时回退到标准 Task 子代理。详见[多终端协作](#多终端协作)。

## 故障排除

### 命令未找到

**问题：** 安装后提示 `helloagents: command not found`

**诊断：** 安装路径未加入系统 PATH

**解决：**
- UV：安装 UV 后重启终端
- pip：用 `pip show helloagents` 查看安装位置，添加到 PATH
- 验证：`which helloagents`（Unix）或 `where helloagents`（Windows）

**验证：** 运行 `helloagents version`

---

### 版本号未知

**问题：** 版本显示为"unknown"

**诊断：** 包元数据不可用

**解决：** 先安装包：`pip install git+https://github.com/hellowind777/helloagents.git` 或使用 UV/npx 方式

**验证：** 运行 `helloagents version` 应显示当前版本号

---

### 目标未检测到

**问题：** 安装时找不到 CLI 目标

**诊断：** 配置目录尚不存在

**解决：** 先启动目标 CLI 至少一次以创建配置目录，然后重试 `helloagents install <target>`

**验证：** 检查配置路径：
- Codex CLI：`~/.codex/`
- Claude Code：`~/.claude/`
- 其他：参见 CLI 文档

---

### 自定义规则被覆盖

**问题：** 自定义规则被 HelloAGENTS 替换

**诊断：** 安装时替换现有文件

**解决：** 从 CLI 配置目录中的时间戳备份恢复（如 `~/.codex/rules/AGENTS.md.backup.20260304_132146`）

**验证：** 检查配置目录中的备份文件

---

### 图片不显示

**问题：** README 图片无法显示

**诊断：** 图片文件缺失或路径错误

**解决：**
- 保持 README 中的相对路径（如 `./readme_images/`）
- 确保 `readme_images/` 文件夹已提交到仓库
- 验证图片文件本地存在

**验证：** 检查 `ls readme_images/` 显示所有引用的图片

---

### CCswitch 切换后配置丢失

**问题：** 切换 CCswitch 配置方案后，HelloAGENTS 不工作（工作流命令无法识别、钩子不触发、规则缺失）

**诊断：** CCswitch 切换配置方案时会替换整个 CLI 配置目录（如 `~/.claude/`），覆盖了 HelloAGENTS 的钩子、权限和规则文件

**解决：** 切换 CCswitch 配置方案后，运行以下任一命令恢复 HelloAGENTS：

    helloagents install claude    # 重新安装到指定 CLI 目标
    helloagents update            # 更新 + 自动同步所有已安装目标

**预防：** v2.3.5 新增会话启动时自动配置完整性检测——如果 HelloAGENTS 配置缺失或损坏，会显示警告和恢复指引

**验证：** 运行 `helloagents status` 确认所有目标显示为已安装

---

### CCswitch 配置冲突

**问题：** 卸载 HelloAGENTS 后切换 CCswitch 配置方案时配置重新出现

**诊断：** CCswitch 在卸载前保存了 HelloAGENTS 设置

**解决：** 卸载 HelloAGENTS 后，手动清理所有已保存 CCswitch 配置方案中的 HelloAGENTS 相关设置（hooks、permissions、rules）

**验证：** 检查 CCswitch 配置方案目录中是否有 HelloAGENTS 残留

## 版本历史

### v2.3.5（当前）

**新增功能：**
- 语音提示系统，支持 5 种事件语音（完成、空闲、确认、错误、警告），跨平台支持 Windows/macOS/Linux，智能两层声音路由（stop_reason + G3 格式图标检测）
- Claude Code 生命周期钩子从 9 个扩展到 11 个事件类型：新增危险命令防护（PreToolUse）、会话结束清理（SessionEnd）、工具失败恢复建议（PostToolUseFailure）
- Hooks 支持扩展到 Gemini CLI 和 Grok CLI（SessionStart、BeforeAgent/AfterAgent、PreCompress、PreToolUse、PostToolUse）
- Codex CLI 0.110 新功能：`collaboration_modes` TUI 交互选择、`nickname_candidates` 代理角色识别
- 会话启动时自动配置完整性检测（自动发现配置被 CCswitch 等工具替换的情况）
- 上下文压缩前自动保存进度快照（pre_compact.py、progress_snapshot.py——从占位 Hook 升级为完整实现）
- 用户自定义工具注册发现 + 编排整合机制——智能调用用户自定义的子代理、skills、MCP 服务器和插件
- 自定义命令扩展支持，通过 `.helloagents/commands/*.md` 创建新命令

**改进优化：**
- 全面审计修复（21 个问题：6 HIGH + 9 MEDIUM + 6 LOW）
  - 代码质量：提取 5 个共享工具函数，消除循环依赖
  - 跨平台：统一平台判断，一致的编码处理
  - 安全性：配置覆盖前备份，占位符验证
  - 文档：配置说明，兼容性验证记录
- 核心架构新增：调度器模块、Codex 角色定义、Claude 规则管理、Hooks 设置管理器
- 安装/更新脚本重构，支持持久化配置
- 语音通知准确度提升，减少误报（Codex 客户端过滤、Windows 同步播放）
- 子代理昵称跨 CLI 优化
- Codex CLI 交互菜单启用、持久记忆和上下文压缩优化
- R2 简化流程优化与评估模块重新融合
- 上下文压缩状态持久性优化
- 工具/Shell 使用优化
- CCswitch 兼容性说明，卸载后配置清理提醒
- SKILL 发现入口优化

### v2.3.4

- 超长脚本拆分：3 个超 450 行的文件拆为 6 个独立模块
- CLI 管理脚本统一收纳至 core/ 子包（9 个模块）
- 共享常量与工具函数提取为独立模块，消除循环依赖
- 清理冗余兼容性重导出
- Codex CLI 路由协议权限提升，防止被系统提示词覆盖

### v2.3.0

- 全面交叉审计修复：角色输出格式统一、路径引用规范化、文档与代码一致性对齐
- 质量验证循环（Ralph Loop）：子代理完成后自动验证，失败时阻断并反馈
- 子代理上下文自动注入与主代理规则强化
- 深度五维根因分析（break-loop）应对重复失败
- 开发前自动注入项目技术规范
- 提交前质量检查（代码-文档一致性、测试覆盖、验证命令）
- Worktree 隔离支持并行编辑
- 自定义命令扩展（.helloagents/commands/）
- CHANGELOG 条目自动追加 Git 作者信息

## 参与贡献

详见 CONTRIBUTING.md 了解贡献规则和 PR 检查清单。

## 许可证

本项目双重许可：代码采用 Apache-2.0，文档采用 CC BY 4.0。详见 [LICENSE.md](./LICENSE.md)。

## 下一步

**快速开始：**
- 使用你喜欢的方式安装 HelloAGENTS：[快速开始](#快速开始)
- 用简单任务试试 `~auto`，体验完整工作流
- 尝试 `~plan` + `~exec` 获得更多控制权

**深入学习：**
- 阅读[使用指南](#使用指南)了解详细工作流模式
- 查看[配置](#配置)自定义行为
- 参考[聊天内工作流命令](#聊天内工作流命令)

**社区与支持：**
- 如果 HelloAGENTS 对你有帮助，欢迎点个 Star
- 在 [GitHub Issues](https://github.com/hellowind777/helloagents/issues) 报告问题或请求功能
- 参与贡献改进：参见 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

<div align="center">

如果本项目对你的工作流有帮助，欢迎点个 Star。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持

</div>

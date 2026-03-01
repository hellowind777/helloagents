<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**让 AI 不止于分析，而是持续推进到实现与验证完成。**

[![Version](https://img.shields.io/badge/version-2.3.0-orange.svg)](./pyproject.toml)
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

- [前后对比](#前后对比)
- [核心能力](#核心能力)
- [快速开始](#快速开始)
- [配置](#配置)
- [工作原理](#工作原理)
- [聊天内工作流命令](#聊天内工作流命令)
- [仓库结构](#仓库结构)
- [FAQ](#faq)
- [故障排除](#故障排除)
- [版本历史](#版本历史)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

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

5 个专业角色（reviewer / synthesizer / kb_keeper / pkg_keeper / writer）+ 宿主 CLI 原生子代理（explore / implement / test / design），根据任务复杂度自动调度。任务通过 DAG 依赖分析进行拓扑排序，按层并行派发，支持跨 CLI 并行调度与 Agent Teams 协作。

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

**三层记忆模型**

L0 用户记忆（全局偏好）、L1 项目知识库（从代码自动同步的结构化文档）、L2 会话摘要（阶段转换时自动持久化）。

**你的收益：** 上下文跨会话、跨项目持续保留。
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

此外，HelloAGENTS 还提供：**五维路由评分**（行动需求、目标可定位性、决策需求、影响范围、EHRB 风险）自动决定每条输入的处理深度；**6 个 CLI 目标**（Claude Code / Codex CLI / OpenCode / Gemini CLI / Qwen CLI / Grok CLI）一套规则多端复用；**Hooks 集成**（Claude Code 9 个生命周期钩子 + Codex CLI notify 钩子）无 Hooks 环境自动降级。

## 快速开始

### 方式 A：一键安装脚本（推荐）

**macOS / Linux：**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell：**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> 脚本自动检测 `uv` 或 `pip`，安装 HelloAGENTS 包后启动交互式菜单选择目标 CLI。重复运行即为更新。

**更新：**

    helloagents update

### 方式 B：npx（Node.js >= 16）

    npx helloagents

> 安装 Python 包后启动交互式菜单。也可直接指定：`npx helloagents install codex`（或用 `npx -y` 跳过确认）

> 需要 Python >= 3.10。首次安装后可直接使用 `helloagents` 命令。

> **致谢：** 感谢 @setsuna1106 慷慨转让 npm `helloagents` 包所有权。

### 方式 C：UV（隔离环境）

**步骤 0 — 先安装 UV（已安装可跳过）：**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> 安装 UV 后请重启终端以使 `uv` 命令生效。

> ⚠️ Windows PowerShell 5.1 不支持 `&&`，请分开执行命令，或升级到 [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows)。

**安装并选择目标（一条命令）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> 安装包后启动交互式菜单选择目标 CLI。也可直接指定：`helloagents install codex`

**更新：**

    helloagents update

### 方式 D：pip（Python >= 3.10）

**安装并选择目标（一条命令）：**

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents

> 安装包后启动交互式菜单选择目标 CLI。也可直接指定：`helloagents install codex`

**更新：**

    pip install --upgrade git+https://github.com/hellowind777/helloagents.git

### 常用命令

    helloagents                  # 交互式菜单
    helloagents install codex    # 直接指定目标
    helloagents install --all    # 安装到所有已检测的 CLI
    helloagents status           # 查看安装状态
    helloagents version          # 查看版本
    helloagents uninstall codex  # 卸载指定目标
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

### Beta 分支

安装 `beta` 分支版本，在仓库 URL 后追加 `@beta`：

    # 一键脚本
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

    # npx
    npx helloagents@beta

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents && helloagents

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git@beta && helloagents

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

## 工作原理

1. 安装包（脚本/pip/uv）后运行 `helloagents` 启动交互式菜单选择目标 CLI（或直接 `helloagents install <target>`）。安装时自动部署 Hooks 和 SKILL.md。
2. 在 AI 聊天中，每条输入按五个维度评分并路由至 R0–R3。
3. R2/R3 任务进入阶段链：评估 → 设计 → 开发。R1 快速流直接处理单点操作。
4. RLM 根据任务复杂度调度原生子代理和专业角色。有依赖关系的任务通过 DAG 拓扑排序按层并行派发。
5. EHRB 在每个步骤扫描破坏性操作；高风险动作需用户明确确认。Hooks 可用时提供额外的工具前安全检查。
6. 三层记忆（用户 / 项目知识库 / 会话）跨会话保留上下文。
7. 阶段链以验证通过的输出完成，可选同步知识库。

## 聊天内工作流命令

以下命令在 AI 聊天中使用，而非系统终端。

| 命令 | 用途 |
|------|------|
| ~auto | 全自动工作流 |
| ~plan | 规划并生成方案包 |
| ~exec | 执行已有方案包 |
| ~init | 初始化知识库 |
| ~upgradekb | 升级知识库结构 |
| ~clean / ~cleanplan | 清理工作流产物 |
| ~test / ~review / ~validatekb | 质量检查 |
| ~commit | 根据上下文生成提交信息 |
| ~rollback | 回滚工作流状态 |
| ~rlm | 角色编排（spawn / agents / resume / team） |
| ~status / ~help | 状态与帮助 |

## 仓库结构

- AGENTS.md：路由与工作流协议
- SKILL.md：CLI 目标的技能发现元数据
- pyproject.toml：包元数据（v2.3.0）
- helloagents/cli.py：安装器入口
- helloagents/functions：工作流命令（15 个）
- helloagents/stages：设计、开发阶段定义
- helloagents/services：知识库、方案包、记忆等核心服务
- helloagents/rules：状态机、缓存、工具、扩展规则
- helloagents/rlm：角色库与编排辅助
- helloagents/hooks：Claude Code 和 Codex CLI Hooks 配置
- helloagents/scripts：自动化脚本
- helloagents/templates：KB 和方案模板

## FAQ

- 问：这是 Python CLI 工具还是提示词包？
  答：两者兼有。CLI 管理安装；工作流行为来自 AGENTS.md 和 helloagents 文档。

- 问：应该安装哪个目标？
  答：选择你使用的 CLI：codex、claude、gemini、qwen、grok 或 opencode。

- 问：如果规则文件已存在怎么办？
  答：非 HelloAGENTS 文件会在替换前自动备份。

- 问：什么是 RLM？
  答：Role Language Model——子代理编排系统，包含 5 个专业角色 + 原生 CLI 子代理，基于 DAG 的并行调度，以及标准化的提示/返回格式。

- 问：项目知识存储在哪里？
  答：在项目本地的 `.helloagents/` 目录中，代码变更时自动同步。

- 问：记忆能跨会话保留吗？
  答：能。L0 用户记忆是全局的，L1 项目知识库按项目存储，L2 会话摘要在阶段转换时自动保存。

- 问：什么是 Hooks？
  答：安装时自动部署的生命周期钩子。Claude Code 有 9 个事件钩子（安全检查、进度快照、KB 同步等）；Codex CLI 有 notify 钩子用于更新检查。全部可选——无 Hooks 时功能自动降级。

- 问：什么是 Agent Teams？
  答：Claude Code 实验性多代理协作模式。多个 Claude Code 实例作为队友协作，共享任务列表和邮箱通信，映射到 RLM 角色。不可用时回退到标准 Task 子代理。

## 故障排除

- command not found：确认安装路径已加入 PATH
- 版本号未知：请先安装包以获取元数据
- 目标未检测到：先启动一次目标 CLI 以创建配置目录
- 自定义规则被覆盖：从 CLI 配置目录中的时间戳备份恢复
- 图片不显示：保持相对路径并提交 readme_images 文件

## 版本历史

### v2.3.0（当前）

- 全面交叉审计修复：角色输出格式统一、路径引用规范化、文档与代码一致性对齐
- 质量验证循环（Ralph Loop）：子代理完成后自动验证，失败时阻断并反馈
- 子代理上下文自动注入与主代理规则强化
- 深度五维根因分析（break-loop）应对重复失败
- 开发前自动注入项目技术规范
- 提交前质量检查（代码-文档一致性、测试覆盖、验证命令）
- Worktree 隔离支持并行编辑
- 自定义命令扩展（.helloagents/commands/）
- CHANGELOG 条目自动追加 Git 作者信息

### v2.2.16

- 评估维度体系重构：维度隔离规则，通过阈值调至 8/10
- 方案选项按风格方向组织，推荐选项指向最完整交付物
- 方案设计要求各选项在实现路径和交付设计方向上均有差异
- 方案评估标准优化：用户价值权重不低于任何单一维度
- 通用任务类型支持：评估、追问、方案设计术语泛化
- 子代理 DAG 依赖调度：拓扑排序、按层并行派发、失败传播
- 动态子代理并行数量，消除硬编码限制
- 统一输出格式与精简执行路径

### v2.2.14

- DAG 依赖调度（depends_on、拓扑排序、按层并行派发与失败传播）
- 分级重试与标准化子代理返回格式
- 子代理编排范式：四步法、提示模板、行为约束
- 执行路径加固：R1 升级触发、DESIGN 重试限制、DEVELOP 进出条件
- 工作流规则审计：术语与格式一致性、冗余清理

### v2.2.13

- R3 设计方案默认 ≥3 并行，批量上限 ≤6，明确子代理数量原则

### v2.2.12

- 全流程全命令并行子代理编排，扩展 G10 覆盖，消除硬编码代理数量

### v2.2.11

- 三阶段门控模型：合并分析到设计阶段（评估 → 设计 → 开发），优化停止点

### v2.2.10

- 精简子代理角色，集成所有支持 CLI 的原生多代理编排

### v2.2.9

- Windows 文件锁全面修复：安装/更新/卸载/清理的预解锁与重命名回退

### v2.2.8

- Codex CLI 注意力优化，提升 HelloAGENTS 执行稳定性

### v2.2.7

- G12 Hooks 集成规范：9 个 Claude Code 生命周期钩子 + Codex CLI notify 钩子
- 安装/卸载时自动部署和清理 Hooks 配置
- Codex CLI 原生子代理：G10 新增 spawn_agent 协议与跨 CLI 并行调度
- Agent Teams 协议：G10 新增 Claude Code 多角色协作协议
- SKILL 集成：自动部署 SKILL.md 到所有 CLI 目标的技能发现目录
- RLM 命令扩展：新增 ~rlm agents/resume/team 子命令与并行多角色派发
- 阶段并行优化与 Memory v2 桥接协议

### v2.2.5

- RLM 子代理系统：5 个专业角色 + 原生子代理，自动调度与会话隔离
- 五维路由（R0–R3）：替代旧版三层路由
- 四阶段工作流 + R1 快速流
- 三层记忆：L0 用户偏好、L1 项目知识库、L2 会话摘要
- 三层 EHRB：关键词 + 语义 + 工具输出安全检测
- 包优先安装器：pip/uv 安装 + `helloagents` 交互式菜单
- 15 个工作流命令、6 个 CLI 目标
- 交互式安装菜单、自动语言检测、Windows 编码修复
- 知识库服务与注意力服务

### v2.0.1（旧版多包基线）

- 多包分发，手动复制安装
- 三层路由（上下文 → 工具 → 意图）
- 4 个工作流阶段、12 个命令、5 个 CLI 目标
- 无子代理系统，无持久化记忆

## 参与贡献

详见 CONTRIBUTING.md 了解贡献规则和 PR 检查清单。

## 许可证

本项目双重许可：代码采用 Apache-2.0，文档采用 CC BY 4.0。详见 [LICENSE.md](./LICENSE.md)。

---

<div align="center">

如果本项目对你的工作流有帮助，欢迎点个 Star。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持

</div>

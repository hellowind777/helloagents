<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**让任何 AI CLI 变聪明，且越用越聪明的通用编排内核。**

[![Version](https://img.shields.io/badge/version-3.0.0--dev-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Skills](https://img.shields.io/badge/skills-25-6366f1.svg)](./helloagents/skills)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> **不是又一个 skills 集合。** HelloAGENTS 是一个通用编排内核，让任何 AI 编码 CLI 成为自我进化的开发伙伴 — 具备自学习路由记忆、能力图谱 Skill 组合和零配置项目理解。

## 为什么选择 HelloAGENTS？

<table>
<tr>
<td width="50%" valign="top" align="center">

**未使用 HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="未使用 HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**使用 HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="使用 HelloAGENTS" width="520">

</td>
</tr>
</table>

| 挑战 | 原生 AI CLI | 使用 HelloAGENTS |
|------|-----------|-----------------|
| 止步于规划 | 给出建议后结束 | 持续推进到实现与验证 |
| 每次会话从零开始 | 不记得过去的决策 | 学习你的路由模式和项目上下文 |
| 输出结构不一致 | 每次提示格式不同 | 统一路由 + 结构化阶段链 |
| 高风险操作容易遗漏 | 容易误执行破坏性命令 | 三层 EHRB 安全检测 |
| Skills 各自为政 | 手动选择工具 | 能力图谱自动发现和组合 Skills |
| 新项目有安装税 | 需要手动配置 | 首次交互即零配置生成项目指纹 |

## 三个 Killer Features

<table>
<tr>
<td width="33%" valign="top">

### 自学习路由记忆

AI 从自己的路由历史中学习。每次会话结果都会记录 — 选择了哪条路由、实际复杂度如何、结果是否成功。

下次遇到类似请求时，路由器自动校准：
- "这个用户的'小修改'请求 80% 实际是 R2"
- "auth/ 模块的变更总是级联到 3+ 个模块"
- "这个用户 90% 偏好 DELEGATED 模式"

就像 GPS 学习你的通勤模式，而不是每天从头计算路线。

</td>
<td width="33%" valign="top">

### Skill 能力图谱

Skills 声明自己 `provides` 什么能力、`requires` 什么依赖。编排内核构建实时能力图谱 — 当任务需要 `test-generation` 时，自动发现提供该能力的 skill。

```yaml
---
name: workflow-design
provides:
  - solution-design
  - multi-proposal-comparison
  - task-planning
requires:
  - ehrb
  - memory
---
```

第三方 skill 只需声明 `provides` 即可接入。无需注册、无需配置 — 声明即组合。

</td>
<td width="33%" valign="top">

### 零配置项目适配

无需 `~init`。首次交互时，HelloAGENTS 读取项目特征文件（package.json、pyproject.toml、Cargo.toml、go.mod、目录结构、最近 git 历史）并生成轻量指纹。

缓存到 `.helloagents/context.json`：
```json
{
  "language": "typescript",
  "framework": "next.js",
  "test_framework": "vitest",
  "modules": ["src/api", "src/ui"],
  "recent_changes": ["auth refactor"]
}
```

第一次交互就立即智能。`~init` 变为可选的进阶功能。

</td>
</tr>
</table>

## 支持平台

一次安装，6 个 CLI 目标。同一套工作流，处处可用。

| CLI | 子代理支持 | Hooks | 状态 |
|-----|----------|-------|------|
| **Claude Code** | Agent tool + Agent Teams | 9 个生命周期钩子 | 完整支持 |
| **Codex CLI** | spawn_agent + CSV 批量 | notify 钩子 | 完整支持 |
| **OpenCode** | Task tool (build/plan/explore) | — | 完整支持 |
| **Gemini CLI** | 内置工具调用 | 6 个生命周期钩子 | 完整支持 |
| **Qwen CLI** | 内置工具调用 | Settings hooks | 完整支持 |
| **Grok CLI** | 内置工具调用 | Settings hooks | 实验性 |

## 快速开始

> 需要 Python >= 3.10。选择你喜欢的安装方式：

### 一键安装（推荐）

**macOS / Linux：**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell：**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

### 其他方式

<details>
<summary>npx（Node.js >= 16）</summary>

    npx helloagents

> 感谢 @setsuna1106 慷慨转让 npm 包所有权。
</details>

<details>
<summary>UV（隔离环境）</summary>

    # 先安装 UV（已安装可跳过）
    curl -LsSf https://astral.sh/uv/install.sh | sh   # macOS/Linux
    irm https://astral.sh/uv/install.ps1 | iex          # Windows

    # 安装 HelloAGENTS
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents
</details>

<details>
<summary>pip</summary>

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents
</details>

### 安装后可用命令

```bash
helloagents                  # 交互式菜单
helloagents install claude   # 安装到指定 CLI
helloagents install --all    # 安装到所有已检测的 CLI
helloagents status           # 查看安装状态
helloagents update           # 更新 + 自动同步所有目标
helloagents uninstall --all  # 从所有目标卸载
helloagents clean            # 清理缓存
```

### 切换到 dev 分支

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/dev/install.sh | HELLOAGENTS_BRANCH=dev bash

# Windows PowerShell
$env:HELLOAGENTS_BRANCH="dev"; irm https://raw.githubusercontent.com/hellowind777/helloagents/dev/install.ps1 | iex

# UV
uv tool install --from git+https://github.com/hellowind777/helloagents@dev helloagents --force

# pip
pip install --upgrade git+https://github.com/hellowind777/helloagents.git@dev
```

## 工作原理

```
用户输入 → 智能路由 → R0 直答 / R1 快速 / R2 简化 / R3 标准
                                              ↓              ↓
                                          方案设计 ←──── 方案设计（多方案对比）
                                              ↓              ↓
                                          开发实施 ←──── 开发实施（子代理编排）
                                              ↓              ↓
                                            验证 ←──────── 验证（Ralph Loop）
                                              ↓              ↓
                                            完成 ←──────── 完成 + KB 同步
```

每条输入经 5 个维度评分（行动需求、目标可定位性、决策需求、影响范围、EHRB 风险），路由到合适的处理深度：

- **R0** — 直接响应。问答、解释、查询。
- **R1** — 快速流程。目标明确的单点操作。
- **R2** — 简化流程。需要先分析再执行，有局部决策。
- **R3** — 标准流程。复杂任务，含多方案设计和子代理编排。

路由器从历史中学习。随着使用，评分会根据你的实际模式自动校准。

## 聊天内命令

以下命令在 AI 聊天会话中使用，而非系统终端。

| 命令 | 功能 |
|------|------|
| `~auto` | 全自动工作流（评估→设计→开发→验证） |
| `~plan` | 生成实施方案，止步于编码前 |
| `~exec` | 执行已有方案包 |
| `~commit` | 智能提交，Conventional Commits 格式 |
| `~review` | 代码审查，含安全和质量分析 |
| `~test` | 运行项目测试，含失败分析 |
| `~init` | 初始化项目知识库（v3 中为可选） |
| `~status` | 查看工作流和安装状态 |
| `~rlm spawn reviewer,writer` | 手动调度子代理角色 |

## 架构

### v3 vs v2

| 指标 | v2 | v3 |
|------|----|----|
| Python 运行时 | 10,452 行（39 文件） | ~4,570 行（23 文件） |
| 工作流协议 | 954 行 AGENTS.md 单体 | 28 行 bootstrap.md + 25 个 Skills |
| 模块系统 | 50+ 自定义 .md 文件 | Agent Skills（开放标准） |
| 路由 | 固定 5 维评分 | 自适应评分 + 历史学习 |
| Skill 发现 | 隐式，AI 自行推断 | 能力图谱 + `provides`/`requires` |
| 项目初始化 | 需要 `~init` | 零配置指纹 |
| 跨平台 | 6 个 CLI + 自定义适配器 | 6 个 CLI + Agent Skills 标准 |

### 仓库结构

```
helloagents/
├── cli.py                          # CLI 入口
├── _common.py                      # 共享常量与工具函数
├── bootstrap.md                    # 28 行编排引导
├── core/
│   ├── dispatcher.py               # 命令路由 + 交互菜单
│   ├── installer.py                # 多 CLI 部署
│   ├── uninstaller.py              # 按 CLI 清理卸载
│   ├── updater.py                  # 自更新（含 Windows exe 处理）
│   ├── version_check.py            # 版本比较 + 更新缓存
│   ├── cli_adapters.py             # 6 个 CLI 的统一配置
│   └── win_helpers.py              # Windows 平台兼容
├── skills/                         # 25 个 Agent Skills（SKILL.md）
│   ├── _meta/                      # Skill 发现协议
│   ├── core/                       # 路由、记忆、EHRB、输出格式
│   ├── commands/                   # 11 个工作流命令（~auto、~plan 等）
│   ├── workflow/                   # 设计、开发、审查、构思
│   ├── roles/                      # Reviewer、Writer、Brainstormer
│   └── integrations/               # 子代理桥接、MCP 桥接
├── scripts/                        # Hook 脚本（11 个自动化脚本）
├── hooks/                          # Claude/Gemini/Grok Hook 配置
├── templates/                      # KB 和方案模板
└── user/                           # 用户自定义（命令、记忆、音效）
```

## 配置

通过 `config.json` 自定义。只需包含要覆盖的键。

**优先级：** `{项目}/.helloagents/config.json` > `~/.helloagents/config.json` > 默认值

| 键 | 默认值 | 说明 |
|----|--------|------|
| `OUTPUT_LANGUAGE` | `zh-CN` | AI 输出语言 |
| `KB_CREATE_MODE` | `2` | `0`=关闭，`1`=按需，`2`=代码变更时自动，`3`=始终自动 |
| `BILINGUAL_COMMIT` | `1` | `0`=单语言，`1`=双语提交信息 |
| `EVAL_MODE` | `1` | `1`=渐进式追问，`2`=一次性追问 |
| `UPDATE_CHECK` | `72` | 缓存有效期（小时），`0`=关闭 |
| `CSV_BATCH_MAX` | `16` | CSV 批量最大并发，仅 Codex（`0`=关闭，上限 64） |

```json
{
  "OUTPUT_LANGUAGE": "en-US",
  "KB_CREATE_MODE": 0,
  "BILINGUAL_COMMIT": 0
}
```

## 核心能力

<details>
<summary><b>结构化工作流（评估→设计→开发）</b></summary>

每条输入经评分路由。R2/R3 任务进入完整阶段链，每个阶段有进入条件、交付物和验证门控。支持交互模式（决策点暂停）和委托模式（自动推进，仅风险时暂停）。

典型模式：`~plan` → 审查 → `~exec`。或 `~auto` 一步到位。
</details>

<details>
<summary><b>三层安全检测（EHRB）</b></summary>

- 第一层：命令模式匹配（破坏性命令、生产环境操作）
- 第二层：语义分析（凭证泄露、权限绕过、PII 暴露）
- 第三层：外部工具输出检查（注入、格式劫持）

检测到风险时，交互模式触发用户确认，委托模式自动暂停。
</details>

<details>
<summary><b>子代理编排</b></summary>

3 个专业角色（reviewer、writer、brainstormer）+ 原生 CLI 子代理。任务通过 DAG 依赖分析调度，支持并行派发。支持 Claude Code Agent Teams、Codex CSV 批量编排和跨 CLI 并行调度。
</details>

<details>
<summary><b>质量验证（Ralph Loop）</b></summary>

子代理完成代码修改后，自动运行验证命令。失败时阻断子代理退出，要求修复。验证命令来源优先级：`.helloagents/verify.yaml` → `package.json` scripts → 项目配置自动检测。
</details>

<details>
<summary><b>智能提交（~commit）</b></summary>

分析 `git diff` 生成 Conventional Commits 格式提交信息。预提交质量检查。自动排除敏感文件。支持仅提交、提交+推送、提交+推送+PR。可配置双语提交信息。
</details>

<details>
<summary><b>自定义命令扩展</b></summary>

在 `.helloagents/commands/` 中放入 Markdown 文件：

    .helloagents/commands/deploy.md  →  ~deploy
    .helloagents/commands/release.md →  ~release

文件内容定义执行规则。系统自动应用轻量门控（需求理解 + EHRB 检查）。
</details>

<details>
<summary><b>双层记忆模型</b></summary>

- L0：用户记忆（全局偏好，存于 `~/.helloagents/user/memory/`）
- L1：项目知识库（按项目存于 `.helloagents/`）
- 路由历史：JSONL 日志用于自适应校准

上下文跨会话、跨项目持续保留。
</details>

<details>
<summary><b>CSV 批量编排（Codex CLI）</b></summary>

当存在 6+ 个结构相同的任务时，自动转为 CSV 并通过 `spawn_agents_on_csv` 派发。实时进度追踪、SQLite 崩溃恢复、部分失败处理。通过 `CSV_BATCH_MAX` 配置。
</details>

## FAQ

**问：这是 CLI 工具还是提示词包？**
两者兼有。CLI 负责安装和更新管理。工作流行为来自 bootstrap.md 和 25 个 Agent Skills。可以理解为：交付系统 + 智能编排协议。

**问：应该安装到哪个 CLI？**
你在用哪个就装哪个。`helloagents install claude` / `codex` / `gemini` / `qwen` / `grok` / `opencode`。或 `--all` 安装到所有已检测的 CLI。

**问：已有规则文件怎么办？**
HelloAGENTS 会在替换前自动备份非 HelloAGENTS 文件。带时间戳的备份存储在 CLI 配置目录中。

**问：没有 Hooks 能用吗？**
能。所有 Hook 增强的功能都支持优雅降级。Hooks 让事情更自动化，但没有也不会出问题。

**问：v3 和 v2 有什么区别？**
Python 代码减少 56%。Agent Skills 替代自定义模块。三个新特性：自学习路由记忆、能力图谱、零配置指纹。同样的工作流，更精简的运行时。

## 故障排除

<details>
<summary><code>helloagents: command not found</code></summary>

安装路径未加入 PATH。UV 用户：重启终端。pip 用户：用 `pip show helloagents` 查看安装位置。验证：`which helloagents`（Unix）或 `where helloagents`（Windows）。
</details>

<details>
<summary>CLI 目标未检测到</summary>

配置目录尚不存在。先启动目标 CLI 一次以创建配置目录，然后重试 `helloagents install <target>`。
</details>

<details>
<summary>CCswitch 切换后配置丢失</summary>

切换 CCswitch 配置方案后，运行 `helloagents install claude` 或 `helloagents update` 恢复。v2.3.5+ 会在会话启动时自动检测配置损坏。
</details>

## 参与贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献规则和 PR 检查清单。

## 许可证

本项目双重许可：代码采用 Apache-2.0，文档采用 CC BY 4.0。详见 [LICENSE.md](./LICENSE.md)。

---

<div align="center">

如果 HelloAGENTS 对你的工作流有帮助，欢迎点个 Star。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持

</div>

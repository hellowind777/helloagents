<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**面向 AI 编码 CLI 的工作流层：技能、知识库、交付检查、更安全的配置写入，以及可恢复的执行流程。**

[![Version](https://img.shields.io/badge/version-3.0.25-orange.svg)](./package.json)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](./package.json)
[![Skills](https://img.shields.io/badge/skills-14-6366f1.svg)](./skills)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/hellowind777/helloagents/issues)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> [!IMPORTANT]
> 如果你在找 `v2.x`，旧的 Python 版本已经迁到 [helloagents-archive](https://github.com/hellowind777/helloagents-archive)。`v3` 是基于 Node.js、Markdown 规则、skills 和轻量运行时脚本的完全重写版本。

## 目录

- [HelloAGENTS 做什么](#helloagents-做什么)
- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [CLI 管理](#cli-管理)
- [对话命令](#对话命令)
- [项目知识库](#项目知识库)
- [工作流与交付](#工作流与交付)
- [配置](#配置)
- [各 CLI 集成方式](#各-cli-集成方式)
- [验证](#验证)
- [FAQ](#faq)
- [故障排除](#故障排除)
- [许可证](#许可证)

## HelloAGENTS 做什么

AI 编码 CLI 写代码很快，但也容易停在建议、跳过检查、丢失项目上下文，或在真正完成前就报告完成。

HelloAGENTS 叠加在 Claude Code、Gemini CLI 和 Codex CLI 之上，帮助模型选择合适流程、使用任务相关的质量技能、维护项目知识库，并在交付前完成验证。

<table>
<tr>
<td width="50%" valign="top" align="center">

**没有 HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="Without HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**使用 HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="With HelloAGENTS" width="520">

</td>
</tr>
</table>

| 问题 | 没有 HelloAGENTS | 使用 HelloAGENTS |
|------|------------------|------------------|
| 结束过早 | 停在建议 | 继续实现、验证和收尾 |
| 质量不稳定 | 很依赖提示词 | 按任务类型激活 14 个质量技能 |
| 上下文分散 | 方案散落在聊天记录里 | 项目知识和方案文件落在磁盘上 |
| 完成态模糊 | 自然语言说“完成” | 按状态、证据和验证结果交付 |
| 配置容易漂移 | CLI 文件可能不一致 | 安装、更新、清理和 doctor 会检查受管文件 |

## 核心功能

### 1）14 个按任务使用的质量技能

HelloAGENTS 内置 14 个 `hello-*` 技能。技能只在当前阶段需要时读取，因此简单任务不会被额外流程拖慢，复杂任务则会得到更完整的检查。

| 技能 | 关注点 |
|------|--------|
| `hello-ui` | UI 规划、设计契约、实现映射、视觉验收 |
| `hello-api` | API 设计、校验、错误格式、兼容性 |
| `hello-security` | 认证、密钥、权限、注入风险 |
| `hello-test` | TDD、覆盖率、边界用例、测试结构 |
| `hello-verify` | 审查、命令验证、交付证据、收尾 |
| `hello-errors` | 错误处理、日志、重试和恢复 |
| `hello-perf` | 性能、缓存、查询和渲染风险 |
| `hello-data` | 数据库、迁移、事务、索引 |
| `hello-arch` | 架构、边界、代码体积、可维护性 |
| `hello-debug` | 问题诊断和卡住时的升级处理 |
| `hello-subagent` | 子代理分工和结果整合 |
| `hello-review` | 代码审查和结构化问题记录 |
| `hello-write` | 文档、报告和文字交付 |
| `hello-reflect` | 可复用经验和知识更新 |

所有 UI 任务都会先受共享的 UI 质量基线约束。
在全局模式、已激活项目或明确的 UI 工作流里，`hello-ui` 会在该基线之上补充设计契约执行、设计系统映射与视觉验收。
当需要视觉证据时，HelloAGENTS 会写入当前会话的 `artifacts/visual.json`。

### 2）面向不同工作方式的命令

命令在 AI CLI 对话中使用，以 `~` 开头。HelloAGENTS 会直接读取对应 command skill；无关技能不会提前加载，除非后续流程确实需要。

| 命令 | 用途 |
|------|------|
| `~idea` | 轻量探索和方向比较；不写文件 |
| `~auto` | 自动选择主路径，并持续推进到交付或真实阻塞 |
| `~plan` | 需求、方案、任务拆分和方案包 |
| `~build` | 按当前请求或现有方案实现 |
| `~prd` | 通过逐维度讨论生成现代产品需求文档 |
| `~loop` | 设置指标和守卫命令，循环改进、保留或回滚 |
| `~wiki` | 只创建或同步项目知识库 |
| `~init` | 完整项目初始化：知识库、项目级规则文件和包根链接 |
| `~test` | 为指定模块或最近变更编写测试 |
| `~verify` | 审查、运行验证命令、修复失败并收尾 |
| `~commit` | 生成规范化提交信息并同步知识库 |
| `~clean` | 归档已完成方案，清理临时运行文件 |
| `~help` | 显示命令和当前设置 |

兼容别名：

- `~do` → `~build`
- `~design` → `~plan`
- `~review` → `~verify` 的审查优先模式

### 3）项目知识库

HelloAGENTS 可以在 `.helloagents/` 下创建和维护项目知识库。

知识库让后续对话不用反复重新理解同一批项目事实。它可以包含：

| 文件或目录 | 用途 |
|------------|------|
| `context.md` | 项目概览、技术栈、架构、模块索引 |
| `guidelines.md` | 从仓库推断出的非显而易见编码约定 |
| `verify.yaml` | lint、test、build 等验证命令 |
| `CHANGELOG.md` | 项目级变更记录 |
| `DESIGN.md` | UI 项目的稳定设计契约 |
| `modules/*.md` | 模块级说明和经验 |
| `plans/<feature>/` | 活跃方案包 |
| `archive/` | 已归档方案包 |

`~wiki` 只创建或更新知识库。

`~init` 做得更多：创建或更新知识库、写入项目级规则文件，并刷新各宿主项目级 HelloAGENTS 包根链接。

### 4）结构化方案包

复杂任务不再只依赖聊天里的几段说明，而是可以落成方案包。

`~plan` 使用：

- `requirements.md`
- `plan.md`
- `tasks.md`
- `contract.json`

`~prd` 还会生成 PRD 文件，例如：

- `prd/00-overview.md`
- `prd/01-user-stories.md`
- `prd/02-functional.md`
- `prd/03-ui-design.md`
- `prd/04-technical.md`
- `prd/05-nonfunctional.md`
- `prd/06-i18n-l10n.md`
- `prd/07-accessibility.md`
- `prd/08-content.md`
- `prd/09-testing.md`
- `prd/10-deployment.md`
- `prd/11-legal-privacy.md`
- `prd/12-timeline.md`

`contract.json` 会影响验证范围、reviewer/tester 关注点、可选 advisor 检查和可选视觉验收。

`tasks.md` 还会保留 Codex `/goal` 执行入口。长程 Codex 任务应使用这个已拆分入口，不要把原始产品文档直接交给 `/goal`。HelloAGENTS 保持 `/goal` 的 Codex 原生定位，只把它作为续跑和预算控制；方案文件、任务边界、验证与收尾仍由 HelloAGENTS 负责。

### 5）状态与恢复

长任务需要一个小型恢复快照，但多个对话共用一个状态文件并不安全。

HelloAGENTS 现在只从 `state_path` 解析当前状态文件：

- 宿主提供稳定会话标识时：`.helloagents/sessions/<workspace>/<session>/STATE.md`
- 宿主未提供稳定会话标识时：`.helloagents/sessions/<workspace>/default/STATE.md`

`<workspace>` 是当前 Git 分支、detached HEAD 的 `detached-<sha>`，或非 Git 项目的 `workspace`。`.helloagents/sessions/active.json` 只记录当前活跃会话索引。

`STATE.md` 只记录当前工作流做到哪里，不承担所有对话的统一记忆。

### 6）验证与交付证据

HelloAGENTS 不把“命令通过”和“任务完成”简单画等号。交付还可能要求需求覆盖、任务清单、审查证据、advisor 证据和视觉证据。

运行态证据文件包括：

- `.helloagents/sessions/<workspace>/<session>/capsule.json`
- `.helloagents/sessions/<workspace>/<session>/events.jsonl`
- `.helloagents/sessions/active.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/review.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/advisor.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/visual.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/closeout.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/loop-results.tsv`

交付门控、守卫和循环提示使用执行性表述，例如处理路径、收尾动作和视觉验收动作。阻塞流程会说明下一步要做什么，而不是把可执行步骤写成泛化建议。最终收尾还会强制只保留一个 HelloAGENTS 外层块，避免同一条回复重复输出完成标题。

### 7）更安全的安装、更新、清理和诊断

CLI 显式管理宿主文件：

- `install` 只写入指定目标，除非使用 `--all`
- `update` 刷新指定目标或全部目标
- `cleanup` 删除受管注入和链接
- `uninstall` 在移除包前执行对应清理
- `doctor` 检查规则文件、链接、hooks、配置项、插件根目录、缓存副本和版本漂移
- 单 CLI 模式记录只会在宿主安装成功后写入，避免原生全局安装失败后留下错误模式记录

## 快速开始

### 1）安装包

```bash
npm install -g helloagents
```

如果系统里已经有别的 `helloagents` 可执行文件，可以使用稳定的受管入口别名：

```bash
helloagents-js
```

默认情况下，`postinstall` 会安装包命令、初始化 `~/.helloagents/helloagents.json`，并把运行时文件同步到 `~/.helloagents/helloagents`。如果希望 npm 在安装或更新后直接部署，设置 `HELLOAGENTS=目标[:模式]`，例如 `HELLOAGENTS=codex:global`。

### 2）部署到目标 CLI

想按项目显式激活，使用标准模式：

```bash
helloagents install codex --standby
helloagents install --all --standby
```

想在所有项目默认启用完整规则，使用全局模式：

```bash
helloagents --global
helloagents install --all --global
```

重装、刷新或切换模式后，请重启对应 AI CLI 或新开会话；已运行会话不会自动重载注入规则。

### 3）在 AI CLI 里验证

输入：

```text
~help
```

应能看到 13 个对话命令和当前设置。

### 4）创建项目知识

只创建知识库：

```text
~wiki
```

完整初始化项目：

```text
~init
```

## CLI 管理

### Shell 命令

```bash
helloagents --standby
helloagents --global
helloagents install codex --standby
helloagents install --all --global
helloagents update codex
helloagents cleanup claude --global
helloagents uninstall gemini
helloagents switch-branch beta
helloagents switch-branch beta claude --global
helloagents doctor
helloagents doctor codex --json
helloagents codex goals status
helloagents codex goals enable
```

支持的目标：

- `claude`
- `gemini`
- `codex`
- `--all`

省略 `--standby` 或 `--global` 时，HelloAGENTS 会先复用该 CLI 已记录或检测到的模式，再回退到 `standby`。

### npm 和一键脚本入口

当你不想依赖更新过程中的 `helloagents` 可执行文件时，用 npm 或一键脚本。`HELLOAGENTS=目标[:模式]` 中，目标支持 `all`、`claude`、`gemini`、`codex`；模式支持 `standby`、`global`，省略时默认 `standby`。

宿主配置使用稳定的 `helloagents-js` 入口和运行根目录 `~/.helloagents/helloagents`，Node 全局包路径变化不会破坏受管 hooks 或 Codex `notify`。Codex hooks 使用独立 `~/.codex/hooks.json`，不把大段配置写入 `config.toml`；Codex 全局插件根目录和插件缓存也会回链到这个稳定运行根目录。

#### npm 命令

macOS / Linux：

```bash
# 安装到 Codex，标准模式
HELLOAGENTS=codex npm install -g helloagents

# 安装到 Codex，全局模式
HELLOAGENTS=codex:global npm install -g helloagents

# 更新并同步 Claude，标准模式
HELLOAGENTS=claude:standby npm update -g helloagents

# 切换到 beta 分支并同步全部 CLI，标准模式
HELLOAGENTS=all:standby npm install -g github:hellowind777/helloagents#beta

# 卸载包前清理 Gemini 集成
npm explore -g helloagents -- npm run uninstall -- gemini --standby
npm uninstall -g helloagents
```

Windows PowerShell：

```powershell
# 安装到 Codex，标准模式
$env:HELLOAGENTS="codex"; npm install -g helloagents

# 安装到 Codex，全局模式
$env:HELLOAGENTS="codex:global"; npm install -g helloagents

# 更新并同步 Claude，标准模式
$env:HELLOAGENTS="claude:standby"; npm update -g helloagents

# 切换到 beta 分支并同步全部 CLI，标准模式
$env:HELLOAGENTS="all:standby"; npm install -g github:hellowind777/helloagents#beta

# 卸载包前清理 Gemini 集成
npm explore -g helloagents -- npm run uninstall -- gemini --standby
npm uninstall -g helloagents
```

包已安装后，也可以直接调用包内 npm scripts：

```bash
npm explore -g helloagents -- npm run deploy:global
npm explore -g helloagents -- npm run sync-hosts -- --all --standby
npm explore -g helloagents -- npm run cleanup-hosts -- codex --standby
npm explore -g helloagents -- npm run uninstall -- --all --standby
```

#### 一键脚本

macOS / Linux：

```bash
# 安装
HELLOAGENTS=codex curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# 更新
HELLOAGENTS=claude:standby HELLOAGENTS_ACTION=update curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# 切换分支
HELLOAGENTS=all:global HELLOAGENTS_ACTION=switch-branch HELLOAGENTS_BRANCH=beta curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# 只清理宿主集成，不卸载包
HELLOAGENTS=codex:standby HELLOAGENTS_ACTION=cleanup curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# 卸载
HELLOAGENTS=gemini HELLOAGENTS_ACTION=uninstall curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh
```

Windows PowerShell：

```powershell
# 安装
$env:HELLOAGENTS="codex"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# 更新
$env:HELLOAGENTS="claude:standby"; $env:HELLOAGENTS_ACTION="update"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# 切换分支
$env:HELLOAGENTS="all:global"; $env:HELLOAGENTS_ACTION="switch-branch"; $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# 只清理宿主集成，不卸载包
$env:HELLOAGENTS="codex:standby"; $env:HELLOAGENTS_ACTION="cleanup"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# 卸载
$env:HELLOAGENTS="gemini"; $env:HELLOAGENTS_ACTION="uninstall"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex
```

PowerShell 包装脚本现在会传递与 `install.sh` 相同的 npm 参数，因此安装、更新、清理、卸载和 `switch-branch` 走的是同一条生命周期链路。

### 分支切换

`switch-branch` 会先安装指定 npm/GitHub ref，再通过 npm 脚本同步宿主 CLI，避免依赖更新过程中的 `helloagents` 可执行文件：

```bash
helloagents switch-branch beta
helloagents switch-branch beta claude --global
helloagents branch github:hellowind777/helloagents#beta --all --standby
```

如果只想切换包本身，暂不同步宿主 CLI，可以直接使用 npm：

```bash
npm install -g github:hellowind777/helloagents#beta
npm update -g helloagents
npm explore -g helloagents -- npm run uninstall -- --all --standby
npm uninstall -g helloagents
```

### 标准模式文件

| CLI | 写入或更新的文件 | 清理行为 |
|-----|------------------|----------|
| Claude Code | `~/.claude/CLAUDE.md`、`~/.claude/settings.json`、`~/.claude/helloagents -> ~/.helloagents/helloagents` | 删除受管标记块、HelloAGENTS hooks / 权限和符号链接 |
| Gemini CLI | `~/.gemini/GEMINI.md`、`~/.gemini/settings.json`、`~/.gemini/helloagents -> ~/.helloagents/helloagents` | 删除受管标记块、HelloAGENTS hooks 和符号链接 |
| Codex CLI | `~/.codex/AGENTS.md`、`~/.codex/config.toml`、`~/.codex/hooks.json`、`~/.codex/helloagents -> ~/.helloagents/helloagents`、受管备份 | 删除受管标记块、受管配置键、受管 hooks、符号链接和最近一次受管备份 |

### 全局模式文件

| CLI | 安装方式 | 涉及文件 |
|-----|----------|----------|
| Claude Code | 原生插件安装 | 由 Claude Code 插件系统管理 |
| Gemini CLI | 原生扩展安装 | 由 Gemini 扩展系统管理 |
| Codex CLI | 原生本地插件流程 | `~/.agents/plugins/marketplace.json`、`~/plugins/helloagents/ -> ~/.helloagents/helloagents`、`~/.codex/plugins/cache/local-plugins/helloagents/local/ -> ~/.helloagents/helloagents`、`~/.codex/config.toml`、`~/.codex/hooks.json`、`~/.codex/helloagents -> ~/.helloagents/helloagents` |

全局模式下，HelloAGENTS 会自动尝试宿主原生命令。若宿主命令不可用，再手动执行：

```text
/plugin marketplace add hellowind777/helloagents
/plugin install helloagents@helloagents
gemini extensions install https://github.com/hellowind777/helloagents
```

Claude Code 会自动尝试等价的 `claude plugin marketplace add ...` 和 `claude plugin install ...` 命令。marketplace 名称和插件名称都是 `helloagents`，所以安装目标是 `helloagents@helloagents`。全局安装后需要重启宿主 CLI。

Codex 全局模式由 HelloAGENTS 通过本地插件路径自动安装。

## 对话命令

### 常见流程

| 目标 | 使用 |
|------|------|
| 写文件前先比较方案 | `~idea "compare two API designs"` |
| 让 HelloAGENTS 自己选路并持续推进 | `~auto "add JWT login"` |
| 先审查方案再实现 | `~plan "refactor payment module"` |
| 按明确请求或活跃方案实现 | `~build "finish task 2 in the plan"` |
| 生成完整产品需求文档 | `~prd "modern dashboard for operations team"` |
| 按指标迭代优化 | `~loop "reduce bundle size" --metric "npm run size" --direction lower` |
| 只创建或刷新项目知识 | `~wiki` |
| 完整激活项目工作流 | `~init` |
| 验证当前工作 | `~verify` |
| 生成提交信息并同步知识库 | `~commit` |

### 已激活项目与未激活项目

标准模式下，未激活项目只获得轻量规则和显式 `~command` 入口。项目中出现 `.helloagents/` 后才进入项目级工作流，通常由 `~wiki` 或 `~init` 创建。

全局模式下，HelloAGENTS 默认启用完整规则。

## 项目知识库

### 本地模式

默认情况下，项目知识写在项目内：

```text
.helloagents/
```

这个目录同时承担：

- 激活信号
- 本地知识库目录
- 方案目录
- 状态与运行态目录

### 共享模式

当 `project_store_mode = "repo-shared"` 时：

- 本地 `.helloagents/` 保留激活和运行态文件
- 稳定知识和方案文件写到 `~/.helloagents/projects/<repo-key>/`
- 同一 git 仓库的多个 worktree 可以共享这些稳定资料

运行态文件仍保留在当前项目本地：

- `state_path`
- `.helloagents/sessions/<workspace>/<session>/capsule.json`
- `.helloagents/sessions/<workspace>/<session>/events.jsonl`
- `.helloagents/sessions/active.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/*.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/loop-results.tsv`

### 未激活或临时会话

如果当前目录及其父级没有项目激活目录 `.helloagents/`，HelloAGENTS 不会自动写入项目目录。临时运行态写到用户级目录：

```text
~/.helloagents/runtime/<scope-key>/
```

这里仅保存短期的 `capsule.json`、`events.jsonl` 和 `artifacts/`，不作为项目知识库。过期临时会话会按 TTL 清理。

### 知识创建规则

| 命令或配置 | 行为 |
|------------|------|
| `~wiki` | 只创建或同步知识库 |
| `~init` | 创建知识库，同时写入项目级规则文件和包根链接 |
| `kb_create_mode = 0` | 关闭自动知识更新 |
| `kb_create_mode = 1` | 已激活项目或全局模式中，编码任务自动更新知识 |
| `kb_create_mode = 2` | 已激活项目或全局模式中，更积极地更新知识 |

## 工作流与交付

### 工作流阶段

结构化任务使用以下阶段：

```text
ROUTE / TIER → SPEC → PLAN → BUILD → VERIFY → CONSOLIDATE
```

| 阶段 | 用途 |
|------|------|
| `ROUTE / TIER` | 判断任务应走 idea、plan、build、verify、PRD 还是自动流程 |
| `SPEC` | 明确目标、约束和完成标准 |
| `PLAN` | 准备方案文件并选择需要的技能 |
| `BUILD` | 实现并做局部检查 |
| `VERIFY` | 审查、运行命令、核对契约和证据 |
| `CONSOLIDATE` | 更新状态、知识库和收尾证据 |

### 交付分层

| 分层 | 典型场景 |
|------|----------|
| `T0` | 只读分析、点子探索、方案比较 |
| `T1` | 低风险小修复或明确验证 |
| `T2` | 多文件功能、新项目、结构化方案 |
| `T3` | 高风险或不可逆工作，如认证、支付、数据库、发布、生产操作 |

### UI 工作流

UI 任务遵循以下优先级：

1. 当前 `plan.md` 或 PRD 中的 UI 决策
2. `.helloagents/DESIGN.md`
3. `hello-ui` 的实现和验收规则，与共享 UI 质量基线共同生效

更重的 UI 任务可以通过 `contract.json` 要求：

- `ui.styleAdvisor.required`
- `ui.visualValidation.required`

这些要求分别通过当前会话的 `artifacts/advisor.json` 和 `artifacts/visual.json` 收尾。

### 验证命令来源

验证命令按以下顺序检测：

1. 逻辑 `.helloagents/verify.yaml`
2. `package.json` 等包管理脚本
3. 自动检测

当 `project_store_mode = "repo-shared"` 时，逻辑 `.helloagents/verify.yaml` 会从共享项目存储中解析。

## 配置

配置文件：

```text
~/.helloagents/helloagents.json
```

默认结构：

```json
{
  "output_language": "",
  "output_format": true,
  "notify_level": 0,
  "ralph_loop_enabled": true,
  "guard_enabled": true,
  "kb_create_mode": 1,
  "project_store_mode": "local",
  "commit_attribution": "",
  "install_mode": "standby",
  "host_install_modes": {}
}
```

| 键 | 默认值 | 含义 |
|----|--------|------|
| `output_language` | `""` | 默认跟随用户语言 |
| `output_format` | `true` | 主代理最终收尾必须使用 HelloAGENTS 格式；中间输出和子代理输出保持自然 |
| `notify_level` | `0` | `0` 关闭，`1` 桌面通知，`2` 声音，`3` 两者 |
| `ralph_loop_enabled` | `true` | 显式 `~verify` / `~loop` 或收尾要求时运行验证 |
| `guard_enabled` | `true` | 拦截危险命令 |
| `kb_create_mode` | `1` | 控制知识库自动更新 |
| `project_store_mode` | `"local"` | `local` 或 `repo-shared` |
| `commit_attribution` | `""` | 提交信息附加署名 |
| `install_mode` | `"standby"` | 当前默认安装模式 |
| `host_install_modes` | `{}` | 受管的单 CLI 模式记录，如 `{ "codex": "standby" }`；仅在宿主安装成功后写入，并优先于 `install_mode` |

## 各 CLI 集成方式

### Claude Code

- 标准模式写入 `~/.claude/CLAUDE.md`
- 标准模式在 `~/.claude/settings.json` 中写入受管 hooks 和权限
- 标准模式创建 `~/.claude/helloagents -> ~/.helloagents/helloagents`
- 全局模式使用 Claude Code 插件系统

### Gemini CLI

- 标准模式写入 `~/.gemini/GEMINI.md`
- 标准模式在 `~/.gemini/settings.json` 中写入受管 hooks
- 标准模式创建 `~/.gemini/helloagents -> ~/.helloagents/helloagents`
- 全局模式使用 Gemini 扩展系统

### Codex CLI

Codex 默认走规则文件驱动。

- 标准模式写入 `~/.codex/AGENTS.md`
- 标准模式写入可移植的受管 `model_instructions_file = "~/.codex/AGENTS.md"`
- 标准模式写入受管 `notify = ["helloagents-js", "codex-notify"]` 命令用于收尾通知
- 标准模式把静默 Codex hooks 写入 `~/.codex/hooks.json`
- Codex 的 `SessionStart` 保持静默，并在运行时读取当前 `~/.helloagents/helloagents.json`，不会把配置快照固化进 `config.toml`，因此首次对话和上下文压缩后的设置都能保持最新
- 安装和更新还会把 HelloAGENTS 受管的 Codex hook trust 状态同步到 `~/.codex/config.toml`，因此 Codex 0.129.0+ 不会再对这些受管 hooks 反复提示确认
- 这些 hook trust 状态是基于当前机器 `~/.codex/hooks.json` 真实绝对路径生成的本机状态；它不同于 `model_instructions_file = "~/.codex/AGENTS.md"` 这类可移植配置，应在每台机器上重新生成
- 标准模式创建 `~/.codex/helloagents -> ~/.helloagents/helloagents`
- 全局模式安装原生本地插件流程，但仍把 `~/.helloagents/helloagents` 作为唯一受管运行时源；插件根目录、插件缓存和 `~/.codex/helloagents` 都会回链到它
- 清理时只删除 HelloAGENTS 自己写入的 hook trust 条目和旧式受管 notify 残留，不影响用户已有的 hook 状态
- Codex hooks 只做静默运行态同步和 Stop 门禁，不通过 hook 注入 HelloAGENTS 规则或路由说明
- Codex 收尾会对 Stop hook 和原生 `codex-notify` 去重，避免同一轮重复通知
- `/goal` 保持 Codex 原生能力；需要长程执行时，用 `helloagents codex goals enable` 显式启用
- 感知 goal 的命令从 `tasks.md`、`contract.json` 和 `state_path` 恢复；不会自动创建 goal，也不会在 HelloAGENTS 验证和收尾前标记完成

## 验证

运行全部测试：

```bash
npm test
```

当前测试共 116 项，覆盖：

- 安装、更新、卸载、清理和模式切换
- PowerShell 一键脚本的安装、更新、清理、卸载和分支切换分发链路
- Claude、Gemini、Codex 的配置合并与恢复
- Codex 受管 `model_instructions_file`、`notify`、`hooks.json`、hook trust 状态、本地插件、marketplace 和缓存行为
- Windows 下 Codex 旧式受管 notify 变体的清理，以及受管 notify 恢复规则
- Codex `/goal` 功能开关、长程路由上下文和 goal 感知命令契约
- `helloagents doctor`
- 项目存储和 `repo-shared`
- 会话级 `state_path`、运行态信号和证据
- 运行时选路、Guard、验证、视觉证据、交付门控、单次收尾包装校验，以及原生安装失败后的模式记录
- README 与 skill 契约一致性

## FAQ

### `docs/` 的作用是什么？

`docs/` 只作为用户和 AI 理解项目的参考材料，可能滞后于实现。运行时行为以源码、规则模板、skills、templates 和测试为准。

### 这是 CLI 工具还是提示词框架？

两者都是。

- `cli.mjs` 负责安装、更新、清理、诊断和宿主配置
- 规则模板定义运行时加载的工作流规则
- `skills/` 定义任务类型相关行为
- `scripts/` 提供选路、Guard、通知、验证、状态和证据等运行时辅助能力

### 应该用 `~wiki` 还是 `~init`？

只想创建项目知识库，用 `~wiki`。

还想写入项目级规则文件和宿主项目级 HelloAGENTS 包根链接，用 `~init`。

### standby 和 global 有什么区别？

`standby` 更轻量、更显式。它只把规则部署到指定 CLI，完整项目流程由项目激活触发。

`global` 默认更广泛地启用完整规则。Claude 和 Gemini 使用原生插件 / 扩展；Codex 使用本地插件路径。

### Codex hooks 会显示注入内容吗？

不会显示 HelloAGENTS 规则或路由说明。HelloAGENTS 的 Codex hooks 只写运行态和执行 Stop 门禁，成功路径返回静默结果；只有阻塞或错误时显示必要原因。

### 可以关闭通知或 Guard 吗？

可以。

- 把 `notify_level` 设为 `0` 可关闭通知
- 把 `guard_enabled` 设为 `false` 可关闭命令 Guard

### `npm uninstall -g helloagents` 会删除项目知识库吗？

不会。卸载包前运行 `npm explore -g helloagents -- npm run uninstall -- --all --standby`，会清理宿主集成和稳定运行副本。项目 `.helloagents/` 文件和 `~/.helloagents/helloagents.json` 会保留，除非你手动删除。

## 故障排除

### `~help` 无法识别

检查：

```bash
npm list -g helloagents
helloagents doctor
```

然后重启目标 CLI。

### 某个 CLI 已安装但行为像旧版本

运行：

```bash
helloagents doctor
helloagents update codex
helloagents --standby
helloagents --global
```

根据当前安装模式和目标 CLI 选择对应命令。

### Codex 本地切分支后仍使用旧文件

刷新 Codex：

```bash
helloagents update codex
```

全局模式也可以运行：

```bash
helloagents --global
```

### 通知不工作

先检查 `notify_level`。

- Windows：PowerShell 需要能显示桌面通知或播放声音
- macOS：需要 `afplay`
- Linux：需要 `aplay`、`paplay` 或 `notify-send`

### Guard 拦截了你确实想执行的命令

先复查命令。Guard 会拦截已知破坏性操作，并对风险写入给出提醒。如果你仍要关闭：

```json
{ "guard_enabled": false }
```

## 许可证

代码使用 [Apache-2.0](./LICENSE.md)，文档使用 CC BY 4.0。

## 参与贡献

- Bug 反馈：[提交 issue](https://github.com/hellowind777/helloagents/issues)
- 功能建议：[提交 issue](https://github.com/hellowind777/helloagents/issues)
- 欢迎提交 PR

---

<div align="center">

如果这个项目对你有帮助，点个 star 就是最好的支持。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持。

</div>

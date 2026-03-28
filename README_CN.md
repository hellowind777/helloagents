<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**质量驱动的 AI 编码 CLI 编排内核 — 14 个自动激活技能、流程纪律、检查清单门控。**

[![Version](https://img.shields.io/badge/version-3.0.0-orange.svg)](./package.json)
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
> **找 v2.x？** 旧版 Python 代码库已迁移到独立归档仓库：[helloagents-archive](https://github.com/hellowind777/helloagents-archive)。v3.0.0 是完全重写 — 纯 Node.js/Markdown 架构，无 Python 依赖。

## 📑 目录

<details>
<summary><strong>点击展开</strong></summary>

- [🎯 为什么选择 HelloAGENTS？](#-为什么选择-helloagents)
- [✨ 核心特性](#-核心特性)
- [🚀 快速开始](#-快速开始)
- [📖 命令](#-命令)
- [🔧 配置](#-配置)
- [⚙️ 工作原理](#️-工作原理)
- [📚 使用指南](#-使用指南)
- [❓ FAQ](#-faq)
- [🛠️ 故障排除](#️-故障排除)
- [📈 版本历史](#-版本历史)
- [📜 许可证](#-许可证)

</details>

## 🎯 为什么选择 HelloAGENTS？

你有没有遇到过这种情况：AI 编码助手分析了一通，最后来一句"建议你这样做"就结束了？或者写了代码但跳过测试、忽略边界情况，然后说"完成了"？

HelloAGENTS 就是为了解决这个问题。它是一个编排层，装在你的 AI CLI 上面，在每一步都强制执行质量标准。

<table>
<tr>
<td width="50%" valign="top" align="center">

**没有 HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="没有 HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**有 HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="有 HelloAGENTS" width="520">

</td>
</tr>
</table>

| 挑战 | 没有 HelloAGENTS | 有 HelloAGENTS |
|------|-----------------|----------------|
| **止步于规划** | 给建议就结束 | 推进到实现和验证 |
| **质量不一致** | 看 prompt 运气 | 14 个技能按任务类型自动激活 |
| **危险操作** | 容易误执行破坏性命令 | Guard 系统拦截危险命令 |
| **没有验证** | "应该能用" | Ralph Loop 完成前自动跑 lint/test/build |
| **知识丢失** | 上下文散落各处 | 项目知识库持久化并持续积累 |

### 💡 最适合
- ✅ **使用 AI CLI 的开发者**，想要一致的、经过验证的输出
- ✅ **团队**，需要 AI 辅助编码的质量护栏
- ✅ **复杂项目**，需要结构化的 设计 → 开发 → 验证 工作流

### ⚠️ 不适合
- ❌ 简单的一次性问题（HelloAGENTS 会增加流程开销）
- ❌ 非编码任务（针对软件工程优化）
- ❌ Claude Code 和 Codex CLI 以外的 CLI（v3.0.0 仅支持这两个）

## ✨ 核心特性

HelloAGENTS 通过三重机制协同保障质量：

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**🎯 14 个自动激活质量技能**

技能根据你正在做的事情自动激活，无需配置。
- UI、安全、API、架构、性能
- 测试、错误处理、数据、代码审查
- 调试、子代理、文档、验证、反思

**你的收益：** 每个任务都能得到正确的质量检查，不用你记着去要求。

</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**📋 检查清单门控**

编码完成后，HelloAGENTS 收集所有已激活技能的交付检查清单，逐项验证通过才能报告完成。

**你的收益：** 没有真正通过质量检查的东西不会被标记为"完成"。

</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**🛡️ Guard 系统 + Ralph Loop**

L1 拦截破坏性命令（`rm -rf /`、`git push --force`、`DROP DATABASE`）。L2 扫描硬编码密钥和安全模式。Ralph Loop 在每个任务后自动运行验证命令。

**你的收益：** 零配置的安全防护，每次输出都经过验证。

</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**⚡ 结构化工作流**

简单任务直接执行。复杂任务走完整的 ORIENT → CLARIFY → PLAN → EXECUTE → VALIDATE 五阶段流程，包含交互式设计、方案提议和计划包。

**你的收益：** 按需投入 — 简单任务保持快速，复杂任务获得完整流程。

</td>
</tr>
</table>

## 🚀 快速开始

### Claude Code（推荐）

```bash
claude plugin add helloagents
```

搞定。插件自动加载 `bootstrap.md` 规则、hooks 和全部 14 个质量技能。

### Codex CLI

```bash
npm install -g helloagents
```

`postinstall` 脚本自动配置 Codex CLI — 设置 `config.toml`、skills 符号链接和 hooks。

### 验证安装

```bash
# 在 AI CLI 对话中输入：
~help
```

**预期输出：**
```
💡【HelloAGENTS】- 帮助

可用命令: ~auto, ~design, ~prd, ~loop, ~init, ~test, ~verify, ~review, ~commit, ~clean, ~help

自动激活技能 (14): hello-ui, hello-api, hello-security, hello-test, hello-verify, hello-errors, hello-perf, hello-data, hello-arch, hello-debug, hello-subagent, hello-review, hello-write, hello-reflect
```

### 首次使用

```bash
# 简单任务 — 直接执行
"修复 src/utils.ts 第 42 行的拼写错误"

# 复杂任务 — 用 ~auto 走完整流程
~auto "添加基于 JWT 的用户认证"

# 想先看方案？
~design "重构支付模块"
```

## 📖 命令

所有命令在 AI 对话中使用 `~` 前缀：

**工作流命令：**

| 命令 | 说明 |
|------|------|
| `~auto` | 全自动工作流 — AI 判断复杂度，自动规划并执行 |
| `~design` | 深度交互式设计 — 需求挖掘 + 方案提议 + 计划包 |
| `~prd` | 完整 PRD — 13 维度头脑风暴式探索，生成产品需求文档 |
| `~loop` | 自主迭代优化 — 设定目标和指标，AI 循环改进直到达标 |

**质量命令：**

| 命令 | 说明 |
|------|------|
| `~test` | 编写完整测试（TDD：Red → Green → Refactor） |
| `~verify` | 运行所有验证命令（lint/test/build/typecheck） |
| `~review` | 代码审查，按严重程度分类 |

**工具命令：**

| 命令 | 说明 |
|------|------|
| `~init` | 初始化项目知识库（`.helloagents/`） |
| `~commit` | 生成规范化提交信息 + 知识库同步 |
| `~clean` | 归档已完成方案，清理临时文件 |
| `~help` | 显示所有命令和当前配置 |

## 🔧 配置

配置文件：`~/.helloagents/helloagents.json`（安装时自动创建）

只需包含你想覆盖的键，缺失的键使用默认值。

```json
{
  "output_language": "",
  "output_format": true,
  "notify_level": 0,
  "ralph_loop_enabled": true,
  "guard_enabled": true,
  "kb_create_mode": 1,
  "commit_attribution": ""
}
```

| 配置项 | 默认值 | 说明 |
|--------|-------|------|
| `output_language` | `""` | 空=跟随用户语言，填写 `zh-CN`、`en` 等指定 |
| `output_format` | `true` | `true`=HelloAGENTS 格式输出，`false`=自然输出 |
| `notify_level` | `0` | `0`=关闭，`1`=桌面通知，`2`=声音，`3`=两者 |
| `ralph_loop_enabled` | `true` | 任务完成时自动运行验证 |
| `guard_enabled` | `true` | 拦截危险命令（仅 Claude Code） |
| `kb_create_mode` | `1` | `0`=关闭，`1`=编码任务自动，`2`=始终 |
| `commit_attribution` | `""` | 空=不添加，填写内容则追加到 commit message |

<details>
<summary>📝 常见配置场景</summary>

**纯英文输出：**
```json
{ "output_language": "en" }
```

**关闭知识库自动创建：**
```json
{ "kb_create_mode": 0 }
```

**开启桌面+声音通知：**
```json
{ "notify_level": 3 }
```

**关闭 Guard（不推荐）：**
```json
{ "guard_enabled": false }
```

</details>

## ⚙️ 工作原理

**简单说：** HelloAGENTS 根据任务复杂度自动选择处理深度。简单任务直接执行，复杂任务走完整的五阶段流程，每一步都有质量验证。

**五阶段流程：**

1. **ORIENT** — 读取项目上下文（`.helloagents/context.md`、`guidelines.md`、`DESIGN.md`），扫描相关代码
2. **CLARIFY** — 消除歧义。简单任务跳过，复杂任务确认关键决策
3. **PLAN** — 标记需要哪些质量技能，使用 `~design` 或 `~prd` 时生成设计/计划
4. **EXECUTE** — 实现，TDD（写测试 → 写代码 → 重构），每步后验证
5. **VALIDATE** — 运行 Ralph Loop（lint/test/build），收集已激活技能的交付检查清单，逐项验证

**路由规则：**
- 简单任务（单文件、明确修复）→ 直接执行
- 复杂任务（3+ 文件、架构变更、新项目）→ 通过 `~design` 或 `~auto` 走完整流程

**质量技能按任务类型自动激活：**
- 写 UI 代码？→ `hello-ui` 激活（设计 token、无障碍、响应式）
- 涉及 API？→ `hello-api` 激活（REST 规范、校验、错误格式）
- 任何代码变更？→ `hello-test`、`hello-verify`、`hello-review` 激活

## 📚 使用指南

### 三种工作流模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `~auto` | 全自动流程：评估 → 设计 → 开发 → 验证 | 需求明确，想要端到端交付 |
| `~design` | 仅交互式设计，生成计划包 | 想先审查方案再编码 |
| `~prd` | 13 维度 PRD 生成 | 需要完整的产品需求文档 |

典型模式：先 `~design` → 审查方案 → 开始编码。或者直接 `~auto` 一步到位。

### 质量验证（Ralph Loop）

每个任务完成后，Ralph Loop 自动运行项目的验证命令：
- 优先级：`.helloagents/verify.yaml` → `package.json` scripts → 自动检测
- 全部通过？→ 收集技能检查清单 → 验证 → 完成
- 有失败？→ 反思 → 修复 → 重跑（3 次连续失败后触发熔断）

### 知识库（`.helloagents/`）

`~init` 创建项目本地知识库：

| 文件 | 用途 |
|------|------|
| `STATE.md` | AI 上下文快照（≤50 行，压缩后存活） |
| `DESIGN.md` | 设计系统（仅 UI 项目） |
| `context.md` | 项目架构、技术栈、约定 |
| `guidelines.md` | 非显而易见的编码规则 |
| `verify.yaml` | 验证命令 |
| `CHANGELOG.md` | 变更历史 |
| `modules/*.md` | 模块文档 + 经验 |
| `plans/` | 活跃计划包 |
| `archive/` | 已完成计划包 |

### 智能提交（~commit）

- 分析 `git diff` 生成 Conventional Commits 格式消息
- 提交前质量检查（代码-文档一致性、测试覆盖）
- 自动排除敏感文件（`.env`、`*.pem`、`*.key`）
- 遵循 `commit_attribution` 配置
- 按 `kb_create_mode` 设置同步知识库

### 自主迭代优化（~loop）

设定目标和指标，让 AI 自主迭代：
1. 审查 → 构思 → 修改 → 提交 → 验证 → 决策 → 记录 → 重复
2. 结果记录在 `.helloagents/loop-results.tsv`
3. 失败实验使用 `git revert` 干净回滚

## ❓ FAQ

<details>
<summary><strong>Q：这是 CLI 工具还是 prompt 框架？</strong></summary>

**A：** 两者都是。CLI（`cli.mjs`）负责安装和 Codex 配置。实际的工作流来自 `bootstrap.md` 规则、质量技能和 hook 脚本。可以理解为：交付系统 + 智能质量协议。
</details>

<details>
<summary><strong>Q：v2.x 到 v3.0.0 有什么变化？</strong></summary>

**A：** 全部重写了：
- Python 包 → 纯 Node.js/Markdown 架构
- 15 个命令 → 11 个命令 + 14 个自动激活质量技能
- 6 个 CLI 目标 → 2 个（Claude Code + Codex CLI）
- 新增：检查清单门控、Guard 系统、~prd、~loop、~verify、设计系统生成
- 详见[版本历史](#-版本历史)。
</details>

<details>
<summary><strong>Q：该用哪个 CLI？</strong></summary>

**A：** Claude Code 体验最好（插件系统、11 个生命周期 hooks、Agent Teams 支持）。Codex CLI 也不错（npm postinstall 自动配置）。v3.0.0 不支持其他 CLI。
</details>

<details>
<summary><strong>Q：14 个质量技能是什么？</strong></summary>

**A：** 按任务类型自动激活：
- **hello-ui**：UI 构建（设计 token、无障碍、响应式、动画）
- **hello-api**：API 设计（REST、校验、错误格式、限流）
- **hello-security**：安全（认证、输入校验、XSS/CSRF、密钥管理）
- **hello-test**：测试（TDD 流程、边界用例、AAA 模式）
- **hello-verify**：验证门控（Ralph Loop、熔断器）
- **hello-errors**：错误处理（结构化错误、日志、恢复策略）
- **hello-perf**：性能（N+1、缓存、代码分割、虚拟滚动）
- **hello-data**：数据库（迁移、事务、索引、完整性）
- **hello-arch**：架构（SOLID、边界、代码体积限制）
- **hello-debug**：调试（四阶段流程、卡住时升级）
- **hello-subagent**：子代理编排（分发、协调、审查）
- **hello-review**：代码审查（逻辑、安全、性能、可维护性）
- **hello-write**：文档（金字塔原则、受众感知）
- **hello-reflect**：经验捕获（教训 → 知识库）
</details>

<details>
<summary><strong>Q：项目知识存在哪里？</strong></summary>

**A：** 项目本地的 `.helloagents/` 目录。由 `~init` 创建，代码变更时自动同步（由 `kb_create_mode` 控制）。上下文跨会话持久化。
</details>

<details>
<summary><strong>Q：Guard 系统是什么？</strong></summary>

**A：** 两层安全防护：
- **L1 拦截**：执行前阻止破坏性命令（`rm -rf /`、`git push --force`、`DROP DATABASE`、`chmod 777`、`FLUSHALL`）
- **L2 建议**：扫描文件写入中的硬编码密钥、API key、.env 暴露 — 警告但不阻止
</details>

<details>
<summary><strong>Q：可以关闭不需要的功能吗？</strong></summary>

**A：** 可以。设置 `guard_enabled: false` 关闭 Guard，`ralph_loop_enabled: false` 跳过验证，`kb_create_mode: 0` 关闭知识库。质量技能自动激活但不会给无关任务增加开销。
</details>

<details>
<summary><strong>Q：~prd 是什么？</strong></summary>

**A：** 13 维度 PRD 生成器。逐维度走过：产品概述、用户故事、功能需求、UI/UX 设计、技术架构、非功能需求、国际化、无障碍、内容策略、测试策略、部署运维、法律隐私、时间线 — 头脑风暴式，一次一个维度。
</details>

## 🛠️ 故障排除

### 插件未加载（Claude Code）

**问题：** `claude plugin add helloagents` 后 `~help` 无法识别

**解决：** 重启 Claude Code。如果仍不行，检查 `claude plugin list` 确认安装状态。

---

### 命令未找到（Codex CLI）

**问题：** `npm install -g helloagents` 后 `~help` 无法识别

**解决：**
- 验证安装：`npm list -g helloagents`
- 检查 `~/.codex/config.toml` 中 `model_instructions_file` 是否指向 `bootstrap.md`
- 重启 Codex CLI

---

### Guard 拦截了合法命令

**问题：** Guard 拦截了你确实想执行的命令

**解决：** 在 `~/.helloagents/helloagents.json` 中设置 `guard_enabled: false`。或者检查被拦截的命令 — Guard 只拦截真正的破坏性操作如 `rm -rf /` 和 `git push --force`。

---

### Ralph Loop 持续失败

**问题：** 验证循环无法通过

**解决：**
- 检查 `.helloagents/verify.yaml` 中的命令是否正确
- 手动运行验证命令查看实际错误
- 3 次连续失败后熔断器激活 — `hello-debug` 升级介入

---

### CCswitch 替换了 HelloAGENTS 配置

**问题：** 切换 CCswitch 配置后 HelloAGENTS 停止工作

**解决：** 切换配置后重新运行 `claude plugin add helloagents`。CCswitch 会替换整个 CLI 配置目录。

---

### 通知不工作

**问题：** 没有声音或桌面通知

**解决：**
- 检查配置中的 `notify_level`（默认 0=关闭）
- Windows：确保 PowerShell 可以访问 `System.Media.SoundPlayer`
- macOS：确保 `afplay` 可用
- Linux：确保安装了 `aplay` 或 `paplay`

## 📈 版本历史

### v3.0.0（当前版本）🎉

**破坏性变更：**
- 🔴 完全重写：Python 包 → 纯 Node.js/Markdown 架构。`pip`/`uv` 安装方式不再可用
- 🔴 CLI 支持从 6 个缩减到 2 个：Claude Code（插件）+ Codex CLI（npm）。移除 OpenCode、Gemini CLI、Qwen CLI、Grok CLI
- 🔴 命令重命名/移除：`~plan` → `~design`，移除 `~exec`/`~rollback`/`~rlm`/`~status`/`~validatekb`/`~upgradekb`/`~cleanplan`
- 🔴 配置键从大写改为小写。移除：`BILINGUAL_COMMIT`、`EVAL_MODE`、`UPDATE_CHECK`、`CSV_BATCH_MAX`

**新功能：**
- ✨ 14 个自动激活质量技能：hello-ui、hello-api、hello-security、hello-test、hello-verify、hello-errors、hello-perf、hello-data、hello-arch、hello-debug、hello-subagent、hello-review、hello-write、hello-reflect
- ✨ 检查清单门控：所有已激活技能必须通过交付检查清单才能完成任务
- ✨ `~prd` 命令：13 维度头脑风暴式 PRD 框架（产品概述、用户故事、功能需求、UI/UX、架构、非功能需求、国际化、无障碍、内容、测试、部署、法律、时间线）
- ✨ `~loop` 命令：自主迭代优化，带指标追踪和 git 回滚
- ✨ `~verify` 命令：自动检测并运行所有验证命令
- ✨ Guard 系统（`guard.mjs`）：L1 拦截破坏性命令 + L2 安全模式建议
- ✨ Claude Code 插件系统（`.claude-plugin/`）支持 marketplace 安装
- ✨ 流状态管理（`STATE.md`）：AI 上下文压缩快照（≤50 行）
- ✨ 设计系统生成（`DESIGN.md`）：UI 项目自动创建
- ✨ 计划包系统：`requirements.md` + `design.md` + `tasks.md`

**架构：**
- 📦 统一五阶段执行流程：ORIENT → CLARIFY → PLAN → EXECUTE → VALIDATE
- 📦 简化配置：7 个小写键，合理默认值
- 📦 Ralph Loop 用 Node.js 重写（`ralph-loop.mjs`）
- 📦 通知系统用 Node.js 重写（`notify.mjs`），跨平台声音+桌面支持
- 📦 新配置项：`output_format`、`ralph_loop_enabled`、`guard_enabled`、`commit_attribution`

### v2.3.8

**架构变更：**
- 路由层级整合：移除 R2 简化流和 R3 标准流，统一为 R0/R1/R2 三层路由
- 评估改为维度充分性驱动，替代固定总分阈值
- 末轮提问+确认合并，减少独立确认步骤
- 移除 L0 用户记忆系统和自定义命令扩展
- 配置系统整合：单一 `~/.helloagents/helloagents.json`
- 新增代码体积控制规则：预警 300/40 行，强制拆分 400/60 行

**新功能：**
- ✨ 5 个新工作流命令：`~test`、`~rollback`、`~validatekb`、`~upgradekb`、`~cleanplan`
- ✨ `notify_level` 配置项控制通知行为
- ✨ 独立配置读取模块供 hook 脚本使用

**安全：**
- 修复 `shared_tasks.py` 路径注入漏洞
- 修复 `validate_package.py` 路径遍历防护不完整

### v2.3.7

**Bug 修复：**
- 修复非编码任务在 `KB_CREATE_MODE=2` 时错误创建知识库
- 修复 R2 标准流在方案选择后重定向到归档而非 DEVELOP
- 修复非编码任务错误创建计划包

**改进：**
- 📦 优化上下文压缩后的实施计划状态恢复
- 📦 优化整体设计流程

### v2.3.6

**新功能：**
- ✨ 子代理编排大改：新增 brainstormer 子代理用于并行方案构思
- ✨ 子代理阻塞机制：失败/超时时自动阻塞并回退

**改进：**
- 📦 工具/Shell 约束优化：内置工具失败时允许回退到 Shell
- 📦 Shell 编码约束细化：明确 UTF-8 无 BOM 要求
- 📦 移除 3 个冗余子代理，功能回归主代理和 RLM 角色

### v2.3.5

**新功能：**
- ✨ 声音通知系统，5 种事件音效，跨 Windows/macOS/Linux
- ✨ Claude Code hooks 从 9 个扩展到 11 个生命周期事件类型
- ✨ Hooks 支持扩展到 Gemini CLI 和 Grok CLI
- ✨ 会话启动时配置完整性检查
- ✨ 上下文压缩前自动保存进度快照
- ✨ 用户自定义工具注册和编排

**改进：**
- 📦 全面审计修复（21 个问题：6 HIGH + 9 MEDIUM + 6 LOW）
- 📦 核心架构：新增 dispatcher 模块、Codex 角色、Claude 规则管理
- 📦 安装/更新脚本重构，持久化配置

## 📜 许可证

本项目采用双许可证：代码遵循 [Apache-2.0](./LICENSE.md)，文档遵循 CC BY 4.0。

详见 [LICENSE.md](./LICENSE.md)。

## 🤝 参与贡献

- 🐛 **Bug 报告**：[创建 issue](https://github.com/hellowind777/helloagents/issues)
- 💡 **功能建议**：[发起讨论](https://github.com/hellowind777/helloagents/issues)
- 📖 **文档改进**：欢迎 PR

## 支持的 CLI

| CLI | 安装方式 | 卸载方式 |
|-----|---------|---------|
| Claude Code | `claude plugin add helloagents` | `claude plugin remove helloagents` |
| Codex CLI | `npm install -g helloagents` | `npm uninstall -g helloagents` |

---

<div align="center">

如果这个项目对你有帮助，点个 star 就是最好的支持。

感谢 <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> 对本项目的支持

[⬆ 返回顶部](#helloagents)

</div>

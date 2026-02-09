<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**一个会持续推进到实现与验证完成的多 CLI 工作流系统。**

[![Version](https://img.shields.io/badge/version-2.2.0-orange.svg)](./pyproject.toml)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/workflow_commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/中文-blue?style=for-the-badge" alt="中文"></a>
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

相较于旧版多 bundle 发布形态，v2.x 已转为 package-first 形态。

| 维度 | 旧仓库 | 当前仓库 |
|---|---|---|
| 分发形态 | 多 bundle 目录，如 Codex CLI、Claude Code | 以 helloagents 包为核心，加安装器 CLI |
| 安装方式 | 手工复制配置与技能目录 | UV 从 GitHub 安装 + helloagents update（分支感知）+ helloagents install &lt;target&gt; |
| 目标 CLI | 5 个可见 bundle 目标 | 代码内 6 个目标：claude、codex、opencode、gemini、qwen、grok |
| 安装安全性 | 手工覆盖有风险 | 标记识别、备份、陈旧文件清理 |
| 工作流来源 | 各 bundle 重复维护 | helloagents/functions、stages、rules、services 单一来源 |

> ⚠️ **迁移提醒：** 由于 v2.x 的仓库结构与安装方式已调整，旧版本已迁移到归档仓库：**helloagents-archive**
> https://github.com/hellowind777/helloagents-archive

## 功能特性

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**Package-first 安装**

使用 UV 从 GitHub 安装，再用安装命令部署到目标 CLI。

**收益：** 降低手工复制错误。
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**结构化工作流执行**

路由强制执行 R0 直接响应、R1 快速流程、R2 简化流程、R3 标准流程，并按阶段链推进。

**收益：** 任务不容易半途结束。
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**内置安全闸门（EHRB）**

高风险操作会在改动前被检测。

**收益：** 默认更安全。
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**多 CLI 兼容**

同一工作流核心支持多个 AI CLI。

**收益：** 团队跨工具行为一致。
</td>
</tr>
</table>

### 可核验数据

- 6 个 CLI 目标来自 helloagents/cli.py
- 15 个工作流命令来自 helloagents/functions
- 12 个角色配置来自 helloagents/rlm/roles
- 8 个辅助脚本来自 helloagents/scripts
- 7 类核心模块：functions、stages、services、rules、rlm、scripts、templates

## 前后对比（贪吃蛇示例）

按你的要求，原有贪吃蛇配图保留，其他 README 配图已重建。

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

### 1）使用 UV 从 GitHub 安装

**稳定版（main）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents

**Beta：**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents

### 2）更新包（分支感知）

helloagents update 会在当前分支内检查并更新。

    helloagents update

需要切换分支时：

    helloagents update beta

    helloagents update main

### 3）同步规则到目标 CLI

    helloagents install codex

    helloagents install claude

    helloagents install --all

### 4）验证

    helloagents status

    helloagents version

### Codex CLI 示例

**稳定版（main）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents
    helloagents install codex
    helloagents update
    helloagents install codex

**Beta：**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents
    helloagents install codex
    helloagents update beta
    helloagents install codex

### Claude Code 示例

**稳定版（main）：**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents
    helloagents install claude
    helloagents update
    helloagents install claude

**Beta：**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents
    helloagents install claude
    helloagents update beta
    helloagents install claude

## 工作原理

1. 安装包并执行安装命令。
2. 安装器定位目标 CLI 配置目录。
3. 清理陈旧 HelloAGENTS 文件并复制最新模块。
4. 创建或更新目标规则文件，并保护用户文件备份。
5. 在 AI 聊天内由路由选择 R0 直接响应、R1 快速流程、R2 简化流程或 R3 标准流程。
6. 按阶段链执行并返回可验证结果。

## 仓库结构说明

- AGENTS.md：路由与工作流协议
- pyproject.toml：包元数据（v2.2.0）
- helloagents/cli.py：安装器入口
- helloagents/functions：工作流命令
- helloagents/stages：analyze、design、develop、tweak
- helloagents/services：knowledge、package、memory 等服务
- helloagents/rules：state、cache、tools、scaling 规则
- helloagents/rlm：角色库与编排辅助
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
| ~upgrade | 升级知识结构 |
| ~clean / ~cleanplan | 清理工作流产物 |
| ~test / ~review / ~validate | 质量检查 |
| ~commit | 基于上下文生成提交信息 |
| ~rollback | 回滚工作流状态 |
| ~rlm | 角色编排命令 |
| ~status / ~help | 状态与帮助 |

## FAQ

- Q: 这是 Python CLI 还是提示词包？
  A: 两者都是。CLI 管安装，工作流行为由 AGENTS.md 与 helloagents 文档定义。

- Q: 应该安装哪个目标？
  A: 按你使用的 CLI 选择：codex、claude、opencode、gemini、qwen、grok。

- Q: 已有规则文件会怎样？
  A: 非 HelloAGENTS 文件会先备份再替换。

- Q: 还需要手工复制 bundle 吗？
  A: 不需要，v2.x 版本已用安装命令替代手工 bundle 复制。

- Q: 工作流知识库存在哪里？
  A: 默认在项目内 .helloagents 目录。

- Q: 为什么保留贪吃蛇示例图？
  A: 该示例图用于提供前后效果的稳定可视化对比基准。

## 故障排除

- command not found：确认安装路径已加入 PATH
- package version unknown：先安装包获取元数据
- target not detected：先启动目标 CLI 生成配置目录
- custom rules overwritten：在 CLI 配置目录中使用时间戳备份恢复
- images not rendering：保持相对路径并提交 readme_images 目录

## 版本历史

### v2.2.0（当前 package 分支）

- 重构为以 helloagents 目录为中心的 package-first 结构
- 新增安装器命令：install、update、status、version
- 安装流程加入安全机制：标记检测、备份、陈旧清理
- 工作流内容收敛到单一来源目录
- v2 之前的旧版布局已迁移到 https://github.com/hellowind777/helloagents-archive

### v2.0.1（旧多 bundle 基线版本）

- 多 bundle 分发基线版本，安装方式以手工复制为主
- 各 CLI 目录独立维护

## 参与贡献

贡献规则与 PR 清单见 CONTRIBUTING.md。

## 许可证

本项目采用 MIT License，详见 LICENSE。

---

<div align="center">

如果这个项目对你有帮助，欢迎点 Star。

</div>

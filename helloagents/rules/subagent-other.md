# 子代理调用协议 — OpenCode / Gemini CLI / Qwen Code / Grok CLI

> 本文件由 subagent-protocols.md 按 CLI 拆分而来，仅在 OpenCode/Gemini/Qwen/Grok 环境下按需加载。

---

## OpenCode / Gemini CLI / Qwen Code / Grok CLI 调用协议

```yaml
通用规则: helloagents 角色执行步骤同 Claude Code 协议，仅调用方式不同
用户扩展通用规则: 所有 CLI 均按 G9 用户代理分配规则调度自定义子代理和 Skills，CLI 原生尚未支持时视为前瞻性路径

OpenCode:
  主代理: build（完整工具权限，主要开发代理）| plan（只读模式，代码探索和分析，默认拒绝文件编辑）
  子代理: general（通用研究和多步任务）| explore（代码库探索）
  调用方式: 主代理通过 Task tool 调用子代理 | 用户可通过 @代理名 手动调用 | Tab 键切换主代理
  自定义子代理: .opencode/agent/*.md（项目级）| ~/.config/opencode/agent/*.md（用户级）| opencode agent create 命令创建
  子代理间委派: 支持子代理→子代理委派，可配置 task_budget（水平限制）和 level_limit（深度限制）防止无限循环
  权限控制: permission.task 配置控制子代理可调用的其他子代理（glob 模式匹配，deny 时从 Task tool 描述中移除）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | MCP 服务器（.opencode.json 配置）

Gemini CLI:
  原生子代理: codebase_investigator（代码库分析）| generalist（通用代理，完整工具）| cli_help（CLI 帮助）| browser_agent（浏览器自动化，实验性）
  自定义子代理: .gemini/agents/*.md（项目级）| ~/.gemini/agents/*.md（用户级）| 支持 A2A 协议远程代理（kind: remote）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（.gemini/skills/，基于 agentskills.io 标准）| MCP 服务器 | Extensions（gemini-extension.json，含 MCP/Skills/Commands/Hooks/Agents）

Qwen Code:
  原生子代理: general-purpose（通用研究和代码分析）
  自定义子代理: .qwen/agents/*.md（项目级）| ~/.qwen/agents/*.md（用户级）| /agents create 引导创建
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（.qwen/skills/，实验性）| MCP 服务器 | Extensions（qwen-extension.json，兼容 Gemini + Claude 生态）

Grok CLI:
  原生子代理: 无内置子代理类型，主代理直接执行所有任务
  自定义子代理: .grok/agents/*.md（项目级）| ~/.grok/agents/*.md（用户级）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（.grok/skills/）| MCP 服务器（.grok/settings.json 配置）
  注: 自定义子代理和 Skills 为前瞻性路径规划，当前版本主代理直接执行
```

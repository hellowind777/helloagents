# Hooks 配置参考

本文件为安装参考文档，运行时由 hooks 脚本自动执行，AI 无需加载。

---

## Claude Code Hooks 配置（.claude/settings.json）

HelloAGENTS 预定义以下 Hook 配置供用户可选启用:

```yaml
UserPromptSubmit — 主代理规则强化:
  事件: UserPromptSubmit
  动作: command hook，注入 CLAUDE.md 关键规则摘要（≤2000字符）
  超时: 3s | 脚本: inject_context.py（路径1）

SubagentStart — 子代理上下文注入:
  事件: SubagentStart
  动作: command hook，注入当前方案包上下文（proposal.md + tasks.md + context.md，≤4000字符）
  超时: 5s | 脚本: inject_context.py（路径2）

SubagentStop — 质量验证循环（Ralph Loop）:
  事件: SubagentStop | 匹配: agent_type = general-purpose
  动作: command hook，运行项目验证命令，失败时 decision=block 阻止子代理停止
  超时: 120s | 脚本: ralph_loop.py

PostToolUse — 进度快照:
  事件: PostToolUse | 匹配: toolName 匹配 Write|Edit|NotebookEdit
  动作: command hook，检查距上次快照是否超过阈值(5次写操作)，超过则生成进度快照

Stop — KB 同步 + L2 写入:
  事件: Stop | 异步: async=true
  动作: command hook，触发 KnowledgeService 同步和 L2 摘要写入

TeammateIdle — Agent Teams 空闲检测:
  事件: TeammateIdle | 异步: async=true
  动作: command hook，teammate 即将空闲时检查共享任务列表是否有未认领任务
  前提: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

PreCompact — 上下文压缩前快照:
  事件: PreCompact | 异步: async=false（必须在压缩前完成）
  动作: command hook，上下文压缩前自动保存进度快照到 cache.md
```

---

## Codex CLI Hooks 配置（~/.codex/config.toml）

当前仅支持 `notify` 配置项（agent-turn-complete 事件），在代理完成一轮交互后触发:

```toml
# notify — 代理轮次完成时触发（当前 Codex CLI 唯一支持的 hook 事件）
notify = ["helloagents --check-update --silent"]
# 作用: 代理完成时检查 HelloAGENTS 版本更新，有更新则显示提示
```

---

## 预留扩展接口

```yaml
Codex CLI Hooks 系统持续发展中。以下功能已在 Claude Code 侧实现，
当 Codex CLI 支持对应事件时可通过修改 config.toml 直接启用:
  - PostToolUse → 进度快照（等待 Codex CLI 支持工具调用后事件）
迁移方式: 将 Claude Code settings.json 中的 hook 逻辑移植为
Codex CLI config.toml 格式，核心脚本/命令可复用。
```

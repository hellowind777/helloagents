# Hooks 配置参考

本文件为安装参考文档，运行时由 hooks 脚本自动执行，AI 无需加载。

---

## Claude Code Hooks 配置（.claude/settings.json）

HelloAGENTS 预定义以下 12 个 Hook 配置供用户可选启用:

```yaml
SessionStart — 版本更新检查:
  事件: SessionStart
  动作: command hook，检查 HelloAGENTS 是否有新版本，有更新则显示提示
  超时: 5s | 命令: helloagents --check-update --silent

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

Stop — KB 同步 + L2 写入 + 声音通知:
  事件: Stop
  动作: command hook，触发 KnowledgeService 同步和 L2 摘要写入，播放完成声音

TeammateIdle — Agent Teams 空闲检测:
  事件: TeammateIdle
  动作: command hook，teammate 即将空闲时检查共享任务列表是否有未认领任务
  前提: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

PreCompact — 上下文压缩前快照:
  事件: PreCompact | 异步: async=false（必须在压缩前完成）
  动作: command hook，上下文压缩前自动保存进度快照到 cache.md

PreToolUse — 危险命令安全防护:
  事件: PreToolUse | 匹配: Bash
  动作: command hook，检测 Bash 命令中的高危模式（rm -rf /、git push --force main 等），
        匹配时返回 permissionDecision=deny 拦截执行
  超时: 3s | 脚本: pre_tool_guard.py

SessionEnd — 会话结束最终清理:
  事件: SessionEnd
  动作: command hook，会话彻底结束时执行 KB 同步 + 摘要写入 + 临时计数器文件清理
  超时: 10s | 脚本: session_end.py（复用 Stop 脚本，通过 hookEventName 区分）

Notification — 声音通知（等待输入）:
  事件: Notification | 匹配: idle_prompt
  动作: command hook，Claude Code 等待用户输入时播放声音提醒
        跨平台: Windows winsound 同步播放 | macOS afplay | Linux aplay/paplay | 全失败降级 bell
  超时: 5s | 脚本: sound_notify.py idle

PostToolUseFailure — 工具失败恢复建议 + 声音通知:
  事件: PostToolUseFailure | 匹配: 所有工具
  动作: command hook，匹配已知错误模式（权限、文件未找到、编码、磁盘空间、冲突、模块缺失等），
        注入 additionalContext 恢复建议，并播放错误提示音
  超时: 5s | 脚本: tool_failure_helper.py + sound_notify.py error
```

---

## Codex CLI Hooks 配置（~/.codex/config.toml）

### notify 事件

`notify` 在代理完成一轮交互后触发:

```toml
# notify — 代理轮次完成时触发
notify = ["helloagents --check-update --silent"]
# 作用: 代理完成时检查 HelloAGENTS 版本更新，有更新则显示提示
```

**notify JSON payload（v0.107+）:**
```json
{
  "type": "agent-turn-complete",
  "thread-id": "...",
  "turn-id": "...",
  "cwd": "/path/to/project",
  "client": "codex-tui",
  "input-messages": [...],
  "last-assistant-message": "..."
}
```

`client` 字段（v0.107 新增）: TUI 报告 `codex-tui`，app-server 报告 `initialize.clientInfo.name`（如 `vscode`、`xcode`）。
HelloAGENTS 的 `codex_notify.py` 根据 `client` 字段过滤：IDE 来源跳过声音通知（IDE 有自己的通知机制）。

### 多代理配置

通过 `/agent` 命令（v0.110+）或 `/experimental` 开启:

```toml
# 全局代理限制
agents.max_threads = 16   # 最大并发子代理线程数
agents.max_depth = 1      # 嵌套深度（默认 1）

# 原生角色（每个角色独立配置，模型名按实际可用模型填写）
[agents.explorer]
description = "代码探索和依赖分析"
model = "<轻量模型名>"
model_reasoning_effort = "medium"
nickname_candidates = ["探索者", "Scout", "Pathfinder"]

[agents.worker]
description = "代码实现和修改"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["工匠", "Builder", "Forge"]

[agents.monitor]
description = "长时间运行的监控和轮询任务"
model = "<轻量模型名>"
model_reasoning_effort = "low"
nickname_candidates = ["哨兵", "Watcher", "Radar"]

# HelloAGENTS RLM 角色
[agents.reviewer]
description = "代码审查和质量检查"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["审查员", "Inspector", "Sentinel"]

[agents.synthesizer]
description = "多方案评估与综合分析"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["综合师", "Synthesizer", "Oracle"]

[agents.kb_keeper]
description = "知识库同步与维护"
model = "<主力模型名>"
model_reasoning_effort = "medium"
nickname_candidates = ["档案员", "Librarian", "Keeper"]

[agents.pkg_keeper]
description = "方案包生命周期管理"
model = "<主力模型名>"
model_reasoning_effort = "medium"
nickname_candidates = ["管家", "Steward", "Curator"]

[agents.writer]
description = "独立文档生成与编写"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["笔者", "Scribe", "Quill"]
```

### nickname_candidates（v0.110 新增）

角色可定义语义化昵称池，子代理生成时从池中分配，替代默认随机昵称（科学家名字）。
用于线程切换和日志识别，提升多代理场景的可读性。

HelloAGENTS 角色昵称映射:

| 角色 | 类型 | 昵称候选 |
|------|------|----------|
| explorer | 原生 | Scout, Pathfinder, Tracker |
| worker | 原生 | Builder, Forge, Smith |
| monitor | 原生 | Watcher, Radar, Lookout |
| reviewer | RLM | Inspector, Sentinel, Auditor |
| synthesizer | RLM | Oracle, Arbiter, Assessor |
| kb_keeper | RLM | Librarian, Keeper, Archivist |
| pkg_keeper | RLM | Steward, Curator, Marshal |
| writer | RLM | Scribe, Quill, Chronicler |

### collaboration_modes 功能开关（v0.110+）

```toml
[features]
collaboration_modes = true
```

启用后 `request_user_input` 工具可用，允许代理渲染 TUI 交互选择界面（替代纯文本选项）。

- **适用**: 主代理和子代理均可使用
- **HelloAGENTS 使用场景**: R2 确认（问题+选项）、R3 评估追问、R3 确认选项、DESIGN 多方案对比、EHRB 风险确认
- **安装**: 由 `codex_config.py` 的 `_ensure_feature_collaboration_modes()` 自动写入

---

## Gemini CLI Hooks 配置（~/.gemini/settings.json）

Gemini CLI 使用 settings.json 格式，Qwen Code 复用相同配置。

```yaml
SessionStart — 版本更新检查:
  事件: SessionStart
  动作: helloagents --check-update --silent
  超时: 5s

BeforeAgent — 上下文注入:
  事件: BeforeAgent（等效 Claude Code UserPromptSubmit）
  动作: inject_context.py，通过事件名映射注入规则强化上下文
  超时: 3s

AfterAgent — KB 同步 + 会话摘要 + 声音通知:
  事件: AfterAgent（等效 Claude Code Stop）
  动作: session_end.py，触发 KB 同步和 L2 摘要写入；sound_notify.py 播放完成声音
  超时: 10s

PreCompress — 压缩前进度快照:
  事件: PreCompress（等效 Claude Code PreCompact）
  动作: pre_compact.py，压缩前自动保存进度快照
  超时: 10s | 异步: async=false
```

---

## Grok CLI Hooks 配置（~/.grok/settings.json）

```yaml
UserPromptSubmit — 规则强化:
  事件: UserPromptSubmit
  动作: inject_context.py，注入规则强化上下文
  超时: 3s

PreToolUse — 危险命令安全防护:
  事件: PreToolUse | 匹配: Bash
  动作: pre_tool_guard.py，检测高危命令模式
  超时: 3s

PostToolUse — 进度快照:
  事件: PostToolUse | 匹配: Write|Edit
  动作: progress_snapshot.py，写操作计数+阈值快照
  超时: 10s
```

---

## 预留扩展接口

```yaml
Claude Code 持续发展中的 Hook 事件:
  - TaskCompleted: Agent Teams teammate 完成任务时触发（exit code 2 可阻止完成）
  - 子代理 frontmatter hooks: 在 .claude/agents/*.md 中为特定子代理定义专属 hooks

Codex CLI 持续发展中的能力:
  - PostToolUse → 进度快照（等待 Codex CLI 支持工具调用后事件）
  - agent_job_progress → CSV 批处理进度事件（已支持，可用于自定义进度展示）
  - 结构化输出 → spawn_agents_on_csv 的 output_schema 强制执行（规划中）

迁移方式: 将 Claude Code settings.json 中的 hook 逻辑移植为
各 CLI 的 settings.json/config.toml 格式，核心脚本/命令可复用。
```

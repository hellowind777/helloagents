# Hooks 配置参考

本文件为安装参考文档，运行时由 hooks 脚本自动执行，AI 无需加载。

---

## Claude Code Hooks 配置（.claude/settings.json）

HelloAGENTS 预定义以下 11 个 Hook 配置供用户可选启用:

**声音通知触发原则（CRITICAL）:**
```yaml
仅主代理事件触发声音通知，子代理事件静默:
  主代理事件（触发声音）: Stop 智能路由（Claude Code）、notify 智能路由（Codex CLI）、AfterAgent（Gemini CLI）、需要用户确认（Codex approval-requested）
  子代理事件（静默）: 子代理内部任务执行、子代理轮次完成、子代理工具失败
声音路由机制（Claude Code 两层检测）:
  Layer 1 — stop_reason 检测（结构化信号，来自 Anthropic API，100% 可靠）:
    stop_reason == "tool_use" → 静默退出（中间状态，不播放声音）
    stop_reason == "end_turn" 或其他 → 继续 Layer 2
  Layer 2 — G3 格式检测（语义信号，5 种声音事件）:
    检测【HelloAGENTS】标记 → 提取状态图标 + 标记后状态文本 → 映射声音:
      警告类（⚠️）          → warning ("需要注意~"，EHRB 风险警告)
      错误类（❌）           → error   ("出错了呢~"，错误终止)
      完成类（✅💡⚡🔧）    → complete ("完成了~")
      确认类（❓📐）         → confirm ("需要您确认~"，始终为确认场景)
      上下文类（🔵+状态含"确认"） → confirm (R3 确认，核心维度全部充分 等待模式选择)
      上下文类（🔵+状态不含"确认"） → idle ("在等你呢~"，R3 追问/评估/执行等)
      其余图标（ℹ️🚫等）    → idle    ("在等你呢~")
      无 G3 格式            → complete（默认）
  Claude Code: 从会话 JSONL 读取最后一条 assistant 消息的 text + stop_reason（stop_sound_router.py）
  Codex CLI: 从 notify payload 的 last-assistant-message 字段读取（codex_notify.py，无 stop_reason 字段，仅 Layer 2）
  Gemini CLI: AfterAgent 仅触发 complete（无消息检测）
子代理隔离:
  Claude Code: Stop 事件仅由主代理触发（架构保证）；PostToolUseFailure 不附带声音（无法区分代理上下文）
  Codex CLI: notify 钩子在所有代理轮次（含子代理）触发，codex_notify.py 通过 G3 标记过滤子代理声音
  Gemini CLI: AfterAgent 仅由主代理触发（架构保证）
```

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

Stop — KB 同步标志 + 智能声音路由:
  事件: Stop
  动作: command hook，设置 KB 同步标志；从会话 JSONL 检测 G3 状态图标播放对应声音

Notification — 已移除（声音路由已由 Stop 的 stop_sound_router.py 统一处理，避免双重触发）

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
  动作: command hook，会话彻底结束时设置 KB 同步标志 + 临时计数器文件清理
  超时: 10s | 脚本: session_end.py（复用 Stop 脚本，通过 hookEventName 区分）

PostToolUseFailure — 工具失败恢复建议:
  事件: PostToolUseFailure | 匹配: 所有工具
  动作: command hook，匹配已知错误模式（权限、文件未找到、编码、磁盘空间、冲突、模块缺失等），
        注入 additionalContext 恢复建议
  超时: 5s | 脚本: tool_failure_helper.py
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
`agent-turn-complete` 事件通过 `last-assistant-message` 检测 G3 状态图标进行声音路由（与 Claude Code 的 stop_sound_router.py 共用映射逻辑）。
notify 钩子在所有代理轮次触发（含子代理），codex_notify.py 声音过滤规则:
  无【HelloAGENTS】标记 → 跳过声音（覆盖子代理输出和主代理无格式中间输出）
  有【HelloAGENTS】标记 → 仅从输出末尾提取最后一个 G3 状态行的图标进行声音路由，忽略输出中间的历史标记

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

[agents.writer]
description = "独立文档生成与编写"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["笔者", "Scribe", "Quill"]

[agents.brainstormer]
description = "方案构思与差异化设计"
model = "<主力模型名>"
model_reasoning_effort = "high"
nickname_candidates = ["缪斯", "Muse", "Ideator"]
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
| writer | RLM | Scribe, Quill, Chronicler |
| brainstormer | RLM | Muse, Ideator, Catalyst |

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

PreToolUse — 危险命令安全防护（待验证）:
  事件: PreToolUse | 匹配: Bash（等效 Claude Code PreToolUse）
  动作: pre_tool_guard.py，检测高危命令模式，匹配时返回 deny
  超时: 3s
  注: Gemini CLI 对 PreToolUse 事件的支持待验证，部署后如不生效则依赖规则层 EHRB 降级

PostToolUse — 进度快照（待验证）:
  事件: PostToolUse | 匹配: Write|Edit（等效 Claude Code PostToolUse）
  动作: progress_snapshot.py，写操作计数+阈值自动快照
  超时: 10s | 异步: async=true
  注: Gemini CLI 对 PostToolUse 事件的支持待验证，部署后如不生效则依赖 cache.md 手动触发

AfterAgent — KB 同步标志 + 声音通知:
  事件: AfterAgent（等效 Claude Code Stop）
  动作: session_end.py，设置 KB 同步标志；sound_notify.py 播放完成声音
  超时: 10s

PreCompress — 压缩前进度快照:
  事件: PreCompress（等效 Claude Code PreCompact）
  动作: pre_compact.py，压缩前自动保存进度快照
  超时: 10s | 异步: async=false
```

---

## Grok CLI Hooks 配置（~/.grok/settings.json）— Experimental/Community，能力待验证

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

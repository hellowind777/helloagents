# 子代理调用协议 — Claude Code

> 本文件由 subagent-protocols.md 按 CLI 拆分而来，仅在 Claude Code 环境下按需加载。

---

## Claude Code 调用协议（CRITICAL）

```yaml
原生子代理:
  代码探索/依赖分析 → Agent(subagent_type="Explore", prompt="...")
  代码实现 → Agent(subagent_type="general-purpose", prompt="...")
  后台任务 → Agent(subagent_type="general-purpose", run_in_background=true, prompt="...")

文件级子代理定义（.claude/agents/*.md）:
  作用域: --agents CLI 参数 > .claude/agents/（项目级）> ~/.claude/agents/（用户级）> 插件 agents/
  关键字段: name, description, tools/disallowedTools, model(inherit 默认), skills, memory(user|project|local), background, isolation(worktree)
  helloagents 角色持久化: 部署后调用 Agent(subagent_type="ha-{角色名}") 替代 general-purpose + 角色 prompt 拼接

helloagents 角色:
  代理文件与角色预设映射:
    | 代理文件 (agents/) | 角色预设 (rlm/roles/) | 类型 |
    |---|---|---|
    | ha-reviewer.md | reviewer.md | 通用（自动/手动） |
    | ha-writer.md | writer.md | 通用（仅手动） |
    | ha-brainstormer.md | brainstormer.md | 通用（只读） |
    命名规则: 代理文件 ha-{name} 对应角色预设 {name}（连字符转下划线）
  执行步骤（阶段文件中遇到 [RLM:角色名] 标记时）:
    1. 加载角色预设: 读取 rlm/roles/{角色}.md
    2. 构造 prompt: "[RLM:{角色}] {从角色预设提取的约束} + {具体任务描述}"
    3. 调用 Agent 工具: subagent_type="general-purpose", prompt=上述内容
       （若已部署文件级子代理: subagent_type="ha-{角色名}", prompt=任务描述）
    4. 接收结果: 解析子代理返回的结构化结果
    5. 记录调用: 通过 SessionManager.record_agent() 记录

用户自定义代理（当前会话可用的非 ha-* 代理）:
  调用方式: Agent(subagent_type="{agent-name}", prompt="{任务描述}")
  与 RLM 角色的关系:
    互补: 用户代理处理 RLM 角色未覆盖的领域（如 security-auditor、performance-tester）
    替代: 用户代理 description 覆盖某 RLM 角色能力 → 用户代理优先
    共存: 同一任务可同时调度用户代理 + RLM 角色
  命名冲突: 用户代理名与 ha-* 重名 → ha-* 优先（HelloAGENTS 预设不可被覆盖）
  降级: 用户代理执行失败 → 降级到 RLM 角色或主代理直接执行
  Skill/MCP 辅助: DEVELOP 阶段识别到可用 Skill/MCP 可加速当前子任务 → 主动调用（非强制）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（.claude/skills/）| MCP 服务器 | 插件（Extensions）

后台执行: run_in_background=true 非阻塞，适用于独立长时间任务；子代理可通过 agent ID 恢复（resume）

并行调用: 多个子代理无依赖时，在同一消息中发起多个 Task 调用
串行调用: 有依赖关系时，等待前一个完成后再调用下一个

示例（DEVELOP 步骤6 代码实现）:
  Agent(
    subagent_type="general-purpose",
    prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。
            你负责: 任务 1.1。操作范围: src/api/filter.py 中的空白判定函数。
            任务: 实现空白判定函数，处理空字符串和纯空格输入。
            约束: 遵循现有代码风格，单次只改单个函数，大文件先搜索定位。
            返回: {status: completed|partial|failed, changes: [{file, type, scope}], issues: [...], verification: {lint_passed, tests_passed}}"
  )

示例（DESIGN 步骤10 方案构思，≥3 个并行调用在同一消息中发起）:
  Agent(subagent_type="ha-brainstormer", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 独立构思一个实现方案。上下文: {Phase1 收集的项目上下文}。差异化方向: {方向1}。")
  Agent(subagent_type="ha-brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的实现路径或架构模式。差异化方向: {方向2}。...")
  Agent(subagent_type="ha-brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的权衡取舍（如性能vs可维护性）。差异化方向: {方向3}。...")
```

---

## Claude Code Agent Teams 协议

```yaml
适用条件: TASK_COMPLEXITY=complex + 多角色需互相通信 + 任务可拆为 3+ 独立子任务 + 用户确认启用（实验性）
前提: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1（settings.json → env 字段）

调度: 主代理作为 Team Lead → spawn teammates（队友）（原生+专有角色混合）→ 共享任务列表（映射 tasks.md）+ mailbox 通信
  → teammates 自行认领任务 → Team Lead 综合结果
  teammates: Explore（代码探索）| general-purpose × N（代码实现，每人负责不同文件集）| helloagents 专有角色

典型场景:
  并行审查 — 安全/性能/测试覆盖各一个 teammate，独立审查后 Lead 综合
  竞争假设 — 多个 teammate 各持不同假设并行调查，互相质疑收敛到根因
  跨层协调 — 前端/后端/数据层各一个 teammate，通过 mailbox 协调接口变更

计划审批: 高风险任务可要求 teammate 先进入 plan 模式规划，Lead 审批后再实施
  Lead 审批标准由主代理 prompt 指定（如"仅审批包含测试覆盖的计划"）

成本意识: 每个 teammate 独立上下文窗口，Token 消耗约为 Task 子代理的 7 倍
  团队 3-5 人，每人 5-6 个任务 | spawn 指令须提供充足上下文（teammates 不继承 Lead 对话历史）
  每个 teammate 负责不同文件集避免冲突 | 任务完成后 Lead 执行团队清理释放资源
选择标准: Task 子代理 = 结果只需返回主代理的聚焦任务（默认）| Agent Teams = 角色间需讨论/协作的复杂任务

降级: Agent Teams 不可用时 → 退回 Task 子代理模式
```

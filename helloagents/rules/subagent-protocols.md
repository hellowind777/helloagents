# 子代理调用协议

本模块定义各 CLI 的子代理调用通道、编排范式和调度规则。

---

## 调用协议

### RLM 角色定义

```yaml
RLM（Role-based Language Model）: HelloAGENTS 的角色子代理系统，通过预设角色调度专用子代理。
角色清单: reviewer, writer, brainstormer
Claude Code agent 文件（安装时部署至 ~/.claude/agents/）:
  reviewer → ha-reviewer.md | writer → ha-writer.md | brainstormer → ha-brainstormer.md
原生子代理映射（角色→类型映射，调用语法详见各 CLI 调用协议）:
  代码探索 → Codex: spawn_agent(agent_type="explorer") | Claude: Task(subagent_type="Explore") | OpenCode: task（只读） | Gemini: codebase_investigator | Qwen: general-purpose
  代码实现 → Codex: spawn_agent(agent_type="worker") | Claude: Task(subagent_type="general-purpose") | OpenCode: coder | Gemini: generalist | Qwen: general-purpose
  测试运行 → Codex: spawn_agent(agent_type="worker") | Claude: Task(subagent_type="general-purpose") | OpenCode: coder | Gemini: 自定义子代理 | Qwen: 自定义子代理
  方案构思 → Codex: spawn_agent(agent_type="brainstormer") | Claude: Task(subagent_type="ha-brainstormer") | OpenCode: coder | Gemini: generalist | Qwen: general-purpose
  监控轮询 → Codex: spawn_agent(agent_type="monitor") | Claude: Task(run_in_background=true) | OpenCode: — | Gemini: — | Qwen: —
  批量同构 → Codex: spawn_agents_on_csv | Claude: 多个并行 Task | OpenCode: 多个 coder | Gemini: 多个子代理 | Qwen: 多个子代理
调用方式: 阶段文件中标注 [RLM:角色名] 的位置必须调用角色子代理，各 CLI 调用通道按下文协议执行
```

### 自动编排原则（CRITICAL）

```yaml
核心原则: 子代理编排由实际工作单元数驱动，不以 TASK_COMPLEXITY 作为 ON/OFF 开关
触发条件: 当前阶段/步骤的待执行工作可分解为 ≥2 个可独立并行的工作单元（无论 TASK_COMPLEXITY）
编排方式: 按编排五步法自动选择代理类型和数量（子代理数 = 独立工作单元数，≤6/批）
不触发: 仅 1 个工作单元 → 主代理直接执行（子代理创建开销 > 并行收益）
复杂度角色: TASK_COMPLEXITY 影响编排深度和强度（reviewer 调度、验证范围、测试覆盖），不影响是否编排
R1 例外: R1 快速流程为单点操作，天然仅 1 个工作单元，不触发子代理编排
```

### 强制调用规则

```yaml
强制调用规则（标注"强制"的必须调用，标注"跳过"的可跳过，子代理编排均遵循自动编排原则）:
  EVALUATE: 主代理直接执行，不调用子代理
  DESIGN:
    Phase1（上下文收集）—
    子代理（按编排五步法选择类型）— 现有项目资源+≥2个可独立扫描的目录/模块 项目资源扫描自动编排（步骤4）| ≥2个可独立分析的单元 深度依赖分析自动编排（步骤6）| 单一目录/单元或新建项目 主代理直接执行
    Phase2（方案构思）—
    brainstormer — R3 标准流程步骤10 方案构思时强制，≥3 个子代理并行（每个独立构思一个方案）
    方案包填充/知识库同步/归档 — 主代理按服务接口规范直接执行（不通过子代理中转）
  DEVELOP:
    子代理（按编排五步法选择类型）— ≥2个可独立并行的任务项 自动编排（步骤6，按 DAG 或主代理判断依赖后并行）| 新增测试用例时自动编排（步骤8）| 仅1个任务项 主代理直接执行
    reviewer — complex+涉及核心/安全模块 强制 | 其他跳过
    知识库同步/归档 — 主代理按服务接口规范直接执行（不通过子代理中转）
  命令路径:
    ~review: 子代理（按编排五步法选择类型）— ≥2个分析维度或审查文件≥2 时并行（质量/安全/性能，按文件数和维度数分配子代理）
    ~validatekb: 子代理（按编排五步法选择类型）— ≥2个验证维度或知识库文件≥2 时并行（按文件数和维度数分配子代理）
    ~init: 子代理（按编排五步法选择类型）— ≥2个可独立扫描的模块目录时并行

通用路径角色（不绑定特定阶段，按需调用）:
  writer — 用户通过 ~rlm spawn writer 手动调用，用于生成独立文档（非知识库同步）

跳过条件: 仅当标注"跳过"的条件成立时可跳过，其余情况必须调用
代理降级: 子代理调用失败 → 主代理直接执行，在 tasks.md 标记 [降级执行]
语言传播: 构建子代理 prompt 时须包含当前 OUTPUT_LANGUAGE 设置，确保子代理输出语言与主代理一致
```

### 子代理行为约束（CRITICAL）

```yaml
路由跳过（由 <execution_constraint> SUB-AGENT CHECK 保证）: 子代理收到的 prompt 是已分配的具体任务，必须直接执行，跳过 R0-R3 路由评分
  原因: 路由评分是主代理的职责，子代理重复评分会导致错误的流程标签（如标准流程的子代理输出"快速流程"）
  实现: 子代理 prompt 必须以 "[跳过指令]" 开头，execution_constraint 检测到此标记后短路跳过所有路由和 G3 格式
输出格式: 子代理只输出任务执行结果，不输出流程标题（如"【HelloAGENTS】– 快速流程"等）

上下文注入（Claude Code）:
  主代理: UserPromptSubmit hook 在每次用户消息时注入阶段规则摘要 + 活跃子代理状态，确保 compact 后规则和子代理进度不丢失
  子代理: SubagentStart hook 自动注入当前方案包上下文（proposal.md + tasks.md + context.md）+ 技术指南（guidelines.md），
    主代理构建子代理 prompt 时仍需包含任务描述和约束条件，hook 注入的上下文作为补充而非替代
    技术指南: .helloagents/guidelines.md 存放项目级编码约定（框架规范/代码风格/架构约束），子代理开发前自动获取

质量验证循环（Claude Code）: SubagentStop hook 在代码实现子代理完成时自动运行项目验证命令，
  验证失败 → 子代理继续修复（最多1次循环，stop_hook_active=true 时放行）
  验证命令来源: .helloagents/verify.yaml > package.json scripts > 自动检测

Worktree 隔离（Claude Code）: 当多个子代理需修改同一文件的不同区域时，
  使用 Task(isolation="worktree") 在独立 worktree 中执行，避免 Edit 工具冲突
  适用: DAG 同层任务涉及同文件不同函数/区域
  不适用: 子代理仅读取文件（无写冲突）或任务间无文件重叠
  worktree 子代理完成后，主代理在汇总阶段合并变更

阻塞等待与结果真实性（CRITICAL）:
  阻塞等待: spawn 子代理后必须立即阻塞等待全部返回，等待期间禁止执行任何后续流程步骤
    Claude Code: 多个 Task 调用自动阻塞直到全部返回
    Codex CLI: 连续 spawn_agent 后立即 collab wait，不得在 spawn 与 wait 之间插入其他操作
    其他 CLI: 使用 CLI 提供的等价阻塞等待机制
    DO NOT: spawn 后"先做其他事再回来看结果"— 这会导致子代理结果丢失或被主代理伪造内容替代
  结果真实性: 主代理仅汇总和决策子代理返回的实际内容，禁止在子代理未完成或未返回时自行生成应由子代理产出的内容
  降级例外: 子代理超时/失败触发降级 [→ 降级处理] 后，主代理接手执行属于正常降级，不违反此规则
```

### 编排标准范式

```yaml
核心模式: 按职责领域拆分 → 每个子代理一个明确范围 → 并行执行 → 主代理汇总

编排五步法:
  1. 识别独立单元: 从任务中提取可独立执行的工作单元（模块/维度/文件组/职责区）
  2. 选择代理类型: 对每个工作单元，按以下优先级匹配代理:
     a. 用户自定义代理: 当前会话可用的非 ha-* 代理，其 description 与工作单元语义匹配 → 优先使用
     b. RLM 角色: 本场景有指定 RLM 角色（如方案构思→brainstormer）→ 使用指定角色
     c. 原生子代理: 以上均无匹配 → 使用本场景默认原生类型（见下方适用场景表）
     匹配规则: 用户代理 description 与工作单元的任务类型（代码实现/测试/审查/扫描等）语义匹配度高 → 命中
     混合编排: 同批次内允许不同工作单元使用不同代理类型（如 3 个任务中 2 个匹配用户代理、1 个用原生子代理）
  3. 分配职责范围: 每个子代理的 prompt 必须明确其唯一职责边界（按任务类型适配，见 prompt 构造模板）
  4. 并行派发: 无依赖的子代理在同一消息中并行发起，有依赖的串行等待
  5. 汇总决策: 阻塞等待全部子代理返回后，主代理汇总实际返回内容并做最终决策 [→ 阻塞等待与结果真实性]

适用场景与编排策略（步骤2c 的默认原生类型）:
  信息收集（代码扫描/依赖分析/状态查询）:
    → 按模块目录或数据源拆分，每个子代理负责一个目录或数据源
    → 默认类型: Explore（只读）
  代码实现（功能开发/Bug修复/重构）:
    → 按任务项或文件中的函数/类拆分，每个子代理负责一个独立代码段
    → 默认类型: general-purpose / worker
  方案构思（设计阶段多方案对比）:
    → 每个子代理独立构思一个差异化方案，不共享中间结果
    → 指定角色: brainstormer（RLM 角色）— Codex: spawn_agent(agent_type="brainstormer") | Claude: Task(subagent_type="ha-brainstormer")
  质量检查（审查/验证/测试）:
    → 按分析维度拆分（质量/安全/性能），每个子代理负责≥1个维度
    → 默认类型: general-purpose / worker

prompt 构造模板:
  "[跳过指令] 直接执行以下任务，跳过路由评分。
   [语言] 使用 {OUTPUT_LANGUAGE} 输出所有内容。
   [职责边界] 你负责: {按任务类型描述职责边界，见下方}。
   [任务内容] {具体要做什么}。
   [约束条件] {代码风格/格式/限制}。
   [返回格式] 返回: {status: completed|partial|failed, changes: [{file, type, scope}], issues: [...], verification: {lint_passed, tests_passed}}"

  职责边界按任务类型适配:
    代码实现 → "你负责: 任务X。操作范围: {文件路径}中的{函数/类名}。"
    代码扫描 → "你负责: 扫描{目录路径}。分析内容: {文件结构/入口点/依赖关系}。"
    方案构思 → "你负责: 独立构思一个实现方案{差异化方向}。"
    质量检查 → "你负责: {维度名称}维度的检查。检查范围: {文件列表或模块列表}。"
    依赖分析 → "你负责: 分析{模块名}模块。分析内容: {依赖关系/API接口/质量问题}。"
    测试编写 → "你负责: 为{测试文件路径}编写测试用例。覆盖范围: {被测函数/类列表}。"

  标准返回格式（代码实现/测试编写类子代理强制，其他类型按需）:
    status: completed（全部完成）| partial（部分完成）| failed（失败）
    changes: [{file: "路径", type: "create|modify|delete", scope: "函数/类名"}]
    issues: ["发现的问题或风险"]
    verification: {lint_passed: true|false|skipped, tests_passed: true|false|skipped}
    注: 此为 prompt 内嵌简化格式，完整字段定义见 rlm/schemas/agent_result.json（RLM 角色子代理使用完整 schema）
```

---

## CLI 调用通道

| CLI | 通道 | 调用方式 |
|-----|------|----------|
| Claude Code | Task 工具 | `Task(subagent_type="general-purpose", prompt="[RLM:{角色}] {任务描述}")`；支持文件级定义 .claude/agents/*.md |
| Claude Code | Agent Teams | complex 级别，多角色协作需互相通信时（实验性，需 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1）[→ Agent Teams 协议] |
| Codex CLI | spawn_agent | Collab 子代理调度（/experimental 开启，agents.max_depth=1，≤6 并发）；支持 [agents] 角色配置 |
| Codex CLI | spawn_agents_on_csv | CSV 批处理（需 collab+sqlite，≤64 并发），同构任务专用 |
| OpenCode | 子代理 | 内置 coder + task；自定义 .opencode/agents/*.md（前瞻），MCP 服务器 |
| Gemini CLI | 子代理 | 内置 codebase_investigator + generalist + cli_help + browser_agent（实验性），自定义 .gemini/agents/*.md，A2A 远程代理 |
| Qwen Code | 子代理 | 内置 general-purpose，自定义 .qwen/agents/*.md，/agents create 创建，主代理按 description 自动委派 |
| Grok CLI | 子代理 | 主代理直接执行；自定义 .grok/agents/*.md（前瞻），MCP 服务器 |

### Claude Code 调用协议（CRITICAL）

```yaml
原生子代理:
  代码探索/依赖分析 → Task(subagent_type="Explore", prompt="...")
  代码实现 → Task(subagent_type="general-purpose", prompt="...")
  后台任务 → Task(subagent_type="general-purpose", run_in_background=true, prompt="...")

文件级子代理定义（.claude/agents/*.md）:
  作用域: --agents CLI 参数 > .claude/agents/（项目级）> ~/.claude/agents/（用户级）> 插件 agents/
  关键字段: name, description, tools/disallowedTools, model(inherit 默认), skills, memory(user|project|local), background, isolation(worktree)
  helloagents 角色持久化: 部署后调用 Task(subagent_type="ha-{角色名}") 替代 general-purpose + 角色 prompt 拼接

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
    3. 调用 Task 工具: subagent_type="general-purpose", prompt=上述内容
       （若已部署文件级子代理: subagent_type="ha-{角色名}", prompt=任务描述）
    4. 接收结果: 解析子代理返回的结构化结果
    5. 记录调用: 通过 SessionManager.record_agent() 记录

用户自定义代理（当前会话可用的非 ha-* 代理）:
  调用方式: Task(subagent_type="{agent-name}", prompt="{任务描述}")
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
  Task(
    subagent_type="general-purpose",
    prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。
            你负责: 任务 1.1。操作范围: src/api/filter.py 中的空白判定函数。
            任务: 实现空白判定函数，处理空字符串和纯空格输入。
            约束: 遵循现有代码风格，单次只改单个函数，大文件先搜索定位。
            返回: {status: completed|partial|failed, changes: [{file, type, scope}], issues: [...], verification: {lint_passed, tests_passed}}"
  )

示例（DESIGN 步骤10 方案构思，≥3 个并行调用在同一消息中发起）:
  Task(subagent_type="ha-brainstormer", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 独立构思一个实现方案。上下文: {Phase1 收集的项目上下文}。差异化方向: {方向1}。")
  Task(subagent_type="ha-brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的实现路径或架构模式。差异化方向: {方向2}。...")
  Task(subagent_type="ha-brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的权衡取舍（如性能vs可维护性）。差异化方向: {方向3}。...")
```

### Codex CLI 调用协议（CRITICAL）

```yaml
多代理配置（~/.codex/config.toml [agents] 节）:
  启用: /experimental 命令开启 collab 特性（需重启）
  全局设置:
    agents.max_threads: 最大并发子代理线程数（spawn_agent 上限 6，CSV 上限 64）
    agents.max_depth: 嵌套深度（默认 1，仅一层）
  角色定义（每个角色独立配置）:
    [agents.my_role]
    description = "何时使用此角色的指引"
    config_file = "path/to/role-specific-config.toml"  # 标准 config.toml 格式，可覆盖 developer_instructions/model/sandbox 等
    nickname_candidates = ["Nickname1", "Nickname2"]
  config_file 机制: 角色 TOML 作为高优先级配置层覆盖父代理配置（可覆盖 developer_instructions/model/sandbox 等）
  路由豁免: 由父代理 developer_instructions 统一声明子代理豁免条款，所有子代理（原生/HA/用户自定义/未来新增）
    自动继承该豁免，无需 per-role config_file 覆盖
  线程管理: /agent 命令在活跃子代理线程间切换
  审批传播: 父代理审批策略自动传播到子代理

原生子代理:
  代码探索/依赖分析 → spawn_agent(agent_type="explorer", prompt="...")
  代码实现 → spawn_agent(agent_type="worker", prompt="...")
  测试运行 → spawn_agent(agent_type="worker", prompt="...")
  方案构思 → spawn_agent(agent_type="brainstormer", prompt="...")  # DESIGN 步骤10，RLM 角色
  监控轮询 → spawn_agent(agent_type="monitor", prompt="...")  # 长时间运行的轮询任务

上下文分叉策略（fork_context）:
  fork_context=true（子代理继承父代理完整对话历史作为背景，子代理收到系统消息:
    "You are the newly spawned agent. The prior conversation history was forked from your parent agent.
    Treat the next user message as your new task, and use the forked history only as background context."）:
    - reviewer: 审查需要理解完整任务上下文和已执行变更
    - writer: 文档编写需要理解项目背景和决策历史
    - DAG 任务中的实现子代理: 需要理解整体方案和已完成任务的上下文
  fork_context=false（默认，子代理从任务描述获取全部信息，无父代理历史）:
    - brainstormer: 独立构思，任务描述中包含完整的项目上下文和差异化方向
    - CSV 批处理 worker: 同构任务，每行 CSV 自包含全部信息
  调用示例: spawn_agent(agent_type="worker", fork_context=true, prompt="...")

CSV 批处理编排（需 collab + sqlite 特性）:
  同构并行任务 → spawn_agents_on_csv(csv_path, instruction, ...)
  适用: 批量代码审查/批量测试/批量数据处理等每行任务结构相同的场景
  不适用: 异构任务（不同任务需不同工具/不同逻辑）→ 保留 spawn_agent 方式
  参数:
    csv_path: 输入 CSV 路径（每行一个任务，首行为列头）
    instruction: 指令模板，{column_name} 占位符自动替换为行值
    id_column: 可选，指定用作任务 ID 的列名（默认行索引）
    output_csv_path: 可选，结果导出路径（默认自动生成）
    output_schema: 可选，worker 返回结果的 JSON Schema
    max_concurrency: 并发数（默认 {CSV_BATCH_MAX}，上限 64）
    max_runtime_seconds: 单个 worker 超时（默认 1800s）
  执行流程:
    1. 主代理生成任务 CSV（从 tasks.md 提取同构任务行）
    2. 调用 spawn_agents_on_csv，阻塞直到全部完成
    3. 每个 worker 自动收到行数据 + 指令，执行后调用 report_agent_job_result 回报
    4. 成功时自动导出结果 CSV；部分失败时仍导出（含失败摘要）
    5. 主代理读取 output CSV 汇总结果
  进度监控: agent_job_progress 事件持续发出（pending/running/completed/failed）
  状态持久化: SQLite 跟踪每个 item 状态，支持崩溃恢复
  失败处理: 无响应 worker 自动回收 | spawn 失败立即标记 | report_agent_job_result 仅限 worker 会话调用

helloagents 角色:
  角色→agent_type 映射（每个 RLM 角色使用自己的 agent_type，注册在 config.toml [agents.{role}] 节）:
    reviewer → spawn_agent(agent_type="reviewer", prompt="...")
    writer → spawn_agent(agent_type="writer", prompt="...")
    brainstormer → spawn_agent(agent_type="brainstormer", prompt="...")
  路由豁免: 由父代理 developer_instructions 统一处理（见 codex_config.py），
    所有子代理自动继承豁免条款，无需 per-role config_file 覆盖
  执行步骤（同 Claude Code，仅调用方式不同）:
    1. 加载角色预设: 读取 rlm/roles/{角色}.md
    2. 构造 prompt: "[跳过指令] {从角色预设提取的约束} + {具体任务描述}"
    3. 调用 spawn_agent: agent_type="{角色名}", prompt=上述内容
    4. 接收结果: 解析子代理返回的结构化结果
    5. 记录调用: 在 tasks.md 记录调用结果

用户自定义代理（config.toml [agents.{role}] 中非 ha-* 的角色）:
  调用方式: spawn_agent(agent_type="{custom-role}", prompt="{任务描述}")
  配置来源: ~/.codex/config.toml [agents.{role}] 节（用户自行定义 description/config_file/nickname_candidates 等）
  与 RLM 角色的关系:
    互补: 用户角色处理 RLM 角色未覆盖的领域（如 security-auditor、performance-tester）
    替代: 用户角色 description 覆盖某 RLM 角色能力 → 用户角色优先
    共存: 同一任务可同时调度用户角色 + RLM 角色
  命名冲突: 用户角色名与 ha-* 重名 → ha-* 优先（HelloAGENTS 预设不可被覆盖）
  CSV 批处理: 用户角色可作为 spawn_agents_on_csv 的 worker → 同构任务批量分配给自定义角色
  降级: 用户角色执行失败 → 降级到 RLM 角色或主代理直接执行
  Skill/MCP 辅助: DEVELOP 阶段识别到可用 Skill/MCP 可加速当前子任务 → 主动调用（非强制）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（Codex Skills）| MCP 服务器（不支持插件，扩展能力通过 Skill + MCP 实现）

并行调用: 多个无依赖子代理 → 连续发起多个 spawn_agent → collab wait 等待全部完成（支持多ID单次等待）
串行调用: 有依赖 → 逐个 spawn_agent → 等待完成再发下一个
恢复暂停: 子代理超时/暂停 → resume_agent 恢复
中断通信: send_input 向运行中的子代理发送消息（可选中断当前执行，用于纠偏或补充指令）
关闭子代理: close 关闭指定子代理
审批传播: 父代理审批策略自动传播到子代理，可按类型自动拒绝特定审批请求
限制: Collab 特性门控（/experimental 开启），agents.max_depth=1（仅一层嵌套），spawn_agent ≤6 并发，spawn_agents_on_csv ≤{CSV_BATCH_MAX} 并发（上限 64，CSV_BATCH_MAX=0 时禁用）

示例（DESIGN 步骤10 方案构思，≥3 个并行 spawn 后立即 collab wait）:
  spawn_agent(agent_type="brainstormer", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 独立构思一个实现方案。上下文: {Phase1 收集的项目上下文}。差异化方向: {方向1}。")
  spawn_agent(agent_type="brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的实现路径或架构模式。差异化方向: {方向2}。...")
  spawn_agent(agent_type="brainstormer", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的权衡取舍（如性能vs可维护性）。差异化方向: {方向3}。...")
  collab wait  # 立即阻塞等待，禁止在此之前执行其他步骤

示例（spawn_agent 异构并行，每个子代理职责范围不重叠）:
  spawn_agent(agent_type="worker", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 任务1.1。操作范围: filter.py 中的空白判定函数。任务: 实现空白判定逻辑。返回: {status, changes: [{file, type, scope}], issues, verification: {lint_passed, tests_passed}}")
  spawn_agent(agent_type="worker", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 任务1.2。操作范围: validator.py 中的输入校验函数。任务: 实现输入校验逻辑。返回: {status, changes, issues, verification}")
  collab wait

示例（spawn_agents_on_csv 同构批处理，批量审查 30 个文件）:
  # 主代理先生成 CSV: path,module,focus（每行一个任务，如 src/api/auth.py,auth,安全检查）
  spawn_agents_on_csv(csv_path="/tmp/review_tasks.csv", instruction="使用 {OUTPUT_LANGUAGE} 输出。审查 {path} 模块 {module}，重点关注 {focus}。返回: {{score: 1-10, issues: [...], suggestions: [...]}}", output_csv_path="/tmp/review_results.csv", max_concurrency=16)
  # 阻塞直到全部完成（agent_job_progress 事件持续更新），完成后读取 output CSV 汇总结果
```

### Codex CLI 子代理交互策略

```yaml
request_user_input:
  子代理可通过 request_user_input 向用户发起确认请求
  HelloAGENTS 策略:
    DELEGATED 模式: 默认禁止（子代理不得中断自动化流程），审批配置自动拒绝
    INTERACTIVE 模式: 允许（用户可在 /agent 切换线程后响应）
    EHRB Critical: 始终允许（安全优先，无论模式）
  配置: 父代理审批策略自动传播到子代理
```

### Codex CLI 子代理稳定性策略（CRITICAL）

```yaml
目的: 避免子代理反复 spawn→wait→close 循环浪费上下文窗口，尽早切入稳定的主代理执行路径

单次等待策略:
  预估: 主代理在 spawn 前根据子代理任务规模（涉及文件数、预期产出量）预估完成时间
  首次等待: 阻塞等待至预估时间到达，期间不轮询、不执行其他步骤
  超时处理: 预估时间到达后子代理仍未返回 → 检查是否有部分产出（文件变更等）:
    有产出（子代理在正常推进但未完成）→ 追加等待（按已产出进度推算剩余时间）
    无产出 → 进入催促循环（最多 3 轮）:
      每轮: 通过 send_input 催促子代理汇报进度 → 等待响应
        子代理响应且在推进 → 追加等待（退出催促循环，回到正常等待）
        子代理无响应 → 继续下一轮催促
      3 轮催促均无响应 → 降级
  DO NOT: 未到预估时间就提前轮询或降级

降级前置（CRITICAL）:
  触发降级前必须先 close 该批所有运行中的子代理，确认关闭后再接手执行
  DO NOT: 子代理仍在运行时主代理执行相同范围的任务（重复劳动+潜在文件冲突）

连续失败阈值:
  同一流程中（从进入 DESIGN 或 DEVELOP 阶段到状态重置之间）连续 2 个子代理超时/无返回:
    → 进入"主代理直接执行模式"
    行为: 后续所有任务不再尝试 spawn_agent，主代理逐项直接执行
    标注: 在 tasks.md 相关任务后追加 [主代理直接执行]
    退出条件: 当前流程结束（状态重置时自动解除）
  首次失败: 降级当前任务 + 下一个任务仍尝试 spawn_agent

环境检测:
  /experimental 未开启 或 agents.max_threads=0 → 跳过所有子代理调度，主代理直接执行全部任务
  此时不标注 [降级执行]（非降级，而是正常的无子代理模式）

上下文预算感知（DELEGATED 模式）:
  跟踪: 记录子代理 spawn→close 循环累计次数（含所有任务的所有失败尝试）
  阈值: 同一流程中累计 ≥3 次 spawn→close 循环 → 进入主代理直接执行模式（与连续失败阈值触发相同行为）
  目的: 即使失败不连续（中间夹杂成功），累积的上下文消耗也可能过大
```

### Codex CLI 子代理 EHRB 豁免规则（CRITICAL）

```yaml
问题: Codex CLI 无 SubagentStart/Stop hook，子代理对文件系统的操作完成后，
  主代理可能将其误判为"未由我直接触发的外部变更"误触发 EHRB 检测并安全暂停

RLM 角色操作豁免:
  RLM 角色子代理在其数据所有权范围内的操作 → 自动豁免 EHRB 检测，不触发安全暂停
  数据所有权范围（与 services/ 模块定义一致）:
    reviewer: 只读，不修改文件
    brainstormer: 只读，不修改文件
    writer: 任务描述中指定的输出文件路径
  豁免条件: 变更文件路径在该角色的数据所有权范围内
  非豁免: 变更超出角色数据所有权范围 → 按 G2 EHRB 标准流程处理

预期变更注册（通用，无 SubagentStop hook 的 CLI 均适用）:
  机制:
    1. 主代理在 spawn 子代理前，根据任务描述记录预期文件操作范围（哪些路径会被创建/修改/移动/删除）
    2. 子代理完成后，主代理检查实际变更是否在预期范围内
    3. 预期范围内 → 视为预期操作，继续执行，不触发 EHRB 检测
    4. 预期范围外 → 按 G2 EHRB 检测流程处理
  降级: 无法预判预期范围 → 回退到 RLM 角色数据所有权范围判定 → 仍无法判定 → 标准 EHRB 检测
```

### OpenCode / Gemini CLI / Qwen Code / Grok CLI 调用协议

```yaml
通用规则: helloagents 角色执行步骤同 Claude Code 协议，仅调用方式不同
用户扩展通用规则: 所有 CLI 均按 G9 用户代理分配规则调度自定义子代理和 Skills，CLI 原生尚未支持时视为前瞻性路径

OpenCode:
  原生子代理: coder（主交互代理，完整工具权限）| task（只读搜索子代理，由 coder 通过 agent 工具调用）
  调用方式: 主代理自动委派（coder 内部调用 task 进行代码搜索定位）
  自定义子代理: .opencode/agents/*.md（项目级）| ~/.config/opencode/agents/*.md（用户级）
  用户扩展: 自定义子代理调度规则同 G9 用户代理分配规则 | Skills（.opencode/skills/）| MCP 服务器（.opencode.json 配置）
  注: 项目已归档，后继为 Crush；自定义子代理和 Skills 为前瞻性路径规划

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

### Claude Code Agent Teams 协议

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

---

## 调度规则

### 并行调度规则（适用所有 CLI）

```yaml
并行批次上限: ≤6 个子代理/批（Codex CLI CSV 批处理模式 ≤16，可配置至 64）
并行适用: 同阶段内无数据依赖的任务
串行强制: 有数据依赖链的任务（如 DAG 中有 depends_on 依赖的下游任务）

任务分配约束（CRITICAL）:
  职责隔离: 每个并行子代理必须有明确且不重叠的职责范围（不同函数/类/模块/逻辑段）
  禁止重复: 禁止将相同职责范围派给多个子代理（同任务+同文件+同函数=纯浪费）
  同文件允许: 多个子代理可操作同一文件，前提是各自负责不同的函数/类/代码段，prompt 中必须明确各自的操作范围
  复杂任务拆分: 单个复杂任务应拆为多个职责明确的子任务，分配给多个子代理并行执行
  分配前检查: 主代理在派发前确认各子代理的职责范围无重叠，有重叠则合并或重新划分

通用并行信息收集原则（适用所有流程和命令）:
  ≥2个独立文件读取/搜索 → 同一消息中发起并行工具调用（Read/Grep/Glob/WebSearch/WebFetch）
  ≥2个独立分析/验证维度 或 文件数≥2 → 按编排五步法调度子代理并行执行
  轻量级独立数据源（单次读取即可） → 并行工具调用即可，不需要子代理开销
  子代理数量原则: 子代理数 = 实际独立工作单元数（维度数/模块数/文件数），受≤6/批上限约束，禁止用"多个"模糊带过

CLI 实现:
  Claude Code Task: 同一消息多个 Task 调用
  Claude Code Teams: teammates 自动从共享任务列表认领
  Codex CLI spawn_agent: 多个 spawn_agent + collab wait（异构任务，≤6/批）
  Codex CLI spawn_agents_on_csv: CSV 批处理（同构任务，≤{CSV_BATCH_MAX} 并发，需 collab+sqlite，CSV_BATCH_MAX=0 时禁用）
    适用判定: CSV_BATCH_MAX>0 且同层≥6 个结构相同的任务（相同指令模板+不同参数）→ 优先 CSV 批处理
    不适用: CSV_BATCH_MAX=0 | 任务间指令逻辑不同、需要不同工具集、或任务数<6 → 保留 spawn_agent
  OpenCode: 多个 @general / @explore 子会话
  Gemini CLI: 多个子代理自动委派（实验性）
  Qwen Code: 多个自定义子代理自动委派
  Grok CLI: 降级为串行执行
```

### 降级处理

```yaml
降级触发: 子代理调用失败 | CLI 不支持子代理（Grok CLI）
降级执行: 主代理在当前上下文中直接完成任务
降级标记: 在 tasks.md 对应任务后追加 [降级执行]
```

### DAG 依赖调度（适用 DEVELOP 步骤6）

```yaml
目的: 通过 tasks.md 中的 depends_on 字段显式声明任务依赖，自动计算最优并行批次

tasks.md 依赖声明格式:
  [ ] 1.1 {任务描述} | depends_on: []
  [ ] 1.2 {任务描述} | depends_on: [1.1]
  [ ] 1.3 {任务描述} | depends_on: [1.1]
  [ ] 1.4 {任务描述} | depends_on: [1.2, 1.3]

调度算法（主代理在步骤6开始时执行）:
  1. 解析 tasks.md 中所有任务的 depends_on 字段
  2. 循环依赖检测: 发现循环 → 输出: 错误（循环依赖的任务编号）→ 降级为串行执行
  3. 拓扑排序: 计算执行层级（无依赖=第1层，依赖第1层=第2层，以此类推）
  4. 按层级批次派发: 同层级任务并行（每批≤6），层级间串行等待
  5. 失败传播: 某任务失败 → 所有直接/间接依赖该任务的下游任务标记 [-]（前置失败）

无 depends_on 时的降级: 按原有逻辑（主代理自行判断依赖关系）执行
```

### 分级重试策略（适用所有原生子代理调用）

```yaml
目的: 区分失败类型，避免不必要的全量重试

重试分级:
  瞬时失败（timeout/网络错误/CLI异常）:
    → 自动重试 1 次
    → 仍失败 → 标记 [X]，记录错误详情
  逻辑失败（代码错误/文件未找到/编译失败）:
    → 不自动重试
    → 标记 [X]，记录错误详情和失败原因
  部分成功（子代理返回 status=partial）:
    → 保留已完成的变更
    → 未完成部分记录到 issues，由主代理在汇总阶段决定是否补充执行

重试上限: 每个子代理最多重试 1 次
结果保留: 成功的子代理结果始终保留，仅重试失败项

深度分析（break-loop）: 当同一任务经 Ralph Loop 验证循环仍失败（stop_hook_active=true 放行后主代理接手），
  或主代理补充执行仍失败时，执行 5 维度根因分析后再标记 [X]:
  1. 根因分类: 逻辑错误/类型不匹配/依赖缺失/环境问题/设计缺陷
  2. 修复失败原因: 为什么之前的修复尝试没有解决问题
  3. 预防机制: 建议添加什么检查/测试可防止此类问题
  4. 系统性扩展: 同类问题是否可能存在于其他模块（列出可疑位置）
  5. 知识沉淀: 将分析结论记录到验收报告的"经验教训"区域
  触发条件: 逻辑失败 + 已有≥1次修复尝试（子代理重试或 Ralph Loop 循环）
```

---

## 脚本执行规范

```yaml
脚本执行: python -X utf8 '{脚本路径}'
```

---

## 子代理合规检查（阶段验收时执行）

```yaml
子代理调用合规检查（阶段验收时执行）:
  自动编排合规:
    DESIGN 阶段:
      检查: brainstormer 是否已调用 — 条件: ROUTING_LEVEL=R3（R2 跳过多方案对比，不要求 brainstormer）
    DEVELOP 阶段:
      检查: reviewer 是否已调用（complex+涉及核心/安全模块 强制）
      检查: ≥2个独立任务项时子代理是否已编排 — 条件: 任务项≥2 且未标记[降级执行]
    未调用且未标记[降级执行] → ⚠️ 警告性（记录"子代理未按规则调用: {角色名/自动编排}"）
```

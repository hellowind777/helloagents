# 子代理调用协议

本模块定义各 CLI 的子代理调用通道、编排范式和调度规则。

---

## 调用协议

### RLM 角色定义

```yaml
RLM（Role-based Language Model）: HelloAGENTS 的角色子代理系统，通过预设角色调度专用子代理。
角色清单: reviewer, synthesizer, kb_keeper, pkg_keeper, writer
Claude Code agent 文件（安装时部署至 ~/.claude/agents/）:
  reviewer → ha-reviewer.md | synthesizer → ha-synthesizer.md | kb_keeper → ha-kb-keeper.md
  pkg_keeper → ha-pkg-keeper.md | writer → ha-writer.md
原生子代理映射（角色→类型映射，调用语法详见各 CLI 调用协议）:
  代码探索 → Codex: spawn_agent(agent_type="explorer") | Claude: Task(subagent_type="Explore") | OpenCode: @explore | Gemini: codebase_investigator | Qwen: 自定义子代理
  代码实现 → Codex: spawn_agent(agent_type="worker") | Claude: Task(subagent_type="general-purpose") | OpenCode: @general | Gemini: generalist_agent | Qwen: 自定义子代理
  测试运行 → Codex: spawn_agent(agent_type="worker") | Claude: Task(subagent_type="general-purpose") | OpenCode: @general | Gemini: 自定义子代理 | Qwen: 自定义子代理
  方案评估 → Codex: spawn_agent(agent_type="worker") | Claude: Task(subagent_type="general-purpose") | OpenCode: @general | Gemini: generalist_agent | Qwen: 自定义子代理
  方案设计 → Codex: Plan mode | Claude: Task(subagent_type="Plan") | OpenCode: @general | Gemini: 自定义子代理 | Qwen: 自定义子代理
  监控轮询 → Codex: spawn_agent(agent_type="monitor") | Claude: Task(run_in_background=true) | OpenCode: — | Gemini: — | Qwen: —
  批量同构 → Codex: spawn_agents_on_csv | Claude: 多个并行 Task | OpenCode: 多个 @general | Gemini: 多个子代理 | Qwen: 多个子代理
调用方式: 阶段文件中标注 [RLM:角色名] 的位置必须调用角色子代理，各 CLI 调用通道按下文协议执行
```

### 强制调用规则

```yaml
强制调用规则（标注"强制"的必须调用，标注"跳过"的可跳过）:
  EVALUATE: 主代理直接执行，不调用子代理
  DESIGN:
    Phase1（上下文收集）—
    原生子代理 — moderate/complex+现有项目资源 项目资源扫描强制（步骤4）| complex+涉及>5个独立单元 深度依赖分析强制（步骤6）| simple 或新建项目跳过
    helloagents 角色不参与 Phase1
    Phase2（方案构思）—
    原生子代理 — R3 标准流程步骤10 方案构思时强制，≥3 个子代理并行（每个独立构思一个方案）
    synthesizer — complex+评估维度≥3 强制 | 其他跳过
    pkg_keeper — 方案包内容填充时强制（通过 PackageService 调用）
  DEVELOP:
    原生子代理 — moderate/complex 任务改动强制（步骤6，逐项调用）| 新增测试用例时强制（步骤8）| simple 跳过
    reviewer — complex+涉及核心/安全模块 强制 | 其他跳过
    kb_keeper — KB_SKIPPED=false 时强制（通过 KnowledgeService 调用）
    pkg_keeper — 归档前状态更新时强制（通过 PackageService 调用）
  命令路径:
    ~review: 原生子代理 — 审查文件>5 时各分析维度并行（质量/安全/性能，按复杂度分配子代理数量）
    ~validatekb: 原生子代理 — 知识库文件>10 时各验证维度并行（按复杂度分配子代理数量）
    ~init: 原生子代理 — complex 级别大型项目时模块扫描并行

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
  主代理: UserPromptSubmit hook 在每次用户消息时注入 CLAUDE.md 关键规则摘要，确保 compact 后规则不丢失
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
```

### 编排标准范式

```yaml
核心模式: 按职责领域拆分 → 每个子代理一个明确范围 → 并行执行 → 主代理汇总

编排四步法:
  1. 识别独立单元: 从任务中提取可独立执行的工作单元（模块/维度/文件组/职责区）
  2. 分配职责范围: 每个子代理的 prompt 必须明确其唯一职责边界（按任务类型适配，见 prompt 构造模板）
  3. 并行派发: 无依赖的子代理在同一消息中并行发起，有依赖的串行等待
  4. 汇总决策: 所有子代理完成后，主代理汇总结果并做最终决策

适用场景与编排策略:
  信息收集（代码扫描/依赖分析/状态查询）:
    → 按模块目录或数据源拆分，每个子代理负责一个目录或数据源
    → 子代理类型: Explore（只读）
  代码实现（功能开发/Bug修复/重构）:
    → 按任务项或文件中的函数/类拆分，每个子代理负责一个独立代码段
    → 子代理类型: general-purpose / worker
  方案构思（设计阶段多方案对比）:
    → 每个子代理独立构思一个差异化方案，不共享中间结果
    → 子代理类型: general-purpose / worker
  质量检查（审查/验证/测试）:
    → 按分析维度拆分（质量/安全/性能），每个子代理负责≥1个维度
    → 子代理类型: general-purpose / worker

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
| OpenCode | 子代理 | 内置 General（通用）+ Explore（只读探索），主代理自动委派或 @mention 手动触发 |
| Gemini CLI | 子代理 | 内置 codebase_investigator + generalist_agent（实验性），自定义 .gemini/agents/*.md |
| Qwen Code | 子代理 | 自定义子代理框架，/agents create 创建，.qwen/agents/*.md 存储，主代理自动委派 |
| Grok CLI | 代理降级 | 主代理直接执行 |

### Claude Code 调用协议（CRITICAL）

```yaml
原生子代理:
  代码探索/依赖分析 → Task(subagent_type="Explore", prompt="...")
  代码实现 → Task(subagent_type="general-purpose", prompt="...")
  方案设计 → Task(subagent_type="Plan", prompt="...")
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
    | ha-synthesizer.md | synthesizer.md | 通用（只读） |
    | ha-kb-keeper.md | kb_keeper.md | 服务绑定（KnowledgeService） |
    | ha-pkg-keeper.md | pkg_keeper.md | 服务绑定（PackageService） |
    | ha-writer.md | writer.md | 通用（仅手动） |
    命名规则: 代理文件 ha-{name} 对应角色预设 {name}（连字符转下划线）
  执行步骤（阶段文件中遇到 [RLM:角色名] 标记时）:
    1. 加载角色预设: 读取 rlm/roles/{角色}.md
    2. 构造 prompt: "[RLM:{角色}] {从角色预设提取的约束} + {具体任务描述}"
    3. 调用 Task 工具: subagent_type="general-purpose", prompt=上述内容
       （若已部署文件级子代理: subagent_type="ha-{角色名}", prompt=任务描述）
    4. 接收结果: 解析子代理返回的结构化结果
    5. 记录调用: 通过 SessionManager.record_agent() 记录

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
  Task(subagent_type="general-purpose", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 独立构思一个实现方案。上下文: {Phase1 收集的项目上下文}。任务: 输出方案名称、核心思路、实现路径、优缺点。返回: {name, approach, impl_path, pros, cons}")
  Task(subagent_type="general-purpose", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的实现路径或架构模式。...")
  Task(subagent_type="general-purpose", prompt="...你负责: 独立构思一个差异化方案，优先考虑不同的权衡取舍（如性能vs可维护性）。...")
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
    config_file = "path/to/role-specific-config"
    model = "<模型名>"
    model_reasoning_effort = "high"
    sandbox_mode = "read-only"
  线程管理: /agent 命令在活跃子代理线程间切换
  审批传播: 父代理审批策略自动传播到子代理

原生子代理:
  代码探索/依赖分析 → spawn_agent(agent_type="explorer", prompt="...")
  代码实现 → spawn_agent(agent_type="worker", prompt="...")
  测试运行 → spawn_agent(agent_type="worker", prompt="...")
  方案设计 → Codex Plan mode（不需要 spawn）
  监控轮询 → spawn_agent(agent_type="monitor", prompt="...")  # 长时间运行的轮询任务

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
  执行步骤（同 Claude Code，仅调用方式不同）:
    3. 调用 spawn_agent: prompt=上述内容（其余步骤同 Claude Code 协议）

并行调用: 多个无依赖子代理 → 连续发起多个 spawn_agent → collab wait 等待全部完成（支持多ID单次等待）
串行调用: 有依赖 → 逐个 spawn_agent → 等待完成再发下一个
恢复暂停: 子代理超时/暂停 → resume_agent 恢复
中断通信: send_input 向运行中的子代理发送消息（可选中断当前执行，用于纠偏或补充指令）
关闭子代理: close 关闭指定子代理
审批传播: 父代理审批策略自动传播到子代理，可按类型自动拒绝特定审批请求
限制: Collab 特性门控（/experimental 开启），agents.max_depth=1（仅一层嵌套），spawn_agent ≤6 并发，spawn_agents_on_csv ≤{CSV_BATCH_MAX} 并发（上限 64，CSV_BATCH_MAX=0 时禁用）

示例（spawn_agent 异构并行，每个子代理职责范围不重叠）:
  spawn_agent(agent_type="worker", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 任务1.1。操作范围: filter.py 中的空白判定函数。任务: 实现空白判定逻辑。返回: {status, changes: [{file, type, scope}], issues, verification: {lint_passed, tests_passed}}")
  spawn_agent(agent_type="worker", prompt="直接执行以下任务，跳过路由评分。使用 {OUTPUT_LANGUAGE} 输出。你负责: 任务1.2。操作范围: validator.py 中的输入校验函数。任务: 实现输入校验逻辑。返回: {status, changes, issues, verification}")
  collab wait

示例（spawn_agents_on_csv 同构批处理，批量审查 30 个文件）:
  # 主代理先生成 CSV: path,module,focus（每行一个任务，如 src/api/auth.py,auth,安全检查）
  spawn_agents_on_csv(csv_path="/tmp/review_tasks.csv", instruction="使用 {OUTPUT_LANGUAGE} 输出。审查 {path} 模块 {module}，重点关注 {focus}。返回: {{score: 1-10, issues: [...], suggestions: [...]}}", output_csv_path="/tmp/review_results.csv", max_concurrency=16)
  # 阻塞直到全部完成（agent_job_progress 事件持续更新），完成后读取 output CSV 汇总结果
```

### OpenCode / Gemini CLI / Qwen Code 调用协议

```yaml
通用规则: helloagents 角色执行步骤同 Claude Code 协议，仅调用方式不同

OpenCode:
  原生子代理: @explore（只读，代码搜索定位）| @general（完整工具权限，可修改文件）
  调用方式: 主代理自动委派 | 用户 @mention 手动触发 | 子代理创建独立 child session

Gemini CLI（实验性）:
  原生子代理: codebase_investigator（代码库分析和逆向依赖）| generalist_agent（自动路由）
  自定义子代理: .gemini/agents/*.md（项目级）| ~/.gemini/agents/*.md（用户级）| 支持 A2A 协议远程委派

Qwen Code:
  原生子代理: 无固定内置类型，/agents create 创建，主代理按 description 自动匹配委派
  自定义子代理: .qwen/agents/*.md（项目级）| ~/.qwen/agents/*.md（用户级）
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
串行强制: 有数据依赖链的任务（如 design 步骤10: 方案评估→synthesizer）

任务分配约束（CRITICAL）:
  职责隔离: 每个并行子代理必须有明确且不重叠的职责范围（不同函数/类/模块/逻辑段）
  禁止重复: 禁止将相同职责范围派给多个子代理（同任务+同文件+同函数=纯浪费）
  同文件允许: 多个子代理可操作同一文件，前提是各自负责不同的函数/类/代码段，prompt 中必须明确各自的操作范围
  复杂任务拆分: 单个复杂任务应拆为多个职责明确的子任务，分配给多个子代理并行执行
  分配前检查: 主代理在派发前确认各子代理的职责范围无重叠，有重叠则合并或重新划分

通用并行信息收集原则（适用所有流程和命令）:
  ≥2个独立文件读取/搜索 → 同一消息中发起并行工具调用（Read/Grep/Glob/WebSearch/WebFetch）
  ≥3个独立分析/验证维度 或 文件数>5 → 调度原生子代理并行执行
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

无 depends_on 时的降级: 按原有逻辑（主代理手工判断依赖关系）执行
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

## CLI 会话目录

```yaml
Claude Code: ~/.claude/projects/{path_hash}/*.jsonl
  检测: ~/.claude/ 目录存在
  path_hash: 工作目录路径，将 : \ / 替换为 -
Codex CLI: ~/.codex/sessions/{YYYY}/{MM}/{DD}/*.jsonl
  检测: ~/.codex/ 目录存在
其他 CLI: 定位会话存储目录 → 找最新 .jsonl → 提取文件名为 session ID
回退: HelloAGENTS 自生成 UUID
脚本执行: python -X utf8 '{脚本路径}'
```

---

## 子代理合规检查（阶段验收时执行）

```yaml
子代理调用合规检查（阶段验收时执行）:
  TASK_COMPLEXITY=moderate/complex 时:
    DESIGN 阶段（含 Phase1 上下文收集）:
      检查: synthesizer 是否已调用（complex+评估维度≥3 强制）
      检查: pkg_keeper 是否已调用（方案包填充时强制）
    DEVELOP 阶段:
      检查: reviewer 是否已调用（complex+涉及核心/安全模块 强制）
      检查: kb_keeper 是否已调用（KB_SKIPPED=false 强制）
      检查: pkg_keeper 是否已调用（归档前状态更新时强制）
    未调用且未标记[降级执行] → ⚠️ 警告性（记录"子代理未按规则调用: {角色名}"）
  TASK_COMPLEXITY=simple 时:
    跳过检查
```

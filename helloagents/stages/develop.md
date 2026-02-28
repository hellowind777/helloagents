# 开发实施模块

本模块定义开发实施阶段的详细执行规则，执行方案包中的任务清单。

**核心职责:** 执行 tasks.md 中的任务清单，通过子代理完成任务执行和知识库同步。

---

## 模块入口

```yaml
前置:
  NATURAL入口: 方案设计阶段完成（CREATED_PACKAGE 已设置，KB_SKIPPED 和 TASK_COMPLEXITY 已由 DESIGN Phase1 设置）
  DIRECT入口: ~exec 命令（KB_SKIPPED 和 TASK_COMPLEXITY 在本阶段步骤2首次设置）
设置: CURRENT_STAGE = DEVELOP
```

---

## 执行模式适配

按 G5 执行模式行为规范，本阶段补充规则:

### 入口与模式行为

| 入口 | 方案包来源 | 多包处理 |
|------|-----------|---------|
| NATURAL | CREATED_PACKAGE 变量 | 直接执行（仅1个包，多包停顿不触发） |
| DIRECT (~exec) | 扫描 plan/ 目录 | 输出: 确认（方案包选择清单）→ ⛔ END_TURN |

| 模式 | 行为 | 质量问题 | 完成后 |
|------|------|----------|--------|
| INTERACTIVE | 执行步骤1-14 | 记录到验收报告 | 输出: 完成 → 等待确认 |
| DELEGATED | 执行步骤1-14（省略中间态） | 记录到验收报告 | 输出委托执行结果 → 状态重置 |
| DIRECT | 执行步骤1-14 | 记录到验收报告 | 输出执行结果 → 状态重置 |

### 阶段后续

```yaml
完成后流程:
  1. 步骤14 遗留方案包扫描
  2. 流程级验收 [→ G8]
  3. 输出: 完成（验收报告+变更摘要+遗留提示）
  4. 进度快照
  5. → 状态重置
出口条件: 所有任务已执行完毕（标记为 [√]/[X]/[-]），方案包已迁移至 archive/，状态重置完成
注意: 从 auto.md 调用时，流程级验收由 auto.md 统一执行
```

---

## 执行流程

> 按需加载: 按 G7 按需读取表"DEVELOP 按需"行，根据条件加载所需文件

**重要:** 所有文件操作遵循输出精简规范（不输出文件内容、diff、代码片段）

### 步骤1: 确定待执行方案包

```yaml
NATURAL入口（DELEGATED / INTERACTIVE，从 design 阶段进入）:
  读取 CREATED_PACKAGE → 检查存在且完整 → 设置 CURRENT_PACKAGE
  不存在/不完整 → 输出: 错误，停止

DIRECT入口（~exec，CURRENT_PACKAGE 已由 exec.md 设置）:
  验证 CURRENT_PACKAGE 存在且完整
  不存在/不完整 → 输出: 错误，停止
  CURRENT_PACKAGE 未设置（降级）:
    扫描 plan/ → 无方案包→输出: 错误 | 1个→设置 CURRENT_PACKAGE | 多个→输出: 确认（清单）→ ⛔ END_TURN
    用户选择后:
      选择方案包N: 选择对应序号执行
      取消: → 状态重置
  验证完整性失败 → 输出: 错误，停止
```

### 步骤2: 环境变量检查（CRITICAL）

```yaml
KB_SKIPPED 来源:
  NATURAL入口: 由 DESIGN Phase1 已设置，直接使用
  DIRECT入口: 本阶段首次设置，按 G1 KB_CREATE_MODE 判定

TASK_COMPLEXITY 来源:
  NATURAL入口: 由 DESIGN Phase1 已设置，直接使用
  DIRECT入口: 本阶段首次评估，按 G9 复杂度判定标准（基于 tasks.md 任务数+涉及单元数）

影响:
  KB_SKIPPED=true: 步骤5从项目扫描获取上下文，步骤9/10标记跳过
  步骤10 CHANGELOG 始终执行
  TASK_COMPLEXITY: 决定步骤6/7/8 子代理调度策略
```

### 步骤3: 检查方案包类型（CRITICAL）

```yaml
读取 CURRENT_PACKAGE/proposal.md 判断类型:
  overview: [→ services/package.md Overview 类型处理]  # 仅 DIRECT 入口（~exec）触发；NATURAL 入口的 overview 在 DESIGN 阶段已归档处理
  implementation: → 步骤4
```

### 步骤4: 读取方案包

```yaml
读取 CURRENT_PACKAGE 的 tasks.md 和 proposal.md，提取元数据和任务列表
DAG 解析: 检查 tasks.md 中是否包含 depends_on 字段
  有 depends_on → 解析依赖关系，构建依赖图（拓扑排序在步骤6开始时执行）[→ G10 DAG 依赖调度]
  无 depends_on → 按原有逻辑（主代理手工判断依赖关系）
```

### 步骤5: 获取上下文

```yaml
KB_SKIPPED=false → 从知识库读取
KB_SKIPPED=true → 扫描项目现有资源

依赖管理（编程任务）:
  识别项目依赖体系: 扫描项目根目录的依赖声明文件和锁文件，确定语言生态和包管理器
    锁文件优先: 锁文件存在 → 使用对应包管理器（如 yarn.lock→yarn, uv.lock→uv, Gemfile.lock→bundler）
    无锁文件 → 按依赖声明文件推断
  缺失依赖处理（执行中遇到缺失库时不停止，按以下策略自动解决）:
    已声明未安装 → 直接用项目包管理器安装
    任务明确需要的新依赖 → 用项目包管理器添加并更新依赖声明文件
    无法确定是否需要 → 告知用户依赖及原因，确认后安装
  DO NOT: 混用包管理器 | 跳过依赖声明文件直接全局安装
```

### 步骤6: 按任务清单执行改动

```yaml
执行策略: 严格按 tasks.md 逐项执行

子代理调用（按 G9 复杂度判定）:
  moderate/complex → 原生子代理逐项执行任务改动（强制）[→ G10 调用通道]
    每个任务项单独调用一次，prompt 包含: 任务描述 + 目标文件 + 约束条件 + "直接执行，跳过路由评分"
    返回格式要求: {status, changes, issues, verification} [→ G10 标准返回格式]
    接收结果后: 校验 changes.scope 与 prompt 指定范围一致 → 更新任务状态
  simple → 主代理直接执行

并行调度策略:
  有 DAG 依赖图（步骤4已解析）→ 按层级批次派发 [→ G10 DAG 依赖调度]
    第1层（无依赖任务）并行 → 全部完成后 → 第2层并行 → 以此类推
    每层内按批次并行（每批 ≤6）
    失败传播: 某任务 [X] → 所有依赖该任务的下游任务自动标记 [-]（前置失败）
  无 DAG 依赖图 → 主代理手工判断依赖关系，无依赖任务按批次并行（每批 ≤6）
  职责隔离: 每个子代理的 prompt 必须明确其负责的工作范围（编程任务为函数/类/代码段，非编程任务为章节/模块/区域），禁止职责范围重叠
  复杂任务拆分: 单个大任务可拆为多个子任务分配给不同子代理，同文件不同函数允许并行
  同文件并行安全（编程任务）: 各子代理只修改各自负责的函数/类体内代码，不得修改文件级共享区域（imports/模块变量/初始化逻辑），共享区域变更由主代理在汇总阶段统一处理
  Worktree 隔离（Claude Code）: 同文件多区域并行改动时，优先使用 Task(isolation="worktree") 替代函数级隔离，
    由主代理在汇总阶段合并 worktree 变更
  CSV 批处理（Codex CLI）: CSV_BATCH_MAX>0 且同层≥6 个结构相同的任务时，优先使用 spawn_agents_on_csv 替代逐个 spawn_agent [→ G10 Codex CLI 调用协议]
    CSV_BATCH_MAX=0 → 跳过 CSV 批处理，保留 spawn_agent 方式
    主代理从 tasks.md 提取同构任务 → 生成 CSV（列: task_id, file_path, scope, description）→ 构造指令模板 → 调用 spawn_agents_on_csv
    并发上限 {CSV_BATCH_MAX}（默认 16），进度通过 agent_job_progress 事件实时追踪（pending/running/completed/failed/ETA）
    完成后读取 output CSV 汇总结果，更新各任务状态
    不适用时（异构任务/任务数<6）: 保留 spawn_agent 方式

分级重试 [→ G10 分级重试策略]:
  瞬时失败（timeout/网络错误）→ 自动重试 1 次，仍失败 → [X]
  逻辑失败（代码错误/文件未找到）→ 不重试，直接 [X]
  部分成功（status=partial）→ 保留已完成变更，未完成部分由主代理在汇总阶段补充
    主代理补充仍失败 → 标记 [X]，记录已完成和未完成的变更明细
  反复失败 → 触发 break-loop 深度分析（5维度根因分析）后再标记 [X] [→ G10 分级重试策略]

结果校验（主代理在汇总阶段执行）:
  1. 检查每个子代理返回的 changes.scope 是否与 prompt 指定范围一致（越界 → 警告）
  2. 检查不同子代理的 changes 是否存在文件级冲突（同文件共享区域 → 主代理合并）
  3. 汇总所有 issues → 记录到验收报告

任务状态处理:
  成功 → [√]，更新进度快照
  跳过 → [-]（前置失败/条件不满足/已被覆盖/DAG 上游失败）
  失败 → [X]，记录错误，继续后续任务
    所有任务完成后如有失败:
      INTERACTIVE/DIRECT → 输出: 确认（失败清单）→ ⛔ END_TURN（继续/取消）
      DELEGATED → 记录到验收报告

编程任务编辑: 大文件(≥2000行)先搜索定位再精确修改，每次只改单个函数/类
```

**进度快照更新（CRITICAL）:**
```yaml
时机: 每次状态变更后
内容: 更新 tasks.md 状态符号 + LIVE_STATUS 区域 [→ G11] + 追加执行日志(最近5条)
```

### 步骤7: 安全与质量检查

```yaml
编程任务:
  检查: 不安全模式(eval/exec/SQL拼接) + 敏感信息硬编码 + EHRB 风险 [→ G2]
  检测到 EHRB → 按 G2 处理流程执行
  子代理调用（按 G9 复杂度判定）:
    complex+涉及核心/安全模块 → [RLM:reviewer] 执行代码审查（强制）[→ G10 调用通道]
    其他 → 主代理直接执行安全检查

非编程任务:
  检查: 敏感信息泄露（PII/商业机密/未授权数据引用）+ EHRB 风险 [→ G2]
  检测到 EHRB → 按 G2 处理流程执行
  无风险 → 跳过，标注"ℹ️ 安全检查: 无代码产物，仅执行敏感信息检查"
```

### 步骤8: 测试执行与验证

```yaml
编程任务:
  策略: 从具体到广泛（修改的代码→更广泛测试）
  子代理调用:
    需要新增测试用例时 → 调度原生子代理设计并编写测试用例（强制）[→ G10 调用通道]
      独立测试文件≥2时按文件分配子代理并行编写（子代理数=文件数，≤6/批）
      每个子代理 prompt 明确: 负责的测试文件路径 + 被测函数/类列表 + 测试框架约束
    仅运行已有测试 → 主代理直接执行
  并行优化: reviewer（步骤7）和测试子代理（步骤8）均需调用且无依赖时 → 并行调度
    适用: 测试用例设计不依赖 reviewer 审查结论
    不适用: 测试需根据 reviewer 发现调整测试策略
  测试失败处理:
    ⛔ 阻断性(核心功能): 立即停止 → 输出: 警告 → ⛔ END_TURN（修复/跳过/终止）
    ⚠️ 警告性(重要功能): 标注继续
    ℹ️ 信息性(次要功能): 记录继续
  无测试框架: 询问是否引入最小测试基建，拒绝则记录风险跳过
  代码格式化: 最多3次修复
  Claude Code 环境: SubagentStop hook 自动执行验证循环（Ralph Loop），步骤8 的手动验证作为补充
  其他 CLI: 主代理在步骤8 手动执行验证（现有流程不变）

非编程任务:
  验证: 成果完整性（任务清单要求的产出物是否齐全）+ 内容质量抽检（格式/结构/关键信息覆盖）
  无自动化测试，主代理直接执行验证

**DO NOT:** 修复无关错误或失效测试，向没有格式化器的代码库添加格式化器
```

### 步骤9: 同步更新知识库

```yaml
前置: KB_SKIPPED=true → 跳过，标注"⚠️ 知识库同步已跳过"
重要: KB_SKIPPED=false 时，必须在步骤13（迁移方案包）之前完成知识库同步

子代理调用（KB_SKIPPED=false 时强制）:
  [RLM:kb_keeper] 执行知识库同步（通过 KnowledgeService 调用）[→ G10 调用通道]

同步: modules/{模块名}.md + _index.md（必须）| context.md/INDEX.md（按需）
原则: 代码为唯一来源，最小变更，术语一致
```

### 步骤10: 更新 CHANGELOG

```yaml
执行: 不受 KB_SKIPPED 影响 [→ services/knowledge.md CHANGELOG 更新规则]
```

### 步骤11: 一致性审计

```yaml
前置: KB_SKIPPED=true → 跳过
说明: 步骤9 KnowledgeService.sync() 内部由 synthesizer 执行细粒度一致性对照，本步骤为主代理的宏观验证
审计: 完整性（本次变更涉及的模块文档已更新）+ 一致性（变更模块的 API/数据模型与代码一致）

真实性原则: [→ 核心原则]（例外: 方案包设计意图或代码有明显Bug时修正代码）
```

### 步骤12: 代码质量分析（有测试框架或静态分析工具时执行，否则跳过）

```yaml
发现问题:
  所有模式 → 输出: ℹ️ 代码质量建议（记录到验收报告，可后续处理），继续执行
```

### 步骤13: 迁移方案包至 archive/

⚠️ **CRITICAL - 不可跳过的原子性操作**

```yaml
脚本: migrate_package.py <package-name>

执行:
  1. [RLM:pkg_keeper] 更新 tasks.md 任务状态和备注（非[√]任务添加 > 备注: {原因}）（通过 PackageService 调用）[→ G10 调用通道]
  2. 迁移 plan/ → archive/YYYY-MM/（从方案包名提取年月）
  3. 更新 archive/_index.md

脚本返回 success=false → 按 rules/tools.md AI降级接手流程处理
同名冲突: 强制覆盖 archive/ 中的旧方案包

⚠️ 迁移后 plan/ 源文件路径失效，确保步骤9已完成内容读取
```

### 步骤14: 遗留方案包扫描

```yaml
时机: 方案包迁移完成后
扫描: [→ services/package.md scan()]
```

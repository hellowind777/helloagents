# 项目分析模块

本模块定义项目分析阶段的详细规则，在 R2 简化流程或 R3 标准流程下执行。

**核心职责:** 纯信息收集，不做设计决策。为后续 DESIGN 阶段提供完整、准确的项目上下文。

---

## 模块入口

```yaml
前置: ROUTING_LEVEL = R2 或 R3
设置: CURRENT_STAGE = ANALYZE
```

---

## 执行模式适配

按 G5 执行模式行为规范，本阶段补充规则:

```yaml
INTERACTIVE: 输出阶段完成摘要 → ⛔ END_TURN
DELEGATED/DELEGATED_PLAN: 输出摘要后自动进入方案设计

完成后: CURRENT_STAGE = DESIGN → 进入方案设计阶段
```

---

## 执行流程

### 步骤1: 知识库开关检查

```yaml
KB_CREATE_MODE=0 → KB_SKIPPED=true
KB_CREATE_MODE=1/2/3 → KB_SKIPPED=false
传递: 后续阶段(design/develop)直接使用此值
```

### 步骤2: 检查知识库状态

```yaml
前置: KB_SKIPPED=false 时执行

知识库状态显示:
  KB_CREATE_MODE=0: "⚠️ 已跳过（开关关闭）"
  存在: "✅ 已加载"
  MODE=1 不存在: "⚠️ 不存在（建议 ~init）"
  MODE=2 不存在: 编程任务→"🔄 已自动创建" | 非编程→同MODE=1
  MODE=3 不存在: "🔄 已自动创建"

需要用户确认时（MODE=1不存在 或 MODE=2非编程不存在）:
  输出: 确认（知识库状态）
  ⛔ END_TURN
  用户确认后:
    初始化: → ~init
    跳过: KB_SKIPPED=true，继续执行
    取消: → 状态重置
```

### 步骤3: 初步复杂度评估

```yaml
评估: 按 G9 复杂度判定标准，基于已知信息初步设置 TASK_COMPLEXITY = simple | moderate | complex
依据: 需求描述中的文件数/模块数/跨层级等维度（精确值待步骤5后确认）
脚本（可选）: project_stats.py

检测到 complex:
  INTERACTIVE → 输出: 确认（复杂度评估结果）→ 继续 / 取消(→状态重置)
  DELEGATED/DELEGATED_PLAN → 继续执行，标注"complex 级别，已启用子代理编排"
```

### 步骤4: 获取项目上下文

```yaml
KB_SKIPPED=true → 扫描代码库
KB_SKIPPED=false → 知识库优先，不足则扫描代码库

子代理调用（按步骤3 TASK_COMPLEXITY）:
  moderate/complex → [RLM:explorer] 执行代码库扫描和结构分析 [→ G10 调用通道]
  simple → 主代理直接执行
```

### 步骤5: 提取关键目标与成功标准

```yaml
从完整需求提炼核心目标，明确可验证的成功标准
```

### 步骤6: 技术分析与准备

```yaml
执行: 定位相关模块 + 针对当前任务涉及的模块进行质量检查(过时信息/安全风险/代码异味) + 问题诊断(日志/错误)
外部工具: 需要最新技术文档时按 G4 规则调用，保存/恢复 CURRENT_STAGE
输出物: 项目上下文（技术栈、模块结构、质量问题、技术约束）

子代理调用:
  complex+依赖>5模块 → [RLM:analyzer] 执行深度依赖分析和质量评估（强制）[→ G10 调用通道]
  其他 → 主代理直接执行

并行优化: 当 complex+依赖>5 且步骤4 explorer 和步骤6 analyzer 均需调用时:
  - 若 analyzer 分析目标已明确（不依赖 explorer 结果）→ 并行调度两者
  - 否则 → 保持串行（explorer 先完成，结果传给 analyzer）
  实现: Claude Code 同一消息多个 Task | Codex CLI 多个 spawn_agent + collab wait

复杂度确认: 根据完整分析结果修正 TASK_COMPLEXITY（若与步骤3初评不同则更新）

**DO NOT:** 做技术选型决策（留给DESIGN），设计实现方案（留给DESIGN），修改代码（留给DEVELOP）
```

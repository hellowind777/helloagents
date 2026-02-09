# 项目分析模块

本模块定义项目分析阶段的详细规则，在 R2 适度或 R3 标准级别下执行。

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
  输出: 确认（知识库状态） → 初始化(→~init) / 跳过(KB_SKIPPED=true) / 取消(→状态重置)
```

### 步骤3: 获取项目上下文

```yaml
KB_SKIPPED=true → 扫描代码库
KB_SKIPPED=false → 知识库优先，不足则扫描代码库
子代理: 按 G9/G10 规则（原生优先，RLM兜底）
```

### 步骤4: 提取关键目标与成功标准

```yaml
从完整需求提炼核心目标，明确可验证的成功标准
```

### 步骤5: 技术分析与准备

```yaml
执行: 定位相关模块 + 针对当前任务涉及的模块进行质量检查(过时信息/安全风险/代码异味) + 问题诊断(日志/错误)
外部工具: 需要最新技术文档时按 G4 规则调用，保存/恢复 CURRENT_STAGE
输出物: 项目上下文（技术栈、模块结构、质量问题、技术约束）

**DO NOT:** 做技术选型决策（留给DESIGN），设计实现方案（留给DESIGN），修改代码（留给DEVELOP）
```

### 步骤6: 大型项目检测

```yaml
检测: 按 G9 complex 级别条件评估
脚本（可选）: project_stats.py

检测到大型项目:
  INTERACTIVE → 输出: 确认 → 继续/取消
  DELEGATED/DELEGATED_PLAN → 继续执行，标注"大型项目，已启用分批处理"
```

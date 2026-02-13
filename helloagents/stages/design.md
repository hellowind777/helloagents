# 方案设计模块

本模块定义方案构思和详细规划的执行规则，在 R2 简化流程或 R3 标准流程下执行。

**核心职责:** 设计实现方案，生成方案包（proposal.md + tasks.md）。

---

## 模块入口

```yaml
前置: 项目分析阶段完成
设置: CURRENT_STAGE = DESIGN
```

---

## 执行模式适配

按 G5 执行模式行为规范，本阶段补充规则:

### 模式行为

| 模式 | R3 标准流程 | R2 简化流程 |
|------|----------|----------|
| INTERACTIVE | 输出方案对比→用户选择→详细规划→进入 DEVELOP | 直接规划→进入 DEVELOP |
| DELEGATED | 推荐方案作为选择→详细规划→进入 DEVELOP | 直接规划→进入 DEVELOP |
| DELEGATED_PLAN | 推荐方案作为选择→详细规划→验收→结束 | 直接规划→验收→结束 |

⚠️ 选择方案 = 确认执行，不再有第二次确认

### 阶段切换

```yaml
方案确定后:
  overview 类型:
    INTERACTIVE → 询问归档 → 归档 → 输出完成 → 状态重置
    DELEGATED → 直接归档，总结中标注
  implementation 类型:
    设置 CREATED_PACKAGE = 方案包路径
    DELEGATED_PLAN → 返回 plan.md 执行验收
    其他 → CURRENT_STAGE = DEVELOP → 进入开发实施
```

### 推荐方案选择（DELEGATED模式）

```yaml
策略: 评估风险与收益 → 优先"推荐"标记方案 → 无推荐则选风险最低
记录: 在 proposal.md 中记录选择理由
```

---

## 执行流程

### 步骤1: 模式分支判定

| 模式 | 特点 | 流程 | 子代理 |
|------|------|------|--------|
| R2 简化流程 | 跳过多方案对比 | → 步骤5 | [RLM:designer] R2 moderate/complex 强制 [→ G10 调用通道] |
| R3 标准流程 | 复杂任务多方案对比 | → 步骤2-7 | [RLM:analyzer] R3+候选方案≥2 强制 [→ G10 调用通道] |

### 步骤2: 准备工作

```yaml
知识库检查: 使用 analyze.md 已设置的 KB_SKIPPED 值
上下文获取: KB_SKIPPED=false→知识库读取 | KB_SKIPPED=true→扫描代码库
项目规模判定: 使用 ANALYZE 阶段已设置的 TASK_COMPLEXITY，影响任务拆分粒度
```

### 步骤3: 分析判定

**项目场景判定:**

| 场景 | 特征 | 原则 | 填充深度 |
|------|------|------|----------|
| 新项目 | 初始化/从零开始 | 大胆创意，含产品视角分析 | 完整填充 |
| 现有项目 | 修改/优化/修复 | 精准执行，尊重现有代码 | 精简填充 |

**R3 标准流程触发条件（多方案对比判定）:**
- 新项目初始化/重大重构
- 架构决策/技术选型
- 多种实现路径
- 涉及>1模块或>3文件
- 用户明确要求多方案

### 步骤4: 方案构思与评估（仅 R3 标准流程）

⚠️ **串行强制:** DESIGN 阶段存在严格数据依赖链:
analyzer(评估) → designer(规划) → synthesizer(综合) → pkg_keeper(填充)
每个角色的输入依赖前一个角色的输出，禁止并行调度

```yaml
R3 标准流程: 生成2-3个方案 → [RLM:analyzer] 详细评估（强制）[→ G10 调用通道] → 确定推荐方案
  评估标准: 优缺点、性能、可维护性、复杂度、风险(含EHRB)、成本、最佳实践
  子代理调用（按 G9 复杂度判定）:
    complex+评估维度≥3 → [RLM:synthesizer] 综合多方案评估结果（强制）[→ G10 调用通道]
    其他 → 主代理直接综合
  INTERACTIVE → 输出方案对比 → ⛔ END_TURN（等待用户选择方案N / 重新构思 / 取消(→状态重置)）
  DELEGATED → 推荐方案直接进入步骤5

R2 简化流程: 直接确定唯一方案 → 步骤5
```

**DO:** 所有方案详情完整输出后才提供选择

**DO NOT:** 在方案详情输出前提供选项

### 步骤5: 详细规划

```yaml
脚本: create_package.py <feature> [--type <implementation|overview>]
目录创建: 按 G1 写入策略自动创建

脚本返回 success=false → 按 rules/tools.md AI降级接手流程处理

填充步骤:
  1. create_package.py 创建目录和模板
  2. 处理执行报告
  3. [RLM:pkg_keeper] 填充 proposal.md（按场景深度）和 tasks.md（元数据头部+任务清单+状态符号）（通过 PackageService 调用）[→ G10 调用通道]
  4. 设置 CREATED_PACKAGE
```

### 步骤6: 方案包验收

```yaml
脚本: validate_package.py ${CREATED_PACKAGE}

验收项:
  ⛔ 阻断性: 结构完整(proposal.md+tasks.md 存在非空)，格式正确
  ⚠️ 警告性: 任务清单可执行，tasks.md 含元数据头部

失败处理:
  INTERACTIVE → 输出: 警告（验证详情）→ 修复/强制继续/取消
  DELEGATED:
    阻断性 → 中断委托 → ⛔ END_TURN（等待用户决策）
    警告性 → 记录继续
```

### 步骤7: 输出与后续

```yaml
输出: 按执行模式适配规则
遗留方案包扫描: DELEGATED_PLAN 流程结束时执行
```

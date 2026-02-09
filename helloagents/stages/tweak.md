# 微调模式模块

本模块定义 R1 微调级别（修改点可直接定位、无设计决策、实现路径唯一）的执行规则。

---

## 模块入口

```yaml
前置: ROUTING_LEVEL = R1
设置: CURRENT_STAGE = TWEAK，保持 WORKFLOW_MODE 和 STAGE_ENTRY_MODE 不变
```

---

## 执行模式适配

按 G5 执行模式行为规范，本阶段补充规则:

| 模式 | 行为 | 完成后 |
|------|------|--------|
| INTERACTIVE | 完成后输出结果，等待确认 | 输出: 完成 |
| DELEGATED | 执行并输出微调结果摘要 | → 状态重置 |
| DELEGATED_PLAN | ~plan 遇到 R1 时在 plan.md 提供选择（直接执行→INTERACTIVE / 强制规划→升级R2） | — |

### 升级判定规则

```yaml
触发: 执行中发现超出预期（需分析后定位 / 涉及设计决策 / 跨模块影响 / EHRB风险）

处理:
  INTERACTIVE → 输出: 确认（升级询问）→ 升级(→R2) / 强制继续(CHANGELOG标注) / 取消(回滚+状态重置)
  DELEGATED → 保持DELEGATED，升级为 R2，总结中标注
  DELEGATED_PLAN → 保持DELEGATED_PLAN，升级为 R2

升级后: 保存当前修改 → CURRENT_STAGE=ANALYZE → 进入 R2 适度阶段链
```

---

## 执行流程

### 步骤1: 知识库开关检查

```yaml
微调模式特殊规则: 无论 KB_CREATE_MODE 值如何，始终设置 KB_SKIPPED=true
原因: 微调是轻量级操作，不触发完整知识库创建
CHANGELOG 更新: 按 G1 写入策略处理
```

### 步骤2: 定位文件

```yaml
工具: 文件查找定位目标文件 + 内容搜索定位修改位置
失败: INTERACTIVE→询问用户 | DELEGATED→输出错误终止
```

### 步骤3: 直接修改

```yaml
按需求直接修改代码，不创建方案包
修改前确认范围符合微调条件，超出范围→触发升级判定
```

### 步骤4: 知识库同步

```yaml
CHANGELOG 更新（微调特殊规则）:
  格式: - **[模块名]**: 微调描述 + 类型标注 + 文件:行号范围
  记录在 CHANGELOG.md "微调"分类下

KB 行为: [→ services/knowledge.md CHANGELOG KB 行为]

**DO NOT:** 触发完整知识库创建（即使 KB_CREATE_MODE=3），创建不存在的模块文档
```

### 步骤5: 遗留方案包扫描

按 services/package.md scan() 接口执行遗留方案包扫描。

### 步骤6: 微调后验收

```yaml
验收项（均为警告性）:
  - 变更已应用: 确认文件已保存、变更与预期一致、无语法错误
  - 快速测试（如有测试框架）: 优先相关单元测试，次选冒烟测试
    跳过条件: 无测试框架 / 无法识别相关测试 / 超时>30秒

失败: 记录到报告，提示检查，不阻塞
DELEGATED: 问题记录到验收报告
```

### 步骤7: 输出与后续

```yaml
输出: 完成（验收状态+变更摘要+验证结果+问题汇总）
→ 状态重置
```

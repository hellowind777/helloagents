# 开发实施模块

本模块定义开发实施阶段的详细执行规则，执行方案包中的任务清单。

**核心职责:** 执行 tasks.md 中的任务清单，通过子代理完成代码修改和知识库同步。

---

## 模块入口

```yaml
前置:
  NATURAL入口: 方案设计阶段完成
  DIRECT入口: ~exec 命令
设置: CURRENT_STAGE = DEVELOP
```

---

## 执行模式适配

按 G5 执行模式行为规范，本阶段补充规则:

### 入口与模式行为

| 入口 | 方案包来源 | 多包处理 |
|------|-----------|---------|
| NATURAL | CREATED_PACKAGE 变量 | 直接执行 |
| DIRECT (~exec) | 扫描 plan/ 目录 | 输出: 确认（方案包选择清单）→ ⛔ END_TURN |

| 模式 | 行为 | 质量问题 | 完成后 |
|------|------|----------|--------|
| INTERACTIVE | 执行步骤1-14 | 询问用户 | 输出: 完成 → 等待确认 |
| DELEGATED | 执行步骤1-14（省略中间态） | 在总结中列出 | 输出委托执行结果 → 状态重置 |
| DIRECT | 执行步骤1-14 | 询问用户 | 输出执行结果 → 状态重置 |

### 阶段后续

```yaml
完成后流程:
  1. 步骤14 遗留方案包扫描
  2. 流程级验收 [→ G8]
  3. 输出: 完成（验收报告+变更摘要+遗留提示）
  4. 进度快照
  5. → 状态重置
注意: 从 auto.md 调用时，流程级验收由 auto.md 统一执行
```

---

## 执行流程

**重要:** 所有文件操作遵循输出精简规范（不输出文件内容、diff、代码片段）

### 步骤1: 确定待执行方案包

```yaml
DELEGATED:
  读取 CREATED_PACKAGE → 检查存在且完整 → 设置 CURRENT_PACKAGE
  不存在/不完整 → 输出: 错误，停止

INTERACTIVE / DIRECT:
  扫描 plan/ → 无方案包→输出: 错误 | 1个→设置 CURRENT_PACKAGE | 多个→输出: 确认（清单）→ ⛔ END_TURN
  验证完整性失败 → 输出: 错误，停止
```

### 步骤2: 知识库开关检查（CRITICAL）

```yaml
KB_SKIPPED 来源:
  NATURAL入口: 由 analyze.md 已设置，直接使用
  DIRECT入口: 本阶段首次设置，按 G1 KB_CREATE_MODE 判定

影响:
  KB_SKIPPED=true: 步骤5从代码扫描获取上下文，步骤9/10标记跳过
  步骤10 CHANGELOG 始终执行
```

### 步骤3: 检查方案包类型（CRITICAL）

```yaml
读取 CURRENT_PACKAGE/proposal.md 判断类型:
  overview: [→ services/package.md Overview 类型处理]
  implementation: → 步骤4
```

### 步骤4-5: 读取方案包 + 获取上下文

```yaml
步骤4: 读取 CURRENT_PACKAGE 的 tasks.md 和 proposal.md，提取元数据和任务列表
步骤5: KB_SKIPPED=false→从知识库读取 | KB_SKIPPED=true→扫描代码库
```

### 步骤6: 按任务清单执行代码改动

```yaml
执行: 严格按 tasks.md 逐项执行，子代理: implementer

任务状态处理:
  成功 → [√]，更新进度快照
  跳过 → [-]（前置失败/条件不满足/已被覆盖）
  失败 → [X]，记录错误，继续后续任务
    所有任务完成后如有失败:
      INTERACTIVE/DIRECT → 输出: 确认（失败清单）→ 继续/终止
      DELEGATED → 总结中列出，清除 WORKFLOW_MODE

代码编辑: 大文件(≥2000行)先搜索定位再精确修改，每次只改单个函数/类
```

**进度快照更新（CRITICAL）:**
```yaml
时机: 每次状态变更后
内容: 更新 tasks.md 状态符号 + LIVE_STATUS 区域 [→ G11] + 追加执行日志(最近5条)
```

### 步骤7: 代码安全检查

```yaml
检查: 不安全模式(eval/exec/SQL拼接) + 敏感信息硬编码 + EHRB 风险 [→ G2]
检测到 EHRB → 按 G2 处理流程执行
```

### 步骤8: 测试执行与验证

```yaml
策略: 从具体到广泛（修改的代码→更广泛测试）

测试失败处理:
  ⛔ 阻断性(核心功能): 立即停止 → 输出: 警告 → 修复/跳过/终止
  ⚠️ 警告性(重要功能): 标注继续
  ℹ️ 信息性(次要功能): 记录继续

无测试框架: 询问是否引入最小测试基建，拒绝则记录风险跳过
代码格式化: 最多3次修复

**DO NOT:** 修复无关错误或失效测试，向没有格式化器的代码库添加格式化器
```

### 步骤9: 同步更新知识库

```yaml
前置: KB_SKIPPED=true → 跳过，标注"⚠️ 知识库同步已跳过"
子代理: kb_keeper（synthesizer 参与一致性对照）
重要: KB_SKIPPED=false 时，必须在步骤13迁移方案包前完成读取

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
审计: 完整性（本次变更涉及的模块文档已更新）+ 一致性（变更模块的 API/数据模型与代码一致）

真实性原则: [→ 核心原则]（例外: 方案包设计意图或代码有明显Bug时修正代码）
```

### 步骤12: 代码质量分析（可选）

```yaml
发现问题:
  INTERACTIVE → 输出: 确认（优化建议）→ 执行优化/跳过
  DELEGATED/DIRECT → 总结中列出（不执行）
```

### 步骤13: 迁移方案包至 archive/

⚠️ **CRITICAL - 不可跳过的原子性操作**

```yaml
脚本: migrate_package.py <package-name>

执行:
  1. 更新 tasks.md 任务状态和备注（非[√]任务添加 > 备注: {原因}）
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

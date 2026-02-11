# ~exec 命令 - 执行方案包

本模块定义执行方案包命令的执行规则。

---

## 命令说明

```yaml
命令: ~exec [<方案包名称>]
类型: 目标选择类
功能: 执行 plan/ 目录中的方案包
模式: STAGE_ENTRY_MODE = DIRECT
评估: 需求理解 + EHRB 检测（不评分不追问）
```

---

## 执行模式适配

```yaml
规则:
  1. DIRECT 入口模式，跳过评估和设计阶段
  2. 默认保持 INTERACTIVE 工作流模式
  3. 直接从方案包进入开发实施阶段
  4. Overview 类型方案包需归档而非执行
```

---

## 执行流程

### 步骤1: 需求理解 + EHRB 检测

```yaml
设置: STAGE_ENTRY_MODE = DIRECT, WORKFLOW_MODE = INTERACTIVE
无独立输出，直接进入下一步
```

### 步骤2: 扫描方案包

```yaml
前置迁移: upgradewiki.py --migrate-root（静默执行，确保旧目录名已迁移后再扫描）

脚本: list_packages.py

结果处理:
  0个方案包: 输出: 错误，流程终止
  1个方案包 或 命令指定名称匹配:
    输出: 确认（方案包名称+类型+任务数）
    ⛔ END_TURN
    用户确认后:
      继续: 设置 CURRENT_PACKAGE → 验证完整性
      取消: → 状态重置
  多个方案包（未指定）:
    输出: 确认（方案包选择清单）
    ⛔ END_TURN
    用户选择后:
      选择方案包N: 设置 CURRENT_PACKAGE → 验证完整性
      取消: → 状态重置

验证方案包完整性:
  检查: proposal.md（存在且非空）+ tasks.md（至少1个任务项）
  失败: 输出: 错误，流程终止

检查方案包类型:
  implementation: → 步骤3
  overview: → Overview 类型处理
```

### 步骤3: 开发实施

```yaml
加载: stages/develop.md [阻塞式]
```

### 步骤4: 后续操作

```yaml
验收: 按 G8 流程级验收规则执行
遗留方案包扫描 [→ services/package.md scan()]
输出: 完成（验收报告+变更摘要）
→ 状态重置
```

---

## Overview 类型处理

```yaml
输出: 确认（Overview 类型处理）
⛔ END_TURN

用户选择后:
  归档: 迁移方案包至 archive/
  查看: 显示 proposal.md 内容，再次询问
  取消: → 状态重置
```

---

## 不确定性处理

| 场景 | 处理 |
|------|------|
| plan/ 目录不存在 | 输出: 错误，提示无方案包 |
| 方案包验证失败 | 输出具体缺失项，建议修复或重新规划 |
| 方案包类型无法识别 | 默认按 implementation 类型处理 |

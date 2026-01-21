# ~exec 命令 - 执行方案包

本模块定义执行方案包命令的执行规则。

---

## 命令说明

```yaml
命令: ~exec [<方案包名称>]
类型: 目标选择类
功能: 直接执行 plan/ 目录中的方案包，跳过需求评估和方案设计
模式: STAGE_ENTRY_MODE = DIRECT
```

---

## 执行模式适配

> 📌 规则引用: 按 G4 路由架构及 G5 执行模式规则执行

<mode_adaptation>
~exec 模式适配规则:
1. 本命令使用 DIRECT 入口模式，跳过评估和设计阶段
2. 默认保持 INTERACTIVE 工作流模式
3. 直接从方案包进入开发实施阶段
4. Overview 类型方案包需特殊处理（归档而非执行）
</mode_adaptation>

---

## 执行流程

### 步骤1: 设置状态变量

```yaml
执行内容:
  - STAGE_ENTRY_MODE = DIRECT
  - WORKFLOW_MODE = INTERACTIVE（保持默认）
```

### 步骤2: 扫描方案包

> 脚本路径、存在性检查、错误恢复规则见 references/rules/tools.md

**脚本调用:** `list_packages.py`

<package_scan_analysis>
方案包扫描推理过程:
1. 扫描 helloagents/plan/ 目录
2. 统计有效方案包数量
3. 根据数量和命令参数决定选择策略
</package_scan_analysis>

```yaml
扫描范围: helloagents/plan/ 目录

判断处理:
  0个方案包: 按 G3 场景内容规则（错误）输出，流程终止
  1个方案包: 自动选择，设置 CURRENT_PACKAGE
  多个方案包:
    - 如命令指定了方案包名称: 匹配并选择
    - 如未指定: 按 G3 场景内容规则（确认）输出，等待用户选择
```

### 步骤3: 验证方案包完整性

<package_validation_analysis>
方案包验证推理过程:
1. 检查 proposal.md 存在性和非空性
2. 检查 tasks.md 存在性和任务项数量
3. 判定方案包是否满足执行条件
</package_validation_analysis>

```yaml
检查必需文件:
  - proposal.md（存在且非空）
  - tasks.md（存在且至少1个任务项）

验证失败: 按 G3 场景内容规则（错误）输出，流程终止
```

### 步骤4: 检查方案包类型

<package_type_analysis>
方案包类型判定推理过程:
1. 读取 proposal.md 内容
2. 识别方案包类型（implementation/overview）
3. 根据类型决定后续处理路径
</package_type_analysis>

```yaml
读取: proposal.md 判断类型

implementation 类型: 继续执行开发实施
overview 类型: 按"Overview 类型处理"规则执行
```

### 步骤5: 开发实施

```yaml
执行规则: 读取并执行 references/stages/develop.md
```

### 步骤6: 流程级验收

```yaml
执行规则: 按 G9 "流程级验收规则" 执行（验收内容详见 G9）

遗留方案包扫描:
  执行规则: 按 G7 "遗留方案包扫描" 执行
  扫描时机: 流程即将结束时
  显示条件: 检测到≥1个遗留方案包
  详细规则: 参考 references/rules/package.md "遗留方案包处理"

完成后: 按 G3 场景内容规则（完成）输出执行命令结果（含验收报告）
执行: 按 G7 状态重置协议执行
```

---

## Overview 类型处理

> 📌 规则引用: 按 references/rules/package.md "Overview 类型方案包生命周期" 规则执行

```yaml
检测到 overview 类型方案包时:
  按 G3 场景内容规则（确认）输出

  内容要素: 方案包类型说明、操作选项（归档/查看/取消）

  用户选择处理:
    归档: 执行方案包迁移至 archive/
    查看: 显示 proposal.md 内容，再次询问
    取消: 按 G7 状态重置协议执行
```

---

## 不确定性处理

- plan/ 目录不存在 → 按 G3 场景内容规则（错误）输出，提示无方案包
- 方案包验证失败 → 输出具体缺失项，建议修复或重新规划
- 方案包类型无法识别 → 默认按 implementation 类型处理

---

## 用户选择处理

> 本章节定义 ~exec 命令需要用户确认的场景，供 G3 输出格式统一提取。

### 场景: 方案包选择（多个方案包）

```yaml
内容要素:
  - 方案包列表: plan/ 目录下的方案包清单（名称、创建时间、类型）
  - 方案包摘要: 每个方案包的简要描述

选项:
  选择方案包N: 选择对应序号的方案包执行
  取消: 按 G7 状态重置协议执行
```

### 场景: Overview类型方案包处理

> 📌 规则引用: 按 references/rules/package.md "用户选择处理 - Overview类型方案包处理" 执行

### 场景: 流程级验收完成

```yaml
内容要素:
  - 验收状态: 通过/部分通过/失败
  - 交付物摘要: 方案包、代码变更、知识库状态
  - 需求符合性: 已完成任务/未完成任务
  - 问题汇总: 警告和信息性记录（如有）

输出格式: 按 G3 场景内容规则（完成）输出
```

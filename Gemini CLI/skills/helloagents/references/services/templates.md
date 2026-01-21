# 知识库与方案包模板服务

本模块定义模板使用规则，模板文件位于 assets/templates/ 目录。

---

## 服务概述

> 📌 规则引用: 路径基准变量定义见 references/rules/tools.md

```yaml
服务名称: 模板服务
适用范围: 所有涉及知识库创建和方案包创建的场景
核心职责:
  - 模板存在性检查和降级处理
  - 知识库模板管理
  - 方案包模板管理
  - 模板使用规则定义
```

---

<template_validation>
## 模板存在性检查

<validation_flow>
模板存在性检查推理过程:
1. 构建模板完整路径
2. 验证模板文件是否存在
3. 存在则读取内容继续流程
4. 不存在则进入降级处理
</validation_flow>

**检查时机:** 使用模板前必须验证

**检查流程:**

```yaml
步骤1 - 构建模板完整路径:
  路径: {TEMPLATE_DIR}/{模板相对路径}

步骤2 - 验证模板存在:
  存在: 读取模板内容，继续流程
  不存在: 进入降级处理

降级处理:
  知识库模板不存在:
    - 暂停流程，提示用户检查模板目录
    - 在输出中标注: "❌ 模板文件不存在"
    - 等待用户决策或修复

  方案包模板不存在:
    - 暂停流程，提示用户检查模板目录
    - proposal.md/tasks.md 为必需文件，缺失时无法继续
    - 在输出中标注: "❌ 模板文件不存在"
    - 等待用户决策或修复
```
</template_validation>

---

<script_degradation_integration>
## 脚本降级对接

> 📌 规则引用: 脚本执行报告机制详见 references/rules/tools.md

**场景:** 脚本因模板不存在而部分完成时，AI 接手继续。

### AI 接手时的文件创建指南

当脚本返回 `success=false` 且 pending 中包含文件创建任务时，AI 应按以下结构创建文件：

```yaml
proposal.md 必需章节:
  - 元信息（方案包名称、创建日期、类型）
  - 1. 需求（背景、目标、约束条件、验收标准）
  - 2. 方案（技术方案、影响范围、风险评估）

tasks.md 必需章节:
  - 执行状态（完成率、总任务数）
  - 任务列表（按阶段/模块分组）
  - 执行备注

_index.md 必需结构:
  - 快速索引表格（时间戳、名称、类型、涉及模块、决策、结果）
  - 结果状态说明
```

### 质量检查要点

AI 在接手前应验证脚本已创建的文件：

```yaml
proposal.md:
  - 文件存在性
  - 包含元信息章节
  - 包含需求章节
  - 包含方案章节

tasks.md:
  - 文件存在性
  - 包含执行状态章节
  - 包含任务列表章节
  - 任务使用正确的状态符号（[ ] [√] [X] [-] [?]）

目录结构:
  - plan/YYYYMMDDHHMM_feature/ 目录存在
  - 目录名格式正确（12位时间戳_功能名）
```
</script_degradation_integration>

---

## 模板文件索引

### 知识库模板 (assets/templates/)

| 模板路径 | 生成路径 | 用途 |
|---------|---------|------|
| INDEX.md | helloagents/INDEX.md | 知识库入口 |
| context.md | helloagents/context.md | 项目上下文 |
| CHANGELOG.md | helloagents/CHANGELOG.md | 变更日志 |
| CHANGELOG_{YYYY}.md | helloagents/CHANGELOG_{YYYY}.md | 年度变更日志（大型项目分片） |
| modules/_index.md | helloagents/modules/_index.md | 模块索引 |
| modules/module.md | helloagents/modules/{模块名}.md | 模块文档 |
| archive/_index.md | helloagents/archive/_index.md | 归档索引 |

### 方案包模板 (assets/templates/plan/)

| 模板路径 | 生成路径 | 用途 |
|---------|---------|------|
| plan/proposal.md | helloagents/plan/{YYYYMMDDHHMM}_{feature}/proposal.md | 变更提案 |
| plan/tasks.md | helloagents/plan/{YYYYMMDDHHMM}_{feature}/tasks.md | 任务清单 |

---

## 模板章节结构

> 标注"必须"的章节在填充时必须包含，标注"可选"的章节按需填充

<chapter_structure>
模板章节结构规范:
1. proposal.md: 元信息+需求+方案为必须，技术设计/核心场景/技术决策为可选
2. tasks.md: 执行状态+任务列表+执行备注全部必须
3. module.md: 职责+行为规范+依赖关系为必须，接口定义为可选
4. context.md: 前5章必须，技术债务可选
</chapter_structure>

```yaml
proposal.md:
  - 元信息（必须）
  - 1. 需求（必须）: 背景、目标、约束条件、验收标准
  - 2. 方案（必须）: 技术方案、影响范围、风险评估
  - 3. 技术设计（可选）: 架构设计、API设计、数据模型
  - 4. 核心场景（可选）: 场景描述（执行后同步到模块文档）
  - 5. 技术决策（可选）: 决策记录

tasks.md:
  - 执行状态（必须）
  - 任务列表（必须）: 按阶段/模块分组的任务项
  - 执行备注（必须）

module.md:
  - 职责（必须）
  - 接口定义（可选）: 公共API、数据结构
  - 行为规范（必须）: 场景描述
  - 依赖关系（必须）

context.md:
  - 1. 基本信息（必须）
  - 2. 技术上下文（必须）
  - 3. 项目概述（必须）
  - 4. 开发约定（必须）
  - 5. 当前约束（必须）
  - 6. 已知技术债务（可选）

archive/_index.md:
  - 快速索引（必须）
  - 按月归档（必须）
  - 结果状态说明（必须）
```

---

## 使用规则

### 创建知识库

<kb_creation_rules>
知识库创建规则:
1. 读取 assets/templates/ 下的模板文件
2. 根据项目实际情况填充占位符
3. 写入用户项目的 helloagents/ 目录
</kb_creation_rules>

```yaml
步骤:
  1. 读取 assets/templates/ 下的模板文件
  2. 根据项目实际情况填充占位符内容
  3. 写入用户项目的 helloagents/ 目录

目标结构: 见 G1 "知识库完整结构（SSOT）"
```

### 创建方案包

<package_creation_rules>
方案包创建规则:
1. 读取 assets/templates/plan/ 下的模板文件
2. 根据需求实际情况填充占位符
3. 写入 helloagents/plan/{YYYYMMDDHHMM}_{feature}/ 目录
</package_creation_rules>

```yaml
步骤:
  1. 读取 assets/templates/plan/ 下的模板文件
  2. 根据需求实际情况填充占位符内容
  3. 写入 helloagents/plan/{YYYYMMDDHHMM}_{feature}/ 目录

目标结构:
  helloagents/plan/{YYYYMMDDHHMM}_{feature}/
  ├── proposal.md
  └── tasks.md
```

---

## 方案包相关规则

> 以下规则与方案包模板的使用密切相关，故置于此处统一管理。

### 轻量迭代的方案包创建

```yaml
方案包创建:
  - 必须创建 proposal.md（完整版，与标准开发相同）
  - 必须创建 tasks.md

目录创建规则: 按 G1 "目录/文件自动创建规则" 执行（目录不存在时自动创建）
升级处理: 见 G5 "轻量迭代 - 升级条件"
迁移规则: 迁移至 archive/ 时标注"轻量迭代"
```

### 技术决策章节（何时需要写）

<decision_criteria>
技术决策章节判定规则:
1. 涉及架构变更时需要写
2. 涉及技术选型时需要写
3. 存在多种实现路径需权衡时需要写
4. 有长期影响的技术约束时需要写
5. 简单修复和明确实现不需要写
</decision_criteria>

```yaml
需要写:
  - 涉及架构变更
  - 涉及技术选型（新库/框架/工具）
  - 存在多种实现路径需权衡
  - 有长期影响的技术约束

不需要写:
  - 简单bug修复
  - 样式/文案调整
  - 明确无歧义的实现
```

### 决策ID格式

```yaml
格式: {feature}#D{NNN}
示例: add-login#D001, add-login#D002
简写: 同一方案包内可省略前缀，跨方案引用必须带前缀
```

### 概述类型方案包（overview）

> 📌 规则引用: 详细规则见 G7 "方案包类型"

---

## 异常处理

```yaml
模板文件不存在:
  - 使用内置默认结构
  - 输出标注"ℹ️ 使用默认模板"
  - 继续流程

模板读取失败:
  - 检查文件权限
  - 降级为内置默认结构
  - 输出警告信息

占位符填充失败:
  - 保留未填充的占位符
  - 输出警告，提示手动补充
  - 继续流程

写入目标失败:
  - 按 G1 "目录/文件自动创建规则" 创建目录
  - 重试写入
  - 仍失败则暂停，输出错误详情
```

---

## 规则引用索引

| 规则 | 定义位置 |
|------|---------|
| 路径基准变量 | references/rules/tools.md |
| 微调模式记录 | references/services/knowledge.md |
| 任务状态符号 | G7 |
| CHANGELOG格式 | references/services/knowledge.md |
| 大型项目分片 | references/rules/scaling.md |
| 知识库完整结构 | G1 |
| 目录/文件自动创建规则 | G1 |
| 方案包类型 | G7 |
| 轻量迭代升级条件 | G5 |

---

## 服务引用关系

```yaml
被引用:
  - ~init 命令（知识库模板使用）
  - 方案设计阶段（方案包模板使用）
  - ~exec 命令（方案包验证）
  - scripts/create_package.py（模板加载）
  - scripts/migrate_package.py（_index.md 模板）
  - scripts/validate_package.py（章节验证）

引用:
  - G1 知识库完整结构
  - G1 目录/文件自动创建规则
  - G5 轻量迭代升级条件
  - G7 方案包类型
  - G7 任务状态符号
  - references/rules/tools.md（脚本执行报告机制）
  - references/rules/scaling.md（大型项目分片）
  - references/services/knowledge.md（CHANGELOG格式）
```

# 知识库与方案包模板服务

本模块定义模板使用规则，模板文件位于 `{TEMPLATES_DIR}` 目录。

---

## 模板存在性检查

**检查时机:** 使用模板前必须验证

```yaml
1. 构建路径: {TEMPLATES_DIR}/{模板相对路径}
2. 验证: 存在→读取继续 | 不存在→使用内置默认结构，标注"ℹ️ 使用默认模板"
```

---

## 脚本降级对接

> 脚本因模板不存在而部分完成时，AI 接手继续。详见 {HELLOAGENTS_ROOT}/rules/tools.md

### AI 接手时的文件创建指南

```yaml
proposal.md 必需章节:
  - 元信息（方案包名称、创建日期、类型）
  - 1. 需求（背景、目标、约束条件、验收标准）
  - 2. 方案（技术方案、影响范围、风险评估）

tasks.md 必需章节:
  - 元数据头部（@feature, @created, @status, @mode）
  - 进度概览（完成/失败/跳过/总数）
  - 任务列表（按阶段/模块分组）
  - 执行日志（最近5条状态变更）
  - 执行备注

_index.md 必需结构:
  - 快速索引表格（时间戳、名称、类型、涉及模块、决策、结果）
  - 结果状态说明
```

### 质量检查要点

```yaml
proposal.md: 文件存在 + 元信息章节 + 需求章节 + 方案章节
tasks.md: 文件存在 + 元数据头部 + 进度概览 + 任务列表 + 执行日志 + 正确状态符号
目录结构: plan/YYYYMMDDHHMM_feature/ 存在，目录名格式正确
```

---

## 模板文件索引

### 知识库模板

| 模板路径 | 生成路径 | 用途 |
|---------|---------|------|
| INDEX.md | {KB_ROOT}/INDEX.md | 知识库入口 |
| context.md | {KB_ROOT}/context.md | 项目上下文 |
| CHANGELOG.md | {KB_ROOT}/CHANGELOG.md | 变更日志 |
| CHANGELOG_{YYYY}.md | {KB_ROOT}/CHANGELOG_{YYYY}.md | 年度变更日志 |
| modules/_index.md | {KB_ROOT}/modules/_index.md | 模块索引 |
| modules/module.md | {KB_ROOT}/modules/{模块名}.md | 模块文档 |
| archive/_index.md | {KB_ROOT}/archive/_index.md | 归档索引 |

### 方案包模板

| 模板路径 | 生成路径 | 用途 |
|---------|---------|------|
| plan/proposal.md | {KB_ROOT}/plan/{pkg}/proposal.md | 变更提案 |
| plan/tasks.md | {KB_ROOT}/plan/{pkg}/tasks.md | 任务清单 |

### 其他参考文件

| 文件路径 | 用途 | 说明 |
|---------|------|------|
| session_summary.md | L2 会话摘要格式参考 | AI 写入 sessions/{session_id}.md 时参考 |

> **L0 骨架文件:** `{HELLOAGENTS_ROOT}/user/profile.md` 为系统自带的用户记忆骨架，由用户手动维护，非模板生成。

---

## 模板章节结构

```yaml
proposal.md:
  必须: 元信息, 1.需求(背景/目标/约束/验收标准), 2.方案(技术方案/影响范围/风险)
  可选: 3.技术设计(架构/API/数据模型), 4.核心场景, 5.技术决策

tasks.md:
  必须: 元数据头部(@feature/@created/@status/@mode), 进度概览, 任务列表, 执行日志, 执行备注

module.md:
  必须: 职责, 行为规范, 依赖关系
  可选: 接口定义(公共API/数据结构)

context.md:
  必须: 基本信息, 技术上下文, 项目概述, 开发约定, 当前约束
  可选: 已知技术债务
```

---

## 使用规则

### 创建知识库

```yaml
流程: 读取 {TEMPLATES_DIR} 模板 → 填充占位符 → 写入 {KB_ROOT}/
目标: 见 G1 知识库目录结构
```

### 创建方案包

```yaml
流程: 读取 {TEMPLATES_DIR}/plan/ 模板 → 填充占位符 → 写入 {KB_ROOT}/plan/{pkg}/
产出: proposal.md + tasks.md
```

---

## 方案包相关规则

### R2 简化流程

```yaml
方案包: 必须创建 proposal.md（完整版）+ tasks.md
目录: 按 G1 写入策略自动创建
迁移: 归档时标注"R2 简化流程"
```

### 技术决策章节

| 需要写 | 不需要写 |
|--------|----------|
| 架构变更 | 简单bug修复 |
| 技术选型（新库/框架） | 样式/文案调整 |
| 多种实现路径需权衡 | 明确无歧义的实现 |
| 长期影响的技术约束 | — |

### 决策ID格式

```yaml
格式: {feature}#D{NNN}（如 add-login#D001）
简写: 同方案包内可省略前缀，跨方案引用必须带前缀
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| 模板不存在 | 使用内置默认结构，标注"ℹ️ 使用默认模板" |
| 模板读取失败 | 检查权限 → 降级默认结构 → 输出警告 |
| 占位符填充失败 | 保留未填充占位符，输出警告 |
| 写入目标失败 | 按 G1 写入策略创建目录 → 重试 → 暂停 |

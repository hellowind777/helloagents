# 方案包服务 (PackageService)

本模块定义方案包服务的完整规范，包括服务接口、执行者、数据所有权和生命周期管理。

---

## 服务概述

```yaml
服务名称: PackageService（方案包服务）
服务类型: 领域服务 (Domain Service)
适用范围: 所有涉及方案包操作的命令和阶段

核心职责:
  - 方案包创建和初始化
  - 任务状态管理和更新
  - 进度快照生成
  - 方案包归档和迁移
  - 遗留方案包扫描和清理

专用执行者: pkg_keeper（服务绑定型角色）
数据所有权:
  - helloagents/plan/（活跃方案包）
  - helloagents/archive/（已归档方案包）
```

---

## 服务接口定义

> 📌 所有方案包操作必须通过服务接口，禁止直接操作文件

<service_interfaces>

### 接口1: create(feature, type)

```yaml
功能: 创建新的方案包
触发时机: design 阶段步骤5

参数:
  feature: 功能名称（用于目录命名）
  type: 方案包类型（implementation | overview）

执行流程:
  1. 生成方案包路径: plan/YYYYMMDDHHMM_{feature}/
  2. 检查同名冲突，使用版本后缀 _v2, _v3...
  3. 调用 create_package.py 创建目录和模板
  4. pkg_keeper 填充 proposal.md 和 tasks.md
  5. 验证方案包完整性

返回值:
  success: boolean
  package_path: 方案包完整路径
  errors: 错误列表（如有）

保证:
  - 方案包结构完整（proposal.md + tasks.md）
  - 文件格式符合规范
  - tasks.md 包含元数据头部
```

### 接口2: updateTask(taskId, status, result)

```yaml
功能: 更新单个任务的状态
触发时机: develop 阶段每个任务完成后

参数:
  taskId: 任务标识（阶段号-任务号，如 "1-2"）
  status: 新状态（completed | failed | skipped | pending）
  result: 执行结果描述（可选）

执行流程:
  1. 读取当前 tasks.md
  2. 定位目标任务
  3. 更新状态符号（按 G6 "任务状态符号"）
  4. 添加备注（失败/跳过时必填）
  5. 更新进度概览统计
  6. 追加执行日志（最近5条）
  7. 写回 tasks.md

返回值:
  success: boolean
  progress: 当前进度统计
  errors: 错误列表（如有）

保证:
  - 状态一致性（只能从 pending 转换）
  - 执行日志完整
  - 进度统计准确
```

### 接口3: snapshot()

```yaml
功能: 生成进度快照（更新 LIVE_STATUS 区域）
触发时机: 任务完成后、阶段转换时

参数: 无（使用当前活跃方案包）

执行流程:
  1. 读取当前 tasks.md
  2. 统计任务状态（完成/失败/跳过/待执行）
  3. 计算完成百分比
  4. 更新 LIVE_STATUS 区域
  5. 追加执行日志（最近5条）

LIVE_STATUS 区域格式: 按 G11 "活状态区格式" 定义

返回值:
  success: boolean
  progress: 进度统计对象

保证:
  - LIVE_STATUS 区域始终保持最新
  - 执行日志不超过5条
```

### 接口4: archive(packagePath)

```yaml
功能: 归档已完成的方案包
触发时机: develop 阶段步骤14

参数:
  packagePath: 方案包路径

执行流程:
  1. 验证方案包状态（所有任务已完成或标记）
  2. 确定归档目标: archive/YYYY-MM/
  3. 调用 migrate_package.py 执行迁移
  4. 更新 archive/_index.md
  5. 联动调用 KnowledgeService.updateChangelog()

返回值:
  success: boolean
  archive_path: 归档后的路径
  changelog_updated: boolean

保证:
  - 原路径清理完成
  - 索引更新完成
  - CHANGELOG 已记录
```

### 接口5: scan()

```yaml
功能: 扫描遗留方案包
触发时机: 阶段完成时

参数: 无

执行流程: 按 G6 "遗留方案包扫描" 规则执行

返回值:
  packages: 遗留方案包列表
    - path: 路径
    - name: 名称
    - created: 创建时间
    - type: 类型（implementation | overview）

条件输出:
  - 检测到 ≥1 个遗留方案包时返回列表
  - 无遗留方案包时返回空列表
```

### 接口6: validate(packagePath)

```yaml
功能: 验证方案包完整性
触发时机: 方案包创建后、执行前

参数:
  packagePath: 方案包路径

执行流程:
  1. 调用 validate_package.py
  2. 检查必需文件存在性
  3. 检查文件格式规范
  4. 解析任务列表

返回值:
  valid: boolean
  issues: 问题列表
    - type: blocking | warning
    - message: 问题描述
```

</service_interfaces>

---

## 执行者: pkg_keeper

```yaml
角色定位: 服务绑定型角色（非通用能力型）
绑定服务: PackageService
角色预设: rlm/roles/pkg_keeper.md

职责范围:
  - 方案包内容填充（proposal.md, tasks.md）
  - 任务状态更新和格式维护
  - 进度快照内容生成
  - 方案包质量检查

调用方式:
  - 只能通过 PackageService 接口调用
  - 禁止阶段模块直接调用 pkg_keeper

协作关系:
  - 接收 designer 的方案设计结果 → 填充 proposal.md
  - 接收 implementer 的执行结果 → 更新 tasks.md
  - 输出进度快照 → 主代理输出
```

---

## 数据所有权

```yaml
独占写权限:
  helloagents/plan/:
    - */proposal.md
    - */tasks.md
  helloagents/archive/:
    - */_index.md
    - */*/proposal.md
    - */*/tasks.md

共享读权限:
  - 所有阶段模块可读取方案包内容
  - 主代理可读取进度信息

写入规则:
  - 只有 PackageService 可以修改方案包文件
  - 其他组件通过服务接口请求修改
  - 直接修改将破坏数据一致性
```

---

## 生命周期管理

<lifecycle_rules>

### 创建阶段

```yaml
触发: design 阶段方案确定后
执行: PackageService.create(feature, type)
产出: plan/YYYYMMDDHHMM_{feature}/
状态: @status: pending
```

### 开发实施阶段

```yaml
触发: develop 阶段每个任务完成后
执行: PackageService.updateTask(taskId, status, result)
状态流转: pending → in_progress → completed/failed
快照: 每次状态更新后调用 PackageService.snapshot()
```

### 归档阶段

```yaml
触发: develop 阶段所有任务完成后
执行: PackageService.archive(packagePath)
目标: archive/YYYY-MM/{packageName}/
联动: KnowledgeService.updateChangelog()
```

### Overview 类型特殊处理

> 📌 规则引用: 方案包类型定义和判定规则见 G6 "方案包类型"

```yaml
判定: tasks.md 无执行任务
归档方式: 按 G6 "方案包类型" 中的 overview 类型处理规则
标记: archive/_index.md 中标注 "overview"
```

</lifecycle_rules>

---

## 与其他服务的协作

```yaml
调用 KnowledgeService:
  时机: 方案包归档后
  接口: KnowledgeService.updateChangelog()
  数据: 方案包信息（名称、路径、决策ID）

被 AttentionService 引用:
  时机: 进度快照输出
  接口: PackageService.snapshot()
  输出: 快照内容供主代理输出
```

---

## 异常处理

```yaml
方案包创建失败:
  - 检查 plan/ 目录是否存在
  - 检查命名冲突并使用版本后缀
  - 仍失败则暂停流程，提示用户处理

任务更新失败:
  - 重试一次
  - 仍失败则记录错误，继续执行
  - 在验收报告中标注

归档失败:
  - 检查 archive/ 目录是否存在
  - 检查目标路径权限
  - 重试一次后仍失败则保留原位置，记录错误

索引更新失败:
  - archive/_index.md 不存在时自动创建
  - 写入失败时在完成报告中标注
```

---

## 用户选择处理

> 本章节定义方案包服务需要用户确认的场景

### 场景: Overview 类型方案包处理

```yaml
触发条件: ~exec 命令检测到 overview 类型方案包

内容要素:
  - 方案包类型: overview（概述文档）
  - 类型说明: 此方案包为概述文档，无需执行开发任务

选项:
  归档: 调用 PackageService.archive()
  查看: 显示 proposal.md 内容，再次询问
  取消: 按 G6 状态重置协议执行
```

### 场景: 遗留方案包扫描

```yaml
触发条件: 阶段完成时检测到 ≥1 个遗留方案包

内容要素:
  - 遗留方案包列表: PackageService.scan() 返回结果
  - 当前状态: 检测到 N 个遗留方案包

选项:
  清理: 执行 ~clean 命令
  忽略: 继续当前操作
```

---

## 服务引用关系

```yaml
被引用:
  - references/stages/design.md（方案包创建）
  - references/stages/develop.md（任务更新、归档）
  - references/functions/exec.md（方案包执行）
  - references/functions/clean.md（遗留清理）
  - references/functions/auto.md（全授权流程）

引用:
  - references/services/knowledge.md（CHANGELOG 更新）
  - references/services/attention.md（快照规范）
  - references/services/templates.md（模板服务）
  - references/rules/tools.md（脚本调用规则）
  - rlm/roles/pkg_keeper.md（专用执行者）
  - G6 任务状态符号
  - G6 方案包类型定义
```

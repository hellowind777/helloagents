# 方案包服务 (PackageService)

本模块定义方案包服务的完整规范，包括服务接口、执行者、数据所有权和生命周期管理。

---

## 服务概述

```yaml
服务名称: PackageService（方案包服务）
服务类型: 领域服务
适用范围: 所有涉及方案包操作的命令和阶段

核心职责: 方案包创建/初始化、任务状态管理、进度快照、归档迁移、遗留方案包扫描清理

专用执行者: pkg_keeper（服务绑定型角色）
数据所有权:
  - {KB_ROOT}/plan/（活跃方案包）
  - {KB_ROOT}/archive/（已归档方案包）
```

---

## 服务接口

**DO:** 所有方案包操作通过服务接口执行

**DO NOT:** 直接操作方案包文件，绕过服务接口修改

### create(feature, type)

```yaml
触发: design 阶段步骤5
参数: feature(功能名), type(implementation|overview)
流程: 生成路径 plan/YYYYMMDDHHMM_{feature}/ → 冲突检查(使用_v2,_v3) → create_package.py → pkg_keeper 填充 → 验证
返回: success, package_path, errors
保证: proposal.md + tasks.md 完整，格式符合规范
```

### updateTask(taskId, status, result)

```yaml
触发: develop 阶段每个任务完成后
参数: taskId("阶段号-任务号"), status(completed|failed|skipped|pending), result(可选)
流程: 读取 tasks.md → 定位任务 → 更新状态符号 → 添加备注 → 更新统计 → 追加日志(最近5条) → 写回
返回: success, progress, errors
保证: 状态一致性（只能从 pending 转换），日志完整，统计准确
```

### snapshot()

```yaml
触发: 任务完成后、阶段转换时
流程: 读取 tasks.md → 统计状态 → 计算百分比 → 更新 LIVE_STATUS 区域 → 追加日志
LIVE_STATUS 格式: 按 G11 定义
返回: success, progress
```

### archive(packagePath)

```yaml
触发: develop 阶段步骤13
流程: 验证方案包状态 → 归档到 archive/YYYY-MM/ → migrate_package.py → 更新 _index.md → KnowledgeService.updateChangelog()
返回: success, archive_path, changelog_updated
保证: 原路径清理、索引更新、CHANGELOG 已记录
```

### scan()

```yaml
触发: 阶段完成时（仅 plan/ 目录存在时执行）
流程: 扫描 plan/ 目录中的遗留方案包
返回: packages[{path, name, created, type}]
条件输出: ≥1个遗留方案包返回列表，否则空列表
```

### validate(packagePath)

```yaml
触发: 方案包创建后、执行前
流程: validate_package.py → 检查必需文件 → 检查格式 → 解析任务列表
返回: valid, issues[{type(blocking|warning), message}]
```

---

## 执行者: pkg_keeper

```yaml
角色定位: 服务绑定型，预设: rlm/roles/pkg_keeper.md
职责: 方案包内容填充、任务状态更新、进度快照生成、质量检查
调用: 只能通过 PackageService 接口
协作: 接收 designer 方案→填充 proposal.md | 接收 implementer 结果→更新 tasks.md
```

---

## 生命周期管理

| 阶段 | 触发 | 操作 | 状态 |
|------|------|------|------|
| 创建 | design 阶段方案确定后 | create(feature, type) | @status: pending |
| 开发 | develop 阶段每个任务完成后 | updateTask() + snapshot() | pending → in_progress → completed/failed |
| 归档 | develop 所有任务完成后 | archive() → updateChangelog() | 移动到 archive/YYYY-MM/ |

### Overview 类型特殊处理

```yaml
判定: tasks.md 无执行任务
归档: 按本服务 archive() 接口执行
标记: archive/_index.md 中标注 "overview"
```

---

## 与其他服务的协作

```yaml
→ KnowledgeService: 归档后调用 updateChangelog()
← AttentionService: 进度快照输出
```

---

## 用户选择规则

### Overview 类型方案包处理

```yaml
触发: ~exec 检测到 overview 类型方案包
选项: 归档(调用 archive()) | 查看(显示 proposal.md) | 取消(→ 状态重置)
```

### 遗留方案包扫描

```yaml
触发: 阶段完成时检测到 ≥1 个遗留方案包
选项: 清理(→ ~cleanplan) | 忽略(继续当前操作)
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| 方案包创建失败 | 检查 plan/ 目录 → 检查命名冲突 → 暂停提示 |
| 任务更新失败 | 重试一次 → 仍失败记录错误 → 验收报告标注 |
| 归档失败 | 检查 archive/ 目录 → 检查权限 → 重试 → 保留原位 |
| 索引更新失败 | _index.md 不存在时创建 → 写入失败在报告中标注 |

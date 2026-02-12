# 注意力控制服务

---

## 服务概述

```yaml
服务名称: AttentionService（注意力控制服务）
服务类型: 基础设施服务
适用范围: 所有涉及任务进度跟踪的场景（DEVELOP 阶段强制，其他阶段按需）
核心职责: 维护 LIVE_STATUS 区域、管理执行日志、提供进度快照
```

---

## LIVE_STATUS 活状态区

### 格式

```
<!-- LIVE_STATUS_BEGIN -->
状态: {pending|in_progress|paused|completed|failed} | 进度: {完成数}/{总数} ({百分比}%) | 更新: {YYYY-MM-DD HH:MM:SS}
当前: {正在执行的任务描述}
<!-- LIVE_STATUS_END -->
```

### 更新规则

```yaml
更新时机:
  - 任务开始: status → in_progress，填写当前任务描述
  - 任务完成: 完成数+1，更新百分比，当前任务切换到下一个
  - 状态变更: status 字段同步更新（paused/failed 等）
  - 阶段切换: 工作流阶段转换时刷新
  - 遇到错误: status → failed 或 paused，当前任务标注错误

写入方式: 定位 <!-- LIVE_STATUS_BEGIN/END --> 标记，替换中间内容
位置: tasks.md 顶部（任务列表之前）
```

---

## 执行日志

```yaml
格式: | 时间 | 任务 | 状态 | 备注 |
位置: tasks.md 底部
容量: 最近 5 条
更新: 新记录追加到表格末尾，超出容量时删除最早记录
```

---

## 状态恢复

```yaml
场景: 上下文丢失或压缩后需要恢复执行进度
流程:
  1. 读取 tasks.md 中的 LIVE_STATUS 区域
  2. 解析状态、进度、当前任务
  3. 扫描任务列表中的 [ ]/[√]/[X] 标记确认已完成项
  4. 从断点处继续执行
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| tasks.md 不存在 | 跳过更新，标注 "⚠️ 无活动方案包" |
| tasks.md 格式错误 | 重建 LIVE_STATUS 区域 |
| LIVE_STATUS 标记缺失 | 在 tasks.md 顶部插入标记区域 |
| 更新失败 | 记录错误，继续执行（不阻断主流程） |

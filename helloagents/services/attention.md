# 注意力控制服务

---

## 服务概述

```yaml
服务名称: AttentionService（注意力控制服务）
服务类型: 基础设施服务
适用范围: 所有涉及任务进度跟踪的场景（DEVELOP 阶段强制，其他阶段按需）
核心职责: 维护 .status.json 活状态、管理执行日志、提供进度快照
执行者: 主代理直接执行（无专用角色）
```

---

## 服务接口

### updateStatus(taskInfo)

```yaml
触发: 任务开始/完成/状态变更时
参数: taskInfo { status, current_task, completed, total }
流程: 更新 .status.json 对应字段 → 更新时间戳
```

### appendLog(entry)

```yaml
触发: 每次任务状态变更后
参数: entry { time, task, status, note }
流程: 追加到 tasks.md 底部日志表 → 超过5条时删除最早记录
```

### restore()

```yaml
触发: 压缩摘要明确提及活跃方案包且摘要不足以确定下一步时（补充恢复）
流程: 读取 .status.json → 解析进度和当前任务 → 返回断点信息
返回: { status, progress, current_task, completed_tasks }
注意: 压缩摘要是主要恢复来源，本接口仅作补充。不可因压缩发生就主动调用。
```

---

## .status.json 活状态

### 格式

```json
{
  "status": "in_progress",
  "completed": 0,
  "failed": 0,
  "pending": 5,
  "total": 5,
  "percent": 0,
  "current": "当前任务描述",
  "updated_at": "YYYY-MM-DD HH:MM:SS"
}
```

### 更新规则

```yaml
更新时机:
  - 任务开始: status → in_progress，填写当前任务描述
  - 任务完成: completed+1，更新百分比，当前任务切换到下一个
  - 状态变更: status 字段同步更新（paused/failed 等）
  - 阶段切换: 工作流阶段转换时刷新
  - 遇到错误: status → failed 或 paused，当前任务标注错误

写入方式: 直接覆盖方案包目录下 .status.json
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
场景: 压缩摘要明确提及活跃方案包且摘要不足以确定下一步时
原则: 压缩摘要是主要恢复来源，文件读取仅作补充。不可因压缩发生就自动扫描文件。
流程:
  1. 读取方案包目录下 .status.json
  2. 解析状态、进度、当前任务
  3. 结合 tasks.md 中的 [√]/[X] 标记确认已完成项（如需细节）
  4. 从断点处继续执行
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| tasks.md 不存在 | 跳过更新，标注 "⚠️ 无活动方案包" |
| tasks.md 格式错误 | 跳过更新，标注 "⚠️ tasks.md 格式异常" |
| .status.json 缺失 | 在方案包目录下创建 .status.json |
| 更新失败 | 记录错误，继续执行（不阻断主流程） |

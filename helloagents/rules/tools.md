# 工具调用规则

本模块定义脚本调用规范和降级处理机制。

---

## 脚本调用规范

### 调用格式

```yaml
标准格式: python -X utf8 '{SCRIPTS_DIR}/{脚本名}.py' [<项目路径>] [<其他参数>]
路径要求: 始终使用绝对路径，单引号包裹
项目路径: 可选，不指定时使用 cwd；用户明确指定时传入；不明确时追问
```

### 脚本用法

> 以脚本 Usage 为准，以下仅列常用调用。

```yaml
validate_package.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/validate_package.py' [--path <路径>] [<方案包名>]

project_stats.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/project_stats.py' [--path <路径>]

create_package.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/create_package.py' <feature> [--type <implementation|overview>] [--path <路径>]

list_packages.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/list_packages.py' [--path <路径>] [--archive] [--format <table|json>]

migrate_package.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/migrate_package.py' <package-name> [--status <completed|skipped>] [--all] [--path <路径>]

upgradewiki.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/upgradewiki.py' --scan|--init|--backup|--write <json-file> [--path <路径>]

configure_codex.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/configure_codex.py' [--path <路径>]
  说明: Codex CLI 环境配置，非 Codex 环境跳过

session.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/session.py' --info|--list|--cleanup [<hours>]
  说明: RLM Session 管理

shared_tasks.py:
  用法: python -X utf8 '{SCRIPTS_DIR}/shared_tasks.py' --status|--list|--available|--claim <id> --owner <sid>|--complete <id>|--add '<subject>' [--blocked-by <ids>]
  说明: 多终端协作任务管理，需 hellotasks 环境变量
```

### 脚本存在性检查

**检查时机:** 调用前必须验证

```yaml
1. 构建路径: {SCRIPTS_DIR}/{脚本名}.py
2. 验证存在: 存在→执行 | 不存在→降级处理
3. 执行脚本: 捕获输出和退出码，失败→错误恢复
```

### 脚本不存在时的降级处理

```yaml
处理: 使用内置逻辑执行对应功能，输出: 警告（说明脚本不可用，已使用内置逻辑替代）

降级能力:
  create_package.py: 直接创建目录结构和文件
  list_packages.py: 文件查找工具扫描 plan/ 目录
  migrate_package.py: 直接执行文件移动和索引更新
  validate_package.py: 直接检查文件存在性和内容完整性
  project_stats.py: 文件查找和统计工具
  upgradewiki.py: 文件工具执行扫描/初始化/备份/写入
```

---

## 脚本执行报告（ExecutionReport）

脚本通过 JSON 格式的执行报告与 AI 通信，支持部分完成时的降级接手。

```json
{
  "script": "脚本名称",
  "success": true,
  "completed": [{"step": "步骤", "result": "结果", "verify": "检查方法"}],
  "failed_at": "失败步骤（仅 success=false）",
  "pending": ["待完成任务"],
  "context": {"feature": "功能名", "package_path": "路径"}
}
```

### AI 降级接手流程

```yaml
1. 解析报告: success=true→完成 | success=false→降级接手
2. 质量检查（CRITICAL）: 逐项验证 completed 列表
   目录创建→确认存在 | 文件写入→验证内容 | 模板填充→检查必需章节 | 文件移动→确认目标
   发现问题→先修复再继续
3. 读取 context 确认与当前任务一致
4. 按 pending 列表顺序完成剩余任务
```

### 支持 ExecutionReport 的脚本

| 脚本 | 可能的 pending 任务 |
|------|---------------------|
| create_package.py | 创建 plan/ 目录、方案包目录、proposal.md、tasks.md |
| migrate_package.py | 创建归档目录、更新 tasks.md 状态、移动方案包、更新 _index.md |
| validate_package.py | 输出验证结果 JSON（含 template_missing 标志） |

---

## 错误恢复

| 错误类型 | 恢复策略 |
|----------|----------|
| 环境错误（Python未安装） | python3 替代 → 仍失败则降级内置逻辑 |
| 依赖错误（模块导入失败） | 降级内置逻辑，提示用户安装依赖 |
| 路径不存在 | 创建目录后重试 |
| 权限不足 | 提示用户处理，暂停流程 |
| 运行时错误 | 分析可恢复性：可恢复→降级，不可恢复→暂停+输出错误 |

**文件操作失败:**

| 操作 | 处理 |
|------|------|
| 写入失败 | 检查目录存在→检查同名冲突→重试→暂停 |
| 读取失败（必需文件） | 暂停流程，提示创建 |
| 读取失败（可选文件） | 跳过并继续 |
| 目录创建失败 | 检查父目录→检查权限→提示手动创建 |

---

## Shell 规范

> 工具选择逻辑与 Shell 语法规范 [→ G1]

# 工具调用规则

本模块定义内部模块调用门控和脚本执行规范。

---

## 规则概述

```yaml
规则名称: 工具调用规则
适用范围: 所有涉及脚本调用和内部模块调用的场景
核心职责:
  - 定义内部模块调用入口和识别规则
  - 规范脚本调用格式和路径
  - 管理脚本存在性检查和降级处理
  - 定义错误恢复机制
```

---

<module_gate>
## 内部模块调用门控

**命名空间:** `helloagents`

**你的职责:** 通过路由机制统一调度内部模块，确保执行流程的完整性和可追溯性。

<module_identification>
内部模块识别规则:
1. 位于 skills/helloagents/ 目录下的 .md 文件
2. 通过 G4 路由机制触发
3. 通过命令触发词（~auto/~plan/~exec等）触发
4. 通过模块间相互引用触发
</module_identification>

**内部模块识别:**
- 位于 `skills/helloagents/` 目录下的 `.md` 文件

**调用入口:** G4 路由机制、命令触发词（~auto/~plan/~exec等）、模块间相互引用
</module_gate>

---

<script_validation>
## 脚本调用规范

### 路径基准

```yaml
SKILL_ROOT: skills/helloagents/        # SKILL.md 所在目录
SCRIPT_DIR: {SKILL_ROOT}/scripts/      # 脚本目录
TEMPLATE_DIR: {SKILL_ROOT}/assets/templates/  # 模板目录
```

### 调用格式

<script_call_rules>
脚本调用规则:
1. 始终使用绝对路径
2. 路径使用双引号包裹
3. 项目路径为可选参数
4. 不指定项目路径时使用当前工作目录
</script_call_rules>

```yaml
标准格式: python -X utf8 "{SCRIPT_DIR}/{脚本名}.py" [<项目路径>] [<其他参数>]
路径要求: 始终使用绝对路径，双引号包裹
项目路径: 可选参数，不指定时使用当前工作目录
```

### 项目路径确定规则

<path_determination>
项目路径确定推理过程:
1. 默认使用CLI当前打开的路径（cwd）
2. 用户明确指定时使用用户指定的路径
3. 上下文不明确时追问用户确认
</path_determination>

```yaml
优先级:
  1. CLI当前打开的路径（cwd）- 默认使用
  2. 用户在对话中明确指定的路径 - 覆盖默认
  3. 无法确定时 - 追问用户确认

AI判断流程:
  - 默认: 不传路径参数，脚本使用 cwd
  - 用户指定其他路径时: 传入用户指定的路径
  - 上下文不明确时: 追问用户确认目标项目
```

### 脚本用法

```yaml
validate_package.py:
  用法: python -X utf8 "{SCRIPT_DIR}/validate_package.py" [--path <项目路径>] [<方案包名>]
  示例:
    - validate_package.py                              # 当前目录，所有方案包
    - validate_package.py --path "/path/to/project"    # 指定目录，所有方案包
    - validate_package.py 202501_feat                  # 当前目录，指定方案包
    - validate_package.py --path "/project" 202501_feat  # 指定目录和方案包

project_stats.py:
  用法: python -X utf8 "{SCRIPT_DIR}/project_stats.py" [--path <项目路径>]
  示例:
    - project_stats.py                                 # 当前目录
    - project_stats.py --path "/path/to/project"       # 指定目录

create_package.py:
  用法: python -X utf8 "{SCRIPT_DIR}/create_package.py" <feature> [--type <implementation|overview>] [--path <项目路径>]
  示例:
    - create_package.py add-login                      # 当前目录，implementation类型
    - create_package.py add-login --type overview      # 当前目录，overview类型
    - create_package.py add-login --path "/project"    # 指定目录

list_packages.py:
  用法: python -X utf8 "{SCRIPT_DIR}/list_packages.py" [--path <项目路径>]
  示例:
    - list_packages.py                                 # 当前目录
    - list_packages.py --path "/path/to/project"       # 指定目录

migrate_package.py:
  用法: python -X utf8 "{SCRIPT_DIR}/migrate_package.py" <package-name> [--status <completed|skipped|overview>] [--all] [--path <项目路径>]
  示例:
    - migrate_package.py 202501201234_feature          # 迁移指定方案包
    - migrate_package.py --all --status skipped        # 迁移全部，标记为skipped
    - migrate_package.py 202501_feat --path "/project" # 指定目录

upgradewiki.py:
  用法: python -X utf8 "{SCRIPT_DIR}/upgradewiki.py" [--path <项目路径>] [--force]
  示例:
    - upgradewiki.py                                   # 当前目录，增量升级
    - upgradewiki.py --force                           # 强制重建
    - upgradewiki.py --path "/path/to/project"         # 指定目录
```

### 脚本存在性检查

**检查时机:** 调用脚本前必须验证

<existence_check>
脚本存在性检查流程:
1. 构建完整脚本路径
2. 验证脚本是否存在
3. 存在则继续执行，不存在则进入降级处理
4. 执行脚本并捕获输出
5. 成功则继续流程，失败则进入错误恢复
</existence_check>

```yaml
步骤1 - 构建完整脚本路径:
  路径: {SCRIPT_DIR}/{脚本名}.py

步骤2 - 验证脚本存在:
  存在: 继续执行
  不存在: 进入降级处理

步骤3 - 执行脚本:
  捕获输出和退出码
  成功: 继续流程
  失败: 进入错误恢复
```

<script_fallback>
### 脚本不存在时的降级处理

```yaml
处理方式: 使用内置逻辑执行对应功能（见下方降级能力）
输出: 按 G3 场景内容规则（警告）输出，说明脚本不可用，已使用内置逻辑替代

降级能力:
  create_package.py: 直接创建目录结构和文件
  list_packages.py: 使用文件查找工具扫描plan/目录
  migrate_package.py: 直接执行文件移动和索引更新
  validate_package.py: 直接检查文件存在性和内容完整性
  project_stats.py: 使用文件查找和统计工具
  upgradewiki.py: 使用文件工具执行扫描、初始化、备份、写入操作（AI负责内容分析和生成）
```
</script_fallback>

<script_execution_report>
### 脚本执行报告机制（ExecutionReport）

**概述:** 脚本通过 JSON 格式的执行报告与 AI 通信，支持部分完成时的降级接手。

**报告结构:**

```json
{
  "script": "脚本名称",
  "success": true/false,
  "completed": [
    {
      "step": "步骤描述",
      "result": "执行结果（如文件路径）",
      "verify": "AI 质量检查方法"
    }
  ],
  "failed_at": "失败的步骤（仅 success=false 时）",
  "error_message": "错误信息（仅 success=false 时）",
  "pending": ["待完成任务1", "待完成任务2"],
  "context": {
    "feature": "功能名称",
    "package_path": "方案包路径",
    "...": "其他上下文"
  }
}
```

**AI 降级接手流程:**

<ai_takeover_flow>
AI降级接手推理过程:
1. 解析脚本输出的 JSON 执行报告
2. 识别 success=false 表示需要接手
3. 质量检查 completed 中已完成的步骤
4. 发现问题则修复
5. 按 pending 列表继续完成剩余任务
</ai_takeover_flow>

```yaml
步骤1 - 解析执行报告:
  - 检测脚本输出是否为 JSON 格式
  - success=true: 任务完成，无需接手
  - success=false: 进入降级接手流程

步骤2 - 质量检查（CRITICAL）:
  目的: 验证脚本已完成步骤的实际结果
  方法: 逐项检查 completed 列表

  检查方式:
    目录创建: 使用 Read 或 Bash ls 确认存在
    文件写入: 使用 Read 验证内容完整性
    模板填充: 检查必需章节是否存在
    文件移动: 确认目标存在且源已删除

  发现问题: 先修复再继续

步骤3 - 读取上下文:
  - 从 context 获取执行参数
  - 确认与当前任务目标一致

步骤4 - 继续执行:
  - 按 pending 列表顺序完成剩余任务
  - 使用 AI 工具能力（Read/Write/Bash）执行
  - 参考 templates.md 了解文件结构要求

质量检查示例:
  步骤: "创建方案包目录"
  result: "helloagents/plan/202501201234_feature"
  verify: "检查目录是否存在且为空目录"
  AI操作: Read 或 Bash ls 确认目录存在
```

**支持 ExecutionReport 的脚本:**

```yaml
create_package.py:
  输出: ExecutionReport JSON
  可能的 pending 任务:
    - 创建 plan/ 目录
    - 创建方案包目录
    - 创建 proposal.md（需包含：元信息、需求、方案章节）
    - 创建 tasks.md（需包含：执行状态、任务列表章节）

migrate_package.py:
  输出: ExecutionReport JSON
  可能的 pending 任务:
    - 创建归档目录
    - 更新 tasks.md 状态
    - 移动方案包
    - 创建/更新 _index.md

validate_package.py:
  输出: 验证结果 JSON（非 ExecutionReport）
  特殊字段: template_missing 标志
  AI处理: 根据 template_missing 决定是否跳过章节验证
```
</script_execution_report>

<error_recovery>
### 错误恢复机制

**脚本执行失败时:**

<script_error_handling>
脚本错误分类处理:
1. 环境错误: 尝试python3替代，仍失败则降级
2. 依赖错误: 降级为内置逻辑
3. 路径错误: 创建目录重试或提示用户处理
4. 运行时错误: 分析可恢复性，决定降级或暂停
</script_error_handling>

```yaml
错误分类与恢复策略:
  环境错误（Python未安装/版本不兼容）:
    - 尝试使用 python3 替代 python
    - 仍失败则降级为内置逻辑

  依赖错误（模块导入失败）:
    - 降级为内置逻辑
    - 提示用户安装依赖（可选）

  路径错误（文件不存在/权限不足）:
    - 路径不存在: 检查并创建目录后重试
    - 权限不足: 提示用户处理，暂停流程

  运行时错误（脚本逻辑异常）:
    - 分析错误输出判断是否可恢复
    - 可恢复: 降级为内置逻辑
    - 不可恢复: 暂停流程，输出错误详情

输出: 按 G3 场景内容规则输出（可恢复=警告，不可恢复=错误）
```

**文件操作失败时:**

<file_error_handling>
文件操作错误处理:
1. 写入失败: 检查目录、检查冲突、重试一次
2. 读取失败: 检查路径、根据必要性决定处理方式
3. 目录创建失败: 检查父目录和权限
</file_error_handling>

```yaml
写入失败:
  - 检查目标目录是否存在，不存在则创建
  - 检查是否有同名文件冲突
  - 重试一次后仍失败则暂停，输出错误详情

读取失败:
  - 检查文件路径是否正确
  - 文件不存在时根据场景决定:
    - 必需文件: 暂停流程，提示创建
    - 可选文件: 跳过并继续

目录创建失败:
  - 检查父目录是否存在
  - 检查权限问题
  - 提示用户手动创建
```
</error_recovery>
</script_validation>

---

<shell_spec>
## Shell 规范

> 📌 规则引用: Shell 语法规范、工具选择逻辑见 G1，始终生效
</shell_spec>

---

## 规则引用关系

```yaml
被引用:
  - 所有涉及脚本调用的命令
  - ~validate 命令（validate_package.py）
  - ~init/~upgrade 命令（upgradewiki.py）
  - 项目分析阶段（project_stats.py）
  - 方案设计阶段（create_package.py）
  - 开发实施阶段（migrate_package.py）

引用:
  - G1 Shell语法规范
  - G3 场景内容规则
  - G4 路由机制
  - references/services/templates.md（文件结构要求）
```

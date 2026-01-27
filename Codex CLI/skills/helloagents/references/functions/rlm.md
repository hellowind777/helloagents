# ~rlm 命令

> RLM（Recursive Language Model）递归语言模型命令

## 核心架构

```yaml
上下文管理:
  Working Context: CLI 内存中的对话上下文
  Session Events: %TEMP%/helloagents_rlm/{session_id}/events.jsonl
  Memory: helloagents/ 知识库

递归调用:
  实现: Task 工具
  最大深度: 5 层
  结果: 折叠后返回

Session 隔离:
  每个 CLI 实例有唯一 Session ID

多 CLI 后端:
  检测: 环境变量 → shutil.which → 默认 codex
  后端: Codex | Claude Code | Gemini | Qwen | Grok
  执行: Layer 1 原生子代理 → Layer 2 脚本调用 → Layer 3 主上下文
```

## 命令触发

```yaml
触发方式:
  - ~rlm: 显示RLM状态和帮助
  - ~rlm status: 显示当前RLM状态
  - ~rlm backend: 显示当前 CLI 后端信息
  - ~rlm reload: 重新加载 AGENTS.md 规则（压缩后恢复）
  - ~rlm spawn <role> <task>: 手动启动子代理
  - ~rlm fold [strategy]: 手动触发上下文折叠
  - ~rlm context: 显示三层上下文状态
  - ~rlm history: 显示代理执行历史
  - ~rlm session: 显示当前 Session 信息
  - ~rlm sessions: 列出所有 Sessions
  - ~rlm reset: 重置RLM状态

协作模式命令（需先设置 hellotasks 环境变量）:
  - ~rlm tasks: 显示共享任务列表
  - ~rlm tasks available: 显示可认领的任务
  - ~rlm tasks claim <task_id>: 认领任务
  - ~rlm tasks complete <task_id>: 标记任务完成
  - ~rlm tasks add "<subject>": 添加新任务
```

---

## 子命令详解

### ~rlm / ~rlm help

显示RLM系统帮助信息。

**输出内容:**
```
🔵【HelloAGENTS】- RLM 递归语言模型

RLM 是基于递归执行和上下文折叠的智能代理框架。

可用命令:
  ~rlm status     显示RLM状态（模式、深度、活跃代理）
  ~rlm spawn      启动子代理执行任务
  ~rlm fold       手动触发上下文折叠
  ~rlm context    显示三层上下文状态
  ~rlm history    显示代理执行历史
  ~rlm reset      重置RLM状态

────
🔄 下一步: 输入子命令查看详情，或直接描述任务自动启用RLM
```

---

### ~rlm status

显示当前RLM系统状态。

**执行步骤:**

1. 获取RLM引擎状态
2. 统计活跃代理
3. 计算上下文使用率
4. 格式化输出

**输出格式:**
```
🔵【HelloAGENTS】- RLM 状态

## 系统状态
- 执行模式: {STANDARD/RECURSIVE/PARALLEL}
- 递归深度: {current_depth}/{max_depth}
- 活跃代理: {active_count}

## 上下文状态
| 层级 | 当前大小 | 容量上限 | 使用率 |
|------|----------|----------|--------|
| Working | {size} | 8K | {percent}% |
| Session | {size} | 32K | {percent}% |
| Memory | {size} | 无限 | - |

## 活跃代理列表
{agent_list or "无活跃代理"}

────
🔄 下一步: ~rlm spawn 启动代理 | ~rlm fold 压缩上下文
```

---

### ~rlm backend

显示当前 CLI 后端信息。

**输出格式:**
```
🔵【HelloAGENTS】- RLM: backend

后端: {backend_name}
模型: {default_model}
执行层级: Layer {1/2/3}

────
🔄 下一步: ~rlm spawn 启动代理
```

---

### ~rlm reload

重新加载 AGENTS.md 规则（压缩后恢复）。

**触发:**
- 收到 "context compacted" 提示
- 用户说 "重新加载规则"
- 手动执行 `~rlm reload`

**流程:**
1. 重新读取 AGENTS.md
2. 重新读取当前 tasks.md（如有）
3. 输出: "📋 规则恢复完成 - HelloAGENTS 已重新加载"

---

### ~rlm spawn <role> <task>

手动启动指定角色的子代理执行任务。

**参数:**
- `role`: 角色名称（explorer/analyzer/implementer/reviewer/tester/synthesizer）
- `task`: 任务描述（用引号包裹）

**执行步骤:**

1. 验证角色名称有效性
2. 加载角色预设文件
3. 准备上下文（折叠后传递）
4. 启动子代理
5. 等待执行完成
6. 折叠结果返回

**示例:**
```bash
~rlm spawn explorer "分析项目的目录结构和依赖关系"
~rlm spawn analyzer "评估 src/api/ 模块的代码质量"
~rlm spawn implementer "实现用户登录功能"
```

**输出格式:**
```
🔵【HelloAGENTS】- RLM: spawn_agent

正在启动子代理...
- 角色: {role}
- 任务: {task}
- 深度: {depth}

{执行过程输出}

## 代理结果
- 状态: {status}
- 关键发现:
  {key_findings}
- 变更:
  {changes_made}
- 建议:
  {recommendations}

────
🔄 下一步: 继续任务 | ~rlm spawn 启动其他代理
```

---

### ~rlm fold [strategy]

手动触发上下文折叠。

**参数:**
- `strategy`: 折叠策略（可选）
  - `aggressive`: 激进折叠（保留10%）
  - `balanced`: 平衡折叠（保留25%，默认）
  - `conservative`: 保守折叠（保留50%）

**执行步骤:**

1. 获取当前上下文状态
2. 根据策略计算折叠目标
3. 提取关键信息
4. 执行折叠
5. 验证信息完整性
6. 输出折叠报告

**输出格式:**
```
🔵【HelloAGENTS】- RLM: fold

## 折叠报告
- 策略: {strategy}
- Working Context: {before} → {after} ({reduction}% 压缩)
- Session Events: {before} → {after} ({reduction}% 压缩)

## 保留的关键信息
{key_points_list}

## 折叠的内容摘要
{folded_summary}

────
🔄 下一步: ~rlm context 查看详情 | 继续任务
```

---

### ~rlm context

显示三层上下文的详细状态。

**执行步骤:**

1. 获取各层上下文内容
2. 统计token使用
3. 列出关键条目
4. 格式化输出

**输出格式:**
```
🔵【HelloAGENTS】- RLM: context

## Working Context ({size} tokens)
当前任务: {current_task}
活跃内容:
{working_items}

## Session Events ({size} tokens)
事件数量: {event_count}
最近事件:
{recent_events}

## Memory & Artifacts
知识库状态: {kb_status}
已加载文件:
{loaded_files}

────
🔄 下一步: ~rlm fold 压缩上下文 | peek() 查询特定内容
```

---

### ~rlm history

显示代理执行历史。

**执行步骤:**

1. 获取历史记录
2. 按时间排序
3. 汇总统计
4. 格式化输出

**输出格式:**
```
🔵【HelloAGENTS】- RLM: history

## 执行统计
- 总代理数: {total}
- 成功: {success} | 失败: {failed} | 部分完成: {partial}
- 平均执行时间: {avg_time}

## 执行历史
| 时间 | 角色 | 任务 | 状态 | 深度 |
|------|------|------|------|------|
{history_rows}

## 最近结果摘要
{recent_results}

────
🔄 下一步: ~rlm spawn 启动新代理 | ~rlm reset 清除历史
```

---

### ~rlm reset

重置RLM状态。

**执行步骤:**

1. 确认重置操作
2. 清除活跃代理
3. 重置上下文层
4. 清除执行历史
5. 恢复默认配置

**确认提示:**
```
❓【HelloAGENTS】- RLM: reset

即将重置RLM状态，这将:
- 终止所有活跃代理
- 清除 Working Context
- 清除 Session Events（保留 Memory）
- 清除执行历史

请确认:
1. ✅ 确认重置
2. ❌ 取消

────
🔄 下一步: 选择操作
```

**重置完成:**
```
✅【HelloAGENTS】- RLM: reset

RLM状态已重置:
- 模式: STANDARD
- 深度: 0
- 上下文: 已清除
- 历史: 已清除

────
🔄 下一步: ~rlm spawn 启动新任务
```

---

### ~rlm session

显示当前 Session 信息。

**执行步骤:**

1. 获取当前 Session ID（从环境变量或自动生成）
2. 读取 Session 元数据
3. 统计事件和代理历史
4. 格式化输出

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/session.py" --info
```

**输出格式:**
```
🔵【HelloAGENTS】- RLM: session

## 当前 Session
- Session ID: {session_id}
- 创建时间: {created_at}
- 最后活跃: {last_active}
- Session 目录: {session_dir}

## 统计
- 事件数: {total_events}
- 代理执行数: {agent_count}

────
🔄 下一步: ~rlm history 查看详情 | ~rlm sessions 列出所有
```

---

### ~rlm sessions

列出所有 Sessions。

**执行步骤:**

1. 扫描 Session 根目录
2. 读取各 Session 元数据
3. 按最后活跃时间排序
4. 格式化输出

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/session.py" --list
```

**输出格式:**
```
🔵【HelloAGENTS】- RLM: sessions

## 活跃 Sessions
| Session ID | 创建时间 | 最后活跃 |
|------------|----------|----------|
{session_rows}

## 清理建议
运行 `~rlm cleanup 24` 清理超过24小时的旧 Sessions

────
🔄 下一步: ~rlm session 查看当前 | ~rlm cleanup 清理旧 Sessions
```

---

### ~rlm cleanup [hours]

清理过期 Sessions。

**参数:**
- `hours`: 清理超过 N 小时的 Sessions（默认 24）

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/session.py" --cleanup {hours}
```

**输出格式:**
```
✅【HelloAGENTS】- RLM: cleanup

已清理 {cleaned} 个过期 Sessions
保留当前 Session: {current_session_id}

────
🔄 下一步: ~rlm sessions 查看剩余 Sessions
```

---

## 自动触发规则

```yaml
自动启用RLM条件:
  复杂度检测:
    - 任务描述包含"分析并实现"、"全面审查"等复合意图
    - 预估改动超过3个文件或100行代码
    - 涉及多个技术领域

  用户偏好:
    - 用户在项目配置中启用 RLM_AUTO: true
    - 用户在会话中请求"使用递归模式"

自动模式选择:
  RECURSIVE:
    - 需要专业角色分工
    - 任务有明确的分解结构

  PARALLEL:
    - 多个独立子任务
    - 无依赖关系的分析任务
```

---

## 错误处理

```yaml
RLM 核心错误:
  角色不存在:
    错误: "Unknown role: {role}"
    处理: 显示可用角色列表

  递归深度超限:
    错误: "Max recursion depth exceeded"
    处理: 自动折叠当前层，返回上层继续

  代理超时:
    错误: "Agent timeout after {timeout}s"
    处理: 返回部分结果，询问是否重试

  上下文溢出:
    错误: "Context overflow in {layer}"
    处理: 自动触发折叠，继续执行

协作模式错误:
  未启用协作模式:
    错误: "当前为隔离模式"
    处理: 提示设置环境变量并重启

  任务不存在:
    错误: "Task not found: {task_id}"
    处理: 显示可用任务列表

  并发写入冲突:
    错误: "Failed to acquire lock"
    处理: 自动重试 3 次，间隔 100ms

  权限不足:
    错误: "Cannot complete task: not the owner"
    处理: 显示当前负责人信息
```

---

## 用户选择处理

```yaml
spawn 角色选择（角色无效时）:
  内容要素:
    - 可用角色列表及说明
    - 每个角色的典型任务
  选项:
    1. explorer - 代码库探索
    2. analyzer - 深度分析
    3. implementer - 代码实现
    4. reviewer - 代码审查
    5. tester - 测试设计
    6. synthesizer - 结果综合
    7. 取消

reset 确认:
  内容要素:
    - 重置影响说明
    - 当前状态摘要
  选项:
    1. 确认重置
    2. 取消

代理失败处理:
  内容要素:
    - 错误信息
    - 部分结果（如有）
  选项:
    1. 重试
    2. 跳过继续
    3. 终止任务
```

---

## 与其他命令的关系

```yaml
命令集成:
  ~auto:
    - 复杂任务自动启用RLM
    - 使用Sequential Chain模式

  ~plan:
    - 方案设计阶段可用analyzer角色
    - 多方案对比可用Parallel模式

  ~review:
    - 自动调用reviewer角色
    - 大型审查使用Divide & Conquer

  ~test:
    - 自动调用tester角色
    - 测试设计和执行分离

状态保护:
  - RLM状态独立于HelloAGENTS流程状态
  - 命令执行完成后RLM状态保留
  - ~rlm reset 显式清除
```

---

## 多终端协作模式

```yaml
设计理念:
  默认行为: 隔离模式，每个终端独立
  协作模式: 通过环境变量显式启用

启用方式:
  Windows PowerShell:
    $env:hellotasks="my-task-list"; <AI CLI 命令>

  Windows CMD:
    set hellotasks=my-task-list && <AI CLI 命令>

  Linux/macOS:
    hellotasks=my-task-list <AI CLI 命令>

  示例:
    hellotasks=auth-migration codex      # Codex CLI
    hellotasks=auth-migration claude     # Claude Code

任务存储:
  位置: {项目目录}/helloagents/tasks/{list_id}.json
  格式: JSON 数组，包含任务对象
  锁机制: 文件锁防止并发写入冲突
```

---

### ~rlm tasks

显示共享任务列表状态和所有任务。

**前提条件:** 需设置 `hellotasks` 环境变量

**执行步骤:**

1. 检查是否为协作模式
2. 读取任务列表文件
3. 统计各状态任务数量
4. 格式化输出

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --status
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --list
```

**输出格式:**
```
🔵【HelloAGENTS】- RLM: tasks

## 协作模式状态
- 任务列表 ID: {list_id}
- 存储位置: {tasks_file}
- 最后更新: {last_updated}

## 任务统计
| 状态 | 数量 |
|------|------|
| 待处理 | {pending} |
| 进行中 | {in_progress} |
| 已完成 | {completed} |
| 被阻塞 | {blocked} |

## 任务列表
| ID | 标题 | 状态 | 负责人 | 阻塞项 |
|----|------|------|--------|--------|
{task_rows}

────
🔄 下一步: ~rlm tasks available 查看可认领 | ~rlm tasks claim <id> 认领任务
```

**非协作模式输出:**
```
⚠️【HelloAGENTS】- RLM: tasks

当前为隔离模式，未启用多终端协作。

启用方法:
  hellotasks=my-task-list <AI CLI 命令>

────
🔄 下一步: 设置环境变量后重新启动
```

---

### ~rlm tasks available

显示可认领的任务（未被认领且无阻塞依赖）。

**执行步骤:**

1. 获取所有任务
2. 过滤: status=pending, owner=null, blocked_by=[]
3. 格式化输出

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --available
```

**输出格式:**
```
🔵【HelloAGENTS】- RLM: tasks available

## 可认领任务 ({count} 个)
| ID | 标题 | 创建时间 |
|----|------|----------|
{available_task_rows}

────
🔄 下一步: ~rlm tasks claim <task_id> 认领任务
```

**无可用任务:**
```
🔵【HelloAGENTS】- RLM: tasks available

当前无可认领任务。

可能原因:
- 所有任务已被认领
- 剩余任务有未完成的依赖

────
🔄 下一步: ~rlm tasks 查看完整列表
```

---

### ~rlm tasks claim <task_id>

认领指定任务。

**参数:**
- `task_id`: 要认领的任务 ID

**执行步骤:**

1. 验证任务存在
2. 检查是否已被他人认领
3. 检查是否有未完成的依赖
4. 设置 owner 和 status=in_progress
5. 写入更新

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --claim {task_id} --owner {session_id}
```

**成功输出:**
```
✅【HelloAGENTS】- RLM: tasks claim

任务认领成功！
- 任务 ID: {task_id}
- 标题: {subject}
- 状态: in_progress

────
🔄 下一步: 开始执行任务 | ~rlm tasks complete {task_id} 完成后标记
```

**失败输出（已被认领）:**
```
❌【HelloAGENTS】- RLM: tasks claim

认领失败: 任务已被他人认领
- 任务 ID: {task_id}
- 当前负责人: {owner}

────
🔄 下一步: ~rlm tasks available 查看其他可认领任务
```

**失败输出（有依赖阻塞）:**
```
❌【HelloAGENTS】- RLM: tasks claim

认领失败: 任务有未完成的依赖
- 任务 ID: {task_id}
- 阻塞项: {blocked_by_list}

────
🔄 下一步: 等待依赖任务完成，或 ~rlm tasks available 查看其他任务
```

---

### ~rlm tasks complete <task_id>

标记任务为已完成，并自动解除依赖。

**参数:**
- `task_id`: 要标记完成的任务 ID

**执行步骤:**

1. 验证任务存在
2. 验证当前终端是任务负责人
3. 更新 status=completed
4. 自动解除依赖: 从其他任务的 blocked_by 中移除此任务
5. 写入更新

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --complete {task_id}
```

**成功输出:**
```
✅【HelloAGENTS】- RLM: tasks complete

任务已完成！
- 任务 ID: {task_id}
- 标题: {subject}

## 依赖解除
以下任务的阻塞已解除:
{unblocked_tasks_list}

────
🔄 下一步: ~rlm tasks available 查看新的可认领任务
```

---

### ~rlm tasks add "<subject>"

添加新任务到共享列表。

**参数:**
- `subject`: 任务标题（用引号包裹）

**可选参数:**
- `--blocked-by <task_ids>`: 依赖的任务 ID（逗号分隔）

**执行步骤:**

1. 生成唯一任务 ID
2. 创建任务对象
3. 写入任务列表
4. 返回新任务 ID

**命令调用:**
```bash
python -X utf8 "{SKILL_ROOT}/rlm/shared_tasks.py" --add "{subject}"
```

**输出格式:**
```
✅【HelloAGENTS】- RLM: tasks add

任务已添加！
- 任务 ID: {task_id}
- 标题: {subject}
- 状态: pending

────
🔄 下一步: ~rlm tasks claim {task_id} 认领任务
```

---

## 协作模式使用示例

```yaml
场景: 两个终端协作完成认证迁移

终端 A: hellotasks=auth-migration codex
  ~rlm tasks add "迁移用户表 schema"  # 创建任务
  ~rlm tasks claim t1_xxx             # 认领任务
  (执行迁移)
  ~rlm tasks complete t1_xxx          # 完成任务

终端 B: hellotasks=auth-migration claude
  ~rlm tasks                          # 查看任务列表
  ~rlm tasks available                # 等待可认领任务
  ~rlm tasks claim t4_xxx             # 认领解锁的任务

同步机制: 任务状态基于文件实时同步，无需手动刷新
```


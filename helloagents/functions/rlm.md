# ~rlm 命令

> RLM（Recursive Language Model）子代理编排与多终端协作

---

## ~rlm / ~rlm help

直接执行类，加载后按模板输出，无需文件操作或环境扫描。

```yaml
触发: ~rlm（无子命令）或 ~rlm help
输出: 状态栏 + 下方模板内容 + 下一步引导
```

**输出模板:**

```
RLM（Recursive Language Model）— 子代理编排与多终端协作。

基础命令:
  ~rlm             显示此帮助
  ~rlm backend     CLI 后端信息
  ~rlm reload      重新加载规则文件
  ~rlm spawn <role> <task>  手动启动子代理
  ~rlm spawn r1,r2 <task>   并行启动多个子代理
  ~rlm agents      查看当前会话子代理状态
  ~rlm resume <id> 恢复暂停/超时的子代理
  ~rlm team <action>  Agent Teams 管理（start|status|stop）
  ~rlm session     当前 Session 信息
  ~rlm sessions    列出所有 Sessions
  ~rlm cleanup [hours]  清理过期 Sessions（默认24h）
  ~rlm reset       重置 RLM 状态

协作模式（需先设置 hellotasks 环境变量）:
  ~rlm tasks                共享任务列表
  ~rlm tasks available      可认领任务
  ~rlm tasks claim <id>     认领任务
  ~rlm tasks complete <id>  标记完成
  ~rlm tasks add "<subject>" 添加新任务
```

---

## 子命令详解

### ~rlm backend

输出: 直接回答（后端名称+执行层级）

---

### ~rlm reload

```yaml
触发: "context compacted" 提示 | 用户说"重新加载规则" | ~rlm reload

输出: 确认（将重新加载规则文件+当前状态）
⛔ END_TURN

用户确认后:
  继续: 重新读取规则文件 → 重新读取 tasks.md（如有）→ 输出完成
  取消: → 状态重置
```

---

### ~rlm spawn <role> <task>

```yaml
参数:
  role: 角色名称（explorer/analyzer/designer/implementer/reviewer/tester/synthesizer/kb_keeper/pkg_keeper/researcher/writer/executor）
  task: 任务描述（用引号包裹）

流程:
  1. 验证角色名称有效性
  2. 角色无效时: 输出: 错误（可用角色列表+典型任务）
  3. 输出: 确认（角色+任务描述+执行通道）
     ⛔ END_TURN
  4. 用户确认后:
       继续: 加载角色预设 → 按 G10 调用通道启动子代理:
         Claude Code → Task(subagent_type="general-purpose", prompt="[RLM:{role}] ...")
         Codex CLI → spawn_agent("[RLM:{role}] ...")
         其他 CLI → 主上下文直接执行（降级）
         → 等待完成 → 返回结果
       取消: → 状态重置

并行 spawn 语法: ~rlm spawn explorer,analyzer "任务描述" — 逗号分隔多角色，并行调度

输出: 完成（角色+任务+结果状态+关键发现+变更+建议）
```

**示例:**
```bash
~rlm spawn explorer "分析项目的目录结构和依赖关系"
~rlm spawn analyzer "评估 src/api/ 模块的代码质量"
~rlm spawn implementer "实现用户登录功能"
```

---

### ~rlm agents

```yaml
参数: 无
流程: 查询当前会话子代理状态（活跃/已完成/暂停/失败）
输出: 表格（ID | 角色 | 状态 | 任务摘要 | 耗时）
数据来源: SessionManager.get_agents() | SubagentStart/Stop hook 日志（Claude Code）| 内部线程状态（Codex CLI）
```

---

### ~rlm resume <agent_id>

```yaml
参数: agent_id — 子代理标识
流程:
  1. 验证 agent_id 存在且状态为暂停/超时
  2. 按 G10 通道恢复:
     Codex CLI → resume_agent(agent_id)（Collab 工具，需 Collab 特性启用）
     Claude Code → 不支持（子代理无暂停态）→ 提示重新 spawn
     其他 → 降级提示
输出: 恢复状态确认
```

---

### ~rlm team <action>

```yaml
参数:
  action: start | status | stop

~rlm team start "任务描述":
  前置: Claude Code 环境 + CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
  流程: 分析任务 → 确定角色分配 → 创建 Agent Team → spawn teammates → delegate mode
  不支持的 CLI → 输出: 降级提示（Agent Teams 仅 Claude Code 支持，使用 ~rlm spawn 替代）

~rlm team status:
  输出: 当前团队成员列表（角色 | 状态 | 当前任务）

~rlm team stop:
  流程: 请求 teammates 关闭 → 清理团队资源
```

---

### ~rlm session

```yaml
脚本: session.py --info
输出: 直接回答（Session ID+创建时间+最后活跃+目录+事件数+代理执行数）
```

---

### ~rlm sessions

```yaml
脚本: session.py --list
输出: 直接回答（Sessions表+清理建议）
```

---

### ~rlm cleanup [hours]

```yaml
参数: hours（清理超过N小时的Sessions，默认24）

扫描: session.py --list → 获取 Sessions 总数和符合清理条件的数量

输出: 确认（符合条件{N}个/共{M}个Sessions+清理范围: 超过{hours}小时）
⛔ END_TURN

用户确认后:
  继续: 脚本 session.py --cleanup {hours} → 输出完成（已清理数量+保留当前Session）
  取消: → 状态重置

说明: 当前 Session 由 HELLOAGENTS_SESSION_ID 环境变量确定
```

---

### ~rlm reset

```yaml
流程:
  输出: 确认（重置影响+当前状态）
  ⛔ END_TURN
  用户确认后:
    继续: 清除会话事件 → 恢复默认
    取消: → 状态重置
输出: 完成（重置结果）
```

---

## 错误处理

| 错误 | 消息 | 处理 |
|------|------|------|
| 角色不存在 | "Unknown role: {role}" | 显示可用角色列表 |
| 代理超时 | "Agent timeout after {timeout}s" | 返回部分结果，询问重试 |
| 未启用协作 | "当前为隔离模式" | 提示设置环境变量并重启 |
| 任务不存在 | "Task not found: {task_id}" | 显示可用任务列表 |
| 并发写入冲突 | "Failed to acquire lock" | 重试3次，间隔100ms |
| 权限不足 | "Cannot complete task: not the owner" | 显示当前负责人信息 |

---

## 多终端协作模式

```yaml
设计理念:
  默认: 隔离模式，每个终端独立
  协作: 通过环境变量显式启用

启用方式:
  PowerShell: $env:hellotasks="my-task-list"; <AI CLI>
  CMD: set hellotasks=my-task-list && <AI CLI>
  Linux/macOS: hellotasks=my-task-list <AI CLI>

任务存储:
  位置: {KB_ROOT}/tasks/{list_id}.json
  格式: JSON（元数据+tasks数组）
  锁: 文件锁防止并发冲突（Windows使用msvcrt）
```

### 协作命令详解

#### ~rlm tasks

```yaml
前提: hellotasks 环境变量已设置
脚本: shared_tasks.py --status + shared_tasks.py --list
协作模式: 输出: 直接回答（任务列表ID+存储位置+状态统计+任务表）
非协作模式: 输出: 完成（隔离模式说明+启用方式）
```

#### ~rlm tasks available

```yaml
过滤: status=pending, owner=null, blocked_by=[]
脚本: shared_tasks.py --available
有可用任务: 输出: 直接回答（可认领任务表+数量）
无可用任务: 输出: 完成（无可认领任务+可能原因）
```

#### ~rlm tasks claim <task_id>

```yaml
流程: 验证存在 → 检查认领状态 → 检查依赖 → 设置owner+status=in_progress → 写入
脚本: shared_tasks.py --claim {task_id} --owner {session_id}

成功: 输出: 完成（任务ID+标题+状态）
失败-已被认领: 输出: 错误（任务ID+当前负责人）
失败-有依赖: 输出: 错误（任务ID+阻塞项列表）
```

#### ~rlm tasks complete <task_id>

```yaml
流程: 验证存在 → 验证负责人 → status=completed → 解除依赖 → 写入
脚本: shared_tasks.py --complete {task_id}
输出: 完成（任务ID+标题+解除阻塞的任务列表）
```

#### ~rlm tasks add "<subject>"

```yaml
参数: subject（任务标题）, --blocked-by <task_ids>（可选，逗号分隔）
脚本: shared_tasks.py --add '{subject}'
输出: 完成（任务ID+标题+状态）
```

---

## 协作模式使用示例

```yaml
场景: 两个终端协作完成认证迁移

终端 A: hellotasks=auth-migration codex
  ~rlm tasks add "迁移用户表 schema"
  ~rlm tasks claim t1_xxx
  (执行迁移)
  ~rlm tasks complete t1_xxx

终端 B: hellotasks=auth-migration claude
  ~rlm tasks
  ~rlm tasks available
  ~rlm tasks claim t4_xxx

同步: 任务状态基于文件实时同步
```

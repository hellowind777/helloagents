# 记忆服务 (MemoryService)

本服务定义持久记忆层，为 CLI 工具的上下文管理提供跨会话补充。

> 定位：不替代 CLI 工具的上下文管理，仅补充其无法持久化的记忆。

---

## 服务说明

```yaml
服务类型: 领域服务
适用范围: 所有路径（命令路径 + 外部工具路径 + 通用路径）
核心职责: 跨会话记忆的存储、加载与检索
```

---

## 记忆层模型

```yaml
L0 用户记忆:
  内容: 用户偏好、习惯、技术背景及任意用户自定义信息
  作用域: 全局（跨项目跨会话）
  存储: {HELLOAGENTS_ROOT}/user/ 整个目录
  维护: 用户手动维护，可放任意 .md 文件
  骨架: profile.md 为系统预置骨架，用户可增删任意文件
  加载: 每次会话启动时扫描 user/*.md 读取所有文件
  缺省: 目录空或不存在时静默跳过

L1 项目知识:
  内容: 项目结构、模块文档、架构决策、变更历史
  作用域: per-project
  存储: {KB_ROOT}/（现有知识库，不变）
  格式: 模块文档 + INDEX.md 关键词索引
  加载: 有项目上下文时按需读取

L2 会话摘要:
  内容: 上次做了什么、关键决策、未完成事项
  作用域: per-session（与 CLI session ID 绑定）
  存储:
    项目内: {KB_ROOT}/sessions/{session_id}.md
    全局: {HELLOAGENTS_ROOT}/user/sessions/{session_id}.md
  格式: 每会话独立文件（并发安全，同一会话始终同一文件）
  加载: 按 session ID 精确匹配，或最近 1-2 个摘要
  运行: 始终开启，系统自动读写
```

---

## 会话生命周期

### Session ID 关联

```yaml
原则: 从 CLI 工具的会话存储目录中获取当前 session ID，与 L2 文件绑定

获取策略（按 CLI 类型）:

  Claude Code（检测: ~/.claude/ 目录存在）:
    1. 构建项目会话目录: ~/.claude/projects/{path_hash}/
       path_hash = 工作目录路径，将 : \ / 替换为 -
       示例: E:\dev\myagents → E--dev-myagents
    2. 在该目录下找到修改时间最新的 .jsonl 文件
    3. 文件名（去掉 .jsonl）= session ID
       示例: 1d6e01ef-b78f-434c-8dc3-4c67277cd896

  Codex CLI（检测: ~/.codex/ 目录存在）:
    1. 扫描 ~/.codex/sessions/ 下最新日期目录
    2. 找到修改时间最新的 .jsonl 文件
    3. 文件名（去掉 .jsonl）= session ID
       示例: rollout-2026-02-06T19-57-42-019c32d0-ad7a-70b2-b378-c2b94a4ce4a3

  其他 CLI:
    按相同思路：定位 CLI 会话存储目录 → 找最新会话文件 → 提取 ID

  回退（无法识别 CLI 或无法访问会话目录）:
    HelloAGENTS 自生成 UUID，写入活状态区随对话持久化
    <!-- HELLOAGENTS_SESSION_ID: {generated_uuid} -->

为什么可靠:
  - CLI 恢复会话时会继续写入同一个 .jsonl 文件 → 该文件修改时间变为最新
  - 新会话创建新 .jsonl → 自然成为最新文件
  - 不同项目在不同目录下 → 不会混淆

L2 文件命名: sessions/{session_id}.md
```

### 会话启动

```yaml
会话启动流程:
  1. 获取 CLI session ID（按上述优先级）
  2. L2 自动清理: sessions/ 下文件数 > 20 时，删除最旧的文件直到剩余 20 个
  3. 查找 sessions/{session_id}.md:
     存在 → 恢复会话
     不存在 → 全新会话
  4. 扫描 {HELLOAGENTS_ROOT}/user/*.md 读取所有文件（有文件就读、目录空或不存在就跳过）
  5. 按会话类型处理 L2:

全新会话:
  - 读取 sessions/ 下最近 1-2 个摘要文件（获取历史上下文）
  - 将 L0 + L2 摘要作为背景上下文注入

恢复会话:
  - 读取 sessions/{session_id}.md（本会话的 L2 文件）
  - 跳过其他会话摘要的注入（CLI 已恢复完整对话历史）
  - L0 仍需读取（偏好可能在其他实例中更新）
```

### 记忆写入

```yaml
L0 写入: 用户手动维护
  - 系统不自动写入 user/ 目录下的任何文件
  - 用户通过直接编辑 user/*.md 文件来管理自己的记忆
  - profile.md 为系统预置骨架，用户按需填写

L2 写入: 系统自动，始终开启
  触发点（替代不可靠的"会话结束"检测）:
    - 阶段切换: 工作流阶段转换时（ANALYZE→DESIGN→DEVELOP 等）
    - ~commit: 提交代码时同步写入会话摘要
    - 状态重置: 任务完成/取消触发完整重置时 [→ G6]
    - 用户明确请求: 用户说"保存/记住/记录"等

  写入流程:
    1. 从对话历史中提取有价值信息:
       L2 会话摘要: 有明确结论或决策 → 写入 sessions/{session_id}.md
       跳过: 轮次≤2 且无文件操作且无明确结论 → 不写入
    2. L2 写入: 创建或覆盖 sessions/{session_id}.md（同一会话始终同一文件）
    3. 摘要内容: 做了什么 + 关键决策 + 未完成事项（≤300字）
```

### 边界场景

```yaml
Rewind/Undo（用户回退对话）:
  Session ID: 不变（同一 .jsonl 文件）
  L2: 安全（在触发点写入，反映当前对话状态；回退后的后续触发点会覆盖旧摘要）
  结论: 记忆写入基于触发点而非会话结束，rewind 天然兼容，无需特殊处理

恢复旧会话（resume 非最新会话）:
  原理: CLI 恢复会话后继续写入该 .jsonl → 修改时间变为最新
  时序保证: CLI 写入用户消息(步骤1) → 调用 API(步骤2) → AI 处理(步骤3)
  结果: HelloAGENTS 在步骤3扫描时，恢复的 .jsonl 已是最新文件 → 正确匹配

子代理并行工作:
  L0: 主代理持有，通过 prompt 向子代理传递相关偏好
  L1: 子代理可自行读取 KB 文件（只读，无冲突）
  L2: 仅主代理在触发点写入（子代理结果通过返回值汇总到主代理）
  Session ID: 仅主代理持有，子代理不需要
  原则: 子代理是短生命周期任务执行者，不参与记忆的读写生命周期

Codex CLI Memory 桥接:
  映射: Codex CLI Memory 系统（~/.codex/ 下 rollout_summaries/）≈ HelloAGENTS L1 知识库的外部补充
  读取优先级: HelloAGENTS L1 KB > Codex CLI Memory（避免冲突）
  写入规则: HelloAGENTS 通过 KnowledgeService 写入 L1，不直接写入 Codex CLI Memory
  子代理隔离: spawn_agent 创建的子代理继承主代理 Memory 上下文（只读）
  同步触发: Stop hook（Claude Code）或 notify hook（Codex CLI, agent-turn-complete）触发 KB 同步时，
            可选将 L1 变更同步到 Codex CLI Memory（单向，L1→Codex Memory）
```

**DO:** 优先使用 CLI 原生 session ID，启动时静默加载，恢复会话时复用已有 L2 文件，在触发点自动写入 L2 摘要

**DO NOT:** 每次都生成新 L2 文件名，恢复会话时重复注入历史摘要，在会话中间无触发点时写入 L2，让子代理直接读写 L0/L2 文件

---

## 存储格式

### L0 user/*.md

用户自由组织，系统预置骨架 `profile.md` 结构如下：

```markdown
# 用户记忆

## 偏好
- 偏好 pytest，使用 black 格式化

## 技术背景
- 主力语言 Python 3.11+，熟悉 TypeScript

## 沟通风格
- 中文交流，技术术语保持英文
```

用户可增删任意 `.md` 文件（如 `shortcuts.md`、`notes.md` 等），系统会话启动时全部读取。

### L2 会话摘要

```markdown
# 会话摘要

**Session ID:** {session_id}
**时间:** 2025-01-15 14:30
**项目:** my-webapp（如有）
**模式:** 工作流 / 自由

## 做了什么
- 重构了认证模块，从 session 迁移到 JWT

## 关键决策
- 选择 RS256 算法，因为需要跨服务验证

## 未完成
- 刷新 token 逻辑待实现
```

---

## 并发安全

```yaml
L0: 用户手动维护 → 无并发写入问题
L1: 现有 KB 机制（写前校验）
L2: 每会话独立文件 → 零冲突
```

---

## 检索策略

```yaml
原则: AI 自身作为检索引擎，INDEX.md 作为轻量索引

流程:
  1. AI 读取 INDEX.md 关键词表（轻量）
  2. 根据当前需求判断哪些模块相关
  3. 仅加载相关模块详细文档

适用: L1 项目知识的按需检索
不适用: L0（全量扫描 user/*.md）和 L2（按时间加载最近 N 个）
```

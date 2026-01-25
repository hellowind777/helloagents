---
name: helloagents
description: "【HelloAGENTS】显式调用入口。使用 /helloagents 或 $helloagents 激活。"
license: Apache-2.0
metadata:
  author: helloagents
  version: "2.0"
---

# HelloAGENTS 技能入口

> 本文件在用户显式调用技能时加载（/helloagents 或 $helloagents）。
> 核心规则在主配置中定义，本文件定义显式调用时的响应规则。

**路径基准:** `SKILL_ROOT: skills/helloagents/` — 本文件及子模块中的相对路径（references/、scripts/、assets/）需添加此前缀。

---

## 显式调用响应规则

当用户通过 `/helloagents` 或 `$helloagents` 显式调用本技能时，输出以下欢迎信息：

```
💡【HelloAGENTS】- 技能已激活

智能工作流系统，提供结构化任务流程。

### 可用命令

| 命令 | 功能 |
|------|------|
| `~auto` | 全授权命令 |
| `~plan` | 执行到方案设计 |
| `~exec` | 执行方案包 |
| `~init` | 初始化知识库 |
| `~upgrade` | 升级知识库 |
| `~clean` | 清理遗留方案包 |
| `~commit` | Git 提交 |
| `~test` | 运行测试 |
| `~review` | 代码审查 |
| `~validate` | 验证知识库 |
| `~rollback` | 智能回滚 |
| `~rlm` | RLM 递归语言模型 |
| `~help` | 显示帮助 |

### 使用方式

- 输入 `~命令` 执行特定功能
- 直接描述需求，系统自动路由到合适的流程

────
🔄 下一步: 输入命令或描述你的需求
```

**后续输入处理：** 用户输入后，按照 G4 路由架构处理。

---

## 脚本调用约定

> 脚本调用规范（路径变量、存在性检查、错误恢复）见 references/rules/tools.md

脚本位于 scripts/ 目录，调用时使用 `-X utf8` 确保编码正确：

```yaml
知识库工具: python -X utf8 "scripts/upgradewiki.py" --scan | --init | --backup | --write <plan.json>
方案包验证: python -X utf8 "scripts/validate_package.py" [<package-name>]
方案包创建: python -X utf8 "scripts/create_package.py" "<feature>" [--type <implementation|overview>]
方案包迁移: python -X utf8 "scripts/migrate_package.py" "<package-name>" [--status <completed|skipped>] [--all]
方案包列表: python -X utf8 "scripts/list_packages.py" [--format <table|json>]
项目统计: python -X utf8 "scripts/project_stats.py" [--path <项目路径>]
```

---

## 模板资源

模板位于 assets/templates/ 目录，结构与知识库一致：

```yaml
assets/templates/
  - INDEX.md              # 知识库入口
  - context.md            # 项目上下文
  - CHANGELOG.md          # 变更日志
  - CHANGELOG_{YYYY}.md   # 年度变更日志（大型项目）
  - modules/_index.md     # 模块索引
  - modules/module.md     # 模块文档
  - plan/proposal.md      # 变更提案
  - plan/tasks.md         # 任务清单
  - archive/_index.md     # 归档索引
```

---

## RLM 递归语言模型

> 基于 MIT RLM 论文和 Context Folding 研究实现的递归执行框架

RLM 模块位于 `rlm/` 目录，提供递归执行和上下文折叠能力：

```yaml
核心架构:
  关键理解: AI CLI 本身就是 RLM 的 REPL 环境
    - Working Context = CLI 内存中的对话上下文（非文件）
    - Session Events = %TEMP%/helloagents_rlm/{session_id}/
    - Memory = helloagents/ 知识库（共享）

  递归调用: Task 工具 = llm.completion() 递归
  Session 隔离: 每个 CLI 实例独立 Session ID

核心能力:
  - 递归子代理调用（最大5层深度）
  - 三层上下文管理（Working/Session/Memory）
  - 智能上下文折叠（压缩至10-25%）
  - 四种编排模式（顺序/并行/分治/专家咨询）
  - 六种角色预设（explorer/analyzer/implementer/reviewer/tester/synthesizer）
  - Manus 借鉴（注意力锚定/KV Cache优化/阈值压缩）

目录结构:
  rlm/
  ├── __init__.py          # 包初始化
  ├── session.py           # Session 隔离管理（核心）
  ├── engine.py            # RLM核心引擎
  ├── context_manager.py   # 三层上下文管理
  ├── agent_orchestrator.py # 代理编排器
  ├── folding.py           # 上下文折叠
  ├── repl.py              # REPL交互环境
  ├── schemas/             # JSON Schema
  │   └── agent_result.json
  └── roles/               # 角色预设
      ├── explorer.md
      ├── analyzer.md
      ├── implementer.md
      ├── reviewer.md
      ├── tester.md
      └── synthesizer.md

脚本调用:
  Session 管理:
    python -X utf8 "{SKILL_ROOT}/rlm/session.py" --info     # 当前 Session 信息
    python -X utf8 "{SKILL_ROOT}/rlm/session.py" --list     # 列出所有 Sessions
    python -X utf8 "{SKILL_ROOT}/rlm/session.py" --cleanup 24  # 清理旧 Sessions
    python -X utf8 "{SKILL_ROOT}/rlm/session.py" --events 10   # 最近10条事件
    python -X utf8 "{SKILL_ROOT}/rlm/session.py" --history 20  # 最近20条代理历史

命令入口:
  ~rlm status    # 显示RLM状态
  ~rlm spawn     # 启动子代理
  ~rlm fold      # 手动折叠上下文
  ~rlm context   # 查看上下文状态
  ~rlm history   # 查看执行历史
  ~rlm session   # 当前 Session 信息
  ~rlm sessions  # 列出所有 Sessions
  ~rlm cleanup   # 清理旧 Sessions
  ~rlm reset     # 重置RLM状态

详细规则: 见 G9/G10/G11 和 references/functions/rlm.md
```

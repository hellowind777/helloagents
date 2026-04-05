---
name: ~design
description: 兼容别名：行为等同 ~plan，保留给旧用法（~design 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~design [description]

`~design` 已迁移为 `~plan` 的兼容别名。

执行要求：

1. 保持对旧命令的兼容，不质疑用户为何使用 `~design`
2. 将本次请求视为 `~plan`
3. 立即按同一路径查找并读取 `skills/commands/plan/SKILL.md`
4. 后续流程、产物、文件命名、状态同步都以 `~plan` 规则为准

说明：

- 新方案包文件名是 `plan.md`，不是 `design.md`
- 项目级 `DESIGN.md` 仍保留，专用于设计系统与 UI 契约

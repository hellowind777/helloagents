---
name: ~review
description: 兼容别名：行为等同 ~verify 的审查优先模式（~review 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~review [scope]

`~review` 已迁移为 `~verify` 的兼容别名。

执行要求：

1. 保持对旧命令的兼容，不要求用户改用新命令
2. 将本次请求视为 `~verify` 的“审查优先”模式
3. 立即按同一路径查找并读取 `skills/commands/verify/SKILL.md`
4. 优先执行范围识别与 `hello-review` 审查，再按需要进入完整验证与修复循环

---
name: ~commit
description: 规范化 Git 提交 + 知识库同步（~commit 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~commit [message]

## 流程

1. 检查 staged changes（git diff --staged）
2. 如果没有 staged changes，提示用户先 git add
3. 生成 conventional commit message（如未提供）
   - 格式: type(scope): description
   - type: feat|fix|refactor|docs|test|chore|style|perf
4. 优先使用当前上下文中已注入的“当前用户设置”获取 `commit_attribution`；只有上下文不存在时才读取 `~/.helloagents/helloagents.json`：
   - ""（空，默认）→ 不添加归属
   - 有内容（如 "Co-Authored-By: HelloAGENTS"）→ 添加该内容到 commit message
5. 执行 git commit

## 知识库同步
提交后，优先使用当前上下文中已注入的“当前用户设置”获取 `kb_create_mode`；只有上下文不存在时才读取 `~/.helloagents/helloagents.json`：
- 0 = 跳过
- 1 = 编码任务自动同步（默认）
- 2 = 始终同步
同步内容（仅知识库文件，规则同当前已加载 bootstrap 的 VALIDATE 阶段中的知识库同步）。

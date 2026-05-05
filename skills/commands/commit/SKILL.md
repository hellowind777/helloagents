---
name: ~commit
description: 规范化 Git 提交 + 知识库同步（~commit 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~commit [message]

执行 `~commit` 时，知识库同步与状态文件更新范围按当前已加载的 HelloAGENTS CONSOLIDATE / 流程状态要求执行；本命令只负责生成提交信息、读取提交归属配置并完成提交动作。

## 流程

1. 检查 staged changes（git diff --staged）
2. 如果没有 staged changes，提示用户先 git add
3. 生成 conventional commit message（如未提供）
   - 格式: type(scope): description
   - type: feat|fix|refactor|docs|test|chore|style|perf
4. 先一次性解析会话中已知设置：优先使用当前会话上下文中已注入的“当前用户设置”、该配置文件原始 JSON 或此前读取结果摘要；上下文不存在或缺少 `commit_attribution` / `kb_create_mode` 时，才读取一次 `~/.helloagents/helloagents.json`
5. 复用上一步已解析的设置获取 `commit_attribution`：
   - ""（空，默认）→ 不添加归属
   - 有内容（如 "Co-Authored-By: HelloAGENTS"）→ 添加该内容到 commit message
6. 执行 git commit
7. 若 `state_path` 已存在，按 HelloAGENTS“已有则更新”要求同步当前已提交状态

## 知识库同步
提交后，继续复用上方已解析的同一份设置获取 `kb_create_mode`，不要再次读取 `~/.helloagents/helloagents.json`：
- 0 = 跳过
- 1 = 编码任务自动同步（默认）
- 2 = 始终同步
同步范围与更新格式按当前已加载的 HelloAGENTS CONSOLIDATE 阶段执行。

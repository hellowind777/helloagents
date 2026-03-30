---
name: ~clean
description: 清理临时文件、缓存和归档已完成方案包（~clean 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~clean

## 流程

1. 扫描 .helloagents/plans/ 下的方案包
2. 判定完成状态：tasks.md 中所有任务已标记 [√]（该标记仅用于任务列表/验收清单）或 STATE.md "正在做什么"表明已完成
3. 已完成的方案包 → 将整个 plans/{feature}/ 目录归档到 .helloagents/archive/YYYY-MM/
4. 更新 .helloagents/archive/_index.md（按 templates/archive/_index.md 格式追加一行）
5. 清理临时文件：.helloagents/loop-results.tsv、.helloagents/.ralph-breaker.json
6. 重写 STATE.md（清空已归档的方案路径）
7. 输出清理摘要（归档了几个方案包、清理了哪些文件）

## 不删除
流程状态：STATE.md、DESIGN.md
知识沉淀：context.md、guidelines.md、verify.yaml、CHANGELOG.md、modules/

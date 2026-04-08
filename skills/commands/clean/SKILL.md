---
name: ~clean
description: 清理临时文件、缓存和归档已完成方案包（~clean 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~clean

执行 `~clean` 时，方案包归档、临时文件清理和 `STATE.md` 更新边界按当前已加载 bootstrap 执行；本命令只负责判定哪些方案包可以清理，以及输出清理摘要。
`.helloagents/` 在本 skill 中表示逻辑项目空间：`STATE.md` 和临时运行态文件保持项目本地；若 `project_store_mode=repo-shared`，`plans/` 与 `archive/` 按当前会话注入的项目知识/方案目录解析。

## 流程

1. 扫描逻辑 `.helloagents/plans/` 下的方案包（`project_store_mode=repo-shared` 时按当前知识/方案目录解析）
2. 判定完成状态：优先以 tasks.md 中所有任务已标记 [√] 为准；只有任务清单无法判断时，才把 `STATE.md` 中与当前方案一致的“主线目标”+“正在做什么”作为辅助信号，避免把旧恢复快照误当当前主线
3. 已完成的方案包 → 按 bootstrap 的归档规则移入逻辑 `.helloagents/archive/YYYY-MM/`，并同步更新逻辑 `.helloagents/archive/_index.md`
4. 清理 bootstrap 中定义的临时文件
5. 按 bootstrap 的流程状态规则更新 `STATE.md`；若当前状态指向已归档方案包，则清空对应方案路径
7. 输出清理摘要（归档了几个方案包、清理了哪些文件）

## 不删除
- 除按流程状态规则必须重写的 `STATE.md` 外，不删除流程状态文件
- 不删除知识沉淀文件或项目级设计契约

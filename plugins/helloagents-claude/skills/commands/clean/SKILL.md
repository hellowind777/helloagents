---
name: ~clean
description: 清理临时文件、缓存和归档已完成方案包（~clean 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~clean

执行 `~clean` 时，方案包归档、临时文件清理和状态文件更新范围按当前已加载的 HelloAGENTS 规则执行；本命令只负责判定哪些方案包可以清理，以及输出清理摘要。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：状态文件只使用 `state_path`，临时运行态文件保持项目本地；若 `project_store_mode=repo-shared`，`plans/` 与 `archive/` 按当前上下文中已注入的项目知识/方案目录解析。

## 流程

1. 扫描 `.helloagents/plans/` 下的方案包（按当前项目存储模式解析；`project_store_mode=repo-shared` 时使用共享知识/方案目录）
2. 判定完成状态：优先以 tasks.md 中所有任务已标记 [√] 为准；只有任务清单无法判断时，才读取 `state_path` 中与当前方案一致的“主线目标”+“正在做什么”作为辅助信息
3. 已完成的方案包 → 按 HelloAGENTS 归档规则移入 `.helloagents/archive/YYYY-MM/`（按当前项目存储模式解析），并同步更新 `.helloagents/archive/_index.md`
4. 清理 HelloAGENTS 临时文件
5. 按 HelloAGENTS 流程状态规则更新 `state_path`；若当前状态指向已归档方案包，则清空对应方案路径
6. 输出清理摘要（归档了几个方案包、清理了哪些文件）

## 不删除
- 除按流程状态规则必须重写的 `state_path` 外，不删除流程状态文件
- 不删除知识文件或项目级设计契约

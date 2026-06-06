# HelloAGENTS v3.1.2 beta

## 中文

### 新特性

- 新增 `~office` 命令，用于在进入 `~plan` / `~build` 之前先做价值与范围评估。它会先判断事情该不该做、该做多大，以及最小可验证切口应该落在哪里。
- 只读探索链路现在把 `~office` 与 `~idea` 一起纳入统一路由与守卫边界。范围评估阶段不会创建项目状态或知识文件，也不会越级执行写入或实现操作。

### 问题修复

- 无

### 文档

- 无

### 杂项

- 全量测试通过：
  - `156 pass / 0 fail`
- 版本号已同步到 `v3.1.2`

### 变更记录

完整更新记录：`v3.1.1 beta` (`502f1f6`) ... `v3.1.2 beta`

- `19d305b` feat: add office command for scope review

## English

### New Features

- Added the `~office` command for worth and scope review before `~plan` or `~build`. It decides whether the work is worth doing, how large it should be, and what the smallest testable wedge is.
- Extended the shared readonly routing and guard boundary so `~office`, like `~idea`, stays side-effect free. Scope review does not create project state or knowledge files and does not jump into writes or implementation.

### Bug Fixes

- None

### Documentation

- None

### Chores

- Full test suite passed:
  - `156 pass / 0 fail`
- Synced release versions to `v3.1.2`

### Changelog

Full Changelog: `v3.1.1 beta` (`502f1f6`) ... `v3.1.2 beta`

- `19d305b` feat: add office command for scope review

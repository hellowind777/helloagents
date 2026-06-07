# HelloAGENTS v3.1.3 beta

## 中文

### 新特性

- 无

### 问题修复

- `switch-branch` 现在会在内部执行 `npm install -g` 和 `npm run sync-hosts` 之前清理陈旧的 `HELLOAGENTS*` 生命周期环境变量，避免切分支时误复用旧目标、旧模式或旧自动部署状态。
- 包级 `preuninstall` 在没有显式宿主参数时固定回退到 `--all`，不再受 shell 中残留的 `HELLOAGENTS` 环境变量影响，避免卸载时只清理单个 CLI、遗漏稳定运行时副本。
- 运行时会话状态写入现在会对 Windows 下偶发的 `EPERM` / `EBUSY` / `ENOTEMPTY` 原子替换失败做重试，降低 advisor、closeout 与会话映射文件写入时的偶发测试和运行抖动。

### 文档

- 无

### 杂项

- 收敛了 bootstrap 核心规则、表达纪律和子代理短路规则，并统一了运行时阶段命名与契约测试口径，使规则模板、运行时提示与验证链路保持一致。
- 全量测试通过：
  - `158 pass / 0 fail`
- 版本号已同步到 `v3.1.3`

### 变更记录

完整更新记录：`v3.1.2` (`bac0710`) ... `v3.1.3 beta`

- `539fa2a` fix: harden lifecycle env cleanup
- `b1bc4d2` fix: retry transient runtime session writes
- `ab39566` refactor: 前置子代理短路规则
- `c5ac28d` refactor: 收紧 bootstrap 核心规则与语言纪律
- `6eece22` refactor: 统一中文阶段名与运行时提示口径

## English

### New Features

- None

### Bug Fixes

- `switch-branch` now clears stale `HELLOAGENTS*` lifecycle environment variables before its internal `npm install -g` and `npm run sync-hosts` chain, so branch switching does not accidentally reuse an old target, mode, or auto-deploy state.
- Package-level `preuninstall` now falls back to `--all` whenever no explicit host args are provided, so stale shell `HELLOAGENTS` env no longer shrinks uninstall cleanup to a single CLI or leaves the stable runtime copy behind.
- Runtime session-state writes now retry transient Windows `EPERM` / `EBUSY` / `ENOTEMPTY` atomic-replace failures, reducing flaky advisor, closeout, and active-session file updates.

### Documentation

- None

### Chores

- Refined the bootstrap core rules, wording discipline, and subagent short-circuit routing, and aligned runtime stage wording with the contract tests so templates, runtime prompts, and verification stay in sync.
- Full test suite passed:
  - `158 pass / 0 fail`
- Synced release versions to `v3.1.3`

### Changelog

Full Changelog: `v3.1.2` (`bac0710`) ... `v3.1.3 beta`

- `539fa2a` fix: harden lifecycle env cleanup
- `b1bc4d2` fix: retry transient runtime session writes
- `ab39566` refactor: move subagent short-circuiting earlier in the runtime chain
- `c5ac28d` refactor: tighten bootstrap core rules and language discipline
- `6eece22` refactor: unify Chinese workflow stage naming and runtime prompt wording

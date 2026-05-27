# HelloAGENTS v3.1.1 beta

## 中文

### 新特性

- 无

### 问题修复

- 修复 Codex App / Computer Use 通过 `--previous-notify` 包装受管 notify 后，`doctor codex` 误报 notify drift 的问题。现在受管 `notify = ["helloagents-js", "codex-notify"]` 即使被链式转发，仍会被识别为有效配置。
- 修复 Codex `cleanup` / `uninstall` 在 wrapped notify 场景下无法稳定识别 HelloAGENTS 受管 notify 的问题。现在仍可正确恢复用户原始 notify 配置。
- 增加 wrapped notify 场景的 doctor 与 cleanup 回归测试覆盖。

### 文档

- 无

### 杂项

- 全量测试通过：
  - `154 pass / 1 skip / 0 fail`
- 版本号已同步到 `v3.1.1`

### 变更记录

完整更新记录：`v3.1.0 beta` (`b77d22d`) ... `v3.1.1 beta`

- `74a3107` fix: support wrapped codex notify detection

## English

### New Features

- None

### Bug Fixes

- Fixed the false notify-drift report in `doctor codex` when Codex App / Computer Use wraps the managed notify entry through `--previous-notify`. The managed `notify = ["helloagents-js", "codex-notify"]` command is now still recognized as valid when chained.
- Fixed `cleanup` / `uninstall` recovery for wrapped Codex notify entries. HelloAGENTS can now still identify the managed notify chain and restore the user’s original notify configuration.
- Added regression coverage for wrapped notify detection in doctor and cleanup flows.

### Documentation

- None

### Chores

- Full test suite passed:
  - `154 pass / 1 skip / 0 fail`
- Synced release versions to `v3.1.1`

### Changelog

Full Changelog: `v3.1.0 beta` (`b77d22d`) ... `v3.1.1 beta`

- `74a3107` fix: support wrapped codex notify detection

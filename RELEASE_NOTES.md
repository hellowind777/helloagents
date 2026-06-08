# HelloAGENTS v3.1.4 beta

## 中文

### 新特性

- 无

### 问题修复

- 补充 bootstrap / guard 运行契约回归测试，锁定“未授权外部副作用必须阻塞”和“高风险 / 不可逆操作必须确认”两条关键规则，避免规则漂移后被安装、更新或分支切换链路同步到各 CLI。
- 补充生命周期审计后的整链路验证覆盖，确保 Claude Code、Gemini CLI、Codex CLI 在安装、更新、卸载、清理、模式切换、分支切换以及宿主配置写入 / 清理上的已实现行为继续保持一致。

### 文档

- README 与 README_CN 已按当前实现和验证结果重写相关说明，安装 / 更新 / 清理 / 切换链路、宿主配置文件写入与验证覆盖范围已与代码和测试对齐。

### 杂项

- 完成三类宿主 CLI、两类安装模式及运行时主流程的整体验证，当前主链路无新增阻断问题。
- 全量测试通过：
  - `158 pass / 0 fail`
- 版本号已同步到 `v3.1.4`

### 变更记录

完整更新记录：`v3.1.3 beta` (`d672149`) ... `v3.1.4 beta`

- `test` 锁定 bootstrap / guard 对未授权外部副作用与高风险确认的运行契约
- `docs` 按当前实现与验证结果刷新安装 / 更新 / 清理 / 分支切换与配置写入说明
- `release` 同步 `v3.1.4 beta` 版本号与发版记录

## English

### New Features

- None

### Bug Fixes

- Added bootstrap / guard runtime-contract regression coverage that locks two critical rules: unauthorized side effects must block, and high-risk or irreversible operations must require confirmation. This prevents rule drift from being propagated to host CLIs through install, update, or branch-switch flows.
- Added post-audit end-to-end lifecycle coverage to keep Claude Code, Gemini CLI, and Codex CLI aligned across install, update, uninstall, cleanup, mode switching, branch switching, and host-config write / cleanup behavior.

### Documentation

- Refreshed README and README_CN so the install, update, cleanup, branch-switch, host-config, and verification sections match the current implementation and tested behavior.

### Chores

- Completed a full verification pass across the supported host CLIs, both install modes, and the main runtime workflows; no new blocking issue remains in the primary paths.
- Full test suite passed:
  - `158 pass / 0 fail`
- Synced release versions to `v3.1.4`

### Changelog

Full Changelog: `v3.1.3 beta` (`d672149`) ... `v3.1.4 beta`

- `test` lock bootstrap / guard runtime contracts for unauthorized side effects and high-risk confirmation
- `docs` refresh install / update / cleanup / branch-switch and config-write guidance to match the verified implementation
- `release` sync `v3.1.4 beta` version numbers and release notes

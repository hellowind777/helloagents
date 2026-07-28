# Release Notes — v4.0.4

## 简体中文

### 缺陷修复

- **Codex 卸载时备份目录清理失败**（阻断）：`uninstallCodexManagedConfig` 中变量名 `backupPath` 未定义，应为 `backupDir`。此前该 `ReferenceError` 被调用方的 `catch {}` 静默吞掉，导致 `~/.helloagents/backups/codex/` 在卸载后不被清理。
- **migrate 误删当前版本受管的 `[hooks.state.*]` 段**（阻断）：`cleanLegacyCodexConfig` 遍历配置行时，将所有 `[hooks.state.*]` 段（包括当前版本写入的受管段）一并移除。Codex 依赖这些段中的 `trusted_hash` 信任 hooks，移除后 hooks 将不可用。修复后仅移除无管理标记的旧版段。
- **doctor 误报当前 `config.toml` 为 3.x 残留**：`notify = ["helloagents-js", ...] # helloagents-managed` 行中的 `helloagents-js` 被 `isLegacyHookCommand` 错误匹配。修复后 doctor 对带管理标记的 config.toml 行不再误报。
- **`helloagents-js` 从遗留签名中移除**：该可执行文件名在 3.x 和 4.x 中均被使用，放在 `LEGACY_COMMAND_SIGNS` 中导致 doctor、migrate、hooks 清理等多个环节产生误判。路径级签名（`/scripts/notify.mjs` 等）足以区分真正的 3.x 残留。

### 代码清理

- **删除 `codex-toml.mjs`**：该模块与 `codex-config.mjs` 功能重叠，且生产代码中无任何模块导入——仅测试文件引用。Codex 配置管理统一由 `codex-config.mjs` 负责。
- **删除 `codex-backup.mjs` 的 `readLatestBackup` 导出**：全仓库无模块导入此函数，同时移除了其私有辅助函数和不再使用的 `readText` 导入。

### 低层修复

- **`fsx.mjs` 的 `sleepSync`**：`Atomics.wait` 在主线程上无效（立即超时返回），退避等待从未真正执行。改为忙等循环，重试退避现在确实生效。
- **`notify.mjs` 的多字节截断**：`.slice(0, 150)` 可能从 emoji 或补充平面汉字中间截断。改为按 Unicode 码点计数截断。

### 安装脚本

- **`install.ps1` 和 `install.sh` 现支持 `HELLOAGENTS_SOURCE=git`**：此前 README 声称支持但脚本未实现。现在设置该变量后脚本会克隆仓库到 `~/.helloagents/source/` 并从本地安装，后续 `helloagents update` 将在此执行 `git pull`。
- **标志名更新**：脚本中的 `--inject`/`--plugin` 改为 `--standard`/`--global`（旧名仍兼容）。

---

## English

### Bug Fixes

- **Codex backup dir not cleaned on uninstall** (blocking): `uninstallCodexManagedConfig` referenced an undefined variable `backupPath` instead of the parameter `backupDir`. The resulting `ReferenceError` was silently swallowed by the caller's `catch {}`, leaving `~/.helloagents/backups/codex/` uncleaned after uninstall.
- **migrate incorrectly removed current managed `[hooks.state.*]` sections** (blocking): `cleanLegacyCodexConfig` stripped all `[hooks.state.*]` sections regardless of managed markers. Codex relies on `trusted_hash` entries in these sections to trust hooks; removing them breaks hooks. Fixed to only remove sections without the `# helloagents-managed` marker.
- **doctor falsely flagged current `config.toml` as 3.x legacy**: The `helloagents-js` string in `notify = ["helloagents-js", ...] # helloagents-managed` matched the legacy signature. Doctor now excludes managed lines from legacy detection.
- **`helloagents-js` removed from legacy command signatures**: This executable name is used in both 3.x and 4.x. Its presence in `LEGACY_COMMAND_SIGNS` caused false positives across doctor, migrate, and hooks cleanup. Path-based signatures (e.g. `/scripts/notify.mjs`) are sufficient to identify true 3.x artifacts.

### Code Cleanup

- **Removed `codex-toml.mjs`**: Duplicated `codex-config.mjs` functionality and was never imported by any production module — only referenced by tests. Codex config management is now unified in `codex-config.mjs`.
- **Removed `readLatestBackup` export from `codex-backup.mjs`**: Never imported anywhere in the repository. Its private helper and the unused `readText` import were also removed.

### Low-Level Fixes

- **`sleepSync` in `fsx.mjs`**: `Atomics.wait` is ineffective on the main thread (returns immediately), so retry backoff delays were never actually applied. Replaced with a spin-wait loop; exponential backoff now works correctly.
- **Multi-byte truncation in `notify.mjs`**: `.slice(0, 150)` could split emoji or supplementary-plane CJK characters. Now truncates by Unicode code points.

### Install Scripts

- **`install.ps1` and `install.sh` now support `HELLOAGENTS_SOURCE=git`**: Previously documented but not implemented. When set, the scripts clone the repository to `~/.helloagents/source/` and install from the local copy; subsequent `helloagents update` runs `git pull` there.
- **Flag names updated**: `--inject`/`--plugin` changed to `--standard`/`--global` in scripts (legacy names still accepted).

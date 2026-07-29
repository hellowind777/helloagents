# Release Notes — v4.0.4-beta.18

## 简体中文

### 缺陷修复

- **Codex 卸载无法清理受管 config.toml**（阻断）：`uninstallCodexManagedConfig` 将 `text` 声明在 `if (backup)` 块内，块外引用触发 `ReferenceError`，被调用方 `catch {}` 静默吞掉，导致 `model_instructions_file`、`notify`、`[features] hooks`、`[tui] notifications`、`[hooks.state.*]` 在卸载后残留。修复后在任意备份状态下均可正确清理；无备份时仅移除受管行，有备份时恢复安装前的用户原值。
- **update 在全局模式下不刷新 Codex 受管配置**：此前仅当安装模式为 `standard` 时同步 hooks 信任哈希。全局模式同样依赖标准层 hooks 与受管配置，现对两种模式统一调用 `installCodexManagedConfig` 刷新受管行与信任哈希。
- **doctor 在全局模式下跳过标准层检查**：全局模式叠加标准层（软链接、hooks、Codex 受管条目），但 doctor 原先只在 `mode === 'standard'` 时检查这些落盘。现对两种安装模式均检查标准层完整性。
- **Codex hooks 功能开关误判**：Codex 默认开启 hooks；安装时不再无条件写入 `hooks = true`，仅当用户显式设为 `false` 时才覆盖为受管 `true`。doctor 同步改为仅在显式关闭时告警。
- **`.codex-plugin/plugin.json` 版本漂移**：清单版本停留在 `4.0.3`，且未纳入 `sync-version` 同步列表。现已对齐 `package.json` 并加入清单同步。

### 行为说明

- **help 文案与 Cursor 双模式对齐**：Cursor 标准模式安装 hooks 与软链接（无用户级规则文件）；全局模式额外下发插件规则。帮助文本不再写“仅支持全局模式”。

---

## English

### Bug Fixes

- **Codex uninstall left managed `config.toml` entries behind** (blocking): `uninstallCodexManagedConfig` declared `text` inside the `if (backup)` block, so the outer references threw `ReferenceError`, which the caller's empty `catch {}` swallowed. Managed `model_instructions_file`, `notify`, `[features] hooks`, `[tui] notifications`, and `[hooks.state.*]` survived uninstall. Cleanup now works with or without a backup; without a backup only managed lines are removed, and with a backup the pre-install user values are restored.
- **`update` skipped Codex managed config in global mode**: Hook trust was synced only when `mode === 'standard'`. Global mode also relies on the standard-layer hooks and managed config; both modes now refresh managed lines and trust hashes via `installCodexManagedConfig`.
- **doctor skipped standard-layer checks in global mode**: Global mode layers on the standard base (symlink, hooks, Codex managed entries), but doctor only inspected those when `mode === 'standard'`. Both install modes now get the same base checks.
- **Codex hooks feature flag mishandled**: Codex enables hooks by default. Install no longer always writes `hooks = true`; it only overrides when the user explicitly set `hooks = false`. Doctor warns only when hooks are explicitly disabled.
- **`.codex-plugin/plugin.json` version drift**: The manifest stayed at `4.0.3` and was missing from `sync-version`. It is now aligned with `package.json` and included in the sync list.

### Behavior Clarification

- **Help text matches Cursor dual-mode support**: Standard mode installs hooks and the symlink (no user-level rules file); global mode also ships the plugin rule. Help no longer claims Cursor is global-only.

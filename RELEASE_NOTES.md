# HelloAGENTS 4.0.3 发布说明

一句话：全宿主双重安装模式、Git 源支持与命名体系统一。

4.0.2 只有 Claude 和 Cursor 支持全局模式（原生插件市场安装），Codex、Grok、Hermes 仅支持标准模式。本次发布将全局模式覆盖到全部五个宿主，新增 Git 克隆安装方式，并统一了内部命名体系。

## 新增：全宿主全局模式安装

- **Codex CLI 全局模式**：构建 `~/plugins/helloagents/` 插件快照，写入 `~/.agents/plugins/marketplace.json`（local-plugins 市场索引）与 `~/.codex/config.toml` 启用项，通过 `codex plugin add helloagents@local-plugins` 安装。
- **Grok Build 全局模式**：构建 `~/.grok/local-marketplaces/helloagents-marketplace/` 原生本地市场，同时在 `~/.grok/config.toml` 登记 `[[marketplace.sources]]`，通过 `grok plugin marketplace add` → `install --trust` → `enable` 安装。
- **Hermes 全局模式**：将 skills 快照到 `HERMES_HOME/local-plugins/helloagents/`，在 `config.yaml` 的 `skills.external_dirs` 中登记，通过 Hermes 原生技能发现机制加载。
- **doctor 体检**：现在对所有以全局模式安装的宿主进行插件完整性检查（此前仅检查 Cursor）。
- **update 命令**：现在刷新所有全局模式宿主的插件快照（此前仅刷新 Cursor，其他宿主 update 后仍使用旧版本）。

## 新增：Git 克隆安装方式

- **一键安装脚本**（`install.ps1` / `install.sh`）新增 `HELLOAGENTS_SOURCE=git` 支持，通过 `HELLOAGENTS_BRANCH` 指定分支（默认 main），`HELLOAGENTS_GIT_URL` 指定仓库地址。
- **source 追踪**：安装状态（`install.json`）记录安装来源（npm 或 git），`helloagents update` 按来源自动选择同步策略——npm 来源从 npm 全局目录同步，git 来源执行 `git pull` 后再同步。

## 命名体系统一

所有以前使用 `inject` / `plugin` 的地方统一为 `standard` / `global`：

- **CLI 标志**：`--standard` 替代 `--inject`，`--global` 替代 `--plugin`（旧标志仍兼容）。
- **注册表能力名**：`HostCapabilities` 的 `inject` → `standard`，`plugin` → `global`。
- **安装状态模式值**：`install.json` 中宿主模式记录从 `inject`/`plugin` 改为 `standard`/`global`。
- **消息键**：`install.inject.done` → `install.standard.done` 等，全部与新的 CLI 标志名保持一致。
- **help 文本**：CN/EN 两版 help 同步更新，新增 `--lang` 标志文档，`update` 命令支持指定宿主参数。

## Bug 修复

- **`--version` 无法执行**：此前因 flag 解析器将所有 `--` 开头的参数视为标志吞掉，`helloagents --version` 输出 help 而非版本号。现已修复。
- **`update` 命令忽略宿主参数**：此前 `helloagents update claude` 静默刷新全部宿主。现支持指定宿主。
- **Doctor Cursor 插件刷新盲区**：此前 `update` 中 `mode === 'plugin'` 与实际存储值 `'global'` 不匹配，导致 Cursor 插件在 update 时从未刷新。现已统一为 `'global'`。
- **Claude 插件 update 盲区**：此前 `runUpdate` 仅对 Cursor 执行插件刷新，Claude 全局模式用户每次 update 后仍使用旧插件代码。现已覆盖全部宿主。

## 其他

- **Hermes 别名**：新增 `hm` 别名，`helloagents install hm` 等效于 `helloagents install hermes`。
- **Codex 能力补全**：Codex 的 `guard` 能力从 `false` 改为 `true`（Codex 同样支持 hooks，此前遗漏）。
- **`.codex-plugin/` 清单文件**：补全 `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json`、`.cursor-plugin/plugin.json` 三个仓库级清单文件，与 npm 包文件列表对齐。

---
# HelloAGENTS 4.0.3 Release Notes

In one line: full-host dual install modes, Git source support, and naming consistency.

In 4.0.2, only Claude and Cursor supported global mode (native plugin marketplace installation); Codex, Grok, and Hermes were standard-mode only. This release brings global mode to all five hosts, adds Git clone as an installation source, and unifies the internal naming convention.

## New: Global Mode for All Hosts

- **Codex CLI global mode**: builds a `~/plugins/helloagents/` plugin snapshot, writes `~/.agents/plugins/marketplace.json` (local-plugins market index) and `~/.codex/config.toml` enable entry, installs via `codex plugin add helloagents@local-plugins`.
- **Grok Build global mode**: builds `~/.grok/local-marketplaces/helloagents-marketplace/` native local marketplace, registers `[[marketplace.sources]]` in `~/.grok/config.toml`, installs via `grok plugin marketplace add` → `install --trust` → `enable`.
- **Hermes global mode**: snapshots skills to `HERMES_HOME/local-plugins/helloagents/`, registers in `config.yaml` `skills.external_dirs`, loads through Hermes' native skill discovery.
- **doctor checks**: now inspects plugin integrity for all global-mode hosts (previously only Cursor).
- **update command**: now refreshes plugin snapshots for all global-mode hosts (previously only Cursor was refreshed; other hosts kept stale plugin code after update).

## New: Git Clone Installation

- **Bootstrap scripts** (`install.ps1` / `install.sh`): new `HELLOAGENTS_SOURCE=git` support, with `HELLOAGENTS_BRANCH` (default: main) and `HELLOAGENTS_GIT_URL` for the remote URL.
- **Source tracking**: install state (`install.json`) records the source (npm or git). `helloagents update` chooses the sync strategy accordingly — npm sources sync from the global directory, git sources `git pull` first, then sync.

## Naming Convention Unified

All occurrences of `inject` / `plugin` renamed to `standard` / `global`:

- **CLI flags**: `--standard` replaces `--inject`, `--global` replaces `--plugin` (legacy flags still accepted).
- **Registry capabilities**: `HostCapabilities.inject` → `.standard`, `.plugin` → `.global`.
- **Install state mode values**: `install.json` host mode entries changed from `inject`/`plugin` to `standard`/`global`.
- **Message keys**: `install.inject.done` → `install.standard.done`, etc., consistent with the new CLI flag names.
- **help text**: both CN and EN help updated; `--lang` flag documented; `update` command now accepts host arguments.

## Bug Fixes

- **`--version` unreachable**: the flag parser swallowed all `--` prefixed tokens, so `helloagents --version` printed help instead of the version. Fixed.
- **`update` ignored host arguments**: `helloagents update claude` silently updated all hosts. Now accepts scoped targets.
- **Doctor Cursor plugin refresh gap**: `update` compared `mode === 'plugin'` against the stored value `'global'`, so Cursor plugins were never actually refreshed during update. Unified to `'global'`.
- **Claude plugin update gap**: `runUpdate` only refreshed Cursor plugins; Claude global-mode users stayed on stale plugin code after every update. Now covers all hosts.

## Other

- **Hermes alias**: added `hm` alias; `helloagents install hm` is equivalent to `helloagents install hermes`.
- **Codex guard capability**: changed from `false` to `true` (Codex supports hooks, was an oversight).
- **Plugin manifest files**: added `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json` at repo root, aligned with npm package file list.

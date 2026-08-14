# Release Notes — v4.0.5-beta.1

## 简体中文

### 新增与变化

- **新增 DeepSeek Harness（dsh）宿主**：HelloAGENTS 现可安装到 DeepSeek Harness，成为第六个宿主。
  - 标准模式：内核写入 `$DSH_HOME/AGENTS.md`（dsh 原生读取的用户级指令），23 个技能同步到 `$DSH_HOME/skills/hello-*`（dsh 原生技能发现目录），卸载只删除受管技能。
  - 全局模式：本地 bundle 快照安装到 `$DSH_HOME/plugins/helloagents/`，并在 `$DSH_HOME/cordis.patch.yml`（对所有 profile 生效的机器级补丁层）注册插件行；插件把内核注册为系统提示段落、23 个技能注册为运行时技能。
  - npm 包新增 `dsh.bundle` 清单与 `exports` 子路径，支持 `dsh plugin --profile <name> add helloagents@beta` 从 registry 安装。
  - 补丁行入口统一为 `file://` URL：Windows 绝对路径会被 Node ESM 当作 `d:` 协议解析失败，此写法在两种加载路径下均可用。
  - doctor 新增 dsh 专属检查：home 补丁层注册行缺失、原生技能目录缺失。
  - 兼容性验证：dsh `0.1.0-rc.5`（mainline 快照 `7b9644f`，2026-08-14），真实加载启动验证通过。
- **dsh 测试覆盖**：新增 dsh 标准/全局模式、模式切换、补丁层还原等集成测试与 bundle 清单契约测试，测试套件共 65 项全部通过。

### 缺陷修复

- **Codex notify 覆盖外部工具包裹的配置**：此前安装受管 `notify` 行会无条件写入 `config.toml`，覆盖 ChatGPT App 等外部工具包裹的 wrapper 配置。现只要现有 `notify` 行引用了 `helloagents-js` 就视为已覆盖、跳过写入；`addonPresent` 与 doctor 同步把 wrapped 状态视为已启用，消除误报。

---

## English

### New Features & Changes

- **New DeepSeek Harness (dsh) host**: HelloAGENTS can now be installed into DeepSeek Harness as the sixth host.
  - Standard mode: the kernel goes into `$DSH_HOME/AGENTS.md` (dsh's natively read user-global instructions), and the 23 skills are synced into `$DSH_HOME/skills/hello-*` (dsh's native skill discovery directory). Uninstall removes only managed skills.
  - Global mode: a local bundle snapshot is installed to `$DSH_HOME/plugins/helloagents/` and registered in `$DSH_HOME/cordis.patch.yml` — the machine-level patch layer that applies to every profile. The plugin registers the kernel as a system-prompt section and the 23 skills as runtime skills.
  - The npm package now ships a `dsh.bundle` manifest and an `exports` subpath, so the plugin can also be installed from the registry via `dsh plugin --profile <name> add helloagents@beta`.
  - Patch-row entries use `file://` URLs: Node ESM treats Windows absolute paths as a `d:` protocol and fails to load them, whereas the URL form works on both loader paths.
  - doctor gains dsh-specific checks: missing home patch-layer registration and missing native skill directory.
  - Compatibility verified against dsh `0.1.0-rc.5` (mainline snapshot `7b9644f`, 2026-08-14), including a real load-and-boot verification.
- **dsh test coverage**: integration tests for standard/global modes, mode switching, and patch-layer restoration, plus a bundle-manifest contract test; the full 65-test suite passes.

### Bug Fixes

- **Codex notify overwrote externally wrapped config**: installing the managed `notify` line unconditionally overwrote wrapper configs produced by external tools such as the ChatGPT App. When the existing `notify` line already references `helloagents-js`, it is now treated as covered and left untouched; `addonPresent` and doctor likewise treat the wrapped state as enabled, eliminating false "missing" reports.

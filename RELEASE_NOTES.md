# HelloAGENTS v3.1.9 beta

## 中文

### 新增支持

- 新增 Grok Build 双模式支持：standby 写入 `~/.grok/AGENTS.md`、`~/.grok/hooks/helloagents.json` 和运行时链接；global 走原生 marketplace + plugin install 流程，并使用 `~/.helloagents/host-projections/helloagents-grok-marketplace`
- 新增 Cursor 双模式支持：standby 写入 `~/.cursor/hooks.json` 和运行时链接；global 走原生本地插件目录 `~/.cursor/plugins/local/helloagents`

### 修复与强化

- 修复 `helloagents` / `helloagents help` 在渲染 Cursor 卸载路径时的 `home is not defined` 异常
- Cursor global 安装改为把受管插件内容实体化复制到 `~/.cursor/plugins/local/helloagents`，不再依赖指向 `~/.cursor` 之外的符号链接或 junction，降低 Windows 下本地插件识别失败风险
- install / update / cleanup / uninstall / 模式切换 / 分支切换 / doctor / README / 测试 对 Cursor 与 Grok 全链路对齐，标准模式、全局模式、npm 命令和一键脚本路径保持一致

### 变更记录

- `feat` 新增 Grok Build 双模式安装支持
- `feat` 新增 Cursor 双模式安装支持
- `fix` 修复 CLI help 的 Cursor 路径渲染异常
- `fix` Cursor global 改为真实本地插件目录复制，增强 Windows 兼容性
- `test` 补充 CLI help 与 Cursor global 安装目录同步验证

## English

### Added Support

- Added Grok Build dual-mode support: standby writes `~/.grok/AGENTS.md`, `~/.grok/hooks/helloagents.json`, and the runtime link; global uses the native marketplace + plugin-install flow backed by `~/.helloagents/host-projections/helloagents-grok-marketplace`
- Added Cursor dual-mode support: standby writes `~/.cursor/hooks.json` and the runtime link; global uses the native local-plugin directory `~/.cursor/plugins/local/helloagents`

### Fixes and Hardening

- Fixed the `home is not defined` crash in `helloagents` / `helloagents help` when rendering the Cursor uninstall path
- Cursor global install now materializes a real plugin copy into `~/.cursor/plugins/local/helloagents` instead of relying on a symlink or junction that points outside `~/.cursor`, reducing Windows local-plugin detection risk
- Aligned install / update / cleanup / uninstall / mode-switch / branch-switch / doctor / README / tests across the full Cursor and Grok lifecycle so standby mode, global mode, npm commands, and one-shot script paths stay consistent

### Changelog

- `feat` add Grok Build dual-mode installation support
- `feat` add Cursor dual-mode installation support
- `fix` repair the CLI help Cursor path rendering crash
- `fix` switch Cursor global install to a real local-plugin copy for stronger Windows compatibility
- `test` add CLI help coverage and Cursor global install-directory sync validation

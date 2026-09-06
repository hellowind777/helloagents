# Release Notes — v4.0.6-beta.1

## 简体中文

### 缺陷修复

- **Cursor 标准模式钩子为空**：`hooks-cursor.json` 为扁平格式，安装时按设置形态解析导致 `stop` 为空数组。现兼容两种格式，正确写入通知钩子；标准模式增加安装提示。
- **Grok 与 Hermes 基础钩子被附加组件覆盖**：基础条目与附加组件共用同一独立钩子文件，启用附加组件会整体重写文件，停用会直接删除文件，基础条目丢失。现改为合并写入，仅增删附加组件条目，基础条目保持不动。
- **Hermes 卸载残留空配置**：卸载后 `config.yaml` 留下空的 `skills` 与 `external_dirs` 块。现无用户内容时直接删除文件，有用户内容时完整保留用户条目。
- **Codex 市场索引卸载残留**：卸载后 `marketplace.json` 留下空插件列表。现插件为空时直接删除文件。
- **运行副本与 npm 包缺文件**：运行副本补齐 `.codex-plugin`，npm 包补齐 `README.md` 与 `LICENSE.md`；包描述补齐全部六个宿主。
- **空钩子文件残留**：移除受管条目后不再留下空文件，无其他内容时直接删除。
- **帮助与提示**：帮助补齐 Codex 的危险命令拦截支持；更新时的远端拉取提示补齐多语言；一键安装脚本固定为 UTF-8 输出，避免中文路径显示异常。
- **命令路由与安装来源**：短写与全称使用同一解析，未知命令不接管，技能路径统一指向用户级运行副本；安装来源读取修复，Git 来源更新仅允许干净工作区同分支快进。

---

## English

### Bug Fixes

- **Empty Cursor standard hooks**: `hooks-cursor.json` uses the flat format, but the installer parsed it as the settings format and wrote an empty `stop` array. Both formats are now handled and the notify hook is written correctly; standard mode also logs its completion.
- **Grok and Hermes base hooks overwritten by add-ons**: base entries and add-on entries share one standalone hooks file. Enabling an add-on rewrote the whole file and disabling removed it, losing the base entries. Writes are now merged: only add-on entries are added or removed while base entries stay intact.
- **Hermes empty config leftover after uninstall**: an empty `skills` and `external_dirs` block remained in `config.yaml`. The file is now removed when it holds no user content, and user entries are fully kept otherwise.
- **Codex marketplace index leftover after uninstall**: an empty plugin list remained in `marketplace.json`. The file is now removed when no plugins remain.
- **Missing runtime and package files**: the runtime copy now includes `.codex-plugin`, and the npm package now includes `README.md` and `LICENSE.md`; the package description lists all six hosts.
- **Empty hooks files**: removing managed entries no longer leaves empty files behind; files with no remaining content are deleted.
- **Help and prompts**: help now lists Codex for dangerous-command blocking; remote pull prompts during update are localized; the one-click install script pins UTF-8 output to avoid garbled Chinese paths.
- **Command routing and install source**: short and full skill names share one parser, unknown commands are left alone, and skill paths point to the user-level runtime copy; install source reading is fixed and Git updates only fast-forward a clean tree on the same branch.

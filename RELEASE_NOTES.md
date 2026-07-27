# HelloAGENTS 4.0.2 发布说明

一句话：宿主覆盖完整性与工具一致性修复。

4.0.1 引入 Hermes 作为第五个宿主后，几处文档与工具链路未能同步更新。本次发布补全这些遗漏，并修复一处 migrate 与 doctor 行为不一致的问题。

## 新增宿主 Hermes 的文档与工具同步

- **help 文本**：宿主列表、guard 支持列表、notify 支持列表均补上 Hermes（CN/EN 两版）。
- **安装脚本注释**：`install.ps1` 和 `install.sh` 的 `HELLOAGENTS_HOSTS` 说明中补上 `hermes`。
- **migrate 命令**：现在与 doctor 一致地检查并清理 `.hermes/hooks/helloagents.json` 中的 3.x 遗留 hooks（此前只清理 `.grok`，doctor 检测到但 migrate 无法清除）。

## 工具修复

- **doctor**：移除对 `.grok/hooks/helloagents.json` 的重复检查（此前显式检查一次、循环中又检查一次，属冗余代码）。
- **内核提示词**：将 `host自身入口调用示例` 从 Claude Code 特有的 `/hello-plan` 改为通用表述「通过宿主命令触发 hello-plan」，避免对非斜杠宿主的误导。

---
# HelloAGENTS 4.0.2 Release Notes

In one line: host coverage completeness and tool consistency fixes.

After Hermes was added as the fifth host in 4.0.1, several documentation and tool chains weren't updated to match. This release closes those gaps and fixes a migrate/doctor behavior divergence.

## Hermes Documentation and Tool Synchronization

- **Help text**: host list, guard support list, and notify support list now include Hermes (both CN and EN).
- **Install script comments**: `install.ps1` and `install.sh` `HELLOAGENTS_HOSTS` descriptions now mention `hermes`.
- **migrate command**: now checks and cleans `.hermes/hooks/helloagents.json` legacy hooks, matching what doctor already detects (previously only `.grok` was cleaned; doctor spotted them but migrate couldn't remove them).

## Tooling Fixes

- **doctor**: removed duplicate check on `.grok/hooks/helloagents.json` (was checked once explicitly and again in a loop — dead code).
- **Kernel prompt**: changed the host skill entry example from Claude Code-specific `/hello-plan` to the generic "trigger hello-plan through your host command", avoiding confusion for hosts that don't use slash-prefix commands.

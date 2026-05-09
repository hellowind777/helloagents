---
name: ~help
description: 显示 HelloAGENTS 可用命令和当前设置（~help 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~help

## 显示内容

### 可用命令
| 命令 | 说明 |
|------|------|
| ~idea | 轻量点子探索与方向比较 |
| ~auto | 自动执行：自动选主路径并持续推进到执行 / 验证 / 收尾，除非命中真实阻塞 |
| ~plan | 结构化规划：需求澄清 + 方案确认 + 方案包 |
| ~build | 执行实现：按需求或方案包完成实现与验证 |
| ~prd | 完整 PRD：头脑风暴式逐维度挖掘，生成现代产品需求文档 |
| ~loop | 自主迭代优化：设定目标和指标，循环修改-验证-保留/回滚 |
| ~wiki | 仅创建/同步项目知识库（`.helloagents/`） |
| ~init | 完整初始化项目：知识库 + 项目级规则文件配置 |
| ~test | 为指定模块或最近变更编写完整测试 |
| ~verify | 验证总入口：审查 + 运行验证命令 + 修复循环 |
| ~commit | 规范化提交 + 知识库同步 |
| ~clean | 清理临时文件和归档方案包 |
| ~help | 显示此帮助 |

兼容别名：
- `~do` → 等同 `~build`
- `~design` → 等同 `~plan`
- `~review` → 等同 `~verify` 的审查优先模式

### 自动激活技能
以下技能仅在全局模式或已激活项目中自动激活（例如执行过 `~wiki`、`~init`，或已处于项目级连续流程）。
纯标准模式未激活项目不会自动触发这些技能；但涉及 UI 的任务仍受 UI 质量基线约束。

编码时：hello-ui, hello-api, hello-data, hello-security, hello-errors, hello-perf, hello-arch, hello-test
特定场景：hello-debug, hello-subagent, hello-write, hello-review
完成时：hello-verify, hello-reflect

### 当前设置
优先使用当前会话上下文中已注入的“当前用户设置”、该配置文件原始 JSON 或此前读取结果摘要显示；若会话上下文不存在该信息，或缺少下表任一配置项，才读取一次 `~/.helloagents/helloagents.json`，并在后续轮次复用。对 Codex 来说，首次对话前若当前上下文仍缺少这些配置项，或刚经历压缩/恢复后的首次对话，同样先读取一次再继续。
如果当前 CLI 存在工作区限制导致家目录不可读，则明确说明“无法直接读取配置文件，以下按已注入设置或默认值展示”，不要改用无关工具或伪造已读取结果。
| 配置项 | 默认值 | 作用 | 适用 CLI |
|--------|-------|------|---------|
| output_language | "" | 空=跟随用户语言/填写则指定（如 zh-CN、en） | Claude Code + Gemini CLI + Codex CLI |
| output_format | true | true=主代理最终收尾必须使用 HelloAGENTS 格式，流式/中间输出及子代理输出保持自然；false=自然输出 | Claude Code + Gemini CLI + Codex CLI |
| notify_level | 0 | 0=关闭/1=桌面通知/2=声音/3=两者 | Claude Code + Gemini CLI + Codex CLI |
| ralph_loop_enabled | true | 自动验证循环（显式 ~verify / ~loop 或收尾要求时触发 lint/test/build） | Claude Code + Gemini CLI + Codex CLI |
| guard_enabled | true | 阻断危险命令与写入后的安全扫描 | Claude Code + Gemini CLI + Codex CLI |
| kb_create_mode | 1 | 0=关闭/1=已激活项目或全局模式中编码自动/2=已激活项目或全局模式中始终 | Claude Code + Gemini CLI + Codex CLI |
| project_store_mode | "local" | "local"=知识库/方案包保留在项目本地 `.helloagents/`；"repo-shared"=本地 `.helloagents/` 仅保留激活/STATE/运行态，知识库与方案包改写到 `~/.helloagents/projects/<repo-key>/` | Claude Code + Gemini CLI + Codex CLI |
| commit_attribution | "" | 空=不添加/填写内容则添加到 commit message | Claude Code + Gemini CLI + Codex CLI |
| install_mode | "standby" | 当前默认安装模式 | Claude Code + Gemini CLI + Codex CLI |
| host_install_modes | {} | 单 CLI 模式记录，优先于 install_mode | Claude Code + Gemini CLI + Codex CLI |

# 更新日志

## 4.0.5-beta.1（2026-08-14）

新增与变化：

- 新增 DeepSeek Harness（dsh）宿主，成为第六个支持的宿主。标准模式把内核写入 `$DSH_HOME/AGENTS.md` 并把 23 个技能同步到 `$DSH_HOME/skills/hello-*`；全局模式安装本地 bundle 快照到 `$DSH_HOME/plugins/helloagents/` 并在 `$DSH_HOME/cordis.patch.yml` 注册插件行，插件把内核注册为系统提示段落、技能注册为运行时技能
- npm 包新增 `dsh.bundle` 清单与 `exports` 子路径，支持 `dsh plugin --profile <name> add helloagents@beta` 从 registry 安装
- 补丁行入口统一为 `file://` URL，兼容 Windows 下 Node ESM 的绝对路径解析限制
- doctor 新增 dsh 专属检查：home 补丁层注册行、原生技能目录
- 兼容性在 dsh `0.1.0-rc.5`（mainline 快照 `7b9644f`）上验证通过（2026-08-14）
- 新增 dsh 标准/全局模式、模式切换、补丁层还原集成测试与 bundle 清单契约测试，测试套件共 65 项

缺陷修复：

- Codex 安装受管 `notify` 行不再覆盖外部工具（如 ChatGPT App）包裹的 wrapper 配置——现有 `notify` 行只要引用了 `helloagents-js` 即视为已覆盖；`addonPresent` 与 doctor 同步把 wrapped 状态视为已启用，消除误报

## 4.0.4-beta.18（2026-07-29）

缺陷修复：

- 修复 Codex 卸载时受管 `config.toml` 无法清理的问题——`uninstallCodexManagedConfig` 中 `text` 作用域错误导致 `ReferenceError` 被静默吞掉
- 无备份时卸载也会移除受管顶层键；有备份时恢复安装前的用户原值
- 修复 `update` 在全局模式下不刷新 Codex 受管配置与 hooks 信任哈希
- 修复 doctor 在全局模式下跳过软链接、hooks、Codex 受管条目检查
- Codex 仅在 hooks 被显式设为 `false` 时才写入受管 `hooks = true`；doctor 同步调整
- `.codex-plugin/plugin.json` 版本对齐并纳入 `sync-version`
- help 文案与 Cursor 双模式（标准层 hooks/软链接 + 全局插件规则）对齐

## 4.0.4（2026-07-28）

缺陷修复与代码清理。

缺陷修复：

- 修复 Codex 卸载时备份目录不清理的问题——`uninstallCodexManagedConfig` 中变量名 `backupPath` 未定义，`ReferenceError` 被调用方 `catch {}` 静默吞掉
- 修复 `cleanLegacyCodexConfig` 误删当前版本受管 `[hooks.state.*]` 段的问题——现在仅移除无管理标记的旧版段
- 修复 doctor 误报当前 `config.toml` 为 3.x 残留——`helloagents-js` 签名同时存在于新旧版本中
- 从 `LEGACY_COMMAND_SIGNS` 中移除 `helloagents-js`——该可执行文件名在 4.x 中仍然使用，路径级签名足以区分真正的 3.x 残留

代码清理：

- 删除 `codex-toml.mjs`——与 `codex-config.mjs` 功能重叠，生产代码中无任何模块导入
- 删除 `codex-backup.mjs` 的 `readLatestBackup` 导出——全仓库无引用

低层修复：

- `fsx.mjs` 的 `sleepSync`：`Atomics.wait` 在主线程无效，改为忙等循环
- `notify.mjs` 的消息截断改为按 Unicode 码点计数，避免多字节字符被截断

安装脚本：

- `install.ps1` 和 `install.sh` 现实际支持 `HELLOAGENTS_SOURCE=git`
- 脚本标志名从 `--inject`/`--plugin` 更新为 `--standard`/`--global`

## 4.0.3（2026-07-28）

全宿主双重安装模式、Git 源支持与命名体系统一。

新增与变化：

- **全宿主全局模式**：Codex CLI、Grok Build、Hermes 新增全局模式安装（原生插件市场），此前仅 Claude 和 Cursor 支持。
- **Git 克隆安装**：一键安装脚本新增 `HELLOAGENTS_SOURCE=git` 支持，通过 `HELLOAGENTS_BRANCH` 指定分支，来源信息记录到安装状态，`update` 按来源自动选择 npm 或 git pull 同步策略。
- **命名体系统一**：所有 `inject`/`plugin` 重命名为 `standard`/`global`，覆盖 CLI 标志（旧标志仍兼容）、注册表能力名、安装状态模式值、消息键、help 文本。
- **doctor 体检**：新增对所有全局模式宿主的插件完整性检查（此前仅检查 Cursor），update 刷新覆盖全部宿主（此前仅刷新 Cursor）。
- **插件清单文件**：补全 `.codex-plugin/plugin.json`、`.claude-plugin/plugin.json`、`.cursor-plugin/plugin.json` 三个仓库级清单。
- **Hermes 别名**：新增 `hm` 别名；Codex guard 能力从 false 改为 true。

Bug 修复：

- `--version` 无法执行（此前 flag 解析器吞掉 `--version` 导致输出 help）。
- `update` 命令忽略宿主参数（`helloagents update claude` 静默刷新全部宿主）。
- `runUpdate` 中 `mode === 'plugin'` 与实际存储值 `'global'` 不匹配，导致 cursor/claude 插件在 update 时从未刷新。

## 4.0.2（2026-07-27）

宿主覆盖完整性与工具一致性修复。Hermes 在 4.0.1 被引入为第五个宿主，本次将文档与工具链路中遗漏之处补全。

新增与变化：

- **help 文本**：宿主列表、guard/notify 支持列表均补上 Hermes（CN/EN 两版）。
- **安装脚本**：`install.ps1` 和 `install.sh` 的 `HELLOAGENTS_HOSTS` 注释中补上 `hermes`。
- **migrate**：现在检查并清理 `.hermes/hooks/helloagents.json` 中的 3.x 遗留 hooks，与 doctor 行为一致（此前仅清理 `.grok`）。
- **doctor**：移除对 `.grok/hooks/helloagents.json` 的重复检查（此前死代码）。
- **内核提示词**：宿主技能入口示例从 Claude Code 特有写法改为通用表述。

## 4.0.1（2026-07-27）

内核结构化重组与知识库体系完善。

新增与变化：

- 内核：重组为 11 个明确章节——身份与执行底线、思维纠偏（四类偏差自检）、能力调用与动态路由（模式选择表 + 子代理决策框架）、执行纪律与简单优先、验证习惯与信息增益（证伪能力）、中断恢复、安全底线、表达与协作、命令与技能、知识管理、子代理协作。
- 知识库：`helloagents init` 新增 `verify.yaml`（验证命令源）和 `archive/`（已完成方案按月归档）；内核定义 `notes/` 约定（context.md 过厚主题抽出）；新增 `prompts/templates/verify.yaml`；移除 `prompts/templates/STATE.md`。
- 技能：hello-auto 重构为四阶段（分析 → 模式选择 → 执行 → 交付）；hello-qa 验证优先级对接 verify.yaml；hello-eva description 精简。
- 安装：install.ps1 补全错误退出码；install.sh 修复宿主名含空白符的问题。
- Codex：卸载 notify 时若 config.toml 仅剩空行，改为删除文件而非写入空内容。
- 工程：内核行数预算 150→420，hello-eva 预算 200→500（契约测试）；兼容 npm 11 pack 输出格式；中文引号检查改为 Unicode 精确匹配。

清理：

15→- `cleanup-v3-files.ps1`、`evals/` 目录、`helloagents-4.1-refactor.patch` 等早期实验和临时文件。

## 4.0.0（2026-07-26）

定位重构：从“工程治理引擎”转向“思维激活器”。这是不兼容的大版本，从 3.x 升级请先执行 `npx helloagents@4 migrate` 清理旧版本残留。

新增与变化：

- 内核：常驻规则收敛为一份约 200 行的 `prompts/kernel.md`（3.x 为 bootstrap 双文件约 700 行，最高三份并存注入），内容以行为纠偏为主体，包含“简单优先（反过度工程）”、思维纠偏模式、能力调用与动态路由、知识管理纪律等。
- 技能：22 个技能全部按“思维模式”重写（判断框架 + 质量标准 + 交付前自问），去掉审批流程与格式要求；按需读取，不常驻。另收编独立设计的 eva（评估、验证、审计三职能一体的全量审查引擎，~eva 调用，含按需加载的 references 参考文件），合计 23 个技能。
- 安装形态：项目方式（`helloagents init` 写入 AGENTS.md，随仓库分发）、注入方式（用户级规则文件，标记包裹）、插件方式（宿主原生插件或扩展）三种，能力矩阵按宿主如实声明。
- 附加组件：guard（危险命令拦截）与 notify（完成提醒）改为可选安装，与主体解耦；guard 规则改为语义匹配，消除“提交信息含敏感词被拦”“rm 删除单个文件被拦”一类误报。
- 运行时：删除 3.x 的停止闸门、证据文件、turn-state 协议、会话寻址、工作流推荐等治理机制（约 8,700 行）；运行时收敛到约 2,600 行，只负责安装、体检、迁移与两个可选 hook。
- 性能：hook 冷启动实测 44~50 毫秒（3.x 转发路径约 174 毫秒）。
- 工程：新增跨平台 CI（3 系统 × Node 20/22/24）、发布前测试门禁、JSDoc 严格类型检查；npm 包保持零依赖。当前测试套件 55 项。
- 卸载与迁移：`uninstall` 完整还原宿主配置；`migrate` 清理 3.x 写入用户机器的全部内容，无法确认归属的配置保持不动并提示人工确认。

移除：

- bootstrap.md 与 bootstrap-lite.md（由内核取代）。
- 全部 scripts/ 运行时（64 个文件）与 hooks/ 配置目录（hooks 改为按需生成）。
- npm 生命周期钩子（postinstall 等）：安装完全显式，避免包管理器执行隐式脚本。
- `helloagents-js` 与 `helloagents-turn-state` 命令。

## 3.1.9 及更早

见 3.x 分支的历史记录。

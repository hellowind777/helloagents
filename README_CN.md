<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

**AI 编码 CLI 的思维激活层：一份纠偏内核 + 23 个按需加载的思维技能，一条命令分发到 Claude Code、Codex CLI、Grok Build、Cursor、Hermes。**

[English](./README.md) · [简体中文](./README_CN.md) · [更新日志](./CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933.svg)](./package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)

> 4.0 是不兼容的大版本。从 3.x 升级请先执行 `npx helloagents@4 migrate`；旧版说明见 3.x 分支。

## 为什么需要 HelloAGENTS

AI 编码工具的模型已经很强，但一些行为习惯仍然拖后腿：停在建议不动手、遇到困难推荐「别的工具」、没做完就说做完、下意识堆抽象层和流程文档来证明自己没错。

| 没有 HelloAGENTS | 有 HelloAGENTS |
|---|---|
| 模型停在「你可以试试……」然后等你决定 | 模型直接行动：它知道自己的任务是交付，不是提建议 |
| 遇到难题就说「我可能不是做这个的合适工具」 | 模型切换策略、换条路继续试，确实走不通才停下 |
| 代码写完就说完成，没跑过验证 | 模型自己跑真实验证命令，把原始输出贴出来 |
| 每个任务都要先写设计文档、方案、三份 README 草稿 | 模型把投入匹配到问题规模上，不搞形式主义 |

HelloAGENTS 做三件事：

1. **纠偏**：一份内核常驻宿主规则文件，按明确章节组织——涵盖身份与执行底线、思维纠偏模式、能力调用与动态路由、执行纪律、验证习惯、中断恢复、知识管理、安全底线等。
2. **激活**：23 个思维技能（方案、实现、需求探索、质量自检、全量审查、界面、调试、安全等）按需读取，提供对应场景下的判断框架与质量标准，不是审批清单。
3. **分发**：把这套内容可靠地安装进五个宿主、三种形态，安装、更新、体检、卸载、迁移全部一条命令，卸载即完整还原。

它不做什么：不做流程管理，不做状态机，不写脚本替模型评估、验证、审计——验证是激活出来的模型习惯（自己跑真实命令、贴原始输出），不是被脚本拦截的对象。

## 快速开始

```bash
# 安装到全部宿主（每个宿主自动选择最合适的方式）
npx helloagents@latest install --all

# 或只安装到指定宿主
npx helloagents@latest install claude codex

# 体检
npx helloagents doctor
```

安装完成后，像平时一样跟宿主对话即可。想直接进入特定工作方式，用「~命令」：

```
~plan 给账单模块加一个导出功能     # 先出方案，确认后再实现
~auto 修复这个报错                 # 完全交给模型，持续跑到完成
~qa                               # 对刚完成的工作做质量自检
~eva 审查这个项目                  # 对任意目标做评估、验证、审计
```

团队场景推荐项目方式：在项目根目录执行 `npx helloagents init`，内核写入 `AGENTS.md`（跨工具通用规则载体，已被数千个仓库采用），随仓库分发给整个团队。

## 命令

| 命令 | 说明 |
|---|---|
| `install <宿主…\|--all> [--inject\|--plugin]` | 安装（默认优先插件方式，其次注入方式） |
| `uninstall <宿主…\|--all> [--purge]` | 卸载并还原宿主配置；`--purge` 同时删除 `~/.helloagents` |
| `update` | 刷新运行副本并同步全部已安装宿主 |
| `init` | 项目方式：写入 `./AGENTS.md` 内核并建立 `.helloagents/` 知识库 |
| `doctor [--json]` | 体检安装状态，识别 3.x 残留 |
| `migrate` | 清理 3.x 版本写入用户机器的全部残留 |
| `guard on\|off [宿主…]` | 附加组件：危险命令拦截 |
| `notify on\|off [宿主…]` | 附加组件：回合结束与等待确认时提醒 |

可用环境变量 `HELLOAGENTS_LANG=cn\|en` 指定语言；默认跟随系统。

## 安装方式与宿主矩阵

三种方式可以叠加（宿主一般遵循「就近规则文件生效」）：

- **项目方式**：内核写入项目的 `AGENTS.md`，随 git 分发，团队保持一致，不碰用户全局配置。
- **注入方式**：内核写入宿主的用户级规则文件，包裹在 `<!-- HELLOAGENTS_START/END -->` 标记内；标记外的用户内容永不改动，卸载时完整还原。
- **插件方式**：通过宿主自带的插件或扩展机制安装，由宿主原生管理更新。

| 宿主 | 注入方式 | 插件方式 | guard | notify |
|---|---|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | 插件市场（自动注册本地市场） | 是 | 是 |
| Codex CLI | `~/.codex/AGENTS.md` | —（无插件系统） | — | 是（config.toml 受管行） |
| Grok Build | `~/.grok/AGENTS.md` | — | 是 | 是 |
| Cursor | —（无全局规则文件） | `~/.cursor/plugins/local/helloagents`（内核以规则下发） | 是 | 是 |
| Hermes | `~/.hermes/AGENTS.md` | — | 是 | 是 |

「—」表示宿主暂不具备该机制，如实降级，不做模拟层。

Cursor 只支持插件方式有明确原因：它没有全局规则文件，`~/.cursor/rules/` 不被支持——Cursor 团队已确认规则解析从工作区向上遍历，永远不会到达家目录。因此内核随插件以 `rules/helloagents-kernel.mdc` 下发，设置 `alwaysApply: true` 且刻意**不写** `description`（Cursor 目前已知缺陷是二者同时存在时，规则会被降级为「按需取用」而不是始终生效）。插件目录只放 Cursor 读取的内容——清单、技能、规则；HelloAGENTS CLI 本身不放入。安装后在 Cursor 中执行 **Developer: Reload Window** 重载窗口。

Gemini CLI 不再是支持的宿主。如果你之前在那里安装过，执行 `npx helloagents migrate` 清理 `~/.gemini/GEMINI.md` 中的受管块并删除安装记录，再手动执行 `gemini extensions uninstall helloagents` 移除扩展。

## 技能一览

全部 23 个技能带 `hello-` 前缀。技能名在宿主内是全局的：Cursor 的技能命名空间是扁平的，插件、用户和项目技能之间没有去重、没有已文档化的优先级；Claude Code 虽然把插件技能命名为 `helloagents:…`，但同名技能仍然会干扰模型选择。前缀保证了 HelloAGENTS 不会与你自己命名的 `build`、`commit`、`plan` 等技能冲突。

**命令技能**：hello-plan（方案思维）、hello-build（实现纪律）、hello-auto（自主推进）、hello-prd（需求探索）、hello-qa（质量自检——对自己刚完成的工作）、hello-eva（智能全量审查——对任意目标做评估、验证、审计，可单职能或三者合一，附按需加载的参考文件）、hello-ask（只讨论不动手）、hello-init（初始化项目知识库）、hello-commit（规范化提交）、hello-clean（清理临时产物）、hello-help（查看可用能力）。

**质量技能**（按任务类型自动关联）：hello-ui（界面）、hello-test（测试）、hello-security（安全）、hello-debug（调试）、hello-arch（架构）、hello-api（接口）、hello-data（数据）、hello-perf（性能）、hello-errors（错误处理）、hello-write（技术写作）、hello-reflect（回顾反思）、hello-subagent（子代理协作）。

`~命令` 保持简短——`~plan` 与 `~hello-plan` 等效。在宿主自带的技能入口使用正式名称，例如 Claude Code 中 `/hello-plan`。

每个技能 30–70 行，结构统一：此时该怎么想 → 什么才算完成 → 交付前自问。启动时只有名称和一行描述进入上下文，正文只在实际使用时读取。

## 附加组件

两个附加组件均为可选，与核心解耦：

- **guard**：在工具执行前拦截一组高风险操作（大范围 rm -rf、强推主分支、DROP DATABASE、chmod 777 等），规则清单与内核保持一致；匹配基于命令结构做语义判断，提交信息中的敏感词不会触发误报。自身运行异常时宁可误拦，不可静默放行。
- **notify**：回合结束和等待确认时播放声音、发送桌面通知。纯体验组件；Windows 端通知走编码安全通道，中文路径和文案不会出现乱码。

## 项目知识库

`helloagents init` 在项目中建立 `.helloagents/`：`context.md`（项目事实）、`guidelines.md`（编码约定）、`DESIGN.md`（设计系统，界面项目需要时创建）、`verify.yaml`（验证命令）、`plans/`（方案文档）、`archive/`（已完成方案按月归档）。内核还定义了 `notes/` 约定，context.md 中某主题积累过厚时抽出。一条原则：只记代码里看不出来的内容；不创建空文件，不填充模板套话。

## 一键安装脚本

```bash
# Windows（PowerShell）
irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | sh
```

环境变量：`HELLOAGENTS_HOSTS`（逗号分隔，默认 `all`）、`HELLOAGENTS_METHOD`（`inject` 或 `plugin`）、`HELLOAGENTS_VERSION`（npm 标签，默认 `latest`）。

## 从 3.x 迁移

```bash
npx helloagents@4 migrate       # 清理 3.x 的载体注入、hooks、受管 config.toml 行与运行目录
npx helloagents@4 install --all
```

migrate 只清理能明确识别为 3.x 产物的内容；无法确认归属的配置（比如说你自己包装的 notify 命令）保持不动并提示人工确认。3.x 的停止闸门、证据文件、turn-state 协议和会话状态目录在 4.0 中没有对应物，相关命令已移除。

## 常见问题

**4.0 为什么去掉了强制验证闸门？** 三条证据指向同一结论：模型自报的证据没有证明力；官方最佳实践倾向「展示真实测试输出」而非流程审批；宿主已内置持续验证和代码审查能力（确实需要执行层面强制时，优先使用宿主原生功能）。4.0 把验证转变为内核习惯加上 hello-qa 技能——模型自己跑命令、贴输出。

**安装过程会执行隐式脚本吗？** 不会。4.0 去除了所有 npm 生命周期钩子；在明确执行 `helloagents install` 之前不写入任何内容，doctor 可随时审查全部写入。

**零依赖是什么意思？** npm 包没有任何运行时或开发依赖，也不需要构建步骤——`npx` 拉下来就能跑；对宿主的每一处写入都带有标记或管理标签，卸载即完整还原。

**Windows 支持如何？** 完整支持：统一路径处理、文件锁定自动退避重试、通知走编码安全通道、CI 在 Windows 上运行完整测试套件。

## 许可证

采用 [Apache-2.0](./LICENSE.md) 授权。

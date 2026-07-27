<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

**AI 编码 CLI 的思维激活层：一份纠偏内核 + 23 个按需加载的思维技能，一条命令分发到 Claude Code、Codex CLI、Grok Build、Cursor。**

[English](./README.md) · 简体中文

[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933.svg)](./package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)

> 4.0 是不兼容的大版本。从 3.x 升级请先执行 `npx helloagents@4 migrate`；旧版说明见 3.x 分支。

## 它做什么

AI 编码工具的模型已经很强，但一些行为习惯仍然拖后腿：停在建议不动手、遇到困难推荐“别的工具”、没做完就说做完、下意识堆抽象层和流程文档来证明自己没错。HelloAGENTS 做三件事：

1. **纠偏**：一份 85 行的内核常驻宿主规则文件，矫正上述习惯——包括一节明确的“简单优先（反过度工程）”。
2. **激活**：23 个思维技能（方案、实现、需求探索、质量自检、全量审查、界面、调试、安全……）按需读取，提供该场景下的判断框架与质量标准，不是审批清单。
3. **分发**：把这套内容可靠地安装进四个宿主的三种形态，安装、更新、体检、卸载、迁移全部一条命令，卸载即完整还原。

它不做什么：不做流程管理，不做状态机，不写脚本替模型评估、验证、审计——验证是激活出来的模型习惯（自己跑真实命令、贴原始输出），不是被脚本拦截的对象。

## 三分钟上手

```bash
# 安装到全部宿主（每个宿主自动选择最合适的方式）
npx helloagents@latest install --all

# 或只装某几个
npx helloagents@latest install claude codex

# 体检
npx helloagents doctor
```

装完后直接在宿主里对话即可。想快速进入某种工作方式，用「~命令」：

```
~plan 给结算模块加一个导出功能      # 先出方案，确认后再动手
~auto 把这个报错修掉               # 全权交给模型，持续执行到完成
~qa                               # 对刚完成的工作运行验证并自检
~eva 审一下这个项目               # 对任意对象做评估、验证、审计一体的全量审查
```

团队使用推荐项目方式：在项目根目录执行 `npx helloagents init`，内核写入 `AGENTS.md`（60,000+ 仓库采用的通用规则载体，约 30 个工具直接读取），随代码仓库分发给全组。

## 命令

| 命令 | 说明 |
|---|---|
| `install <宿主…\|--all> [--inject\|--plugin]` | 安装。默认优先插件方式，其次注入方式 |
| `uninstall <宿主…\|--all> [--purge]` | 卸载并还原宿主配置；`--purge` 连同 `~/.helloagents` 一起删除 |
| `update` | 刷新运行副本并同步全部已安装宿主 |
| `init` | 项目方式：写入 `./AGENTS.md` 并建立 `.helloagents/` 知识库 |
| `doctor [--json]` | 体检：对照安装记录检查落盘状态，识别 3.x 残留 |
| `migrate` | 清理 3.x 写入用户机器的全部内容 |
| `guard on\|off [宿主…]` | 可选组件：危险命令拦截 |
| `notify on\|off [宿主…]` | 可选组件：回合结束与等待确认的提醒 |

语言用 `HELLOAGENTS_LANG=cn|en` 指定，默认跟随系统区域设置。

## 安装形态与宿主矩阵

三种形态可以叠加（宿主一般遵循“最近的规则文件生效”）：

- **项目方式**：内核写入项目 `AGENTS.md`，随 git 分发，团队一致，不碰用户全局配置。
- **注入方式**：内核写入宿主的用户级规则文件，包裹在 `<!-- HELLOAGENTS_START/END -->` 标记里；标记外的内容永不改动，卸载即还原。
- **插件方式**：使用宿主自带的插件或扩展机制安装，享受宿主原生的管理与更新。

| 宿主 | 注入方式 | 插件方式 | guard | notify |
|---|---|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | 插件市场（自动注册本地市场） | 支持 | 支持 |
| Codex CLI | `~/.codex/AGENTS.md` | —（无插件体系） | — | 支持（config.toml 受管行） |
| Grok Build | `~/.grok/AGENTS.md` | — | 支持 | 支持 |
| Cursor | —（无全局规则文件） | `~/.cursor/plugins/local/helloagents`（内核以 rules 下发） | 支持 | 支持 |

表中的“—”表示宿主暂不具备对应机制，我们如实降级，不做模拟层。

Cursor 只有插件这一条路：它没有全局规则文件——`~/.cursor/rules/` 不被支持，官方在论坛上明确说过规则解析只从工作区向上查找，不会读到主目录。所以内核随插件以 `rules/helloagents-kernel.mdc` 下发（`alwaysApply: true` 且刻意不写 `description`，因为 Cursor 目前有已知缺陷：两者同时存在时规则会被降级成“按需取用”）。插件目录里只有 Cursor 认识的三样东西——清单、技能、规则；`helloagents` 的 CLI 本体不进去。安装后需要在 Cursor 里执行 **Developer: Reload Window** 才生效。

Gemini CLI 已不再是支持的宿主。之前装过的用户执行 `npx helloagents migrate`，它会移除 `~/.gemini/GEMINI.md` 里的受管块并清掉安装记录；扩展本体需要自己执行一次 `gemini extensions uninstall helloagents`。

## 技能一览

全部 23 个技能的正式名称都带 `hello-` 前缀。技能名在宿主里是全局的：Cursor 的技能命名空间是扁平的、同名不去重也没有优先级规则，Claude Code 虽然给插件技能加了 `helloagents:` 前缀，但同名技能仍会让模型在选择时犯迷糊。前缀是为了不和你自己的 `build`、`commit`、`plan` 撞车。

命令技能：hello-plan（方案）、hello-build（实现）、hello-auto（自主推进）、hello-prd（需求探索）、hello-qa（质量自检，对象是刚完成的工作）、hello-eva（对任意内容交付全量评估、全量验证、全量审计或三者合一，附按需加载的参考文件）、hello-ask（只讨论）、hello-init（初始化）、hello-commit（提交）、hello-clean（清理）、hello-help（帮助）。

质量技能（按任务类型自动相关）：hello-ui（界面）、hello-test（测试）、hello-security（安全）、hello-debug（排障）、hello-arch（结构）、hello-api（接口）、hello-data（数据）、hello-perf（性能）、hello-errors（错误处理）、hello-write（技术写作）、hello-reflect（复盘）、hello-subagent（子代理协作）。

「~命令」保持短写，`~plan` 与 `~hello-plan` 等价；用宿主自己的技能入口时按正式名称调用，例如 Claude Code 里的 `/hello-plan`。

常规技能 30 行左右，结构统一：此刻该怎么想 → 好的标准 → 交付前自问；hello-eva 为完整的审查引擎，正文之外的细则放在 references 参考文件中按需加载。启动时只有名称与一句话描述进入上下文，正文用到才读取。

## 附加组件

两个组件都是可选的，与主体解耦：

- **guard**：在命令执行前拦截少量高危操作（rm -rf 全量、强推 main、DROP DATABASE、chmod 777 等），规则与内核里的清单同源；匹配按命令结构做语义判断，提交信息里出现敏感词不会误拦。运行异常时选择拦截而不是静默放行。
- **notify**：回合结束与等待确认时播放提示音、发送桌面通知。纯体验组件；Windows 通知走编码安全的通道，中文路径与文案不会乱码。

## 项目知识库

`helloagents init` 在项目里建立 `.helloagents/`：`context.md`（项目事实）、`guidelines.md`（约定）、`DESIGN.md`（设计系统，界面项目用）、`plans/`（方案文档）。原则只有一条：只记录从代码里看不出来的东西；空文件不创建，套话不填。

## 从 3.x 迁移

```bash
npx helloagents@4 migrate       # 清理 3.x 的载体注入、hooks、config.toml 受管行、运行目录
npx helloagents@4 install --all
```

migrate 只清理能明确识别为 3.x 产物的内容；无法确认归属的配置（例如你自己包装过的 notify 命令）保持不动并提示人工确认。3.x 的停止闸门、证据文件、turn-state 协议、会话状态目录在 4.0 中不存在对应物，相关命令已移除。

## 常见问题

**为什么 4.0 删掉了强制验证闸门？** 三方面证据一致：模型的自述式证据没有证明力；官方最佳实践的方向是“展示真实测试输出”而不是流程审批；宿主已内置持续验证与代码审查能力（需要强制时优先使用宿主原生功能）。4.0 把验证写成内核里的习惯与 hello-qa 技能，让模型自己跑命令、贴输出。

**安装会执行隐式脚本吗？** 不会。4.0 移除了全部 npm 生命周期钩子，任何写入都发生在你显式执行 `helloagents install` 之时，doctor 可以完整核对。

**零依赖是指什么？** npm 包没有任何运行时依赖与开发依赖，没有构建步骤，`npx` 拉取即用；写入宿主的每一处都有标记或受管标识，卸载可完整还原。

**Windows 支持如何？** 一等公民：路径统一处理、文件占用自动重试、通知走编码安全通道，CI 在 Windows 上运行全部测试。

## 许可证

[Apache-2.0](./LICENSE.md)

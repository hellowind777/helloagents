# 更新日志

## 未发布

不兼容变更：技能全部改名、Gemini CLI 不再受支持。「~命令」的短写不变，升级后照常使用。

- 技能命名：11 个通用名技能（ask、auto、build、clean、commit、eva、help、init、plan、prd、qa）改为 `hello-` 前缀，与既有的 12 个质量技能统一，23 个技能全部带前缀。原因是技能名在宿主里是全局的：Cursor 的技能命名空间扁平、同名不去重也无优先级规则（官方插件仓库为此手工改过重名技能），Gemini CLI 的扩展层优先级低于用户与工作区，会被静默覆盖。「~命令」保持短写，`~plan` 与 `~hello-plan` 等价；宿主自身的技能入口按正式名称调用（如 `/hello-plan`）。
- Cursor 提升为一等宿主：内核此前完全没有下发到 Cursor，现在随插件以 `rules/helloagents-kernel.mdc` 下发（`alwaysApply: true`，刻意不写 `description` 以规避 Cursor 已知的规则降级缺陷）。插件目录不再是运行副本的整体复制，只包含 Cursor 认识的清单、技能与规则；`doctor` 增加规则文件缺失（`plugin-rule-missing`）与插件版本过期（`plugin-outdated`）两项检查。注入方式对 Cursor 仍然不可用——`~/.cursor/rules/` 不是受支持的机制，官方明确规则解析不会查到主目录，这里如实降级而不是写一个不生效的文件。
- 移除 Gemini CLI 支持：宿主注册表、扩展安装/卸载、`gemini-extension.json`、清单版本同步与运行副本条目全部删除。已安装的用户执行 `helloagents migrate` 可移除 `~/.gemini/GEMINI.md` 中的受管块并清掉安装记录，扩展本体需手动执行 `gemini extensions uninstall helloagents`；`doctor` 会把这些残留列出来。

## 4.0.0（2026-07-26）

定位重构：从“工程治理引擎”转向“思维激活器”。这是不兼容的大版本，从 3.x 升级请先执行 `npx helloagents@4 migrate` 清理旧版本残留。

新增与变化：

- 内核：常驻规则收敛为一份 83 行的 `prompts/kernel.md`（3.x 为 bootstrap 双文件约 700 行，最高三份并存注入），内容以行为纠偏为主体，新增“简单优先（反过度工程）”一节。
- 技能：22 个技能全部按“思维模式”重写（判断框架 + 质量标准 + 交付前自问），去掉审批流程与格式要求；按需读取，不常驻。另收编独立设计的 eva（评估、验证、审计三职能一体的全量审查引擎，~eva 调用，含按需加载的 references 参考文件），合计 23 个技能。
- 安装形态：项目方式（`helloagents init` 写入 AGENTS.md，随仓库分发）、注入方式（用户级规则文件，标记包裹）、插件方式（宿主原生插件或扩展）三种，能力矩阵按宿主如实声明。
- 附加组件：guard（危险命令拦截）与 notify（完成提醒）改为可选安装，与主体解耦；guard 规则改为语义匹配，消除“提交信息含敏感词被拦”“rm 删除单个文件被拦”一类误报。
- 运行时：删除 3.x 的停止闸门、证据文件、turn-state 协议、会话寻址、工作流推荐等治理机制（约 8,700 行）；运行时收敛到约 2,600 行，只负责安装、体检、迁移与两个可选 hook。
- 性能：hook 冷启动实测 44~50 毫秒（3.x 转发路径约 174 毫秒）。
- 工程：新增跨平台 CI（3 系统 × Node 20/22/24）、发布前测试门禁、JSDoc 严格类型检查；npm 包保持零依赖。
- 卸载与迁移：`uninstall` 完整还原宿主配置；`migrate` 清理 3.x 写入用户机器的全部内容，无法确认归属的配置保持不动并提示人工确认。

移除：

- bootstrap.md 与 bootstrap-lite.md（由内核取代）。
- 全部 scripts/ 运行时（64 个文件）与 hooks/ 配置目录（hooks 改为按需生成）。
- npm 生命周期钩子（postinstall 等）：安装完全显式，避免包管理器执行隐式脚本。
- `helloagents-js` 与 `helloagents-turn-state` 命令。

## 3.1.9 及更早

见 3.x 分支的历史记录。

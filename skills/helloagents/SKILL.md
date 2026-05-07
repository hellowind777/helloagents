---
name: helloagents
description: 按任务类型适用 — 建立质量驱动工作流，通过技能标准、流程纪律和检查清单保障交付质量
---

# HelloAGENTS

主代理触发或读取任意 skill 时，只有本轮最终收尾消息才按通用输出格式包装；流式内容、进度或状态汇报、中间文本，以及任何仍将继续执行的文本，都保持自然输出。最终收尾中的 `🔄 下一步` 写真实动作，不写当前状态；等待用户授权时使用等待输入态收尾，已获授权且可继续执行时不得收尾。同一条最终收尾消息只包装一次；若需要分段，在同一个外层块内展开，不在正文里再次输出 `【HelloAGENTS】` 或第二个 `🔄 下一步`。
子代理只豁免路由与收尾要求，直接执行任务；安全、质量、验证和失败处理规则仍持续生效，且不得包装 HelloAGENTS 外层输出格式。
只有运行时必须识别本轮“完成 / 等待输入 / 阻塞”时，主代理才写 turn-state；普通问候、普通问答、T0 只读分析和一次性解释不调用。必须调用场景：显式 `~auto` / `~loop`、非只读任务完成验证并进入收尾、需要 delivery gate / Ralph Loop / closeout evidence、需要等待或阻塞且运行时必须识别状态、已进入项目连续流程或方案包闭环。首选 `helloagents-turn-state write --kind complete --role main`；等待或阻塞时写 `kind=waiting` / `kind=blocked`，并同时写 `reasonCategory` 与 `reason`。显式 `~auto` / `~loop` 下，还必须写入 `blocker.target`、`blocker.evidence`、`blocker.requiredAction`。不要查找、读取或拼接 `turn-state.mjs` 源码路径。子代理不得写 turn-state。

`.helloagents/` 在所有 skill 中都统一按项目级存储路径理解：项目本地 `.helloagents/` 继续承担激活信号和会话运行态；状态文件只使用 `state_path`（实际位于 `sessions/{workspace}/{session}/STATE.md`）；会话证据使用当前 `state_path` 所在目录下的 `artifacts/*.json`；`sessions/active.json` 只作为当前活跃会话索引；若 `project_store_mode=repo-shared`，`context.md`、`guidelines.md`、`DESIGN.md`、`verify.yaml`、`modules/`、`plans/`、`archive/` 按当前上下文中已注入的“当前项目存储”/“项目知识/方案目录”解析，不要假定这些文件一定实际位于当前工作树中。

## 三重质量保障

以下三重机制按任务类型适用；一旦当前任务进入对应阶段，对应机制就是强制要求，不可跳过或弱化。普通问候、普通问答、T0 只读分析和一次性解释不进入完整实现、验证或收尾流程。

### 质量标准
每个 hello-* 技能的规范都是当前任务进入对应场景后的执行标准。
技能被激活时，逐条落实；未满足时先修复再交付。

### 流程纪律（执行时）
- 执行 command skill 时，公共阶段边界以当前已加载的 HelloAGENTS 规则为准；command skill 只补充该命令的专属动作和边界
- 统一执行流程的六个阶段（ROUTE/TIER→SPEC→PLAN→BUILD→VERIFY→CONSOLIDATE）按当前 Delivery Tier 和实际任务推进；未进入的阶段不强行补齐，已进入的阶段不可跳过
- 所有 UI 任务先受当前已加载的 HelloAGENTS UI 质量基线约束；已激活项目、全局模式或显式 UI 工作流中的设计约束优先级固定为：当前 `plan.md` / PRD UI 决策 → `.helloagents/DESIGN.md`（按当前项目存储模式解析） → `hello-ui` 具体 UI 审美与实现规则，并与 UI 质量基线共同生效
- 方案包存在 `contract.json` 时，验证分流、reviewer / tester 关注边界、可选 style advisor / visual validation 与交付检查优先按它执行，不再从自然语言总结里回推
- 因阻塞判定而必须等待用户输入时，按当前已加载的 HelloAGENTS 规则处理，不得把等待输入包装成完成态
- ~plan 的需求澄清与方案确认不可跳过，不可一个问题就出方案
- ~prd 的维度探索不可跳过，每个激活维度必须经过讨论或用户明确跳过
- ~auto 的复杂度判断不可省略
- hello-verify 的验证铁律：没有运行验证 = 不能说完成

### 检查清单把关（完成时）
任务完成后，必须执行以下检查流程（详见 hello-verify）：
1. 运行验证命令（lint/test/build）→ 循环直到通过
2. 收集所有已激活技能的交付检查清单
3. 逐项验证。仅在交付检查清单、验收记录和验证结果中使用 [√] / [-] 标记，并附带证据；普通说明、方案解释、状态汇报不用这些标记
4. 有未通过项 → 修复后重新检查
5. 全部通过 → 才能报告完成

未完成检查时不得报告完成。

## 技能加载规则（渐进式披露）

技能分三层加载，严格按需，不提前读取：

Layer 1 — 元数据（启动时已知，不需要读取文件）：
仅凭下方列表中的名称和描述判断技能是否可能相关。

Layer 2 — 完整技能（进入对应阶段时读取 SKILL.md）：
当任务进入某个阶段且该阶段需要某技能的规范时，才读取该技能的 SKILL.md。

Layer 3 — 资源文件（技能内引用时读取）：
技能 SKILL.md 中引用的 templates/、modules/*.md 等文件，仅在技能明确要求时读取。

禁止行为：
- 禁止在 ROUTE / TIER / SPEC 阶段读取实现类技能（hello-ui/hello-test/hello-verify 等）
- 禁止因为"可能用到"就提前读取技能文件——等到真正需要时再读
- 同一会话内，同一路径的配置文件、模块、SKILL、模板只读一次并跨轮复用；缺少所需内容、读取失败、用户要求刷新或本轮修改后才重新读取
- ~command 命令只读取对应的 command SKILL.md，不连带读取其他技能

## 技能查找路径

读取其他技能时，按以下路径查找，找到即停，不自行猜测或遍历其他路径。

路径定义：`{HELLOAGENTS_READ_ROOT}` = 本轮已确定的 HelloAGENTS 读取根目录，统一用于读取 `skills/` 与 `templates/`
先确定当前技能根目录：
- 优先使用当前上下文中已注入的“本轮 HelloAGENTS 读取根目录”
- 若当前上下文未注入，则使用稳定运行根目录 `~/.helloagents/helloagents`
- 宿主固定链接（Codex `~/.codex/helloagents`、Claude `~/.claude/helloagents`、Gemini `~/.gemini/helloagents`）只作为兼容别名，不作为优先探测路径
- 仍无法确定时，明确说明缺少 HelloAGENTS 读取根目录；不要递归扫描 `$HOME`、`Downloads`、项目目录或旧版本目录
- 已激活项目或全局模式下，技能是否需要使用由当前已加载 AGENTS 规则决定；不要因此额外探测项目目录里的 HelloAGENTS skills 路径

### hello-* 技能
读取 `{HELLOAGENTS_READ_ROOT}/skills/{技能名}/SKILL.md`

### 包内脚本
优先使用稳定命令入口；需要写收尾状态时优先调用 `helloagents-turn-state write --kind complete --role main`，不要拼接 `turn-state.mjs` 路径。

### ~command 命令技能
若当前上下文已解析出具体命令技能文件路径，直接使用它；否则读取 `{HELLOAGENTS_READ_ROOT}/skills/commands/{name}/SKILL.md`
确定路径后立即停止，不要重复读取同一命令 skill。

## 技能索引（仅元数据）

### 编码时（BUILD 阶段按需读取）
- hello-ui — 深层 UI 规划/实现/验收时
- hello-api — 构建/修改 API 时
- hello-data — 数据库/迁移/事务时
- hello-security — 涉及认证/密钥/权限时
- hello-errors — 错误处理/日志/重试时
- hello-perf — 性能优化/查询/缓存时
- hello-arch — 重构/架构决策时
- hello-test — 编写测试时（TDD：BUILD 开始时读取）

### 特定场景（触发时读取）
- hello-debug — 调试错误/修复 bug/排查失败时
- hello-subagent — 使用子代理执行任务时
- hello-write — 撰写文档/报告/方案等非编码文本时
- hello-review — 审查代码/检查变更时

### 完成时（VERIFY / CONSOLIDATE 阶段读取）
- hello-verify — 声称完成前（必定读取）
- hello-reflect — 符合触发条件时（详见 hello-reflect SKILL.md）

## 命令路由

用户使用 `~command` 时，只读取对应的 command skill，路径按上方“~command 命令技能”规则查找：
- `~auto`
- `~idea`
- `~plan`
- `~build`
- `~prd`
- `~loop`
- `~wiki`
- `~init`
- `~test`
- `~verify`
- `~commit`
- `~clean`
- `~help`

兼容别名：
- `~do` → 直接按 `~build` 的 command skill 路径读取并执行
- `~design` → 直接按 `~plan` 的 command skill 路径读取并执行
- `~review` → 直接按 `~verify` 的 command skill 路径读取并执行

只有当对应 command skill 明确要求再读取 hello-* 技能时，才按上方“hello-* 技能”规则继续读取。

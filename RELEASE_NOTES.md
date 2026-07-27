# HelloAGENTS 4.0.1 发布说明

一句话：内核结构化重组，知识库体系成型。

4.0 发布后一周内修复和强化的事项：

## 内核：从散列条目到结构化章节

4.0 的内核是一份扁平列表，靠序号和标题区分主题。4.0.1 将其重组为明确分节的结构，新增以下完整章节：

- **思维纠偏**：在行动前快速自检四类偏差（问题理解、判断、行动、协作），每条用一句话说清「偏差表现 → 纠正动作」。
- **能力调用与动态路由**：定义了初始模式选择表（任务特征 → 推荐模式 + 对应技能），以及执行中动态切换的信号和原则；补充了工具与子代理的调用决策框架（信息增益驱动、并行条件、停止条件）。
- **验证习惯与信息增益**：明确了证伪能力——判定「通过」之前必须确认「如果这条承诺不成立，本次观察会不会呈现不同结果」；补充了信息增益导向的验证优先级。
- **中断恢复**：强调代码是唯一事实来源，基于 git status 和代码内容重建上下文，不依赖临时进度文件。
- **知识管理**：定义了 `.helloagents/` 的完整结构（新增 `verify.yaml`、`notes/`、`archive/`），以及写入纪律（重查、封顶、去重、过期清理）和不写入的内容清单。

## 知识库扩展

- `helloagents init` 现在创建 `verify.yaml`（验证命令，可附带预期通过条件）和 `archive/`（已完成方案按月归档）。
- 新增 `prompts/templates/verify.yaml` 示例模板。
- 内核中定义了 `notes/` 约定：context.md 中某主题积累超过合理长度时，抽出为 `notes/{主题}.md`，context.md 中只留一行索引。
- 移除不再使用的 `prompts/templates/STATE.md`。

## 技能改进

- **hello-auto**：重构为四阶段（分析 → 模式选择 → 连续执行 → 交付），每个阶段有明确的判断依据和切换信号。
- **hello-qa**：验证命令优先级改为 `.helloagents/verify.yaml` → 项目脚本 → 项目文档。
- **hello-eva**：description 精简，去掉冗余触发词列举。

## 安装与工具修复

- `install.ps1`：修复错误情况下未退出的问题，为 `npm install` 失败和无效 METHOD 值补充 `exit 1`。
- `install.sh`：修复逗号分隔的宿主名称含前导/尾随空格导致安装失败的问题。
- **Codex TOML 管理**：卸载 notify 时若 config.toml 仅剩空行，现在直接删除文件而非写入空内容。

## 工程

- 内核行数预算从 150 放宽到 420（契约测试），以容纳结构化章节。
- hello-eva 正文预算从 200 放宽到 500（契约测试）。
- 测试兼容 npm 11 的 pack 输出格式变更。
- 中文引号检查改为 Unicode 精确匹配，消除半角引号与量化词的误判。

## 清理

- 移除 `cleanup-v3-files.ps1`（4.0 migrate 已内置，不再需要独立脚本）。
- 移除 `evals/` 目录（6 个任务文件 + README，属于早期实验，不再维护）。
- 移除 `helloagents-4.1-refactor.patch`（临时开发文件）。

---

# HelloAGENTS 4.0.1 Release Notes

In one line: kernel restructured into explicit sections, knowledge base system finalized.

Fixes and enhancements shipped in the week after 4.0:

## Kernel: from flat list to structured sections

The 4.0 kernel was a flat numbered list. 4.0.1 reorganizes it into clearly delimited sections, adding these complete chapters:

- **Bias correction**: before every action, quick-check four categories of bias (problem understanding, judgment, action, collaboration) — each a one-liner that says "deviation → correction".
- **Capability routing**: a mode-selection table (task signals → recommended mode + skill), signals for dynamic switching mid-execution, and a decision framework for tool and subagent calls (information-gain-driven, parallelism conditions, stopping conditions).
- **Verification habits & information gain**: the falsifiability test — before calling something "passing", ask "if this claim were false, would my observation look different?" — plus information-gain-prioritized verification order.
- **Interruption recovery**: emphasizes that code is the sole source of truth; rebuild context from git status and file contents, never from transient progress markers.
- **Knowledge management**: the full `.helloagents/` layout (new: `verify.yaml`, `notes/`, `archive/`), write discipline (dedup checks, caps, expiry cleanup), and an explicit list of what NOT to write.

## Knowledge base expansion

- `helloagents init` now creates `verify.yaml` (verification commands with optional pass conditions) and `archive/` (completed plans, archived by month).
- New template: `prompts/templates/verify.yaml`.
- Kernel defines a `notes/` convention: when a topic in context.md grows too thick, extract it to `notes/{topic}.md` and leave a one-line index in context.md.
- Removed unused `prompts/templates/STATE.md`.

## Skill improvements

- **hello-auto**: restructured into four phases (analyze → mode selection → continuous execution → deliver), each with explicit judgment criteria and switching signals.
- **hello-qa**: verification priority chain changed to `.helloagents/verify.yaml` → project scripts → project docs.
- **hello-eva**: description trimmed, redundant trigger-word enumeration removed.

## Install & tooling fixes

- `install.ps1`: added missing `exit 1` on npm install failure and invalid METHOD value.
- `install.sh`: fixed host-name trimming so comma-separated names with leading/trailing whitespace install correctly.
- **Codex TOML management**: when uninstalling notify removes all managed lines, the config file is now deleted if empty rather than written as a blank file.

## Engineering

- Kernel line budget relaxed from 150 to 420 (contract test) to accommodate structured sections.
- hello-eva body budget relaxed from 200 to 500 (contract test).
- Tests now compatible with npm 11's changed pack output format.
- Chinese quote checking uses exact Unicode matching, eliminating false positives from half-width quotes next to quantifier characters.

## Cleanup

- Removed `cleanup-v3-files.ps1` (4.0 migrate handles this natively).
- Removed `evals/` directory (6 task files + README, early experiment, no longer maintained).
- Removed `helloagents-4.1-refactor.patch` (transient dev artifact).

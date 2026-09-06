# Release Notes — v4.0.6-beta.1

## 简体中文

### 行为校准与验证

- **内核按风险匹配投入**：执行纪律、验证习惯与投入规模改按目标、实际影响、风险和不确定性决定，不按输入长度或文件数量机械分级；明确的局部任务直接完成并做相关检查，重要取舍与高风险先明确方案；复用同一代码状态下的有效结果，无新变更、失败或未解决风险不重复或扩大验证。
- **默认不新增治理机制**：不为假设中的扩展增加抽象、配置、兼容层、流程或文档；不默认新增哈希校验、契约冻结、基线或门禁；测试、验证和审计按影响与风险开展，不为凑覆盖率增加。
- **安全与删除**：任何卸载、删除或清理先列出完整清单再精确处理；删除文件优先移入回收站，无回收站时保留并说明；凭据仅在授权修改时替换为占位符，只读讨论不改源文件；文本读写与脚本执行使用无 `BOM` 的 `UTF-8`。
- **表达与路由**：除代码、命令、路径、专名外优先使用用户语言，避免黑话与过度学术化；`~` 命令仅路由已列出的技能，技能缺失时说明路径并继续不依赖部分，未知命令不触发。

### 技能与模板

- **自主推进、方案、实现、自检**：按实际复杂度选择工作方式，不重复请求已获授权；方案仅在重要取舍与变更风险需对齐时进入；实现按影响确定验证范围并复用结果；自检按风险检查，不为低影响改动重复完整检查。
- **审查与质量**：审查精简为证据支撑的结论，调查按风险循环；自检复用有效结果，只报告新变更与风险。
- **界面、接口、测试、写作**：界面按产品定位建立设计基础并覆盖关键状态；接口明确新增字段的兼容验证与破坏性边界；测试按层级与风险选择，不重复覆盖；写作按读者与用途组织，不以篇幅短为目标。
- **需求、清理、复盘、协作**：需求记录依据与验收条件；清理先列清单再处理，优先可恢复方式；复盘仅记录可复用经验；子代理按收益委派并明确所有权。
- **模板**：方案、验证清单与项目模板同步为按改动范围选择检查，扩大范围需有理由。

### 安装与运行链路

- **命令路由统一**：短写与全称使用同一解析，未知命令不接管，技能路径统一指向用户级运行副本；运行时参数透传修复。
- **安装来源与更新**：修复来源读取丢失；`Git` 来源更新仅允许干净工作区同分支快进，不再强制重置。
- **安装验证**：改为核对当前完整内核，避免措辞调整误报。
- **Cursor 标准钩子**：兼容扁平格式，正确写入通知钩子；标准模式增加安装提示。
- **独立钩子文件合并**：`Grok` 与 `Hermes` 的基础条目与附加组件合并写入，互不覆盖。
- **卸载清理**：`Hermes` 空配置、`Codex` 空市场索引与空钩子文件不再残留；用户自有条目完整保留。
- **包内容**：运行副本补齐 `.codex-plugin`，`npm` 包补齐 `README.md` 与 `LICENSE.md`；包描述补齐六个宿主。
- **提示与脚本**：帮助补齐 `Codex` 拦截支持；更新提示补齐多语言；安装脚本固定 `UTF-8` 输出。

---

## English

### Behavior and verification

- **Match effort to risk**: execution, verification, and scope follow goals, impact, risk, and uncertainty instead of input length or file counts; direct tasks finish with related checks while material trade-offs get a plan first; valid results for the same code state are reused without repeated or expanded verification.
- **No default governance overhead**: no new abstractions, configs, compatibility layers, flows, docs, hash checks, frozen contracts, baselines, or gates for hypothetical needs; testing follows impact and risk, not coverage quotas.
- **Safety and deletion**: list every deletion target before acting; prefer recycle locations and keep files when none exists; replace credentials with placeholders only when authorized to edit; read and write text and scripts as `UTF-8` without `BOM`.
- **Expression and routing**: use the user's language except for code, commands, paths, and proper names; route only listed `~` commands and explain missing skill paths without guessing.

### Skills and templates

- **Autonomy, planning, implementation, self-check**: choose the working mode by complexity without re-requesting granted approvals; plan only for material trade-offs and risky changes; scope verification by impact and reuse results; check by risk instead of rerunning everything.
- **Review and quality**: keep evidence-backed conclusions with risk-driven investigation; reuse valid results and report only new changes and risks.
- **Interface, API, testing, writing**: build the design foundation by product positioning with key states covered; verify compatibility for added fields and name breaking boundaries; choose tests by level and risk without duplication; organize writing by reader and purpose instead of brevity.
- **Requirements, cleanup, retrospectives, collaboration**: record reasons and acceptance criteria; list cleanup targets first with recoverable handling; keep only reusable lessons; delegate subagents by benefit with clear ownership.
- **Templates**: plans and verification lists select checks by change scope with reasons required for expansion.

### Install and runtime

- **Unified routing**: short and full skill names share one parser, unknown commands are left alone, and skill paths point to the user-level runtime copy; runtime argument forwarding is fixed.
- **Source and update**: install source reading is fixed; `Git` updates only fast-forward a clean tree on the same branch.
- **Install verification**: compare the full current kernel instead of wording-sensitive checks.
- **Cursor hooks**: handle the flat format and log standard-mode completion.
- **Standalone hooks**: merge base and add-on entries for `Grok` and `Hermes` without overwriting.
- **Uninstall cleanup**: remove empty `Hermes` configs, empty `Codex` marketplace entries, and empty hooks files while keeping user entries.
- **Package contents**: include `.codex-plugin` in the runtime copy and `README.md` with `LICENSE.md` in the `npm` package; list all six hosts in the description.
- **Prompts and scripts**: list `Codex` for blocking support; localize update prompts; pin `UTF-8` output for the install script.

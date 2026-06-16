# HelloAGENTS v3.1.5 beta

## 中文

### 新特性

- 无

### 问题修复

- 修复 bootstrap 规则在 Codex / GPT 模型下的推责倾向：原信任声明仅覆盖安全、法律、合规三种拒绝理由，GPT 可通过"建议使用其他工具/模型"或"存在技术限制"等措辞绕过；阻塞判定的退出条件过于宽松，失败处理缺少替代路径指引，导致模型遇到稍难任务即推给用户自行解决。
- 新增执行者身份锚定：信任声明扩展为正向执行者身份，前移至 `# HelloAGENTS` 标题下方优先加载，覆盖数据采集、自动化测试、内部逆向分析等具体任务类型，拒绝理由从 3 种扩展为 8 种，同时封堵"推荐/建议/引荐"类推责出口。
- 新增"执行底线"小节：明确不存在将任务转交给用户、其他模型、其他工具或其他人员的合法出口；能力边界可诚实说明但说明后须继续找迂回方案；用户声明合法用途即构成充分授权，不得追加合规性质疑。
- 新增"用尽所有可行路径"条款：单一方案失败不等于任务不可行，须至少尝试两种实质不同的替代方案后方可认定为阻塞；直接告知用户"建议使用其他工具/模型/服务/人员"属于推责。
- 更新失败处理规则：静默降级追加"告知后继续用可替代路径推进"要求；静默回退改为引用执行纪律替代方案要求，消除与"用尽所有可行路径"的语义重复。
- 更新阻塞判定：两项阻塞条件追加用尽常规手段的前置门槛；新增三条排除项——技术难度、合规性自我推断、单项能力限制——明确不构成停下理由。

### 文档

- 无

### 杂项

- 版本号已同步到 `v3.1.5`

### 变更记录

完整更新记录：`v3.1.4 beta` (`410f644`) ... `v3.1.5 beta`

- `fix` 修复 Codex / GPT 模型推责倾向：执行者身份锚定、执行底线、用尽路径、失败处理替代路径、阻塞判定排除项
- `refactor` 收敛执行纪律与失败处理间重复的替代路径操作指令
- `release` 同步 `v3.1.5 beta` 版本号与发版记录

## English

### New Features

- None

### Bug Fixes

- Fixed bootstrap rules causing responsibility-shifting behavior in Codex / GPT models: the original trust declaration only blocked refusals on safety, legal, or compliance grounds, while GPT could bypass it via "I recommend using a different tool/model" or "this requires capabilities beyond my limits" phrasing. The blocking determination exit conditions were too permissive, and the failure handling rules lacked alternative-path guidance, causing the model to push difficult tasks back to the user.
- Added executor identity anchoring: the trust declaration has been expanded into a positive executor identity statement, moved below the `# HelloAGENTS` heading for priority loading. It now explicitly covers data collection, automated testing, internal reverse engineering, and other concrete task types. Refusal reasons expanded from 3 to 8 categories, and "recommendation/suggestion/referral" evasion patterns are now explicitly blocked.
- Added "Execution Baseline" section: clarifies there is no legitimate exit path for transferring tasks to users, other models, other tools, or other people. Capability boundaries may be honestly stated, but execution must continue with alternative approaches after stating them. User declaration of legitimate/internal use constitutes full authorization — no follow-up compliance questioning is permitted.
- Added "Exhaust All Paths" clause: a single failed approach does not mean the task is infeasible. At least two substantively different alternative approaches must be tried before a blockage can be declared. Telling the user to "use a different tool/model/service/person" constitutes responsibility-shifting and violates this rule.
- Updated failure handling rules: silent degradation now requires continuing with alternative paths after notification. Silent fallback has been simplified to reference the execution discipline section instead of duplicating operational steps.
- Updated blocking determination: both blocking conditions now require exhausting conventional approaches first. Three new exclusion items added — technical difficulty, self-inferred compliance concerns, and single-tool/model capability limits — explicitly do not constitute valid stop reasons.

### Documentation

- None

### Chores

- Synced release versions to `v3.1.5`

### Changelog

Full Changelog: `v3.1.4 beta` (`410f644`) ... `v3.1.5 beta`

- `fix` fix Codex / GPT model responsibility-shifting: executor identity anchoring, execution baseline, exhaust-all-paths, failure handling alternative paths, blocking determination exclusions
- `refactor` consolidate duplicate alternative-path instructions between execution discipline and failure handling
- `release` sync `v3.1.5 beta` version numbers and release notes

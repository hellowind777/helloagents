---
name: ~loop
description: 长任务入口 — 在 Codex 中优先走 `/goal -> ~auto -> ~qa`，把长程续跑交给 `/goal`，把执行推进交给 `~auto`，把最终质量闭环交给 `~qa`（~loop 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~loop <目标描述>

`~loop` 不再维护独立的指标实验循环。它是长任务入口，默认把链路收敛为：

`/goal -> ~auto -> ~qa`

其中：
- `/goal` 负责长程续跑、恢复与预算
- `~auto` 负责按方案包持续推进 AFK 任务
- `~qa` 负责最终审查、验证命令、阻断修复、回归验证与收尾证据

## 适用边界

- 适合：多轮持续执行、跨会话恢复、较长的 AFK 任务
- 不适合：普通小任务、单轮可完成任务、单纯质量审查；这些优先直接走 `~auto` 或 `~qa`
- 真正的指标实验、benchmark 对赌、keep/revert 试验，不再由 `~loop` 承担

## 流程

### 0. 当前工作流优先

- 若当前上下文中已注入“当前工作流约束”或“当前推荐下一命令”，先服从它
- `~loop` 不是绕过方案包和质量契约的越级入口；它只是把长任务执行链路固定为 `/goal -> ~auto -> ~qa`

### 1. 先落稳方案包

- 优先复用当前活跃方案包
- 若当前没有足够可信的方案包，而任务又属于长任务、跨模块任务或高风险任务，先补 `~plan` 或 `~prd`
- `tasks.md` 必须能支撑长程执行：任务按顺序拆好，标注 `AFK` / `HITL`，写清依赖、涉及文件、完成标准和验证方式
- `contract.json` 必须至少落成 `qaMode` 与 `qaFocus`

### 2. Codex + goals 已启用时

- 把 `~loop` 视为 Codex 的长任务入口，优先直接进入 `/goal`
- `/goal` 不直接消费原始需求文档；只消费当前方案包里的 “Codex /goal 执行入口”
- `/goal` 入口必须明确以下约束：
  - 默认主执行命令是 `~auto`
  - 按 `tasks.md` 顺序完成所有可执行 `AFK` 任务
  - `HITL` 只在缺少用户决策、凭据、人工验收或其他真实阻塞时暂停
  - 不得把单轮结果、阶段总结或“下一步建议”当成完成
  - 全部 `AFK` 任务完成后，必须进入 `~qa`
  - 只有 `~qa` 通过、当前会话证据写全、HelloAGENTS 收尾完成后，才允许标记 goal complete
- 若当前已经运行在 Codex active goal 下，继续沿当前 goal 执行，不重复创建新 goal

### 3. 非 Codex 或 goals 不可用时

- 明确当前无法使用 Codex 原生 `/goal`
- 仍按同一意图执行长任务，但只走 `~auto -> ~qa`
- 这种情况只是无 `/goal` 的降级路径，不把它包装成等价的 goal 能力

### 4. 执行期间的状态维护

- `~loop` 必须维护 `state_path`
- “主线目标”写当前长任务目标
- “正在做什么”写当前 `AFK` 任务或当前收尾阶段
- “下一步”写下一条具体可执行动作，必要时带文件路径
- 若当前运行在 Codex active goal 下，`state_path` 仍只负责本地恢复，不替代 goal 自身状态

### 5. 禁止事项

- 不再创建基线指标、results log、keep/revert 实验提交或守卫命令循环
- 不把 `/goal` 当作质量验收器；最终质量闭环始终由 `~qa` 负责
- 仍有可执行 `AFK` 任务时，不进入 complete
- 没有最新 `qa-review.json`、需要的 `advisor.json` / `visual.json` / `closeout.json` 时，不得报告完成

## 完成判定

- 只有当长任务链路已经走到 `~qa`，并且质量闭环通过、收尾证据完整、HelloAGENTS 允许进入收尾与归档时，`~loop` 才算完成
- 若当前任务来自 Codex active goal，还要满足：当前 goal 的可执行 `AFK` 任务已全部完成，才允许标记 goal complete

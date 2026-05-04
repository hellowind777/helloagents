---
name: ~loop
description: 自主迭代优化循环 — 设定目标和指标，AI 自主循环修改-验证-保留/回滚，直到达成目标或达到迭代上限（~loop 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~loop <目标描述> [--iterations N] [--metric "命令"] [--direction higher|lower] [--guard "命令"]

## 交互式配置

如果用户未提供完整参数，通过对话确认以下配置：
- 目标：优化什么？（如：提升测试覆盖率、减少构建时间、提升性能分数）
- 指标命令：运行什么命令获取数值？（如：`npm run test -- --coverage`）
- 方向：higher（越高越好）还是 lower（越低越好）？
- 迭代上限：最多跑几轮？（默认 20，无上限则设为 0）
- 守卫命令（可选）：每轮必须通过的底线检查（如：`npm test`）
- 作用范围：哪些文件/目录可以修改？

## 初始化

1. 确认 git 工作区干净（有未提交变更则先提醒用户处理）
2. 确保 `.helloagents/` 目录和 `state_path` 存在；文件不存在时按 `templates/STATE.md` 创建。`~loop` 必须维护这个状态文件，不受 `kb_create_mode` 控制；“主线目标”固定写本次优化目标，避免混入其他任务
3. 运行指标命令获取基线值，记录到 results log
4. 如有守卫命令，运行确认基线通过
5. 创建当前会话的 `.helloagents/sessions/{branch}/{session}/artifacts/loop-results.tsv`
6. 根据优化目标标记可能需要的 hello-* 质量技能（如性能优化标记 hello-perf，UI 优化标记 hello-ui）
7. 重写 `state_path`：记录主线目标=当前优化目标、基线指标、守卫命令、下一步设为第一轮迭代的具体动作

results log 格式：
```
# metric_direction: higher_is_better
iteration	commit	metric	delta	guard	status	description
0	a1b2c3d	85.2	0.0	pass	baseline	initial state
```

## 八阶段循环

`~loop` 的八阶段循环是统一执行流程（ROUTE/TIER→SPEC→PLAN→BUILD→VERIFY→CONSOLIDATE）在迭代优化场景下的特化形式。每轮迭代的“修改”阶段遵循已标记的 hello-* 质量技能规范，“验证”阶段遵循 hello-verify 的验证规范。
执行 `~loop` 时，涉及公共阶段边界、阻塞判定与收尾要求的部分，仍按当前已加载 bootstrap 执行；本 skill 负责补充 loop 场景的迭代顺序与回滚规则。

除非达到迭代上限或命中阻塞判定，否则继续执行，不额外询问是否继续，也不把 `🔄 下一步` 当作单轮结果或继续执行占位。
每轮迭代必须完整走完以下八个阶段：

### 第 1 阶段：回顾
- 读取 results log 最近 10-20 条记录
- 运行 `git log --oneline -20` 查看最近变更
- 运行 `git diff HEAD~1` 查看上一次变更
- 如果 git log 有 results log 中未记录的 experiment commit → 上轮可能中断，先运行指标命令补录结果
- 识别：什么有效、什么无效、什么还没试过

### 第 2 阶段：构思
- 基于 review 结果，选择下一个改进方向
- 优先尝试未探索的方向
- 避免重复已失败的方向（git history 是记忆）
- 连续 5 次 discard → 升级策略：组合近似成功的尝试、尝试相反方向、考虑架构级变更

### 第 3 阶段：修改
- 做一个原子修改（单一关注点）
- 只修改作用范围内的文件
- 不修改测试文件和守卫命令涉及的文件

### 第 4 阶段：提交
- 在验证之前提交（便于干净回滚）
- commit message 格式：`experiment(<scope>): <description>`

### 第 5 阶段：验证
- 运行指标命令，获取新值
- 计算 delta（新值 - 基线或上一次保留值）
- 如有守卫命令，运行守卫检查

### 第 6 阶段：决策
- IMPROVED（指标改善 + 守卫通过）→ keep
- SAME/WORSE（指标未改善）→ `git revert HEAD`（保留历史）
- GUARD FAILED（指标改善但守卫失败）→ 尝试修复（最多 2 次），仍失败则 revert
- CRASHED（命令执行失败）→ revert + 记录

### 第 7 阶段：记录
- 追加一行到 results log
- status: baseline / keep / discard / crash / no-op
- 重写 `state_path`：保持主线目标=当前优化目标，并记录当前迭代轮次、最近一次决策（keep / discard / crash）、当前最佳指标、下一步动作

### 第 8 阶段：继续
- 如果 iterations > 0 且 current_iteration >= max_iterations → 输出总结并停止
- 否则 → 回到 Phase 1

## 总结输出

循环结束时输出：
- 基线值 → 最终值（改善幅度）
- 总迭代次数 / 保留次数 / 丢弃次数
- 最有效的 3 个改进
- results log 路径
- 重写 `state_path`：将“主线目标”保留为本次优化目标，“正在做什么”更新为已完成，保留最终结论摘要，清空阻塞项，并给出可立即执行的下一步（如继续优化、停止、切换目标）

## 安全规则
- 使用 `git revert`（保留历史）而非 `git reset --hard`（丢失历史）
- 不修改测试文件和守卫命令涉及的文件
- 单次修改涉及 >5 个文件 → 重新评估，可能需要拆分
- 守卫命令是底线，指标改善但守卫失败 = 不可接受

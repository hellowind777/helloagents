---
name: qa-review
description: 统一质量审查、命令验证、阻断修复与交付前质量闭环。
---

`qa-review` 是新的统一质量入口。
它取代旧的“先 review、再 verify”双路径，统一负责：

1. 识别当前范围与风险边界
2. 做代码与架构层面的质量审查
3. 运行验证命令
4. 修复阻断项并回归验证
5. 写当前会话 `artifacts/qa-review.json`
6. 若当前契约仍要求 advisor / visual / closeout，再继续补齐对应证据

## 质量模式

- `standard`：默认模式。聚焦当前变更、相关配置和真实风险边界，避免无关扩查
- `deep`：高风险或长任务收尾模式。按 12 维做更完整的阻断性审查，并优先补齐证据链

若 `contract.json` 提供 `qaMode` 与 `qaFocus`，优先服从它。

## 审查维度

所有模式至少覆盖以下维度：

- 功能正确性：边界条件、空值、错误路径、真实数据流
- 安全性：鉴权、注入、敏感信息、权限绕过
- 可靠性：超时、资源释放、异常恢复、一致性
- 性能与容量：重复计算、低效查询、大循环 I/O、构建产物体积
- 可维护性：职责边界、重复逻辑、命名、死代码、过度抽象
- 交付契约：requirements / tasks / contract 是否真实满足

`deep` 模式下，再补查：

- 兼容性
- 可观测与运维
- 测试有效性
- 架构与依赖边界
- 易用性
- 可演进性

## 证据要求

阻断问题必须给出：

- 文件定位：`{file}:{line}`
- 观察到的现象
- 为什么构成阻断
- 具体修复方向

不要只给泛泛评价。

## 验证命令

验证命令来源：

- `.helloagents/verify.yaml`
- `package.json` 的 `lint` / `typecheck` / `test` / `build`
- `pyproject.toml` 的 `ruff` / `mypy` / `pytest`

命令失败时：

1. 先说明根因
2. 修复阻断项
3. 重新运行相关命令
4. 直到通过，或命中真实阻塞

## 结构化证据

完成本次质量闭环后，立即调用：

`scripts/qa-review-state.mjs write`

写当前会话 `artifacts/qa-review.json`，至少记录：

- `qaMode`
- `scope`
- `outcome`
- `conclusion`
- `findings`
- `fileReferences`
- `commands`

若仍有阻断问题，`outcome` 必须写为 `findings`。
不要让运行时从自然语言里猜结论。

## 交付要求

- 没有看到验证输出，不能声称完成
- 没有写 `qa-review.json`，不能把当前结果当成可信质量闭环
- 若当前契约要求 `advisor.json` / `visual.json` / `closeout.json`，必须继续补齐

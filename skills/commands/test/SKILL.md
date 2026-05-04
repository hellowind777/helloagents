---
name: ~test
description: 为指定模块或最近变更编写完整测试（~test 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~test [scope]

## 流程

1. 确定测试范围：
   - 无参数：为最近变更的文件编写测试
   - 指定文件/模块：为指定范围编写测试
   - Codex active goal 下无参数：从 `tasks.md` 未完成项、`contract.json` 与 `state_path` 推导本轮测试范围
2. 按 hello-* 技能查找路径读取 hello-test SKILL.md，按其 TDD 规范和边界用例要求编写测试
3. 运行测试确认全部通过
4. 同步直接相关的任务状态，报告覆盖情况和遗漏；测试通过只作为 goal 交付证据，不直接标记 goal complete

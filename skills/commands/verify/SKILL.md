---
name: ~verify
description: 验证总入口 — 审查、lint、typecheck、test、build 与修复循环（~verify 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~verify [scope]

## 流程

1. 判断本次是“全量验证”还是“审查优先”：
   - 用户显式使用 `~review`，或明确要求代码审查 / diff 审查 / 风险审查 → 审查优先
   - 其他情况 → 全量验证
2. 审查优先模式：
   - 获取变更范围：无参数默认未提交变更；`staged` 代表暂存区；指定文件/目录则只审查对应范围
   - 按 hello-* 技能查找路径读取 `hello-review` SKILL.md，执行逐文件审查
3. 全量验证模式或审查后继续验证：
   - 读取 `hello-verify` SKILL.md
   - 按其“验证命令来源”优先级检测命令
   - 逐个运行所有检测到的命令
   - 收集每个命令的输出和退出码
4. 汇总报告：
   - ✅ 通过的审查项 / 命令
   - ❌ 失败的审查项 / 命令 + 错误详情
   - 修复建议

## 失败处理
- 有失败 → 逐个修复，修复后重新运行对应审查或验证
- 全部通过 → 报告完成

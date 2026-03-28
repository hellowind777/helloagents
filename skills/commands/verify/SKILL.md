---
name: ~verify
description: 运行项目的所有验证命令并报告结果（~verify 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~verify

## 流程

1. 检测验证命令来源（优先级详见 hello-verify SKILL.md）
2. 逐个运行所有检测到的命令
3. 收集每个命令的输出和退出码
4. 汇总报告：
   - ✅ 通过的命令
   - ❌ 失败的命令 + 错误详情
   - 修复建议

## 失败处理
- 有失败 → 逐个修复，修复后重新运行验证
- 全部通过 → 报告完成

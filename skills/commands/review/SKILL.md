---
name: ~review
description: 代码审查 + 质量检查（~review 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~review [scope]

## 流程

1. 获取变更范围：
   - 无参数：git diff（未提交的变更）
   - 指定文件/目录：只审查指定范围
   - "staged"：git diff --staged
2. 按 hello-* 技能查找路径读取 hello-review SKILL.md，按其审查规范逐文件审查
3. 按严重度分类输出结果，给出具体修复建议

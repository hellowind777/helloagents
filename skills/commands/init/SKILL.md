---
name: ~init
description: 初始化项目知识库和配置（~init 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~init

~init 是用户显式命令，创建完整知识库，不受 kb_create_mode 限制。

## 流程

1. 在当前项目创建 .helloagents/ 目录
2. 按 templates/ 目录的模板格式，分析项目代码库后生成：
   - STATE.md — 按 templates/STATE.md 格式，初始为空闲
   - context.md — 按 templates/context.md 格式，填入项目概述、技术栈、架构、目录结构、模块链接
   - guidelines.md — 按 templates/guidelines.md 格式，从现有代码推断编码约定
   - verify.yaml — 验证命令（从 package.json/pyproject.toml 检测）
   - CHANGELOG.md — 按 templates/CHANGELOG.md 格式，初始版本
   - DESIGN.md — 如果项目包含 UI 代码，按 templates/DESIGN.md 格式提取设计系统
3. 创建 modules/ 目录，按 templates/modules/module.md 格式为主要模块生成文档
4. 不覆盖已存在的文件

## verify.yaml 格式
```yaml
commands:
  - npm run lint
  - npm run test
```

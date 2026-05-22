---
name: helloagents-meta
description: HelloAGENTS 技能系统规范
policy:
  allow_implicit_invocation: false
---

## Skill 系统
Skills 是带 YAML frontmatter 的 Markdown 文件。
- helloagents: 由检查清单驱动的质量把关（每次对话自动加载）
- hello-*: 质量技能（根据任务自动激活，提供实现要求和交付检查清单）
- commands/*: 用户通过 ~command 调用

Skills 按需加载，不预加载。

## Frontmatter 字段
- name: 技能名称（必填）
- description: 技能描述，用于元数据层判断是否相关（必填）
- policy.allow_implicit_invocation: 是否允许隐式激活（false = 仅显式调用）。缺省时默认 true（hello-* 质量技能根据任务自动激活）。commands/* 必须显式设为 false（仅通过 ~command 调用）

---
name: cmd-help
description: >
  Help command (~help). Shows available commands, skills,
  and usage information.
provides: [help-display]
category: command
trigger:
  auto: false
requires: []
user-invocable: true
argument-hint: "[command name]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~help 帮助

## Execution Flow
```yaml
~help (no args): show command overview
  Available commands:
    ~auto [需求]    全自动执行（评估→设计→开发）
    ~plan [需求]    仅规划（评估→设计，不执行）
    ~exec [方案包]  执行已有方案包
    ~init           初始化/升级知识库
    ~commit [-m]    智能提交
    ~test [范围]    运行测试
    ~review [范围]  代码审查
    ~status         查看项目状态
    ~clean [范围]   清理缓存/方案包
    ~rlm [角色]     子代理管理
    ~help [命令]    显示帮助

  Tips:
    - 直接输入需求即可，HelloAGENTS 自动判断执行方式
    - 复杂任务建议使用 ~auto 或 ~plan
    - 配置文件: ~/.helloagents/config.json

~help [command]: show detailed help for specific command
  Read the command's SKILL.md and present key info
```

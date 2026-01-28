---
name: helloagents
description: "【HelloAGENTS】显式调用入口。使用 /helloagents 或 $helloagents 激活。"
license: Apache-2.0
metadata:
  author: helloagents
  version: "2.1"
---

# HelloAGENTS 技能入口

> 本文件在用户显式调用技能时加载（/helloagents 或 $helloagents）。
> 核心规则在主配置中定义，本文件定义显式调用时的响应规则。

> 📌 路径基准: SKILL_ROOT、SCRIPT_DIR、TEMPLATE_DIR 由 G7 推断规则确定

---

## 显式调用响应规则

当用户通过 `/helloagents` 或 `$helloagents` 显式调用本技能时，输出以下欢迎信息：

```
💡【HelloAGENTS】- 技能已激活

智能工作流系统，提供结构化任务流程。

### 可用命令

| 命令 | 功能 |
|------|------|
| `~auto` | 全授权命令 |
| `~plan` | 执行到方案设计 |
| `~exec` | 执行方案包 |
| `~init` | 初始化知识库 |
| `~upgrade` | 升级知识库 |
| `~clean` | 清理遗留方案包 |
| `~commit` | Git 提交 |
| `~test` | 运行测试 |
| `~review` | 代码审查 |
| `~validate` | 验证知识库 |
| `~rollback` | 智能回滚 |
| `~rlm` | RLM 递归语言模型 |
| `~help` | 显示帮助 |

### 使用方式

- 输入 `~命令` 执行特定功能
- 直接描述需求，系统自动路由到合适的流程

────
🔄 下一步: 输入命令或描述你的需求
```

**后续输入处理：** 用户输入后，按照 G4 路由架构处理。

---

## 脚本调用约定

> 📌 脚本调用规范（路径变量、存在性检查、错误恢复、用法示例）见 references/rules/tools.md

脚本位于 `{SCRIPT_DIR}` 目录，调用时使用 `-X utf8` 确保编码正确。

---

## 模板资源

> 📌 模板文件索引和章节结构见 references/services/templates.md

模板位于 `{TEMPLATE_DIR}` 目录，结构与知识库一致。


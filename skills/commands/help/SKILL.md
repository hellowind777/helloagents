---
name: ~help
description: 显示 HelloAGENTS 可用命令和当前设置（~help 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~help

## 显示内容

### 可用命令
| 命令 | 说明 |
|------|------|
| ~auto | 全自动执行：AI 自主分析需求、设计方案并执行 |
| ~design | 深度设计：交互式需求挖掘 + 方案设计 + 方案包 |
| ~prd | 完整 PRD：头脑风暴式逐维度挖掘，生成现代产品需求文档 |
| ~loop | 自主迭代优化：设定目标和指标，循环修改-验证-保留/回滚 |
| ~init | 初始化项目知识库和配置 |
| ~test | 为指定模块或最近变更编写完整测试 |
| ~verify | 运行所有验证命令并报告结果 |
| ~review | 代码审查 |
| ~commit | 规范化提交 + 知识库同步 |
| ~clean | 清理临时文件和归档方案包 |
| ~help | 显示此帮助 |

### 自动激活技能
以下技能根据任务内容自动激活，无需手动触发：

编码时：hello-ui, hello-api, hello-data, hello-security, hello-errors, hello-perf, hello-arch, hello-test
特定场景：hello-debug, hello-subagent, hello-write, hello-review
完成时：hello-verify, hello-reflect

### 当前设置
读取 ~/.helloagents/helloagents.json 显示：
| 配置项 | 默认值 | 作用 | 适用 CLI |
|--------|-------|------|---------|
| output_language | "" | 空=跟随用户语言/填写则指定（如 zh-CN、en） | Claude Code + Gemini CLI + Codex CLI |
| output_format | true | true=HelloAGENTS格式输出/false=自然输出 | Claude Code + Gemini CLI + Codex CLI |
| notify_level | 0 | 0=关闭/1=桌面通知/2=声音/3=两者 | Claude Code + Gemini CLI + Codex CLI |
| ralph_loop_enabled | true | 自动验证循环（任务完成时触发 lint/test/build） | Claude Code + Gemini CLI + Codex CLI |
| guard_enabled | true | 阻断危险命令与写入后的安全扫描 | Claude Code + Gemini CLI + Codex CLI |
| kb_create_mode | 1 | 0=关闭/1=编码自动/2=始终 | Claude Code + Gemini CLI + Codex CLI |
| commit_attribution | "" | 空=不添加/填写内容则添加到 commit message | Claude Code + Gemini CLI + Codex CLI |

---
name: ~wiki
description: 初始化或同步项目知识库（仅 `.helloagents/`）
policy:
  allow_implicit_invocation: false
---
Trigger: ~wiki

`~wiki` 是用户显式命令，仅创建、补全或同步项目知识库。

`~wiki` 是显式知识库命令，不受 `kb_create_mode` 限制。
执行 `~wiki` 时，`.helloagents/` 目录结构、模板格式和状态文件重写规则按当前已加载的 HelloAGENTS 规则执行；不写入项目级规则文件，也不创建项目级 HelloAGENTS 包根链接。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：状态文件只使用 `state_path`；若 `project_store_mode=repo-shared`，`context.md`、`guidelines.md`、`verify.yaml`、`CHANGELOG.md`、`DESIGN.md`、`modules/` 改按当前上下文中已注入的项目知识目录写入。

## 流程

### 阶段 1：基础准备（必做）

1. 创建 `.helloagents/` 目录 + `state_path`（按 templates/STATE.md 格式）；初始“主线目标”只写当前知识库初始化 / 同步目标，不把它写成长期项目总目标
2. 追加 `.gitignore`（如果对应行不存在）：
   ```
   .helloagents/
   ```
3. 明确不执行以下操作：
   - 不创建或更新项目级规则文件（`AGENTS.md`、`CLAUDE.md`、`.gemini/GEMINI.md`）
   - 不创建项目级 HelloAGENTS 包根链接

### 阶段 2：知识库创建或补全（条件性）

检查项目是否有实际代码文件（非空项目）：
- 有代码文件 → 执行完整知识库创建/补全（下方流程）
- 空项目 → 保留 `.helloagents/` 和 `state_path`，告知用户“项目为空，其余知识文件将在后续开发或首次编码任务中补全”

知识库创建/补全流程（统一写入 `.helloagents/` 对应的项目级存储路径；`project_store_mode=repo-shared` 时实际落在共享知识目录）：
1. 按 templates/ 目录的模板格式，分析项目代码库后创建或补全：
   - context.md — 按 templates/context.md 格式，填入项目概述、技术栈、架构、目录结构、模块链接
   - guidelines.md — 按 templates/guidelines.md 格式，从现有代码推断编码约定
   - verify.yaml — 验证命令（从 package.json/pyproject.toml 检测）
   - CHANGELOG.md — 按 templates/CHANGELOG.md 格式创建或更新
   - DESIGN.md — 如果项目包含 UI 代码，按 templates/DESIGN.md 格式提取或补全项目级设计契约（产品表面、设计 token、组件与模式、状态覆盖、无障碍要求、禁止事项等）
2. 创建或补全 modules/ 目录，按 templates/modules/module.md 格式为主要模块生成文档
3. 已存在的文件按模板格式增量更新，不自由改写结构；无新增信息时保持原样

## verify.yaml 格式
```yaml
commands:
  - npm run lint
  - npm run test
```

## 幂等性
重复执行 `~wiki` 是安全的：
- `.helloagents/` 缺失时创建，已存在时复用
- `state_path` 按当前任务状态重写，不追加历史；它只记录当前知识库任务，不承担项目的长期记忆
- 知识库文件缺失时补全，已存在时按模板增量更新
- `.gitignore` 只追加缺失行
- 永不写入项目级规则文件，也不创建任何项目级 HelloAGENTS 包根链接

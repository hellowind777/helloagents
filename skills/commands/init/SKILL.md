---
name: ~init
description: 初始化或同步项目知识库（与 ~wiki 同义）
policy:
  allow_implicit_invocation: false
---
Trigger: ~init

`~init` 是用户显式命令，仅创建、补全或同步项目知识库。
`~init` 与 `~wiki` 同义，不受 `kb_create_mode` 限制。
执行 `~init` 时，`.helloagents/` 目录结构、模板格式和状态文件重写规则按当前已加载的 HelloAGENTS 规则执行；不写入项目级规则文件，也不创建项目级 HelloAGENTS 包根链接。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：项目本地 `.helloagents/` 继续承担项目本地存储目录；状态文件只使用 `state_path`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md` 与方案包按当前上下文中已注入的项目知识/方案目录写入。

## 流程

### 阶段 1：基础准备（必做）

1. 创建 `.helloagents/` 目录 + `state_path`（按 templates/STATE.md 格式，初始“主线目标”写当前知识库初始化 / 同步任务，初始状态为空闲）
2. 追加 `.gitignore`（如果对应行不存在）：
   ```
   .helloagents/
   ```

### 阶段 2：知识库创建或补全（条件性）

检查项目是否有实际代码文件（非空项目）：
- 有代码文件 → 执行完整知识库创建（下方流程）
- 空项目 → 跳过，告知用户"项目为空，知识库将在后续开发中创建"

知识库创建/补全流程（统一写入 `.helloagents/` 对应的项目级存储路径；`project_store_mode=repo-shared` 时实际落在共享知识目录）：
1. 按 templates/ 目录的模板格式，分析项目代码库后生成：
   - context.md — 按 templates/context.md 格式，填入项目概述、技术栈、架构、目录结构、模块链接
   - guidelines.md — 按 templates/guidelines.md 格式，从现有代码推断编码约定
   - verify.yaml — 验证命令（从 package.json/pyproject.toml 检测）
   - CHANGELOG.md — 按 templates/CHANGELOG.md 格式，初始版本
   - DESIGN.md — 如果项目包含 UI 代码，按 templates/DESIGN.md 格式提取项目级设计契约（产品表面、设计 token、组件与模式、状态覆盖、无障碍要求、禁止事项等）
2. 创建 modules/ 目录，按 templates/modules/module.md 格式为主要模块生成文档
3. 不覆盖已存在的文件

## verify.yaml 格式
```yaml
commands:
  - npm run lint
  - npm run test
```

## 幂等性
重复执行 ~init 是安全的：
- `.helloagents/` 缺失时创建，已存在时复用
- `state_path` 按当前任务状态重写，不追加历史；它只记录当前知识库任务，不承担项目的长期记忆
- 知识库文件缺失时补全，已存在时按模板增量更新
- `.gitignore` 只追加缺失行

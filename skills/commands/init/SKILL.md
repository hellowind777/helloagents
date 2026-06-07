---
name: ~init
description: 初始化项目工作流并同步知识库
policy:
  allow_implicit_invocation: false
---
Trigger: ~init

`~init` 是用户显式命令，用来初始化或刷新当前项目的完整工作流。
它不受 `kb_create_mode` 限制。
执行 `~init` 时，按当前规则模板创建或更新项目本地 `.helloagents/`，同步知识库，并为支持的宿主写入项目级完整规则标记：`<!-- HELLOAGENTS_PROFILE: full -->`。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：项目本地 `.helloagents/` 继续承担项目本地存储目录；状态文件只使用 `state_path`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md` 与方案包按当前上下文中已注入的项目知识/方案目录写入。

## 流程

### 阶段 1：初始化项目工作流（必做）

1. 创建 `.helloagents/` 目录 + `state_path`（按 templates/STATE.md 格式，初始“主线目标”写当前项目初始化任务，初始状态为空闲）
2. 用当前完整规则模板刷新项目级规则文件，在受管内容第一行写入 `<!-- HELLOAGENTS_PROFILE: full -->`，再用 `<!-- HELLOAGENTS_START -->` / `<!-- HELLOAGENTS_END -->` 包裹后写入：
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.gemini/GEMINI.md`（不存在则先创建 `.gemini/` 目录）
   如果文件已存在且包含标记，替换标记内内容；已存在但无标记，则追加到末尾；不存在则新建
3. 追加 `.gitignore`（如果对应行不存在）：
   ```
   .helloagents/
   AGENTS.md
   CLAUDE.md
   .gemini/GEMINI.md
   ```

### 阶段 2：知识库创建或补全（条件性）

检查项目是否有实际代码文件（非空项目）：
- 有代码文件 → 执行完整知识库创建（下方流程）
- 空项目 → 保留 `.helloagents/` 和项目级规则文件，告知用户"项目为空，其余知识文件将在后续开发或首次编码任务中补全"

知识库创建/补全流程（统一写入 `.helloagents/` 对应的项目级存储路径；`project_store_mode=repo-shared` 时实际落在共享知识目录）：
1. 按 templates/ 目录的模板格式，分析项目代码库后生成：
   - context.md — 按 templates/context.md 格式，填入项目概述、技术栈、架构、目录结构、模块链接
   - guidelines.md — 按 templates/guidelines.md 格式，从现有代码推断编码约定
   - verify.yaml — 验证命令（从 package.json/pyproject.toml 检测）
   - CHANGELOG.md — 按 templates/CHANGELOG.md 格式，初始版本
   - DESIGN.md — 如果项目包含 UI 代码，按 templates/DESIGN.md 格式提取项目级设计契约（产品表面、设计 token、组件与模式、状态覆盖、无障碍要求、禁止事项等）
2. 创建 modules/ 目录，按 templates/modules/module.md 格式为主要模块生成文档
3. 已存在的文件按模板增量更新，不自由改写结构；无新增信息时保持原样

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
- 项目级规则文件中的受管标记块会刷新到最新
- 知识库文件缺失时补全，已存在时按模板增量更新
- `.gitignore` 只追加缺失行

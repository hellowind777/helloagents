---
name: ~init
description: 初始化项目知识库与项目级规则文件（~init 命令）
policy:
  allow_implicit_invocation: false
---
Trigger: ~init

~init 是用户显式命令，创建完整知识库，不受 kb_create_mode 限制。
执行 `~init` 时，`.helloagents/` 目录结构、模板格式和状态文件规则按当前已加载的 HelloAGENTS 规则执行；本命令额外负责项目级规则文件和各宿主项目级 HelloAGENTS 包根链接。
`.helloagents/` 在本 skill 中统一按项目级存储路径理解：项目本地 `.helloagents/` 继续承担激活目录；状态文件只使用 `state_path`；若 `project_store_mode=repo-shared`，知识库、`DESIGN.md` 与方案包按当前上下文中已注入的项目知识/方案目录写入。

## 流程

### 阶段 1：环境搭建（必做）

1. 创建 `.helloagents/` 目录 + `state_path`（按 templates/STATE.md 格式，初始“主线目标”写当前初始化任务，初始状态为空闲）
2. 定位插件根目录：优先读取当前上下文中已注入的“当前 HelloAGENTS 包根目录”；若上下文未提供，再根据当前已加载的 HelloAGENTS 规则来源反推，禁止猜测其他目录
3. 刷新各宿主项目级 HelloAGENTS 包根链接（删除旧的重建）：
   - `.claude/skills/helloagents` symlink → `{插件根目录}/`
   - `.gemini/skills/helloagents` symlink → `{插件根目录}/`
   - `.codex/skills/helloagents` symlink → `{插件根目录}/`
   这些链接用于项目级规则定位 HelloAGENTS 的 `skills/`、`templates/` 和 `scripts/`；宿主若支持递归发现 `SKILL.md`，也可直接识别包内 skills。
4. 读取 `{插件根目录}` 中的全量规则模板，用 `<!-- HELLOAGENTS_START -->` / `<!-- HELLOAGENTS_END -->` 标记包裹后写入：
   - `AGENTS.md`（项目根目录，Codex 读取）
   - `CLAUDE.md`（项目根目录，Claude Code 读取）
   - `.gemini/GEMINI.md`（Gemini CLI 读取，需先创建 .gemini/ 目录）
   注意：如果文件已存在且包含标记，替换标记内的内容；如果文件已存在但无标记，追加到末尾；如果文件不存在，创建新文件
5. 追加 `.gitignore`（如果对应行不存在）：
   ```
   .helloagents/
   .claude/skills/helloagents
   .gemini/skills/helloagents
   .codex/skills/helloagents
   AGENTS.md
   CLAUDE.md
   .gemini/GEMINI.md
   ```

### 阶段 2：知识库创建（条件性）

检查项目是否有实际代码文件（非空项目）：
- 有代码文件 → 执行完整知识库创建（下方流程）
- 空项目 → 跳过，告知用户"项目为空，知识库将在后续开发中创建"

知识库创建流程（与原 ~init 一致；逻辑写入 `.helloagents/`，`project_store_mode=repo-shared` 时实际落在共享知识目录）：
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
- 已存在的 .helloagents/ 文件不覆盖
- `state_path` 只记录当前初始化任务；后续进入其他任务时必须按新任务重写
- 各宿主项目级 HelloAGENTS 包根链接会刷新（删除旧的重建）
- AGENTS.md/CLAUDE.md/GEMINI.md 中标记内容替换更新
- .gitignore 只追加缺失行

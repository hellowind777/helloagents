---
name: atanycosts
description: Atanycosts 个人策略包入口。叠加 single-source-of-truth、anti-fallback、文档同步、真实验证与毕设偏好；不重定义 HelloAGENTS 命令或输出格式。
policy:
  allow_implicit_invocation: false
---

# Atanycosts

`atanycosts` 是挂在现有 HelloAGENTS skill 体系上的个人策略包入口。
它只补充稳定的个人约束，不接管 `~plan`、`~build`、`~verify` 等命令，也不另起一套阶段机、输出格式或项目存储结构。

## 核心原则

- **代码事实优先**：代码、运行结果、测试与真实接口行为高于 README、历史文档和口头描述。
- **SSOT 优先**：同一能力只接受一个真源；不接受旁路实现、重复实现和“看起来差不多”的第二份逻辑。
- **明确失败优先**：宁可显式失败，也不接受静默 fallback、假成功、吞异常、补丁式兜底。
- **开发阶段反兼容**：重构、迁移、替换、升级时，不保留新旧并存、legacy flag、过渡包装或“修改后”类文案。
- **知识与交付同步**：需求、设计、代码、验证和文档要一起收口；重要变更不能只落在聊天里。
- **证据驱动完成态**：没有真实验证、文件证据或可复查结论时，不报告完成。

## 适用边界

- 这是 **策略入口 skill**，不是新的命令系统。
- 当前工作流、收尾格式、状态文件、验证契约都继续由 HelloAGENTS 现有 bootstrap 和 command skills 控制。
- `.helloagents/` 仍是项目知识、方案包、状态与证据的唯一项目级存储约定；不要在 skill 内重新发明另一套知识库目录。

## 激活方式

- 用户显式调用 `/atanycosts` 或 `$atanycosts`
- 用户要求“按 Atanycosts 规则来”“按配套 skills 审查”“看哪些不符合 / 不是单源实现”
- 用户明确要走毕设口径、反补丁清理、代码守门或前端工程化守门

## 子 Skill 路由

- **代码写完 / 改完后守门**：读取 `atanycosts-code-guard`
- **重构 / 改造 / 清理 / 迁移 / 下线**：读取 `atanycosts-refactor-clean`
- **明确是毕设项目**：读取 `atanycosts-bishe-stack`
- **前端 UI / UX / 页面工程化**：读取 `atanycosts-frontend-guard`

## 场景提醒

### 1. SSOT 与非单源审查

当用户要求“看看有哪些不符合 / 不是单源实现”时：

- 先围绕 **single-source-of-truth、anti-fallback、anti-duplicate** 审查
- 优先找真实行为分叉、双源配置、重复 caller、旧新语义并存
- 结论必须带证据位置，不做“整体还行”的泛化评价

### 2. 文档与知识同步

当代码或行为语义发生变化时：

- 同步检查 `.helloagents/` 下相关知识与方案文件是否需要更新
- 用户要求 Markdown 交付时，默认落仓，不只在对话里总结
- 文档任务以代码事实为准，不让旧文档盖过真实实现

### 3. SQL 与数据变更

当任务包含 schema 或数据变更时，额外执行以下约束：

- 禁止通过 shell 管道或 here-string 直接把 SQL 喂给数据库命令
- 必须先写 UTF-8 无 BOM `.sql` 文件
- 容器数据库优先走 `docker cp + docker exec ... -f`
- PostgreSQL 先处理 `client_encoding='UTF8'`
- 执行后补充最小编码验收与结果证据

### 4. 验证收口

当任务进入实现后期或用户要求“跑一下 / 验证一下 / 看更新有没有问题”时：

- 复用现有 `~verify` 主流程
- 不能只给启动步骤或口头判断
- 默认补真实运行、定向测试或最小可复查验证链路

## 约束说明

- 不在本 skill 内重定义命令别名、状态机、输出壳或项目模板结构
- 不把历史 Atanycosts 的 `references/ / functions/ / stages/` 目录整套搬回当前仓
- 只把稳定个人需求沉成 skill 规则；命令层与运行时门禁仍沿用 HelloAGENTS 现有实现

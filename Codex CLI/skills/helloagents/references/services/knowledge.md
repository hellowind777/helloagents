# 知识库服务 (KnowledgeService)

本模块定义知识库服务的完整规范，包括服务接口、执行者、数据所有权和同步规则。

---

## 服务概述

> 📌 规则引用: 知识库开关检查规则详见 G1 "KB开关检查规则"

```yaml
服务名称: KnowledgeService（知识库服务）
服务类型: 领域服务 (Domain Service)
适用范围: 所有涉及知识库操作的命令和阶段

核心职责:
  - 知识库创建和初始化
  - 项目上下文获取
  - 知识库同步（代码变更后）
  - CHANGELOG 更新管理
  - 知识库一致性验证

专用执行者: kb_keeper（服务绑定型角色）
数据所有权:
  - helloagents/INDEX.md
  - helloagents/context.md
  - helloagents/CHANGELOG.md
  - helloagents/modules/（所有模块文档）
  注意: 不包含 helloagents/plan/ 和 helloagents/archive/（属于 PackageService）
```

**执行时机:** 本模块被引用时首先执行知识库开关前置检查

**显式调用例外:** ~init 命令调用时，由 references/functions/init.md 处理确认流程

---

## 服务接口定义

> 📌 所有知识库操作必须通过服务接口，禁止直接操作文件

<service_interfaces>

### 接口1: create()

```yaml
功能: 创建新的知识库
触发时机: ~init 命令

参数: 无（使用当前工作目录）

执行流程:
  1. 检查 helloagents/ 目录是否存在
  2. 调用 init.py 脚本创建目录结构
  3. kb_keeper 扫描项目，填充文档内容
  4. 验证知识库完整性

返回值:
  success: boolean
  kb_path: 知识库路径
  files_created: 创建的文件列表
  errors: 错误列表（如有）

保证:
  - 知识库结构完整（见 G1 "知识库完整结构"）
  - 文档内容反映项目实际状态
```

### 接口2: sync(changes)

```yaml
功能: 同步知识库与代码变更
触发时机: develop 阶段代码变更后（步骤10）

参数:
  changes: 变更信息
    - files: 变更的文件列表
    - modules: 涉及的模块
    - type: 变更类型（add | modify | delete）

执行流程:
  1. 检查 KB_SKIPPED 状态
  2. 调用 synthesizer 检查代码与文档一致性
  3. kb_keeper 执行实际同步操作
  4. 验证同步结果

同步内容:
  必须同步:
    - modules/{模块名}.md: 更新职责、接口、行为规范
    - modules/_index.md: 更新模块索引
  按需同步:
    - context.md: 技术栈变化时
    - INDEX.md: 项目结构重大变化时

返回值:
  success: boolean
  synced_files: 同步的文件列表
  skipped: boolean（KB_SKIPPED = true 时）
  errors: 错误列表（如有）

保证:
  - 文档与代码一致
  - 最小变更原则
```

### 接口3: query(scope)

```yaml
功能: 查询项目上下文
触发时机: 任何需要项目上下文的场景

参数:
  scope: 查询范围
    - full: 完整上下文
    - modules: 仅模块信息
    - tech_stack: 仅技术栈
    - specific: 指定文件/模块

执行流程:
  1. 检查知识库是否存在
  2. 存在: 从知识库读取
  3. 不存在: 扫描代码库

返回值:
  context: 项目上下文信息
  source: "knowledge_base" | "code_scan"

执行者: 主代理（只读操作，无需 kb_keeper）
```

### 接口4: validate()

```yaml
功能: 验证知识库一致性
触发时机: ~validate 命令、流程验收

参数: 无

执行流程:
  1. kb_keeper 检查知识库结构
  2. 对比代码与文档
  3. 识别不一致项

返回值:
  valid: boolean
  issues: 问题列表
    - type: structure | content | outdated
    - file: 相关文件
    - message: 问题描述
```

### 接口5: updateChangelog(entry)

```yaml
功能: 更新 CHANGELOG
触发时机: 方案包归档后（由 PackageService 联动调用）

参数:
  entry: 变更记录
    - version: 版本号
    - date: 日期
    - type: 变更类型（新增/修复/变更/移除/微调/文档）
    - module: 模块名
    - description: 变更描述
    - package_link: 方案包链接
    - decisions: 决策ID列表（可选）

执行流程:
  1. 读取当前 CHANGELOG.md
  2. 按格式规范追加记录
  3. 写回文件

返回值:
  success: boolean
  version: 最终版本号

格式规范: 见下方 "CHANGELOG更新规则"
```

</service_interfaces>

---

## 执行者: kb_keeper

```yaml
角色定位: 服务绑定型角色（非通用能力型）
绑定服务: KnowledgeService
角色预设: rlm/roles/kb_keeper.md

职责范围:
  - 知识库创建和初始化填充
  - 代码与文档一致性同步
  - CHANGELOG 格式化更新
  - 知识库结构验证

调用方式:
  - 只能通过 KnowledgeService 接口调用
  - 禁止阶段模块直接调用 kb_keeper

协作关系:
  - 调用前: synthesizer 检查代码与文档一致性
  - 调用后: kb_keeper 执行实际同步操作
  - 接收 PackageService 的归档通知 → 更新 CHANGELOG
```

---

## 数据所有权

```yaml
独占写权限:
  helloagents/:
    - INDEX.md
    - context.md
    - CHANGELOG.md
    - CHANGELOG_{YYYY}.md（大型项目分片）
    - modules/_index.md
    - modules/*.md

排除（属于 PackageService）:
  - helloagents/plan/
  - helloagents/archive/

共享读权限:
  - 所有阶段模块可读取知识库内容
  - PackageService 可读取 CHANGELOG 格式

写入规则:
  - 只有 KnowledgeService 可以修改知识库文件
  - PackageService 通过 updateChangelog 接口请求 CHANGELOG 更新
  - 直接修改将破坏数据一致性
```

---

## 核心术语补充说明

> 📌 规则引用: 基础术语定义见主配置（G1: 知识库结构、G2: EHRB、G6: 方案包类型）

```yaml
SSOT 冲突处理:
  - 当知识库与代码不一致时，以代码为准（执行事实）
  - 更新知识库以反映代码的真实状态

方案包完整性检查:
  - 必需文件（proposal.md + tasks.md）存在
  - 文件非空
  - tasks.md至少1个任务项

决策ID:
  - 格式: {方案包名}#D{NNN}
  - 全局唯一可追溯
  - 详细格式见 templates.md
```

---

<context_acquisition_rules>
## 项目上下文获取策略

### 步骤1: 检查知识库（如存在）

```yaml
核心文件:
  - INDEX.md
  - context.md

按需选择:
  - modules/_index.md
  - modules/{module}.md
  - CHANGELOG.md
  - archive/_index.md
```

### 步骤2: 知识库不存在/信息不足 → 全面扫描代码库

```yaml
扫描内容:
  文件查找: 获取文件结构
  内容搜索: 搜索关键信息
  配置文件: 识别技术栈（根据项目自动识别）

获取目标:
  - 架构
  - 技术栈
  - 模块结构
  - 技术约束
```
</context_acquisition_rules>

---

<kb_sync_rules>
## 知识库同步

### 执行规则

```yaml
执行时机: 开发实施阶段完成代码改动后（步骤10）
前置检查: KB_SKIPPED = true 时跳过，标注"⚠️ 知识库同步已跳过"
```

### 同步内容

```yaml
必须同步:
  modules/{模块名}.md:
    - 更新受影响模块的职责、接口定义、行为规范、依赖关系
    - 接口变更时更新"接口定义"章节（公共API、数据结构）
    - 新增模块时创建对应文档
    - 删除模块时标记废弃或移除文档

  modules/_index.md:
    - 新增/删除模块时更新索引
    - 模块重命名时更新引用

按需同步:
  context.md:
    - 技术栈变化时更新（新增/移除依赖）
    - 架构调整时更新
    - 识别到技术债务时更新"已知技术债务"章节

  INDEX.md:
    - 项目结构有重大变化时更新
```

### 同步原则

```yaml
真实性基准:
  - 代码是执行真实性的唯一来源（Ground Truth）
  - 文档必须反映代码的客观事实
  - 不一致时更新文档，除非代码有明显Bug

最小变更:
  - 只更新与本次改动相关的内容
  - 不主动重构或优化无关文档

保持一致:
  - 术语、命名与代码保持一致
  - 模块边界与代码结构对应
```
</kb_sync_rules>

---

<changelog_rules>
## CHANGELOG更新规则

### 格式强制要求

```yaml
更新CHANGELOG时必须:
  1. 严格按照下方格式模板更新
  2. 包含所有必填字段
  3. 方案包链接使用相对路径
  4. 决策ID格式正确（{feature}#D{NNN}）

禁止:
  - 简化或省略格式
  - 只写一行简单描述
  - 省略方案包链接
  - 省略决策引用（如有决策）
```

### 变更记录格式（MUST FOLLOW）

```markdown
## [X.Y.Z] - YYYY-MM-DD

### 新增
- **[{模块名}]**: {变更描述}
  - 方案: [{YYYYMMDDHHMM}_{feature}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{feature}/)
  - 决策: {feature}#D001({决策摘要}), {feature}#D002({决策摘要})

### 修复
- **[{模块名}]**: {修复描述}
  - 方案: [{YYYYMMDDHHMM}_{fix}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{fix}/)

### 微调
- **[{模块名}]**: {微调描述}
  - 类型: 微调（无方案包）
  - 文件: {文件路径}:{行号范围}

### 回滚
- **[{模块名}]**: 回滚至 {版本/提交}
  - 原因: {回滚原因}
  - 方案: [{原方案包}](archive/{YYYY-MM}/{原方案包}/)
```

### 轻量迭代/标准开发模式记录规则

```yaml
触发条件: 开发实施阶段完成后
记录位置: helloagents/CHANGELOG.md

必填字段:
  - 版本号: [X.Y.Z]
  - 日期: YYYY-MM-DD
  - 分类: 新增/修复/变更/移除（根据变更类型）
  - 模块名: 涉及的模块
  - 变更描述: 清晰描述变更内容
  - 方案链接: 指向 archive/ 中的方案包
  - 决策引用: 如有技术决策，引用决策ID

示例:
  ## [1.2.0] - 2025-01-15

  ### 新增
  - **[用户模块]**: 添加用户登录功能
    - 方案: [202501151430_user-login](archive/2025-01/202501151430_user-login/)
    - 决策: user-login#D001(选择JWT认证)
```

### 微调模式记录规则

```yaml
触发条件: 改动≤2文件且≤30行，无方案包
记录位置: helloagents/CHANGELOG.md 的"微调"分类下
格式规范: 见上方"变更记录格式"

特殊规则（详见 references/stages/tweak.md）:
  - 微调模式始终设置 KB_SKIPPED = true，不触发完整知识库创建
  - KB_CREATE_MODE = 0 且 helloagents/ 不存在: 跳过 CHANGELOG 更新
  - KB_CREATE_MODE = 1/2/3 且 helloagents/ 不存在: 仅创建 helloagents/ 和 CHANGELOG.md
  - KB_CREATE_MODE = 1/2/3 且 helloagents/ 已存在: 更新 CHANGELOG.md
```

> 📌 规则引用: 目录/文件创建按 G1 "目录/文件自动创建规则" 执行

### Overview 类型方案包记录规则

```yaml
触发条件: overview 类型方案包被归档时
记录位置: helloagents/CHANGELOG.md 的"文档"分类下
执行时机: 归档操作完成后

格式规范:
  ## [X.Y.Z] - YYYY-MM-DD

  ### 文档
  - **[{模块名/主题}]**: {概述文档描述}
    - 方案: [{YYYYMMDDHHMM}_{feature}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{feature}/)
    - 类型: 概述文档（无执行任务）

版本号规则:
  - overview 类型通常为文档性变更，使用 Patch 版本递增
  - 如涉及重大架构说明，可由用户指定版本号

KB_CREATE_MODE 影响:
  - KB_CREATE_MODE = 0: 跳过 CHANGELOG 记录
  - KB_CREATE_MODE = 1/2/3: 正常记录
```

### 版本号管理

```yaml
版本号格式: X.Y.Z（语义化版本）
  X(Major): 破坏性变更
  Y(Minor): 新功能（向后兼容）
  Z(Patch): 修复/优化

版本号获取优先级:
  1. 用户明确指定
  2. 从主模块解析（按下方查找表）
  3. 从Git标签解析（如有，格式: vX.Y.Z 或 X.Y.Z）
  4. 使用已有CHANGELOG最新版本号递增

版本号校验:
  格式校验: 必须匹配 X.Y.Z 模式（X/Y/Z为非负整数）
  格式不合法时: 提示用户确认或使用默认规则

自动递增规则（无法获取版本号时）:
  已有CHANGELOG:
    - 读取最新版本号
    - 根据变更类型递增:
      - 破坏性变更 → Major+1, Minor=0, Patch=0
      - 新功能 → Minor+1, Patch=0
      - 修复/优化/微调 → Patch+1
  无CHANGELOG或无有效版本:
    - 使用 0.1.0 作为初始版本
```

### 多语言版本号来源

| 语言/框架 | 主来源 | 次来源 |
|----------|--------|--------|
| JavaScript/TypeScript | package.json → version | index.js → VERSION常量 |
| Python | pyproject.toml → [project].version | __init__.py → __version__ |
| Java(Maven) | pom.xml → <version> | - |
| Java(Gradle) | gradle.properties/build.gradle → version | - |
| Go | Git标签(tag) | - |
| Rust | Cargo.toml → [package].version | - |
| .NET | .csproj → <Version>/<AssemblyVersion> | - |
| C/C++ | CMakeLists.txt → project(...VERSION) | 头文件 → #define PROJECT_VERSION |
</changelog_rules>

---

<large_project_scaling>
## 大型项目扩展性

> 📌 规则引用: 详细规则见 references/rules/scaling.md

```yaml
核心要点:
  判定条件: 按 G9 "大型项目判定" 条件执行
  触发时机: 项目分析阶段时自动评估
  主要策略: CHANGELOG按年份分片、modules按类型分类、archive按年份索引
  详细规则: 见 references/rules/scaling.md
```
</large_project_scaling>

---

## 异常处理

```yaml
知识库不存在:
  - 项目上下文获取时自动切换为代码库扫描
  - 提示用户可执行 ~init 创建知识库

同步目标文件不存在:
  - 按 G1 "目录/文件自动创建规则" 自动创建
  - 创建后继续同步流程

CHANGELOG格式异常:
  - 尝试解析已有格式
  - 无法解析时在文件末尾追加新版本记录
  - 输出警告，建议手动检查格式

版本号解析失败:
  - 按优先级尝试下一来源
  - 全部失败时使用自动递增规则
  - 记录警告日志
```

---

## 服务引用关系

```yaml
被引用:
  - ~init 命令（知识库初始化）
  - ~upgrade 命令（知识库升级）
  - 开发实施阶段（知识库同步）
  - 微调模式（CHANGELOG更新）
  - ~rollback 命令（CHANGELOG回滚记录）

引用:
  - G1 KB开关检查规则
  - G1 目录/文件自动创建规则
  - G1 知识库结构
  - G2 EHRB规则
  - G6 方案包类型
  - references/rules/scaling.md（大型项目扩展规则）
  - references/services/templates.md（模板服务）
```

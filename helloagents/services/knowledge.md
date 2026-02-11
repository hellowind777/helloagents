# 知识库服务 (KnowledgeService)

本模块定义知识库服务的完整规范，包括服务接口、执行者、数据所有权和同步规则。

---

## 服务概述

```yaml
服务名称: KnowledgeService（知识库服务）
服务类型: 领域服务
适用范围: 所有涉及知识库操作的命令和阶段

核心职责: 知识库创建/初始化、项目上下文获取、知识库同步、CHANGELOG 更新、一致性验证

专用执行者: kb_keeper（服务绑定型角色）
数据所有权:
  - {KB_ROOT}/INDEX.md, context.md, CHANGELOG.md, CHANGELOG_{YYYY}.md
  - {KB_ROOT}/modules/（所有模块文档）
  排除: {KB_ROOT}/plan/ 和 {KB_ROOT}/archive/（属于 PackageService）
```

**执行时机:** 被引用时首先执行前置检查（含知识库开关、目录迁移、版本检测）
**显式调用例外:** ~init 由 functions/init.md 处理确认流程

---

## 前置检查（所有接口调用前自动执行）

```yaml
步骤1 - 知识库开关检查:
  KB_CREATE_MODE=0 且无 {KB_ROOT}/: KB_SKIPPED=true，跳过后续检查

步骤2 - 旧目录名迁移:
  检测: 项目根目录是否存在 helloagents/（旧版目录名）
  脚本: upgradewiki.py --migrate-root
  status=migrated: 静默完成，提示已自动迁移 helloagents/ → .helloagents/
  status=conflict: 新旧目录同时存在 → 输出: 确认（让用户选择保留哪个）→ ⛔ END_TURN
  status=not_needed/not_found: 静默继续

步骤3 - 知识库版本检测:
  条件: {KB_ROOT}/ 存在
  检测: 读取 {KB_ROOT}/INDEX.md 中的 kb_version 字段
  处理:
    kb_version 缺失或低于当前框架版本:
      补全缺失的目录和文件（对比 G1 知识库目录结构，缺什么补什么）
      更新 INDEX.md 中的 kb_version 为当前版本
      提示: "知识库结构已自动升级至 {当前版本}"
    kb_version 与当前版本一致: 静默继续
```

---

## 服务接口

**DO:** 所有知识库操作通过服务接口执行，所有写入内容使用 {OUTPUT_LANGUAGE}（代码标识符/技术术语保持原样）

**DO NOT:** 直接操作知识库文件，绕过服务接口修改，使用非 {OUTPUT_LANGUAGE} 语言写入知识库文件

### create()

```yaml
触发: ~init 命令
流程: 检查 {KB_ROOT}/ → upgradewiki.py --init → kb_keeper 扫描填充 → 验证完整性
返回: success, kb_path, files_created, errors
保证: 知识库结构完整，文档反映项目实际状态
```

### sync(changes)

```yaml
触发: develop 阶段代码变更后（步骤9）
参数: changes { files, modules, type(add|modify|delete) }
流程: 检查 KB_SKIPPED → synthesizer 一致性检查 → kb_keeper 同步 → 验证结果

必须同步:
  - modules/{模块名}.md: 更新职责、接口、行为规范、依赖
  - modules/_index.md: 新增/删除/重命名模块时更新
按需同步:
  - context.md: 技术栈变化时
  - INDEX.md: 项目结构重大变化时

返回: success, synced_files, skipped, errors
```

### query(scope)

```yaml
触发: 任何需要项目上下文的场景
参数: scope (full | modules | tech_stack | specific)
流程: 知识库存在→读取 | 不存在→扫描代码库
返回: context, source("knowledge_base"|"code_scan")
执行者: 主代理（只读，无需 kb_keeper）
```

### validate()

```yaml
触发: ~validatekb 命令、流程验收
流程: kb_keeper 检查结构 → 对比本次变更涉及的代码与文档 → 识别不一致项
返回: valid, issues[{type(structure|content|outdated), file, message}]
```

### updateChangelog(entry)

```yaml
触发: 方案包归档后（由 PackageService 调用）
参数: entry { version, date, type, module, description, package_link, decisions }
流程: 读取 CHANGELOG.md → 按格式追加记录 → 写回
返回: success, version
```

---

## 执行者: kb_keeper

```yaml
角色定位: 服务绑定型（非通用能力型），预设: rlm/roles/kb_keeper.md
职责: 知识库创建填充、代码与文档同步、CHANGELOG 更新、结构验证
调用: 只能通过 KnowledgeService 接口
协作: synthesizer 检查一致性 → kb_keeper 执行同步 → 接收 PackageService 归档通知
```

---

## 项目上下文获取策略

### 步骤1: 检查知识库（如存在）

```yaml
核心: INDEX.md, context.md
按需: modules/_index.md, modules/{module}.md, CHANGELOG.md, archive/_index.md
```

### 步骤2: 知识库不存在/信息不足 → 扫描代码库

```yaml
策略: 优先读取配置文件（package.json/pyproject.toml 等）识别技术栈 → 信息不足时按需扫描目录结构和源代码
目标: 架构、技术栈、模块结构、技术约束
```

---

## 知识库同步规则

```yaml
执行时机: 开发实施阶段完成代码改动后（步骤9）
前置检查: KB_SKIPPED = true → 跳过，标注"⚠️ 知识库同步已跳过"

同步原则:
  真实性基准: 代码为唯一来源，文档反映代码客观事实，不一致时更新文档
  最小变更: 只更新与本次改动相关的内容
  保持一致: 术语命名与代码一致，模块边界与代码结构对应
```

---

## CHANGELOG 更新规则

### 变更记录格式（MUST FOLLOW）

```markdown
## [X.Y.Z] - YYYY-MM-DD

### 新增
- **[{模块名}]**: {变更描述}
  - 方案: [{YYYYMMDDHHMM}_{feature}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{feature}/)
  - 决策: {feature}#D001({决策摘要})

### 修复
- **[{模块名}]**: {修复描述}
  - 方案: [{YYYYMMDDHHMM}_{fix}](archive/{YYYY-MM}/{YYYYMMDDHHMM}_{fix}/)

### 快速修改
- **[{模块名}]**: {修改描述}
  - 类型: 快速修改（无方案包）
  - 文件: {文件路径}:{行号范围}

### 回滚
- **[{模块名}]**: 回滚至 {版本/提交}
  - 原因: {回滚原因}
```

**DO:** 严格按格式模板更新，包含所有必填字段，方案包链接使用相对路径，决策ID格式正确

**DO NOT:** 简化或省略格式，只写一行简单描述，省略方案包链接

### 记录规则

| 模式 | 触发 | 记录位置 | 特殊规则 |
|------|------|----------|----------|
| R2 简化流程/R3 标准流程 | 开发实施完成后 | CHANGELOG.md | 必填：版本号+日期+分类+模块+描述+方案链接 |
| R1 快速流程 | ROUTING_LEVEL = R1 | CHANGELOG.md 快速修改分类 | KB_SKIPPED=true，不触发完整知识库创建 |
| Overview 归档 | overview 方案包归档时 | CHANGELOG.md 文档分类 | Patch 版本递增 |

**R1 快速流程 KB 行为:**
```yaml
KB_CREATE_MODE=0 且无 {KB_ROOT}/: 跳过 CHANGELOG
KB_CREATE_MODE=1/2/3 且无 {KB_ROOT}/: 仅创建 {KB_ROOT}/ 和 CHANGELOG.md
KB_CREATE_MODE=1/2/3 且有 {KB_ROOT}/: 更新 CHANGELOG.md
```

### 版本号管理

```yaml
格式: X.Y.Z（语义化版本）
  X(Major): 破坏性变更 | Y(Minor): 新功能 | Z(Patch): 修复/优化

获取优先级: 用户指定 → 主模块解析（已知项目类型时直接读取对应来源）→ Git标签 → CHANGELOG最新递增 → 0.1.0

自动递增: 破坏性→Major+1 | 新功能→Minor+1 | 修复/优化/快速修改→Patch+1
```

### 多语言版本号来源

| 语言/框架 | 主来源 | 次来源 |
|----------|--------|--------|
| JavaScript/TypeScript | package.json → version | index.js → VERSION |
| Python | pyproject.toml → version | __init__.py → __version__ |
| Java(Maven) | pom.xml → version | - |
| Java(Gradle) | gradle.properties → version | - |
| Go | Git标签 | - |
| Rust | Cargo.toml → version | - |
| .NET | .csproj → Version | - |
| C/C++ | CMakeLists.txt → VERSION | 头文件 #define |
| Flutter/Dart | pubspec.yaml → version | - |
| Swift(SPM) | Package.swift → version | .xcconfig → MARKETING_VERSION |

---

## 大型项目扩展性

> 详细规则见 {HELLOAGENTS_ROOT}/rules/scaling.md

```yaml
核心: 判定条件按 G9 复杂度判定标准（TASK_COMPLEXITY=complex），项目分析阶段评估
策略: CHANGELOG按年份分片、modules按类型分类、archive按年份索引
```

---

## 核心术语补充

```yaml
SSOT 冲突: 知识库与代码不一致 → 以代码为准，更新知识库
方案包完整性: proposal.md + tasks.md 存在且非空，tasks.md ≥1 任务项
决策ID: {feature}#D{NNN}，全局唯一可追溯
```

---

## 异常处理

| 异常 | 处理 |
|------|------|
| 知识库不存在 | 切换代码库扫描，提示 ~init |
| 同步目标文件不存在 | 按 G1 写入策略自动创建 |
| CHANGELOG格式异常 | 尝试解析→失败则末尾追加→输出警告 |
| 版本号解析失败 | 按优先级尝试下一来源→全部失败使用自动递增 |

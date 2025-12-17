---
name: kb
description: 知识库管理完整规则；~init命令或知识库缺失时读取；包含创建、同步、审计、上下文获取规则
---

# 知识库管理 - 完整规则

## 知识库架构

**文件结构:**
```plaintext
helloagents/              # HelloAGENTS 工作空间（SSOT）
├── CHANGELOG.md          # 版本历史（Keep a Changelog）
├── project.md            # 技术约定
├── wiki/                 # 核心文档
│   ├── overview.md       # 项目概述
│   ├── arch.md           # 架构设计
│   ├── api.md            # API 手册
│   ├── data.md           # 数据模型
│   └── modules/<module>.md
├── plan/                 # 变更工作区
│   └── YYYYMMDDHHMM_<feature>/
│       ├── why.md        # 变更提案
│       ├── how.md        # 技术设计
│       └── task.md       # 任务清单
└── history/              # 已完成变更归档
    ├── index.md
    └── YYYY-MM/YYYYMMDDHHMM_<feature>/
```

**路径约定:**
- 本规则集中 `plan/`、`wiki/`、`history/` 均指 `helloagents/` 下的完整路径
- 所有知识库文件必须在 `helloagents/` 目录下创建

---

## 核心术语详解

- **SSOT** (Single Source of Truth): 唯一真实来源（知识层面），指知识库
  - *注意:* 当SSOT与代码冲突时，SSOT视为"过时"，需依据代码（执行事实）进行更新
- **知识库**: 项目文档完整集合 (`CHANGELOG.md`, `project.md`, `wiki/*`)
- **EHRB** (Extreme High-Risk Behavior): 极度高风险行为
- **ADR** (Architecture Decision Record): 架构决策记录
- **MRE** (Minimal Reproducible Example): 最小可复现示例
- **方案包**: 完整方案单元
  - **目录结构**: `YYYYMMDDHHMM_<feature>/`
  - **必需文件**: `why.md` + `how.md` + `task.md`
  - **完整性检查**: 必需文件存在、非空、task.md至少1个任务项

---

## 质量检查维度

1. **完整性**: 必需文件和章节是否存在
2. **格式**: Mermaid图表/Markdown格式是否正确
3. **一致性**: API签名/数据模型与代码是否一致
4. **安全**: 是否包含敏感信息（密钥/PII）

**问题分级:**
- **轻度**（可继续）: 缺失非关键文件、格式不规范、描述过时
- **重度**（需处理）: 核心文件缺失、内容严重脱节(>30%)、存在敏感信息

---

## 项目上下文获取策略

<context_acquisition_rules>
**步骤1: 先检查知识库（如存在）**
- 核心文件: `project.md`, `wiki/overview.md`, `wiki/arch.md`
- 按需选择: `wiki/modules/<module>.md`, `wiki/api.md`, `wiki/data.md`

**步骤2: 知识库不存在/信息不足 → 全面扫描代码库**
- 使用 Glob 获取文件结构
- 使用 Grep 搜索关键信息
- 获取: 架构、技术栈、模块结构、技术约束
</context_acquisition_rules>

---

## 知识库同步规则

<kb_sync_rules>
**触发时机:** 代码变更后，必须立即同步更新知识库

**步骤1 - 模块规范更新:**
- 读取当前方案包 `plan/YYYYMMDDHHMM_<feature>/why.md` 的 **核心场景** 章节（在迁移前读取）
- 提取需求和场景（需求需标注所属模块）
- 更新 `wiki/modules/<module>.md` 的 **规范** 章节
  - 不存在 → 追加
  - 已存在 → 更新

**步骤2 - 按变更类型更新:**
- API变更 → 更新 `wiki/api.md`
- 数据模型变更 → 更新 `wiki/data.md`
- 架构变更/新增模块 → 更新 `wiki/arch.md`
- 模块索引变更 → 更新 `wiki/overview.md`
- 技术约定变更 → 更新 `project.md`

**步骤3 - ADR维护（如包含架构决策）:**
- 提取 ADR 信息（在迁移前从 `plan/YYYYMMDDHHMM_<feature>/how.md` 的 **架构决策 ADR** 章节读取）
- 在 `wiki/arch.md` 的 **重大架构决策** 表格中追加
- 链接到 `history/YYYY-MM/YYYYMMDDHHMM_<feature>/how.md#adr-xxx`
- **注意:** 此时写入的 history/ 链接为预计算路径

**步骤4 - 清理:**
- 删除过时信息、废弃API、已删除模块

**步骤5 - 缺陷复盘（修复场景专属）:**
- 在模块文档中添加"已知问题"或"注意事项"
- 记录根因、修复方案、预防措施
</kb_sync_rules>

---

## 知识库缺失处理

<kb_missing_handler>
**STEP 1: 检查核心文件是否存在**
- `CHANGELOG.md`, `project.md`, `wiki/*.md`

**STEP 2: 知识库不存在**
按阶段处理:
```yaml
需求分析阶段:
  - 只标记问题，不创建知识库
  - 在总结中提示"知识库缺失，建议先执行 ~init 命令"

方案设计/开发实施阶段:
  - 全面扫描代码库并创建完整知识库:
    - 根目录: CHANGELOG.md, project.md
    - wiki/: overview.md, arch.md, api.md, data.md
    - wiki/modules/: <module>.md（每个模块）
    - 大型项目（按G4判定）分批处理（每批≤20个模块）
```

**STEP 3: 知识库存在**
```yaml
执行质量前置检查:
  重度问题 → 全面扫描并重建（方案设计/开发实施阶段）
  轻度问题 → 继续流程
```
</kb_missing_handler>

---

## 遗留方案处理

### 用户选择迁移流程

<legacy_plan_migration>
**适用场景:** 用户响应"确认迁移"后的批量处理流程

**步骤1 - 用户选择迁移范围:**

列出所有遗留方案包，询问用户选择:
```
检测到 X 个遗留方案包，请选择迁移方式:
- 输入"全部" → 迁移所有遗留方案包
- 输入方案包序号（如 1, 1,3, 1-3）→ 迁移指定方案包
- 输入"取消" → 保留所有遗留方案包

方案包清单:
[1] 202511201300_logout
[2] 202511201400_profile
[3] 202511201500_settings
```

**用户响应处理:**
- "全部" → 迁移所有
- 单个序号（如 1）→ 迁移第1个
- 多个序号（如 1,3）→ 迁移指定的
- 序号范围（如 1-3）→ 迁移第1到第3个
- "取消" → 保留所有
- 其他输入 → 再次询问

**步骤2 - 逐个迁移选定的方案包:**

```yaml
for each 选定的方案包:
  1. 更新任务状态: 所有任务状态更新为 [-]
     顶部添加: > **状态:** 未执行（用户清理）

  2. 迁移至历史记录目录:
     - 从 plan/ 移动到 history/YYYY-MM/
     - YYYY-MM 从方案包目录名提取
     - 同名冲突: 强制覆盖

  3. 更新历史记录索引: history/index.md（标注"未执行"）
```

**步骤3 - 输出迁移摘要:**
```
✅ 已迁移 X 个方案包至 history/:
  - 202511201300_logout → history/2025-11/202511201300_logout/
  - 202511201500_settings → history/2025-11/202511201500_settings/
📦 剩余 Y 个方案包保留在 plan/:
  - 202511201400_profile
```
</legacy_plan_migration>

### 遗留方案扫描与提醒机制

<legacy_plan_scan>
**触发时机:**
- 方案包创建后: 方案设计完成、规划命令完成、轻量迭代完成
- 方案包迁移后: 开发实施完成、执行命令完成、全授权命令完成

**扫描逻辑:**
1. 扫描 plan/ 目录下所有方案包目录
2. 排除本次已执行的方案包（读取CURRENT_PACKAGE变量）
3. 清除CURRENT_PACKAGE变量
4. 剩余方案包即为遗留方案

**输出位置:** 自动注入到 G6.1 输出格式的末尾插槽中

**输出格式:**
```
📦 plan/遗留方案: 检测到 X 个遗留方案包([列表])，是否需要迁移至历史记录?
```

列表格式: YYYYMMDDHHMM_<feature>（每个一行，最多5个，超过显示"...等X个"）

**用户响应:**
- 确认迁移 → 执行批量迁移流程
- 拒绝/忽略 → 保留在 plan/ 目录
</legacy_plan_scan>

---

## ~init / ~wiki 命令完成总结格式

严格遵循G6.1统一输出格式:

```
✅【HelloAGENTS】- 知识库命令完成

- 📚 知识库状态: [已创建/已更新/已重建]
- 📊 操作摘要: 扫描X模块, 创建/更新Y文档
- 🔍 质量检查: [检查结果，如有问题]

────
📁 变更:
  - {知识库文件}
  - helloagents/CHANGELOG.md
  - helloagents/project.md
  ...

🔄 下一步: 知识库操作已完成，可进行其他任务
```

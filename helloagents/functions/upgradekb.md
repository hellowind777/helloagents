# ~upgradekb 命令 - 升级知识库

本模块定义 AI 驱动的知识库升级流程。

---

## 命令说明

```yaml
命令: ~upgradekb
类型: 场景确认类
功能: 升级知识库结构至最新框架标准
特点: AI 分析内容语义，动态匹配模板，支持任意源格式
评估: 需求理解 + EHRB 检测（不评分不追问）
```

---

## 执行模式适配

```yaml
规则:
  1. 独立工具命令，不受 WORKFLOW_MODE 影响
  2. KB_CREATE_MODE=0 时需用户确认后执行
  3. 升级前强制备份，确保可恢复
  4. AI 负责内容分析，脚本负责文件操作
```

---

## 执行流程

### 步骤1: 需求理解 + EHRB 检测

```yaml
无独立输出，直接进入下一步
```

### 步骤2: 扫描与分析

```yaml
知识库开关检查:
  KB_CREATE_MODE=0: 输出: 确认（开关状态）
    ⛔ END_TURN
    用户确认后:
      继续: 继续下方流程
      取消: → 状态重置
  KB_CREATE_MODE=1/2/3: 直接继续

读取模板文件（按需，用到哪个读哪个）:
  - {TEMPLATES_DIR}/INDEX.md, context.md, CHANGELOG.md
  - {TEMPLATES_DIR}/modules/_index.md, archive/_index.md
  - {TEMPLATES_DIR}/plan/proposal.md, plan/tasks.md

扫描知识库:
  旧目录名迁移检测:
    脚本: upgradewiki.py --migrate-root
    status=migrated → 提示已自动迁移 helloagents/ → .helloagents/，继续
    status=conflict → 输出: 确认（新旧目录同时存在）→ 用户选择保留哪个 → ⛔ END_TURN
    status=not_needed/not_found → 静默继续
  脚本: upgradewiki.py --scan
  获取: 目录结构和文件列表（JSON格式）
```

### AI 内容分析

```yaml
1. 读取源文件内容（跳过非知识库文件）

2. 识别内容类型:
   项目概述类 | 需求类 | 方案类 | 技术设计类 | 变更记录类 | 模块文档类 | 方案包类

3. 分析映射关系:
   内容类型 → 目标模板对应章节
   处理合并（多源→一目标）和拆分（一源→多目标）

4. 生成升级计划:
   列出操作（创建/合并/重命名/删除）+ 源内容与目标位置 + 风险评估

展示升级计划:
  输出: 确认（源文件分析+升级计划+注意事项）
  ⛔ END_TURN
  用户确认后:
    执行升级: → 步骤3
    查看详情: 展示更多细节后再确认
    取消: → 状态重置
```

### 步骤3: 执行升级

```yaml
备份: upgradewiki.py --backup（必须成功后才继续）

创建目录结构: upgradewiki.py --init

AI 生成目标内容: 读取源 → 按模板格式重组 → 填充占位符

写入文件:
  方式A: AI 直接写入每个目标文件
  方式B（大量文件）: AI 生成操作计划 JSON → upgradewiki.py --write plan.json

清理（可选）: 用户确认后删除已迁移源文件
```

### 步骤4: CLI 环境配置

```yaml
Codex CLI 配置（自动检测，非 Codex 环境跳过）:
  脚本: configure_codex.py
  功能: 设置 project_doc_max_bytes = 98304（96 KiB），防止规则文件被截断
  安全: 仅在参数未设置或低于目标值时写入，不修改已有配置
```

### 步骤5: 后续操作

```yaml
验收: 按 G8 命令级验收标准执行
  ⛔ 阻断性: 知识库结构符合目标版本，核心文件完整（INDEX.md, context.md 存在且非空）
  ⚠️ 警告性: 内容无丢失（对比源/目标内容）

验收方式: 调用 ~validatekb 仅知识库模式

验收失败:
  阻断性: 输出: 警告，建议从备份恢复
  警告性: 记录到升级报告，提示检查
  用户选择: 从备份恢复 / 忽略继续（仅警告性）/ 手动修复

输出: 完成（验收报告+备份路径）
→ 状态重置
```

---

## 安全约束

```yaml
强制约束:
  - 仅操作 {KB_ROOT}/ 目录
  - 执行前必须备份
  - 冲突时不覆盖（报错并请求用户决策）
  - 不删除未识别的文件（保留原位置）

备份:
  位置: 项目根目录/helloagents_backup_{YYYYMMDDHHMMSS}/
  内容: 完整的 {KB_ROOT}/ 目录副本
```

---

## 内容映射规则

> AI 根据以下指导原则进行内容映射。

```yaml
项目信息 → context.md:
  特征: 项目名称、介绍、技术栈、团队、规范

变更记录 → CHANGELOG.md:
  特征: 版本号、日期、变更内容

模块文档 → modules/:
  特征: 功能模块说明、API文档、组件文档

方案包 → plan/ 或 archive/:
  特征: YYYYMMDDHHMM_feature 命名格式
  映射: why.md+how.md→proposal.md, task.md→tasks.md
  位置: 未完成→plan/, 已完成→archive/YYYY-MM/

常见旧结构映射:
  wiki/ → modules/ | history/ → archive/ | project.md → context.md
  v1.0/v1.x 特有: wiki/overview.md+arch.md → context.md, wiki/api.md+data.md → modules/
  v2.0 → v2.2.3: 目录名 helloagents/ → .helloagents/，补建 sessions/

升级后必须:
  - 确保 INDEX.md 包含 kb_version 字段（设为当前框架版本）
  - 确保 sessions/ 目录存在
```

---

## 不确定性处理

| 场景 | 处理 |
|------|------|
| 源文件格式无法识别 | 保留原位置，标注"需人工处理" |
| 内容映射冲突 | 请求用户决策 |
| 备份失败 | 中止升级，提示检查磁盘空间 |

---

## 脚本参考

```yaml
扫描: upgradewiki.py --scan → JSON 文件列表和目录结构
创建: upgradewiki.py --init → 标准目录结构
备份: upgradewiki.py --backup → 备份结果（路径）
写入: upgradewiki.py --write <plan.json> → 执行结果
```

### 写入计划格式

```json
{
  "operations": [
    {"action": "write", "path": "context.md", "content": "..."},
    {"action": "rename", "from": "old.md", "to": "new.md"},
    {"action": "delete", "path": "obsolete.md"},
    {"action": "mkdir", "path": "subdir"}
  ]
}
```

---

## 设计原则（参考）

```yaml
职责分离:
  AI 负责: 读取模板理解目标结构 → 分析源文件语义 → 识别内容类型 → 决定映射关系 → 生成目标内容
  脚本负责: 扫描目录(--scan) → 创建结构(--init) → 备份(--backup) → 写入(--write)

关键约束:
  - 脚本不做内容分析和格式转换
  - 模板文件是唯一权威来源（SSOT）
  - AI 通过读取模板动态理解目标格式
```

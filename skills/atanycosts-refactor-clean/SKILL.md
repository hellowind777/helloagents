---
name: atanycosts-refactor-clean
description: Atanycosts 反兼容反补丁重构守门。重构、改造、迁移、清理时，禁止新旧并存、过渡包装、fallback 补丁和版本旗标残留。
---

# Atanycosts Refactor Clean

这个 skill 只处理一件事：**让重构后的语义干净**。

在 HelloAGENTS 现有 `~plan / ~build / ~verify` 流程里，它作为重构类任务的附加守门，不接管命令，也不引入第二套阶段体系。

## 何时激活

- 用户请求“重构 / 改造 / 清理 / 下线 / 迁移 / 升级 / 替换 / 重写”
- 审查中发现新旧逻辑并存、兼容口、过渡命名或补丁分支
- 用户显式调用 `/atanycosts-refactor-clean`

## 核心判断

如果当前还是开发阶段，就默认：

- **没有线上老代码必须兼容**
- **旧逻辑保留不是保险，而是债务**
- **Git 已保存历史，不需要在代码里留墓碑**

## 清理维度

### 1. 新旧代码并存

判违规：

- `oldMethod()` 和 `newMethod()` 同时暴露
- 旧接口和新接口同时保留、调用方混用
- `OldUserService` / `UserService` 双实现
- 双表、双模型、双存储路径长期并存

处理：

- 迁移调用方后，直接删旧实现
- 保留一个稳定入口，不允许双轨运行

### 2. 过渡性命名

判违规：

- `legacy_`、`old_`、`new_`、`temp_`、`_v2`、`_backup`
- `_unused`、`_deprecated` 这种占位保留

处理：

- 改成稳定业务命名
- 真不用的直接删

### 3. 过渡性注释和文案

判违规：

- `// 修改后`、`// removed`、`// 新版`、`// 旧逻辑`
- 文档、README、UI 文案里带“改版后 / 升级后 / 新流程”

处理：

- 描述当前行为，不和旧版本对照
- Git 负责历史，代码和文档只呈现当前事实

### 4. 版本 flag 与兼容开关

判违规：

- `if (legacyMode)`
- `if (useNewAuth)`
- 新旧路径由环境变量切换
- `legacy.enabled=true`

处理：

- 删除 flag，只保留当前版本路径
- 如果还离不开 flag，说明迁移没做完，继续推进迁移

### 5. fallback 包装

判违规：

- 新逻辑失败时退回旧逻辑
- `try { newLogic() } catch { oldLogic() }`
- “先走新接口，失败再偷走旧接口”

处理：

- 删除 fallback
- 保持失败可见，让问题暴露在正确层级

### 6. 重复抽象

判违规：

- 为“未来可能”预留但只有一个实现的接口
- 无明确收益的 adapter / facade / wrapper
- 一个实体拆成多份近似模型长期并存

处理：

- 删除无收益抽象
- 收敛到一个真模型和一条主链路

## 工作方式

- 优先列出需要删除或迁移的内容，再执行
- 删除旧实现前先保证调用方已迁到新语义
- 牵涉前端、SDK、README、接口说明时同步收口
- 涉及数据库和 schema 调整时，同时遵守 SQL 文件化与编码校验约束

## 和其他 skill 的边界

- 与 `atanycosts-code-guard` 的关系：
  - `code-guard` 看“写得对不对”
  - `refactor-clean` 看“改得干不干净”
- 与 `hello-arch` 协同做边界和职责判断
- 与 `hello-review` 协同做证据化审查

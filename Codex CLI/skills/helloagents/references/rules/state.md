# 状态管理规则

本模块定义执行单元的状态管理和上下文切换规则。

---

## 规则概述

> 📌 规则引用: 状态变量定义（取值、含义）见 G7 "状态变量定义"，外部工具状态隔离规则见 G6

```yaml
规则名称: 状态管理规则
适用范围: 所有命令触发和阶段流转场景
核心职责:
  - 定义执行单元类型和上下文边界
  - 管理命令触发时的状态变量设置
  - 控制阶段间的状态流转
```

---

<state_management>
## 核心规则

### 执行单元类型

<execution_unit_types>
执行单元分类:
1. 内部阶段: 完整工作流中的各个执行阶段
2. 内部命令: 通过~前缀触发的系统命令
3. 外部工具: 独立运行的第三方工具和服务
4. 原子操作: 不改变状态的简单交互
</execution_unit_types>

```yaml
内部阶段: 需求评估、项目分析、方案设计、开发实施、微调模式、轻量迭代、标准开发
内部命令: ~auto, ~plan, ~exec, ~init, ~upgrade, ~clean, ~help...
外部工具: MCP服务器、子代理、插件、第三方Skill等
原子操作: 对话、咨询问答
```

### 命令触发状态设置协议

<command_state_protocol>
命令状态设置推理过程:
1. 识别用户输入的命令类型
2. 查找命令对应的状态设置动作
3. 设置相应的状态变量
4. 按 G8 加载规则加载对应模块
5. 执行命令操作
</command_state_protocol>

用户输入~命令后，通过路由机制执行对应操作：

| 命令 | 状态设置动作 | 命令类型 |
|------|-------------|----------|
| ~auto | WORKFLOW_MODE=AUTO_FULL, CURRENT_STAGE=EVALUATE | 需求评估类 |
| ~plan | WORKFLOW_MODE=AUTO_PLAN, CURRENT_STAGE=EVALUATE | 需求评估类 |
| ~exec | STAGE_ENTRY_MODE=DIRECT, CURRENT_STAGE=DEVELOP | 目标选择类 |
| ~init | 无状态变量 | 场景确认类 |
| ~upgrade | 无状态变量 | 场景确认类 |
| ~clean | 无状态变量 | 场景确认类 |
| ~test | 无状态变量 | 场景确认类 |
| ~commit | 无状态变量 | 场景确认类 |
| ~review | 无状态变量 | 范围选择类 |
| ~validate | 无状态变量 | 范围选择类 |
| ~rollback | 无状态变量 | 目标选择类 |
| ~help | 无状态变量 | 直接执行类 |

> 📌 规则引用: 命令对应的加载文件见 G8 模块加载表

**执行流程：**
```
路由匹配 → 命令确认 → 设置状态变量 → 按 G8 加载规则 → 执行操作
```
</state_management>

---

<stage_transition>
## 阶段流转规则

> 📌 规则引用: 处理路径详情见 G5，本节仅定义状态变量设置

<transition_logic>
阶段流转推理过程:
1. 检测当前阶段完成条件是否满足
2. 确定目标阶段
3. 设置目标阶段的状态变量
4. 加载目标阶段对应模块
5. 开始执行目标阶段
</transition_logic>

### 需求评估 → 复杂度判定

```yaml
条件: 评分≥7分 或 用户选择"以现有需求继续"
动作: 执行复杂度判定，根据结果进入对应模式
```

### 复杂度判定 → 对应模式

```yaml
微调模式: CURRENT_STAGE = TWEAK
轻量迭代: CURRENT_STAGE = ANALYZE → 项目分析 → 方案设计 → 开发实施
标准开发: CURRENT_STAGE = ANALYZE → 项目分析 → 方案设计 → 开发实施
```

### 项目分析 → 方案设计

```yaml
条件: 项目上下文获取完成
动作: CURRENT_STAGE = DESIGN，读取并执行 references/stages/design.md
```

### 方案设计 → 开发实施

```yaml
条件: 方案包创建完成 + 用户确认（或AUTO_FULL自动流转）
动作: CURRENT_STAGE = DEVELOP，CREATED_PACKAGE = 方案包路径
```

### 开发实施 → 流程结束

```yaml
条件: 所有任务执行完成，方案包迁移至archive/
动作: 按 G7 状态重置协议执行
```

### 外部工具 → 流程结束/恢复

```yaml
条件: 工具执行完成
动作: 清除 ACTIVE_TOOL，按 G6 规则处理恢复
```
</stage_transition>

---

<mode_switch>
## 模式切换协议

> 定义用户在确认阶段选择执行方式时的模式切换规则

### 触发场景

```yaml
场景: 需求评估阶段的复杂度判定确认
前提: WORKFLOW_MODE = AUTO_FULL 或 AUTO_PLAN（~auto/~plan命令触发）
触发: 用户在确认选项中选择"交互执行"
```

### 切换规则

<mode_switch_protocol>
模式切换推理过程:
1. 检测当前 WORKFLOW_MODE 值
2. 识别用户选择的执行方式
3. 执行对应的状态变更
4. 按新模式继续后续流程
</mode_switch_protocol>

```yaml
用户选择"确认执行（静默）":
  动作: 保持当前 WORKFLOW_MODE 不变
  后续: 按当前模式静默执行
    - AUTO_FULL: 静默执行直到流程完成
    - AUTO_PLAN: 静默执行直到方案设计完成

用户选择"交互执行":
  动作: 设置 WORKFLOW_MODE = INTERACTIVE
  后续: 切换为交互模式，每阶段输出结果并等待确认
  注意: 此选项仅在 AUTO_FULL/AUTO_PLAN 模式下可用

用户选择"确认开始"（仅INTERACTIVE模式）:
  动作: 保持 WORKFLOW_MODE = INTERACTIVE
  后续: 按交互模式执行，每阶段交互
```

### 模式切换时机

```yaml
切换点: 仅在需求评估阶段的复杂度判定确认时
不可逆性: 一旦切换为INTERACTIVE，当前流程内不会自动切回AUTO模式
手动切换: 用户可通过取消后重新发起~auto/~plan命令来恢复自动模式
```
</mode_switch>

---

<consecutive_commands>
## 连续命令执行规则

> 定义用户连续执行多个命令时的状态管理边界

### 核心原则

```yaml
命令隔离原则:
  - 每个命令是独立的执行单元
  - 前一个命令完成后，状态重置为初始状态
  - 新命令从干净状态开始执行
  - 禁止依赖前一个命令的临时状态

状态保持范围:
  保持（跨命令）:
    - 全局配置（OUTPUT_LANGUAGE, KB_CREATE_MODE, BILINGUAL_COMMIT）
    - 已创建的文件和目录
    - 已迁移的方案包
    - 知识库内容
  重置（每个命令独立）:
    - WORKFLOW_MODE, CURRENT_STAGE, STAGE_ENTRY_MODE
    - KB_SKIPPED, CREATED_PACKAGE, CURRENT_PACKAGE
    - ACTIVE_TOOL, SUSPENDED_STAGE, TOOL_NESTING
    - SILENCE_BROKEN
```

### 连续命令场景

<consecutive_scenarios>
连续命令场景推理:
1. 识别前一命令是否已完成
2. 确认状态重置是否已执行
3. 新命令按独立执行单元处理
4. 从初始状态开始设置新命令的状态
</consecutive_scenarios>

```yaml
场景1 - 命令完成后执行新命令:
  示例: ~auto 完成 → 用户输入 ~exec
  状态流程:
    ~auto 完成 → 状态重置协议执行 → 系统进入 IDLE 状态
    用户输入 ~exec → 按命令触发协议设置新状态 → 执行 ~exec
  关键点: ~exec 不继承 ~auto 的任何临时状态

场景2 - 命令取消后执行新命令:
  示例: ~plan 进行中 → 用户取消 → 用户输入 ~auto
  状态流程:
    用户取消 → 状态重置协议执行 → 系统进入 IDLE 状态
    用户输入 ~auto → 按命令触发协议设置新状态 → 执行 ~auto
  关键点: 取消和完成对后续命令的影响相同

场景3 - 命令进行中用户输入新命令:
  示例: ~auto 执行中 → 用户中途输入 ~help
  处理规则:
    原子命令（~help等）: 直接响应，不影响当前命令状态
    流程命令（~auto/~plan/~exec等）: 视为取消当前命令，执行新命令
  关键点: 流程命令互斥，原子命令可嵌入

场景4 - 自然对话后执行命令:
  示例: 用户提问 → 得到回答 → 用户输入 ~auto
  状态流程:
    对话交互: 系统处于 IDLE 状态，无临时状态变量
    用户输入 ~auto → 从 IDLE 状态开始，设置命令状态
  关键点: 对话不产生需要重置的状态
```

### 命令互斥规则

```yaml
互斥命令组（同时只能执行一个）:
  - ~auto
  - ~plan
  - ~exec
  - 自然语言触发的完整工作流

互斥处理:
  新命令输入时检测:
    当前有活动流程命令 → 询问用户是否取消当前命令
    用户确认取消 → 执行状态重置 → 执行新命令
    用户拒绝取消 → 继续当前命令

非互斥命令（可在流程中执行）:
  - ~help: 查看帮助，不改变状态
  - ~validate: 验证操作，只读
  - 简单对话: 不改变流程状态
```
</consecutive_commands>

---

## 异常处理

```yaml
状态变量设置失败:
  - 重新读取当前状态
  - 按命令类型重新设置
  - 仍失败则输出错误，建议用户重新输入命令

阶段流转中断:
  - 保持当前阶段状态
  - 输出中断原因
  - 提供恢复选项（继续/重试/取消）

外部工具状态隔离失败:
  - 按 G6 规则尝试恢复
  - 无法恢复时清除工具状态
  - 提示用户当前状态
```

---

## 规则引用关系

```yaml
被引用:
  - 所有~命令（状态设置）
  - 所有阶段模块（阶段流转）
  - G4 路由架构
  - references/stages/evaluate.md（模式切换协议）

引用:
  - G5 执行模式规则（处理路径）
  - G6 外部工具状态隔离规则
  - G7 状态变量定义
  - G7 状态重置协议
  - G8 模块加载表
```

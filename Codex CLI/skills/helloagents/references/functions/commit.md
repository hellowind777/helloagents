# ~commit 命令 - Git 提交

本模块定义 Git 提交的执行规则，基于 Conventional Commits 国际规范。

---

## 命令说明

```yaml
命令: ~commit [<message>]
类型: 场景确认类
功能: 智能生成提交信息并执行 Git 提交，提交前必须用户确认
```

---

## 执行模式适配

> 📌 规则引用: 按 G4 路由架构及 G5 执行模式规则执行

<mode_adaptation>
~commit 模式适配规则:
1. 本命令为独立工具命令，不受 WORKFLOW_MODE 影响
2. 评估深度: 轻量评估（无评分追问）
3. 提交前必须用户确认，不自动执行
4. 根据远程配置动态显示推送选项
5. 支持本地提交、推送、创建PR三种模式
</mode_adaptation>

---

## 执行约束

```yaml
核心约束:
  - 本命令只负责提交现有变更，不负责创建变更
  - 用户描述中的"目标说明"作为提交范围参考，不执行文件操作
  - 禁止在用户确认前执行任何改变项目文件状态的操作
```

---

## 执行流程

### 步骤1: 轻量评估

```yaml
执行规则: 按 G4 "需求评估规则"执行（轻量评估），按 G3 场景内容规则（需求评估）输出
```

### 步骤2: 环境检测与变更分析

```yaml
经上一步骤用户确认后，进行环境检测::
  执行命令:
    - git rev-parse --git-dir（验证仓库）
    - git status --porcelain（检测变更）
    - git remote -v（检测远程配置）
    - git branch --show-current（获取当前分支）

  异常处理:
    非 Git 仓库: 按 G3 场景内容规则（错误）输出，建议执行 git init
    无变更: 按 G3 场景内容规则（完成）输出，提示无需提交

变更分析:
  执行命令: git diff HEAD
  分析内容: 变更内容，提取核心改动点

提交信息生成:
  无参数时: 根据变更内容确定 type/scope，智能生成 summary 和 body
  有参数时: 使用用户提供的 message 作为 summary
    - 根据语义分析确定 type
    - 如已包含 emoji/type 前缀，直接使用不重复添加
    - body 根据变更内容补充（可选）

输出: 按 G3 场景内容规则（确认）输出，见"用户选择处理 - 提交确认"
```

### 步骤3: 执行提交与推送

```yaml
经上一步骤用户确认后，执行提交:
  git add .
  git commit -m "{提交信息}"

如用户选择推送:
  推送前检查:
    git fetch origin
    git rev-list --count HEAD..origin/{branch}（远程领先数）
    git rev-list --count origin/{branch}..HEAD（本地领先数）

  自动处理:
    远程领先: 自动执行 git pull --rebase → 成功则继续推送
    本地领先: 直接执行 git push origin {branch}
    分叉状态: 自动执行 git pull --rebase
    有冲突: 输出冲突信息，提示用户手动处理，流程结束

如用户选择创建PR:
  推送完成后自动引导创建 PR
```

### 步骤4: 后续操作

```yaml
输出内容（按场景）:
  本地提交: 提交信息摘要 + 提交哈希 + 变更文件数
  提交并推送: 提交信息摘要 + 已推送到 origin/{branch}
  提交并创建PR: 提交信息摘要 + PR 创建链接或引导

执行: 按 G6 状态重置协议执行
```

---

## 不确定性处理

- 非 Git 仓库 → 按 G3 场景内容规则（错误）输出，建议 git init
- 无变更 → 按 G3 场景内容规则（完成）输出，提示无需提交
- 远程推送冲突 → 输出冲突信息，提示手动处理
- 变更类型难以判定 → 默认使用 chore 类型，提示用户确认

---

## 用户选择处理

### 场景: 提交确认

```yaml
内容要素:
  - 当前分支和远程仓库状态
  - 变更摘要（新增/修改/删除文件数）
  - 关键改动点
  - 提交信息预览（框线包裹）
  - 提交方式选项（根据远程配置动态显示）

选项:
  仅本地提交: 执行 git commit
  提交并推送: 执行 git commit + git push
  提交并创建PR: 执行 git commit + git push + 引导创建 PR
  修改信息: 进入追问流程
  取消: 按 G6 状态重置协议执行
```

### 场景: 提交信息修改（追问）

```yaml
内容要素:
  - 当前提交信息预览（框线包裹）
  - 输入方式说明（完整格式/简短描述/确认/取消）

信息满足判定: AI 根据语义判断用户输入是否可作为提交信息

选项:
  输入满足条件: 更新提交信息，重新展示确认
  输入"确认": 使用当前信息，重新展示确认
  输入"取消": 按 G6 状态重置协议执行
  输入不满足条件: 重新展示追问

循环直到: 用户选择提交方式 或 取消
```

---

## 附录

### 提交信息格式（Conventional Commits）

#### 基础格式

```
<emoji> <type>[(scope)]: <summary>

[body]

[footer]
```

#### 类型映射表

| emoji | type | 说明 |
|-------|------|------|
| 🎉 | init | 项目初始化 |
| ✨ | feat | 新功能 |
| 🐞 | fix | 错误修复 |
| 📃 | docs | 文档变更 |
| 🌈 | style | 代码格式化 |
| 🦄 | refactor | 代码重构 |
| 🎈 | perf | 性能优化 |
| 🧪 | test | 测试相关 |
| 🔧 | build | 构建系统 |
| 🐎 | ci | CI 配置 |
| 🐳 | chore | 辅助工具 |
| ↩ | revert | 撤销提交 |

#### 格式规则

```yaml
summary: 动词开头，≤50字符，不加句号
body: 说明变更动机（可选），每行≤72字符
footer: 关联 issue 或 BREAKING CHANGE（可选）
```

### 双语模式

```yaml
配置: BILINGUAL_COMMIT（见 G1）

BILINGUAL_COMMIT = 0: 仅使用 OUTPUT_LANGUAGE
BILINGUAL_COMMIT = 1: 本地语言块在上，英文块在下，用 --- 分隔，两块均为完整格式且精确互译
```

### 特殊场景处理

```yaml
首次提交:
  特征: git log 为空
  处理: type=init，summary 建议"项目初始化"

功能分支:
  判定: 根据分支命名约定判断（如 feature/*, fix/* 等）
  处理: 推送后提示创建 PR

破坏性变更:
  特征: 删除公共 API、修改数据结构等
  处理: type 后添加 !，footer 添加 BREAKING CHANGE

回滚:
  触发: 用户说"回滚上次提交"
  处理: 执行 git revert HEAD，type=revert
```

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
4. 本命令只负责提交现有变更，禁止执行文件操作
5. 根据远程配置动态显示推送选项（本地提交/推送/创建PR）
</mode_adaptation>

---

## 执行流程

### 步骤1: 轻量评估

```yaml
执行规则: 按 G4 "需求评估规则"执行（轻量评估），按 G3 输出
```

### 步骤2: 环境检测与变更分析

```yaml
环境检测:
  命令: git rev-parse --git-dir, git status --porcelain, git remote -v, git branch --show-current
  异常:
    非 Git 仓库: 按 G3 输出错误，建议 git init
    无变更: 按 G3 输出完成，提示无需提交

变更分析:
  已跟踪文件: git diff HEAD
  新文件: 直接读取文件内容
  有远程时: git diff origin/{branch}...HEAD 获取完整变更

提交信息生成:
  原则:
    - 基于 git diff 实际代码变更生成，而非提交动作描述
    - 禁止使用"同步"、"更新"等动作词作为主要描述
    - summary 描述"改了什么"而非"做了什么"
  过滤:
    - 排除 README*.md、LICENSE*、CHANGELOG* 等文档
    - 聚焦核心代码/规则的实质性变更
  无参数: 分析 diff 确定 type/scope，生成 summary
  有参数: 使用用户 message，自动补充 type/emoji
  首次提交: type=init，summary="项目初始化"
  破坏性变更: type 后添加 !，footer 添加 BREAKING CHANGE

输出: 按 G3 输出，见"用户选择处理 - 提交确认"
```

### 步骤3: 执行提交与推送

```yaml
提交: git add . && git commit -m "{提交信息}"

推送（如用户选择）:
  检查: git fetch origin, 对比本地/远程领先数
  远程领先: 自动 git pull --rebase 后推送
  有冲突: 输出冲突信息，提示手动处理，流程结束

创建PR（如用户选择）: 推送后引导创建 PR

完成后: 按 G6 状态重置协议执行
```

---

## 用户选择处理

### 场景: 提交确认

```yaml
内容要素:
  - 当前分支/远程状态
  - 变更摘要（新增/修改/删除文件数）
  - 关键改动点
  - 提交信息预览（框线包裹）

选项:
  A. 仅本地提交
  B. 提交并推送（有远程时显示）
  C. 提交并创建PR（有远程时显示）
  D. 修改信息 → 进入追问
  E. 取消 → G6 状态重置
```

### 场景: 提交信息修改

```yaml
内容要素: 当前提交信息预览

处理:
  输入有效信息: 更新后重新展示确认
  输入"确认": 使用当前信息
  输入"取消": G6 状态重置
```

---

## 附录: 类型映射

> 遵循 Conventional Commits 规范，emoji 映射如下

| type | emoji | | type | emoji |
|------|-------|-|------|-------|
| init | 🎉 | | feat | ✨ |
| fix | 🐞 | | docs | 📃 |
| refactor | 🦄 | | perf | 🎈 |
| test | 🧪 | | chore | 🐳 |
| revert | ↩ | | style | 🌈 |

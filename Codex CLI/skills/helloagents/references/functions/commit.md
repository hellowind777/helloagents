# ~commit 命令 - Git 提交

本模块定义 Git 提交的执行规则，基于 Conventional Commits 国际规范。

---

## 命令说明

```yaml
命令: ~commit [<message>]
类型: 场景确认类
功能: 智能生成提交信息并执行 Git 提交
触发: 用户明确表达提交意图时执行，默认不自动提交

触发方式:
  自然语言: 用户表达提交意图（"帮我提交代码"、"提交这些变更"）
    → Layer 3 意图判定识别 → 加载本模块执行
  仅命令: "~commit"
    → Layer 2 命令匹配 → 加载本模块执行
  命令+参数: "~commit 修复登录bug"
    → Layer 2 命令匹配 + 提取参数 → 参数作为 summary 处理

参数处理:
  无参数: 根据变更内容智能生成提交信息
  有参数: 使用用户提供的 message 作为 summary
    - 根据语义分析确定 type
    - 如已包含 emoji/type 前缀，直接使用不重复添加
    - 应用双语规则（BILINGUAL_COMMIT=1 时）
```

---

## 执行模式适配

> 📌 规则引用: 按 G4 路由架构及 G5 执行模式规则执行

<mode_adaptation>
~commit 模式适配规则:
1. 本命令为独立工具命令，不受 WORKFLOW_MODE 影响
2. 提交前必须用户确认，不自动执行
3. 根据远程配置动态显示推送选项
4. 支持本地提交、推送、创建PR三种模式
</mode_adaptation>

---

## 意图判定规则（CRITICAL）

```yaml
核心原则: 根据用户语义意图判断，默认不自动提交

禁止行为:
  - 禁止在用户未明确表达提交意图时自动提交
  - 禁止将"完成开发"等模糊表达等同于"提交代码"
```

---

## 执行流程

### 步骤1: 环境检测

<git_env_analysis>
Git 环境检测推理过程:
1. 验证当前目录是否为 Git 仓库
2. 检测是否存在未提交的变更
3. 获取远程仓库配置和当前分支信息
</git_env_analysis>

```yaml
前置条件:
  - 当前目录是 Git 仓库
  - 存在未提交的变更

执行命令:
  - git rev-parse --git-dir（验证仓库）
  - git status --porcelain（检测变更）
  - git remote -v（检测远程配置）
  - git branch --show-current（获取当前分支）

异常处理:
  非 Git 仓库: 按 G3 场景内容规则（错误）输出，建议执行 git init
  无变更: 按 G3 场景内容规则（完成）输出，提示无需提交
```

### 步骤2: 变更分析与信息生成

<commit_message_analysis>
提交信息生成推理过程:
1. 分析 git diff HEAD 输出内容
2. 识别变更类型（新增/修改/删除）
3. 提取核心改动点和功能描述
4. 根据 Conventional Commits 规范生成提交信息
5. 应用双语模式（如启用）
</commit_message_analysis>

```yaml
执行命令: git diff HEAD
分析内容: 变更内容，提取核心改动点

提交信息生成:
  无参数时: 根据变更内容确定 type/scope，智能生成 summary 和 body
  有参数时: 使用用户提供的 message 作为 summary
    - 根据语义分析确定 type
    - 如已包含 emoji/type 前缀，直接使用不重复添加
    - body 根据变更内容补充（可选）
```

### 步骤3: 触发响应

```yaml
输出: 按 G3 场景内容规则（确认）输出，见"用户选择处理 - 提交确认"

[等待用户响应]

用户选择后按对应选项处理
```

### 步骤4: 自动执行

<commit_execution_analysis>
提交执行推理过程:
1. 根据用户选择确定执行范围
2. 执行 git add 和 git commit
3. 如需推送，检测远程状态并处理冲突
4. 如需创建 PR，引导用户完成
</commit_execution_analysis>

```yaml
执行提交:
  git add .
  git commit -m "{提交信息}"

如用户选择推送:
  检测远程状态
  远程领先时: 自动执行 git pull --rebase
  有冲突时: 输出冲突信息，提示用户手动处理，流程结束
  无冲突: 执行 git push origin {branch}

如用户选择创建PR:
  推送完成后自动引导创建 PR
```

### 步骤5: 完成输出

```yaml
输出: 按 G3 场景内容规则（完成）输出执行结果（见"完成后输出"）
执行: 按 G7 状态重置协议执行
```

---

## 不确定性处理

- 非 Git 仓库 → 按 G3 场景内容规则（错误）输出，建议 git init
- 无变更 → 按 G3 场景内容规则（完成）输出，提示无需提交
- 远程推送冲突 → 输出冲突信息，提示手动处理
- 变更类型难以判定 → 默认使用 chore 类型，提示用户确认

---

## 用户选择处理

> 本章节定义 ~commit 命令需要用户确认的场景，供 G3 输出格式统一提取。

### 场景: 提交确认（检测完成后）

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
  取消: 按 G7 状态重置协议执行
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
  输入"取消": 按 G7 状态重置协议执行
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
配置: BILINGUAL_COMMIT

BILINGUAL_COMMIT = 0（默认）:
  仅使用 OUTPUT_LANGUAGE

BILINGUAL_COMMIT = 1:
  格式: 本地语言块在上，英文块在下，用 --- 分隔
  结构: 两个块均为完整格式（emoji + type + scope + summary + body）
  要求: 两个语言块必须是精确互译，语义完全一致

  示例:
    ✨ feat(auth): 添加用户登录功能

    - 实现基于 JWT 的身份验证

    ---

    ✨ feat(auth): add user login feature

    - Implement JWT-based authentication
```

### 变更分析示例

```yaml
示例 - 新增功能:
  git diff HEAD 输出:
    diff --git a/src/auth/login.py b/src/auth/login.py
    new file mode 100644
    +def login(username: str, password: str) -> dict:
    +    user = db.find_user(username)
    +    if user and verify_password(password, user.password_hash):
    +        return {"token": generate_jwt(user)}
    +    raise AuthError("Invalid credentials")

  分析过程:
    1. 检测到新文件 src/auth/login.py
    2. 识别新增函数 login()，功能为用户登录验证
    3. 确定 type=feat, scope=auth
    4. 生成 summary: "添加用户登录验证功能"

  生成提交信息:
    ✨ feat(auth): 添加用户登录验证功能

    - 新增 login() 函数实现用户名密码验证
    - 验证成功返回 JWT token
```

### 完成后输出

```yaml
本地提交完成:
  按 G3 场景内容规则（完成）输出:
    - 提交信息摘要
    - 提交哈希
    - 变更文件数
    - 下一步建议: 可输入"推送"同步到远程

提交并推送完成:
  按 G3 场景内容规则（完成）输出:
    - 提交信息摘要
    - 已推送到 origin/{branch}
    - 仓库地址

提交并创建PR完成:
  按 G3 场景内容规则（完成）输出:
    - 提交信息摘要
    - 已推送到 origin/{branch}
    - PR 创建链接或引导
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

### 远程推送

```yaml
推送前检查（自动）:
  执行: git fetch origin
  执行: git rev-list --count HEAD..origin/{branch}（远程领先数）
  执行: git rev-list --count origin/{branch}..HEAD（本地领先数）

自动处理:
  远程领先（有新提交）:
    自动执行 git pull --rebase
    成功: 继续推送
    有冲突: 输出冲突信息，提示手动处理，流程结束

  本地领先（可推送）:
    执行: git push origin {branch}

  分叉状态:
    自动执行 git pull --rebase
    有冲突: 输出冲突信息，提示手动处理，流程结束

推送失败处理: 根据错误信息分析原因并提示用户
```

### 排除文件

```yaml
不纳入提交信息描述（仍会被提交）:
  根据常识判断辅助性文件（如根目录文档、配置文件等）
```

### 提交粒度原则

```yaml
单一职责: 单次提交只做一类变更
可构建原则: 每个提交应可独立构建
禁止混入: 无关格式化、临时调试代码、未完成功能
```

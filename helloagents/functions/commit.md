# ~commit 命令 - Git 提交

本模块定义 Git 提交的执行规则，基于 Conventional Commits 国际规范。

---

## 命令说明

```yaml
命令: ~commit [<message>]
类型: 场景确认类
功能: 生成提交信息并执行 Git 提交
评估: 需求理解 + EHRB 检测（不评分不追问）
```

---

## 执行模式适配

```yaml
规则:
  1. 独立工具命令，不受 WORKFLOW_MODE 影响
  2. 提交前必须用户确认，不自动执行
  3. 根据远程配置动态显示推送选项
  4. 支持: 本地提交 / 推送 / 创建PR
```

---

## 执行约束

```yaml
核心约束: 只负责提交现有变更，不负责创建变更
用户描述中的"目标说明"作为提交范围参考，不执行文件操作
```

**DO NOT:** 在用户确认前执行任何读取或改变项目文件状态的操作

---

## 执行流程

### 步骤1: 需求理解 + EHRB 检测

```yaml
无独立输出，直接进入下一步
```

### 步骤2: 环境检测与变更分析

```yaml
环境检测:
  命令: git rev-parse --git-dir | git status --porcelain | git remote -v | git branch --show-current
  非 Git 仓库: 输出: 错误，建议 git init
  无变更: 输出: 完成，提示无需提交

变更分析:
  有远程: git diff origin/{branch}...HEAD（完整变更）
  仅本地: git diff HEAD（已跟踪文件）
  新文件: 直接读取文件内容
  目标: 提取核心改动点，过滤非核心文件

提交信息生成:
  来源: 基于 git diff 实际代码变更
  过滤: 排除 README*.md、LICENSE*、CHANGELOG*、.gitignore 等
  无参数: 分析 diff → 识别 type/scope → summary 描述"改了什么"
  有参数: 使用用户 message，语义分析确定 type

输出: 确认（提交确认）
⛔ END_TURN

用户选择后:
  仅本地提交: git commit
  提交并推送: git commit + git push
  提交并创建PR: git commit + git push + 引导创建PR
  修改信息: 进入追问流程
  取消: → 状态重置

追问流程:
  AI 判断用户输入是否可作为提交信息
  满足: 更新信息，重新展示确认
  "确认": 使用当前信息
  "取消": → 状态重置
  不满足: 重新展示追问
```

### 步骤3: 执行提交与推送

```yaml
前置: 步骤2用户选择提交方式后

暂存策略（分步暂存，禁止直接 git add .）:
  1. 文件清单: 执行 git status 获取所有变更文件列表
  2. 敏感文件检测: 检查变更文件中是否包含 .env、*credential*、*secret*、*.pem、*.key 等敏感文件
     - 发现敏感文件: 从暂存列表中排除，输出警告告知用户
  3. 展示暂存清单: 向用户展示将要暂存的文件列表（已排除敏感文件）
     - 用户确认后执行暂存
     - 用户可手动排除额外文件
  4. 执行暂存: 优先使用 git add <具体文件路径> 逐一添加，避免 git add .
     - 文件数量过多（>20）时可使用 git add . 配合 .gitignore 和 git reset HEAD <敏感文件>

提交: git commit -m "{提交信息}"

推送处理（用户选择推送时）:
  推送前: git fetch origin + 检查远程/本地领先数
  远程领先: git pull --rebase → 继续推送
  本地领先: git push origin {branch}
  分叉状态: git pull --rebase
  有冲突: 输出冲突信息，提示手动处理，流程结束

创建PR: 推送完成后引导创建
```

### 步骤4: 后续操作

```yaml
L2 会话摘要: 提交完成后写入 [→ services/memory.md L2 写入触发点]

输出内容:
  本地提交: 提交信息摘要 + 提交哈希 + 变更文件数
  提交并推送: 提交信息摘要 + 已推送到 origin/{branch}
  提交并创建PR: 提交信息摘要 + PR 创建链接或引导

输出: 完成
→ 状态重置
```

---

## 不确定性处理

| 场景 | 处理 |
|------|------|
| 非 Git 仓库 | 输出: 错误，建议 git init |
| 无变更 | 输出: 完成，提示无需提交 |
| 远程推送冲突 | 输出冲突信息，提示手动处理 |
| 变更类型难以判定 | 默认 chore 类型，提示用户确认 |

---

## 附录

### 提交信息格式（Conventional Commits）

```
<emoji> <type>[(scope)]: <summary>

[body]

[footer]
```

### 类型映射表

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

### 格式规则

```yaml
summary: 动词开头，≤50字符，不加句号
body: 说明变更动机（可选），每行≤72字符
footer: 关联 issue 或 BREAKING CHANGE（可选）
```

### 双语模式

```yaml
BILINGUAL_COMMIT=0: 仅使用 OUTPUT_LANGUAGE
BILINGUAL_COMMIT=1: 本地语言块在上，英文块在下，用 --- 分隔，两块均为完整格式且精确互译
```

### 特殊场景处理

| 场景 | 特征 | 处理 |
|------|------|------|
| 首次提交 | git log 为空 | type=init，summary="项目初始化" |
| 功能分支 | feature/*, fix/* | 推送后提示创建PR |
| 破坏性变更 | 删除公共API、修改数据结构 | type 后添加 !，footer 添加 BREAKING CHANGE |
| 回滚 | 用户说"回滚上次提交" | git revert HEAD，type=revert |

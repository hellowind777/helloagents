# ~status 命令 - 快速状态查看

直接执行类命令（与 ~help 同级），只读操作，无需确认。

---

## 执行规则

```yaml
触发: ~status
流程: 收集各项状态信息 → 汇总展示
输出: 状态栏 + 下方状态汇总 + 下一步引导
说明: 原子操作，只读，无状态变量设置
```

---

## 采集项

```yaml
1. 工作流状态:
   - WORKFLOW_MODE（当前工作流模式）
   - ROUTING_LEVEL（当前路由级别）
   - CURRENT_STAGE（当前阶段）
   - 无活跃工作流时显示"空闲"

2. 子代理状态:
   - 活跃子代理数量和角色列表（从 SessionManager 获取）
   - Agent Teams 状态（如有活跃团队：团队ID+成员数+当前进度）
   - 无活跃子代理时显示"无"

3. 知识库状态:
   - {KB_ROOT}/ 是否存在
   - KB_CREATE_MODE 当前值
   - 知识库文件数量（存在时）

4. 活跃方案包:
   - 扫描 {KB_ROOT}/plan/ 目录
   - 列出各方案包名称与状态（有 tasks.md 时读取进度）
   - 无方案包时显示"无"

5. 最近会话摘要:
   - 读取 {KB_ROOT}/sessions/ 最新 1 条摘要
   - 不存在时显示"无历史会话"

6. Git 状态:
   - 当前分支名
   - 未提交变更数（git status --porcelain 行数）
   - 非 Git 仓库时显示"非 Git 仓库"

7. 更新检查:
   - UPDATE_CHECK 当前值（0=关闭，正整数=缓存有效小时数，默认72）
   - 读取 ~/.helloagents/.update_cache 缓存（expires_at 未过期则使用），超期时执行 `helloagents version --force --cache-ttl {UPDATE_CHECK}`
   - 命令不可用时显示"未安装"
```

---

## 输出模板

```
💡【HelloAGENTS】- 状态概览

📊 工作流: {WORKFLOW_MODE} | 级别: {ROUTING_LEVEL} | 阶段: {CURRENT_STAGE}

🤖 子代理: {活跃数量+角色列表 或 "无"}  团队: {Agent Teams 状态 或 "无"}

📚 知识库: {存在/不存在} (KB_CREATE_MODE={值})

📦 方案包: {方案包列表或"无"}

📝 最近会话: {摘要或"无历史会话"}

🔀 Git: {分支名} | 未提交变更: {数量}

⬆️ 更新检查: UPDATE_CHECK={值} | {helloagents version 输出或"未安装"}

🔄 下一步: 输入需求开始工作，或使用 ~help 查看可用命令
```

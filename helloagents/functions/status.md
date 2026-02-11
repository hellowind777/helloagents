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

2. 知识库状态:
   - {KB_ROOT}/ 是否存在
   - KB_CREATE_MODE 当前值
   - 知识库文件数量（存在时）

3. 活跃方案包:
   - 扫描 {KB_ROOT}/plan/ 目录
   - 列出各方案包名称与状态（有 tasks.md 时读取进度）
   - 无方案包时显示"无"

4. 最近会话摘要:
   - 读取 {KB_ROOT}/sessions/ 最新 1 条摘要
   - 不存在时显示"无历史会话"

5. Git 状态:
   - 当前分支名
   - 未提交变更数（git status --porcelain 行数）
   - 非 Git 仓库时显示"非 Git 仓库"

6. 更新检查:
   - UPDATE_CHECK 当前值（0=关闭/1=开启）
   - 缓存状态（读取 {HELLOAGENTS_ROOT}/user/.update_cache，显示上次检查时间和结果）
   - 缓存不存在时显示"未检查过"
```

---

## 输出模板

```
💡【HelloAGENTS】- 状态概览

📊 工作流: {WORKFLOW_MODE} | 级别: {ROUTING_LEVEL} | 阶段: {CURRENT_STAGE}

📚 知识库: {存在/不存在} (KB_CREATE_MODE={值})

📦 方案包: {方案包列表或"无"}

📝 最近会话: {摘要或"无历史会话"}

🔀 Git: {分支名} | 未提交变更: {数量}

⬆️ 更新检查: UPDATE_CHECK={值} | {上次检查时间及结果或"未检查过"}

🔄 下一步: 输入需求开始工作，或使用 ~help 查看可用命令
```

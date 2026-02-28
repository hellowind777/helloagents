# ~help 命令 - 显示帮助

直接执行类命令，加载后按模板输出，无需文件操作或环境扫描。

---

## 执行规则

```yaml
触发: ~help 或 ~?
流程: 如用户输入携带上下文（疑问、困惑）→ 先简短回应，再输出帮助信息
输出: 状态栏 + 下方模板内容 + 下一步引导
说明: 原子操作，无状态变量设置
```

---

## 输出模板

```
ℹ️【HelloAGENTS】- 帮助

HelloAGENTS 是结构化任务工作流系统，支持需求评估、方案设计、开发实施与验收验证。

📋 可用命令:
  ~help / ~?        显示此帮助
  ~init             初始化项目知识库
  ~auto <需求>      全自动执行（评估→设计→开发）
  ~plan <需求>      全自动规划（评估→设计，不执行）
  ~exec [方案包]    执行已有方案包
  ~status           查看当前状态
  ~commit           提交代码变更
  ~test             运行测试
  ~review           代码审查
  ~clean            清理会话缓存
  ~rollback         回滚代码变更
  ~validatekb       验证知识库一致性
  ~upgradekb        升级知识库结构
  ~cleanplan        清理遗留方案包
  ~rlm              子代理编排与协作（输入 ~rlm 查看子命令）

💡 使用方式:
  命令路径: ~命令 + 需求描述（如 ~auto 实现用户登录）
  通用路径: 直接描述需求，系统自动路由至 R0~R3 级别
  外部工具: 调用 MCP/搜索等外部工具时自动识别

⚙️ 全局开关（config.json 配置）:
  OUTPUT_LANGUAGE / KB_CREATE_MODE / BILINGUAL_COMMIT / EVAL_MODE / UPDATE_CHECK / CSV_BATCH_MAX

🔄 下一步: 输入需求开始工作，或使用 ~init 初始化知识库
```

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
- HelloAGENTS 是结构化任务工作流系统，可按需求执行评估、分析、设计、开发与验证。
- 可用命令: ~auto ~plan ~exec ~init ~upgradekb ~clean ~cleanplan ~commit ~test ~review ~validatekb ~rollback ~rlm ~status ~help
- 使用方式:
    - ~命令 需求描述 (例: ~auto 修复登录超时并补测试)
    - 或直接描述需求 (系统会自动判定 R0~R3 并执行)
- 路由机制: 命令路径 (~xxx) / 外部工具路径 (Skill/MCP/插件) / 通用路径 (自动判级执行)
- 子代理按 G9 复杂度判定强制/跳过调用 (explorer、analyzer、designer、implementer、reviewer、tester 等) [→ G9/G10]
- 全局开关 (G1): KB_CREATE_MODE(知识库) | EVAL_MODE(评估) | UPDATE_CHECK(更新检查，0=关闭/正整数=小时，默认72)
```

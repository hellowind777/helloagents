# HelloAGENTS v3.1.8 beta

## 中文

### 安全增强

- Git 提交前自查规则从"警告用户"升级为"主动处理"：凭据硬编码、个人隐私、本地硬编码路径等敏感字符串替换为占位符；环境配置文件、私有文档等敏感文件/目录加入 `.gitignore`；无法自动处理的警告用户
- 自查规则置于安全检查第二层语义扫描（所有操作前持续生效），自动提交机制独立保留在本地版本检查点（按 `auto_commit_enabled` 触发），两处职责清晰无重叠
- 本地版本检查点恢复多行排版，AI 逐步执行更清晰

### 变更记录

- `feat` 安全检查第二层升级：凭据/隐私/本地路径主动替换为占位符，敏感文件加入 .gitignore
- `refactor` 本地版本检查点多行格式，自查与自动提交职责分离

## English

### Security Enhancements

- Git pre-commit self-check upgraded from "warn user" to "proactive handling": hardcoded credentials, PII, and local absolute paths replaced with placeholders; environment config files and private documents added to `.gitignore`; warns only when auto-handling is not feasible
- Self-check rule placed in Security Check Layer 2 (semantic scan, always active); auto-commit mechanics remain in Local Version Checkpoint (gated by `auto_commit_enabled`), with clear separation of concerns
- Local Version Checkpoint restored to multi-line layout for clearer step-by-step AI execution

### Changelog

- `feat` Security Layer 2 upgrade: credentials/PII/local paths auto-replaced with placeholders, sensitive files added to .gitignore
- `refactor` multi-line Local Version Checkpoint; separate self-check from auto-commit mechanics

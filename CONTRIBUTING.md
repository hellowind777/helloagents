# 参与贡献

感谢关注 HelloAGENTS。

## 开发环境

- Node.js 22 或更高。
- 仓库零依赖，克隆即用，无需 `npm install`。

## 提交前

- `npm test` 必须全部通过（55 项测试，约数秒）。
- 类型检查（可选，本地需要 TypeScript 6）：`npm install --no-save typescript @types/node && npm run typecheck`。CI 会强制执行。
- 修改提示词（prompts/、skills/）时注意：内核不超过 420 行（契约测试会校验）；技能遵循“判断框架 + 质量标准 + 交付前自问”的结构；中文标点使用规范（引号成对），契约测试会校验。

## 原则

- 运行时保持零依赖、无构建步骤。
- 新增任何机制前先回答：删除它会导致什么具体错误？答不出就不加（内核“简单优先”一节对本仓库同样生效）。
- 用户可见文案一律中英双语，登记在 `src/kernel/messages.mjs`。
- skills/eva 以本仓库为唯一源；其独立分发镜像仓库通过自带的 sync-from-helloagents.ps1 拉取，不在镜像侧直接修改。

## 提交信息

使用清晰的一句话描述改动；涉及行为变化的改动同步更新 CHANGELOG.md。

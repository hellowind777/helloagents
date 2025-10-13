<!-- README.md -->
# helloagents

<p align="center">简体中文    <a href="./README_EN.md">ENGLISH</a></p>

**`helloagents` 是一个面向 AI 编程智能体的「智能路由 + 多阶段 + 项目Wiki驱动」规则集。**
它在上游 [workflow3.md](https://github.com/geekoe/workflow3) 三阶段模型的基础上扩展，
新增完整的 **项目Wiki 驱动机制**（ADR、Mermaid 图表、变更日志、治理规范等），
并引入 **意图分流（智能路由）** 与 **错误处理复盘机制**，
使 AI 编程智能体具备自解释性、可追溯性与持续一致性。

---

## 特性
- **五阶段闭环**：Router → Analyze → Plan → Execute → Error Handling（按需触发）
- **项目 Wiki 一等公民**：`PROJECTWIKI.md` 作为事实来源，确保文档与代码强一致
- **智能意图路由**：自动识别 C0/P0/P1/P2 场景并选择最小代价路径
- **Mermaid-first 图表体系**：架构、流程、ER、类图、依赖图均可版本化管理
- **治理内建**：ADR、Conventional Commits、Keep a Changelog、原子化提交
- **安全边界**：禁止私自运行服务或外联生产资源；统一密钥管理方案
- **最小化原则（No-Write-by-Default）**：仅在项目型请求（P1/P2）中读写 `PROJECTWIKI.md`

---

## 目录结构
```

%USERPROFILE%/.codex/AGENTS.md  # 全局规则（供模型读取）
your-project/
├─ PROJECTWIKI.md               # 项目Wiki（代码与文档强一致）
├─ adr/                         # 架构决策记录（ADR）
├─ CHANGELOG.md                 # 遵循 Keep a Changelog
├─ docs/                        # 其他文档
└─ src/                         # 源码

````

---

## 安装使用
1. 将本仓的 `AGENTS.md` 文件复制到你的用户主目录下的 `.codex` 目录；
2. 重启终端，进入 CLI 后即可生效。

---

## 逻辑说明
- **C0｜纯咨询（No-Code）**：仅提供答案与建议，不读写项目文件。
- **P0｜方案规划（No-Exec）**：生成方案，不修改代码。
- **P1｜现有项目变更**：已有仓库代码，进入【分析问题】。
- **P2｜新建项目**：从零生成脚手架与 `PROJECTWIKI.md`。
- **错误类请求**：可直接进入阶段五【错误处理】，进行复现与修复分析。

---

## 开发与构建
- 遵循 **Conventional Commits** 与 **Keep a Changelog**
- 所有代码与文档修改需保持原子化提交
- 使用 Mermaid 绘制架构与依赖图表
- 更新文档与代码必须同步提交，确保可追溯一致性

---

## 兼容性与已知问题
- 当前主要验证于 GitHub 项目结构下
- 未来版本将支持私有 Wiki 与外部知识库同步

---

## 版本与升级
2025-10-13版本更新：
* 新增“智能路由（意图分流）”机制
* 增强错误处理与复盘流程
* 优化 PROJECTWIKI 生命周期与治理模型<br>
2025-10-12版本更新：
* 保持与 workflow3.md 模板兼容
* 统一命名与提交规范
……以往更新不再记录……

---

## 贡献
- 欢迎改进文档结构、Mermaid 模板或 ADR 模型
- 建议遵循项目规范提交 PR 与变更记录

---

## 安全
- 禁止提交密钥或生产凭证
- 推荐使用 `.env.example` + CI 注入方案

---

## 许可证与署名（**允许商用，但必须注明出处**）

为确保"允许商用 + 必须署名"，本项目采用**双许可证**：

1. **代码** — **Apache License 2.0** © 2025 hellowind
   - 允许商业使用。要求在分发中保留 **LICENSE** 与 **NOTICE** 信息（版权与许可说明）。
   - 在你的分发包中加入 `NOTICE`（示例）：
     ```
     本产品包含 "helloagents"（作者：hellowind），依据 Apache License 2.0 授权。
     ```

2. **文档（README/PROJECTWIKI/图表）** — **CC BY 4.0** © 2025 hellowind
   - 允许商业使用，但**必须署名**；需给出许可链接并标注是否做了修改。
   - 复用文档时建议的署名例句：
     ```
     文本/图表改编自 "helloagents" —— © 2025 hellowind，CC BY 4.0。
     ```

**统一署名建议（代码与文档皆可）**：
````

helloagents — © 2025 hellowind. 代码：Apache-2.0；文档：CC BY 4.0。

```

---

## 致谢 / 上游模板
- 上游：**workflow3.md**（[geekoe/workflow3](https://github.com/geekoe/workflow3)）
- 参考：Mermaid、Conventional Commits、Keep a Changelog、GitHub Wiki 生态
```

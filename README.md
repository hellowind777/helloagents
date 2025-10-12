<!-- README.md -->
# helloagents

<p align="center"><a href="./README_EN.md">ENGLISH</a></p>

**面向 AI 编程智能体的「多阶段 + 项目 Wiki 驱动」规则集。**
本项目在上游 **workflow3.md**（`geekoe/workflow3`）三阶段流程的基础上扩展，新增完整的 **项目 Wiki 驱动机制**（ADR、Mermaid 图表、变更日志、治理规范等），并加入**意图分流**与**错误处理复盘**阶段，使 AI 编程流程具备自解释性、可追溯性与可持续一致性。

## 特性
- **五阶段闭环**：Router → Analyze → Plan → Execute → Error Handling（按需触发）
- **项目 Wiki 一等公民**：`PROJECTWIKI.md` 作为事实来源，与代码保持**强一致**
- **Mermaid-first 图表体系**：架构、时序、ER、类、依赖、状态等图表皆可版本化管理
- **治理内建**：ADR、Conventional Commits、Keep a Changelog、原子化提交
- **安全边界**：禁止私自运行服务或外联生产资源；统一密钥管理方案
- **最小化原则（No-Write-by-Default）**：仅在项目型请求（P1/P2）中读写 `PROJECTWIKI.md`

## 目录结构
```

your-project/
├─ AGENTS.md                 # 全局规则（供各大模型读取）
├─ PROJECTWIKI.md            # 项目 Wiki（代码与文档强一致）
├─ adr/                      # 架构决策记录（ADR）
├─ CHANGELOG.md              # 遵循 Keep a Changelog
├─ docs/                     # 其他文档
└─ src/                      # 源码

````

## 环境与安装
- 待补充（TBD）

## 快速开始
```bash
# 将本仓复制到你的项目
cp -r helloagents/* your-project/
# 重命名
mv your-project/README.md your-project/AGENTS.md
```

## 使用说明

- **C0｜纯咨询（No-Code）**：仅给出答案或建议，不读写项目文件。
- **P0｜方案规划（No-Exec）**：生成可落地方案，不修改代码。
- **P1｜现有项目变更**：已有仓库代码，进入【分析问题】。
- **P2｜新建项目**：无现成代码，从零生成脚手架与 `PROJECTWIKI.md`。

## 开发与构建

- 遵循 **Conventional Commits** 与 **Keep a Changelog**
- 所有文档与代码修改需保持原子化提交
- Mermaid 图表用于架构与依赖可视化

## 兼容性与已知问题

- 目前仅验证在 GitHub 项目结构下的可用性
- 未来版本计划扩展对私有 Wiki 与外部知识库的同步支持

## 版本与升级

- 新增阶段一【意图分流】与最小化写入原则
- 保持与上游 `workflow3.md` 模板兼容

## 贡献

- 欢迎提交改进文档结构、Mermaid 模板或 ADR 模型的 PR

## 安全

- 严禁提交密钥或生产凭证
- 推荐使用 `.env.example` + CI 注入方式

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
```
helloagents — © 2025 hellowind. 代码：Apache-2.0；文档：CC BY 4.0。
```

## 致谢 / 上游模板
- 上游：**workflow3.md**（geekoe/workflow3）
- Mermaid、Conventional Commits、Keep a Changelog、GitHub Wiki 文档与生态
````
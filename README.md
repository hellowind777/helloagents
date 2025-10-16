<!-- README.md -->
# HelloAGENTS

<p align="center">简体中文    <a href="./README_EN.md">ENGLISH</a></p>

**`HelloAGENTS` 是一个面向 AI 编程智能体的「轻量路由（Router）+ 多阶段（P1–P4）+ 知识库驱动」规则集。**
以 `PROJECTWIKI.md` 为唯一可信文档源（SSoT），通过**意图分流（Direct Answer / P1 / P2 / P3，P4按需触发）**、**最小写入与原子追溯（P3 Gate）**、**Mermaid-first 图表**与**Conventional Commits + Keep a Changelog**，确保代码—文档—知识库持续一致、可追溯、可治理。

面向实际工程，内置 **PROJECTWIKI/CHANGELOG 标准模板与校验清单**，并以增量方式维持文档新鲜度（Freshness）、可追溯性（Traceability）、完备性（Completeness）与一致性（Consistency）的质量门槛（SLO）。

## 特性
- **Router 路由机制**：Direct Answer / P1（分析）/ P2（制定方案）/ P3（执行）；**P4（错误处理）**按需触发
- **文档一等公民**：`PROJECTWIKI.md` 作为 SSoT，代码与文档强一致
- **P3 前置 Gate**：低风险判定 + 方案完备性（接口/数据/回滚/测试/发布/文档）+ 明确授权
- **最小写入与原子追溯**：代码改动与文档更新同一原子提交，并双向链接到 `CHANGELOG.md`
- **Mermaid-first**：架构/流程/依赖/ER/类图全部使用 Mermaid
- **治理内建**：ADR 模型、Conventional Commits、Keep a Changelog、增量更新策略
- **安全与合规**：统一密钥管理，禁止外联生产与明文秘钥
- **模板与校验**：提供 `PROJECTWIKI.md` / `CHANGELOG.md` 模板与自动化校验要点

## 目录结构
```
%USERPROFILE%/.codex/AGENTS.md  # 全局规则（供模型读取）
your-project/
├─ PROJECTWIKI.md               # 项目Wiki（代码与文档强一致）
├─ adr/                         # 架构决策记录（ADR）
├─ CHANGELOG.md                 # 遵循 Keep a Changelog
├─ docs/                        # 其他文档
└─ src/                         # 源码
```

## 安装使用
1. 将本仓中的 `AGENTS.md` 复制到当前用户主目录（路径：`%USERPROFILE%\.codex`）；
2. 关闭终端并重新进入 CLI，即可启用智能体全局规则。

## 使用说明
- **C0｜纯咨询（No-Code）**：仅提供结论/建议，不读写项目文件
- **P0｜方案规划（No-Exec）**：给出可落地方案，但不执行改动
- **P1｜现有项目变更**：基于既有仓库分析问题并定位影响面
- **P2｜新建项目**：初始化脚手架与 `PROJECTWIKI.md`
- **P4｜错误处理（按需）**：MRE 复现 → 修复 → 复盘与文档同步

## 开发与构建
- 遵循 **Conventional Commits** 与 **Keep a Changelog**
- 代码与文档**原子化提交**；提交中需关联 `PROJECTWIKI.md` 与 `CHANGELOG.md`
- **Mermaid** 统一绘制架构与依赖图；文件一律 **UTF-8** 编码

## 兼容性与已知问题
- 当前版本适配 GitHub 项目结构
- 后续版本将支持私有 Wiki 与外部知识库同步

## 版本与升级
2025-10-16版本更新：
* 对齐新版「Router → Phases」路由与阶段展示规则（Direct Answer / P1–P3，P4按需）
* 引入 **P3 前置 Gate**（低风险判定 + 方案完备性 + 明确授权）与**最小写入/原子追溯**
* 增补 `PROJECTWIKI.md` 与 `CHANGELOG.md` 标准模板与自动化校验要点

2025-10-14版本更新：
* 对齐新版《AGENTS.md》治理模型
* 优化 PROJECTWIKI 生命周期与增量更新机制
* 增强错误复盘与一致性校验逻辑

2025-10-13版本更新：
* 新增“智能路由（意图分流）”机制
* 增强错误处理与复盘流程
* 优化 PROJECTWIKI 生命周期与治理模型

2025-10-12版本更新：
* 保持与 workflow3.md 模板兼容
* 统一命名与提交规范

……以往更新不再记录……

## 贡献
- 欢迎改进文档结构、Mermaid 模板或 ADR 模型
- 提交 PR 时请遵循项目规范并更新变更记录

## 安全
- 禁止提交密钥或生产凭证
- 推荐使用 `.env.example` + CI 注入方案

## 许可证与署名（**允许商用，但必须注明出处**）

为确保"允许商用 + 必须署名"，本项目采用**双许可证**：

1. **代码** — **Apache License 2.0** © 2025 Hellowind
   - 允许商业使用。要求在分发中保留 **LICENSE** 与 **NOTICE** 信息（版权与许可说明）。
   - 在你的分发包中加入 `NOTICE`（示例）：
     <pre>
     本产品包含 "HelloAGENTS"（作者：<a href="https://github.com/hellowind777/helloagents">Hellowind</a>），依据 Apache License 2.0 授权。
     </pre>

2. **文档（README/PROJECTWIKI/图表）** — **CC BY 4.0** © 2025 Hellowind
   - 允许商业使用，但**必须署名**；需给出许可链接并标注是否做了修改。
   - 复用文档时建议的署名例句：
     <pre>
     文本/图表改编自 "HelloAGENTS" —— © 2025 <a href="https://github.com/hellowind777/helloagents">Hellowind</a>，CC BY 4.0。
     </pre>

3. **统一署名建议（代码与文档皆可）**：
     <pre>
     HelloAGENTS — © 2025 <a href="https://github.com/hellowind777/helloagents">Hellowind</a>. 代码：Apache-2.0；文档：CC BY 4.0。
     </pre>

## 第三方声明（可选）

（无）

## 致谢 / 上游模板（可选）
- 上游：**workflow3.md**（[geekoe/workflow3](https://github.com/geekoe/workflow3)）
- 参考：Mermaid、Conventional Commits、Keep a Changelog、GitHub Wiki 生态

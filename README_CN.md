<!-- README_CN.md -->
# HelloAGENTS

<p align="center">简体中文    <a href="./README.md">ENGLISH</a></p>

> **⚠️ 重要提示：** 使用前请先在 `AGENTS.md` 文件头部的 `bootstrap: lang=zh-CN` 中设置语言，并在全局规则的 **"Response Language"** 中配置回复语言为"简体中文"，以确保智能体按预期语言输出。

**`HelloAGENTS` 是一个面向 AI 编程智能体的「轻量路由（Router）+ 多阶段（P1–P4）+ 知识库驱动」规则集。**
以 `HELLOWIKI.md` 为唯一可信文档源（SSoT），通过 **Direct Answer 优先判定**、**FA 全授权模式**、**静默执行规范**、**Feedback-Delta 增量反馈**、**EHRB 极高风险行为识别**、**P3 执行 Gate（最小写入 + 原子追溯）**、**Mermaid-first 图表** 与 **Conventional Commits + Keep a Changelog**，确保代码—文档—知识库持续一致、可追溯、可治理。新增 **G8 大型项目策略**、**TASK.md 任务清单机制** 与 **history/ 归档目录**。

## 特性
- **Router 分流**：Direct Answer / P1（分析）/ P2（制定方案）/ P3（执行）；**P4（错误处理）**按需触发
- **FA 全授权模式**：通过 `~auto` / `~helloauto` / `~fa` 触发，自动跨阶段执行（P1→P2→P3）
- **静默执行规范**：仅输出文件路径与操作类型，不输出文件内容、diff、代码片段或工具返回结果
- **Feedback-Delta 机制**：识别增量反馈并在当前阶段迭代，避免不必要的阶段切换
- **EHRB 识别**：自动识别生产环境操作、PII 数据处理、破坏性操作、不可逆操作等极高风险行为
- **文档一等公民**：`HELLOWIKI.md` 作为 SSoT，代码与文档强一致；新增 `TASK.md` 任务清单与 `history/` 归档
- **P3 执行 Gate**：低风险判定 + 方案完备性（接口/数据/回滚/测试/发布/文档）+ 明确授权 + 原子追溯
- **G5 一致性审计**：代码为执行真值唯一来源，默认修正知识库以符合代码
- **G8 大型项目策略**：渐进式知识库初始化、任务分解（单任务 50-100 行）、分级测试策略
- **Mermaid-first**：架构/流程/依赖/ER/类图统一使用 Mermaid
- **治理内建**：ADR（**根目录单文件 `ADR.md`**）、Conventional Commits、Keep a Changelog、增量更新
- **安全与合规**：禁止外联生产与明文秘钥；统一密钥管理

## 目录结构
```
%USERPROFILE%/.codex/AGENTS.md  # 全局规则（供模型读取）
your-project/
├─ helloagents/
│  ├─ HELLOWIKI.md              # 项目知识库（12 个必备章节）
│  ├─ CHANGELOG.md              # 遵循 Keep a Changelog
│  ├─ ADR.md                    # 架构决策记录（ADR）
│  ├─ TASK.md                   # 当前任务清单（P2 生成，P3 归档）
│  └─ history/                  # 任务清单归档目录
│     └─ TASK_YYYYMMDD.md       # 按日期归档的任务清单
├─ docs/                        # 其他文档
└─ src/                         # 源码
```

## 安装使用
1. 将本仓中的 `AGENTS.md` 复制到当前用户主目录（路径：`%USERPROFILE%\.codex`）；
2. **重要：** 在 `AGENTS.md` 文件头部设置 `bootstrap: lang=zh-CN`，并在全局规则的 **"Response Language"** 中配置为"简体中文"；
3. 关闭终端并重新进入 CLI，即可启用智能体全局规则。

## 使用说明
- **Direct Answer（优先）**：若用户问题属于直接解答范畴，则**不进入**任何阶段，直接给出答案/结论。
- **FA 全授权模式**：输入 `~auto` / `~helloauto` / `~fa` 触发确认流程，激活后自动执行 P1→P2→P3，无需逐阶段确认。
- **P1｜分析**：基于现有仓库/上下文识别影响面、约束与疑点，仅分析不改写；执行知识库质量检查（只读，标记问题）。
- **P2｜制定方案**：输出可执行方案；生成 `TASK.md` 任务清单；若为 EHRB 高风险改动，FA 模式尝试自动缓解，非 FA 模式列出风险点。
- **P3｜执行**：满足**执行 Gate**后方可落地（低风险判定 + 方案完备性 + 明确授权）；严格按 `TASK.md` 逐项执行；代码与文档采用**原子提交**，与 `HELLOWIKI.md`、`CHANGELOG.md` 双向关联；完成后归档任务清单至 `history/TASK_YYYYMMDD.md`。
- **P4｜错误处理（按需）**：MRE 复现 → 修复 → 复盘与文档同步；优先怀疑代码实现错误；连续 ≥2 次未解决则警告，≥3 次强制提示重建知识库或回滚。
- **Feedback-Delta**：识别增量反馈（包含方向性词汇 + 明确引用当前阶段输出 + 无跨阶段跳转指令），在当前阶段迭代而非重新路由。
- **编码与格式**：统一 **UTF-8**；所有图表采用 **Mermaid**；提交遵循 **Conventional Commits**。

## 开发与构建
- 遵循 **Conventional Commits** 与 **Keep a Changelog**；代码与文档**原子化提交**
- 任何 P3/P4 改动需同步更新 `HELLOWIKI.md` 与 `CHANGELOG.md`
- 图表一律使用 **Mermaid**；文本文件统一 **UTF-8**
- **ADR**：根目录单文件 `ADR.md` 为唯一登记点（MADR 模板）
- **任务清单**：P2 生成 `TASK.md`，P3 完成后归档至 `history/TASK_YYYYMMDD.md`

## 兼容性与已知问题
- 已在 GitHub 项目结构下验证
- 计划支持私有 Wiki 与外部知识库同步
- 如项目仍使用 `PROJECTWIKI.md`，请参考下方迁移指引（重命名为 `HELLOWIKI.md` 并调整引用）

## 版本与升级
2025-11-10版本更新：
* 对齐 **AGENTS_VERSION 2025-11-10.01**：知识库文件体系重构（PROJECTWIKI.md → HELLOWIKI.md；新增 history/ 目录与 TASK.md 机制）
* 引入 **FA（Full Authorization）全授权模式** 与 **静默执行规范**（仅输出路径与操作类型）
* 新增 **Feedback-Delta 增量反馈机制** 与 **EHRB 极高风险行为识别**（生产环境/PII/破坏性/不可逆操作）
* 强化 **G5 一致性审计**：代码为执行真值唯一来源，默认修正知识库以符合代码
* 新增 **G8 大型项目策略**：渐进式知识库初始化、任务分解（单任务 50-100 行）、分级测试策略
* 路由机制全面升级：阶段状态锁、P3/P4 后联合判定、首次对话判定、FA 触发命令检测优先级
* 新增 **P4 迭代保护**：连续 ≥2 次未解决警告，≥3 次强制提示重建知识库或回滚

2025-10-29版本更新：
* 对齐 **AGENTS_VERSION 2025-10-12.7**：引入 Direct Answer 优先判定与阶段锁说明
* 新增 **RISK-GATE@P2** 与 **G8 文件/目录约定**；明确 **ADR** 收敛为根目录 `adr.md`
* 强化 **P3 执行 Gate**：低风险判定 + 方案完备性 + 明确授权 + 原子追溯

2025-10-16版本更新：
* 优化 Router→Phases 展示与约束；P3 Gate 与最小写入/原子追溯落地
* 增补 `PROJECTWIKI.md` / `CHANGELOG.md` 模板与校验要点

2025-10-14版本更新：
* 同步治理模型；完善 PROJECTWIKI 生命周期与增量更新

2025-10-13版本更新：
* 新增智能路由（意图分流）；增强错误处理与复盘

2025-10-12版本更新：
* 统一命名与提交规范；兼容 workflow3 模板

……以往更新不再记录……

## 贡献
- 欢迎对文档结构、Mermaid 模板或 ADR 模型提出改进
- 提交 PR 请更新相关变更记录并遵循项目规范

## 安全
- 禁止提交密钥或生产凭证
- 建议使用 `.env.example` + CI 注入方案
- 自动识别 EHRB（极高风险行为）并尝试缓解或暂停

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

## 第三方声明

（无）

## 致谢 / 上游模板
- 上游：**workflow3.md**（[geekoe/workflow3](https://github.com/geekoe/workflow3)）
- 参考：Mermaid、Conventional Commits、Keep a Changelog、GitHub Wiki 生态

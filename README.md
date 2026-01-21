<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**An intelligent workflow system that keeps going: evaluate → implement → verify.**

[![Router](https://img.shields.io/badge/router-2026--01--16-6366F1)](./Codex%20CLI/AGENTS.md)
[![Version](https://img.shields.io/badge/version-2.0-orange.svg)](./Codex%20CLI/skills/helloagents/SKILL.md)
[![License](https://img.shields.io/badge/license-Apache--2.0%20%7C%20CC%20BY%204.0-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
![GitHub last commit](https://img.shields.io/github/last-commit/hellowind777/helloagents)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/中文-blue?style=for-the-badge" alt="中文"></a>
</p>

---

## 📑 Table of Contents

<details>
<summary><strong>Click to expand</strong></summary>

- [🎯 Why HelloAGENTS?](#why)
- [📊 Data That Speaks](#data)
- [🔁 Before & After](#before-after)
- [✨ Features](#features)
- [🚀 Quick Start](#quick-start)
- [🔧 How It Works](#how-it-works)
- [📖 Documentation](#documentation)
- [❓ FAQ](#faq)
- [🛠️ Troubleshooting](#troubleshooting)
- [📈 Version History](#version-history)
- [🔒 Security](#security)
- [🙏 Acknowledgments](#acknowledgments)
- [📜 License](#license)

</details>

---

<a id="why"></a>

## 🎯 Why HelloAGENTS?

You know the pattern: the assistant gives a good analysis… then stops. Or it edits code but forgets the docs. Or it “finishes” without running anything.

**HelloAGENTS is a structured workflow system** (routing + stages + acceptance gates) that pushes the work through to a verifiable end.

| Challenge | Without HelloAGENTS | With HelloAGENTS |
|---|---|---|
| **Inconsistent outputs** | Depends on prompt quality | Unified output shell + deterministic stages |
| **Stops too early** | “Here’s what you should do…” | Keeps going: implement → test → validate |
| **No quality gates** | Manual review required | Stage / Gate / Flow acceptance |
| **Context drift** | Decisions get lost | State variables + solution packages |
| **Risky commands** | Easy to do damage | EHRB detection + workflow escalation |

### 💡 Best For

- ✅ **Coders** who want “done” to mean “verified”
- ✅ **Teams** that need consistent format and traceable changes
- ✅ **Projects** where docs are part of the deliverable

### ⚠️ Not For

- ❌ One-off snippets (a normal prompt is faster)
- ❌ Projects where you can’t keep outputs in Git
- ❌ Tasks that require hard guarantees (still review before production)

<div align="center">
  <img src="./readme_images/06-divider.svg" width="420" alt="divider">
</div>

<a id="data"></a>

## 📊 Data That Speaks

No made-up “50% faster” claims here—just things you can verify in this repo:

| Item | Value | Where to verify |
|---|---:|---|
| Routing layers | 3 | `AGENTS.md` / `CLAUDE.md` (Context → Tools → Intent) |
| Workflow stages | 4 | Evaluate → Analyze → Design → Develop |
| Execution modes | 3 | Tweak / Lite / Standard |
| Commands | 12 | `Codex CLI/skills/helloagents/SKILL.md` (or the Claude bundle equivalent) |
| Reference modules | 23 | `Codex CLI/skills/helloagents/references/` (or the Claude bundle equivalent) |
| Automation scripts | 7 | `Codex CLI/skills/helloagents/scripts/` (or the Claude bundle equivalent) |
| Bundles in this repo | 2 | `Codex CLI/` and `Claude Code/` |

<a id="before-after"></a>

## 🔁 Before & After

Sometimes the difference is easier to *feel* than to explain. Here’s a concrete “before vs after” snapshot:

| | Without HelloAGENTS | With HelloAGENTS |
|---|---|---|
| Start | You jump into implementation quickly | You start by scoring requirements and filling gaps |
| Delivery | You assemble the steps manually | The workflow keeps pushing to “verified done” |
| Docs | Often forgotten | Treated as a first-class deliverable |
| Safety | Risky ops can slip through | EHRB detection escalates risky actions |
| Repeatability | Depends on the prompt | Same stages + gates, every time |

And here’s what the **Evaluate** stage looks like in practice: it asks the “boring but necessary” questions (platform, delivery form, controls, acceptance criteria) *before* writing code.

Example prompt it produces (trimmed for readability):

```text
当前需求完整性评分：4/10

请补全下面关键信息（回答编号即可）：
1) 运行平台
2) 交付方式
3) 操作方式
4) 规则/难度偏好
5) 画面与尺寸 / 是否需要分数、音效、障碍物
```

<a id="features"></a>

## ✨ Features

Let’s be practical—here’s what you get.

<table>
<tr>
<td width="50%" valign="top">

<img src="./readme_images/02-feature-icon-routing.svg" width="48" align="left" alt="routing icon">

**🧭 3-layer intelligent routing**

- Continues the same task across turns
- Detects tool calls (SKILL/MCP/plugins) vs internal workflow
- Chooses tweak / lite / standard execution based on complexity

**Benefit:** less “prompt babysitting”

</td>
<td width="50%" valign="top">

<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left" alt="workflow icon">

**📚 4-stage workflow engine**

- Evaluate → Analyze → Design → Develop
- Clear entry/exit gates
- Keeps artifacts as solution packages

**Benefit:** repeatable delivery, not lucky outputs

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img src="./readme_images/04-feature-icon-acceptance.svg" width="48" align="left" alt="acceptance icon">

**⚡ 3-layer acceptance**

- Stage-level checks
- Inter-stage gates (e.g., validate solution package)
- Flow-level acceptance summary

**Benefit:** you can trust the result more

</td>
<td width="50%" valign="top">

<img src="./readme_images/05-feature-icon-security.svg" width="48" align="left" alt="security icon">

**🛡️ EHRB safety detection**

- Keyword scan + semantic analysis
- Escalates to confirmation when risky
- Flags destructive ops (e.g., `rm -rf`, force push)

**Benefit:** fewer “oops” moments

</td>
</tr>
</table>

<a id="quick-start"></a>

## 🚀 Quick Start

This repo ships **two ready-to-copy bundles**:

- `Codex CLI/` → for **Codex CLI** users (`AGENTS.md`)
- `Claude Code/` → for **Claude Code** users (`CLAUDE.md`)

### 1) Clone the repo

```bash
git clone https://github.com/hellowind777/helloagents.git
cd helloagents
```

### 2) Install the correct bundle

Pick your CLI and copy **both** the config file and the `skills/helloagents/` folder.

#### Option A: Codex CLI

**macOS / Linux**

```bash
mkdir -p ~/.codex/skills
cp -f "Codex CLI/AGENTS.md" ~/.codex/AGENTS.md
cp -R "Codex CLI/skills/helloagents" ~/.codex/skills/helloagents
```

**Windows (PowerShell)**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\\.codex\\skills" | Out-Null
Copy-Item -Force "Codex CLI\\AGENTS.md" "$env:USERPROFILE\\.codex\\AGENTS.md"
Copy-Item -Recurse -Force "Codex CLI\\skills\\helloagents" "$env:USERPROFILE\\.codex\\skills\\helloagents"
```

#### Option B: Claude Code

**macOS / Linux**

```bash
mkdir -p ~/.claude/skills
cp -f "Claude Code/CLAUDE.md" ~/.claude/CLAUDE.md
cp -R "Claude Code/skills/helloagents" ~/.claude/skills/helloagents
```

**Windows (PowerShell)**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\\.claude\\skills" | Out-Null
Copy-Item -Force "Claude Code\\CLAUDE.md" "$env:USERPROFILE\\.claude\\CLAUDE.md"
Copy-Item -Recurse -Force "Claude Code\\skills\\helloagents" "$env:USERPROFILE\\.claude\\skills\\helloagents"
```

### 3) Verify it works

In your CLI, run:

- `/helloagents` **or** `$helloagents`

Expected: a welcome message that starts with something like:

```
💡【HelloAGENTS】- 技能已激活
```

### 4) Start using it

- Try `~help` to see all commands
- Or just describe what you want; the router will pick the workflow

<a id="how-it-works"></a>

## 🔧 How It Works

<details>
<summary><strong>📊 Click to view the architecture diagram</strong></summary>

```mermaid
flowchart TD
  Start([User input]) --> L1{Layer 1: Context}
  L1 -->|Continue previous task| Continue[Continue task]
  L1 -->|New request| L2{Layer 2: Tools}

  L2 -->|External tool call| Tool[Run tool + shell wrapping]
  L2 -->|No tool| L3{Layer 3: Intent}

  L3 -->|Q&A / ask| Answer[Direct answer]
  L3 -->|Change request| Eval[Evaluate]

  Eval -->|Score >= 7| Complexity{Complexity}
  Eval -->|Score < 7| Clarify[Ask clarifying questions]

  Complexity -->|Tweak| Tweak[Tweak mode]
  Complexity -->|Lite| Analyze[Analyze]
  Complexity -->|Standard| Analyze

  Analyze --> Design[Design (solution package)]
  Design --> Develop[Develop (implement + test)]
  Develop --> Done[✅ Done + acceptance summary]

  style Eval fill:#e3f2fd
  style Analyze fill:#fff3e0
  style Design fill:#ede9fe
  style Develop fill:#dcfce7
  style Done fill:#16a34a,color:#fff
```

</details>

Key artifacts you’ll see in real projects:

- `plan/YYYYMMDDHHMM_<feature>/` solution package (proposal + tasks)
- `helloagents/` knowledge base workspace (INDEX/context/CHANGELOG/modules…)

<a id="documentation"></a>

## 📖 Documentation

This repo is intentionally “two-bundles-in-one”:

- **Codex CLI rules:** `Codex CLI/AGENTS.md`
- **Claude Code rules:** `Claude Code/CLAUDE.md`

The skill package lives under:

- `Codex CLI/skills/helloagents/`
- `Claude Code/skills/helloagents/`

Start here (pick either bundle path):

- `Codex CLI/skills/helloagents/SKILL.md` (command list + entry behavior)
- `Codex CLI/skills/helloagents/references/` (stages, rules, services)
- `Codex CLI/skills/helloagents/scripts/` (automation scripts)

### What you actually copy

You copy a **config file** plus a **skill folder**:

- Config: `AGENTS.md` (Codex CLI) or `CLAUDE.md` (Claude Code)
- Skill: `skills/helloagents/` (includes `SKILL.md`, `references/`, `scripts/`, `assets/`)

### Configuration (the knobs you’ll actually touch)

Most people only tweak a few global settings:

```yaml
OUTPUT_LANGUAGE: zh-CN
ENCODING: UTF-8
KB_CREATE_MODE: 2
BILINGUAL_COMMIT: 1
```

**KB_CREATE_MODE** controls knowledge base writes:

- `0 (OFF)`: skip all KB operations
- `1 (ON_DEMAND)`: create KB only when explicitly requested
- `2 (ON_DEMAND_AUTO_FOR_CODING)`: auto-create for coding tasks (default)
- `3 (ALWAYS)`: always create/update KB

<a id="faq"></a>

## ❓ FAQ

<details>
<summary><strong>Q: Which bundle should I install?</strong></summary>

**A:** Match the CLI you’re using:
- Codex CLI → `Codex CLI/`
- Claude Code → `Claude Code/`
</details>

<details>
<summary><strong>Q: Can I install both?</strong></summary>

**A:** Yes. They live in different config roots (`~/.codex/` vs `~/.claude/`). Just don’t mix the files inside one root.
</details>

<details>
<summary><strong>Q: How do I invoke HelloAGENTS?</strong></summary>

**A:** Use `/helloagents` or `$helloagents` to explicitly activate the skill. After that, use `~help` or describe your task.
</details>

<details>
<summary><strong>Q: Where does the knowledge base go?</strong></summary>

**A:** In the *project you are working on*, HelloAGENTS writes to `helloagents/` (unless disabled). It is the single source of truth for project knowledge in the workflow.
</details>

<details>
<summary><strong>Q: How do I disable knowledge base writes?</strong></summary>

**A:** Set `KB_CREATE_MODE: 0` in your installed `AGENTS.md` / `CLAUDE.md`.
</details>

<details>
<summary><strong>Q: What if I only want a light change?</strong></summary>

**A:** The router can choose tweak mode for small, clear changes. You can also ask for “tweak mode / minimal change” explicitly.
</details>

<details>
<summary><strong>Q: What are the key commands?</strong></summary>

**A:** Try `~help`. Common ones: `~plan`, `~exec`, `~test`, `~commit`, `~validate`.
</details>

<a id="troubleshooting"></a>

## 🛠️ Troubleshooting

### Stuck in Evaluate (requirement score &lt; 7)

**Fix:** answer the clarifying questions with concrete details (inputs/outputs, files to change, acceptance criteria).

---

### Solution package validation failed

**Fix:** ensure the package has both files:

- `proposal.md`
- `tasks.md`

Then run `~validate` (or follow the tool output).

---

### “Skill not found” after copying

**Fix:**

- Confirm `skills/helloagents/SKILL.md` exists under your CLI config root (after copying)
- Re-run `/helloagents` or `$helloagents`

---

### Windows path/encoding issues

**Fix:** keep files in UTF-8, and prefer quoted paths when copying folders with spaces (like `Codex CLI/`).

---

### Mermaid diagram not rendering in your viewer

**Fix:** GitHub renders Mermaid in README by default, but some Markdown viewers don’t. If your viewer can’t render it, open the README on GitHub or use a Mermaid-capable viewer.

<a id="version-history"></a>

## 📈 Version History

### Latest: v2.0 (2026-01)

- Positioning: from “AI programming partner” → **intelligent workflow system**
- Workflow: 3 stages → 4 stages (added **Evaluate**)
- Routing: simple routing → **3-layer routing** (Context → Tools → Intent)
- Acceptance: basic checks → **Stage / Gate / Flow** acceptance
- Bundle distribution: **Codex CLI** and **Claude Code** both supported

🆚 v1 vs v2 snapshot:

| Area | v1 (2025-12) | v2 (2026-01) |
|---|---|---|
| Positioning | AI programming partner | Intelligent workflow system |
| Stages | 3 stages | 4 stages (+ Evaluate) |
| Routing | Simple | 3 layers (Context → Tools → Intent) |
| Acceptance | Basic | 3 layers (Stage / Gate / Flow) |
| Files | 6 files | 44 files |
| Commands | 4 commands | 12 commands |

<a id="security"></a>

## 🔒 Security

- EHRB detection is designed to catch destructive or high-risk operations before they run.
- Even so, **review commands and diffs** before applying changes to important systems.

If you believe you found a security issue, prefer using GitHub’s private reporting (Security Advisories) if enabled for this repo. Otherwise, contact the maintainer via their GitHub profile.

<a id="acknowledgments"></a>

## 🙏 Acknowledgments

- AI CLI ecosystems (Codex CLI, Claude Code, etc.)
- Keep a Changelog conventions (used by the workflow knowledge base)
- MCP and the broader tool integration community

<a id="license"></a>

## 📜 License

This project uses a **dual license**:

- **Code:** Apache-2.0
- **Documentation:** CC BY 4.0

See `LICENSE` for details.

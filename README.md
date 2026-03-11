<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**The orchestration kernel that makes any AI CLI smarter — and keeps getting smarter.**

[![Version](https://img.shields.io/badge/version-3.0.0--dev-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Skills](https://img.shields.io/badge/skills-25-6366f1.svg)](./helloagents/skills)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> **Not another skills collection.** HelloAGENTS is a universal orchestration kernel that turns any AI coding CLI into a self-improving development partner — with adaptive routing memory, capability-graph skill composition, and zero-config project understanding.

## Why HelloAGENTS?

<table>
<tr>
<td width="50%" valign="top" align="center">

**Without HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="Without HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**With HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="With HelloAGENTS" width="520">

</td>
</tr>
</table>

| Challenge | Raw AI CLI | With HelloAGENTS |
|-----------|-----------|-----------------|
| Stops at planning | Ends with suggestions | Pushes through to implementation and verification |
| Every session starts from zero | No memory of past decisions | Learns your routing patterns and project context |
| Output structure varies | Different format every prompt | Consistent routing with structured stage chain |
| Risky operations slip through | Easy to run destructive commands | Three-layer EHRB safety detection |
| Skills are isolated silos | Manual tool selection | Capability graph auto-discovers and composes skills |
| Setup tax on new projects | Needs manual configuration | Zero-config project fingerprint on first interaction |

## Three Killer Features

<table>
<tr>
<td width="33%" valign="top">

### Adaptive Routing Memory

Your AI learns from its own routing history. Every session outcome is recorded — routes chosen, actual complexity, success or failure.

Next time you ask something similar, the router calibrates automatically:
- "This user's 'small fix' requests are R2 80% of the time"
- "auth/ changes always cascade to 3+ modules"
- "This user prefers DELEGATED mode 90% of the time"

Like GPS learning your commute patterns instead of recalculating every day.

</td>
<td width="33%" valign="top">

### Skill Capability Graph

Skills declare what they `provides` and what they `requires`. The orchestration kernel builds a live capability graph — when a task needs `test-generation`, it auto-discovers which skill provides it.

```yaml
---
name: workflow-design
provides:
  - solution-design
  - multi-proposal-comparison
  - task-planning
requires:
  - ehrb
  - memory
---
```

Third-party skills plug in by declaring `provides`. No registration, no config — just declare and compose.

</td>
<td width="33%" valign="top">

### Zero-Config Project Fingerprint

No `~init` required. On first interaction, HelloAGENTS reads your project's signature files (package.json, pyproject.toml, Cargo.toml, go.mod, directory structure, recent git history) and generates a lightweight fingerprint.

Cached at `.helloagents/context.json`:
```json
{
  "language": "typescript",
  "framework": "next.js",
  "test_framework": "vitest",
  "modules": ["src/api", "src/ui"],
  "recent_changes": ["auth refactor"]
}
```

First interaction is immediately intelligent. `~init` becomes an optional power-user feature.

</td>
</tr>
</table>

## Supported Platforms

One install, 6 CLI targets. Same workflow everywhere.

| CLI | Sub-Agent Support | Hooks | Status |
|-----|------------------|-------|--------|
| **Claude Code** | Agent tool + Agent Teams | 9 lifecycle hooks | Full support |
| **Codex CLI** | spawn_agent + CSV batch | notify hook | Full support |
| **OpenCode** | Task tool (build/plan/explore) | — | Full support |
| **Gemini CLI** | Built-in tool calls | 6 lifecycle hooks | Full support |
| **Qwen CLI** | Built-in tool calls | Settings hooks | Full support |
| **Grok CLI** | Built-in tool calls | Settings hooks | Experimental |

## Quick Start

> Python >= 3.10 required. Choose your preferred method:

### One-line install (recommended)

**macOS / Linux:**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell:**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

### Other methods

<details>
<summary>npx (Node.js >= 16)</summary>

    npx helloagents

> Thanks to @setsuna1106 for transferring the npm package ownership.
</details>

<details>
<summary>UV (isolated environment)</summary>

    # Install UV first (skip if installed)
    curl -LsSf https://astral.sh/uv/install.sh | sh   # macOS/Linux
    irm https://astral.sh/uv/install.ps1 | iex          # Windows

    # Install HelloAGENTS
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents
</details>

<details>
<summary>pip</summary>

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents
</details>

### After installation

```bash
helloagents                  # interactive menu
helloagents install claude   # install to specific CLI
helloagents install --all    # install to all detected CLIs
helloagents status           # check installation status
helloagents update           # update + auto-sync all targets
helloagents uninstall --all  # remove from all targets
helloagents clean            # clean caches
```

### Switch to dev branch

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/dev/install.sh | HELLOAGENTS_BRANCH=dev bash

# Windows PowerShell
$env:HELLOAGENTS_BRANCH="dev"; irm https://raw.githubusercontent.com/hellowind777/helloagents/dev/install.ps1 | iex

# UV
uv tool install --from git+https://github.com/hellowind777/helloagents@dev helloagents --force

# pip
pip install --upgrade git+https://github.com/hellowind777/helloagents.git@dev
```

## How It Works

```
User Input → Smart Router → R0 Direct / R1 Fast / R2 Simplified / R3 Standard
                                                        ↓              ↓
                                                    DESIGN ←──── DESIGN (multi-proposal)
                                                        ↓              ↓
                                                    DEVELOP ←──── DEVELOP (sub-agents)
                                                        ↓              ↓
                                                    Verify ←────── Verify (Ralph Loop)
                                                        ↓              ↓
                                                     Done ←──────── Done + KB Sync
```

Every input is scored on 5 dimensions (action need, target clarity, decision scope, impact range, EHRB risk) and routed to the appropriate depth:

- **R0** — Direct response. Questions, explanations, lookups.
- **R1** — Fast flow. Single-point changes with clear targets.
- **R2** — Simplified flow. Needs analysis before execution, local decisions.
- **R3** — Standard flow. Complex tasks with multi-proposal design and sub-agent orchestration.

The router learns from history. Over time, it calibrates scoring based on your actual patterns.

## In-Chat Commands

These run inside your AI chat session, not the system shell.

| Command | What it does |
|---------|-------------|
| `~auto` | Full autonomous workflow (evaluate → design → develop → verify) |
| `~plan` | Generate implementation plan, stop before coding |
| `~exec` | Execute an existing plan package |
| `~commit` | Smart commit with Conventional Commits format |
| `~review` | Code review with security and quality analysis |
| `~test` | Run project tests with failure analysis |
| `~init` | Initialize project knowledge base (optional with v3) |
| `~status` | Check workflow and installation status |
| `~rlm spawn reviewer,writer` | Manually dispatch sub-agent roles |

## Architecture

### v3 vs v2

| Metric | v2 | v3 |
|--------|----|----|
| Python runtime | 10,452 lines (39 files) | ~4,570 lines (23 files) |
| Workflow protocol | 954-line AGENTS.md monolith | 28-line bootstrap.md + 25 Skills |
| Module system | 50+ custom .md files | Agent Skills (open standard) |
| Routing | Fixed 5-dimension scoring | Adaptive scoring with history learning |
| Skill discovery | Implicit, AI figures it out | Capability graph with `provides`/`requires` |
| Project setup | `~init` required | Zero-config fingerprint |
| Cross-platform | 6 CLIs with custom adapters | 6 CLIs via Agent Skills standard |

### Repository Structure

```
helloagents/
├── cli.py                          # CLI entry point
├── _common.py                      # Shared constants and utilities
├── bootstrap.md                    # 28-line orchestration bootstrap
├── core/
│   ├── dispatcher.py               # Command routing + interactive menus
│   ├── installer.py                # Multi-CLI deployment
│   ├── uninstaller.py              # Clean removal per CLI
│   ├── updater.py                  # Self-update with Windows exe handling
│   ├── version_check.py            # Version comparison + update cache
│   ├── cli_adapters.py             # Unified config for all 6 CLIs
│   └── win_helpers.py              # Windows platform compatibility
├── skills/                         # 25 Agent Skills (SKILL.md)
│   ├── _meta/                      # Skill discovery protocol
│   ├── core/                       # Router, memory, EHRB, output format
│   ├── commands/                   # 11 workflow commands (~auto, ~plan, etc.)
│   ├── workflow/                   # Design, develop, review, brainstorm
│   ├── roles/                      # Reviewer, writer, brainstormer
│   └── integrations/               # Sub-agent bridge, MCP bridge
├── scripts/                        # Hook scripts (11 automation scripts)
├── hooks/                          # Claude/Gemini/Grok hook configs
├── templates/                      # KB and plan templates
└── user/                           # User customization (commands, memory, sounds)
```

## Configuration

Customize via `config.json`. Only include keys you want to override.

**Priority:** `{project}/.helloagents/config.json` > `~/.helloagents/config.json` > defaults

| Key | Default | Description |
|-----|---------|-------------|
| `OUTPUT_LANGUAGE` | `zh-CN` | AI output language |
| `KB_CREATE_MODE` | `2` | `0`=off, `1`=on-demand, `2`=auto on code changes, `3`=always |
| `BILINGUAL_COMMIT` | `1` | `0`=single language, `1`=bilingual commits |
| `EVAL_MODE` | `1` | `1`=progressive clarification, `2`=one-shot |
| `UPDATE_CHECK` | `72` | Cache TTL in hours (`0`=off) |
| `CSV_BATCH_MAX` | `16` | Max CSV batch concurrency, Codex only (`0`=off, max 64) |

```json
{
  "OUTPUT_LANGUAGE": "en-US",
  "KB_CREATE_MODE": 0,
  "BILINGUAL_COMMIT": 0
}
```

## Key Capabilities

<details>
<summary><b>Structured Workflow (Evaluate → Design → Develop)</b></summary>

Every input is scored and routed. R2/R3 tasks enter the full stage chain with entry conditions, deliverables, and verification gates. Supports interactive mode (pause at decisions) and delegated mode (auto-advance, pause only on risk).

Typical pattern: `~plan` → review → `~exec`. Or `~auto` for one-shot delivery.
</details>

<details>
<summary><b>Three-Layer Safety (EHRB)</b></summary>

- Layer 1: Command pattern matching (destructive commands, production operations)
- Layer 2: Semantic analysis (credential leaks, permission bypass, PII exposure)
- Layer 3: External tool output inspection (injection, format hijacking)

Detected risks trigger user confirmation in interactive mode, or auto-pause in delegated mode.
</details>

<details>
<summary><b>Sub-Agent Orchestration</b></summary>

3 specialized roles (reviewer, writer, brainstormer) + native CLI sub-agents. Tasks scheduled via DAG dependency analysis with parallel dispatch. Supports Claude Code Agent Teams, Codex CSV batch orchestration, and cross-CLI parallel scheduling.
</details>

<details>
<summary><b>Quality Verification (Ralph Loop)</b></summary>

After sub-agent code changes, verification commands run automatically. On failure, the sub-agent is blocked and must fix the issue. Verification source priority: `.helloagents/verify.yaml` → `package.json` scripts → auto-detected from project config.
</details>

<details>
<summary><b>Smart Commit (~commit)</b></summary>

Analyzes `git diff` for Conventional Commits messages. Pre-commit quality checks. Auto-excludes sensitive files. Supports commit-only, commit+push, or commit+push+PR. Bilingual messages when configured.
</details>

<details>
<summary><b>Custom Command Extension</b></summary>

Drop a Markdown file in `.helloagents/commands/`:

    .helloagents/commands/deploy.md  →  ~deploy
    .helloagents/commands/release.md →  ~release

File content defines execution rules. Lightweight gate (requirement understanding + EHRB) applied automatically.
</details>

<details>
<summary><b>Two-Layer Memory</b></summary>

- L0: User memory (global preferences in `~/.helloagents/user/memory/`)
- L1: Project knowledge base (per-project in `.helloagents/`)
- Routing history: JSONL log for adaptive calibration

Context survives across sessions and projects.
</details>

<details>
<summary><b>CSV Batch Orchestration (Codex CLI)</b></summary>

When 6+ structurally identical tasks exist, auto-converts to CSV and dispatches via `spawn_agents_on_csv`. Real-time progress tracking, SQLite crash recovery, partial failure handling. Configure via `CSV_BATCH_MAX`.
</details>

## FAQ

**Q: Is this a CLI tool or a prompt package?**
Both. The CLI manages installation and updates. The workflow behavior comes from bootstrap.md and 25 Agent Skills. Think: delivery system + intelligent orchestration protocol.

**Q: Which CLI should I install to?**
Whichever you use. `helloagents install claude` / `codex` / `gemini` / `qwen` / `grok` / `opencode`. Or `--all` for everything detected.

**Q: What if I already have rules files?**
HelloAGENTS backs up non-HelloAGENTS files before replacement. Timestamped backups in your CLI config directory.

**Q: Does it work without hooks?**
Yes. All hook-enhanced features degrade gracefully. Hooks make things more automatic, but nothing breaks without them.

**Q: How is v3 different from v2?**
56% less Python code. Agent Skills instead of custom modules. Three new features: adaptive routing memory, capability graph, zero-config fingerprint. Same workflow, much leaner runtime.

## Troubleshooting

<details>
<summary><code>helloagents: command not found</code></summary>

Install path not in PATH. UV users: restart terminal. pip users: check `pip show helloagents` for location. Verify with `which helloagents` (Unix) or `where helloagents` (Windows).
</details>

<details>
<summary>CLI target not detected</summary>

Config directory doesn't exist yet. Launch the target CLI once to create it, then retry `helloagents install <target>`.
</details>

<details>
<summary>CCswitch replaces config</summary>

After switching CCswitch profiles, run `helloagents install claude` or `helloagents update` to restore. v2.3.5+ auto-detects config corruption on session start.
</details>

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines and PR checklist.

## License

Dual-licensed: Code under Apache-2.0, Documentation under CC BY 4.0. See [LICENSE.md](./LICENSE.md).

---

<div align="center">

If HelloAGENTS improves your workflow, a star goes a long way.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project

</div>

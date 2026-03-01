<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**Let AI go beyond analysis — keep pushing until implementation and verification are done.**

[![Version](https://img.shields.io/badge/version-2.3.0-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/workflow_commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

## Table of Contents

- [Before and After](#before-and-after)
- [Core Features](#core-features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Repository Guide](#repository-guide)
- [In-Chat Workflow Commands](#in-chat-workflow-commands)
- [Usage Guide](#usage-guide)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Version History](#version-history)
- [Contributing](#contributing)
- [License](#license)

## Before and After

<table>
<tr>
<td width="50%" valign="top" align="center">

**Without HelloAGENTS**

<img src="./readme_images/08-demo-snake-without-helloagents.png" alt="Snake demo without HelloAGENTS" width="520">

</td>
<td width="50%" valign="top" align="center">

**With HelloAGENTS**

<img src="./readme_images/07-demo-snake-with-helloagents.png" alt="Snake demo with HelloAGENTS" width="520">

</td>
</tr>
</table>

| Challenge | Without HelloAGENTS | With HelloAGENTS |
|-----------|-------------------|-----------------|
| Stops at planning | Ends with suggestions | Pushes to implementation and validation |
| Output drift | Different structure every prompt | Unified routing and stage chain |
| Risky operations | Easier to make destructive mistakes | EHRB risk detection and escalation |
| Knowledge continuity | Context gets scattered | Built-in KB and session memory |
| Reusability | Prompt-by-prompt effort | Commandized reusable workflow |

## Core Features

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**RLM Sub-Agent Orchestration**

5 specialized roles (reviewer / synthesizer / kb_keeper / pkg_keeper / writer) plus host CLI native sub-agents (explore / implement / test / design) are dispatched automatically based on task complexity. Tasks are scheduled via DAG dependency analysis with topological sort and layer-by-layer parallel dispatch. Supports cross-CLI parallel scheduling and Agent Teams collaboration.

**Your gain:** complex tasks are broken down and handled by the right specialist, with parallel execution when possible.
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**Structured Workflow (Evaluate → Design → Develop)**

Every input is scored on five dimensions and routed to R0 direct response, R1 fast flow, R2 simplified flow, or R3 standard flow. R2/R3 enter the full stage chain with explicit entry conditions, deliverables, and verification gates. Supports interactive and fully delegated modes.

**Your gain:** proportional effort — simple queries stay fast, complex tasks get full process with verification at every step.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**Three-Layer Safety Detection (EHRB)**

Keyword scan, semantic analysis, and tool-output inspection catch destructive operations before execution. Interactive and delegated modes enforce user confirmation.

**Your gain:** safer defaults with zero-config protection.
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**Three-Layer Memory Model**

L0 user memory (global preferences), L1 project knowledge base (structured docs synced from code), and L2 session summaries (auto-persisted at stage transitions).

**Your gain:** context survives across sessions and projects.
</td>
</tr>
</table>

### Sub-Agent Native Mapping

| CLI | Native Sub-Agent Mechanism | RLM Mapping |
|-----|---------------------------|-------------|
| Claude Code | Task tool (explore / code / shell) | Direct mapping, supports Agent Teams |
| Codex CLI | spawn_agent / Collab (multi-thread) | spawn_agent parallel scheduling, CSV batch orchestration |
| OpenCode | Built-in agent mode | Fallback to sequential execution |
| Gemini CLI | Built-in tool calls | Fallback to sequential execution |
| Qwen CLI | Built-in tool calls | Fallback to sequential execution |
| Grok CLI | Built-in tool calls | Fallback to sequential execution |

Additionally, HelloAGENTS provides: **five-dimension routing scoring** (action need, target clarity, decision scope, impact range, EHRB risk) to automatically determine processing depth for each input; **6 CLI targets** (Claude Code / Codex CLI / OpenCode / Gemini CLI / Qwen CLI / Grok CLI) with one rule set across all; **Hooks integration** (Claude Code 9 lifecycle hooks + Codex CLI notify hook) with automatic graceful degradation when unavailable.

## Quick Start

> ⚠️ **Prerequisite:** All AI CLIs (Codex CLI / Claude Code, etc.) should be upgraded to the latest version with relevant feature flags enabled (e.g., sub-agents, CSV orchestration) to access all HelloAGENTS capabilities. VSCode extensions for these CLIs update more slowly — some newer features may require waiting for the extension to catch up. See CLI-specific compatibility notes below.

### Method A: One-line install script (recommended)

**macOS / Linux:**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell:**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> The script auto-detects `uv` or `pip`, installs the HelloAGENTS package, and launches an interactive menu for you to select target CLIs. Re-running performs an update.

**Update:**

    helloagents update

### Method B: npx (Node.js >= 16)

    npx helloagents

> Installs the Python package and launches an interactive menu. You can also specify directly: `npx helloagents install codex` (or use `npx -y` to auto-download without prompting)

> Requires Python >= 3.10. After first install, use the native `helloagents` command directly.

> **Acknowledgment:** Thanks to @setsuna1106 for generously transferring the npm `helloagents` package ownership.

### Method C: UV (isolated environment)

**Step 0 — Install UV first (skip if already installed):**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> After installing UV, restart your terminal to make the `uv` command available.

> ⚠️ Windows PowerShell 5.1 does not support `&&`. Please run commands separately, or upgrade to [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows).

**Install and select targets (one command):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> Installs the package and launches an interactive menu for you to select target CLIs. You can also specify directly: `helloagents install codex`

**Update:**

    helloagents update

### Method D: pip (Python >= 3.10)

**Install and select targets (one command):**

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents

> Installs the package and launches an interactive menu for you to select target CLIs. You can also specify directly: `helloagents install codex`

**Update:**

    pip install --upgrade git+https://github.com/hellowind777/helloagents.git

### Install HelloAgents for different CLI targets

    helloagents                  # interactive menu

    helloagents install codex    # specify target directly

    helloagents install --all    # install to all detected CLIs

### Verify

    helloagents status

    helloagents version

### Uninstall

    helloagents uninstall codex

    helloagents uninstall --all

### Clean caches

    helloagents clean

### Codex CLI example

**First install:**

    # One-line script (recommended, auto-launches interactive menu after install)
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx (or use npx -y to auto-download without prompting)
    npx helloagents install codex

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install codex

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install codex

**Update later (auto-syncs installed targets):**

    helloagents update

> ⚠️ **Codex CLI config.toml compatibility notes:** The following settings may affect HelloAGENTS:
> - `[features]` `child_agents_md = true` — experimental, injects extra instructions that may conflict with HelloAGENTS
> - `project_doc_max_bytes` too low — default 32KB, AGENTS.md will be truncated (auto-set to 131072 during install)
> - `agent_max_depth = 1` — limits sub-agent nesting depth, recommend keeping default or ≥2
> - `agent_max_threads` too low — default 6, lower values limit parallel sub-agent scheduling (CSV batch mode recommends ≥16)
> - `[features]` `multi_agent = true` — must be enabled for sub-agent orchestration to work
> - `[features]` `sqlite = true` — must be enabled for CSV batch orchestration (spawn_agents_on_csv)
> - Collab sub-agent scheduling requires Codex CLI feature gate to be enabled

### Claude Code example

**First install:**

    # One-line script (recommended, auto-launches interactive menu after install)
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # npx (or use npx -y to auto-download without prompting)
    npx helloagents install claude

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install claude

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install claude

**Update later (auto-syncs installed targets):**

    helloagents update

> 💡 **Claude Code sub-agent orchestration tips:**
> - Sub-agents (Task tool) work out of the box, no extra configuration needed
> - Agent Teams collaboration mode requires environment variable: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
> - Parallel sub-agent count is managed automatically by the model, no user-side limit config needed

### Beta branch

To install from the `beta` branch, append `@beta` to the repository URL:

    # One-line script (auto-launches interactive menu after install)
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

    # npx (or use npx -y to auto-download without prompting)
    npx helloagents@beta

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents && helloagents

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git@beta && helloagents

## Configuration

Customize workflow behavior via `config.json` after installation. Only include keys you want to override — missing keys use defaults.

**Storage locations (highest priority first):**

1. Project-level: `{project_root}/.helloagents/config.json` — current project only
2. Global: `~/.helloagents/config.json` — all projects
3. Built-in defaults

**Available keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `OUTPUT_LANGUAGE` | string | `zh-CN` | Language for AI output and KB files |
| `KB_CREATE_MODE` | int | `2` | KB creation: `0`=OFF, `1`=on-demand (prompt ~init), `2`=auto on code changes, `3`=always auto |
| `BILINGUAL_COMMIT` | int | `1` | Commit language: `0`=OUTPUT_LANGUAGE only, `1`=OUTPUT_LANGUAGE + English |
| `EVAL_MODE` | int | `1` | Clarification mode: `1`=progressive (1 question/round, max 5), `2`=one-shot (all at once, max 3) |
| `UPDATE_CHECK` | int | `72` | Update check cache TTL in hours: `0`=OFF |
| `CSV_BATCH_MAX` | int | `16` | CSV batch max concurrency: `0`=OFF, cap 64 (Codex CLI only) |

**Example:**

```json
{
  "KB_CREATE_MODE": 0,
  "EVAL_MODE": 2
}
```

> File missing or unparseable is silently skipped with defaults applied. Unknown keys produce a warning and are ignored.

## How It Works

1. Install the package (script/pip/uv) and run `helloagents` to launch an interactive menu for selecting target CLIs (or specify directly with `helloagents install <target>`). Hooks and SKILL.md are auto-deployed during installation.
2. In AI chat, every input is scored on five dimensions and routed to R0–R3.
3. R2/R3 tasks enter the stage chain: EVALUATE → DESIGN → DEVELOP. R1 fast flow handles single-point operations directly.
4. RLM dispatches native sub-agents and specialized roles based on task complexity. Tasks with dependencies are scheduled via DAG topological sort with layer-by-layer parallel dispatch.
5. EHRB scans each step for destructive operations; risky actions require explicit user confirmation. Hooks provide additional pre-tool safety checks when available.
6. Three-layer memory (user / project KB / session) preserves context across sessions.
7. Stage chain completes with verified output and optional knowledge base sync.

## Repository Guide

- AGENTS.md: router and workflow protocol
- SKILL.md: skill discovery metadata for CLI targets
- pyproject.toml: package metadata (v2.3.0)
- helloagents/cli.py: installer entry
- helloagents/functions: workflow commands
- helloagents/stages: design, develop
- helloagents/services: knowledge, package, memory and support services
- helloagents/rules: state, cache, tools, scaling
- helloagents/rlm: role library and orchestration helpers
- helloagents/hooks: Claude Code and Codex CLI hooks configs
- helloagents/scripts: automation scripts
- helloagents/templates: KB and plan templates

## In-Chat Workflow Commands

These commands run inside AI chat, not your system shell.

| Command | Purpose |
|---|---|
| ~auto | full autonomous workflow |
| ~plan | planning and package generation |
| ~exec | execute existing package |
| ~init | initialize knowledge base |
| ~upgradekb | upgrade knowledge structure |
| ~clean / ~cleanplan | cleanup workflow artifacts |
| ~test / ~review / ~validatekb | quality checks |
| ~commit | generate commit message from context |
| ~rollback | rollback workflow state |
| ~rlm | role orchestration (spawn / agents / resume / team) |
| ~status / ~help | status and help |

## Usage Guide

### Three Workflow Modes

| Mode | Description | When to use |
|------|-------------|-------------|
| `~auto` | Full autonomous flow from requirement to verified implementation (Evaluate → Design → Develop → Verify) | Clear requirement, want end-to-end delivery |
| `~plan` | Planning only, generates a proposal package then stops — no code written | Want to review the plan before committing |
| `~exec` | Skip evaluation and design, execute an existing plan package directly | After `~plan` review, ready to implement |

Typical pattern: `~plan` first → review → `~exec` to implement. Or just `~auto` for one-shot delivery.

### Interactive vs Delegated Mode

When `~auto` or `~plan` presents its confirmation, you choose:

- **Interactive (default):** pauses at key decision points (plan selection, failure handling)
- **Delegated (fully automatic):** auto-advances all stages, auto-selects recommended options, only pauses on EHRB risk
- **Plan-only delegated:** fully automatic but stops after design, never enters development

Without `~` commands, plain-text input is automatically routed to R0–R3 based on complexity.

### Requirement Evaluation

Before R2/R3 tasks enter execution, the system scores requirements on four dimensions (scope 0–3, deliverable spec 0–3, implementation conditions 0–2, acceptance criteria 0–2, total 10). Score ≥ 8 proceeds to confirmation; < 8 triggers clarifying questions:

- `EVAL_MODE=1` (default, progressive): asks 1 lowest-scoring dimension per round, up to 5 rounds
- `EVAL_MODE=2` (one-shot): asks all low-scoring dimensions at once, up to 3 rounds

Context inferred from the existing codebase counts toward the score automatically. Say "skip evaluation / just do it" to bypass the questioning phase.

### Parallel Design Proposals

In the R3 standard path, the design stage dispatches 3–6 sub-agents to independently generate competing implementation proposals. The main agent evaluates all proposals across four dimensions: user value, solution soundness, risk (including EHRB), and implementation cost. Weights are dynamically adjusted based on project characteristics (e.g., performance-critical systems weight soundness higher; MVPs weight cost higher).

- Interactive mode: user selects a proposal or requests re-generation (max 1 retry)
- Delegated mode: recommended proposal is auto-selected
- R2 simplified path skips multi-proposal comparison and goes directly to planning

### Auto Dependency Management

During development, the system auto-detects the project's package manager via lockfiles (`yarn.lock` → yarn, `uv.lock` → uv, `Gemfile.lock` → bundler, etc.) and handles dependencies:

- Declared but missing dependencies: auto-installed
- New dependencies required by tasks: auto-added with declaration file updated
- Ambiguous dependencies: user is asked before installing

### Quality Verification (Ralph Loop & Break-loop)

**Ralph Loop** (Claude Code, via SubagentStop Hook): after a sub-agent completes code changes, the project's verification command runs automatically. On failure, the sub-agent is blocked from exiting and must fix the issue (max 1 retry loop). Verification command priority: `.helloagents/verify.yaml` → `package.json` scripts → auto-detected.

**Break-loop** (deep root cause analysis): triggered when a task fails repeatedly (after Ralph Loop + at least 1 manual fix attempt), performing five-dimension root cause analysis:

1. Root cause classification (logic error / type mismatch / missing dependency / environment / design flaw)
2. Why previous fixes didn't work
3. Prevention mechanism suggestions
4. Systemic scan — same issue in other modules?
5. Lessons learned recorded in the acceptance report

### Custom Command Extension

Create `.helloagents/commands/` in your project and drop in Markdown files — the filename becomes the command name:

    .helloagents/commands/deploy.md  →  ~deploy
    .helloagents/commands/release.md →  ~release

File content defines the execution rules. The system applies a lightweight gate (requirement understanding + EHRB check).

### Smart Commit (~commit)

`~commit` does more than generate a message:

- Analyzes `git diff` to auto-generate Conventional Commits formatted messages
- Pre-commit quality checks (code-doc consistency, test coverage, verification commands)
- Auto-excludes sensitive files (`.env`, `*.pem`, `*.key`, etc.) — never runs `git add .`
- Shows file list before staging, supports exclusion
- Options: local commit only / commit + push / commit + push + create PR
- Bilingual commit messages when `BILINGUAL_COMMIT=1`

### Manual Sub-Agent Invocation

Beyond automatic dispatch, you can manually invoke specific roles:

    ~rlm spawn reviewer "review src/api/ for security issues"
    ~rlm spawn writer "generate API reference docs"
    ~rlm spawn reviewer,synthesizer "analyze and summarize the auth module"  # parallel

Available roles: `reviewer` (code review), `synthesizer` (multi-source synthesis), `kb_keeper` (KB maintenance), `pkg_keeper` (plan package management), `writer` (documentation).

### Multi-Terminal Collaboration

Multiple terminals (across different CLIs) can share a task list:

    # Terminal A
    hellotasks=my-project codex

    # Terminal B
    hellotasks=my-project claude

Commands once enabled:

    ~rlm tasks                  # view shared task list
    ~rlm tasks available        # see unclaimed tasks
    ~rlm tasks claim <id>       # claim a task
    ~rlm tasks complete <id>    # mark done
    ~rlm tasks add "task title" # add a new task

Tasks are stored in `{KB_ROOT}/tasks/` with file locking to prevent concurrent conflicts.

### KB Auto-Sync & CHANGELOG

The knowledge base syncs automatically at these points:

- After every development stage, `kb_keeper` sub-agent syncs module docs to reflect actual code
- After every R1/R2/R3 task completion, CHANGELOG is auto-appended
- On session end (Claude Code Stop Hook), KB sync + L2 session summary write triggered asynchronously

CHANGELOG uses semantic versioning (X.Y.Z). Version source priority: user-specified → project file (package.json, pyproject.toml, etc., supporting 15+ languages/frameworks) → git tag → last CHANGELOG entry → 0.1.0. R1 fast-path changes are recorded under a "Quick Modifications" category with file:line range.

`KB_CREATE_MODE` controls automatic behavior: `0`=off, `1`=prompt on demand, `2`=auto on code changes (default), `3`=always auto.

### Worktree Isolation

When multiple sub-agents need to modify different regions of the same file simultaneously (Claude Code only), the system automatically uses `Task(isolation="worktree")` to create an independent git worktree for each sub-agent, preventing Edit tool conflicts. The main agent merges all worktree changes in the consolidation phase. Only activated when sub-agents have overlapping file writes; read-only tasks don't use it.

### CSV Batch Orchestration (Codex CLI)

When ≥6 structurally identical tasks exist in the same execution layer, the system auto-converts `tasks.md` into a task CSV and dispatches via `spawn_agents_on_csv`. Each worker receives its row data + instruction template, executes independently, and reports results.

- Progress tracked in real-time via `agent_job_progress` events (pending/running/completed/failed/ETA)
- State persisted in SQLite for crash recovery
- Partial failures still export results with failure summary
- Heterogeneous tasks automatically fall back to `spawn_agent` sequential dispatch
- Configure concurrency via `CSV_BATCH_MAX` (default 16, max 64, set to 0 to disable)

### Update Check

On the first response of each session, the system silently checks for new versions. Results are cached at `~/.helloagents/.update_cache`, valid for the duration set by `UPDATE_CHECK` (default 72 hours, set to 0 to disable). When a new version is available, `⬆️ New version {version} available` appears in the response footer. Any errors during the check are silently skipped and never interrupt normal usage.

## FAQ

- Q: Is this a Python CLI tool or prompt package?
  A: Both. CLI manages installation; workflow behavior comes from AGENTS.md and helloagents docs.

- Q: Which target should I install?
  A: Use the CLI you run: codex, claude, gemini, qwen, grok, or opencode.

- Q: What if a rules file already exists?
  A: Non-HelloAGENTS files are backed up before replacement.

- Q: What is RLM?
  A: Role Language Model — a sub-agent orchestration system with 5 specialized roles + native CLI sub-agents, DAG-based parallel scheduling, and standardized prompt/return format.

- Q: Where does project knowledge go?
  A: In the project-local `.helloagents/` directory, auto-synced when code changes.

- Q: Does memory persist across sessions?
  A: Yes. L0 user memory is global, L1 project KB is per-project, L2 session summaries are auto-saved at stage transitions.

- Q: What are Hooks?
  A: Lifecycle hooks auto-deployed during installation. Claude Code gets 9 event hooks (safety checks, progress snapshots, KB sync, etc.); Codex CLI gets a notify hook for update checks. All optional — features degrade gracefully without hooks.

- Q: What is Agent Teams?
  A: An experimental Claude Code multi-agent collaboration mode. Multiple Claude Code instances work as teammates with shared task lists and mailbox communication, mapped to RLM roles. Falls back to standard Task sub-agents when unavailable.

## Troubleshooting

- command not found: ensure install path is in PATH
- package version unknown: install package first for metadata
- target not detected: launch target CLI once to create config directory
- custom rules overwritten: restore from timestamped backup in CLI config dir
- images not rendering: keep relative paths and commit readme_images files

## Version History

### v2.3.0 (current)

- Comprehensive cross-audit fix: unified role output format, normalized path references, code-doc consistency alignment
- Quality verification loop (Ralph Loop): auto-verify after sub-agent completion, block and feedback on failure
- Auto context injection for sub-agents and rule reinforcement for main agent
- Deep 5-dimension root cause analysis on repeated failures (break-loop)
- Auto-inject project technical guidelines before sub-agent development
- Pre-commit quality checks (code-doc consistency, test coverage, verification commands)
- Worktree isolation for parallel editing
- Custom command extension (.helloagents/commands/)
- Auto-append Git author info to CHANGELOG entries

### v2.2.16

- Refactored evaluation dimension system with dimension isolation rule, pass threshold tuned to 8/10. Options are user-need-driven, organized by style direction rather than complexity tiers (e.g. UI design offers different styles instead of simple/medium/complex); recommended option points to the most complete deliverable, derived from recommendation principles and scoring criteria rather than hardcoded
- Proposal design requires both implementation path and deliverable design direction to differ across alternatives, each sub-agent independently outputs a complete proposal including presentation direction, style, and experience
- Proposal evaluation criteria optimized: user value weight is always no less than any other single dimension, evaluation dimensions dynamically adjusted by project context
- Universal task type support: generalized evaluation, follow-up, and proposal design terminology from programming-specific to documents, design, general tasks and more
- Added sub-agent DAG dependency scheduling with topological sort, layer-by-layer parallel dispatch, and failure propagation
- Dynamic sub-agent parallel count based on independent work units, eliminated hardcoded limits
- Unified output format: structured display for score breakdowns, follow-up options, and confirmation messages
- Streamlined execution paths with shorter stage chains and step-level on-demand module loading
- Adjusted Codex CLI memory limit to 128 KiB to prevent rules file truncation
- Improved recommendation option generation rules, proposal differentiation requirements, and evaluation scoring criteria

### v2.2.14

- DAG dependency scheduling for task execution (depends_on, topological sort, layer-by-layer parallel dispatch with failure propagation)
- Graded retry and standardized sub-agent return format with scope verification
- Sub-agent orchestration paradigm: four-step method, prompt template, behavior constraints (route-skip, output format)
- Execution path hardening: explicit R1 upgrade triggers, DESIGN retry limits, DEVELOP entry/exit conditions
- Workflow rule audit: terminology and format consistency, redundancy cleanup

### v2.2.13

- R3 design proposals default ≥3 parallel, parallel batch limit ≤6, explicit sub-agent count principle

## Contributing

See CONTRIBUTING.md for contribution rules and PR checklist.

## License

This project is dual-licensed: Code under Apache-2.0, Documentation under CC BY 4.0. See [LICENSE.md](./LICENSE.md).

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project

</div>

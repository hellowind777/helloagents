<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**Let AI go beyond analysis — keep pushing until implementation and verification are done.**

[![Version](https://img.shields.io/badge/version-2.3.7-orange.svg)](./pyproject.toml)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> [!IMPORTANT]
> **Looking for the old version of HelloAGENTS?** The legacy codebase has been moved to a separate archive repository: [helloagents-archive](https://github.com/hellowind777/helloagents-archive)

## Table of Contents

- [Before and After](#before-and-after)
- [Core Features](#core-features)
  - [Sub-Agent Native Mapping](#sub-agent-native-mapping)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [In-Chat Workflow Commands](#in-chat-workflow-commands)
- [Usage Guide](#usage-guide)
- [Repository Guide](#repository-guide)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Version History](#version-history)
- [Contributing](#contributing)
- [License](#license)
- [Next Steps](#next-steps)

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

3 specialized roles (reviewer / writer / brainstormer) plus host CLI native sub-agents (explore / code / brainstorm) are dispatched automatically based on task complexity. Tasks are scheduled via DAG dependency analysis with topological sort and layer-by-layer parallel dispatch. Supports cross-CLI parallel scheduling and Agent Teams collaboration.

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

**Two-Layer Memory Model**

L0 user memory (global preferences) and L1 project knowledge base (structured docs synced from code).

**Your gain:** context survives across sessions and projects.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**Extensibility & Customization**

Voice notifications (5 event sounds), custom command extension (`.helloagents/commands/*.md`), user-defined tool orchestration (sub-agents, skills, MCP servers, plugins), and flexible configuration options. All features work across 6 CLI targets with graceful degradation.

**Your gain:** tailor the workflow to your team's needs without forking the codebase.
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**Multi-CLI Support**

One rule set works across Claude Code, Codex CLI, OpenCode, Gemini CLI, Qwen CLI, and Grok CLI (Experimental/Community). Automatic feature detection and graceful degradation ensure consistent experience regardless of CLI capabilities.

**Your gain:** switch between CLIs without relearning workflows or reconfiguring rules.
</td>
</tr>
</table>

### Sub-Agent Native Mapping

| CLI | Native Sub-Agent Mechanism | RLM Mapping |
|-----|---------------------------|-------------|
| Claude Code | Agent tool (explore / code / shell) | Direct mapping, supports Agent Teams |
| Codex CLI | spawn_agent / Collab (multi-thread) | spawn_agent parallel scheduling, CSV batch orchestration |
| OpenCode | Task tool (build / plan / general / explore) | Direct sub-agent mapping |
| Gemini CLI | Built-in tool calls | Fallback to sequential execution |
| Qwen CLI | Built-in tool calls | Fallback to sequential execution |
| Grok CLI (Experimental) | Built-in tool calls | Fallback to sequential execution |

Additionally, HelloAGENTS provides: **five-dimension routing scoring** (action need, target clarity, decision scope, impact range, EHRB risk) to automatically determine processing depth for each input; **6 CLI targets** (Claude Code / Codex CLI / OpenCode / Gemini CLI / Qwen CLI / Grok CLI) with one rule set across all; **Hooks integration** (Claude Code 11 lifecycle hooks + Codex CLI notify hook + Gemini/Grok CLI hooks) with automatic graceful degradation when unavailable.

### CLI Compatibility Quick Reference

| CLI | Recommended Version | Key Features | Configuration Notes |
|-----|-------------------|--------------|---------------------|
| **Claude Code** | Latest | Agent Teams, 11 lifecycle hooks, auto-memory | Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for teams mode |
| **Codex CLI** | 0.110+ | spawn_agent, CSV batch, collaboration_modes | Enable sub-agents, CSV orchestration, set `project_doc_max_bytes >= 131072` |
| **OpenCode** | Latest | Task tool, custom agents, MCP | Supports primary agents (build/plan) + subagents (general/explore) |
| **Gemini CLI** | Latest | Built-in tool calls | Sequential execution fallback |
| **Qwen CLI** | Latest | Built-in tool calls | Sequential execution fallback |
| **Grok CLI** (Experimental) | Latest | Built-in tool calls | Community wrapper, hooks not fully verified |

<details>
<summary>📋 Detailed CLI-specific notes (click to expand)</summary>

**Codex CLI Configuration:**
- Enable sub-agents and CSV orchestration features
- Set `project_doc_max_bytes = 131072` in config.toml
- Configure `developer_instructions` for routing protocol priority
- Enable `collaboration_modes` for TUI interactive selection (v0.110+)
- Configure `nickname_candidates` for agent role identification
- Configure CSV batch processing if using parallel workflows

**Claude Code Setup:**
- Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable for Agent Teams
- 11 lifecycle hooks auto-configured during installation (SessionStart, UserPromptSubmit, SubagentStart/Stop, PostToolUse, Stop, TeammateIdle, PreCompact, PreToolUse, SessionEnd, PostToolUseFailure)
- Auto-memory feature enabled by default

**Other CLIs:**
- OpenCode supports Task tool with primary agents (build/plan) and subagents (general/explore)
- Gemini/Qwen/Grok use sequential execution fallback
- All features work with graceful degradation
- Hooks may not be available on all platforms

</details>

## Quick Start

> 💡 **Choose your installation method:**
> - **First-time users** → Method A (one-line script, recommended)
> - **Node.js developers** → Method B (npx)
> - **Python developers** → Method D (pip)
> - **Need isolated environment** → Method C (UV)

> ⚠️ **Prerequisite:** All AI CLIs (Codex CLI / Claude Code, etc.) should be upgraded to the latest version with relevant feature flags enabled (e.g., sub-agents, CSV orchestration) to access all HelloAGENTS capabilities. VSCode extensions for these CLIs update more slowly — some newer features may require waiting for the extension to catch up. See CLI-specific compatibility notes below.

> ⚠️ **Windows PowerShell 5.1** does not support `&&`. Run commands on each side of `&&` separately, or upgrade to [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows).

### Method A: One-line install script (recommended)

**macOS / Linux:**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell:**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> The script auto-detects `uv` or `pip`, installs the HelloAGENTS package, and launches an interactive menu for you to select target CLIs. Re-running performs an update.

**Update:** re-run the install command above.

**Uninstall:** `uv tool uninstall helloagents` or `pip uninstall helloagents` (depends on what the script detected)

**Switch branch:**

    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

### Method B: npx (Node.js >= 16)

    npx helloagents

> Installs the Python package via pip and launches an interactive menu. You can also specify directly: `npx helloagents install codex` (or use `npx -y` to auto-download without prompting)

> Requires Python >= 3.10. After first install, use the native `helloagents` command directly.

> **Acknowledgment:** Thanks to @setsuna1106 for generously transferring the npm `helloagents` package ownership.

**Update:** `npx helloagents@latest`

**Uninstall:** `pip uninstall helloagents`

**Switch branch:** `npx helloagents@beta`

### Method C: UV (isolated environment)

**Step 0 — Install UV first (skip if already installed):**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> After installing UV, restart your terminal to make the `uv` command available.

**Install and select targets (one command):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> Installs the package and launches an interactive menu for you to select target CLIs. You can also specify directly: `helloagents install codex`

**Update:** `uv tool install --from git+https://github.com/hellowind777/helloagents helloagents --force`

**Uninstall:** `uv tool uninstall helloagents`

**Switch branch:** `uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents --force`

### Method D: pip (Python >= 3.10)

**Install and select targets (one command):**

    pip install git+https://github.com/hellowind777/helloagents.git && helloagents

> Installs the package and launches an interactive menu for you to select target CLIs. You can also specify directly: `helloagents install codex`

**Update:** `pip install --upgrade git+https://github.com/hellowind777/helloagents.git`

**Uninstall:** `pip uninstall helloagents`

**Switch branch:** `pip install --upgrade git+https://github.com/hellowind777/helloagents.git@beta`

### HelloAGENTS commands (after installation)

> ⚠️ These commands depend on the installed package. If a remote update causes issues, use the native install/update/uninstall commands from your installation method above.

    helloagents                  # interactive menu
    helloagents install codex    # specify target directly
    helloagents install --all    # install to all detected CLIs
    helloagents status           # check installation status
    helloagents version          # check version
    helloagents update           # update + auto-sync all targets
    helloagents update beta      # switch branch + auto-sync
    helloagents uninstall codex  # uninstall from a CLI target
    helloagents uninstall --all  # uninstall from all targets
    helloagents clean            # clean caches

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
>
> 💡 **Best practices:**
> - Codex 0.110+ recommended for full feature set (collaboration_modes, nickname_candidates)
> - HelloAGENTS is optimized for Codex CLI — supports `high` and below reasoning effort levels. `xhigh` reasoning is **not supported** and may cause instruction-following issues
> - Use the terminal/CLI version of Codex for the best experience. The VSCode extension updates lag behind the CLI — newer features (e.g., CSV batch orchestration, Collab multi-agent) may require waiting for the extension to catch up

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
> - Sub-agents (Agent tool) work out of the box, no extra configuration needed
> - Agent Teams collaboration mode requires environment variable: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
> - Parallel sub-agent count is managed automatically by the model, no user-side limit config needed

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

### Common Configuration Scenarios

<details>
<summary>📝 English-only projects</summary>

```json
{
  "OUTPUT_LANGUAGE": "en-US",
  "BILINGUAL_COMMIT": 0
}
```
All AI outputs, KB files, and commit messages will be in English only.
</details>

<details>
<summary>🚫 Disable automatic KB creation</summary>

```json
{
  "KB_CREATE_MODE": 0
}
```
Knowledge base won't be created automatically. Use `~init` command when needed.
</details>

<details>
<summary>⚡ High-concurrency batch processing (Codex CLI)</summary>

```json
{
  "CSV_BATCH_MAX": 32
}
```
Increase parallel CSV batch processing from 16 to 32 (max 64). Requires Codex CLI with CSV orchestration enabled.
</details>

<details>
<summary>🔕 Disable update checks</summary>

```json
{
  "UPDATE_CHECK": 0
}
```
Skip version update checks entirely (not recommended for production use).
</details>

<details>
<summary>💬 One-shot clarification mode</summary>

```json
{
  "EVAL_MODE": 2
}
```
Ask all clarification questions at once (max 3) instead of progressive mode (1 question per round, max 5).
</details>

## How It Works

**In short:** HelloAGENTS automatically selects processing depth based on task complexity — simple questions get fast responses, complex tasks go through the full evaluate→design→develop flow, with safety checks and memory retention throughout.

**Detailed flow:**

1. **Install & Deploy** — Run `helloagents` to select target CLI, auto-deploys config files and hooks
2. **Smart Routing** — Every input is auto-scored; simple queries get direct answers, complex tasks enter structured workflow
3. **Stage Progression** — Complex tasks advance through "Evaluate → Design → Develop" stages, each with clear deliverables
4. **Auto Orchestration** — System dispatches sub-agents and specialized roles based on complexity, parallelizes when possible
5. **Safety Guard** — Each step scans for destructive operations, risky actions require user confirmation
6. **Memory Retention** — User preferences, project knowledge, session context persist across sessions
7. **Verified Completion** — Stage chain completes with verified output, auto-syncs knowledge base

## In-Chat Workflow Commands

These commands run inside AI chat, not your system shell.

**Common Commands:**

| Command | Purpose |
|---|---|
| ~auto | full autonomous workflow |
| ~plan | planning and package generation |
| ~exec | execute existing package |
| ~init | initialize knowledge base |
| ~commit | generate commit message from context |
| ~status / ~help | status and help |

**Quality Checks:**

| Command | Purpose |
|---|---|
| ~test | run project tests |
| ~review | code review |
| ~validatekb | validate knowledge base |

**Advanced Features:**

| Command | Purpose |
|---|---|
| ~upgradekb | upgrade knowledge structure |
| ~clean / ~cleanplan | cleanup workflow artifacts |
| ~rollback | rollback workflow state |
| ~rlm | role orchestration (spawn / agents / resume / team) |

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
    ~rlm spawn reviewer,writer "analyze and document the auth module"  # parallel

Available roles: `reviewer` (code review), `writer` (documentation), `brainstormer` (multi-proposal comparison).

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

- After every development stage, main agent syncs module docs to reflect actual code
- After every R1/R2/R3 task completion, CHANGELOG is auto-appended
- On session end (Claude Code Stop Hook), KB sync flag set asynchronously

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

## Repository Guide

- AGENTS.md: router and workflow protocol
- SKILL.md: skill discovery metadata for CLI targets
- pyproject.toml: package metadata (v2.3.7)
- helloagents/cli.py: CLI entry point
- helloagents/_common.py: shared constants and utilities
- helloagents/core/: CLI management modules (install, uninstall, update, status, dispatcher, hooks settings)
- helloagents/functions: command definitions (15)
- helloagents/stages: design, develop
- helloagents/services: knowledge, package, memory and support services
- helloagents/rules: state, cache, tools, scaling, sub-agent protocols
- helloagents/rlm: role library and orchestration helpers
- helloagents/hooks: Claude Code, Codex CLI, Gemini CLI, and Grok CLI hooks configs
- helloagents/scripts: automation scripts (sound notify, progress snapshot, safety guard, etc.)
- helloagents/agents: sub-agent definitions (3 RLM roles)
- helloagents/user/commands: custom command templates
- helloagents/assets: sound resources (5 event sounds)
- helloagents/templates: KB and plan templates

## FAQ

**Q: Is this a Python CLI tool or prompt package?**

A: Both. The CLI manages installation and updates, while the workflow behavior comes from AGENTS.md and documentation files. Think of it as a delivery system + intelligent workflow protocol.

**Q: Which target should I install?**

A: Choose the CLI you're actively using: `codex` (Codex CLI), `claude` (Claude Code), `gemini` (Gemini CLI), `qwen` (Qwen CLI), `grok` (Grok CLI), or `opencode` (OpenCode). You can install to multiple targets with `helloagents install --all`. See [CLI Compatibility Quick Reference](#cli-compatibility-quick-reference) for details.

**Q: What if a rules file already exists?**

A: HelloAGENTS automatically backs up non-HelloAGENTS files before replacement. Backups are timestamped and stored in your CLI's config directory. You can restore them anytime if needed.

**Q: What is RLM?**

A: Role Language Model — HelloAGENTS's sub-agent orchestration system. It includes 3 specialized roles (reviewer, writer, brainstormer) plus native CLI sub-agents. Tasks are scheduled via DAG dependency analysis with parallel execution when possible. Learn more in [Usage Guide](#usage-guide).

**Q: Where does project knowledge go?**

A: In the project-local `.helloagents/` directory. The knowledge base auto-syncs when code changes (controlled by `KB_CREATE_MODE` config). It includes module docs, CHANGELOG, session summaries, and custom commands. See [KB Auto-Sync & CHANGELOG](#kb-auto-sync--changelog).

**Q: Does memory persist across sessions?**

A: Yes, through two layers: L0 user memory (global preferences in `~/.helloagents/`) and L1 project KB (per-project in `.helloagents/`). Context survives even if you close and reopen your CLI.

**Q: What are Hooks?**

A: Lifecycle hooks auto-deployed during installation. Claude Code gets 11 event hooks (safety checks, dangerous command guard, progress snapshots, KB sync, sound notifications, tool failure recovery, etc.); Codex CLI gets a notify hook for update and sound notifications; Gemini CLI and Grok CLI get hooks for context injection, progress snapshots, and sound notifications. All optional — features degrade gracefully when hooks aren't available. No manual configuration needed.

**Q: What is Agent Teams?**

A: An experimental Claude Code feature where multiple Claude Code instances collaborate as teammates with shared task lists and mailbox communication. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. When unavailable, HelloAGENTS falls back to standard Task sub-agents. See [Multi-Terminal Collaboration](#multi-terminal-collaboration).

## Troubleshooting

### Command not found

**Problem:** `helloagents: command not found` after installation

**Diagnosis:** Install path not in system PATH

**Solution:**
- UV: Restart terminal after UV installation
- pip: Check `pip show helloagents` for install location, add to PATH
- Verify with `which helloagents` (Unix) or `where helloagents` (Windows)

**Verification:** Run `helloagents version`

---

### Package version unknown

**Problem:** Version shows as "unknown"

**Diagnosis:** Package metadata not available

**Solution:** Install the package first: `pip install git+https://github.com/hellowind777/helloagents.git` or use UV/npx methods

**Verification:** Run `helloagents version` — should show current version number

---

### Target not detected

**Problem:** CLI target not found during installation

**Diagnosis:** Config directory doesn't exist yet

**Solution:** Launch the target CLI at least once to create its config directory, then retry `helloagents install <target>`

**Verification:** Check config paths:
- Codex CLI: `~/.codex/`
- Claude Code: `~/.claude/`
- Others: see CLI documentation

---

### Custom rules overwritten

**Problem:** Custom rules replaced by HelloAGENTS

**Diagnosis:** Installation replaces existing files

**Solution:** Restore from timestamped backup in CLI config directory (e.g., `~/.codex/rules/AGENTS.md.backup.20260304_132146`)

**Verification:** Check backup files in config directory

---

### Images not rendering

**Problem:** README images don't display

**Diagnosis:** Missing image files or incorrect paths

**Solution:**
- Keep relative paths in README (e.g., `./readme_images/`)
- Ensure `readme_images/` folder is committed to repository
- Verify image files exist locally

**Verification:** Check `ls readme_images/` shows all referenced images

---

### CCswitch replaces HelloAGENTS config

**Problem:** After switching CCswitch profiles, HelloAGENTS stops working (workflow commands unrecognized, hooks not firing, rules missing)

**Diagnosis:** CCswitch replaces the entire CLI config directory (e.g., `~/.claude/`) when switching profiles, overwriting HelloAGENTS's hooks, permissions, and rule files

**Solution:** After switching CCswitch profiles, run one of these commands to restore HelloAGENTS:

    helloagents install claude    # reinstall to specific CLI target
    helloagents update            # update + auto-sync all installed targets

**Prevention:** Since v2.3.5, automatic configuration integrity check on session start — if HelloAGENTS config is missing or corrupted, a warning is displayed with recovery instructions

**Verification:** Run `helloagents status` to confirm all targets show as installed

---

### CCswitch configuration conflict

**Problem:** HelloAGENTS config reappears after uninstall when switching CCswitch profiles

**Diagnosis:** CCswitch saved HelloAGENTS settings before uninstall

**Solution:** After uninstalling HelloAGENTS, manually clean up HelloAGENTS-related settings (hooks, permissions, rules) from all saved CCswitch profiles

**Verification:** Check CCswitch profile directories for HelloAGENTS remnants

## Version History

### v2.3.7 (current)

**Bug Fixes:**
- Fixed non-coding tasks incorrectly creating knowledge base when KB_CREATE_MODE=2 (added programming task check in design.md Phase1 step 1)
- Fixed R2 standard flow redirecting to archive instead of DEVELOP after proposal selection (constrained overview type to ~exec entry only)
- Fixed non-coding tasks incorrectly creating plan packages (added programming task precondition to package.md create() interface)

**Improvements:**
- Optimized implementation plan state recovery after context compression
- Optimized overall design flow

### v2.3.6

**New Features:**
- Sub-agent orchestration overhaul: added brainstormer sub-agent for independent parallel proposal ideation during DESIGN multi-proposal comparison
- Sub-agent blocking mechanism: auto-block and fallback to main agent on sub-agent failure or timeout

**Improvements:**
- Tool/Shell constraint optimization: allow fallback to Shell when built-in tools fail (fixes Codex CLI Windows apply_patch repeated failures)
- Shell encoding constraint refinement: explicit UTF-8 no-BOM requirement, separate read/write encoding handling for PowerShell
- Added batch file write rule (merge ≥3 files into a single temp script to avoid sandbox per-command blocking)
- Removed session memory features that couldn't be fully implemented in CLI (session_summary template, SessionEnd memory sync), streamlined service layer
- Sub-agent consolidation: removed 3 redundant sub-agents (kb-keeper, pkg-keeper, synthesizer), functionality returned to main agent and RLM roles
- Sub-agent voice notification skip, task stability fixes
- Unified user config directory structure (user/memory/, user/commands/, user/sounds/)
- Uninstall script enhancements
- Visual verification gap and UI quality fixes

### v2.3.5

**New Features:**
- Voice notification system with 5 event sounds (complete, idle, confirm, error, warning) across Windows/macOS/Linux, with smart two-layer routing (stop_reason + G3 format icon detection)
- Claude Code hooks expanded from 9 to 11 lifecycle event types: added dangerous command guard (PreToolUse), session end cleanup (SessionEnd), and tool failure recovery suggestions (PostToolUseFailure)
- Hooks support expanded to Gemini CLI and Grok CLI (SessionStart, BeforeAgent/AfterAgent, PreCompress, PreToolUse, PostToolUse)
- Codex CLI 0.110 features: `collaboration_modes` for TUI interactive selection, `nickname_candidates` for agent role identification
- Configuration integrity check on session start (auto-detect config corruption or replacement by CCswitch etc.)
- Context compression pre-save with automatic progress snapshot (pre_compact.py, progress_snapshot.py — actual implementations replacing placeholder hooks)
- User-defined tool registration and orchestration — intelligent invocation of custom sub-agents, skills, MCP servers, and plugins
- Custom command extension support via `.helloagents/commands/*.md`

**Improvements:**
- Comprehensive audit fixes (21 issues: 6 HIGH + 9 MEDIUM + 6 LOW)
  - Code quality: extracted 5 shared utility functions, eliminated circular dependencies
  - Cross-platform: unified platform detection, consistent encoding handling
  - Security: configuration backup before overwrite, placeholder validation
  - Documentation: configuration rationale, compatibility verification notes
- Core architecture: new dispatcher module, Codex roles definition, Claude rules management, hooks settings manager
- Install/update script refactoring with persistent configuration
- Voice notification accuracy and false positive reduction (Codex client filtering, Windows sync playback)
- Sub-agent nickname optimization across CLIs
- Codex CLI interactive menu, persistent memory, and context compression optimization
- R2 simplified flow and evaluation module re-integration
- Context compression state persistence optimization
- Tool/Shell usage optimization
- CCswitch compatibility notes for configuration cleanup after uninstall
- SKILL discovery entry optimization

### v2.3.4

- Split 3 oversized files (>450 lines) into 6 independent modules
- Consolidated 9 CLI management scripts into core/ subpackage
- Extracted shared constants and utilities into dedicated module, eliminating circular dependencies
- Removed redundant backward-compatible re-exports
- Elevated Codex CLI routing protocol priority to prevent system prompt override

### v2.3.0

- Comprehensive cross-audit fix: unified role output format, normalized path references, code-doc consistency alignment
- Quality verification loop (Ralph Loop): auto-verify after sub-agent completion, block and feedback on failure
- Auto context injection for sub-agents and rule reinforcement for main agent
- Deep 5-dimension root cause analysis on repeated failures (break-loop)
- Auto-inject project technical guidelines before sub-agent development
- Pre-commit quality checks (code-doc consistency, test coverage, verification commands)
- Worktree isolation for parallel editing
- Custom command extension (.helloagents/commands/)
- Auto-append Git author info to CHANGELOG entries

## Contributing

See CONTRIBUTING.md for contribution rules and PR checklist.

## License

This project is dual-licensed: Code under Apache-2.0, Documentation under CC BY 4.0. See [LICENSE.md](./LICENSE.md).

## Next Steps

**Getting Started:**
- Install HelloAGENTS using your preferred method: [Quick Start](#quick-start)
- Try `~auto` with a simple task to see the full workflow in action
- Explore `~plan` + `~exec` for more control over the process

**Learn More:**
- Read [Usage Guide](#usage-guide) for detailed workflow patterns
- Check [Configuration](#configuration) to customize behavior
- Review [In-Chat Workflow Commands](#in-chat-workflow-commands) reference

**Community & Support:**
- Star the repo if HelloAGENTS helps your workflow
- Report issues or request features on [GitHub Issues](https://github.com/hellowind777/helloagents/issues)
- Contribute improvements: see [CONTRIBUTING.md](./CONTRIBUTING.md)

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project

</div>

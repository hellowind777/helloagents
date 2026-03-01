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
- [In-Chat Workflow Commands](#in-chat-workflow-commands)
- [Repository Guide](#repository-guide)
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

- R3 design proposals default ≥3 parallel, parallel batch limit ≤6, explicit sub-agent count principle (count = independent work units, no vague wording), add sub-agent orchestration config tips to README

### v2.2.12

- Comprehensive parallel sub-agent orchestration across all flows and commands, extend G10 coverage, eliminate hardcoded agent counts, add universal parallel information gathering principle

### v2.2.11

- Three-stage gate model: merge analysis into design stage (EVALUATE → DESIGN → DEVELOP), optimize stop points and fix sub-agent orchestration consistency

### v2.2.10

- Streamline sub-agent roles and integrate native multi-agent orchestration for all supported CLIs

### v2.2.9

- Comprehensive Windows file-locking fix: preemptive unlock and rename-aside fallback for install/update/uninstall/clean

### v2.2.8

- Codex CLI attention optimization for more stable HelloAGENTS execution

### v2.2.7

- **G12 Hooks integration spec:** 9 Claude Code lifecycle hooks + Codex CLI notify hook
- **Auto-deploy Hooks:** auto-deploy and clean up Hooks config during install/uninstall
- **Codex CLI native sub-agent:** G10 adds spawn_agent protocol with cross-CLI parallel scheduling
- **Agent Teams protocol:** G10 adds Claude Code multi-role collaboration protocol
- **SKILL integration:** auto-deploy SKILL.md to skills discovery directory for all CLI targets
- **RLM command expansion:** add ~rlm agents/resume/team subcommands with parallel multi-role dispatch
- **Stage parallel optimization:** parallel rules for develop stage, serial annotation for design
- **Memory v2 bridge:** add Codex Memory v2 bridge protocol
- **Script modularization:** extract config_helpers.py module

### v2.2.5

- **RLM sub-agent system:** 5 specialized roles + native sub-agents with automatic dispatch and session isolation
- **Five-dimension routing (R0–R3):** replaces legacy three-layer routing
- **Four-stage workflow + R1 fast flow:** stage chain (Evaluate → Analyze → Design → Develop) with R1 fast flow for single-point operations
- **Three-layer memory:** L0 user preferences, L1 project knowledge base, L2 session summaries
- **Three-layer EHRB:** keyword + semantic + tool-output safety detection
- **Package-first installer:** pip/uv install with `helloagents` interactive menu
- **15 workflow commands:** added ~rlm, ~validatekb, ~status
- **6 CLI targets:** added OpenCode support
- **Interactive installation menu:** multi-select target CLIs with one command
- **Auto locale detection:** CLI messages switch between Chinese and English based on system locale
- **Windows encoding fix:** UTF-8 safe subprocess handling on all platforms
- **Knowledge base service:** structured project docs auto-synced from code changes
- **Attention service:** live status tracking and progress snapshots

### v2.0.1 (legacy multi-bundle baseline)

- Multi-bundle distribution with manual copy-based installation
- Three-layer routing (Context → Tools → Intent)
- 4 workflow stages, 12 commands, 5 CLI targets
- No sub-agent system, no persistent memory

## Contributing

See CONTRIBUTING.md for contribution rules and PR checklist.

## License

This project is dual-licensed: Code under Apache-2.0, Documentation under CC BY 4.0. See [LICENSE.md](./LICENSE.md).

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project

</div>

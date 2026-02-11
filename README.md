<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**A multi-CLI workflow system that keeps going until tasks are implemented and verified.**

[![Version](https://img.shields.io/badge/version-2.2.2-orange.svg)](./pyproject.toml)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/workflow_commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

## Table of Contents

- [Why HelloAGENTS](#why-helloagents)
- [What Changed vs Legacy Repo](#what-changed-vs-legacy-repo)
- [Features](#features)
- [Before and After (Snake Demo)](#before-and-after-snake-demo)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Repository Guide](#repository-guide)
- [In-Chat Workflow Commands](#in-chat-workflow-commands)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Version History](#version-history)
- [Contributing](#contributing)
- [License](#license)

## Why HelloAGENTS

Many assistants can analyze tasks but often stop before real delivery. HelloAGENTS adds strict routing, staged execution, and verification gates.

| Challenge | Without HelloAGENTS | With HelloAGENTS |
|---|---|---|
| Stops at planning | Ends with suggestions | Pushes to implementation and validation |
| Output drift | Different structure every prompt | Unified routing and stage chain |
| Risky operations | Easier to make destructive mistakes | EHRB risk detection and escalation |
| Knowledge continuity | Context gets scattered | Built-in KB and session memory |
| Reusability | Prompt-by-prompt effort | Commandized reusable workflow |

<div align="center">
  <img src="./readme_images/06-divider.svg" width="420" alt="divider">
</div>

## What Changed vs Legacy Repo

Compared with legacy multi-bundle releases, the v2.x line is now package-first with a fundamentally different architecture.

| Area | Legacy repo | Current repo |
|---|---|---|
| Distribution | Multiple bundle folders per CLI | One Python package + installer CLI |
| Installation | Manual copy of config and skill folders | pip/uv install + `helloagents` interactive menu |
| Routing | Three-layer (Context → Tools → Intent) | Five-dimension scoring (R0–R3) |
| Workflow stages | 4 stages (Evaluate, Analyze, Design, Develop) | 5 stages (+Tweak) with sub-agent dispatch |
| Agent system | None | RLM with 12 specialized roles and session isolation |
| Memory | No persistence | Three-layer: L0 user, L1 project KB, L2 session |
| Safety | Basic EHRB | Three-layer EHRB (keyword + semantic + tool output) |
| CLI targets | 5 visible bundle targets | 6 targets: codex, claude, gemini, qwen, grok, opencode |
| Commands | 12 | 15 workflow commands |

> ⚠️ **Migration notice:** Because repository structure and installation workflow changed in v2.x, legacy versions were moved to **helloagents-archive**: https://github.com/hellowind777/helloagents-archive

## Features

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**RLM sub-agent orchestration**

12 specialized roles (explorer, analyzer, designer, implementer, reviewer, tester, etc.) are dispatched automatically based on task complexity, with session isolation per CLI instance.

**Your gain:** complex tasks are broken down and handled by the right specialist.
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**Five-dimension routing (R0–R3)**

Every input is scored on action need, target clarity, decision scope, impact range, and EHRB risk — then routed to R0 direct, R1 fast, R2 simplified, or R3 standard flow.

**Your gain:** proportional effort — simple queries stay fast, complex tasks get full process.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**Three-layer safety detection (EHRB)**

Keyword scan, semantic analysis, and tool-output inspection catch destructive operations before execution. Interactive and delegated modes enforce user confirmation.

**Your gain:** safer defaults with zero-config protection.
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**Three-layer memory model**

L0 user memory (global preferences), L1 project knowledge base (structured docs synced from code), and L2 session summaries (auto-persisted at stage transitions).

**Your gain:** context survives across sessions and projects.
</td>
</tr>
</table>

### Data points from this repo

- 6 CLI targets from helloagents/cli.py
- 15 workflow commands from helloagents/functions
- 12 RLM roles from helloagents/rlm/roles
- 4 stage definitions from helloagents/stages
- 5 core services from helloagents/services
- 4 rule modules from helloagents/rules
- 8 helper scripts from helloagents/scripts
- 10 KB/plan templates from helloagents/templates

## Before and After (Snake Demo)

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

## Quick Start

### Method A: One-line install script (recommended)

**macOS / Linux:**

    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash

**Windows PowerShell:**

    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

> The script auto-detects `uv` or `pip`, installs the HelloAGENTS package, and launches an interactive menu for you to select target CLIs. Re-running performs an update.

**Update:**

    helloagents update

### Method B: UV (isolated environment)

**Step 0 — Install UV first (skip if already installed):**

    # Windows PowerShell
    irm https://astral.sh/uv/install.ps1 | iex

    # macOS / Linux
    curl -LsSf https://astral.sh/uv/install.sh | sh

> After installing UV, restart your terminal to make the `uv` command available.

**Install and select targets (one command):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents

> Installs the package and launches an interactive menu for you to select target CLIs. You can also specify directly: `helloagents install codex`

**Update:**

    helloagents update

### Method C: pip (Python >= 3.10)

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

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install codex

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install codex

**Update later (auto-syncs installed targets):**

    helloagents update

### Claude Code example

**First install:**

    # One-line script (recommended, auto-launches interactive menu after install)
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | bash
    # Windows PowerShell
    irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents && helloagents install claude

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git && helloagents install claude

**Update later (auto-syncs installed targets):**

    helloagents update

### Beta branch

To install from the `beta` branch, append `@beta` to the repository URL:

    # One-line script (auto-launches interactive menu after install)
    # macOS / Linux
    curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_BRANCH=beta bash

    # Windows PowerShell
    $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

    # UV
    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents && helloagents

    # pip
    pip install git+https://github.com/hellowind777/helloagents.git@beta && helloagents

## How It Works

1. Install the package (script/pip/uv) and run `helloagents` to launch an interactive menu for selecting target CLIs (or specify directly with `helloagents install <target>`).
2. In AI chat, every input is scored on five dimensions and routed to R0–R3.
3. R2/R3 tasks enter the stage chain: EVALUATE → ANALYZE → DESIGN → DEVELOP → TWEAK.
4. RLM dispatches specialized sub-agents (e.g. explorer, designer, implementer) based on task complexity.
5. EHRB scans each step for destructive operations; risky actions require explicit user confirmation.
6. Three-layer memory (user / project KB / session) preserves context across sessions.
7. Stage chain completes with verified output and optional knowledge base sync.

## Repository Guide

- AGENTS.md: router and workflow protocol
- pyproject.toml: package metadata (v2.2.2)
- helloagents/cli.py: installer entry
- helloagents/functions: workflow commands
- helloagents/stages: analyze, design, develop, tweak
- helloagents/services: knowledge, package, memory and support services
- helloagents/rules: state, cache, tools, scaling
- helloagents/rlm: role library and orchestration helpers
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
| ~upgrade | upgrade knowledge structure |
| ~clean / ~cleanplan | cleanup workflow artifacts |
| ~test / ~review / ~validate | quality checks |
| ~commit | generate commit message from context |
| ~rollback | rollback workflow state |
| ~rlm | role orchestration commands |
| ~status / ~help | status and help |

## FAQ

- Q: Is this a Python CLI tool or prompt package?
  A: Both. CLI manages installation; workflow behavior comes from AGENTS.md and helloagents docs.

- Q: Which target should I install?
  A: Use the CLI you run: codex, claude, gemini, qwen, grok, or opencode.

- Q: What if a rules file already exists?
  A: Non-HelloAGENTS files are backed up before replacement.

- Q: What is RLM?
  A: Role Language Model — a sub-agent orchestration system with 12 specialized roles dispatched based on task complexity.

- Q: Where does project knowledge go?
  A: In the project-local `.helloagents/` directory, auto-synced when code changes.

- Q: Does memory persist across sessions?
  A: Yes. L0 user memory is global, L1 project KB is per-project, L2 session summaries are auto-saved at stage transitions.

## Troubleshooting

- command not found: ensure install path is in PATH
- package version unknown: install package first for metadata
- target not detected: launch target CLI once to create config directory
- custom rules overwritten: restore from timestamped backup in CLI config dir
- images not rendering: keep relative paths and commit readme_images files

## Version History

### v2.2.2 (current)

- **RLM sub-agent system:** 12 specialized roles with automatic dispatch and session isolation
- **Five-dimension routing (R0–R3):** replaces legacy three-layer routing
- **Five-stage workflow:** added TWEAK stage for iterative refinement
- **Three-layer memory:** L0 user preferences, L1 project knowledge base, L2 session summaries
- **Three-layer EHRB:** keyword + semantic + tool-output safety detection
- **Package-first installer:** pip/uv install with `helloagents` interactive menu
- **15 workflow commands:** added ~rlm, ~validate, ~status
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

This project is licensed under the MIT License. See LICENSE.

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

<sub>Thanks to <a href="https://codexzh.com">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project</sub>

</div>

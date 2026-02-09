<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**A multi-CLI workflow system that keeps going until tasks are implemented and verified.**

[![Version](https://img.shields.io/badge/version-2.2.0-orange.svg)](./pyproject.toml)
[![Python](https://img.shields.io/badge/python-%3E%3D3.10-3776AB.svg)](./pyproject.toml)
[![Commands](https://img.shields.io/badge/workflow_commands-15-6366f1.svg)](./helloagents/functions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/中文-blue?style=for-the-badge" alt="中文"></a>
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

Compared with legacy multi-bundle releases, the v2.x line is now package-first.

| Area | Legacy repo | Current repo |
|---|---|---|
| Distribution shape | Multiple bundle folders such as Codex CLI and Claude Code | One Python package under helloagents plus installer CLI |
| Installation model | Manual copy of config and skill folders | UV install from GitHub + helloagents update (branch-aware) + helloagents install &lt;target&gt; |
| CLI targets | 5 visible bundle targets | 6 targets in code: claude, codex, opencode, gemini, qwen, grok |
| Safety during install | Manual overwrite risk | Marker detection, backup, stale cleanup |
| Workflow source | Duplicated across bundles | Single source in helloagents/functions, stages, rules, services |

> ⚠️ **Migration notice:** Because repository structure and installation workflow changed in v2.x, legacy versions were moved to **helloagents-archive**: https://github.com/hellowind777/helloagents-archive

## Features

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**Package-first installation**

Install with UV from GitHub, then deploy rules to target CLIs with installer commands.

**Your gain:** fewer manual copy mistakes.
</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**Structured workflow execution**

Router enforces R0 direct response, R1 Fast Flow, R2 Simplified Flow, and R3 Standard Flow with stage progression.

**Your gain:** work does not stop halfway.
</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**Built-in safety gate (EHRB)**

High-risk operations are checked before modification steps continue.

**Your gain:** safer defaults.
</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**Multi-CLI compatibility**

Same workflow core across multiple AI CLIs.

**Your gain:** consistent team behavior.
</td>
</tr>
</table>

### Data points from this repo

- 6 CLI targets from helloagents/cli.py
- 15 workflow commands from helloagents/functions
- 12 role profiles from helloagents/rlm/roles
- 8 helper scripts from helloagents/scripts
- 7 core module groups: functions, stages, services, rules, rlm, scripts, templates

## Before and After (Snake Demo)

Per your request, the original snake images are preserved and other README visuals are regenerated.

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

### 1) Install package from GitHub with UV

**Stable (main):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents

**Beta:**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents

### 2) Update package (branch-aware)

helloagents update keeps you on the current branch and checks updates accordingly.

    helloagents update

Switch branches explicitly when needed:

    helloagents update beta

    helloagents update main

### 3) Sync rules to target CLI

    helloagents install codex

    helloagents install claude

    helloagents install --all

### 4) Verify

    helloagents status

    helloagents version

### Codex CLI example

**Stable (main):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents
    helloagents install codex
    helloagents update
    helloagents install codex

**Beta:**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents
    helloagents install codex
    helloagents update beta
    helloagents install codex

### Claude Code example

**Stable (main):**

    uv tool install --from git+https://github.com/hellowind777/helloagents helloagents
    helloagents install claude
    helloagents update
    helloagents install claude

**Beta:**

    uv tool install --from git+https://github.com/hellowind777/helloagents@beta helloagents
    helloagents install claude
    helloagents update beta
    helloagents install claude

## How It Works

1. Install package and run installer command.
2. Installer locates target CLI directory.
3. Installer cleans stale HelloAGENTS files and copies the latest module.
4. Target rules file is created or updated with backup protection.
5. In AI chat, router selects R0 direct response, R1 Fast Flow, R2 Simplified Flow, or R3 Standard Flow.
6. Stage chain runs and returns verified output.

## Repository Guide

- AGENTS.md: router and workflow protocol
- pyproject.toml: package metadata (v2.2.0)
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
  A: Use the CLI you run: codex, claude, opencode, gemini, qwen, or grok.

- Q: What if a rules file already exists?
  A: Non-HelloAGENTS files are backed up before replacement.

- Q: Do I still need manual bundle copy?
  A: No. In v2.x releases, use installer commands instead of manual bundle copy.

- Q: Where does workflow knowledge go?
  A: By default, project-local .helloagents directory.

- Q: Why keep snake demo images?
  A: They provide a stable visual benchmark to compare workflow quality before and after structured routing.

## Troubleshooting

- command not found: ensure install path is in PATH
- package version unknown: install package first for metadata
- target not detected: launch target CLI once to create config directory
- custom rules overwritten: restore from timestamped backup in CLI config dir
- images not rendering: keep relative paths and commit readme_images files

## Version History

### v2.2.0 (current package branch)

- Refactored to package-first layout around helloagents directory
- Added installer commands: install, update, status, version
- Added install safety flow: marker check, backup, stale cleanup
- Consolidated workflow source into one tree
- Legacy pre-v2 layouts were moved to https://github.com/hellowind777/helloagents-archive

### v2.0.1 (legacy multi-bundle baseline)

- Multi-bundle distribution baseline with manual copy-based installation model
- Separate bundle folders maintained per CLI

## Contributing

See CONTRIBUTING.md for contribution rules and PR checklist.

## License

This project is licensed under the MIT License. See LICENSE.

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

</div>

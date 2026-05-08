<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**A workflow layer for AI coding CLIs: skills, project knowledge, delivery checks, safer config writes, and resumable execution.**

[![Version](https://img.shields.io/badge/version-3.0.24-orange.svg)](./package.json)
[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](./package.json)
[![Skills](https://img.shields.io/badge/skills-14-6366f1.svg)](./skills)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/hellowind777/helloagents/issues)

</div>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English"></a>
  <a href="./README_CN.md"><img src="https://img.shields.io/badge/简体中文-blue?style=for-the-badge" alt="简体中文"></a>
</p>

---

> [!IMPORTANT]
> Looking for `v2.x`? The old Python line now lives in [helloagents-archive](https://github.com/hellowind777/helloagents-archive). The `v3` line is a full rewrite based on Node.js, Markdown rules, skills, and small runtime scripts.

## Contents

- [What HelloAGENTS Does](#what-helloagents-does)
- [Core Features](#core-features)
- [Quick Start](#quick-start)
- [CLI Management](#cli-management)
- [Commands in Chat](#commands-in-chat)
- [Project Knowledge Base](#project-knowledge-base)
- [Workflow and Delivery](#workflow-and-delivery)
- [Configuration](#configuration)
- [How Each CLI Is Integrated](#how-each-cli-is-integrated)
- [Verification](#verification)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## What HelloAGENTS Does

AI coding CLIs can move fast, but they can also stop at advice, skip checks, lose project context, or report completion before the work is really done.

HelloAGENTS adds a workflow layer on top of Claude Code, Gemini CLI, and Codex CLI. It helps the agent choose the right path, use task-specific quality skills, keep a project knowledge base, and verify work before delivery.

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

| Problem | Without HelloAGENTS | With HelloAGENTS |
|---------|---------------------|------------------|
| Stops too early | Ends with suggestions | Continues into build, verify, and closeout |
| Quality is inconsistent | Depends on each prompt | 14 quality skills activate by task type |
| Context is scattered | Plans live in chat history | Project knowledge and plan files stay on disk |
| Completion is vague | Natural language says “done” | Delivery checks use state, evidence, and verification |
| Config writes are risky | CLI files can drift | Install, update, cleanup, and doctor flows check managed files |

## Core Features

### 1) 14 task-aware quality skills

HelloAGENTS includes 14 `hello-*` skills. They are loaded only when the current stage needs them, so simple tasks stay light while complex work gets stricter checks.

| Skill | Focus |
|-------|-------|
| `hello-ui` | UI planning, design contracts, implementation mapping, visual validation |
| `hello-api` | API design, validation, error format, compatibility |
| `hello-security` | auth, secrets, permissions, injection risks |
| `hello-test` | TDD, coverage, edge cases, test structure |
| `hello-verify` | review, command verification, delivery evidence, closeout |
| `hello-errors` | error handling, logs, retry and recovery behavior |
| `hello-perf` | performance, caching, query and rendering risks |
| `hello-data` | database, migrations, transactions, indexes |
| `hello-arch` | architecture, boundaries, code size, maintainability |
| `hello-debug` | bug diagnosis and escalation when stuck |
| `hello-subagent` | subagent delegation and result integration |
| `hello-review` | code review with structured findings |
| `hello-write` | documentation, reports, and written deliverables |
| `hello-reflect` | reusable lessons and knowledge updates |

All UI work first follows the shared UI quality baseline.
In global mode, activated projects, or explicit UI workflows, `hello-ui` adds deeper design-contract execution, design-system mapping, and visual validation on top of that baseline.
When visual evidence is required, HelloAGENTS records it in the current session `artifacts/visual.json`.

### 2) Commands for different work styles

Commands run inside the AI CLI chat with a `~` prefix. The command skill is read directly; unrelated skills are not loaded unless the workflow needs them.

| Command | Purpose |
|---------|---------|
| `~idea` | Lightweight exploration and option comparison; does not write files |
| `~auto` | Chooses the main path and keeps going until delivery or a real blocker |
| `~plan` | Requirements, solution design, task breakdown, and plan package |
| `~build` | Implementation from the current request or an existing plan |
| `~prd` | Modern product requirements document through guided dimension-by-dimension exploration |
| `~loop` | Iterative improvement with metric, guard command, keep/revert decisions |
| `~wiki` | Create or sync only the project knowledge base |
| `~init` | Full project setup: knowledge base plus project-level rule files and package-root links |
| `~test` | Write tests for a target module or recent change |
| `~verify` | Review, run verification commands, fix failures, and close out |
| `~commit` | Generate a conventional commit message and sync knowledge |
| `~clean` | Archive finished plans and clean temporary runtime files |
| `~help` | Show commands and current settings |

Compatibility aliases:

- `~do` → `~build`
- `~design` → `~plan`
- `~review` → `~verify` in review-first mode

### 3) Project knowledge base

HelloAGENTS can create and maintain a project knowledge base under `.helloagents/`.

The knowledge base helps future turns understand the repo without re-discovering the same facts. It can store:

| File or directory | Purpose |
|-------------------|---------|
| `context.md` | project overview, stack, architecture, module index |
| `guidelines.md` | non-obvious coding conventions inferred from the repo |
| `verify.yaml` | verification commands such as lint, test, build |
| `CHANGELOG.md` | project-level change history |
| `DESIGN.md` | stable UI design contract when the project has UI work |
| `modules/*.md` | module-specific notes and lessons |
| `plans/<feature>/` | active plan packages |
| `archive/` | archived plan packages |

`~wiki` creates or updates the knowledge base only.

`~init` does more: it creates or updates the knowledge base, writes project-level rule files, and refreshes project-level HelloAGENTS package-root links for supported hosts.

### 4) Structured plan packages

Complex work can be stored as plan packages instead of a single paragraph in chat.

For `~plan`, HelloAGENTS uses:

- `requirements.md`
- `plan.md`
- `tasks.md`
- `contract.json`

For `~prd`, HelloAGENTS also creates PRD files such as:

- `prd/00-overview.md`
- `prd/01-user-stories.md`
- `prd/02-functional.md`
- `prd/03-ui-design.md`
- `prd/04-technical.md`
- `prd/05-nonfunctional.md`
- `prd/06-i18n-l10n.md`
- `prd/07-accessibility.md`
- `prd/08-content.md`
- `prd/09-testing.md`
- `prd/10-deployment.md`
- `prd/11-legal-privacy.md`
- `prd/12-timeline.md`

`contract.json` is used by the workflow to decide verification scope, reviewer/tester focus, optional advisor checks, and optional visual validation.

`tasks.md` also includes a Codex `/goal` entry. For long-running Codex work, use that prepared entry instead of giving `/goal` a raw product document. HelloAGENTS keeps `/goal` as Codex-native continuation and budget control, while plan files, task boundaries, verification, and closeout remain controlled by HelloAGENTS.

### 5) State and recovery

Long tasks need a small recovery snapshot, but one shared state file is not safe enough for concurrent work.

HelloAGENTS now resolves the current state file from `state_path`:

- with a stable session id: `.helloagents/sessions/<workspace>/<session>/STATE.md`
- without a stable session id: `.helloagents/sessions/<workspace>/default/STATE.md`

`<workspace>` is the current Git branch, `detached-<sha>` for a detached HEAD, or `workspace` for non-Git projects. `.helloagents/sessions/active.json` only records the active session index.

`STATE.md` records where the current workflow stopped. It is not a universal memory file for every conversation.

### 6) Verification and delivery evidence

HelloAGENTS does not treat “tests passed” and “task complete” as the same thing. Delivery can also require plan coverage, task checklist status, review evidence, advisor evidence, and visual evidence.

Runtime evidence files include:

- `.helloagents/sessions/<workspace>/<session>/capsule.json`
- `.helloagents/sessions/<workspace>/<session>/events.jsonl`
- `.helloagents/sessions/active.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/review.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/advisor.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/visual.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/closeout.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/loop-results.tsv`

Delivery gate, guard, and loop messages use action-oriented wording such as processing path, closeout action, and visual validation action, so blocked flows show what to do next without turning executable steps into optional suggestions. Final closeout also enforces a single HelloAGENTS wrapper, so one reply does not emit duplicate closeout headers.

### 7) Safer install, update, cleanup, and diagnostics

The CLI manages host files explicitly:

- `install` writes only the selected target unless `--all` is used
- `update` refreshes the selected target or all targets
- `cleanup` removes managed injections and links
- `uninstall` performs scoped cleanup before package removal
- `doctor` reports drift in carriers, links, hooks, config entries, plugin roots, cache copies, and versions
- per-host mode tracking is written only after a host setup succeeds, so failed native global installs do not leave stale mode records

## Quick Start

### 1) Install the package

```bash
npm install -g helloagents
```

If another executable named `helloagents` already exists in your `PATH`, use the stable managed-entry alias:

```bash
helloagents-js.cmd
```

By default, `postinstall` installs the package command, initializes `~/.helloagents/helloagents.json`, and syncs runtime files to `~/.helloagents/helloagents`. No host CLI is deployed unless you set `HELLOAGENTS=target[:mode]`, such as `HELLOAGENTS=codex:global`.

### 2) Deploy to a CLI

Use standby mode for selected projects and explicit activation:

```bash
helloagents install codex --standby
helloagents install --all --standby
```

Use global mode when you want full rules everywhere:

```bash
helloagents --global
helloagents install --all --global
```

After reinstalling, refreshing, or switching modes, restart the target AI CLI or open a new session; already running sessions do not reload injected rules automatically.

### 3) Verify inside your AI CLI

Type:

```text
~help
```

You should see the 13 chat commands and the current settings.

### 4) Create project knowledge

For knowledge base only:

```text
~wiki
```

For full project setup:

```text
~init
```

## CLI Management

### Shell commands

```bash
helloagents --standby
helloagents --global
helloagents install codex --standby
helloagents install --all --global
helloagents update codex
helloagents cleanup claude --global
helloagents uninstall gemini
helloagents switch-branch beta
helloagents switch-branch beta claude --global
helloagents doctor
helloagents doctor codex --json
helloagents codex goals status
helloagents codex goals enable
```

Supported targets:

- `claude`
- `gemini`
- `codex`
- `--all`

If you omit `--standby` or `--global`, HelloAGENTS first reuses the tracked/detected mode for that CLI, then falls back to `standby`.

### npm and one-shot script entries

Use these when you do not want to depend on the `helloagents` binary being available during package updates. In `HELLOAGENTS=target[:mode]`, target can be `all`, `claude`, `gemini`, or `codex`; mode can be `standby` or `global`, and defaults to `standby`.

Host configs use the stable `helloagents-js.cmd` entrypoint and runtime root `~/.helloagents/helloagents`, so Node global package paths can change without breaking managed hooks or Codex `notify`. Codex hooks use standalone `~/.codex/hooks.json` instead of adding large hook blocks to `config.toml`.

#### npm commands

macOS / Linux:

```bash
# Install to Codex in standby mode
HELLOAGENTS=codex npm install -g helloagents

# Install to Codex in global mode
HELLOAGENTS=codex:global npm install -g helloagents

# Update and sync Claude in standby mode
HELLOAGENTS=claude:standby npm update -g helloagents

# Switch to the beta branch and sync all CLIs in standby mode
HELLOAGENTS=all:standby npm install -g github:hellowind777/helloagents#beta

# Clean Gemini integration before package uninstall
npm explore -g helloagents -- npm run uninstall -- gemini --standby
npm uninstall -g helloagents
```

Windows PowerShell:

```powershell
# Install to Codex in standby mode
$env:HELLOAGENTS="codex"; npm install -g helloagents

# Install to Codex in global mode
$env:HELLOAGENTS="codex:global"; npm install -g helloagents

# Update and sync Claude in standby mode
$env:HELLOAGENTS="claude:standby"; npm update -g helloagents

# Switch to the beta branch and sync all CLIs in standby mode
$env:HELLOAGENTS="all:standby"; npm install -g github:hellowind777/helloagents#beta

# Clean Gemini integration before package uninstall
npm explore -g helloagents -- npm run uninstall -- gemini --standby
npm uninstall -g helloagents
```

After the package is installed, you can also call its npm scripts directly:

```bash
npm explore -g helloagents -- npm run deploy:global
npm explore -g helloagents -- npm run sync-hosts -- --all --standby
npm explore -g helloagents -- npm run cleanup-hosts -- codex --standby
npm explore -g helloagents -- npm run uninstall -- --all --standby
```

#### One-shot scripts

macOS / Linux:

```bash
# Install
HELLOAGENTS=codex curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# Update
HELLOAGENTS=claude:standby HELLOAGENTS_ACTION=update curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# Switch branch
HELLOAGENTS=all:global HELLOAGENTS_ACTION=switch-branch HELLOAGENTS_BRANCH=beta curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# Cleanup host integration without uninstalling the package
HELLOAGENTS=codex:standby HELLOAGENTS_ACTION=cleanup curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh

# Uninstall
HELLOAGENTS=gemini HELLOAGENTS_ACTION=uninstall curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/main/install.sh | sh
```

Windows PowerShell:

```powershell
# Install
$env:HELLOAGENTS="codex"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# Update
$env:HELLOAGENTS="claude:standby"; $env:HELLOAGENTS_ACTION="update"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# Switch branch
$env:HELLOAGENTS="all:global"; $env:HELLOAGENTS_ACTION="switch-branch"; $env:HELLOAGENTS_BRANCH="beta"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# Cleanup host integration without uninstalling the package
$env:HELLOAGENTS="codex:standby"; $env:HELLOAGENTS_ACTION="cleanup"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex

# Uninstall
$env:HELLOAGENTS="gemini"; $env:HELLOAGENTS_ACTION="uninstall"; irm https://raw.githubusercontent.com/hellowind777/helloagents/main/install.ps1 | iex
```

The PowerShell wrapper now forwards the same npm arguments as `install.sh`, so install, update, cleanup, uninstall, and `switch-branch` stay on the same lifecycle path.

### Branch switching

`switch-branch` installs the requested npm/GitHub ref first, then syncs host CLIs through npm scripts so it does not depend on the `helloagents` executable during updates:

```bash
helloagents switch-branch beta
helloagents switch-branch beta claude --global
helloagents branch github:hellowind777/helloagents#beta --all --standby
```

Use normal npm commands when you only want to change the package and not sync host CLIs immediately:

```bash
npm install -g github:hellowind777/helloagents#beta
npm update -g helloagents
npm explore -g helloagents -- npm run uninstall -- --all --standby
npm uninstall -g helloagents
```

### Standby mode files

| CLI | Files written or updated | Cleanup behavior |
|-----|--------------------------|------------------|
| Claude Code | `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/helloagents -> ~/.helloagents/helloagents` | removes managed marker block, HelloAGENTS hooks/permissions, and symlink |
| Gemini CLI | `~/.gemini/GEMINI.md`, `~/.gemini/settings.json`, `~/.gemini/helloagents -> ~/.helloagents/helloagents` | removes managed marker block, HelloAGENTS hooks, and symlink |
| Codex CLI | `~/.codex/AGENTS.md`, `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.codex/helloagents -> ~/.helloagents/helloagents`, managed backups | removes managed marker block, managed config keys, managed hooks, symlink, and the latest managed backup |

### Global mode files

| CLI | Install method | Files involved |
|-----|----------------|----------------|
| Claude Code | native plugin install | managed by Claude Code plugin system |
| Gemini CLI | native extension install | managed by Gemini extension system |
| Codex CLI | native local-plugin chain | `~/.agents/plugins/marketplace.json`, `~/plugins/helloagents/`, `~/.codex/plugins/cache/local-plugins/helloagents/local/`, `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.codex/helloagents -> ~/plugins/helloagents` |

In global mode, HelloAGENTS now attempts the host-native install commands automatically. If a host command is unavailable, run the same commands manually:

```text
/plugin marketplace add hellowind777/helloagents
/plugin install helloagents@helloagents
gemini extensions install https://github.com/hellowind777/helloagents
```

For Claude Code, the CLI also tries the equivalent `claude plugin marketplace add ...` and `claude plugin install ...` commands. The marketplace is named `helloagents`, and the plugin is also named `helloagents`, so the install target is `helloagents@helloagents`. Restart the host CLI after a global install.

Codex global mode is installed by HelloAGENTS automatically through the local-plugin path.

## Commands in Chat

### Typical flows

| Goal | Use |
|------|-----|
| Compare ideas before writing files | `~idea "compare two API designs"` |
| Let HelloAGENTS choose the path and continue | `~auto "add JWT login"` |
| Review a plan before implementation | `~plan "refactor payment module"` |
| Implement from a clear request or active plan | `~build "finish task 2 in the plan"` |
| Build a full product requirement document | `~prd "modern dashboard for operations team"` |
| Iterate toward a metric | `~loop "reduce bundle size" --metric "npm run size" --direction lower` |
| Create or refresh project knowledge only | `~wiki` |
| Fully activate project workflow | `~init` |
| Validate current work | `~verify` |
| Generate commit message and sync knowledge | `~commit` |

### Activated vs unactivated projects

In standby mode, unactivated projects get lighter rules and explicit `~command` entry points. A project becomes activated when `.helloagents/` exists, usually through `~wiki` or `~init`.

In global mode, HelloAGENTS applies full rules by default.

## Project Knowledge Base

### Local mode

By default, project knowledge lives in the project:

```text
.helloagents/
```

This directory acts as both:

- the activation signal
- the local knowledge, plan, state, and runtime directory

### Repo-shared mode

When `project_store_mode = "repo-shared"`:

- local `.helloagents/` keeps activation and runtime files
- stable knowledge and plan files move to `~/.helloagents/projects/<repo-key>/`
- multiple worktrees of the same git repo can share the same stable knowledge

Runtime state and evidence remain local to the working project:

- `state_path`
- `.helloagents/sessions/<workspace>/<session>/capsule.json`
- `.helloagents/sessions/<workspace>/<session>/events.jsonl`
- `.helloagents/sessions/active.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/*.json`
- `.helloagents/sessions/<workspace>/<session>/artifacts/loop-results.tsv`

### Unactivated or temporary sessions

If neither the current directory nor its parents contain an activated `.helloagents/` directory, HelloAGENTS does not write project files automatically. Temporary runtime state is kept under the user-level directory:

```text
~/.helloagents/runtime/<scope-key>/
```

This only stores short-lived `capsule.json`, `events.jsonl`, and `artifacts/`. It is not project knowledge. Expired transient sessions are removed by TTL cleanup.

### Knowledge creation rules

| Command or setting | Behavior |
|--------------------|----------|
| `~wiki` | creates or syncs the knowledge base only |
| `~init` | creates knowledge base plus project-level rule files and package-root links |
| `kb_create_mode = 0` | disables automatic knowledge updates |
| `kb_create_mode = 1` | updates knowledge automatically for coding tasks in activated projects or global mode |
| `kb_create_mode = 2` | updates knowledge more aggressively in activated projects or global mode |

## Workflow and Delivery

### Workflow stages

HelloAGENTS uses this stage model for structured work:

```text
ROUTE / TIER → SPEC → PLAN → BUILD → VERIFY → CONSOLIDATE
```

| Stage | Purpose |
|-------|---------|
| `ROUTE / TIER` | decide whether the task is idea, plan, build, verify, PRD, or automatic flow |
| `SPEC` | clarify goal, constraints, and success criteria |
| `PLAN` | prepare plan files and choose needed skills |
| `BUILD` | implement and run local checks |
| `VERIFY` | review, run commands, check contract and evidence |
| `CONSOLIDATE` | update state, knowledge, and closeout evidence |

### Delivery tiers

| Tier | Typical use |
|------|-------------|
| `T0` | read-only analysis, idea exploration, comparison |
| `T1` | low-risk focused fixes or explicit verification |
| `T2` | multi-file features, new projects, structured plans |
| `T3` | high-risk or irreversible work such as auth, payment, database, release, production operations |

### UI workflow

UI work follows this priority:

1. current `plan.md` or PRD UI decisions
2. `.helloagents/DESIGN.md`
3. `hello-ui` implementation and validation rules, together with the shared UI quality baseline

For heavier UI work, `contract.json` can require:

- `ui.styleAdvisor.required`
- `ui.visualValidation.required`

Those requirements are closed with the current session `artifacts/advisor.json` and `artifacts/visual.json`.

### Verification sources

Verification commands are detected in this order:

1. logical `.helloagents/verify.yaml`
2. package manager scripts such as `package.json`
3. automatic detection

When `project_store_mode = "repo-shared"`, logical `.helloagents/verify.yaml` resolves from the shared project store.

## Configuration

Config file:

```text
~/.helloagents/helloagents.json
```

Default shape:

```json
{
  "output_language": "",
  "output_format": true,
  "notify_level": 0,
  "ralph_loop_enabled": true,
  "guard_enabled": true,
  "kb_create_mode": 1,
  "project_store_mode": "local",
  "commit_attribution": "",
  "install_mode": "standby",
  "host_install_modes": {}
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `output_language` | `""` | follow the user language unless set |
| `output_format` | `true` | main-agent final closeout must use the HelloAGENTS layout; intermediate and sub-agent output stays natural |
| `notify_level` | `0` | `0` off, `1` desktop, `2` sound, `3` both |
| `ralph_loop_enabled` | `true` | run verification for explicit `~verify` / `~loop` or required closeout gates |
| `guard_enabled` | `true` | block dangerous commands |
| `kb_create_mode` | `1` | control automatic knowledge base updates |
| `project_store_mode` | `"local"` | `local` or `repo-shared` |
| `commit_attribution` | `""` | optional text appended to commit messages |
| `install_mode` | `"standby"` | current default install mode |
| `host_install_modes` | `{}` | managed per-CLI mode map, such as `{ "codex": "standby" }`; recorded only after successful host setup and used before falling back to `install_mode` |

## How Each CLI Is Integrated

### Claude Code

- standby writes `~/.claude/CLAUDE.md`
- standby updates `~/.claude/settings.json` with managed hooks and permissions
- standby creates `~/.claude/helloagents -> ~/.helloagents/helloagents`
- global mode uses Claude Code's plugin system

### Gemini CLI

- standby writes `~/.gemini/GEMINI.md`
- standby updates `~/.gemini/settings.json` with managed hooks
- standby creates `~/.gemini/helloagents -> ~/.helloagents/helloagents`
- global mode uses Gemini's extension system

### Codex CLI

Codex is rules-file driven by default.

- standby writes `~/.codex/AGENTS.md`
- standby writes a managed `model_instructions_file = "~/.codex/AGENTS.md"`
- standby writes a managed `notify = ["helloagents-js.cmd", "codex-notify"]` command for closeout notification
- standby writes silent Codex hooks to `~/.codex/hooks.json`
- install and update also sync HelloAGENTS-managed Codex hook trust state in `~/.codex/config.toml`, so Codex 0.129.0+ does not re-prompt for the managed hooks
- standby creates `~/.codex/helloagents -> ~/.helloagents/helloagents`
- global mode installs the native local-plugin chain and also loads silent hooks from `~/.codex/hooks.json`
- cleanup removes only the HelloAGENTS-managed hook trust entries and keeps user-owned hook state untouched
- Codex hooks only synchronize runtime state and enforce Stop gates; they do not inject HelloAGENTS rules or route text through hook output
- Codex closeout de-duplicates Stop hooks and native `codex-notify`, so one turn does not notify twice
- `/goal` remains Codex-native. Enable it explicitly with `helloagents codex goals enable` when long-running plan execution is needed
- Goal-aware commands resume from `tasks.md`, `contract.json`, and `state_path`; they do not create goals automatically or mark them complete before HelloAGENTS verification and closeout

## Verification

Run all tests:

```bash
npm test
```

The current suite includes 111 tests and covers:

- install, update, uninstall, cleanup, and mode switching
- one-shot PowerShell lifecycle dispatch for install, update, cleanup, uninstall, and branch switching
- Claude, Gemini, and Codex config merge and restore behavior
- Codex managed `model_instructions_file`, `notify`, `hooks.json`, hook trust state, local plugin, marketplace, and cache behavior
- Codex `/goal` feature toggles, long-running route context, and goal-aware command contracts
- `helloagents doctor`
- project storage and `repo-shared` behavior
- session-scoped `state_path`, runtime signals, and evidence
- runtime routing, guard, verification, visual evidence, delivery gates, single-wrapper closeout validation, and successful-mode tracking after native install failures
- README and skill contract alignment

## FAQ

### What is the role of `docs/`?

`docs/` is reference material for users and AI agents. It may lag behind implementation; runtime behavior is defined by source code, rule templates, skills, templates, and tests.

### Is this a CLI tool or a prompt framework?

Both.

- `cli.mjs` handles install, update, cleanup, diagnostics, and host config
- rule templates define the loaded workflow rules
- `skills/` defines task-specific behavior
- `scripts/` provides runtime helpers for routing, guard, notify, verification, state, and evidence

### Should I use `~wiki` or `~init`?

Use `~wiki` when you only want project knowledge.

Use `~init` when you also want project-level rule files and project-level HelloAGENTS package-root links.

### What is the difference between standby and global?

`standby` is lighter and explicit. It deploys rules to selected CLIs and keeps full project workflow behind project activation.

`global` applies full rules broadly. Claude and Gemini use native plugin/extension installs. Codex uses the local-plugin path.

### Do Codex hooks show injected content?

No HelloAGENTS rule or route text is injected through hooks. HelloAGENTS Codex hooks only write runtime state and enforce Stop gates; successful hooks stay quiet, while blocked or failed hooks show the necessary reason.

### Can I turn off notifications or guard checks?

Yes.

- set `notify_level` to `0` to disable notifications
- set `guard_enabled` to `false` to disable command guards

### Does `npm uninstall -g helloagents` remove project knowledge?

No. Run `npm explore -g helloagents -- npm run uninstall -- --all --standby` before package removal to clean host integrations and the stable runtime copy. Project `.helloagents/` files and `~/.helloagents/helloagents.json` are intentionally preserved unless you remove them yourself.

## Troubleshooting

### `~help` is not recognized

Check:

```bash
npm list -g helloagents
helloagents doctor
```

Then restart the target CLI.

### A CLI appears installed but behavior is stale

Run:

```bash
helloagents doctor
helloagents update codex
helloagents --standby
helloagents --global
```

Use the command that matches your installed mode and target CLI.

### Codex still uses old files after a local branch switch

Refresh Codex:

```bash
helloagents update codex
```

For global mode, you can also run:

```bash
helloagents --global
```

### Notifications do not work

Check `notify_level` first.

- Windows: PowerShell must be able to show desktop notifications or play sound
- macOS: `afplay` should be available
- Linux: install `aplay`, `paplay`, or `notify-send`

### Guard blocks a command you intended to run

Review the command. Guard blocks known destructive operations and warns about risky writes. If you still want to disable it:

```json
{ "guard_enabled": false }
```

## License

Code is licensed under [Apache-2.0](./LICENSE.md). Documentation is licensed under CC BY 4.0.

## Contributing

- Bug reports: [open an issue](https://github.com/hellowind777/helloagents/issues)
- Feature requests: [open an issue](https://github.com/hellowind777/helloagents/issues)
- Pull requests are welcome

---

<div align="center">

If this project helps you, a star is the best support.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project.

</div>

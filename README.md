<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**A workflow layer for AI coding CLIs: skills, project knowledge, delivery checks, safer config writes, and resumable execution.**

[![Version](https://img.shields.io/badge/version-3.0.12-orange.svg)](./package.json)
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
- [What Changed Since v3.0.11](#what-changed-since-v3011)
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

## What Changed Since v3.0.11

These are the main user-visible runtime changes in `v3.0.12`, compared with `v3.0.11`:

- Explicit `~auto` and `~loop` no longer get a free pass to stop a turn early. Before the runtime accepts the turn end, it now checks whether the main agent wrote a valid structured stop state.
- `waiting` and `blocked` turn states now require both a `reasonCategory` and a concrete `reason`, so only real blockers can pause the workflow instead of vague “next step” hand-offs.
- The stop hook and Codex turn-complete notification path now enforce the same gate, reducing cases where work still should continue but the agent stops as if it is waiting for approval.

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
In activated projects or explicit UI workflows, `hello-ui` adds deeper design-contract execution, design-system mapping, and visual validation.
When visual evidence is required, HelloAGENTS can record `.helloagents/.ralph-visual.json`.

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
| `~init` | Full project bootstrap: knowledge base plus project-level rule files and skill links |
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

`~init` does more: it creates or updates the knowledge base, writes project-level rule files, and refreshes host-native project skill links for supported hosts.

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

### 5) State and recovery

Long tasks need a small recovery snapshot, but one shared state file is not safe enough for concurrent work.

HelloAGENTS now resolves the current state file from `state_path`:

- with a stable session id: `.helloagents/sessions/<branch>/<session>/STATE.md`
- without a stable session id: `.helloagents/sessions/<branch>/default/STATE.md`

`STATE.md` records where the current workflow stopped. It is not a universal memory file for every conversation.

### 6) Verification and delivery evidence

HelloAGENTS does not treat “tests passed” and “task complete” as the same thing. Delivery can also require plan coverage, task checklist status, review evidence, advisor evidence, and visual evidence.

Runtime evidence files include:

- `.helloagents/.ralph-review.json`
- `.helloagents/.ralph-advisor.json`
- `.helloagents/.ralph-visual.json`
- `.helloagents/.ralph-closeout.json`
- `.helloagents/loop-results.tsv`

### 7) Safer install, update, cleanup, and diagnostics

The CLI manages host files explicitly:

- `install` writes only the selected target unless `--all` is used
- `update` refreshes the selected target or all targets
- `cleanup` removes managed injections and links
- `uninstall` performs scoped cleanup before package removal
- `doctor` reports drift in carriers, links, hooks, config entries, plugin roots, cache copies, and versions

## Quick Start

### 1) Install the package

```bash
npm install -g helloagents
```

If another executable named `helloagents` already exists in your `PATH`, use the stable alias:

```bash
helloagents-js
```

`postinstall` only installs the package command and initializes `~/.helloagents/helloagents.json`. It does not deploy to any AI CLI automatically.

### 2) Deploy to a CLI

Use standby mode for selected projects and explicit activation:

```bash
helloagents install codex --standby
helloagents install --all --standby
```

Use global mode when you want full rules everywhere:

```bash
helloagents --global
```

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

For full project bootstrap:

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
helloagents doctor
helloagents doctor codex --json
```

Supported targets:

- `claude`
- `gemini`
- `codex`
- `--all`

If you omit `--standby` or `--global`, HelloAGENTS first reuses the tracked/detected mode for that CLI, then falls back to `standby`.

### Standby mode files

| CLI | Files written or updated | Cleanup behavior |
|-----|--------------------------|------------------|
| Claude Code | `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/helloagents -> <package-root>` | removes managed marker block, HelloAGENTS hooks/permissions, and symlink |
| Gemini CLI | `~/.gemini/GEMINI.md`, `~/.gemini/settings.json`, `~/.gemini/helloagents -> <package-root>` | removes managed marker block, HelloAGENTS hooks, and symlink |
| Codex CLI | `~/.codex/AGENTS.md`, `~/.codex/config.toml`, `~/.codex/helloagents -> <package-root>`, managed backups | removes managed marker block, managed config keys, symlink, and the latest managed backup |

### Global mode files

| CLI | Install method | Files involved |
|-----|----------------|----------------|
| Claude Code | native plugin install | managed by Claude Code plugin system |
| Gemini CLI | native extension install | managed by Gemini extension system |
| Codex CLI | native local-plugin chain | `~/.agents/plugins/marketplace.json`, `~/plugins/helloagents/`, `~/.codex/plugins/cache/local-plugins/helloagents/local/`, `~/.codex/config.toml`, `~/.codex/helloagents -> ~/plugins/helloagents` |

Claude Code and Gemini CLI global mode still require their host-native install commands:

```text
/plugin marketplace add hellowind777/helloagents
gemini extensions install https://github.com/hellowind777/helloagents
```

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
- `.ralph-*.json`
- `loop-results.tsv`

### Knowledge creation rules

| Command or setting | Behavior |
|--------------------|----------|
| `~wiki` | creates or syncs the knowledge base only |
| `~init` | creates knowledge base plus project-level rule files and skill links |
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
3. shared UI quality baseline
4. `hello-ui` implementation and validation rules

For heavier UI work, `contract.json` can require:

- `ui.styleAdvisor.required`
- `ui.visualValidation.required`

Those requirements are closed with `.helloagents/.ralph-advisor.json` and `.helloagents/.ralph-visual.json`.

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
  "install_mode": "standby"
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `output_language` | `""` | follow the user language unless set |
| `output_format` | `true` | only the main agent's final closeout message may use the HelloAGENTS layout |
| `notify_level` | `0` | `0` off, `1` desktop, `2` sound, `3` both |
| `ralph_loop_enabled` | `true` | run verification after task completion |
| `guard_enabled` | `true` | block dangerous commands |
| `kb_create_mode` | `1` | control automatic knowledge base updates |
| `project_store_mode` | `"local"` | `local` or `repo-shared` |
| `commit_attribution` | `""` | optional text appended to commit messages |
| `install_mode` | `"standby"` | current default install mode |

## How Each CLI Is Integrated

### Claude Code

- standby writes `~/.claude/CLAUDE.md`
- standby updates `~/.claude/settings.json` with managed hooks and permissions
- standby creates `~/.claude/helloagents -> <package-root>`
- global mode uses Claude Code's plugin system

### Gemini CLI

- standby writes `~/.gemini/GEMINI.md`
- standby updates `~/.gemini/settings.json` with managed hooks
- standby creates `~/.gemini/helloagents -> <package-root>`
- global mode uses Gemini's extension system

### Codex CLI

Codex is rules-file driven by default.

- standby writes `~/.codex/AGENTS.md`
- standby writes a managed `model_instructions_file` pointing to that file
- standby writes a managed `notify` command for closeout notification
- standby creates `~/.codex/helloagents -> <package-root>`
- global mode installs the native local-plugin chain
- HelloAGENTS does not enable Codex hooks by default

## Verification

Run all tests:

```bash
npm test
```

The current test suite covers:

- install, update, uninstall, cleanup, and mode switching
- Claude, Gemini, and Codex config merge and restore behavior
- Codex managed `model_instructions_file`, `notify`, local plugin, marketplace, and cache behavior
- `helloagents doctor`
- project storage and `repo-shared` behavior
- session-scoped `state_path`
- runtime routing, guard, verification, visual evidence, and delivery gates
- README and skill contract alignment

## FAQ

### Is this a CLI tool or a prompt framework?

Both.

- `cli.mjs` handles install, update, cleanup, diagnostics, and host config
- `bootstrap.md` and `bootstrap-lite.md` define workflow rules
- `skills/` defines task-specific behavior
- `scripts/` provides runtime helpers for routing, guard, notify, verification, state, and evidence

### Should I use `~wiki` or `~init`?

Use `~wiki` when you only want project knowledge.

Use `~init` when you also want project-level rule files and host-native project skill links.

### What is the difference between standby and global?

`standby` is lighter and explicit. It deploys rules to selected CLIs and keeps full project workflow behind project activation.

`global` applies full rules broadly. Claude and Gemini use native plugin/extension installs. Codex uses the local-plugin path.

### Why does Codex not use hooks by default?

The current Codex integration is more predictable with managed rules files, `model_instructions_file`, `notify`, and local plugins. Hooks can still show output in the TUI, so HelloAGENTS does not enable Codex hooks by default.

### Can I turn off notifications or guard checks?

Yes.

- set `notify_level` to `0` to disable notifications
- set `guard_enabled` to `false` to disable command guards

### Does `npm uninstall -g helloagents` remove project knowledge?

No. Package uninstall removes the package. Project `.helloagents/` files and `~/.helloagents/helloagents.json` are intentionally preserved unless you remove them yourself.

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

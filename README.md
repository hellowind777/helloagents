<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

<div align="center">

**Quality-driven orchestration kernel for AI coding CLIs — 14 auto-activated skills, process discipline, and checklist gating.**

[![Version](https://img.shields.io/badge/version-3.0.0-orange.svg)](./package.json)
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
> **Looking for v2.x?** The legacy Python-based codebase has been moved to a separate archive repository: [helloagents-archive](https://github.com/hellowind777/helloagents-archive). v3.0.0 is a complete rewrite — pure Node.js/Markdown architecture, no Python dependency.

## 📑 Table of Contents

<details>
<summary><strong>Click to expand</strong></summary>

- [🎯 Why HelloAGENTS?](#-why-helloagents)
- [✨ Core Features](#-core-features)
- [🚀 Quick Start](#-quick-start)
- [🔄 Installation Lifecycle & File Writes](#-installation-lifecycle--file-writes)
- [📖 Commands](#-commands)
- [🔧 Configuration](#-configuration)
- [⚙️ How It Works](#️-how-it-works)
- [📚 Usage Guide](#-usage-guide)
- [🧪 Verification](#-verification)
- [❓ FAQ](#-faq)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [📈 Version History](#-version-history)
- [📜 License](#-license)

</details>

## 🎯 Why HelloAGENTS?

Ever had an AI coding assistant that stops at "here's what you should do" instead of actually doing it? Or one that writes code but skips tests, ignores edge cases, and calls it done?

HelloAGENTS fixes that. It's an orchestration layer that sits on top of your AI CLI and enforces quality at every step.

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

| Challenge | Without HelloAGENTS | With HelloAGENTS |
|-----------|-------------------|-----------------|
| **Stops at planning** | Ends with suggestions | Pushes through to implementation and verification |
| **Quality inconsistency** | Varies by prompt | 14 skills auto-activate based on task type |
| **Risky operations** | Easy to make destructive mistakes | Guard system blocks dangerous commands |
| **No verification** | "It should work" | Ralph Loop runs lint/test/build before completion |
| **Knowledge loss** | Context scattered across sessions | Project KB persists and grows |

### 💡 Best For
- ✅ **Developers using AI CLIs** who want consistent, verified output
- ✅ **Teams** that need quality guardrails on AI-assisted coding
- ✅ **Complex projects** requiring structured design → develop → verify workflows

### ⚠️ Not For
- ❌ Simple one-off questions (HelloAGENTS adds process overhead)
- ❌ Non-coding tasks (optimized for software engineering)

## ✨ Core Features

HelloAGENTS enforces quality through three mechanisms working together:

<table>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/02-feature-icon-installer.svg" width="48" align="left">

**🎯 14 Auto-Activated Quality Skills**

Skills activate automatically based on what you're building — no configuration needed.
- UI, Security, API, Architecture, Performance
- Testing, Error Handling, Data, Code Review
- Debugging, Subagents, Documentation, Verification, Reflection

**Your gain:** every task gets the right quality checks without you remembering to ask.

</td>
<td width="50%" valign="top">
<img src="./readme_images/03-feature-icon-workflow.svg" width="48" align="left">

**📋 Checklist Gate Control**

After coding, HelloAGENTS collects delivery checklists from all activated skills and verifies each item before reporting completion.

**Your gain:** nothing ships until it actually passes quality checks — not just "looks done."

</td>
</tr>
<tr>
<td width="50%" valign="top">
<img src="./readme_images/04-feature-icon-safety.svg" width="48" align="left">

**🛡️ Guard System + Ralph Loop**

L1 blocks destructive commands (`rm -rf /`, `git push --force`, `DROP DATABASE`). L2 scans for hardcoded secrets and security patterns. Ralph Loop auto-runs verification commands after every task.

**Your gain:** safer defaults with zero-config protection, verified output every time.

</td>
<td width="50%" valign="top">
<img src="./readme_images/05-feature-icon-compat.svg" width="48" align="left">

**⚡ Structured Workflow**

Simple tasks get direct execution. Complex tasks go through ORIENT → CLARIFY → PLAN → EXECUTE → VALIDATE with interactive design, solution proposals, and plan packages.

**Your gain:** proportional effort — quick tasks stay fast, complex tasks get full process.

</td>
</tr>
</table>

## 🚀 Quick Start

### 1) Install once

```bash
npm install -g helloagents
```

If your system already has another `helloagents` executable in `PATH`, use the bundled stable alias instead:

```bash
helloagents-js
```

`postinstall` now only installs the package and initializes `~/.helloagents/helloagents.json`. It **does not auto-deploy to any CLI target**.

After the package is installed, deploy explicitly to the targets you want:

```bash
helloagents install codex --standby
helloagents install --all --standby
```

> `npm install helloagents` without `-g` follows the same rule: it installs the package only and does not modify any CLI config automatically.

### 2) Choose your mode

| Goal | What to run | What happens |
|------|-------------|--------------|
| Install the package without touching hosts yet | `npm install -g helloagents` | Installs the command and `~/.helloagents/helloagents.json` only |
| Keep HelloAGENTS light by default | `helloagents install --all --standby` | **Standby mode** explicitly deploys lite rules to the target CLIs |
| Enable full rules everywhere | `helloagents install --all --global` or `helloagents --global` | Switches to **global mode**; Claude/Gemini use native plugin/extension installs, Codex gets the native local-plugin chain automatically |
| Re-sync after local branch switch / file updates | `helloagents update codex`, `helloagents install --all --standby`, or `helloagents --global` | Refreshes injected/copied files for the target or current mode |

### 2.1) Manage one CLI at a time

```bash
helloagents install codex --standby
helloagents install --all --global
helloagents update codex
helloagents cleanup claude --global
helloagents uninstall gemini
```

- Supported targets: `claude`, `gemini`, `codex`, or `--all`
- If you omit `--standby` / `--global`, HelloAGENTS reuses the tracked/detected mode for that CLI and falls back to `standby`
- `install` / `update` affect only the selected CLI; use `--all` when you want an explicit bulk deploy
- Claude Code / Gemini CLI still require native plugin/extension install or uninstall commands in `global` mode; Codex CLI is still handled automatically

If you want full rules everywhere, switch to global mode:

```bash
helloagents --global
```

Then install the native plugin/extension for your CLI where required:

```bash
# Claude Code
/plugin marketplace add hellowind777/helloagents

# Gemini CLI
gemini extensions install https://github.com/hellowind777/helloagents
```

Codex CLI does not need a manual plugin command. `helloagents --global` now installs the native local-plugin chain automatically by writing:
- `~/.agents/plugins/marketplace.json`
- `~/plugins/helloagents/`
- `~/.codex/plugins/cache/local-plugins/helloagents/local/`
- `helloagents@local-plugins` in `~/.codex/config.toml`

### 3) Verify in chat

```bash
# In your AI CLI chat, type:
~help
```

**Expected output:**
```
💡【HelloAGENTS】- Help

Available commands: ~auto, ~design, ~prd, ~loop, ~init, ~test, ~verify, ~review, ~commit, ~clean, ~help

Auto-activated skills (14): hello-ui, hello-api, hello-security, hello-test, hello-verify, hello-errors, hello-perf, hello-data, hello-arch, hello-debug, hello-subagent, hello-review, hello-write, hello-reflect
```

### 4) First use

```bash
# Simple task — direct execution
"Fix the typo in src/utils.ts line 42"

# Complex task — use ~auto for full workflow
~auto "Add user authentication with JWT"

# Want to review the plan first?
~design "Refactor the payment module"
```

## 🔄 Installation Lifecycle & File Writes

HelloAGENTS touches different files depending on mode. The write/cleanup rules are predictable and reversible.

### Standby mode (default)

| CLI | Files HelloAGENTS writes or updates | What it preserves | What uninstall / mode switch cleans |
|-----|-------------------------------------|-------------------|-------------------------------------|
| Claude Code | `~/.claude/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/helloagents -> <package-root>` | Existing non-HelloAGENTS markdown, settings, permissions, and hooks | Removes injected marker block, HelloAGENTS hooks/permissions, and symlink |
| Gemini CLI | `~/.gemini/GEMINI.md`, `~/.gemini/settings.json`, `~/.gemini/helloagents -> <package-root>` | Existing markdown, hooks, and unrelated settings | Removes injected marker block, HelloAGENTS hooks, and symlink |
| Codex CLI | `~/.codex/AGENTS.md`, `~/.codex/config.toml`, timestamped backups like `~/.codex/config.toml_YYYYMMDD-HHMMSS.bak`, `~/.codex/helloagents -> <package-root>` | Existing top-level TOML keys and unrelated sections via backup/restore | Removes injected marker block, HelloAGENTS config keys, symlink, and the latest HelloAGENTS-managed backup |

### Global mode

| CLI | How installation works | Files involved |
|-----|------------------------|----------------|
| Claude Code | Native plugin install (manual CLI command) | Managed by Claude's plugin system |
| Gemini CLI | Native extension install (manual CLI command) | Managed by Gemini's extension system |
| Codex CLI | Native local-plugin chain (automatic) | `~/.agents/plugins/marketplace.json`, `~/plugins/helloagents/`, `~/.codex/plugins/cache/local-plugins/helloagents/local/`, `~/.codex/config.toml` |

### Update / reinstall / branch-switch behavior

- **Standby mode** uses symlinks for `~/.claude/helloagents`, `~/.gemini/helloagents`, and `~/.codex/helloagents`, so local file or branch changes are visible immediately.
- **Codex global mode** uses copied runtime files. Re-running `helloagents --global` refreshes both `~/plugins/helloagents/` and the Codex cache copy.
- Re-running the current mode command is supported intentionally: `helloagents --standby` and `helloagents --global` both act as **switch-or-refresh** commands.
- For deterministic manual cleanup, run `helloagents cleanup` before `npm uninstall -g helloagents`.
- `npm uninstall -g helloagents` removes the package; `~/.helloagents/helloagents.json` is intentionally preserved.

## 📖 Commands

All commands run inside AI chat with the `~` prefix:

**Workflow Commands:**

| Command | Purpose |
|---------|---------|
| `~auto` | Full autonomous workflow — AI judges complexity, auto-plans and executes |
| `~design` | Deep interactive design — requirement gathering + solution proposals + plan package |
| `~prd` | Complete PRD — 13-dimension brainstorm-style exploration, generates product requirements |
| `~loop` | Autonomous iteration — set a target + metric, AI loops until goal is met |

**Quality Commands:**

| Command | Purpose |
|---------|---------|
| `~test` | Write complete tests (TDD: Red → Green → Refactor) |
| `~verify` | Run all verification commands (lint/test/build/typecheck) |
| `~review` | Code review with severity classification |

**Utility Commands:**

| Command | Purpose |
|---------|---------|
| `~init` | Initialize project knowledge base (`.helloagents/`) |
| `~commit` | Generate conventional commit message + KB sync |
| `~clean` | Archive completed plans, clean temp files |
| `~help` | Show all commands and current config |

## 🔧 Configuration

Config file: `~/.helloagents/helloagents.json` (auto-created on install)

Only include keys you want to override — missing keys use defaults.

```json
{
  "output_language": "",
  "output_format": true,
  "notify_level": 0,
  "ralph_loop_enabled": true,
  "guard_enabled": true,
  "kb_create_mode": 1,
  "commit_attribution": "",
  "install_mode": "standby"
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `output_language` | `""` | Empty = follow user language. Set `zh-CN`, `en`, etc. to override |
| `output_format` | `true` | `true` = only a main-agent closing reply may use the HelloAGENTS layout; a skill-generated pause/confirm/summary is wrapped only when it is also the turn's closing reply; streaming/progress/intermediate output and all subagent replies stay natural, `false` = natural output |
| `notify_level` | `0` | `0`=off, `1`=desktop, `2`=sound, `3`=both |
| `ralph_loop_enabled` | `true` | Auto-run verification after task completion |
| `guard_enabled` | `true` | Block dangerous commands |
| `kb_create_mode` | `1` | `0`=off, `1`=auto on coding tasks, `2`=always |
| `commit_attribution` | `""` | Empty = no attribution. Set text to append to commit messages |
| `install_mode` | `"standby"` | `"standby"` = per-project activation (lite rules), `"global"` = full rules for all projects |

<details>
<summary>📝 Common configuration scenarios</summary>

**Switch to global mode (full rules everywhere):**
```bash
helloagents --global
```

**Switch back to standby mode (default):**
```bash
helloagents --standby
```

**English-only output:**
```json
{ "output_language": "en" }
```

**Disable KB auto-creation:**
```json
{ "kb_create_mode": 0 }
```

**Enable desktop + sound notifications:**
```json
{ "notify_level": 3 }
```

**Disable guard (not recommended):**
```json
{ "guard_enabled": false }
```

</details>

## ⚙️ How It Works

**Short version:** HelloAGENTS selects execution depth based on task complexity. Simple tasks run directly; complex tasks use the full 5-stage flow with verification at every step. Once the requirement and execution direction are clear, it prefers direct completion over repeated confirmation.

**The 5-stage flow:**

1. **ORIENT** — Read project context (`.helloagents/context.md`, `guidelines.md`, `DESIGN.md`), scan relevant code
2. **CLARIFY** — Eliminate ambiguity. Simple tasks skip this. Complex tasks confirm key decisions
3. **PLAN** — Mark which quality skills are needed, generate design/plan if using `~design` or `~prd`
4. **EXECUTE** — Implement with TDD (test → code → refactor), verify after each step
5. **VALIDATE** — Run Ralph Loop (lint/test/build), collect delivery checklists from all activated skills, verify each item

**Routing rules:**
- Simple tasks (single file, clear fix) → Direct execution
- Complex tasks (3+ files, architecture change, new project) → Full 5-stage flow via `~design` or `~auto`

**Quality skills auto-activate based on task type:**
- Writing UI code? → `hello-ui` activates (design tokens, accessibility, responsive)
- Touching API endpoints? → `hello-api` activates (REST conventions, validation, error format)
- Any code change? → `hello-test`, `hello-verify`, `hello-review` activate

### Standby vs Global Mode

HelloAGENTS supports two installation modes with different installation methods:

| Mode | Install Method | Rules | Skills | Best For |
|------|---------------|-------|--------|----------|
| **Standby** (default) | `helloagents install <target> --standby` or `helloagents install --all --standby` | `bootstrap-lite.md` (lite rules) | `~command` on demand, `~init` for full activation | Selective use, keeping other projects unaffected |
| **Global** | Manual plugins for Claude/Gemini; native local-plugin auto-install for Codex | `bootstrap.md` (full rules) | 14 skills auto-activate | All-in on HelloAGENTS across every project |

Standby mode injects rules into `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, and `~/.codex/AGENTS.md`; Codex then loads that local merged file via `model_instructions_file` in `~/.codex/config.toml`. Each CLI also gets a `helloagents` package-root symlink. Claude Code and Gemini still use hooks where their host surfaces support quiet injection well. Codex deliberately does **not** enable HelloAGENTS hooks by default: the latest pre-source shows hook lifecycle output in TUI and does not honor `suppressOutput` as a true silent injection path, so Codex relies on the rules file plus a static runtime-context block instead. In global mode, Claude Code uses plugin hooks from `.claude-plugin/plugin.json`, Gemini loads `bootstrap.md` via `contextFileName` plus extension hooks, and Codex uses the native local-plugin chain (marketplace + local plugin root + cache + plugin enablement in `config.toml`) without plugin hooks.

Bulk switch via CLI: `helloagents --global` or `helloagents --standby`

Re-running the same mode command is also valid. It refreshes the current mode's injected/copied files after branch switches, local development changes, or manual cleanup.

## 📚 Usage Guide

### Three Workflow Modes

| Mode | Description | When to use |
|------|-------------|-------------|
| `~auto` | Full autonomous flow: evaluate → design → develop → verify | Clear requirement, want end-to-end delivery |
| `~design` | Interactive design only, generates plan package | Want to review the plan before coding |
| `~prd` | 13-dimension PRD generation | Need comprehensive product requirements |

Typical pattern: `~design` first → review plan → start coding. Or just `~auto` for one-shot delivery.

### Quality Verification (Ralph Loop)

After every task, Ralph Loop auto-runs your project's verification commands:
- Priority: `.helloagents/verify.yaml` → `package.json` scripts → auto-detected
- All pass? → Collect skill checklists → Verify → Done
- Any fail? → Reflect → Fix → Re-run (circuit breaker after 3 failures)

### Knowledge Base (`.helloagents/`)

`~init` creates a project-local knowledge base. `STATE.md` is a project-level recovery snapshot, not a universal memory file for every interaction.

It is created and continuously updated for long-running project workflows such as `~init`, `~design`, `~auto`, `~prd`, and `~loop`; updated when already present for verification/review style tasks; and intentionally not created for one-off read-only interactions such as `~help`.

| File | Purpose |
|------|---------|
| `STATE.md` | Project-level recovery snapshot (≤50 lines, survives compression) |
| `DESIGN.md` | Design system (UI projects only) |
| `context.md` | Project architecture, tech stack, conventions |
| `guidelines.md` | Non-obvious coding rules |
| `verify.yaml` | Verification commands |
| `CHANGELOG.md` | Change history |
| `modules/*.md` | Module documentation + experience |
| `plans/` | Active plan packages |
| `archive/` | Completed plan packages |

### Smart Commit (`~commit`)

- Analyzes `git diff` to generate Conventional Commits messages
- Pre-commit quality checks (code-doc consistency, test coverage)
- Auto-excludes sensitive files (`.env`, `*.pem`, `*.key`)
- Respects `commit_attribution` config
- Syncs KB per `kb_create_mode` setting

### Autonomous Iteration (`~loop`)

Set a target and metric, then let AI iterate:
1. Review → Ideate → Modify → Commit → Verify → Decide → Log → Repeat
2. Results tracked in `.helloagents/loop-results.tsv`
3. Uses `git revert` for clean rollback on failed experiments

## 🧪 Verification

HelloAGENTS ships with Node's built-in test runner:

```bash
npm test
```

The test suite validates:
- standby/global install, reinstall, refresh, uninstall, and cross-mode switching
- Claude/Gemini/Codex config file merge, restore, and cleanup behavior
- Codex local-plugin refresh after local branch or file changes
- runtime inject/route/guard/Ralph Loop chains
- cleanup when Codex global artifacts exist but `~/.codex/` is already gone

## ❓ FAQ

<details>
<summary><strong>Q: Is this a CLI tool or a prompt framework?</strong></summary>

**A:** Both. The CLI (`cli.mjs`) handles installation, mode switching, and CLI configuration. The actual workflow comes from `bootstrap.md` / `bootstrap-lite.md` rules, quality skills, and host-appropriate runtime helpers. On Claude/Gemini that includes hook scripts such as `notify.mjs`, `guard.mjs`, and `ralph-loop.mjs`; on Codex the default path is rules-file driven to keep TUI output quiet. Think of it as a delivery system + intelligent quality protocol.
</details>

<details>
<summary><strong>Q: What changed from v2.x to v3.0.0?</strong></summary>

**A:** Everything. v3.0.0 is a complete rewrite:
- Python package → pure Node.js/Markdown architecture
- 15 commands → 11 commands + 14 auto-activated quality skills
- 6 CLI targets → 3 (Claude Code + Codex CLI + Gemini CLI)
- New: checklist gate control, guard system, ~prd, ~loop, ~verify, design system generation
- See [Version History](#-version-history) for full details.
</details>

<details>
<summary><strong>Q: Which CLI should I use?</strong></summary>

**A:** Claude Code gets the best experience (plugin system, 11 lifecycle hooks, Agent Teams support). Gemini CLI works via extension system. Codex CLI works well too. Install the package first, then deploy explicitly to the CLI you want with `helloagents install <target> --standby` or `helloagents install --all --standby`.
</details>

<details>
<summary><strong>Q: What are the 14 quality skills?</strong></summary>

**A:** They auto-activate based on task type:
- **hello-ui**: UI construction (design tokens, accessibility, responsive, animation)
- **hello-api**: API design (REST, validation, error format, rate limiting)
- **hello-security**: Security (auth, input validation, XSS/CSRF, secrets management)
- **hello-test**: Testing (TDD workflow, boundary cases, AAA pattern)
- **hello-verify**: Verification gate (Ralph Loop, circuit breaker)
- **hello-errors**: Error handling (structured errors, logging, recovery)
- **hello-perf**: Performance (N+1, caching, code splitting, virtual scroll)
- **hello-data**: Database (migrations, transactions, indexes, integrity)
- **hello-arch**: Architecture (SOLID, boundaries, code volume limits)
- **hello-debug**: Debugging (4-stage process, escalation on stuck)
- **hello-subagent**: Subagent orchestration (dispatch, coordination, review)
- **hello-review**: Code review (logic, security, performance, maintainability)
- **hello-write**: Documentation (pyramid principle, audience-aware)
- **hello-reflect**: Experience capture (lessons learned → KB)

Subagents may skip workflow packaging such as routing, interaction flow, and output formatting, but they still follow core rules such as coding principles, safety constraints, and failure handling.
</details>

<details>
<summary><strong>Q: What is standby vs global mode?</strong></summary>

**A:** Standby mode (default) deploys lite rules to the targets you choose, typically with `helloagents install <target> --standby` or `helloagents install --all --standby`. Projects need `~init` to activate full features. Global mode uses each CLI's native plugin/extension system for full rules everywhere; deploy it with `helloagents install <target> --global`, `helloagents install --all --global`, or bulk-switch with `helloagents --global`.
</details>

<details>
<summary><strong>Q: Where does project knowledge go?</strong></summary>

**A:** In the project-local `.helloagents/` directory. Created by `~init`, auto-synced on code changes (controlled by `kb_create_mode`). `STATE.md` is used as a concise recovery snapshot for long-running workflows, not as a catch-all memory file for every interaction.
</details>

<details>
<summary><strong>Q: What is the Guard system?</strong></summary>

**A:** Two-layer safety:
- **L1 Blocking**: Stops destructive commands before execution (`rm -rf /`, `git push --force`, `DROP DATABASE`, `chmod 777`, `FLUSHALL`)
- **L2 Advisory**: Scans file writes for hardcoded secrets, API keys, .env exposure — warns but doesn't block
</details>

<details>
<summary><strong>Q: What does the bottom next-step bar mean when formatted output is enabled?</strong></summary>

**A:** It always shows the most appropriate next action. If a natural follow-up exists, HelloAGENTS states it directly. If the current task is fully complete with no meaningful follow-up, it falls back to a completion/waiting status instead of empty filler.
</details>

<details>
<summary><strong>Q: Can I disable features I don't need?</strong></summary>

**A:** Yes. Set `guard_enabled: false` to disable the guard, `ralph_loop_enabled: false` to skip verification, `kb_create_mode: 0` to disable KB. Quality skills auto-activate but don't add overhead for unrelated tasks.
</details>

<details>
<summary><strong>Q: What is ~prd?</strong></summary>

**A:** A 13-dimension PRD generator. It walks through product overview, user stories, functional requirements, UI/UX design, technical architecture, non-functional requirements, i18n, accessibility, content strategy, testing, deployment, legal/privacy, and timeline — brainstorm-style, one dimension at a time.
</details>

## 🛠️ Troubleshooting

### Plugin not loading (Claude Code)

**Problem:** `~help` not recognized after plugin installation

**Solution:** Restart Claude Code. If still not working, check `/plugin list` to verify installation.

---

### Extension not working (Gemini CLI)

**Problem:** `~help` not recognized after `gemini extensions install`

**Solution:** Restart Gemini CLI. Verify with `gemini extensions list`. Make sure the extension is enabled.

---

### File writes blocked outside workspace

**Problem:** Gemini CLI or Codex CLI reports that a file path is outside the allowed workspace.

**Solution:** Write files inside the current project workspace, or inside the CLI's temporary workspace directory. In headless verification, prefer paths under the current repo instead of arbitrary absolute paths.

---

### Commands not found

**Problem:** `~help` not recognized after installation

**Solution:**
- Verify installation: `npm list -g helloagents`
- Claude Code: check `~/.claude/CLAUDE.md` contains HelloAGENTS markers
- Gemini CLI: check `~/.gemini/GEMINI.md` contains HelloAGENTS markers
- Codex CLI: check `~/.codex/config.toml` has `model_instructions_file` pointing to `~/.codex/AGENTS.md` in standby mode, or to plugin `AGENTS.md` in global mode
- Restart your CLI

---

### Local branch switched but Codex global plugin still uses old files

**Problem:** You changed branches or updated a linked local checkout, but Codex global mode is still running older copied files.

**Solution:** Re-run the current mode command:
- `helloagents --global` → refreshes `~/plugins/helloagents/` and the Codex cache copy
- `helloagents --standby` → refreshes injected files and symlinks for standby mode

---

### Guard blocking legitimate commands

**Problem:** Guard blocks a command you actually want to run

**Solution:** Set `guard_enabled: false` in `~/.helloagents/helloagents.json`. Or review the blocked command — the guard only blocks truly destructive operations like `rm -rf /` and `git push --force`.

---

### Ralph Loop keeps failing

**Problem:** Verification loop won't pass

**Solution:**
- Check `.helloagents/verify.yaml` for correct commands
- Run the verification commands manually to see actual errors
- Circuit breaker activates after 3 consecutive failures — `hello-debug` escalation kicks in

---

### CCswitch replaces HelloAGENTS config

**Problem:** After switching CCswitch profiles, HelloAGENTS stops working

**Solution:** Re-run `/plugin marketplace add hellowind777/helloagents` after switching profiles. CCswitch replaces the entire CLI config directory.

---

### Notifications not working

**Problem:** No sound or desktop notifications

**Solution:**
- Check `notify_level` in config (0=off by default)
- Windows: Ensure PowerShell can access `System.Media.SoundPlayer`
- macOS: Ensure `afplay` is available
- Linux: Ensure `aplay` or `paplay` is installed

## 📈 Version History

### v3.0.0 (current) 🎉

**Breaking Changes:**
- 🔴 Complete rewrite: Python package → pure Node.js/Markdown architecture. `pip`/`uv` installation no longer available
- 🔴 Commands renamed/removed: `~plan` → `~design`, removed `~exec`/`~rollback`/`~rlm`/`~status`/`~validatekb`/`~upgradekb`/`~cleanplan`
- 🔴 Configuration keys changed from uppercase to lowercase. Removed: `BILINGUAL_COMMIT`, `EVAL_MODE`, `UPDATE_CHECK`, `CSV_BATCH_MAX`

**New Features:**
- ✨ 14 auto-activated quality skills: hello-ui, hello-api, hello-security, hello-test, hello-verify, hello-errors, hello-perf, hello-data, hello-arch, hello-debug, hello-subagent, hello-review, hello-write, hello-reflect
- ✨ 3 supported CLIs: Claude Code (plugin/marketplace), Gemini CLI (extension), Codex CLI (npm)
- ✨ Checklist gate control: all activated skills must pass delivery checklist before task completion
- ✨ `~prd` command: 13-dimension brainstorm-style PRD framework
- ✨ `~loop` command: autonomous iteration optimization with metric tracking and git-based rollback
- ✨ `~verify` command: auto-detect and run all verification commands
- ✨ Guard system (`guard.mjs`): L1 blocking for destructive commands + L2 advisory for security patterns
- ✨ Standby/Global mode: `install_mode` config for per-project or global activation
- ✨ Flow state management (`STATE.md`): AI context compression snapshot (≤50 lines)
- ✨ Design system generation (`DESIGN.md`): auto-created for UI projects
- ✨ Plan package system: `requirements.md` + `design.md` + `tasks.md`

**Architecture:**
- 📦 Unified 5-stage execution flow: ORIENT → CLARIFY → PLAN → EXECUTE → VALIDATE
- 📦 Simplified configuration: 8 lowercase keys with sensible defaults
- 📦 Dual-mode installation: standby (explicit non-plugin deploy) / global (plugin/extension)
- 📦 Modular script architecture: `cli-utils.mjs` (shared utilities), `notify-ui.mjs` (cross-platform sound/desktop), `guard.mjs` (security), `ralph-loop.mjs` (verification)
- 📦 Cross-platform hook compatibility: dynamic event name resolution (Claude Code / Gemini CLI / Codex CLI) via environment variables or CLI argument inference
- 📦 Standby mode routing isolation: new project detection only triggers in global mode or activated projects, keeping unactivated projects undisturbed
- 📦 Notification system with cross-platform sound + desktop support (Windows toast, macOS osascript, Linux notify-send)

### v2.3.8

**Architecture Changes:**
- Routing tier consolidation: removed R2 simplified flow and R3 standard flow, unified to R0/R1/R2 three-tier routing
- Evaluation driven by dimension sufficiency, replacing fixed total score threshold
- Last-round question+confirmation combined, reducing standalone confirmation steps
- Removed L0 user memory system and custom command extension
- Config system consolidation: single `~/.helloagents/helloagents.json`
- Added code size control rules: warning 300/40 lines, mandatory split 400/60 lines

**New Features:**
- ✨ 5 new workflow commands: `~test`, `~rollback`, `~validatekb`, `~upgradekb`, `~cleanplan`
- ✨ `notify_level` config key for notification behavior control
- ✨ Standalone config reader module for hook scripts

**Security:**
- Fixed path injection vulnerability in `shared_tasks.py`
- Fixed incomplete path traversal guard in `validate_package.py`

### v2.3.7

**Bug Fixes:**
- Fixed non-coding tasks incorrectly creating KB when `KB_CREATE_MODE=2`
- Fixed R2 standard flow redirecting to archive instead of DEVELOP after proposal selection
- Fixed non-coding tasks incorrectly creating plan packages

**Improvements:**
- 📦 Optimized implementation plan state recovery after context compression
- 📦 Optimized overall design flow

### v2.3.6

**New Features:**
- ✨ Sub-agent orchestration overhaul: brainstormer sub-agent for parallel proposal ideation
- ✨ Sub-agent blocking mechanism: auto-block and fallback on failure/timeout

**Improvements:**
- 📦 Tool/Shell constraint optimization: allow fallback to Shell when built-in tools fail
- 📦 Shell encoding constraint refinement: explicit UTF-8 no-BOM requirement
- 📦 Removed 3 redundant sub-agents, functionality returned to main agent and RLM roles

### v2.3.5

**New Features:**
- ✨ Voice notification system with 5 event sounds across Windows/macOS/Linux
- ✨ Claude Code hooks expanded from 9 to 11 lifecycle event types
- ✨ Hooks support expanded to Gemini CLI and Grok CLI
- ✨ Configuration integrity check on session start
- ✨ Context compression pre-save with automatic progress snapshot
- ✨ User-defined tool registration and orchestration

**Improvements:**
- 📦 Comprehensive audit fixes (21 issues: 6 HIGH + 9 MEDIUM + 6 LOW)
- 📦 Core architecture: new dispatcher module, Codex roles, Claude rules management
- 📦 Install/update script refactoring with persistent configuration

## 📜 License

This project is dual-licensed: Code under [Apache-2.0](./LICENSE.md), Documentation under CC BY 4.0.

See [LICENSE.md](./LICENSE.md) for full details.

## 🤝 Contributing

- 🐛 **Bug reports**: [Create an issue](https://github.com/hellowind777/helloagents/issues)
- 💡 **Feature requests**: [Start a discussion](https://github.com/hellowind777/helloagents/issues)
- 📖 **Documentation**: PRs welcome

## Supported CLIs

| CLI | Standby Install (default) | Global Install (plugin) | Uninstall |
|-----|--------------------------|------------------------|-----------|
| Claude Code | `helloagents install claude --standby` | `/plugin marketplace add hellowind777/helloagents` | `npm uninstall -g helloagents` (+ `/plugin remove helloagents` if global) |
| Gemini CLI | `helloagents install gemini --standby` | `gemini extensions install https://github.com/hellowind777/helloagents` | `npm uninstall -g helloagents` (+ `gemini extensions uninstall helloagents` if global) |
| Codex CLI | `helloagents install codex --standby` | `helloagents install codex --global` | `npm uninstall -g helloagents` |

---

<div align="center">

If this project helps your workflow, a star is always appreciated.

Thanks to <a href="https://codexzh.com/?ref=EEABC8">codexzh.com</a> / <a href="https://ccodezh.com">ccodezh.com</a> for supporting this project

[⬆ Back to top](#helloagents)

</div>

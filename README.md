<div align="center">
  <img src="./readme_images/01-hero-banner.svg" alt="HelloAGENTS" width="800">
</div>

# HelloAGENTS

**The thinking activation layer for AI coding CLIs: a course-correction kernel plus 23 on-demand thinking skills, shipped to Claude Code, Codex CLI, Grok Build, Cursor, and Hermes with one command.**

[English](./README.md) · [简体中文](./README_CN.md) · [Changelog](./CHANGELOG.md)

[![npm](https://img.shields.io/npm/v/helloagents.svg)](https://www.npmjs.com/package/helloagents)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933.svg)](./package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE.md)

> 4.0 is a breaking major release. To upgrade from 3.x, run `npx helloagents@4 migrate` first; docs for older versions live on the 3.x branch.

## Why HelloAGENTS

The models behind AI coding tools are already strong, but a few behavioral habits still hold them back: stopping at suggestions instead of acting, recommending "some other tool" when things get hard, calling work done before it is, and reflexively piling up abstraction layers and process documents to prove they weren't wrong.

| Without HelloAGENTS | With HelloAGENTS |
|---|---|
| The model stops at "you could try…" and waits | The model acts: it knows its job is to deliver, not to suggest |
| A hard problem gets "I'm not the right tool for this" | The model switches strategy, tries another path, only stops when truly blocked |
| Work is declared done before verification | The model runs real verification commands and pastes the raw output |
| Every task spawns a design doc, a plan, and three README drafts | The model matches effort to problem size; no ceremony without substance |

HelloAGENTS does three things:

1. **Course-correct**: a kernel lives in the host's rules file and corrects the habits above — organized into explicit sections covering identity, bias-correction patterns, dynamic capability routing, execution discipline, verification habits, interruption recovery, knowledge management, and safety.
2. **Activate**: 23 thinking skills (planning, implementation, requirements discovery, quality self-check, full-scope review, UI, debugging, security, and more) load on demand, each supplying the judgment framework and quality bar for its scenario — not an approval checklist.
3. **Distribute**: it reliably installs all of this into five hosts via npm or git clone, across standard mode and global (native marketplace) mode; install, update, health check, uninstall, and migration are each a single command, and uninstalling restores everything in full.

What it doesn't do: no process management, no state machines, no scripts that evaluate, verify, or audit in the model's place — verification is an activated model habit (run real commands yourself, paste the raw output), not something for scripts to intercept.

## Quick Start

```bash
# Install to all hosts (each host gets the best-fit method automatically)
npx helloagents@latest install --all

# Or install to just a few
npx helloagents@latest install claude codex

# Health check
npx helloagents doctor
```

Once installed, just talk to your host as usual. To jump straight into a specific way of working, use a "~command":

```
~plan add an export feature to the billing module   # plan first, act only after confirmation
~auto fix this error                                # hand it fully to the model, runs until done
~qa                                                 # verify and self-check the work just finished
~eva review this project                            # evaluate, verify, and audit any target in one pass
```

For teams, the project method is recommended: run `npx helloagents init` at the project root and the kernel is written into `AGENTS.md` (the common rules carrier adopted by thousands of repositories and read directly by dozens of tools), then ships to the whole team with the repo.

## Commands

| Command | Description |
|---|---|
| `install <host…\|--all> [--standard\|--global]` | Install. Prefers global mode by default, then standard mode |
| `uninstall <host…\|--all> [--purge]` | Uninstall and restore host config; `--purge` also deletes `~/.helloagents` |
| `update [host…]` | Refresh the running copy and sync installed hosts; all if omitted |
| `init` | Project method: write `./AGENTS.md` and set up the `.helloagents/` knowledge base |
| `doctor [--json]` | Health check: verify on-disk state against the install record, spot 3.x leftovers |
| `migrate` | Clean up everything 3.x wrote to the user's machine |
| `guard on\|off [host…]` | Add-on: dangerous-command interception |
| `notify on\|off [host…]` | Add-on: alerts for turn end and pending confirmation |

Pick the language with `HELLOAGENTS_LANG=cn\|en` or the `--lang cn\|en` flag; the default follows your system locale. Legacy `--inject`/`--plugin` aliases are still accepted.

## Install Methods and Host Matrix

The three methods can be stacked (hosts generally follow "the nearest rules file wins"):

- **Project method**: the kernel goes into the project's `AGENTS.md`, ships via git, keeps the team consistent, and never touches user-global config.
- **Standard mode** (`--standard`): the kernel goes into the host's user-level rules file (when the host has one), wrapped in `<!-- HELLOAGENTS_START/END -->` markers; content outside the markers is never touched. Hooks and a `~/.{host}/helloagents` symlink are also installed. Uninstalling restores the rules file and removes managed hooks/config.
- **Global mode** (`--global`): installs through the host's own native plugin marketplace (layered on the standard base), with the host's native management and updates.

| Host | Standard mode | Global mode | guard | notify |
|---|---|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` + hooks + symlink | Plugin marketplace (local marketplace auto-registered) | Yes | Yes |
| Codex CLI | `~/.codex/AGENTS.md` + hooks + managed `config.toml` + symlink | Plugin marketplace (local-plugins auto-registered) | Yes | Yes |
| Grok Build | `~/.grok/AGENTS.md` + hooks + symlink | Plugin marketplace (local marketplace auto-registered) | Yes | Yes |
| Cursor | hooks + symlink (no user-level rules file) | `~/.cursor/plugins/local/helloagents` (kernel ships as a rule) | Yes | Yes |
| Hermes | `~/.hermes/AGENTS.md` + symlink | `HERMES_HOME/local-plugins/helloagents` (external_dirs registered) | Yes | Yes |

All five hosts support both standard and global modes. Global mode always layers on the standard base (hooks, symlink, and where applicable the user-level rules carrier); it does not replace it.

Cursor has no user-level rules file that HelloAGENTS can inject. `~/.cursor/rules/` is not used as a global carrier — Cursor rule resolution walks upward from the workspace and does not reliably reach the home directory. Standard mode therefore installs only hooks and the `~/.cursor/helloagents` symlink. Global mode also drops a local plugin whose kernel rule is `rules/helloagents-kernel.mdc` with `alwaysApply: true` and deliberately **no** `description` (Cursor currently downgrades rules that carry both to "agent-requested"). The plugin directory holds only what Cursor reads — manifest, skills, rules; the HelloAGENTS CLI itself stays out of it. Run **Developer: Reload Window** in Cursor after a global install.

Gemini CLI is no longer a supported host. If you installed it there, run `npx helloagents migrate` to strip the managed block from `~/.gemini/GEMINI.md` and drop the install record, then remove the extension yourself with `gemini extensions uninstall helloagents`.

## Skills at a Glance

All 23 skills carry a `hello-` prefix. Skill names are global inside a host: Cursor's skill namespace is flat, with no dedup and no documented precedence between plugin, user, and project skills, and while Claude Code namespaces plugin skills as `helloagents:…`, a same-named skill still muddies the model's choice. The prefix keeps HelloAGENTS from colliding with your own `build`, `commit`, or `plan`.

**Command skills**: hello-plan (planning), hello-build (implementation), hello-auto (autonomous execution), hello-prd (requirements discovery), hello-qa (quality self-check of your own just-finished work), hello-eva (full-scope evaluation, verification, and audit of any target — separately or in one pass, with on-demand reference files), hello-ask (discussion only), hello-init (initialization), hello-commit (committing), hello-clean (cleanup), hello-help (help).

**Quality skills** (auto-relevant by task type): hello-ui (interfaces), hello-test (testing), hello-security (security), hello-debug (troubleshooting), hello-arch (structure), hello-api (APIs), hello-data (data), hello-perf (performance), hello-errors (error handling), hello-write (technical writing), hello-reflect (retrospectives), hello-subagent (subagent collaboration).

The `~commands` stay short — `~plan` and `~hello-plan` are equivalent. Use the full name with a host's own skill entry point, e.g. `/hello-plan` in Claude Code.

Each skill is 30–70 lines with a uniform structure: how to think right now → what good looks like → questions to ask before delivery. At startup only the name and a one-line description enter the context; the body is read only when actually used.

## Add-ons

Both add-ons are optional and decoupled from the core:

- **guard**: intercepts a short list of high-risk operations before they run (full-tree rm -rf, force-pushing main, DROP DATABASE, chmod 777, and the like), with rules drawn from the same list as the kernel's; matching is semantic, based on command structure, so a sensitive word in a commit message won't trigger a false block. On runtime errors it blocks rather than silently waving things through.
- **notify**: plays a sound and sends a desktop notification at turn end and when confirmation is pending. A pure quality-of-life add-on; Windows notifications go through an encoding-safe channel, so Chinese paths and messages never come out garbled.

## Project Knowledge Base

`helloagents init` sets up `.helloagents/` in your project: `context.md` (project facts), `guidelines.md` (conventions), `DESIGN.md` (design system, for UI projects), `verify.yaml` (verification commands), `plans/` (plan documents), and `archive/` (completed plans). The kernel also defines a `notes/` convention for extracting thick topics out of `context.md`. One principle: record only what can't be read from the code; no empty files are created, no boilerplate is filled in.

## One-Click Install Scripts

### npm (default)

```bash
# Windows (PowerShell)
irm https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.ps1 | iex

# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | sh
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `HELLOAGENTS_HOSTS` | `all` | Target hosts (comma-separated: claude,codex,grok,cursor,hermes) |
| `HELLOAGENTS_METHOD` | (auto) | Install mode: `standard` or `global` (legacy `inject`/`plugin` also accepted) |
| `HELLOAGENTS_VERSION` | `latest` | npm dist-tag (npm source only) |
| `HELLOAGENTS_SOURCE` | `npm` | `npm` or `git` |
| `HELLOAGENTS_BRANCH` | `main` | Git branch (git source only) |
| `HELLOAGENTS_GIT_URL` | (repo URL) | Git remote URL (git source only) |
| `HELLOAGENTS_LANG` | (system) | Language: `cn` or `en` |

### Git clone (alternative)

```bash
# Install from the main branch
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_SOURCE=git sh

# Install from the beta branch  
curl -fsSL https://raw.githubusercontent.com/hellowind777/helloagents/beta/install.sh | HELLOAGENTS_SOURCE=git HELLOAGENTS_BRANCH=beta sh
```

The git source clones to `~/.helloagents/source/` and `helloagents update` will `git pull` from there.

## Migrating from 3.x

```bash
npx helloagents@4 migrate       # clean up 3.x carrier injections, hooks, managed config.toml lines, and the runtime directory
npx helloagents@4 install --all
```

migrate removes only what it can positively identify as 3.x artifacts; config it can't attribute (say, a notify command you wrapped yourself) is left untouched with a prompt for manual review. 3.x's stop gates, evidence files, turn-state protocol, and session state directory have no counterparts in 4.0, and their commands have been removed.

## FAQ

**Why did 4.0 drop the mandatory verification gates?** Three lines of evidence agree: a model's self-reported evidence proves nothing; official best practices point toward "show real test output" rather than process approvals; and hosts now ship built-in continuous verification and code review (when enforcement is needed, prefer the host's native features). 4.0 turns verification into a kernel habit plus the hello-qa skill — the model runs the commands and pastes the output itself.

**Does installing run any implicit scripts?** No. 4.0 removed every npm lifecycle hook; nothing is written until you explicitly run `helloagents install`, and doctor can audit all of it.

**What does zero-dependency mean?** The npm package has no runtime or dev dependencies and no build step — `npx` fetches it ready to run; every write into a host carries a marker or a managed tag, so uninstalling restores everything in full.

**How is Windows support?** First-class: unified path handling, automatic retries on locked files, notifications over an encoding-safe channel, and CI runs the full test suite on Windows.

## License

Licensed under [Apache-2.0](./LICENSE.md).

---
name: memory
description: >
  Memory management protocol — user preferences (L0), project knowledge (L1),
  progress snapshots, and knowledge base operations.
  Loaded at session start for L0, on-demand for L1/KB operations.
provides: [context-management, project-fingerprint, routing-history]
category: core
trigger:
  auto: true
requires: []
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 2500
---

# Memory Service

## Overview
Manages persistent memory layers and knowledge base operations.
Does NOT replace CLI's native context management — supplements what it can't persist.

## Memory Layers

### L0: User Memory (global, cross-project)
```yaml
storage: ~/.helloagents/user/memory/*.md
maintenance: user-managed (system never auto-writes)
loading: session start → scan all .md files → inject as background context
absent: silently skip
skeleton: profile.md (preferences, tech background, communication style)
```

### L1: Project Knowledge (per-project)
```yaml
storage: {CWD}/.helloagents/ (knowledge base)
structure:
  INDEX.md: keyword index + kb_version
  context.md: project overview, tech stack
  CHANGELOG.md: change history
  modules/: per-module documentation
  plan/: active plan packages
  archive/: completed packages
loading: on-demand when project context needed
retrieval: read INDEX.md keywords → load relevant modules only
```

## Session Start Protocol
```yaml
1. Scan ~/.helloagents/user/memory/*.md → read all files (skip if empty/absent)
2. Inject L0 memory as background context
3. Check {CWD}/.helloagents/config.json for project config overrides
```

## Knowledge Base Operations

### KB Mode (from config)
```yaml
KB_CREATE_MODE:
  0: KB_SKIPPED=true, skip all KB ops (still update CHANGELOG if KB exists)
  1: prompt "suggest ~init" when KB missing
  2: auto-create for coding tasks, else mode 1
  3: always auto-create
```

### Pre-checks (before any KB operation)
```yaml
1. KB mode check: mode=0 + no KB → skip all
2. Old directory migration: detect helloagents/ (old name) → upgrade_wiki.py --migrate-root
3. KB version check: read kb_version from INDEX.md → auto-upgrade structure if outdated
```

### Interfaces
```yaml
create(): ~init → check KB → upgrade_wiki.py --init → scan and fill → verify
sync(changes): after code changes → check KB_SKIPPED → consistency check → update modules
query(scope): read KB if exists, else scan codebase → return context + source
validate(): ~validatekb → check structure → compare code vs docs → report issues
updateChangelog(entry): after package archive → append formatted entry to CHANGELOG.md
```

## CHANGELOG Format
```yaml
entry: |
  ## [X.Y.Z] - YYYY-MM-DD
  ### {Category}
  - **[{module}]**: {description} — by {git_user_name}
    - 方案: [{package_id}](archive/{YYYY-MM}/{package_id}/)
categories: 新增 | 修复 | 快速修改 | 回滚
version: X.Y.Z semantic versioning (Major.Minor.Patch)
author: git config user.name (fallback: "unknown")
```

## Progress Snapshots
```yaml
storage: plan package directory → .status.json
format: {"status","completed","failed","pending","total","done","percent","current","updated_at"}
timing: task start, status change, error, stage switch, mode change
recovery: compaction summary is primary source; .status.json is supplementary
```

## Zero-Config Project Fingerprint

On first interaction when `{CWD}/.helloagents/context.json` does not exist:
```yaml
1. Read project characteristic files: package.json, pyproject.toml, Cargo.toml, go.mod, .git/config
2. Read directory structure (depth 2)
3. Read recent 10 git log entries (--oneline)
4. Generate fingerprint and cache to {CWD}/.helloagents/context.json
fingerprint_structure:
  language: string
  framework: string
  build_system: string
  test_framework: string
  modules: string[]
  recent_changes: string[]
  dependencies: string[]
```
Subsequent interactions read cache directly. `~init` becomes an optional advanced feature.

## Routing History

Session end hook writes to `~/.helloagents/user/memory/routing_history.jsonl`:
```json
{"ts":"2026-03-10T15:30:00","project":"myapp","input_hash":"abc123","route":"R2","actual_complexity":"moderate","outcome":"success","duration_s":120}
```
Used by workflow-router for adaptive calibration (read last 50 entries).

## Constraints
DO: Silently load L0 at session start. Use KB interfaces for all KB operations. Auto-generate project fingerprint on first interaction.
DO NOT: Auto-write to user/ directory. Let sub-agents directly read/write L0.

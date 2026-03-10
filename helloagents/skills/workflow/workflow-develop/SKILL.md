---
name: workflow-develop
description: >
  Development execution stage — task execution, testing, verification,
  KB sync, and package archival. Loaded after DESIGN completes.
provides: [code-implementation, test-verification, delivery-acceptance]
category: workflow
trigger:
  auto: false
requires: [workflow-router, memory, output-format]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 4000
---

# DEVELOP Stage

## Overview
Execute plan package tasks, verify results, sync knowledge base, archive package.
Entry: NATURAL (from DESIGN) or DIRECT (~exec). Exit: verified delivery + archived package.

## Entry Modes
```yaml
NATURAL: CURRENT_PACKAGE = CREATED_PACKAGE (from DESIGN stage)
DIRECT (~exec): CURRENT_PACKAGE selected by user, STAGE_ENTRY_MODE = DIRECT
  Step 1: Read package → Step 2: Assess TASK_COMPLEXITY → Step 3: Begin execution
```

## Execution Flow (Steps 1-15)

### Steps 1-3: Setup
```yaml
1. Determine package: NATURAL → use CREATED_PACKAGE | DIRECT → user-selected
2. Environment check: verify tools, dependencies, build system
3. Package type check: overview → archive directly (no code execution)
```

### Steps 4-6: Task Execution
```yaml
4. Context acquisition: read proposal.md for approach + design direction
5. Execute tasks from tasks.md in dependency order (topological sort)
6. For each task:
   - Update .status.json (in_progress)
   - Execute implementation
   - Inject design direction for visual outputs
   - Update .status.json (completed/failed)

Parallel execution:
  ≥2 independent tasks → batch dispatch sub-agents (≤6/batch)
  DAG resolution: only execute tasks whose dependencies are all completed
  Sub-agent timeout: 2 consecutive timeouts → main agent direct mode
```

### Steps 7-8: Verification
```yaml
7. Security check: → skill:ehrb on all changes
8. Testing:
   - Static analysis (lint, type-check) on modified files
   - Unit tests for new/modified functions
   - Integration tests for cross-module changes
   - Build verification if applicable
```

### Step 9: Delivery Acceptance (MANDATORY, never skip)
```yaml
Tiered by TASK_COMPLEXITY:
  simple: code runs + lint passes
  moderate: feature works + lint + type-check + related tests pass
  complex: all features + full tests + security + UX + docs synced

Failure handling:
  ⛔ blocking: fix required before proceeding
  ⚠️ warning: logged, can continue
  DELEGATED mode: blocking failure → interrupt delegation → ask user
```

### Steps 10-12: Knowledge Base Sync
```yaml
10. KB sync: update modules/*.md for changed code (skip if KB_SKIPPED)
11. CHANGELOG update: append entry with version, date, category, module, description
12. Consistency audit: verify code matches updated docs
→ skill:memory for KB operations
```

### Steps 13-15: Package Archival
```yaml
13. Migrate package: plan/{package}/ → archive/{YYYY-MM}/{package}/
    - Atomic operation, non-skippable
    - Main agent must complete if sub-agent fails
14. Legacy package scan: check plan/ for stale packages, report to user
15. Output completion summary with change list
```

## Sub-Agent Coordination
```yaml
dispatch: independent tasks → parallel sub-agents
  Claude Code: Agent tool (ha-* subagent_type)
  Codex CLI: spawn_agent (Collab API)
  Others: main agent sequential execution

fallback: sub-agent failure → main agent direct execution, mark [降级执行] in tasks.md
language: sub-agent prompts include OUTPUT_LANGUAGE setting
```

## Constraints
DO: Execute tasks in dependency order. Run acceptance checks. Archive package.
DO NOT: Skip step 9 acceptance. Execute overview packages. Leave packages in plan/.


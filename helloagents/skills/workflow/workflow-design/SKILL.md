---
name: workflow-design
description: >
  Solution design stage — context collection, multi-proposal comparison,
  detailed planning, and package creation. Loaded after routing confirms R2/R3.
provides: [solution-design, multi-proposal-comparison, task-planning]
category: workflow
trigger:
  auto: false
requires: [workflow-router, memory]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 4000
---

# DESIGN Stage

## Overview
Two-phase design process: context collection → solution planning.
Entry: after R2/R3 confirmation. Exit: validated plan package ready for DEVELOP.

## Phase 1: Context Collection (Steps 1-6)

### Step 1: KB Switch Check
```yaml
KB_CREATE_MODE=0 + no {KB_ROOT}/: KB_SKIPPED=true
KB_CREATE_MODE=1 + no {KB_ROOT}/: prompt "suggest ~init"
KB_CREATE_MODE=2 + coding task: auto-create KB
KB_CREATE_MODE=3: always auto-create
→ skill:memory for KB operations
```

### Step 2: Project Context Acquisition
```yaml
KB exists: read INDEX.md + context.md + relevant modules
KB absent: scan codebase (config files → directory structure → source code)
Goal: understand architecture, tech stack, module structure, constraints
```

### Step 3: Complexity Assessment (initial)
```yaml
Set TASK_COMPLEXITY based on highest dimension:
| Dimension | simple | moderate | complex |
|-----------|--------|----------|---------|
| Files | ≤3 | 4-10 | >10 |
| Modules | 1 | 2-3 | >3 |
| Tasks | ≤3 | 4-8 | >8 |
| Cross-layer | single | dual | 3+ |
| New vs modify | pure modify | mixed | pure new/refactor |

complex → apply scaling rules for large projects
```

### Step 4: Goal Extraction
```yaml
Extract from user requirement + evaluation answers:
- Functional goals (what to build/change)
- Quality goals (performance, security, UX)
- Constraints (tech stack, compatibility, timeline)
```

### Step 5: Deep Analysis
```yaml
Analyze affected code paths, dependencies, potential conflicts.
For complex tasks: parallel sub-agent scanning (≤6/batch).
```

### Step 6: Complexity Confirmation
```yaml
Confirm TASK_COMPLEXITY based on actual analysis results.
May upgrade from initial assessment.
```

## Phase 2: Solution Design & Planning (Steps 7-13)

### Step 7: Mode Branching
```yaml
R2 (simplified): skip multi-proposal → go to Step 11
R3 (standard): proceed to multi-proposal comparison
```

### Step 8: Solution Brainstorming (R3 only)
```yaml
Spawn brainstormer sub-agents → skill:role-brainstormer
Each proposes a differentiated approach.
Visual outputs: inject design direction (aesthetic, color, typography, layout).
```

### Step 9: Solution Evaluation (R3 only)
```yaml
Compare proposals on: feasibility, maintainability, performance, risk.
Present comparison to user with recommendation.
INTERACTIVE: user selects → ⛔ STOP
DELEGATED: auto-select recommended
```

### Step 10: Solution Selection
```yaml
Merge selected proposal details into implementation plan.
```

### Step 11: Detailed Planning
```yaml
Create plan package:
  proposal.md: approach, architecture, key decisions
  tasks.md: ordered task list with dependencies (depends_on field)
  .status.json: initial progress tracking

Package naming: YYYYMMDDHHMM_{feature}/
Location: {KB_ROOT}/plan/ (or {CWD}/.helloagents/plan/ if no KB)
```

### Step 12: Package Validation
```yaml
Run validate_package.py on created package.
Check: proposal.md exists + tasks.md has ≥1 task + format correct.
Failure → fix and retry (max 2 attempts).
```

### Step 13: Stage Transition
```yaml
Set CREATED_PACKAGE = package path
Output design summary
→ skill:workflow-develop (next stage)
DELEGATED_PLAN: stop here, output summary → ⛔ STOP
```

## DAG Task Dependencies
```yaml
tasks.md format:
  - id: T1
    description: "Create database schema"
    depends_on: []
  - id: T2
    description: "Implement API endpoints"
    depends_on: [T1]

Parallel execution: independent tasks (no dependency) can run concurrently.
```

## Constraints
DO: Collect context before designing. Validate package before transitioning.
DO NOT: Skip multi-proposal for R3. Create package without validation.


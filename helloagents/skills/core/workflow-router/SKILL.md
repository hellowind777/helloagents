---
name: workflow-router
description: >
  Assess task complexity and route to appropriate workflow.
  Use when user request needs analysis, has decisions, or is irreversible.
  Handles requirement evaluation, scoring, clarification, and confirmation.
provides: [task-routing, requirement-evaluation]
category: core
trigger:
  auto: true
  keywords: [重构, 架构, 新项目, 设计, refactor, redesign, migrate]
requires: [ehrb]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 3000
---

# Workflow Router

## Overview
Routes user requests to the appropriate execution level. Replaces the bootstrap's
simple YES/NO with detailed scoring when loaded.

## Trigger Conditions
- Bootstrap determines request needs analysis/has decisions/is irreversible
- Complex tasks requiring multi-step planning
- NOT needed for: direct answers (R0), single-point reversible changes (R1)

## Routing Dimensions (evaluate each independently)
```yaml
dimensions:
  needs_action: No → R0 (answer directly) | Yes → continue
  target_clarity: directly locatable → R1 | needs analysis → R2 | open-ended/new project → R3
  decision_needs: no decisions, single path → R1 | local decisions → R2 | architecture/multi-approach → R3
  impact_scope: single-point reversible → R1 | multi-point partial → R2 | irreversible/cross-system → R3
  ehrb: keyword match at routing → force R3

rules:
  - Any dimension hits R3 → overall R3
  - No R3 but any R2 → overall R2
  - All R1 → overall R1
  - EHRB match → force R3
```

## Level Behaviors

### R0: Direct Response
```yaml
applies_to: Q&A, explanations, queries, translations — no execution needed
flow: answer using conversation + project context
output: 💡 status + answer + next step
```

### R1: Quick Flow
```yaml
applies_to: single-point operations directly locatable (modify, run, convert)
flow: EHRB check → execute → verify
output: ⚡ status + result + change summary + next step
upgrade: if analysis needed / design decisions / cross-module → upgrade to R2
stage_chain: code tasks → R1 execution flow | non-code → direct execution

R1 execution flow (code tasks):
  1. Locate: find files + search content for modification point
  2. Modify: direct code change, no plan package
  3. KB sync: CHANGELOG.md "quick fix" category (if KB exists)
  4. Verify: lint/type-check modified files, run related tests if available
```

### R2: Simplified Flow
```yaml
applies_to: tasks needing analysis before execution, local decisions
flow: quick score + EHRB → 1 key question + confirm (combined) → ⛔ STOP → user reply = confirm
output: 📐 status + score + question + options
stage_chain: DESIGN (with context collection, skip multi-proposal) → DEVELOP → KB sync → done
```

### R3: Standard Flow
```yaml
applies_to: complex tasks, architecture changes, multi-proposal comparison
flow: full score + clarify (per EVAL_MODE) + EHRB → full confirm + options → ⛔ STOP
output: 🔵 status + full confirmation
stage_chain: DESIGN (context + multi-proposal) → DEVELOP → KB sync → done
```

## Requirement Scoring (R2/R3 shared)
```yaml
dimensions (total 10):
  requirement_scope: 0-3
    0: cannot determine what to do
    1: vague direction, no specific goal
    2: clear goal but unclear boundaries
    3: clear goal with clear boundaries
  deliverable_spec: 0-3
    0: no expectations mentioned
    1: basic expectations mentioned but not specific
    2: core content clear but missing quality/presentation
    3: content + quality + presentation all specified
  implementation_conditions: 0-2
    0: no environment/tool/constraint info
    1: partial info (framework or constraint)
    2: complete environment + tools + constraints
  acceptance_criteria: 0-2
    0: no verifiable completion conditions
    1: basic completion conditions
    2: testable conditions covering edge cases

scoring_rules:
  - Score each dimension independently, then sum
  - Sources: user-stated info → project-context inference (mark as inferred) → else 0
  - Never guess unstated intent
```

## R3 Evaluation Flow
```yaml
phase1_score_and_clarify:
  sufficiency_thresholds:
    requirement_scope: ≥3
    implementation_conditions: ≥1
    deliverable_spec: ≥1
    acceptance_criteria: non-blocking
  dependency_chain: scope → conditions → spec → acceptance
  EVAL_MODE=1: 1 question per round (first insufficient dimension), max 4 rounds
  EVAL_MODE=2: all insufficient dimensions at once, max 2 rounds
  delegation: user says "you decide" → dimension temporarily sufficient, AI fills in DESIGN

phase2_confirm:
  all core dimensions sufficient OR max rounds exhausted → EHRB check → output confirmation → ⛔ STOP
```

## Confirmation Formats
```yaml
R2 (question + confirm combined):
  📋 Requirement: summary
  📊 Score: N/10 (scope X/3 | spec X/3 | conditions X/2 | acceptance X/2)
  ⚠️ EHRB: (only if risk detected)
  💬 {1 key question}
  Options: 1-N numbered choices
  → Any reply = confirm + answer context → INTERACTIVE → DESIGN

R3 clarification (core dimensions insufficient):
  📋 Requirement: summary
  📊 Score: N/10 breakdown
  💬 Question(s) per EVAL_MODE
  Options per question

R3 confirmation (all sufficient):
  📋 Requirement: summary
  📊 Score: N/10 breakdown
  ⚠️ EHRB: (only if risk detected)
  Options:
    1. Recommended mode (INTERACTIVE or DELEGATED per entry)
    2. Alternative mode
    3. Revise requirements
```

## Execution Modes
```yaml
INTERACTIVE (default): step-by-step with confirmations at decision points
DELEGATED: auto-advance between stages, auto-select recommended options
  interrupt: EHRB risk / blocking test failure / unresolvable error → pause and ask
DELEGATED_PLAN: same as DELEGATED but stop after DESIGN (no DEVELOP)
```

## Upgrade Paths
```yaml
R1→R2: analysis needed / design decisions / cross-module impact / EHRB
R2→R3: architecture refactor / >3 modules / multi-proposal needed / EHRB
```

## Adaptive Calibration

Before routing, read `~/.helloagents/user/memory/routing_history.jsonl` (last 50 entries).
Each entry: `{"ts","project","input_hash","route","actual_complexity","outcome","duration_s"}`

Calibration rules:
- User upgrade rate > 50% (R1→R2 frequent) → pre-upgrade similar tasks one level
- Project module change history shows cascade → impact_scope dimension +1
- User mode preference (DELEGATED usage > 80%) → auto-recommend DELEGATED
- No history file → skip calibration, use standard scoring

## State Variables

```yaml
# Workflow variables
WORKFLOW_MODE: INTERACTIVE | DELEGATED | DELEGATED_PLAN  # default INTERACTIVE
ROUTING_LEVEL: R0 | R1 | R2 | R3
CURRENT_STAGE: empty | EVALUATE | DESIGN | DEVELOP
STAGE_ENTRY_MODE: NATURAL | DIRECT  # default NATURAL, ~exec sets DIRECT
DELEGATION_INTERRUPTED: false

# Task complexity
TASK_COMPLEXITY: unset | simple | moderate | complex

# Knowledge base
KB_SKIPPED: unset | true
CREATED_PACKAGE: empty
CURRENT_PACKAGE: empty

# Task status symbols
# [ ] pending | [√] completed | [X] failed | [-] skipped | [?] uncertain

# State reset
task_reset: CURRENT_STAGE, STAGE_ENTRY_MODE, KB_SKIPPED, TASK_COMPLEXITY, CREATED_PACKAGE, CURRENT_PACKAGE, ROUTING_LEVEL
full_reset: all above + WORKFLOW_MODE→INTERACTIVE, DELEGATION_INTERRUPTED→false

# Turn control
⛔ END_TURN: immediately end response, no text/tools/steps after this mark
```

## Constraints
DO: Complete routing before any action. Output confirmation for R2/R3. Load stage skills per chain.
DO NOT: Skip routing. Execute R2/R3 without confirmation. Jump stages in the chain.

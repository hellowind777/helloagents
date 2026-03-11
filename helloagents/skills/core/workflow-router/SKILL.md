---
name: workflow-router
description: >
  Assess task complexity and route to appropriate workflow.
  Use when user request needs analysis, has decisions, or is irreversible.
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
  max-tokens: 2500
---

# Workflow Router

## Routing
Evaluate each request across these dimensions to determine level:
- **needs_action**: No → R0 | Yes → continue
- **target_clarity**: directly locatable → R1 | needs analysis → R2 | open-ended → R3
- **decision_needs**: single path → R1 | local decisions → R2 | architecture/multi-approach → R3
- **impact_scope**: single-point reversible → R1 | multi-point → R2 | irreversible/cross-system → R3
- **ehrb**: risk detected → force R3

Highest dimension wins. EHRB always forces R3.

## Levels

**R0** — Direct response. Q&A, explanations, no execution needed.

**R1** — Quick flow. Single-point, directly locatable, reversible. EHRB check → execute → verify. No plan package. Upgrade to R2 if analysis/decisions/cross-module needed.

**R2** — Simplified flow. Needs analysis, has local decisions. Assess requirements → ask 1 key question + confirm (combined) → ⛔ STOP → user reply = confirm → DESIGN (skip multi-proposal) → DEVELOP.

**R3** — Standard flow. Complex, architecture changes, multi-proposal. Full assessment → clarify until sufficient → confirm with mode options → ⛔ STOP → DESIGN (multi-proposal) → DEVELOP.

## Requirement Assessment (R2/R3)
Evaluate how well-defined the request is across: scope clarity, deliverable specificity, implementation conditions, acceptance criteria. Use judgment — don't apply rigid numeric thresholds. Ask clarifying questions when critical information is genuinely missing, not when a score is below a number.

```yaml
EVAL_MODE=1: 1 question per round, max 4 rounds
EVAL_MODE=2: all questions at once, max 2 rounds
delegation: user says "you decide" → fill gaps in DESIGN stage
```

## Confirmation (R2/R3)
Present a confirmation that includes: requirement summary, assessment of readiness, EHRB warnings if any, and execution mode options. Format naturally for the content — no fixed template.

R2: combine question + confirmation in one response. Any reply = confirm.
R3: offer INTERACTIVE (default) vs DELEGATED mode choice.

## Execution Modes
```yaml
INTERACTIVE: confirmations at decision points
DELEGATED: auto-advance, pause only on EHRB risk / blocking failure / unresolvable error
DELEGATED_PLAN: same as DELEGATED but stop after DESIGN
```

## Adaptive Calibration
Before routing, read `~/.helloagents/user/memory/routing_history.jsonl` (last 50 entries) if available. Calibrate based on: user upgrade patterns, project module cascade history, mode preferences.

## State Variables
```yaml
WORKFLOW_MODE: INTERACTIVE | DELEGATED | DELEGATED_PLAN
ROUTING_LEVEL: R0 | R1 | R2 | R3
CURRENT_STAGE: empty | EVALUATE | DESIGN | DEVELOP
STAGE_ENTRY_MODE: NATURAL | DIRECT
TASK_COMPLEXITY: unset | simple | moderate | complex
KB_SKIPPED: unset | true
CREATED_PACKAGE: empty
CURRENT_PACKAGE: empty

# Task status: [ ] pending | [√] completed | [X] failed | [-] skipped | [?] uncertain
# ⛔ END_TURN: immediately end response, no text/tools/steps after this mark

task_reset: CURRENT_STAGE, STAGE_ENTRY_MODE, KB_SKIPPED, TASK_COMPLEXITY, CREATED_PACKAGE, CURRENT_PACKAGE, ROUTING_LEVEL
full_reset: all above + WORKFLOW_MODE→INTERACTIVE
```

## Constraints
DO: Complete routing before any action. Confirm before executing R2/R3. Load stage skills per chain.
DO NOT: Skip routing. Execute R2/R3 without user confirmation. Jump stages.

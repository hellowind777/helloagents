---
name: workflow-design
description: >
  Solution design stage — context collection, solution planning, and package creation.
  Loaded after routing confirms R2/R3.
provides: [solution-design, multi-proposal-comparison, task-planning]
category: workflow
trigger:
  auto: false
requires: [workflow-router, memory]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 2500
---

# DESIGN Stage

Entry: after R2/R3 confirmation. Exit: validated plan package ready for DEVELOP.

## Goals
1. Understand the project context (architecture, tech stack, constraints)
2. Assess task complexity to determine appropriate depth
3. Design solution(s) — R3 requires multi-proposal comparison, R2 skips it
4. Create a validated plan package with tasks and dependencies

## Context Collection
- If KB exists: read INDEX.md, context.md, relevant modules
- If KB absent: scan codebase (config files, directory structure, source code)
- KB creation follows KB_CREATE_MODE setting (→ skill:memory)

## Solution Design
- R2: single solution, skip multi-proposal
- R3: spawn brainstormer sub-agents (→ skill:role-brainstormer) for differentiated proposals, compare on feasibility/maintainability/risk, present to user
  - INTERACTIVE: user selects → ⛔ STOP
  - DELEGATED: auto-select recommended

## Plan Package
Create package at `{KB_ROOT}/plan/` (or `{CWD}/.helloagents/plan/`):
- `proposal.md`: approach, key decisions, architecture
- `tasks.md`: ordered task list with `depends_on` dependencies
- `.status.json`: progress tracking

Validate package before transitioning. Independent tasks can run concurrently.

DELEGATED_PLAN: stop after DESIGN, output summary → ⛔ STOP.

## Constraints
DO: Collect context before designing. Validate package before transitioning. Multi-proposal for R3.
DO NOT: Skip context collection. Create package without validation. Skip multi-proposal for R3.

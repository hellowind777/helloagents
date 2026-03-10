---
name: cmd-plan
description: >
  Planning-only command (~plan). Runs evaluation and design stages
  but stops before development. Use for upfront planning.
provides: [planning-only]
category: command
trigger:
  auto: false
requires: [workflow-router, workflow-design]
user-invocable: true
argument-hint: "[需求描述]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~plan 规划命令

## Execution Flow

### Round 1: Evaluation
```yaml
1. Force ROUTING_LEVEL = R3
2. → skill:workflow-router — full requirement evaluation
3. Special: if actual level is R1 → offer choice:
   - Direct execution (skip planning)
   - Force planning anyway
4. Evaluation complete → output confirmation:
   Options:
     1. 全自动规划（推荐）— auto-complete analysis and design
     2. 交互式规划 — wait for confirmation at decision points
     3. 改需求后再执行
5. ⛔ STOP, wait for user reply
```

### Round 2: Design Only
```yaml
User confirms:
  Option 1 → WORKFLOW_MODE = DELEGATED_PLAN
  Option 2 → WORKFLOW_MODE = INTERACTIVE
  Option 3 → back to Round 1

Execute:
  → skill:workflow-design (context collection + multi-proposal comparison)
  STOP after design completes (no DEVELOP stage)

Output:
  - Design summary (proposal highlights)
  - Package location
  - Task list overview
  - "Use ~exec to execute this plan"
→ full state reset
```

## Constraints
DO: Complete evaluation. Stop after DESIGN. Suggest ~exec for execution.
DO NOT: Enter DEVELOP stage. Skip multi-proposal for R3.

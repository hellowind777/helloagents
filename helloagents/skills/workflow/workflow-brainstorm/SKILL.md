---
name: workflow-brainstorm
description: >
  Multi-proposal brainstorming for R3 standard flow.
  Spawns brainstormer sub-agents to generate differentiated approaches.
  Only triggered for R3 tasks requiring multi-proposal comparison.
provides: [multi-proposal-generation]
category: workflow
trigger:
  auto: false
requires: [workflow-router]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 1500
---

# Multi-Proposal Brainstorming

## Overview
Generates 2-3 differentiated solution proposals for R3 tasks.
Each proposal takes a distinct architectural approach.

## Trigger Conditions
- R3 standard flow, DESIGN Phase2 Step 8
- NOT triggered for: R2 simplified flow, R1 quick flow, non-code tasks without alternatives

## Execution Flow
```yaml
1. Prepare context brief: project context + requirement + constraints
2. Spawn brainstormer sub-agents (→ skill:role-brainstormer)
   - Each receives same context but different design direction
   - Visual outputs: each proposal uses different aesthetic/style
   - Logic outputs: each proposal uses different architecture pattern
3. Collect proposals (parallel, ≤6/batch)
4. Evaluate and compare:
   - Feasibility (can it be built with current stack?)
   - Maintainability (long-term code health)
   - Performance (runtime efficiency)
   - Risk (what could go wrong?)
5. Present comparison table + recommendation to user
```

## Proposal Differentiation Rules
```yaml
visual_tasks:
  - Each proposal MUST use different visual style/theme as core differentiator
  - Functional spec stays consistent across proposals
  - Style descriptions must be specific enough to guide implementation

logic_tasks:
  - Each proposal MUST use different architecture pattern or approach
  - Same functional requirements, different implementation strategies
  - Trade-offs clearly articulated
```

## Constraints
DO: Generate genuinely different approaches. Present clear trade-offs.
DO NOT: Create proposals that only differ in scope/feature count. Skip comparison.

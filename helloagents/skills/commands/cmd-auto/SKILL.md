---
name: cmd-auto
description: >
  Delegated execution command (~auto). Runs full workflow
  (evaluate → design → develop) automatically after user confirmation.
provides: [delegated-execution]
category: command
trigger:
  auto: false
requires: [workflow-router, workflow-design, workflow-develop]
user-invocable: true
argument-hint: "[需求描述]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~auto 委托执行

## Execution Flow

### Round 1: Evaluation
```yaml
1. Force ROUTING_LEVEL = R3
2. → skill:workflow-router — full requirement evaluation
   - Score all 4 dimensions
   - Clarify insufficient dimensions (per EVAL_MODE)
3. Evaluation complete → output confirmation:
   Options:
     1. 全自动执行（推荐）— auto-complete all stages, pause only on risk
     2. 交互式执行 — wait for confirmation at decision points
     3. 改需求后再执行
4. ⛔ STOP, wait for user reply
```

### Round 2: Execution
```yaml
User confirms:
  Option 1 → WORKFLOW_MODE = DELEGATED
  Option 2 → WORKFLOW_MODE = INTERACTIVE
  Option 3 → back to Round 1

Execute stage chain:
  → skill:workflow-design (context collection + multi-proposal comparison)
  → skill:workflow-develop (task execution + verification + archival)

DELEGATED behavior:
  - Auto-advance between stages
  - Auto-select recommended options within stages
  - Still executes: all verification steps, EHRB checks, acceptance criteria
  - Interrupt on: EHRB risk, blocking test failure, unresolvable error
    → DELEGATION_INTERRUPTED = true → ask user → resume or switch to INTERACTIVE
```

### Completion
```yaml
Output verification report:
  - Changes summary
  - Test results
  - KB sync status
  - File changes list
→ full state reset
```

## Quality Assurance
```yaml
Sub-agent stability: 2 consecutive timeouts → main agent direct mode
DELEGATED does NOT skip: step 9 acceptance, EHRB checks, package validation
EHRB detection: always active regardless of mode
```

## Constraints
DO: Complete evaluation before execution. Run all verification steps.
DO NOT: Skip confirmation. Execute without EHRB. Skip acceptance in DELEGATED mode.

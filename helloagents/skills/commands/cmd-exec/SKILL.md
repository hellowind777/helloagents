---
name: cmd-exec
description: >
  Execute existing plan package (~exec). Skips evaluation and design,
  goes directly to development execution.
provides: [plan-execution]
category: command
trigger:
  auto: false
requires: [workflow-develop, memory]
user-invocable: true
argument-hint: "[方案包名称]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~exec 执行命令

## Execution Flow

### Step 1: Requirement Understanding
```yaml
1. Parse ~exec [package_name_or_description]
2. EHRB detection (no scoring, no clarification)
3. Set STAGE_ENTRY_MODE = DIRECT
4. Default WORKFLOW_MODE = INTERACTIVE
```

### Step 2: Package Selection
```yaml
Scan {KB_ROOT}/plan/ for available packages:
  - List packages with status from .status.json
  - If package_name specified → match and confirm
  - If no name → present list for user selection
  - No packages found → suggest ~plan

Package validation:
  - proposal.md + tasks.md must exist and be non-empty
  - Overview type → archive directly (no code execution)
  - validate_package.py must pass
```

### Step 3: Execute
```yaml
Set CURRENT_PACKAGE = selected package
→ skill:workflow-develop (DIRECT entry mode)
  - Step 1: Read package
  - Step 2: Assess TASK_COMPLEXITY
  - Step 3-15: Normal develop flow
```

### Step 4: Completion
```yaml
Output:
  - Execution results
  - Test/verification status
  - Legacy package scan results
→ full state reset
```

## Rollback Support
```yaml
If execution fails critically:
  - Preserve package in plan/ (don't archive failed packages)
  - Report failure details
  - Suggest: fix issues and re-run ~exec, or ~rollback
```

## Constraints
DO: Validate package before execution. Check EHRB. Support rollback.
DO NOT: Score requirements. Enter DESIGN stage. Execute overview packages.

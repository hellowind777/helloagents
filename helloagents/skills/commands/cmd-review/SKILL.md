---
name: cmd-review
description: >
  Code review command (~review). Triggers structured code review
  with security, quality, and performance analysis.
provides: [review-command]
category: command
trigger:
  auto: false
requires: [workflow-review]
user-invocable: true
argument-hint: "[file or module]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~review 代码审查

## Execution Flow
```yaml
1. EHRB detection (lightweight gate)
2. Determine review scope:
   - Specific files → targeted review
   - No scope → review recent git changes
3. → skill:workflow-review for structured analysis
4. Output: review report with classified issues
   - If optimization needed → offer to create optimization package
```

## Constraints
DO: Prioritize security findings. Classify by severity.
DO NOT: Review unchanged code for style. Generate false positives.

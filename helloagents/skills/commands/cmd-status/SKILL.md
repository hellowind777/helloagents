---
name: cmd-status
description: >
  Show project status (~status). Displays active packages,
  KB health, and recent changes.
provides: [status-display]
category: command
trigger:
  auto: false
requires: [memory]
user-invocable: true
argument-hint: ""
metadata:
  author: helloagents
  version: "3.0"
---

# ~status 状态查看

## Execution Flow
```yaml
1. Scan {KB_ROOT}/plan/ for active packages
   - Show each package: name, status, progress percentage
2. Check KB health (if exists):
   - Last updated, module count, CHANGELOG entries
3. Show recent git changes (last 5 commits)
4. Output: formatted status report
```

## Constraints
DO: Show actionable information. Include package progress.
DO NOT: Modify any files. Run expensive scans.

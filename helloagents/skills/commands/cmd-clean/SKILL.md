---
name: cmd-clean
description: >
  Cleanup command (~clean). Removes caches, stale packages,
  and temporary files. Also handles ~cleanplan sub-command.
provides: [cleanup]
category: command
trigger:
  auto: false
requires: [memory]
user-invocable: true
argument-hint: "[plan|cache|all]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~clean 清理命令

## Execution Flow
```yaml
1. Determine scope:
   ~clean plan (or ~cleanplan): clean stale plan packages
   ~clean cache: clean __pycache__, .update_cache
   ~clean all: both plan + cache
   ~clean (no args): show options → ⛔ STOP

2. For plan cleanup:
   - Scan plan/ for completed/stale packages (>7 days)
   - List candidates for removal
   - Confirm with user → ⛔ STOP
   - User confirms → archive or delete

3. For cache cleanup:
   - Remove __pycache__ directories
   - Clear .update_cache
   - Report cleaned items

4. Output: cleanup summary
```

## Constraints
DO: Confirm before deleting plan packages. Show what will be removed.
DO NOT: Delete active (in_progress) packages. Remove user/ content.

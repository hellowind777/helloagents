---
name: cmd-commit
description: >
  Smart commit command (~commit). Analyzes changes, generates
  bilingual commit message, runs pre-commit checks.
provides: [smart-commit]
category: command
trigger:
  auto: false
requires: [ehrb]
user-invocable: true
argument-hint: "[-m 'message']"
metadata:
  author: helloagents
  version: "3.0"
---

# ~commit 智能提交

## Execution Flow
```yaml
1. EHRB check on staged changes (secrets, .env files)
2. Analyze changes: git diff --staged
3. Generate commit message:
   - Conventional commits format (feat/fix/refactor/docs/test/chore)
   - BILINGUAL_COMMIT=1: Chinese + English
   - BILINGUAL_COMMIT=0: OUTPUT_LANGUAGE only
4. Present message for user confirmation → ⛔ STOP
5. User confirms → git commit
6. Output: commit hash + summary
```

## Constraints
DO: Check for secrets before commit. Use conventional commits format.
DO NOT: Auto-commit without confirmation. Include .env or credential files.

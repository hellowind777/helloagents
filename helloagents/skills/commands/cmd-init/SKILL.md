---
name: cmd-init
description: >
  Initialize or upgrade project knowledge base (~init).
  Creates KB structure, scans project, fills documentation.
provides: [kb-initialization]
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

# ~init 知识库初始化

## Execution Flow
```yaml
1. Check {CWD}/.helloagents/ existence
   - Exists: offer upgrade/validate options
   - Not exists: proceed with creation
2. Confirm with user → ⛔ STOP
3. User confirms → execute:
   - Scan project structure (config files, directory tree, git history)
   - Create KB structure (INDEX.md, context.md, modules/)
   - Fill documentation from project analysis
   - Verify completeness
4. Output: creation summary + file list
```

## Constraints
DO: Scan project before filling docs. Verify completeness after creation.
DO NOT: Overwrite existing user content. Create KB when KB_CREATE_MODE=0.

---
name: cmd-init
description: >
  Initialize or upgrade project knowledge base (~init).
  Creates KB structure, scans project, fills documentation.
  Also handles ~upgradekb and ~validatekb as sub-functions.
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
1. Check {KB_ROOT}/ existence
   - Exists: offer upgrade/validate options
   - Not exists: proceed with creation
2. Confirm with user → ⛔ STOP
3. User confirms → execute:
   - Run upgrade_wiki.py --init
   - Scan project structure (config files, directory tree)
   - Fill INDEX.md, context.md, modules/
   - Verify completeness
4. Output: creation summary + file list

Sub-functions:
  ~upgradekb: detect kb_version → auto-upgrade structure → fill missing files
  ~validatekb: check structure → compare code vs docs → report issues
```

## Constraints
DO: Scan project before filling docs. Verify completeness after creation.
DO NOT: Overwrite existing user content. Create KB when KB_CREATE_MODE=0.

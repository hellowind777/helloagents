---
name: cmd-rlm
description: >
  Sub-agent management command (~rlm). Spawn, list, and manage
  RLM (Role-based Language Model) sub-agents.
provides: [subagent-management]
category: command
trigger:
  auto: false
requires: [bridge-subagent]
user-invocable: true
argument-hint: "[spawn <role> | list | stop <id>]"
metadata:
  author: helloagents
  version: "3.0"
---

# ~rlm 子代理管理

## Sub-commands

### ~rlm spawn <role> [task]
```yaml
Available roles: brainstormer, reviewer, writer
Flow:
  1. Load role skill (→ skill:role-{role})
  2. Construct sub-agent prompt with task + context + OUTPUT_LANGUAGE
  3. Dispatch via CLI-appropriate channel (→ skill:bridge-subagent)
  4. Return results
```

### ~rlm list
```yaml
Show active sub-agent sessions (if CLI supports tracking)
```

### ~rlm (no args)
```yaml
Show available roles and usage
```

## Constraints
DO: Use appropriate CLI channel for dispatch. Include context in prompts.
DO NOT: Spawn roles not in the available list. Skip OUTPUT_LANGUAGE propagation.

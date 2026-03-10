---
name: bridge-subagent
description: >
  Sub-agent orchestration protocol — dispatch, coordination, and fallback
  across different CLI environments (Claude Code, Codex, others).
provides: [agent-orchestration, parallel-execution]
category: integration
trigger:
  auto: false
requires: []
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 2000
---

# Sub-Agent Bridge

## Overview
Unified sub-agent dispatch protocol that adapts to each CLI's native capabilities.

## CLI Dispatch Channels
```yaml
Claude Code:
  tool: Agent (subagent_type parameter)
  types: ha-brainstormer, ha-reviewer, ha-writer, Explore, Plan, general-purpose
  parallel: multiple Agent calls in single message
  isolation: worktree option for isolated repo copy

Codex CLI:
  tool: spawn_agent (Collab API)
  types: configured in config.toml [agents.*] sections
  parallel: CSV batch processing (CSV_BATCH_MAX parameter)
  approval: parent→child auto-propagation

Other CLIs (Gemini, Qwen, Grok, OpenCode):
  fallback: main agent direct execution
  no native sub-agent support
  mark: [降级执行] in tasks.md
```

## Dispatch Protocol
```yaml
1. Check task independence (DAG dependency resolution)
2. Group independent tasks for parallel dispatch (≤6/batch)
3. For each task:
   - Construct prompt: task description + context + OUTPUT_LANGUAGE
   - Include "[跳过指令]" marker (sub-agents skip routing)
   - Select appropriate agent type based on task nature
4. Collect results, handle failures
```

## Parallel Execution
```yaml
DAG scheduling:
  - Topological sort of tasks by depends_on
  - Execute all tasks with satisfied dependencies in parallel
  - Wait for batch completion before next wave

Batch limits:
  Claude Code: ≤6 concurrent Agent calls
  Codex CLI: CSV_BATCH_MAX (default 16, max 64)
  Others: sequential (no parallelism)
```

## Failure Handling
```yaml
timeout: 2 consecutive timeouts → switch to main agent direct mode
error: log error → retry once → if still fails → main agent takes over
degradation: mark [降级执行] in tasks.md, continue execution
```

## Role Mapping
```yaml
brainstormer: proposal generation (→ skill:role-brainstormer)
reviewer: code review (→ skill:role-reviewer)
writer: document generation (→ skill:role-writer)
user-defined: match task description to user agent descriptions
  conflict: user agent > RLM role (user intent > system preset)
```

## Constraints
DO: Use native CLI tools when available. Propagate OUTPUT_LANGUAGE. Handle failures gracefully.
DO NOT: Assume sub-agent availability. Skip fallback to main agent. Let sub-agents access L0 memory.


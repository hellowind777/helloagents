---
name: workflow-review
description: >
  Code review workflow — quality inspection, security analysis,
  and optimization suggestions. Triggered by ~review command.
provides: [code-review, quality-audit]
category: workflow
trigger:
  auto: false
requires: [ehrb, memory]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 1200
---

# Code Review Workflow

## Overview
Structured code review process with security, quality, and performance analysis.

## Trigger
- ~review command (via cmd-review skill)
- Post-development verification (optional)

## Review Process
```yaml
1. Scope determination:
   - Specific files/modules mentioned → targeted review
   - No scope specified → review recent changes (git diff)
   - Full project → incremental review by module

2. Analysis layers:
   - Security: → skill:ehrb (full 3-layer check on code changes)
   - Quality: code style, complexity, duplication, naming
   - Performance: algorithmic efficiency, resource usage, N+1 queries
   - Architecture: separation of concerns, dependency direction, coupling

3. Issue classification:
   - Critical: security vulnerabilities, data loss risks, breaking changes
   - Warning: code smells, performance concerns, missing tests
   - Info: style suggestions, documentation gaps, minor improvements

4. Output: structured review report with actionable items
```

## Sub-Agent Review
```yaml
For large reviews: spawn reviewer sub-agent (→ skill:role-reviewer)
  - Receives file list + project context
  - Returns structured findings
  - Main agent synthesizes and presents
```

## Constraints
DO: Check security first. Classify issues by severity. Provide actionable fixes.
DO NOT: Nitpick style in unchanged code. Generate false positives on framework patterns.

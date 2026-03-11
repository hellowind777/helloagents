---
name: workflow-develop
description: >
  Development execution stage — task execution, verification, KB sync, and archival.
  Loaded after DESIGN completes.
provides: [code-implementation, test-verification, delivery-acceptance]
category: workflow
trigger:
  auto: false
requires: [workflow-router, memory]
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 2500
---

# DEVELOP Stage

Entry: NATURAL (from DESIGN) or DIRECT (~exec with user-selected package).
Exit: verified delivery + archived package.

## Goals
1. Execute plan package tasks in dependency order
2. Verify results (tests, lint, security)
3. Sync knowledge base if applicable
4. Archive completed package

## Task Execution
- Read proposal.md for approach context
- Execute tasks from tasks.md respecting `depends_on` dependencies
- Independent tasks can run in parallel via sub-agents (→ skill:bridge-subagent)
- Track progress in .status.json
- Sub-agent failure → main agent direct execution

## Verification
- EHRB security check on all changes (→ skill:ehrb)
- Run appropriate verification for the task scope (lint, tests, build)
- Scale verification depth to task complexity — simple tasks need less, complex tasks need more

## Acceptance (never skip)
All tasks must pass acceptance before proceeding. Blocking failures must be fixed.
DELEGATED mode: blocking failure → interrupt delegation → ask user.

## KB Sync
If KB exists and not skipped: update relevant module docs, append CHANGELOG entry, verify consistency. (→ skill:memory)

## Package Archival
Move completed package from `plan/` to `archive/{YYYY-MM}/`. This is non-skippable — main agent must complete if sub-agent fails. Report any stale packages in `plan/`.

## Constraints
DO: Execute in dependency order. Run acceptance. Archive package. Sync KB if applicable.
DO NOT: Skip acceptance. Leave packages in plan/. Execute overview-only packages.

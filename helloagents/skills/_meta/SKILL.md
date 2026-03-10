---
name: _meta
description: >
  HelloAGENTS capability discovery and orchestration protocol.
  Defines how skills are found, loaded, and composed.
category: core
trigger:
  auto: false
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 1500
---

# Capability Discovery Protocol

## Skill Loading

Skills are SKILL.md files in ~/.helloagents/skills/ subdirectories.
Each has YAML frontmatter (name, description, provides, category, trigger, requires) and a markdown body.

### Loading Rules
- Read frontmatter first (cheap). Load body only when skill is needed.
- `requires: [dep1, dep2]` → load dependencies before this skill.
- Circular dependencies are forbidden.
- Each skill is self-contained — all content is in its body.

### Discovery Order
1. `~command` input → `skills/commands/cmd-{name}/SKILL.md`
2. `trigger.auto: true` skills → match description against current task
3. Explicit `→ skill:{name}` references from other skills

### Skill Resolution
- User skills (user/commands/) > project skills ({CWD}/.helloagents/skills/) > built-in skills
- Same name: higher priority wins
- Third-party: use vendor prefix (e.g., `superpowers-tdd`)

## Capability Graph

Skills declare capabilities via `provides` and dependencies via `requires` in frontmatter:
```yaml
provides: [solution-design, multi-proposal-comparison]
requires: [workflow-router, memory]
```

### Graph Construction
When scanning all skill frontmatter:
1. Read `provides` and `requires` from each skill
2. Build capability map: capability name → list of skills providing it
3. Resolve dependencies: `requires` can reference skill names or capability names
4. Priority: user skill > project skill > HelloAGENTS skill > third-party skill

### Automatic Discovery
When a task needs a capability (e.g., `test-generation`):
- Search the capability map for providers
- Load the highest-priority provider
- Third-party skills only need `provides: [test-generation]` to integrate

## Config Defaults
```yaml
OUTPUT_LANGUAGE: zh-CN
ENCODING: UTF-8
KB_CREATE_MODE: 2
BILINGUAL_COMMIT: 1
EVAL_MODE: 1
UPDATE_CHECK: 72
```
Override via: {CWD}/.helloagents/config.json > ~/.helloagents/config.json > defaults

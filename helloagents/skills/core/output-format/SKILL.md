---
name: output-format
description: >
  Output quality constraints for HelloAGENTS responses.
  Defines quality boundaries, not templates. AI chooses format freely.
provides: [output-formatting]
category: core
trigger:
  auto: false
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 500
---

# Output Constraints

## Quality Boundaries
```yaml
clarity: output should be clean, readable, and well-structured for the content type
conciseness: avoid redundant decoration or filler; every line should carry information
consistency: maintain coherent formatting within a single response
numbered_lists: numbers = selectable options ONLY; non-selectable lists use - bullets
sub_agents: prompt contains "[跳过指令]" → return raw results, no formatting
language: output in OUTPUT_LANGUAGE (default: zh-CN); code identifiers stay original
severity: use ⛔/⚠️/ℹ️ for blocking/warning/info when reporting issues
```

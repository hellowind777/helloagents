---
name: output-format
description: >
  Output constraints for HelloAGENTS responses.
  Defines boundaries, not templates. AI chooses format freely within constraints.
provides: [output-formatting]
category: core
trigger:
  auto: false
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 800
---

# Output Constraints

## Boundaries (what NOT to do)
```yaml
no_branding: never output brand headers like "【HelloAGENTS】", "🔄 下一步", or similar decorative wrappers
no_forced_template: no fixed format template; structure output naturally for the content
no_emoji_spam: use emoji sparingly and only when they add clarity (status indicators, warnings)
numbered_lists: numbers = selectable options ONLY; non-selectable lists use - bullets
sub_agents: prompt contains "[跳过指令]" → return raw results, no formatting
```

## Guidance (soft preferences, not rules)
```yaml
file_changes: when files are modified, summarize changes concisely at the end
streaming: during multi-step execution, output progress naturally; don't buffer for formatting
language: output in OUTPUT_LANGUAGE (default: zh-CN); code identifiers stay original
severity: use ⛔/⚠️/ℹ️ for blocking/warning/info when reporting issues
```

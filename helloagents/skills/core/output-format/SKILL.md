---
name: output-format
description: >
  Output formatting rules for HelloAGENTS responses.
  Defines G3 format wrapper, icons, status descriptions, and content structure.
  Referenced by all other skills for consistent output.
provides: [output-formatting, g3-format]
category: core
trigger:
  auto: false
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 1500
---

# Output Format

## G3 Format Template
```
{body}
📁 文件变更: {changes}          ← optional
📦 遗留方案包: {packages}       ← optional
```

## Icons
| Scene | Icon | Scene | Icon |
|-------|------|-------|------|
| Direct answer | 💡 | Waiting input | ❓ |
| Quick flow | ⚡ | Simplified flow | 📐 |
| Standard flow | 🔵 | Complete | ✅ |
| Warning | ⚠️ | Error | ❌ |
| Info | ℹ️ | Cancel | 🚫 |
| External tool | 🔧 | | |

## Rules
```yaml
scope: R1/R2/R3 completed responses and commands use G3 format; R0 outputs content directly
streaming: during multi-step execution, output content directly; wrap G3 only on completion
sub-agents: prompt contains "[跳过指令]" → skip G3 wrapper, return results only
no_header_footer: NEVER output "{icon}【HelloAGENTS】- {status}" header line or "🔄 下一步: {guidance}" footer line
file_changes: "path (op_type)", comma-separated; >5 files → "{N} files (see tasks.md)"
numbered_lists: numbers = selectable options ONLY; non-selectable lists use - bullets
```

## Scene Vocabulary
```yaml
评估: first-round scoring output (with score, may include questions)
追问: follow-up clarification round (re-score + continue asking)
确认: evaluation complete, waiting user confirmation
执行: task in progress
完成: task finished
方案设计/开发实施: specific stages in the chain
```

## Severity Mapping
| Workflow | Report Output |
|----------|--------------|
| ⛔ Blocking | Critical |
| ⚠️ Warning | Warning |
| ℹ️ Info | Info |

## Language
All output in OUTPUT_LANGUAGE (default: zh-CN). Code identifiers and technical terms stay original.
Display terms (Phase, Step) translated for user output; internal constants (DESIGN, DEVELOP) stay as-is.

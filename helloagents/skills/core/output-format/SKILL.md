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
{icon}【HelloAGENTS】- {status}
{body}
📁 文件变更: {changes}          ← optional
📦 遗留方案包: {packages}       ← optional
🔄 下一步: {guidance}
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

## Status Description Format
`{level}: {scene}` — colon separates level from current scene.
- Command: `~{cmd}: {scene}` (e.g., `~auto: 评估`)
- Generic: `{level name}: {scene}` (e.g., `标准流程: 确认`)
- Tool path: `{tool name}: {state}` (e.g., `hello-network: 执行`)
- R0: scene type only, ≤6 chars (e.g., `问候响应`)

## Rules
```yaml
scope: R1/R2/R3 completed responses and commands use G3 format; R0 direct answers output content only (no G3 wrapper)
streaming: during multi-step execution, output content directly; wrap G3 only on completion
sub-agents: prompt contains "[跳过指令]" → skip G3 wrapper, return results only
icons: MUST be emoji symbols per table above, never replace with words
status_line: ≤60 characters total (including icon and brand)
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

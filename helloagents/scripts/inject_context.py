#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS context injection — stage-aware prompt reinforcement.

UserPromptSubmit: main agent stage reminder
SubagentStart: sub-agent project context injection
"""

import sys
import json
import io
from pathlib import Path

if sys.platform == 'win32':
    for stream in ('stdout', 'stderr', 'stdin'):
        s = getattr(sys, stream)
        if hasattr(s, 'buffer'):
            setattr(sys, stream, io.TextIOWrapper(s.buffer, encoding='utf-8', errors='replace'))

MAX_MAIN_CHARS = 20000
MAX_SUB_CHARS = 15000

DEVELOP_REMINDER = """[HelloAGENTS DEVELOP stage]
Read CURRENT_PACKAGE tasks.md + proposal.md → execute tasks in dependency order.
Independent tasks → parallel sub-agents (→ skill:bridge-subagent).
Verify → acceptance → KB sync → archive package.
DO NOT: skip acceptance | leave packages in plan/"""

DESIGN_REMINDER = """[HelloAGENTS DESIGN stage]
Collect project context → assess complexity → design solution(s).
R3: multi-proposal comparison (→ skill:role-brainstormer).
Create validated plan package (proposal.md + tasks.md).
DO NOT: skip context collection | skip package validation"""

GENERIC_REMINDER = """[HelloAGENTS workflow]
Route: R0 direct | R1 quick | R2 simplified | R3 standard (→ skill:workflow-router)
R2/R3 chain: DESIGN → DEVELOP → KB sync → done
Independent tasks → parallel sub-agents (→ skill:bridge-subagent)"""


def _detect_stage(cwd: str) -> str:
    plan_dir = Path(cwd) / ".helloagents" / "plan"
    if not plan_dir.is_dir():
        return ""
    pkg_dirs = sorted((d for d in plan_dir.iterdir() if d.is_dir()), key=lambda d: d.name)
    if not pkg_dirs:
        return ""
    latest = pkg_dirs[-1]
    if (latest / "tasks.md").is_file() and (latest / "proposal.md").is_file():
        return "DEVELOP"
    if (latest / "proposal.md").is_file():
        return "DESIGN"
    return ""


def _handle_user_prompt(cwd: str) -> dict:
    stage = _detect_stage(cwd)
    ctx = {"DEVELOP": DEVELOP_REMINDER, "DESIGN": DESIGN_REMINDER}.get(stage, GENERIC_REMINDER)
    if len(ctx) > MAX_MAIN_CHARS:
        ctx = ctx[:MAX_MAIN_CHARS] + "\n...(truncated)"
    return {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}}


def _handle_subagent(cwd: str) -> dict:
    ha_dir = Path(cwd) / ".helloagents"
    if not ha_dir.is_dir():
        return {}
    parts = []
    for name, label, limit in [("context.md", "项目上下文", 4000),
                                ("guidelines.md", "技术指南", 3000)]:
        f = ha_dir / name
        if f.is_file():
            try:
                t = f.read_text(encoding="utf-8").strip()
                if t:
                    parts.append(f"## {label}\n{t[:limit]}")
            except (OSError, UnicodeDecodeError):
                pass
    plan_dir = ha_dir / "plan"
    if plan_dir.is_dir():
        pkg_dirs = sorted((d for d in plan_dir.iterdir() if d.is_dir()), key=lambda d: d.name)
        if pkg_dirs:
            pkg = pkg_dirs[-1]
            for name, label, limit in [("proposal.md", f"当前方案 ({pkg.name})", 6000),
                                        ("tasks.md", "任务清单", 1500)]:
                f = pkg / name
                if f.is_file():
                    try:
                        t = f.read_text(encoding="utf-8").strip()
                        if t:
                            parts.append(f"## {label}\n{t[:limit]}")
                    except (OSError, UnicodeDecodeError):
                        pass
    if not parts:
        return {}
    combined = "\n\n".join(parts)
    if len(combined) > MAX_SUB_CHARS:
        combined = combined[:MAX_SUB_CHARS] + "\n...(truncated)"
    return {"hookSpecificOutput": {"hookEventName": "SubagentStart",
            "additionalContext": f"[HelloAGENTS] 方案包上下文:\n{combined}"}}


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    event = {"BeforeAgent": "UserPromptSubmit"}.get(
        data.get("hookEventName", ""), data.get("hookEventName", ""))
    cwd = data.get("cwd", ".")
    result = (_handle_user_prompt(cwd) if event == "UserPromptSubmit"
              else _handle_subagent(cwd) if event == "SubagentStart" else None)
    if result:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS 双向上下文注入脚本（阶段感知版）

UserPromptSubmit: 主代理规则强化（阶段感知）
SubagentStart: 子代理上下文注入（方案包上下文）
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

DEVELOP_RULES = """[HelloAGENTS DEVELOP 阶段执行提醒]
1. 加载 stages/develop.md + services/package.md（G7）
2. 读取 CURRENT_PACKAGE 的 tasks.md 和 proposal.md
3. 按任务清单逐项执行，moderate/complex 编排子代理（G9）
4. 每个任务完成后更新 tasks.md 状态符号
5. 安全质量检查 → 测试验证 → 功能验收 → KB同步 → 方案包归档
DO NOT: 跳过模块加载 | 跳过子代理编排 | 跳过功能验收"""

DESIGN_RULES = """[HelloAGENTS DESIGN 阶段执行提醒]
Phase1: 上下文收集 → 项目扫描 → 复杂度评估 → KB_SKIPPED 判定
Phase2: 方案构思 → 方案包生成 → validate_package.py 验收
完成后: CURRENT_STAGE=DEVELOP → 按 G7 加载 develop.md
DO NOT: 跳过 Phase1 | 跳过方案包验收"""

GENERIC_RULES = """[HelloAGENTS 核心流程提醒]
- G4: R0 直接响应 | R1 快速流程 | R2 简化流程 | R3 标准流程
- G5: 评估→确认→DESIGN→DEVELOP→KB同步→完成（每阶段加载模块 G7）
- G9: ≥2个独立工作单元时编排子代理并行执行"""


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
    ctx = {"DEVELOP": DEVELOP_RULES, "DESIGN": DESIGN_RULES}.get(stage, GENERIC_RULES)
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
            "additionalContext": f"[HelloAGENTS] 方案包上下文（自动注入）:\n{combined}"}}


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

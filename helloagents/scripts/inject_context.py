#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 双向上下文注入脚本

通过 Claude Code Hooks 实现两个方向的上下文注入:
- UserPromptSubmit: 主代理规则强化（CLAUDE.md 关键规则摘要注入）
- SubagentStart: 子代理上下文注入（方案包上下文）

输入(stdin): JSON，包含 hookEventName 字段
输出(stdout): JSON，包含 hookSpecificOutput
"""

import sys
import json
import re
import io
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# 限制注入内容大小，避免 token 膨胀
MAX_MAIN_AGENT_CHARS = 2000
MAX_SUBAGENT_CHARS = 4000


def extract_critical_rules(content: str) -> str:
    """从 CLAUDE.md / AGENTS.md 提取 CRITICAL 标记的规则段和核心流程入口。"""
    lines = content.split("\n")
    critical_sections = []
    in_critical = False
    current_block = []

    for line in lines:
        # 检测 CRITICAL 标记
        if "CRITICAL" in line.upper():
            in_critical = True
            current_block = [line]
            continue

        if in_critical:
            # 遇到同级或更高级标题时结束当前块
            if re.match(r"^#{1,3}\s", line) and current_block:
                critical_sections.append("\n".join(current_block))
                current_block = []
                in_critical = False
            else:
                current_block.append(line)

    # 收尾
    if current_block:
        critical_sections.append("\n".join(current_block))

    result = "\n---\n".join(critical_sections)

    # 截断到限制长度
    if len(result) > MAX_MAIN_AGENT_CHARS:
        result = result[:MAX_MAIN_AGENT_CHARS] + "\n...(已截断)"

    return result


def handle_user_prompt_submit(cwd: str) -> dict:
    """
    路径1: UserPromptSubmit — 主代理规则强化

    读取 cwd 下的 CLAUDE.md 或 AGENTS.md，提取 CRITICAL 规则摘要注入。
    解决 compact 后规则丢失、长对话中 agent 行为漂移的问题。
    """
    cwd_path = Path(cwd)

    # 按优先级查找规则文件
    rule_file = None
    for name in ("CLAUDE.md", "AGENTS.md"):
        candidate = cwd_path / name
        if candidate.is_file():
            rule_file = candidate
            break

    if not rule_file:
        return {}

    try:
        content = rule_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}

    summary = extract_critical_rules(content)
    if not summary.strip():
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                f"[HelloAGENTS] 规则提醒（来自 {rule_file.name}）:\n{summary}"
            ),
        }
    }


def handle_subagent_start(cwd: str) -> dict:
    """
    路径2: SubagentStart — 子代理上下文注入

    读取 .helloagents/ 下的方案包上下文（proposal.md + tasks.md + context.md），
    组装为结构化上下文字符串注入子代理。
    """
    ha_dir = Path(cwd) / ".helloagents"
    if not ha_dir.is_dir():
        return {}

    parts = []

    # 1. 读取 context.md（项目上下文摘要）
    context_file = ha_dir / "context.md"
    if context_file.is_file():
        try:
            ctx = context_file.read_text(encoding="utf-8").strip()
            if ctx:
                parts.append(f"## 项目上下文\n{ctx[:1000]}")
        except (OSError, UnicodeDecodeError):
            pass

    # 1.5 读取 guidelines.md（项目技术指南，开发前注入）
    guidelines_file = ha_dir / "guidelines.md"
    if guidelines_file.is_file():
        try:
            gl = guidelines_file.read_text(encoding="utf-8").strip()
            if gl:
                parts.append(f"## 技术指南\n{gl[:1000]}")
        except (OSError, UnicodeDecodeError):
            pass

    # 2. 读取 plan/ 下当前方案包
    plan_dir = ha_dir / "plan"
    if plan_dir.is_dir():
        # 找最新的方案包目录（按名称排序，最新在后）
        pkg_dirs = sorted(
            [d for d in plan_dir.iterdir() if d.is_dir()],
            key=lambda d: d.name,
        )
        if pkg_dirs:
            latest_pkg = pkg_dirs[-1]
            # 读取 proposal.md
            proposal = latest_pkg / "proposal.md"
            if proposal.is_file():
                try:
                    text = proposal.read_text(encoding="utf-8").strip()
                    if text:
                        parts.append(f"## 当前方案 ({latest_pkg.name})\n{text[:1500]}")
                except (OSError, UnicodeDecodeError):
                    pass

            # 读取 tasks.md
            tasks = latest_pkg / "tasks.md"
            if tasks.is_file():
                try:
                    text = tasks.read_text(encoding="utf-8").strip()
                    if text:
                        parts.append(f"## 任务清单\n{text[:1000]}")
                except (OSError, UnicodeDecodeError):
                    pass

    if not parts:
        return {}

    combined = "\n\n".join(parts)
    if len(combined) > MAX_SUBAGENT_CHARS:
        combined = combined[:MAX_SUBAGENT_CHARS] + "\n...(已截断)"

    return {
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": (
                f"[HelloAGENTS] 方案包上下文（自动注入）:\n{combined}"
            ),
        }
    }


def main():
    """主入口: 从 stdin 读取 hook 事件 JSON，按 hookEventName 分发处理。"""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    event = data.get("hookEventName", "")
    cwd = data.get("cwd", ".")

    if event == "UserPromptSubmit":
        result = handle_user_prompt_submit(cwd)
    elif event == "SubagentStart":
        result = handle_subagent_start(cwd)
    else:
        sys.exit(0)

    if result:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
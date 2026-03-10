#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS TeammateIdle Hook — Agent Teams 空闲检测

Agent Teams 中 teammate 即将空闲时触发（async=true）。
检查共享任务列表是否有可认领的任务，如有则通过 additionalContext
通知 teammate。

前提: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 + hellotasks=<list_id>

输入(stdin): JSON，包含 cwd 等字段
输出(stdout): JSON hookSpecificOutput（有待认领任务时）
"""

import sys
import io
import json
import os
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')


def _get_task_manager(cwd: str):
    """懒加载 SharedTasksManager。"""
    try:
        scripts_dir = Path(__file__).resolve().parent
        pkg_dir = scripts_dir.parent
        if str(pkg_dir) not in sys.path:
            sys.path.insert(0, str(pkg_dir))
        if str(pkg_dir.parent) not in sys.path:
            sys.path.insert(0, str(pkg_dir.parent))

        from rlm.shared_tasks import SharedTasksManager
        return SharedTasksManager(project_root=Path(cwd))
    except Exception:
        return None


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    cwd = data.get("cwd", ".")

    # 非协作模式直接退出
    if not os.environ.get("hellotasks"):
        sys.exit(0)

    manager = _get_task_manager(cwd)
    if not manager or not manager.is_collaborative:
        sys.exit(0)

    available = manager.get_available_tasks()
    if not available:
        sys.exit(0)

    # 构建任务列表摘要
    lines = ["[HelloAGENTS] 共享任务列表中有待认领的任务:"]
    for task in available[:5]:  # 最多显示 5 个
        tid = task.get("id", "?")
        subject = task.get("subject", "")[:60]
        lines.append(f"  - {tid}: {subject}")

    if len(available) > 5:
        lines.append(f"  ... 还有 {len(available) - 5} 个任务")

    lines.append("")
    lines.append("使用 SharedTasksManager.claim_task(task_id, owner) 认领任务。")

    result = {
        "hookSpecificOutput": {
            "hookEventName": "TeammateIdle",
            "additionalContext": "\n".join(lines),
        }
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

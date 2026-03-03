#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS PreCompact Hook — 上下文压缩前进度快照

上下文压缩前触发（async=false，必须同步完成）。
保存当前任务进度快照到 tasks.md，确保压缩后 AI 能从断点恢复。

输入(stdin): JSON，包含 cwd 等字段
输出(stdout): 无
"""

import sys
import io
import json
import re
from datetime import datetime
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')


_LS_BEGIN = "<!-- LIVE_STATUS_BEGIN -->"
_LS_END = "<!-- LIVE_STATUS_END -->"


def _find_latest_tasks_md(cwd: str) -> Path | None:
    """查找最新方案包的 tasks.md。"""
    plan_dir = Path(cwd) / ".helloagents" / "plan"
    if not plan_dir.is_dir():
        return None
    pkg_dirs = sorted(
        [d for d in plan_dir.iterdir() if d.is_dir()],
        key=lambda d: d.name,
    )
    if not pkg_dirs:
        return None
    tasks = pkg_dirs[-1] / "tasks.md"
    return tasks if tasks.is_file() else None


def _parse_task_stats(content: str) -> dict:
    """解析 tasks.md 中的任务状态符号。"""
    completed = len(re.findall(r'\[√\]', content))
    failed = len(re.findall(r'\[X\]', content))
    skipped = len(re.findall(r'\[-\]', content))
    pending = len(re.findall(r'\[ \]', content))
    uncertain = len(re.findall(r'\[\?\]', content))
    total = completed + failed + skipped + pending + uncertain
    return {
        "completed": completed,
        "failed": failed,
        "skipped": skipped,
        "pending": pending,
        "uncertain": uncertain,
        "total": total,
    }


def _determine_status(stats: dict) -> str:
    """根据任务统计确定整体状态。"""
    if stats["total"] == 0:
        return "pending"
    if stats["failed"] > 0:
        return "failed"
    if stats["pending"] == 0 and stats["uncertain"] == 0:
        return "completed"
    if stats["completed"] > 0 or stats["failed"] > 0:
        return "in_progress"
    return "pending"


def _update_live_status(content: str, stats: dict) -> str:
    """更新 LIVE_STATUS 区域（与 progress_snapshot.py 逻辑一致）。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    done = stats["completed"] + stats["skipped"]
    total = stats["total"]
    pct = round(done / total * 100) if total > 0 else 0
    status = _determine_status(stats)

    current = "-"
    for line in content.splitlines():
        if "[ ]" in line:
            desc = re.sub(r'^\s*\d+\.\s*\[ \]\s*', '', line).strip()
            if desc:
                current = desc[:60]
            break

    new_status = (
        f"{_LS_BEGIN}\n"
        f"状态: {status} | 进度: {done}/{total} ({pct}%) | 更新: {now}\n"
        f"当前: {current}\n"
        f"{_LS_END}"
    )

    begin_idx = content.find(_LS_BEGIN)
    end_idx = content.find(_LS_END)
    if begin_idx >= 0 and end_idx >= 0:
        return content[:begin_idx] + new_status + content[end_idx + len(_LS_END):]
    return new_status + "\n\n" + content


def _append_compact_log(content: str, stats: dict) -> str:
    """追加 PreCompact 快照记录到执行日志。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    done = stats["completed"] + stats["skipped"]
    total = stats["total"]
    pct = round(done / total * 100) if total > 0 else 0

    log_entry = (
        f"| {now} | PreCompact快照 | "
        f"完成:{stats['completed']} 失败:{stats['failed']} "
        f"跳过:{stats['skipped']} 待做:{stats['pending']} "
        f"({pct}%) |"
    )

    log_header = "## 执行日志"
    log_table_header = "| 时间 | 事件 | 详情 |\n|------|------|------|\n"

    if log_header in content:
        idx = content.index(log_header)
        after = content[idx:]

        log_lines = []
        for line in after.split("\n"):
            if line.startswith("|") and "时间" not in line and "------" not in line:
                log_lines.append(line)

        log_lines = log_lines[-4:]
        log_lines.append(log_entry)

        new_log = f"{log_header}\n\n{log_table_header}" + "\n".join(log_lines) + "\n"

        next_section = re.search(r'\n## (?!执行日志)', content[idx:])
        if next_section:
            end = idx + next_section.start()
            return content[:idx] + new_log + content[end:]
        return content[:idx] + new_log
    else:
        return (
            content.rstrip() + "\n\n"
            f"{log_header}\n\n{log_table_header}{log_entry}\n"
        )


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    cwd = data.get("cwd", ".")

    # 查找 tasks.md
    tasks_path = _find_latest_tasks_md(cwd)
    if not tasks_path:
        sys.exit(0)

    try:
        content = tasks_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        sys.exit(0)

    stats = _parse_task_stats(content)
    if stats["total"] == 0:
        sys.exit(0)

    # 更新 LIVE_STATUS（压缩前保存最新状态）
    content = _update_live_status(content, stats)

    # 追加 PreCompact 日志
    content = _append_compact_log(content, stats)

    # 写回
    try:
        tasks_path.write_text(content, encoding="utf-8")
    except OSError as e:
        print(f"[HelloAGENTS] pre_compact write failed: {e}",
              file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS PreCompact Hook — 上下文压缩前进度快照（同步，保存断点状态）"""

import sys
import io
import json
import re
from datetime import datetime
from pathlib import Path

if sys.platform == 'win32':
    for stream in ('stdout', 'stderr', 'stdin'):
        s = getattr(sys, stream)
        if hasattr(s, 'buffer'):
            setattr(sys, stream, io.TextIOWrapper(s.buffer, encoding='utf-8', errors='replace'))


def _find_tasks(cwd):
    plan = Path(cwd) / ".helloagents" / "plan"
    if not plan.is_dir():
        return None
    dirs = sorted((d for d in plan.iterdir() if d.is_dir()), key=lambda d: d.name)
    if not dirs:
        return None
    t = dirs[-1] / "tasks.md"
    return t if t.is_file() else None


def _parse_stats(content):
    symbols = {'√': 'completed', 'X': 'failed', '-': 'skipped', ' ': 'pending', '?': 'uncertain'}
    stats = {v: 0 for v in symbols.values()}
    for m in re.finditer(r'\[(.)\]', content):
        key = symbols.get(m.group(1))
        if key:
            stats[key] += 1
    stats['total'] = sum(stats.values())
    return stats


def _write_status(tasks_path, stats, content):
    done = stats['completed'] + stats['skipped']
    total = stats['total']
    status = ('completed' if stats['pending'] == 0 and stats['uncertain'] == 0 and stats['failed'] == 0
              else 'failed' if stats['failed'] > 0
              else 'in_progress' if done > 0 else 'pending')
    current = next((re.sub(r'^\s*[-*]\s*\[ \]\s*\d*\.?\d*\s*', '', l).strip()[:60]
                     for l in content.splitlines() if '[ ]' in l), '-')
    data = {"status": status, "completed": stats['completed'], "failed": stats['failed'],
            "skipped": stats['skipped'], "pending": stats['pending'],
            "uncertain": stats['uncertain'], "total": total, "done": done,
            "percent": round(done / total * 100) if total else 0, "current": current,
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    try:
        (tasks_path.parent / ".status.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    cwd = data.get("cwd", ".")
    tasks_path = _find_tasks(cwd)
    if not tasks_path:
        sys.exit(0)
    try:
        content = tasks_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        sys.exit(0)
    stats = _parse_stats(content)
    if stats['total'] > 0:
        _write_status(tasks_path, stats, content)


if __name__ == "__main__":
    main()

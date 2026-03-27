#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS PostToolUse Hook — 进度快照自动触发

每次 Write/Edit/NotebookEdit 操作后触发（Claude Code/Grok: async=false, Gemini: async=true）。
维护写操作计数器，每 THRESHOLD 次写操作时自动更新 tasks.md 的
LIVE_STATUS 区域和执行日志。

输入(stdin): JSON，包含 tool_name, cwd 等字段
输出(stdout): 无（async hook 不需要返回数据）
"""

import sys
import io
import json
import re
import tempfile
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

# 每 N 次写操作触发一次快照
THRESHOLD = 5

# 计数器文件目录
COUNTER_DIR = Path(tempfile.gettempdir()) / "helloagents_hooks"


# ---------------------------------------------------------------------------
# 计数器管理
# ---------------------------------------------------------------------------

def _counter_path(cwd: str) -> Path:
    """每个项目目录使用独立的计数器文件。"""
    safe_name = re.sub(r'[^a-zA-Z0-9]', '_', cwd)[:80]
    return COUNTER_DIR / f"write_count_{safe_name}.txt"


def _increment_counter(cwd: str) -> int:
    """递增计数器，返回当前值。"""
    COUNTER_DIR.mkdir(parents=True, exist_ok=True)
    path = _counter_path(cwd)
    count = 0
    if path.exists():
        try:
            count = int(path.read_text().strip())
        except (ValueError, OSError):
            count = 0
    count += 1
    try:
        path.write_text(str(count))
    except OSError:
        pass
    return count


def _reset_counter(cwd: str):
    """重置计数器。"""
    path = _counter_path(cwd)
    try:
        path.write_text("0")
    except OSError:
        pass


# ---------------------------------------------------------------------------
# 方案包检测与任务解析
# ---------------------------------------------------------------------------

# NOTE: _find_latest_tasks_md, _parse_task_stats, _determine_status 与
# pre_compact.py 中的同名函数保持一致。修改时需同步更新。

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


# ---------------------------------------------------------------------------
# .status.json 更新（取代旧的 LIVE_STATUS HTML 注释）
# ---------------------------------------------------------------------------


def _get_current_task(content: str) -> str:
    """从 tasks.md 找到当前正在执行的任务（第一个 [ ] 标记的行）。"""
    for line in content.splitlines():
        if "[ ]" in line:
            desc = re.sub(r'^\s*[-*]\s*\[ \]\s*\d*\.?\d*\s*', '', line).strip()
            if desc:
                return desc[:60]
    return "-"


def _write_status_json(tasks_path: Path, stats: dict, content: str):
    """写入 .status.json 到方案包目录。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    done = stats["completed"] + stats["skipped"]
    total = stats["total"]
    pct = round(done / total * 100) if total > 0 else 0
    status = _determine_status(stats)
    current = _get_current_task(content)

    status_data = {
        "status": status,
        "completed": stats["completed"],
        "failed": stats["failed"],
        "skipped": stats["skipped"],
        "pending": stats["pending"],
        "uncertain": stats["uncertain"],
        "total": total,
        "done": done,
        "percent": pct,
        "current": current,
        "updated_at": now,
    }

    status_path = tasks_path.parent / ".status.json"
    try:
        status_path.write_text(
            json.dumps(status_data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as e:
        print(f"[HelloAGENTS] .status.json write failed: {e}",
              file=sys.stderr)


# ---------------------------------------------------------------------------
# 执行日志追加
# ---------------------------------------------------------------------------

def _append_exec_log(content: str, stats: dict) -> str:
    """在 tasks.md 底部追加进度快照日志（保留最近 5 条）。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    done = stats["completed"] + stats["skipped"]
    total = stats["total"]
    pct = round(done / total * 100) if total > 0 else 0

    log_entry = (
        f"| {now} | 进度快照(自动) | "
        f"完成:{stats['completed']} 失败:{stats['failed']} "
        f"跳过:{stats['skipped']} 待做:{stats['pending']} "
        f"({pct}%) |"
    )

    log_header = "## 执行日志"
    log_table_header = "| 时间 | 事件 | 详情 |\n|------|------|------|\n"

    if log_header in content:
        # 找到执行日志区域
        idx = content.index(log_header)
        after = content[idx:]

        # 提取现有日志行
        log_lines = []
        for line in after.split("\n"):
            if line.startswith("|") and "时间" not in line and "------" not in line:
                log_lines.append(line)

        # 保留最近 4 条 + 新增 1 条 = 5 条
        log_lines = log_lines[-4:]
        log_lines.append(log_entry)

        # 重建日志区域
        new_log = f"{log_header}\n\n{log_table_header}" + "\n".join(log_lines) + "\n"

        # 找到日志区域结束（下一个 ## 或文件末尾）
        next_section = re.search(r'\n## (?!执行日志)', content[idx:])
        if next_section:
            end = idx + next_section.start()
            return content[:idx] + new_log + content[end:]
        return content[:idx] + new_log
    else:
        # 没有执行日志区域，追加到文件末尾
        return (
            content.rstrip() + "\n\n"
            f"{log_header}\n\n{log_table_header}{log_entry}\n"
        )


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    cwd = data.get("cwd", ".")

    # 递增计数器
    count = _increment_counter(cwd)

    # 未达阈值，直接返回
    if count % THRESHOLD != 0:
        sys.exit(0)

    # 查找 tasks.md
    tasks_path = _find_latest_tasks_md(cwd)
    if not tasks_path:
        sys.exit(0)

    try:
        content = tasks_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        sys.exit(0)

    # 解析任务统计
    stats = _parse_task_stats(content)
    if stats["total"] == 0:
        sys.exit(0)

    # 写入 .status.json（替代旧的 LIVE_STATUS HTML 注释）
    _write_status_json(tasks_path, stats, content)

    # 追加执行日志到 tasks.md
    content = _append_exec_log(content, stats)

    # 写回 tasks.md（仅执行日志部分）
    try:
        tasks_path.write_text(content, encoding="utf-8")
    except OSError as e:
        print(f"[HelloAGENTS] progress_snapshot write failed: {e}",
              file=sys.stderr)

    # 重置计数器
    _reset_counter(cwd)


if __name__ == "__main__":
    main()

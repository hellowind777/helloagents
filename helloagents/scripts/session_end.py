#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Stop/SessionEnd Hook — KB 同步标志 + 临时文件清理

Stop: 主代理完成回复时触发（async=true）
SessionEnd: 会话彻底结束时触发（async=true），额外清理临时计数器文件

通过 hookEventName 区分 Stop vs SessionEnd。

输入(stdin): JSON，包含 hookEventName, session_id, cwd 等字段
输出(stdout): 无
"""

import sys
import io
import json
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


# ---------------------------------------------------------------------------
# KB 同步标志
# ---------------------------------------------------------------------------

def _set_sync_flag(cwd: str):
    """设置 KB 同步标志，下次会话启动时 AI 可检测到。"""
    flag_dir = Path(cwd) / ".helloagents" / "user"
    try:
        flag_dir.mkdir(parents=True, exist_ok=True)
        flag_file = flag_dir / ".kb_sync_needed"
        flag_file.write_text(
            datetime.now().isoformat(),
            encoding="utf-8",
        )
    except OSError:
        pass


# ---------------------------------------------------------------------------
# SessionEnd 临时文件清理
# ---------------------------------------------------------------------------

def _cleanup_temp_counters(cwd: str) -> None:
    """删除该项目的临时计数器文件（progress_snapshot 写入的 write_count 等）。"""
    import re as _re
    import tempfile
    counter_dir = Path(tempfile.gettempdir()) / "helloagents_hooks"
    if not counter_dir.is_dir():
        return
    # 安全项目哈希（与 progress_snapshot.py 中的逻辑一致）
    safe_name = _re.sub(r'[^a-zA-Z0-9]', '_', cwd)[:80]
    for f in counter_dir.glob(f"*_{safe_name}.txt"):
        try:
            f.unlink()
        except OSError:
            pass
    # 清空空目录
    try:
        if counter_dir.is_dir() and not any(counter_dir.iterdir()):
            counter_dir.rmdir()
    except OSError:
        pass


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

    event = data.get("hookEventName", "Stop")
    cwd = data.get("cwd", ".")

    # 检查是否有 .helloagents 目录（只在 HelloAGENTS 项目中执行）
    ha_dir = Path(cwd) / ".helloagents"
    if not ha_dir.is_dir():
        sys.exit(0)

    # 设置 KB 同步标志
    _set_sync_flag(cwd)

    # SessionEnd 额外清理: 临时计数器文件
    if event == "SessionEnd":
        _cleanup_temp_counters(cwd)


if __name__ == "__main__":
    main()

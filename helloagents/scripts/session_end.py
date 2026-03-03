#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Stop/SessionEnd Hook — KB 同步标志 + L2 会话摘要写入 + 临时文件清理

Stop: 主代理完成回复时触发（async=true）
SessionEnd: 会话彻底结束时触发（async=true），额外清理临时计数器文件

通过 hookEventName 区分 Stop vs SessionEnd。

输入(stdin): JSON，包含 hookEventName, session_id, cwd 等字段
输出(stdout): 无
"""

import sys
import io
import json
import os
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

# 摘要内容上限
MAX_SUMMARY_CHARS = 300


# ---------------------------------------------------------------------------
# Session 摘要生成
# ---------------------------------------------------------------------------

def _get_session_manager():
    """懒加载 SessionManager（避免 import 失败时整个脚本崩溃）。"""
    try:
        # 添加 helloagents 包路径
        scripts_dir = Path(__file__).resolve().parent
        pkg_dir = scripts_dir.parent
        if str(pkg_dir) not in sys.path:
            sys.path.insert(0, str(pkg_dir))
        if str(pkg_dir.parent) not in sys.path:
            sys.path.insert(0, str(pkg_dir.parent))

        from rlm.session import SessionManager
        return SessionManager()
    except Exception:
        return None


def _generate_summary(session) -> str:
    """从 SessionManager 事件历史生成机械摘要。"""
    events = session.get_events(limit=30)
    if not events:
        return ""

    # 统计事件类型
    type_counts: dict[str, int] = {}
    tool_names: list[str] = []
    agent_roles: list[str] = []

    for e in events:
        etype = e.get("type", "unknown")
        type_counts[etype] = type_counts.get(etype, 0) + 1
        data = e.get("data", {})
        if etype == "tool_call":
            tool = data.get("tool", "")
            if tool and tool not in tool_names:
                tool_names.append(tool)
        elif etype == "spawn_agent":
            role = data.get("role", "")
            if role and role not in agent_roles:
                agent_roles.append(role)

    parts = []
    if type_counts:
        summary_items = [f"{k}:{v}" for k, v in type_counts.items()]
        parts.append(f"事件: {', '.join(summary_items)}")
    if agent_roles:
        parts.append(f"子代理: {', '.join(agent_roles[:5])}")
    if tool_names:
        parts.append(f"工具: {', '.join(tool_names[:8])}")

    summary = " | ".join(parts)
    if len(summary) > MAX_SUMMARY_CHARS:
        summary = summary[:MAX_SUMMARY_CHARS - 3] + "..."
    return summary


def _write_session_summary(cwd: str, session) -> bool:
    """写入会话摘要到项目 .helloagents/user/sessions/ 目录。"""
    info = session.get_session_info()
    session_id = info.get("session_id", "unknown")
    summary = _generate_summary(session)
    if not summary:
        return False

    now = datetime.now()
    content = (
        f"# Session: {session_id}\n\n"
        f"- 时间: {now.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"- 事件数: {info.get('total_events', 0)}\n"
        f"- 子代理数: {info.get('agent_count', 0)}\n"
        f"- 摘要: {summary}\n"
    )

    # 写入项目级目录
    sessions_dir = Path(cwd) / ".helloagents" / "user" / "sessions"
    try:
        sessions_dir.mkdir(parents=True, exist_ok=True)
        # 文件名使用日期+短ID，避免文件过多
        short_id = session_id.split("_")[-1] if "_" in session_id else session_id[:8]
        filename = f"{now.strftime('%Y%m%d')}_{short_id}.md"
        filepath = sessions_dir / filename
        filepath.write_text(content, encoding="utf-8")
        return True
    except OSError:
        return False


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

    # Stop 和 SessionEnd 共享: KB 同步 + 会话摘要
    session = _get_session_manager()
    if session:
        _write_session_summary(cwd, session)

    # 设置 KB 同步标志
    _set_sync_flag(cwd)

    # SessionEnd 额外清理: 临时计数器文件
    if event == "SessionEnd":
        _cleanup_temp_counters(cwd)


if __name__ == "__main__":
    main()

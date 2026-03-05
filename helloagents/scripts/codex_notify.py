#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Codex Notify Proxy — Codex CLI 通知代理

接收 Codex CLI 的 notify JSON，映射事件类型到声音事件，
播放声音通知 + 执行版本检查。

Codex CLI 调用方式:
  codex_notify.py '{"type":"agent-turn-complete","client":"codex-tui"}'

事件映射:
  agent-turn-complete → complete ("完成了~")
  approval-requested  → confirm  ("需要您确认~")

client 字段过滤（v0.107+）:
  codex-tui → 播放声音（终端用户需要提醒）
  其他值（VS Code/Xcode/任何 IDE） → 跳过声音（IDE 有自己的通知机制）
  无 client 字段 → 播放声音（向后兼容旧版 Codex）

输入(argv[1]): JSON 字符串
输出(stdout): 无
"""

import json
import subprocess
import sys
from pathlib import Path

# 事件映射: Codex notify type → sound event
EVENT_MAP = {
    "agent-turn-complete": "complete",
    "approval-requested": "confirm",
}

# 仅终端 TUI 播放声音，所有 IDE 集成（VS Code/Xcode 等）跳过
# Codex client 字段: "codex-tui" = 终端, 其他值 = IDE（有自己的通知系统）
TUI_CLIENT = "codex-tui"

# 脚本路径
SCRIPTS_DIR = Path(__file__).parent
SOUND_NOTIFY = SCRIPTS_DIR / "sound_notify.py"


def main():
    # 解析 Codex CLI 传入的 JSON 参数
    sound_event = None
    skip_sound = False
    if len(sys.argv) > 1:
        try:
            data = json.loads(sys.argv[1])
            notify_type = data.get("type", "")
            sound_event = EVENT_MAP.get(notify_type)
            # client 字段过滤: 仅 codex-tui（终端）播放，其他均为 IDE 跳过
            client = (data.get("client") or "").lower()
            if client and client != TUI_CLIENT:
                skip_sound = True
        except (json.JSONDecodeError, TypeError):
            pass

    # 播放声音（同步等待，确保声音完整播放）
    if sound_event and not skip_sound and SOUND_NOTIFY.exists():
        try:
            subprocess.run(
                [sys.executable, str(SOUND_NOTIFY), sound_event],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        except Exception:
            pass

    # 版本检查
    try:
        subprocess.run(
            ["helloagents", "--check-update", "--silent"],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            timeout=10,
        )
    except Exception:
        pass


if __name__ == "__main__":
    main()

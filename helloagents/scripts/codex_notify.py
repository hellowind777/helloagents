#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Codex Notify Proxy — Codex CLI 通知代理

接收 Codex CLI 的 notify JSON，映射事件类型到声音事件，
播放声音通知 + 执行版本检查。

Codex CLI 调用方式:
  codex_notify.py '{"type":"agent-turn-complete"}'

事件映射:
  agent-turn-complete → complete ("完成了~")
  approval-requested  → confirm  ("需要您确认~")

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

# 脚本路径
SCRIPTS_DIR = Path(__file__).parent
SOUND_NOTIFY = SCRIPTS_DIR / "sound_notify.py"


def main():
    # 解析 Codex CLI 传入的 JSON 参数
    sound_event = None
    if len(sys.argv) > 1:
        try:
            data = json.loads(sys.argv[1])
            notify_type = data.get("type", "")
            sound_event = EVENT_MAP.get(notify_type)
        except (json.JSONDecodeError, TypeError):
            pass

    # 播放声音（非阻塞 Popen）
    if sound_event and SOUND_NOTIFY.exists():
        try:
            subprocess.Popen(
                [sys.executable, str(SOUND_NOTIFY), sound_event],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            pass

    # 保留原有版本检查功能
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

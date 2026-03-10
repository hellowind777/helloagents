#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Codex Notify Proxy — G3 图标→声音路由 + 版本检查"""

import json
import subprocess
import sys
from pathlib import Path

_G3 = "\u3010HelloAGENTS\u3011"
_ICONS = {
    "warning": "\u26a0\ufe0f\u26a0",       # ⚠️⚠
    "error": "\u274c",                       # ❌
    "complete": "\u2705\U0001f4a1\u26a1\U0001f527",  # ✅💡⚡🔧
    "confirm": "\u2753\U0001f4d0",           # ❓📐
}


def _detect_sound(text):
    if not text:
        return None
    line = text.strip().split("\n")[0]
    idx = line.find(_G3)
    if idx < 0:
        return None
    icon = line[:idx].strip()
    if not icon:
        return "complete"
    for event, chars in _ICONS.items():
        if any(c in icon for c in chars):
            return event
    if "\U0001f535" in icon:  # 🔵
        return "confirm" if "\u786e\u8ba4" in line[idx + len(_G3):] else "idle"
    return "idle"


def main():
    sound, skip = None, False
    if len(sys.argv) > 1:
        try:
            data = json.loads(sys.argv[1])
            t = data.get("type", "")
            if t == "approval-requested":
                sound = "confirm"
            elif t == "agent-turn-complete":
                sound = _detect_sound(data.get("last-assistant-message", ""))
            client = (data.get("client") or "").lower()
            if client and client != "codex-tui":
                skip = True
        except (json.JSONDecodeError, TypeError):
            pass

    notify = Path(__file__).parent / "notify.py"
    if sound and not skip and notify.exists():
        try:
            subprocess.run([sys.executable, str(notify), "sound", sound],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=5)
        except Exception:
            pass
    try:
        subprocess.run(["helloagents", "--check-update", "--silent"],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=10)
    except Exception:
        pass


if __name__ == "__main__":
    main()

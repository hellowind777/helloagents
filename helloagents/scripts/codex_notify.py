#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Codex Notify Proxy — event-based sound routing + version check.

Called by Codex config.toml `notify` with JSON payload as argv[1].
"""

import json
import subprocess
import sys
from pathlib import Path


def main():
    sound, skip = None, False
    if len(sys.argv) > 1:
        try:
            data = json.loads(sys.argv[1])
            t = data.get("type", "")
            if t == "approval-requested":
                sound = "confirm"
            elif t == "agent-turn-complete":
                sound = "complete"
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
        # Desktop notification for turn completion
        if sound == "complete":
            try:
                subprocess.Popen([sys.executable, str(notify), "desktop", "任务已完成"],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
            except Exception:
                pass
    try:
        subprocess.run(["helloagents", "--check-update", "--silent"],
                       stdin=subprocess.DEVNULL, capture_output=True, timeout=10)
    except Exception:
        pass


if __name__ == "__main__":
    main()

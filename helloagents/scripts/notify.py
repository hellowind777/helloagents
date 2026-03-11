#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Notification — Desktop + sound notifications.

Sub-commands:
    python notify.py desktop [msg]    — Desktop notification
    python notify.py sound <event>    — Play sound for event
    python notify.py route            — Route Stop hook payload to sound + desktop
"""

import json
import subprocess
import sys
import io
from pathlib import Path

if sys.platform == 'win32':
    for stream_name in ('stdin', 'stdout', 'stderr'):
        stream = getattr(sys, stream_name)
        if hasattr(stream, 'buffer'):
            setattr(sys, stream_name,
                    io.TextIOWrapper(stream.buffer, encoding='utf-8', errors='replace'))

TITLE = "HelloAGENTS"
SOUND_EVENTS = ("complete", "idle", "confirm", "error", "warning")
_HA_HOME = Path.home() / ".helloagents"


# ═══════════════════════════════════════════════════════════════════════════
# Desktop notification (cross-platform)
# ═══════════════════════════════════════════════════════════════════════════

def desktop_notify(msg: str = "任务已完成"):
    """Send a desktop notification. Works on Windows/macOS/Linux."""
    if sys.platform == "win32":
        # Try Windows toast via PowerShell (built-in, no extra module needed)
        ps = (f"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, "
              f"ContentType = WindowsRuntime] > $null; "
              f"$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0); "
              f"$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('{TITLE}: {msg}')) > $null; "
              f"[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('HelloAGENTS')"
              f".Show([Windows.UI.Notifications.ToastNotification]::new($xml))")
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                               capture_output=True, timeout=5)
            if r.returncode == 0:
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        # Fallback: BurntToast module
        ps2 = f'Import-Module BurntToast -ErrorAction Stop; New-BurntToastNotification -Text "{TITLE}", "{msg}"'
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-Command", ps2],
                               capture_output=True, timeout=5)
            if r.returncode == 0:
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        # Fallback: terminal bell
        print("\a", end="", file=sys.stderr, flush=True)

    elif sys.platform == "darwin":
        try:
            subprocess.run(["osascript", "-e",
                            f'display notification "{msg}" with title "{TITLE}"'],
                           capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("\a", end="", file=sys.stderr, flush=True)

    else:  # Linux
        try:
            r = subprocess.run(["notify-send", TITLE, msg],
                               capture_output=True, timeout=5)
            if r.returncode == 0:
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        print("\a", end="", file=sys.stderr, flush=True)


# ═══════════════════════════════════════════════════════════════════════════
# Sound player
# ═══════════════════════════════════════════════════════════════════════════

def _find_sound(event: str) -> Path | None:
    wav = _HA_HOME / "user" / "sounds" / f"{event}.wav"
    return wav if wav.exists() else None


def play_sound(event: str):
    if event not in SOUND_EVENTS:
        return
    wav = _find_sound(event)
    if not wav:
        print("\a", end="", file=sys.stderr, flush=True)
        return
    try:
        if sys.platform == "win32":
            import winsound
            winsound.PlaySound(str(wav), winsound.SND_FILENAME)
        elif sys.platform == "darwin":
            subprocess.Popen(["afplay", str(wav)],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            for cmd in (["aplay", "-q"], ["paplay"]):
                try:
                    subprocess.Popen(cmd + [str(wav)],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
                except FileNotFoundError:
                    continue
            print("\a", end="", file=sys.stderr, flush=True)
    except Exception:
        print("\a", end="", file=sys.stderr, flush=True)


# ═══════════════════════════════════════════════════════════════════════════
# Sound + desktop routing (Stop hook)
# ═══════════════════════════════════════════════════════════════════════════

def _route_sound():
    """Route Stop hook payload to sound + desktop notification."""
    try:
        raw = sys.stdin.read()
    except Exception:
        return

    if not raw.strip():
        play_sound("complete")
        desktop_notify()
        return

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        play_sound("complete")
        desktop_notify()
        return

    stop_reason = data.get("stop_reason", "")
    if stop_reason == "tool_use":
        return  # Silent — tool use continuation

    play_sound("complete")
    desktop_notify()


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "desktop"
    if cmd == "desktop":
        msg = sys.argv[2] if len(sys.argv) > 2 else "任务已完成"
        try:
            sys.stdin.read()
        except Exception:
            pass
        desktop_notify(msg)
    elif cmd == "sound" and len(sys.argv) > 2:
        play_sound(sys.argv[2])
    elif cmd == "route":
        _route_sound()
    else:
        print(f"Usage: {sys.argv[0]} desktop [msg]|sound <event>|route")
        sys.exit(1)


if __name__ == "__main__":
    main()

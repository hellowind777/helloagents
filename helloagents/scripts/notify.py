#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Notification — Desktop notifications + sound routing.

Merged from: notify.py (desktop), sound_notify.py (WAV player),
stop_sound_router.py (G3 icon→sound mapping).

Sub-commands:
    python notify.py desktop          — Desktop notification (idle_prompt hook)
    python notify.py sound <event>    — Play sound for event
    python notify.py route            — Route G3 icon to sound (Stop hook, stdin)
"""

import json
import os
import re
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
# Desktop notification (idle_prompt hook)
# ═══════════════════════════════════════════════════════════════════════════

def _desktop_notify():
    """Send desktop notification that Claude Code is waiting."""
    msg = "Claude Code 正在等待您的输入"
    try:
        sys.stdin.read()
    except Exception:
        pass

    if sys.platform == "win32":
        ps = f'Import-Module BurntToast -ErrorAction Stop; New-BurntToastNotification -Text "{TITLE}", "{msg}"'
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                               capture_output=True, timeout=4)
            if r.returncode == 0:
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        print("\a", end="", file=sys.stderr, flush=True)
    elif sys.platform == "darwin":
        try:
            subprocess.run(["osascript", "-e",
                            f'display notification "{msg}" with title "{TITLE}"'],
                           capture_output=True, timeout=4)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("\a", end="", file=sys.stderr, flush=True)
    else:
        try:
            r = subprocess.run(["notify-send", TITLE, msg],
                               capture_output=True, timeout=4)
            if r.returncode == 0:
                return
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        print("\a", end="", file=sys.stderr, flush=True)


# ═══════════════════════════════════════════════════════════════════════════
# Sound player
# ═══════════════════════════════════════════════════════════════════════════

def _find_sound(event: str) -> Path | None:
    """Find WAV file: user/sounds/ > assets/sounds/ > None."""
    for base in (_HA_HOME / "user" / "sounds", _HA_HOME / "assets" / "sounds"):
        wav = base / f"{event}.wav"
        if wav.exists():
            return wav
    return None


def play_sound(event: str):
    """Play a notification sound for the given event."""
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
                                     stdout=subprocess.DEVNULL,
                                     stderr=subprocess.DEVNULL)
                    return
                except FileNotFoundError:
                    continue
            print("\a", end="", file=sys.stderr, flush=True)
    except Exception:
        print("\a", end="", file=sys.stderr, flush=True)


# ═══════════════════════════════════════════════════════════════════════════
# G3 icon → sound routing (Stop hook)
# ═══════════════════════════════════════════════════════════════════════════

_ICON_MAP = {
    "⚠️": "warning", "⚠": "warning",
    "❌": "error",
    "✅": "complete", "💡": "complete", "⚡": "complete", "🔧": "complete",
    "❓": "confirm", "📐": "confirm",
}


def _detect_sound_event(text: str) -> str:
    """Detect sound event from G3 format status line."""
    if "【HelloAGENTS】" not in text:
        return "idle"
    for icon, event in _ICON_MAP.items():
        if icon in text:
            return event
    if "🔵" in text:
        return "confirm" if "确认" in text else "idle"
    return "idle"


def _route_sound():
    """Read last assistant message from stdin JSON and route to sound."""
    try:
        raw = sys.stdin.read()
    except Exception:
        return

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        # Not JSON — try to detect from raw text
        if raw.strip():
            event = _detect_sound_event(raw)
            play_sound(event)
        return

    # Claude Code Stop hook: check stop_reason
    stop_reason = data.get("stop_reason", "")
    if stop_reason == "tool_use":
        return  # Silent — tool use continuation

    # Extract text content
    text = ""
    content = data.get("content", data.get("message", data.get("text", "")))
    if isinstance(content, list):
        text = " ".join(b.get("text", "") for b in content
                        if isinstance(b, dict) and b.get("type") == "text")
    elif isinstance(content, str):
        text = content

    if not text:
        # Try reading from project JSONL (Claude Code)
        text = _read_last_assistant_text()

    event = _detect_sound_event(text)
    play_sound(event)


def _read_last_assistant_text() -> str:
    """Try to read last assistant message from Claude Code project JSONL."""
    try:
        projects_dir = Path.home() / ".claude" / "projects"
        if not projects_dir.exists():
            return ""
        cwd = Path.cwd().as_posix().replace("/", "-").replace(":", "").strip("-")
        project_dir = projects_dir / cwd
        if not project_dir.exists():
            # Try to find matching directory
            for d in projects_dir.iterdir():
                if d.is_dir() and cwd[:20] in d.name:
                    project_dir = d
                    break
            else:
                return ""
        jsonl_files = sorted(project_dir.glob("*.jsonl"), key=lambda f: f.stat().st_mtime)
        if not jsonl_files:
            return ""
        last_file = jsonl_files[-1]
        # Read last few lines for assistant message
        lines = last_file.read_text(encoding="utf-8", errors="replace").strip().split("\n")
        for line in reversed(lines[-5:]):
            try:
                msg = json.loads(line)
                if msg.get("role") == "assistant":
                    content = msg.get("content", "")
                    if isinstance(content, list):
                        return " ".join(b.get("text", "") for b in content
                                        if isinstance(b, dict) and b.get("type") == "text")
                    return content if isinstance(content, str) else ""
            except (json.JSONDecodeError, ValueError):
                continue
    except Exception:
        pass
    return ""


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "desktop"

    if cmd == "desktop":
        _desktop_notify()
    elif cmd == "sound" and len(sys.argv) > 2:
        play_sound(sys.argv[2])
    elif cmd == "route":
        _route_sound()
    else:
        print(f"Usage: {sys.argv[0]} desktop|sound <event>|route")
        sys.exit(1)


if __name__ == "__main__":
    main()

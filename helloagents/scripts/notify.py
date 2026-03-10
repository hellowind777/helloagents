#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Notification Hook — 桌面通知

匹配 idle_prompt 事件（Claude Code 等待用户输入时），
发送桌面通知提醒用户回到终端。

Windows: PowerShell BurntToast / 降级 terminal bell
macOS: osascript display notification
Linux: notify-send / 降级 terminal bell

输入(stdin): JSON，包含 hookEventName 等字段
输出(stdout): 无
"""

import sys
import io
import subprocess

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

TITLE = "HelloAGENTS"
MESSAGE = "Claude Code 正在等待您的输入"


def _notify_windows():
    """Windows 桌面通知: BurntToast → 降级 terminal bell。"""
    ps_cmd = (
        f'Import-Module BurntToast -ErrorAction Stop; '
        f'New-BurntToastNotification -Text "{TITLE}", "{MESSAGE}"'
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True, timeout=4,
        )
        if result.returncode == 0:
            return
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    # 降级: terminal bell
    print("\a", end="", file=sys.stderr, flush=True)


def _notify_macos():
    """macOS 桌面通知: osascript。"""
    script = f'display notification "{MESSAGE}" with title "{TITLE}"'
    try:
        subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, timeout=4,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("\a", end="", file=sys.stderr, flush=True)


def _notify_linux():
    """Linux 桌面通知: notify-send → 降级 terminal bell。"""
    try:
        result = subprocess.run(
            ["notify-send", TITLE, MESSAGE],
            capture_output=True, timeout=4,
        )
        if result.returncode == 0:
            return
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    print("\a", end="", file=sys.stderr, flush=True)


def main():
    # 消费 stdin（避免 broken pipe），不需要解析内容
    try:
        sys.stdin.read()
    except Exception:
        pass

    if sys.platform == "win32":
        _notify_windows()
    elif sys.platform == "darwin":
        _notify_macos()
    else:
        _notify_linux()


if __name__ == "__main__":
    main()

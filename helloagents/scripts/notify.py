#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Notification Hook — 桌面通知

由 Stop hook (stop_sound_router.py)、Codex notify (codex_notify.py)、
Gemini/Qwen AfterAgent hook 调用，发送桌面通知提醒用户。

Windows: WinRT Toast API (系统内置, 无需第三方模块) / 降级 terminal bell
macOS: osascript display notification
Linux: notify-send / 降级 terminal bell

输入(stdin): 无（调用方通过 subprocess 传入 DEVNULL）
输出(stdout): 无
"""

import sys
import io
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _config import get_notify_mode

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

# Windows WinRT Toast: AppUserModelId (注册表自动创建)
_WIN_APPID = "HelloAgents.Notification"
# 图标路径 (assets/icons/icon.png)
_ICON_PATH = Path(__file__).parent.parent / "assets" / "icons" / "icon.png"


def _ensure_win_appid():
    """确保 Windows AppUserModelId 注册表项存在（首次调用时创建）。"""
    reg_key = f"HKCU:\\Software\\Classes\\AppUserModelId\\{_WIN_APPID}"
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             f"if (-not (Test-Path '{reg_key}')) {{ "
             f"New-Item -Path '{reg_key}' -Force | Out-Null; "
             f"Set-ItemProperty -Path '{reg_key}' -Name 'DisplayName' "
             f"-Value 'HelloAgents' -Force }}"],
            capture_output=True, timeout=4,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass


def _notify_windows():
    """Windows 桌面通知: WinRT Toast API → 降级 terminal bell。"""
    _ensure_win_appid()
    safe_msg = MESSAGE.replace("'", "''")
    icon_win = str(_ICON_PATH).replace("/", "\\")
    icon_xml = (
        f'<image placement="appLogoOverride" src="{icon_win}" />'
        if _ICON_PATH.is_file() else ""
    )
    ps_cmd = (
        "[Windows.UI.Notifications.ToastNotificationManager, "
        "Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null\n"
        "[Windows.Data.Xml.Dom.XmlDocument, "
        "Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null\n"
        '$xml = @"\n'
        "<toast>\n"
        "  <visual>\n"
        '    <binding template="ToastGeneric">\n'
        f"      {icon_xml}\n"
        f"      <text>{safe_msg}</text>\n"
        "    </binding>\n"
        "  </visual>\n"
        "</toast>\n"
        '"@\n'
        "$doc = New-Object Windows.Data.Xml.Dom.XmlDocument\n"
        "$doc.LoadXml($xml)\n"
        "$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)\n"
        "[Windows.UI.Notifications.ToastNotificationManager]::"
        f"CreateToastNotifier('{_WIN_APPID}').Show($toast)"
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

    # notify_level 门控: 0=off, 2=sound only → 跳过桌面通知
    mode = get_notify_mode()
    if mode not in (1, 3):
        return

    if sys.platform == "win32":
        _notify_windows()
    elif sys.platform == "darwin":
        _notify_macos()
    else:
        _notify_linux()


if __name__ == "__main__":
    main()

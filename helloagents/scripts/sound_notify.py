#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Sound Notification — 跨平台声音播放

接收事件名参数，播放对应语音文件。
支持事件: complete("完成了~"), idle("在等你呢~"), confirm("需要您确认~"), error("出错了呢~")

Windows: winsound.PlaySound (Python 内置, SND_ASYNC 非阻塞)
macOS: afplay (系统自带, 后台 Popen)
Linux: aplay -q → paplay 降级链
全失败: terminal bell (\a)

输入(stdin): JSON (Claude Code hooks 通过 stdin 传数据), 读取并丢弃
输出(stdout): 无
"""

import sys
import os
from pathlib import Path

# 声音文件目录
SOUNDS_DIR = Path(__file__).parent.parent / "assets" / "sounds"

# 有效事件名
VALID_EVENTS = {"complete", "idle", "confirm", "error", "warning"}


def _play_windows(wav_path: str) -> bool:
    """Windows: 使用内置 winsound 模块播放 WAV (SND_ASYNC 非阻塞)。"""
    try:
        import winsound
        winsound.PlaySound(wav_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
        return True
    except Exception:
        return False


def _play_macos(wav_path: str) -> bool:
    """macOS: 使用 afplay 播放 (后台 Popen，不阻塞)。"""
    import subprocess
    try:
        subprocess.Popen(
            ["afplay", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (FileNotFoundError, OSError):
        return False


def _play_linux(wav_path: str) -> bool:
    """Linux: aplay -q → paplay 降级链。"""
    import subprocess
    # 尝试 aplay (ALSA)
    try:
        subprocess.Popen(
            ["aplay", "-q", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (FileNotFoundError, OSError):
        pass
    # 降级到 paplay (PulseAudio)
    try:
        subprocess.Popen(
            ["paplay", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except (FileNotFoundError, OSError):
        pass
    return False


def _bell():
    """最终降级: terminal bell。"""
    print("\a", end="", file=sys.stderr, flush=True)


def play_sound(event: str) -> None:
    """播放指定事件的声音文件。"""
    wav_path = str(SOUNDS_DIR / f"{event}.wav")

    if not os.path.isfile(wav_path):
        _bell()
        return

    ok = False
    if sys.platform == "win32":
        ok = _play_windows(wav_path)
    elif sys.platform == "darwin":
        ok = _play_macos(wav_path)
    else:
        ok = _play_linux(wav_path)

    if not ok:
        _bell()


def main():
    # 消费 stdin（避免 broken pipe），Claude Code hooks 通过 stdin 传 JSON
    try:
        sys.stdin.read()
    except Exception:
        pass

    # 解析事件名
    if len(sys.argv) < 2:
        sys.exit(0)

    event = sys.argv[1].strip().lower()
    if event not in VALID_EVENTS:
        sys.exit(0)

    play_sound(event)


if __name__ == "__main__":
    main()

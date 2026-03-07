#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Sound Notification — 跨平台声音播放

接收事件名参数，播放对应语音文件。
支持事件: complete("完成了~"), idle("在等你呢~"), confirm("需要您确认~"), error("出错了呢~")

Windows: winsound.PlaySound (Python 内置, 同步阻塞约 1-2s)
macOS: afplay (系统自带, 后台 Popen)
Linux: aplay -q → paplay 降级链
全失败: terminal bell (\a)

输入(stdin): JSON (Claude Code hooks 通过 stdin 传数据), 读取并丢弃
输出(stdout): 无
"""

import sys
import io
import os
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 声音文件目录
CUSTOM_SOUNDS_DIR = Path(__file__).parent.parent / "user" / "sounds"
SOUNDS_DIR = Path(__file__).parent.parent / "assets" / "sounds"

# 有效事件名
VALID_EVENTS = {"complete", "idle", "confirm", "error", "warning"}


def _play_windows(wav_path: str) -> bool:
    """Windows: 使用内置 winsound 模块同步播放 WAV。

    必须使用同步模式：SND_ASYNC 会在进程退出时立即终止音频线程，
    导致 hook 子进程中完全听不到声音。同步模式阻塞约 1-2 秒，
    对于 hook（5s 超时）完全可接受。
    """
    try:
        import winsound
        # 验证文件存在且可读
        if not os.path.isfile(wav_path):
            return False
        winsound.PlaySound(wav_path, winsound.SND_FILENAME | winsound.SND_NODEFAULT)
        return True
    except Exception as e:
        # 调试：输出错误到临时文件
        try:
            debug_file = Path.home() / ".helloagents" / "sound_debug.log"
            debug_file.parent.mkdir(parents=True, exist_ok=True)
            with open(debug_file, "a", encoding="utf-8") as f:
                f.write(f"[{os.getpid()}] Windows播放失败: {wav_path}\n错误: {e}\n\n")
        except:
            pass
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
    """播放指定事件的声音文件。优先使用用户自定义声音。"""
    # 优先查找用户自定义声音
    custom_path = CUSTOM_SOUNDS_DIR / f"{event}.wav"
    default_path = SOUNDS_DIR / f"{event}.wav"
    wav_path = str(custom_path if custom_path.is_file() else default_path)

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

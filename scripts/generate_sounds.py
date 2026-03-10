#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Sound Generator — 使用 edge-tts 生成语音 WAV 文件

开发工具，不随包分发。仅用于生成/更新语音文件。

依赖:
  pip install edge-tts miniaudio
  (可选) 系统安装 ffmpeg (优先使用, 无则用 miniaudio 纯 Python 转换)

输出:
  helloagents/assets/sounds/complete.wav  ("完成了~")
  helloagents/assets/sounds/idle.wav      ("在等你呢~")
  helloagents/assets/sounds/confirm.wav   ("需要您确认~")
  helloagents/assets/sounds/error.wav     ("出错了呢~")

用法:
  python scripts/generate_sounds.py
"""

import asyncio
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

# 语音配置
VOICE = "zh-CN-XiaoyiNeural"  # 活泼少女音色
RATE = "-10%"   # 适中慢速，吐字清晰
PITCH = "+14Hz" # 甜美奶音，清晰不失真

# 事件 → 语音文本（用语气词增强奶萌感，保持吐字清晰）
EVENTS = {
    "complete": "完成了哦~",
    "idle":     "在等你呢~",
    "confirm":  "需要你确认哦~",
    "error":    "出错了呢~",
    "warning":  "注意哦~",
}

# 输出目录
OUTPUT_DIR = Path(__file__).parent.parent / "helloagents" / "assets" / "sounds"

# 目标 WAV 参数
TARGET_SAMPLE_RATE = 22050
TARGET_CHANNELS = 1
TARGET_SAMPLE_WIDTH = 2  # 16-bit


def _has_ffmpeg() -> bool:
    """Check if ffmpeg is available."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


async def generate_mp3(text: str, output_path: Path) -> None:
    """使用 edge-tts 生成 MP3 文件。"""
    import edge_tts
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(output_path))


def convert_to_wav_ffmpeg(mp3_path: Path, wav_path: Path) -> None:
    """使用 ffmpeg 将 MP3 转换为 WAV (16-bit PCM, 22050Hz, mono)。"""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(mp3_path),
        "-ar", str(TARGET_SAMPLE_RATE),
        "-ac", str(TARGET_CHANNELS),
        "-sample_fmt", "s16",
        str(wav_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 转换失败: {result.stderr[:200]}")


def convert_to_wav_miniaudio(mp3_path: Path, wav_path: Path) -> None:
    """使用 miniaudio (纯 Python) 将 MP3 转换为 WAV。"""
    import miniaudio

    # 解码 MP3 到 PCM (16-bit signed)
    decoded = miniaudio.mp3_read_file_s16(str(mp3_path))

    src_rate = decoded.sample_rate
    src_channels = decoded.nchannels
    raw_bytes = decoded.samples.tobytes()

    # 解析为 16-bit samples
    num_samples = len(raw_bytes) // 2
    sample_data = list(struct.unpack(f"<{num_samples}h", raw_bytes))

    # 单声道转换 (取左声道)
    if src_channels > 1:
        sample_data = sample_data[::src_channels]

    # 简单重采样 (线性插值)
    if src_rate != TARGET_SAMPLE_RATE:
        ratio = TARGET_SAMPLE_RATE / src_rate
        new_len = int(len(sample_data) * ratio)
        resampled = []
        for i in range(new_len):
            src_pos = i / ratio
            idx = int(src_pos)
            frac = src_pos - idx
            if idx + 1 < len(sample_data):
                val = sample_data[idx] * (1 - frac) + sample_data[idx + 1] * frac
            else:
                val = sample_data[min(idx, len(sample_data) - 1)]
            resampled.append(int(max(-32768, min(32767, val))))
        sample_data = resampled

    # 写入 WAV
    pcm_bytes = struct.pack(f"<{len(sample_data)}h", *sample_data)
    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(TARGET_CHANNELS)
        wf.setsampwidth(TARGET_SAMPLE_WIDTH)
        wf.setframerate(TARGET_SAMPLE_RATE)
        wf.writeframes(pcm_bytes)


async def main():
    # 检查依赖
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("错误: 请先安装 edge-tts: pip install edge-tts")
        sys.exit(1)

    use_ffmpeg = _has_ffmpeg()
    if use_ffmpeg:
        print("转换方式: ffmpeg")
        convert_fn = convert_to_wav_ffmpeg
    else:
        try:
            import miniaudio  # noqa: F401
            print("转换方式: miniaudio (纯 Python)")
            convert_fn = convert_to_wav_miniaudio
        except ImportError:
            print("错误: 请安装 ffmpeg 或 miniaudio: pip install miniaudio")
            sys.exit(1)

    # 创建输出目录
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"语音: {VOICE}")
    print(f"输出: {OUTPUT_DIR}")
    print()

    total_size = 0
    with tempfile.TemporaryDirectory() as tmpdir:
        for event, text in EVENTS.items():
            mp3_path = Path(tmpdir) / f"{event}.mp3"
            wav_path = OUTPUT_DIR / f"{event}.wav"

            print(f"  生成 {event}.wav <- \"{text}\"")

            # 生成 MP3
            await generate_mp3(text, mp3_path)

            # 转换为 WAV
            convert_fn(mp3_path, wav_path)

            size = wav_path.stat().st_size
            total_size += size
            print(f"    OK {size / 1024:.1f} KB")

    print()
    print(f"总计: {total_size / 1024:.1f} KB ({len(EVENTS)} 个文件)")
    print("完成!")


if __name__ == "__main__":
    asyncio.run(main())

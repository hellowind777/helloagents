#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Codex Notify Proxy — Codex CLI 通知代理

接收 Codex CLI 的 notify JSON，检测 G3 格式状态图标，
映射到对应声音事件，播放声音通知 + 执行版本检查。

Codex CLI 调用方式:
  codex_notify.py '{"type":"agent-turn-complete","client":"codex-tui","last-assistant-message":"..."}'

声音路由（5 种事件）:
  approval-requested  → confirm  ("需要您确认~")
  agent-turn-complete → 从 last-assistant-message 检测 G3 图标:
    warning  → ⚠️             EHRB 风险警告 ("需要注意~")
    error    → ❌             错误终止 ("出错了呢~")
    complete → ✅💡⚡🔧       完成/直接响应/快速流程/外部工具 ("完成了~")
    confirm  → ❓              通用确认 / R2 确认 ("需要您确认~")
    confirm  → 🔵（状态含"确认"）R2 确认（核心维度全部充分，等待模式选择）
    idle     → 🔵（状态不含"确认"）R2 追问/评估/执行等 ("在等你呢~")
    idle     → ℹ️🚫及其他     信息提示/取消
    (跳过) → 无 G3 格式      子代理输出，跳过声音

声音触发原则:
  Codex CLI 的 notify 钩子在所有代理轮次完成时触发（包括子代理），
  通过 G3 格式标记【HelloAGENTS】区分主代理和子代理输出:
  主代理输出包含 G3 标记 → 按图标映射声音 | 子代理/无标记 → 跳过声音。

client 字段过滤:
  codex-tui → 播放声音（终端用户需要提醒）
  其他值（VS Code/Xcode/任何 IDE） → 跳过声音（IDE 有自己的通知机制）
  无 client 字段 → 播放声音（向后兼容无 client 字段的旧 payload）

输入(argv[1]): JSON 字符串
输出(stdout): 无
"""

import json
import subprocess
import sys
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    import io
    for _s in ('stdin', 'stdout', 'stderr'):
        _stream = getattr(sys, _s, None)
        if _stream and hasattr(_stream, 'buffer'):
            setattr(sys, _s, io.TextIOWrapper(_stream.buffer, encoding='utf-8', errors='replace'))

# ---------------------------------------------------------------------------
# G3 图标→声音检测（图标映射与 stop_sound_router.py 一致，无标记时返回 None
# 跳过声音，因为 Codex notify 在所有代理轮次触发，需通过 G3 标记过滤子代理）
# NOTE: _G3_MARKER 和图标常量在 stop_sound_router.py 中有独立副本。
# 两个脚本独立部署到不同 CLI 配置目录，无法共享导入。
# 修改图标映射时必须同步更新两个文件。
# ---------------------------------------------------------------------------

# G3 格式标记
_G3_MARKER = "\u3010HelloAGENTS\u3011"  # 【HelloAGENTS】

# 警告类图标 → warning ("需要注意~")：EHRB 风险警告
_WARNING_ICONS = frozenset({
    "\u26a0\ufe0f",  # ⚠️ (with variation selector)
    "\u26a0",         # ⚠  (without variation selector)
})

# 错误类图标 → error ("出错了呢~")：错误终止
_ERROR_ICONS = frozenset({
    "\u274c",  # ❌
})

# 完成类图标 → complete ("完成了~")
_COMPLETE_ICONS = frozenset({
    "\u2705",      # ✅
    "\U0001f4a1",  # 💡
    "\u26a1",      # ⚡
    "\U0001f527",  # 🔧
})

# 确认类图标 → confirm ("需要您确认~")：始终表示确认场景
_CONFIRM_ICONS = frozenset({
    "\u2753",      # ❓
    "\U0001f4d0",  # 📐
})

# 上下文相关图标：需检查状态文本判断是确认还是等待
_CONTEXT_ICONS = frozenset({
    "\U0001f535",  # 🔵
})

DEFAULT_SOUND = "complete"


def _detect_g3_sound(text):
    """从 HelloAGENTS G3 格式文本中检测声音事件。

    检测逻辑:
      1. 在首行查找【HelloAGENTS】标记
      2. 提取标记前的图标 + 标记后的状态文本
      3. 按优先级映射到 5 种声音事件:
         ⚠️ → warning | ❌ → error | ✅💡⚡🔧 → complete
         ❓📐 → confirm | 🔵+确认 → confirm | 🔵+其他 → idle
         其余图标 → idle
      4. 无标记 → 返回 None（子代理输出，跳过声音）
    """
    if not text:
        return None

    first_line = text.strip().split("\n")[0]

    idx = first_line.find(_G3_MARKER)
    if idx < 0:
        return None  # no G3 marker → sub-agent output → skip sound

    icon = first_line[:idx].strip()
    if not icon:
        return DEFAULT_SOUND

    # 提取标记后的状态文本（用于上下文相关图标判断）
    status_text = first_line[idx + len(_G3_MARKER):]

    # 警告类优先检查（⚠️ → warning）
    for ch in _WARNING_ICONS:
        if ch in icon:
            return "warning"

    # 错误类（❌ → error）
    for ch in _ERROR_ICONS:
        if ch in icon:
            return "error"

    # 完成类（✅💡⚡🔧 → complete）
    for ch in _COMPLETE_ICONS:
        if ch in icon:
            return "complete"

    # 确认类（❓📐 → confirm，始终为确认场景）
    for ch in _CONFIRM_ICONS:
        if ch in icon:
            return "confirm"

    # 上下文相关图标（🔵 → 检查状态文本判断）
    for ch in _CONTEXT_ICONS:
        if ch in icon:
            return "confirm" if "\u786e\u8ba4" in status_text else "idle"

    # 其余图标（ℹ️🚫等）→ 等待用户输入
    return "idle"


# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 仅终端 TUI 播放声音
TUI_CLIENT = "codex-tui"

# 脚本路径
SCRIPTS_DIR = Path(__file__).parent
SOUND_NOTIFY = SCRIPTS_DIR / "sound_notify.py"
NOTIFY_DESKTOP = SCRIPTS_DIR / "notify.py"


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    # 解析 Codex CLI 传入的 JSON 参数
    sound_event = None
    skip_sound = False
    if len(sys.argv) > 1:
        try:
            data = json.loads(sys.argv[1])
            notify_type = data.get("type", "")

            # 声音路由
            if notify_type == "approval-requested":
                sound_event = "confirm"
            elif notify_type == "agent-turn-complete":
                # 从 last-assistant-message 检测 G3 图标
                last_msg = data.get("last-assistant-message", "")
                sound_event = _detect_g3_sound(last_msg)

            # client 字段过滤: 仅 codex-tui（终端）播放
            client = (data.get("client") or "").lower()
            if client and client != TUI_CLIENT:
                skip_sound = True
        except (json.JSONDecodeError, TypeError):
            pass

    # 播放声音（同步等待，确保声音完整播放；notify_level 门控在 sound_notify.py 入口）
    if sound_event and not skip_sound and SOUND_NOTIFY.exists():
        try:
            subprocess.run(
                [sys.executable, str(SOUND_NOTIFY), sound_event],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        except Exception:
            pass

    # 桌面通知（notify_level 门控在 notify.py 入口）
    if sound_event and not skip_sound and NOTIFY_DESKTOP.exists():
        try:
            subprocess.run(
                [sys.executable, str(NOTIFY_DESKTOP)],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
            )
        except Exception:
            pass

    # 版本检查（后台执行，不阻塞 hook 返回）
    try:
        subprocess.Popen(
            ["helloagents", "--check-update", "--silent"],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


if __name__ == "__main__":
    main()

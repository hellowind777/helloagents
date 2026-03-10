#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Stop Sound Router — Claude Code Stop 事件智能声音路由

从 Claude Code 会话 JSONL 中读取最后一条 assistant 消息，
通过两层检测决定声音事件:

Layer 1 — stop_reason 检测（结构化信号，100% 可靠）:
  stop_reason == "tool_use" → 静默退出（中间状态，不播放声音）
  stop_reason == "end_turn" 或其他 → 继续 Layer 2

Layer 2 — G3 格式检测（语义信号）:
  检测【HelloAGENTS】标记 → 提取状态图标 → 映射声音（5 种事件）:
    warning  → ⚠️             EHRB 风险警告 ("需要注意~")
    error    → ❌             错误终止 ("出错了呢~")
    complete → ✅ 💡 ⚡ 🔧    完成/直接响应/快速流程/外部工具 ("完成了~")
    confirm  → ❓ 📐          通用确认 / R2 确认 ("需要您确认~")
    confirm  → 🔵（状态含"确认"）R3 确认（核心维度全部充分，等待模式选择）
    idle     → 🔵（状态不含"确认"）R3 追问/评估/执行等 ("在等你呢~")
    idle     → ℹ️ 🚫 及其他   信息提示/取消
    complete → 无 G3 格式      默认

数据源: 会话 JSONL 文件的最后一条 assistant 消息（text + stop_reason）

输入(stdin): JSON，包含 hookEventName, cwd 等字段
输出(stdout): 无
"""

import sys
import io
import json
import os
import subprocess
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# ---------------------------------------------------------------------------
# G3 图标→声音检测（图标映射与 codex_notify.py 一致，无标记时行为不同:
# Claude Code Stop hook 仅主代理触发 → 默认 complete;
# Codex notify 所有代理触发 → 无标记时跳过声音以过滤子代理）
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

# 其余图标（ℹ️🚫等）→ idle ("在等你呢~")
# 无需枚举，作为 else 分支处理

DEFAULT_SOUND = "complete"


def detect_g3_sound(text):
    """从 HelloAGENTS G3 格式文本中检测声音事件。

    检测逻辑:
      1. 在首行查找【HelloAGENTS】标记
      2. 提取标记前的图标 + 标记后的状态文本
      3. 按优先级映射到 5 种声音事件:
         ⚠️ → warning | ❌ → error | ✅💡⚡🔧 → complete
         ❓📐 → confirm | 🔵+确认 → confirm | 🔵+其他 → idle
         其余图标 → idle
      4. 无标记 → 返回默认值 complete
    """
    if not text:
        return DEFAULT_SOUND

    first_line = text.strip().split("\n")[0]

    # 查找 G3 标记
    idx = first_line.find(_G3_MARKER)
    if idx < 0:
        return DEFAULT_SOUND

    # 提取标记前的图标部分
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
# 路径常量
# ---------------------------------------------------------------------------

SCRIPTS_DIR = Path(__file__).parent
SOUND_NOTIFY = SCRIPTS_DIR / "sound_notify.py"
CLAUDE_PROJECTS = Path.home() / ".claude" / "projects"

# 从 JSONL 尾部读取的最大字节数
_TAIL_BYTES = 64 * 1024


# ---------------------------------------------------------------------------
# 项目目录定位
# ---------------------------------------------------------------------------

def _cwd_to_project_name(cwd):
    """将 CWD 路径转换为 Claude Code 项目目录名。

    Windows: D:\\GitHub\\dev\\project -> D--GitHub-dev-project
    Unix:    /home/user/project      -> -home-user-project
    """
    name = cwd.replace(":\\", "--").replace(":/", "--")
    name = name.replace("\\", "-").replace("/", "-")
    return name


def _find_project_dir(cwd):
    """查找 CWD 对应的 Claude Code 项目目录。"""
    if not CLAUDE_PROJECTS.is_dir():
        return None
    expected = CLAUDE_PROJECTS / _cwd_to_project_name(cwd)
    if expected.is_dir():
        return expected
    return None


# ---------------------------------------------------------------------------
# JSONL 读取
# ---------------------------------------------------------------------------

def _find_latest_jsonl(project_dir):
    """查找最近修改的顶层 JSONL 文件（当前会话）。"""
    latest_mtime = 0.0
    latest_file = None
    for f in project_dir.iterdir():
        if f.suffix == ".jsonl" and f.is_file():
            try:
                mtime = f.stat().st_mtime
                if mtime > latest_mtime:
                    latest_mtime = mtime
                    latest_file = f
            except OSError:
                pass
    return latest_file


def _extract_assistant_text(d):
    """从单条 JSONL 记录中提取 assistant 文本和 stop_reason。

    支持两种已知格式:
      格式A (当前): {"type": "assistant", "message": {"stop_reason": "...", "content": [...]}}
      格式B (降级): 无 "type" 字段但有 "role": "assistant"

    Returns:
        (text, stop_reason) 或 None（非 assistant 记录时）。
    """
    # 格式 A: type == "assistant"
    if d.get("type") == "assistant":
        msg = d.get("message", {})
        stop_reason = msg.get("stop_reason", "") or ""
        content = msg.get("content", "")
    # 格式 B 降级: role == "assistant"（无 type 字段）
    elif d.get("role") == "assistant":
        stop_reason = d.get("stop_reason", "") or ""
        content = d.get("content", "")
    else:
        return None

    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text = block.get("text", "")
                if text.strip():
                    return text, stop_reason
    elif isinstance(content, str) and content.strip():
        return content, stop_reason

    # assistant 消息无文本内容但有 stop_reason
    if stop_reason:
        return "", stop_reason
    return None


def _read_last_assistant_entry(jsonl_path):
    """从 JSONL 尾部读取最后一条 assistant 消息的文本内容和 stop_reason。

    Returns:
        (text, stop_reason) 元组。text 为消息文本，stop_reason 为 API 返回的
        停止原因（"end_turn"/"tool_use" 等），未找到时均为空字符串。
    """
    try:
        file_size = jsonl_path.stat().st_size
        read_size = min(file_size, _TAIL_BYTES)

        with open(jsonl_path, "rb") as f:
            f.seek(max(0, file_size - read_size))
            raw = f.read().decode("utf-8", errors="replace")

        lines = raw.strip().split("\n")
        for line in reversed(lines):
            try:
                d = json.loads(line)
                result = _extract_assistant_text(d)
                if result is not None:
                    return result
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
        return "", ""
    except (OSError, ValueError):
        return "", ""


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    data = {}
    try:
        raw = sys.stdin.read()
        if raw.strip():
            data = json.loads(raw)
    except Exception:
        pass

    cwd = data.get("cwd", os.getcwd())

    # 从最后一条 assistant 消息检测声音类型
    sound_event = DEFAULT_SOUND
    project_dir = _find_project_dir(cwd)
    if project_dir:
        jsonl_file = _find_latest_jsonl(project_dir)
        if jsonl_file:
            text, stop_reason = _read_last_assistant_entry(jsonl_file)
            # Layer 1: stop_reason 检测 — tool_use 表示中间状态，静默退出
            if stop_reason == "tool_use":
                return
            # Layer 2: G3 格式检测
            if text:
                sound_event = detect_g3_sound(text)

    # 播放声音
    if SOUND_NOTIFY.exists():
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


if __name__ == "__main__":
    main()

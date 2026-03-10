#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS PreToolUse Guard — 危险命令安全防护

匹配 Bash 工具调用中的高危命令模式，匹配时返回 deny 决策阻止执行。
无匹配时 exit(0) 不输出 = 放行。

输入(stdin): JSON，包含 tool_name, tool_input 等字段
输出(stdout): JSON {permissionDecision, reason} 或空（放行）
"""

import sys
import io
import json
import re
import subprocess
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')


# ---------------------------------------------------------------------------
# 危险命令模式
# ---------------------------------------------------------------------------

DANGEROUS_PATTERNS: list[tuple[re.Pattern, str]] = [
    # 递归删除根/家/通配
    (re.compile(r'\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(/(?:\s|$)|\*(?:\s|$)|~(?:\s|/|$))', re.IGNORECASE),
     "递归删除危险路径 (rm -rf / | ~ | *)"),
    # 强推主分支
    (re.compile(r'\bgit\s+push\s+.*--force.*\b(main|master)\b', re.IGNORECASE),
     "强制推送到主分支 (git push --force main/master)"),
    (re.compile(r'\bgit\s+push\s+-f\s+.*\b(main|master)\b', re.IGNORECASE),
     "强制推送到主分支 (git push -f main/master)"),
    # 硬重置到远程主分支
    (re.compile(r'\bgit\s+reset\s+--hard\s+origin/(main|master)\b', re.IGNORECASE),
     "硬重置到远程主分支 (git reset --hard origin/main)"),
    # 数据库删除
    (re.compile(r'\bDROP\s+(DATABASE|TABLE|SCHEMA)\b', re.IGNORECASE),
     "数据库删除操作 (DROP DATABASE/TABLE/SCHEMA)"),
    # 格式化/原始设备写入
    (re.compile(r'\bmkfs\b', re.IGNORECASE),
     "文件系统格式化 (mkfs)"),
    (re.compile(r'\bdd\s+.*\bof=/dev/', re.IGNORECASE),
     "原始设备写入 (dd of=/dev/)"),
]


def check_command(command: str) -> tuple[bool, str]:
    """检查命令是否匹配危险模式。返回 (is_dangerous, reason)。"""
    for pattern, reason in DANGEROUS_PATTERNS:
        if pattern.search(command):
            return True, reason
    return False, ""


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not command:
        sys.exit(0)

    is_dangerous, reason = check_command(command)
    if is_dangerous:
        # 播放警告声音（非阻塞）
        sound_script = Path(__file__).parent / "sound_notify.py"
        if sound_script.exists():
            try:
                subprocess.Popen(
                    [sys.executable, str(sound_script), "warning"],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass
        result = {
            "permissionDecision": "deny",
            "reason": f"[HelloAGENTS] 危险命令被拦截: {reason}",
        }
        print(json.dumps(result, ensure_ascii=False))
    # 不输出 = 放行


if __name__ == "__main__":
    main()

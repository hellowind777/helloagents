#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Config Integrity Check — 检测配置完整性

在 SessionStart hook 中调用，检测 HelloAGENTS 配置是否完整。
如果配置缺失（可能被 ccswitch 等工具替换），输出警告信息。

输入(stdin): JSON (Claude Code hooks)
输出(stdout): 警告信息（如果配置缺失）
退出码: 0=正常, 1=配置缺失
"""

import sys
import io
import os
import json
import locale
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')


def _detect_locale() -> str:
    """Detect system locale. Returns 'zh' for Chinese, 'en' otherwise."""
    for var in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        val = os.environ.get(var, "")
        if val.lower().startswith("zh"):
            return "zh"
    try:
        loc = locale.getlocale()[0] or ""
        if loc.lower().startswith("zh"):
            return "zh"
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            import ctypes
            lcid = ctypes.windll.kernel32.GetUserDefaultUILanguage()
            if (lcid & 0xFF) == 0x04:
                return "zh"
        except Exception:
            pass
    return "en"


_LANG = _detect_locale()


def _msg(zh: str, en: str) -> str:
    """Return message based on detected locale."""
    return zh if _LANG == "zh" else en


def check_claude_code_config() -> bool:
    """检测 Claude Code settings.json 配置完整性。"""
    settings_path = Path.home() / ".claude" / "settings.json"
    if not settings_path.exists():
        return True  # 文件不存在，可能是首次使用

    try:
        content = settings_path.read_text(encoding="utf-8")
        # 检测关键配置
        has_hooks = '"hooks"' in content and 'HelloAGENTS' in content
        return has_hooks
    except Exception:
        return True  # 读取失败，不报错


def check_codex_config() -> bool:
    """检测 Codex config.toml 配置完整性。"""
    config_path = Path.home() / ".codex" / "config.toml"
    if not config_path.exists():
        return True

    try:
        content = config_path.read_text(encoding="utf-8")
        # 检测关键配置
        has_di = 'developer_instructions' in content and 'HelloAGENTS' in content
        has_memories = '[memories]' in content and 'protocol_anchors' in content
        return has_di and has_memories
    except Exception:
        return True


def main():
    # 消费 stdin
    try:
        stdin_data = sys.stdin.read()
        hook_data = json.loads(stdin_data) if stdin_data.strip() else {}
    except Exception:
        hook_data = {}

    # 检测当前 CLI
    cli_name = "unknown"
    if Path.home().joinpath(".claude").exists():
        cli_name = "claude"
        config_ok = check_claude_code_config()
    elif Path.home().joinpath(".codex").exists():
        cli_name = "codex"
        config_ok = check_codex_config()
    else:
        sys.exit(0)  # 未知 CLI，跳过检测

    if not config_ok:
        print(_msg("\n⚠️  HelloAGENTS 配置缺失或不完整",
                   "\n⚠️  HelloAGENTS config missing or incomplete"), file=sys.stderr)
        print(_msg(f"可能原因：配置文件被外部工具（如 ccswitch）替换",
                   f"Possible cause: config replaced by external tool (e.g. ccswitch)"), file=sys.stderr)
        print(_msg(f"修复方法：运行 'helloagents install {cli_name}' 恢复配置\n",
                   f"Fix: run 'helloagents install {cli_name}' to restore config\n"), file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()

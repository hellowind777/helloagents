#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS Config Check — 配置完整性检测

支持两种模式：
- 完整检测（--force）：SessionStart 使用，无条件检测
- 轻量级检测（默认）：UserPromptSubmit 使用，基于修改时间缓存

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


# NOTE: _detect_locale 与 utils.py 中的同名函数保持一致。
# 两个脚本独立部署，无法共享导入。修改时需同步更新。
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

def _get_cli_helloagents_dir() -> Path:
    """Get CLI-specific helloagents directory by detecting installed CLI.

    NOTE: This list must stay in sync with CLI_TARGETS in helloagents/_common.py.
    This script is deployed standalone, so it cannot import from the package.
    """
    home = Path.home()
    candidates = [
        home / ".claude" / "helloagents",
        home / ".codex" / "helloagents",
        home / ".config" / "opencode" / "helloagents",
        home / ".gemini" / "helloagents",
        home / ".qwen" / "helloagents",
        home / ".grok" / "helloagents",
    ]
    for path in candidates:
        if path.exists():
            return path
    return home / ".helloagents"

CACHE_FILE = _get_cli_helloagents_dir() / ".config_check_cache"


def get_config_mtime(cli_name: str) -> float:
    """获取配置文件的修改时间。"""
    home = Path.home()
    config_paths = {
        "claude": home / ".claude" / "settings.json",
        "codex": home / ".codex" / "config.toml",
        "gemini": home / ".gemini" / "settings.json",
        "qwen": home / ".qwen" / "settings.json",
        "grok": home / ".grok" / "settings.json",
    }
    config_path = config_paths.get(cli_name)
    if not config_path or not config_path.exists():
        return 0.0
    try:
        return config_path.stat().st_mtime
    except Exception:
        return 0.0


def get_cached_mtime() -> float:
    """获取缓存的修改时间。"""
    if not CACHE_FILE.exists():
        return 0.0
    try:
        return float(CACHE_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        return 0.0


def update_cache(mtime: float):
    """更新缓存文件。"""
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(str(mtime), encoding="utf-8")
    except Exception:
        pass


def check_config_integrity(cli_name: str) -> bool:
    """完整检测配置完整性。"""
    home = Path.home()
    if cli_name == "claude":
        settings_path = home / ".claude" / "settings.json"
        if not settings_path.exists():
            return True
        try:
            content = settings_path.read_text(encoding="utf-8")
            return '"hooks"' in content and 'HelloAGENTS' in content
        except Exception:
            return True
    elif cli_name == "codex":
        config_path = home / ".codex" / "config.toml"
        if not config_path.exists():
            return True
        try:
            content = config_path.read_text(encoding="utf-8")
            return 'developer_instructions' in content and 'HelloAGENTS' in content
        except Exception:
            return True
    elif cli_name in ("gemini", "qwen", "grok"):
        settings_path = home / f".{cli_name}" / "settings.json"
        if not settings_path.exists():
            return True
        try:
            content = settings_path.read_text(encoding="utf-8")
            return '"hooks"' in content and 'HelloAGENTS' in content
        except Exception:
            return True
    return True


def main():
    # 消费 stdin
    try:
        stdin_data = sys.stdin.read()
    except Exception:
        pass

    # 检查是否强制完整检测
    force_check = "--force" in sys.argv

    # 检测当前 CLI（检查所有已安装的 CLI）
    home = Path.home()
    cli_checks = [
        ("claude", home / ".claude"),
        ("codex", home / ".codex"),
        ("gemini", home / ".gemini"),
        ("qwen", home / ".qwen"),
        ("grok", home / ".grok"),
    ]
    detected_clis = [name for name, path in cli_checks if path.exists()]
    if not detected_clis:
        sys.exit(0)

    # 对所有检测到的 CLI 执行检查
    any_failed = False
    for cli_name in detected_clis:
        # 强制模式：直接完整检测
        if force_check:
            config_ok = check_config_integrity(cli_name)
            current_mtime = get_config_mtime(cli_name)
            update_cache(current_mtime)
        else:
            # 轻量级模式：基于修改时间缓存
            current_mtime = get_config_mtime(cli_name)
            cached_mtime = get_cached_mtime()
            if current_mtime <= cached_mtime:
                continue
            config_ok = check_config_integrity(cli_name)
            update_cache(current_mtime)

        if not config_ok:
            any_failed = True
            context = _msg("会话启动", "session start") if force_check else _msg(
                "检测到配置文件被修改（可能是 ccswitch 切换）",
                "config file modification detected (possibly ccswitch)")
            print(_msg(f"\n⚠️  HelloAGENTS 配置缺失或不完整 ({cli_name})",
                       f"\n⚠️  HelloAGENTS config missing or incomplete ({cli_name})"), file=sys.stderr)
            print(_msg(f"可能原因：{context}",
                       f"Possible cause: {context}"), file=sys.stderr)
            print(_msg(f"修复方法：运行 'helloagents install {cli_name}' 恢复配置\n",
                       f"Fix: run 'helloagents install {cli_name}' to restore config\n"), file=sys.stderr)

    sys.exit(1 if any_failed else 0)


if __name__ == "__main__":
    main()

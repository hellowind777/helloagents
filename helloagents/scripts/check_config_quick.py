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
import json
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

def _get_cli_helloagents_dir() -> Path:
    """Get CLI-specific helloagents directory by detecting installed CLI."""
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
    if cli_name == "claude":
        config_path = Path.home() / ".claude" / "settings.json"
    elif cli_name == "codex":
        config_path = Path.home() / ".codex" / "config.toml"
    else:
        return 0.0

    if not config_path.exists():
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
    if cli_name == "claude":
        settings_path = Path.home() / ".claude" / "settings.json"
        if not settings_path.exists():
            return True
        try:
            content = settings_path.read_text(encoding="utf-8")
            return '"hooks"' in content and 'HelloAGENTS' in content
        except Exception:
            return True
    elif cli_name == "codex":
        config_path = Path.home() / ".codex" / "config.toml"
        if not config_path.exists():
            return True
        try:
            content = config_path.read_text(encoding="utf-8")
            has_di = 'developer_instructions' in content and 'HelloAGENTS' in content
            has_memories = '[memories]' in content and 'protocol_anchors' in content
            return has_di and has_memories
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

    # 检测当前 CLI
    cli_name = "unknown"
    if Path.home().joinpath(".claude").exists():
        cli_name = "claude"
    elif Path.home().joinpath(".codex").exists():
        cli_name = "codex"
    else:
        sys.exit(0)

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
            sys.exit(0)
        config_ok = check_config_integrity(cli_name)
        update_cache(current_mtime)

    if not config_ok:
        context = "会话启动" if force_check else "检测到配置文件被修改（可能是 ccswitch 切换）"
        print(f"\n⚠️  HelloAGENTS 配置缺失或不完整", file=sys.stderr)
        print(f"可能原因：{context}", file=sys.stderr)
        print(f"修复方法：运行 'helloagents install {cli_name}' 恢复配置\n", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()

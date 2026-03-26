#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Script Config Reader — 轻量级全局配置读取。

读取 ~/.helloagents/helloagents.json，供 hook 脚本使用。
"""

import json
from pathlib import Path

# NOTE: This path is intentionally duplicated from _common.GLOBAL_CONFIG_FILE.
# Scripts are deployed independently and cannot import from _common.
# Keep in sync with _common.py:GLOBAL_CONFIG_FILE when modifying.
GLOBAL_CONFIG_FILE = Path.home() / ".helloagents" / "helloagents.json"


def read_global_config() -> dict:
    """读取全局配置，失败返回空 dict。"""
    try:
        if GLOBAL_CONFIG_FILE.is_file():
            return json.loads(GLOBAL_CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def get_notify_mode() -> int:
    """NOTIFY_MODE: 0=off, 1=desktop, 2=sound, 3=both. Default 0."""
    cfg = read_global_config()
    try:
        mode = int(cfg.get("NOTIFY_MODE", 0))
        return mode if 0 <= mode <= 3 else 0
    except (ValueError, TypeError):
        return 0

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

# NOTE: Standalone copy of _common.VALID_CONFIG_KEYS.
# Scripts deploy independently — keep in sync with _common.py when modifying.
VALID_CONFIG_KEYS: dict[str, int | str] = {
    "OUTPUT_LANGUAGE": "zh-CN",
    "KB_CREATE_MODE": 2,
    "BILINGUAL_COMMIT": 1,
    "EVAL_MODE": 1,
    "UPDATE_CHECK": 72,
    "CSV_BATCH_MAX": 16,
    "NOTIFY_LEVEL": 0,
}

# Legacy alias: notify_level → NOTIFY_LEVEL (backward compatibility)
_CONFIG_KEY_ALIASES: dict[str, str] = {"notify_level": "NOTIFY_LEVEL"}


def read_global_config() -> dict:
    """读取全局配置，失败返回空 dict。"""
    try:
        if GLOBAL_CONFIG_FILE.is_file():
            return json.loads(GLOBAL_CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def get_notify_mode() -> int:
    """NOTIFY_LEVEL: 0=off, 1=desktop, 2=sound, 3=both. Default 0."""
    cfg = read_global_config()
    try:
        # Support both NOTIFY_LEVEL (canonical) and notify_level (legacy)
        mode = int(cfg.get("NOTIFY_LEVEL", cfg.get("notify_level", 0)))
        return mode if 0 <= mode <= 3 else 0
    except (ValueError, TypeError):
        return 0


def validate_config(data: dict) -> tuple[list[str], list[str]]:
    """Validate config dict against VALID_CONFIG_KEYS.

    Returns (added_keys, unknown_keys) where *added_keys* are keys that were
    missing and filled with defaults (dict is mutated in-place), and
    *unknown_keys* are keys not in the registry.
    """
    # Migrate legacy aliases (e.g., notify_level → NOTIFY_LEVEL)
    for old_key, new_key in _CONFIG_KEY_ALIASES.items():
        if old_key in data and new_key not in data:
            data[new_key] = data.pop(old_key)
        elif old_key in data:
            del data[old_key]
    added: list[str] = []
    for key, default in VALID_CONFIG_KEYS.items():
        if key not in data:
            data[key] = default
            added.append(key)
    unknown = [k for k in data
               if k not in VALID_CONFIG_KEYS and k not in _CONFIG_KEY_ALIASES]
    return added, unknown

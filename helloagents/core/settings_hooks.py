"""HelloAGENTS Settings Hooks - Generic settings.json hooks configuration (Gemini/Qwen/Grok).

Gemini CLI, Qwen Code, and Grok CLI all use settings.json format for hooks.
This module provides shared configuration logic for these CLIs.
"""

import json
import sys
from pathlib import Path

from .._common import (
    _msg,
    PLUGIN_DIR_NAME,
    GEMINI_HOOKS_JSON, GROK_HOOKS_JSON,
    get_helloagents_module_path,
    is_helloagents_hook, resolve_hook_placeholders,
)


# ---------------------------------------------------------------------------
# Generic settings.json hooks configuration
# ---------------------------------------------------------------------------

def _load_hooks_json(hooks_json_name: str) -> dict:
    """Load hooks definition from the package's hooks/ directory."""
    hooks_file = get_helloagents_module_path() / "hooks" / hooks_json_name
    if not hooks_file.exists():
        return {}
    try:
        data = json.loads(hooks_file.read_text(encoding="utf-8"))
        return data.get("hooks", {})
    except Exception as e:
        print(f"[HelloAGENTS] Warning: failed to parse {hooks_json_name}: {e}",
              file=sys.stderr)
        return {}


def _configure_settings_hooks(dest_dir: Path, hooks_json_name: str) -> None:
    """Generic: Load hooks JSON, resolve placeholders, merge into settings.json.

    Idempotent: Uses "remove old + add new" strategy. This ensures clean updates
    but does not preserve user modifications to HelloAGENTS hooks.
    """
    settings_path = dest_dir / "settings.json"

    settings = {}
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
        except Exception:
            print(_msg("  ⚠ settings.json 格式异常，跳过 Hooks 配置",
                       "  ⚠ settings.json malformed, skipping hooks config"))
            return

    our_hooks = _load_hooks_json(hooks_json_name)
    if not our_hooks:
        return

    # Resolve {SCRIPTS_DIR} to actual installed path
    scripts_path = (dest_dir / PLUGIN_DIR_NAME / "scripts").as_posix()
    our_hooks = resolve_hook_placeholders(our_hooks, scripts_path)

    existing_hooks = settings.get("hooks", {})

    for event, new_entries in our_hooks.items():
        event_hooks = existing_hooks.get(event, [])
        # Remove old HelloAGENTS hooks, keep user hooks
        event_hooks = [h for h in event_hooks if not is_helloagents_hook(h)]
        event_hooks.extend(new_entries)
        existing_hooks[event] = event_hooks

    settings["hooks"] = existing_hooks
    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用，请关闭对应 CLI 后重试）",
                   "  ⚠ Cannot write settings.json (file locked, close the CLI and retry)"))
        return

    count = sum(len(v) for v in our_hooks.values())
    print(_msg(f"  已配置 {count} 个 Hooks ({settings_path.name})",
               f"  Configured {count} hook(s) ({settings_path.name})"))


def _remove_settings_hooks(dest_dir: Path) -> bool:
    """Generic: Remove all HelloAGENTS hooks from settings.json."""
    settings_path = dest_dir / "settings.json"
    if not settings_path.exists():
        return False

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(_msg(f"  ⚠ 无法读取 {settings_path}: {e}",
                   f"  ⚠ Cannot read {settings_path}: {e}"))
        return False

    hooks = settings.get("hooks")
    if not hooks or not isinstance(hooks, dict):
        return False

    removed_count = 0
    empty_events = []
    for event, hook_list in hooks.items():
        if not isinstance(hook_list, list):
            continue
        original_len = len(hook_list)
        hook_list[:] = [h for h in hook_list if not is_helloagents_hook(h)]
        removed_count += original_len - len(hook_list)
        if not hook_list:
            empty_events.append(event)

    for event in empty_events:
        del hooks[event]
    if not hooks:
        del settings["hooks"]

    if removed_count > 0:
        try:
            settings_path.write_text(
                json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8")
        except PermissionError:
            print(_msg("  ⚠ 无法写入 settings.json（文件被占用，请关闭对应 CLI 后重试）",
                       "  ⚠ Cannot write settings.json (file locked, close the CLI and retry)"))
            return False
        print(_msg(f"  已移除 {removed_count} 个 HelloAGENTS Hooks ({settings_path.name})",
                   f"  Removed {removed_count} HelloAGENTS hook(s) ({settings_path.name})"))
        return True
    return False


# ---------------------------------------------------------------------------
# CLI-specific wrappers
# ---------------------------------------------------------------------------

def _configure_gemini_hooks(dest_dir: Path) -> None:
    """Configure Gemini CLI hooks."""
    _configure_settings_hooks(dest_dir, GEMINI_HOOKS_JSON)


def _remove_gemini_hooks(dest_dir: Path) -> bool:
    """Remove Gemini CLI hooks."""
    return _remove_settings_hooks(dest_dir)


def _configure_qwen_hooks(dest_dir: Path) -> None:
    """Configure Qwen Code hooks (reuses Gemini hooks JSON).

    Qwen Code and Gemini CLI share the same settings.json hook event schema,
    verified compatible as of 2026-03.
    """
    _configure_settings_hooks(dest_dir, GEMINI_HOOKS_JSON)


def _remove_qwen_hooks(dest_dir: Path) -> bool:
    """Remove Qwen Code hooks."""
    return _remove_settings_hooks(dest_dir)


def _configure_grok_hooks(dest_dir: Path) -> None:
    """Configure Grok CLI hooks."""
    _configure_settings_hooks(dest_dir, GROK_HOOKS_JSON)


def _remove_grok_hooks(dest_dir: Path) -> bool:
    """Remove Grok CLI hooks."""
    return _remove_settings_hooks(dest_dir)

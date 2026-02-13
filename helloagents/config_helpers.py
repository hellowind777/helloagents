"""HelloAGENTS Config Helpers - CLI-specific configuration and hooks deployment."""

import re
from pathlib import Path

from .cli import (
    _msg,
    HOOKS_FINGERPRINT, CODEX_NOTIFY_CMD,
    get_helloagents_module_path,
)


# ---------------------------------------------------------------------------
# Codex config helper
# ---------------------------------------------------------------------------

def _configure_codex_toml(dest_dir: Path) -> None:
    """Ensure config.toml has project_doc_max_bytes >= 98304."""
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    # Already set and large enough — nothing to do
    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', content)
    if m and int(m.group(1)) >= 98304:
        return

    if m:
        # Exists but value is too small — replace it
        content = re.sub(
            r'project_doc_max_bytes\s*=\s*\d+',
            'project_doc_max_bytes = 98304',
            content)
    else:
        # Not present — insert before the first [section] or at the top
        insert_pos = 0
        section_match = re.search(r'^\[', content, re.MULTILINE)
        if section_match:
            insert_pos = section_match.start()
        line = "project_doc_max_bytes = 98304\n"
        if insert_pos > 0:
            line += "\n"
        content = content[:insert_pos] + line + content[insert_pos:]

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 project_doc_max_bytes = 98304 (防止 AGENTS.md 被截断)",
               "  Configured project_doc_max_bytes = 98304 (prevent AGENTS.md truncation)"))


# ---------------------------------------------------------------------------
# Hooks configuration helpers
# ---------------------------------------------------------------------------

def _load_hooks_source() -> dict:
    """Load HelloAGENTS hooks definition from the package."""
    import json
    hooks_file = get_helloagents_module_path() / "hooks" / "claude_code_hooks.json"
    if not hooks_file.exists():
        return {}
    try:
        data = json.loads(hooks_file.read_text(encoding="utf-8"))
        return data.get("hooks", {})
    except Exception:
        return {}


def _is_helloagents_hook(hook: dict) -> bool:
    """Check if a hook entry belongs to HelloAGENTS (by description fingerprint).

    Works with both flat hook objects and matcher-group objects.
    A matcher group is ours if any hook inside its 'hooks' array has the fingerprint.
    """
    # Flat hook object (legacy or inner hook)
    if HOOKS_FINGERPRINT in hook.get("description", ""):
        return True
    # Matcher group: check inner hooks array
    inner = hook.get("hooks", [])
    if isinstance(inner, list):
        for h in inner:
            if HOOKS_FINGERPRINT in h.get("description", ""):
                return True
    return False


def _configure_claude_hooks(dest_dir: Path) -> None:
    """Merge HelloAGENTS hooks into Claude Code settings.json.

    - Preserves all user-defined hooks
    - Replaces old HelloAGENTS hooks with current version (idempotent)
    - Identifies our hooks by HOOKS_FINGERPRINT in description field
    """
    import json
    settings_path = dest_dir / "settings.json"

    settings = {}
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
        except Exception:
            print(_msg("  ⚠ settings.json 格式异常，跳过 Hooks 配置",
                       "  ⚠ settings.json malformed, skipping hooks config"))
            return

    our_hooks = _load_hooks_source()
    if not our_hooks:
        return

    existing_hooks = settings.get("hooks", {})

    for event, new_entries in our_hooks.items():
        event_hooks = existing_hooks.get(event, [])
        # Remove old HelloAGENTS hooks, keep user hooks
        event_hooks = [h for h in event_hooks if not _is_helloagents_hook(h)]
        event_hooks.extend(new_entries)
        existing_hooks[event] = event_hooks

    settings["hooks"] = existing_hooks
    settings_path.write_text(
        json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")

    count = sum(len(v) for v in our_hooks.values())
    print(_msg(f"  已配置 {count} 个 Hooks ({settings_path.name})",
               f"  Configured {count} hook(s) ({settings_path.name})"))


def _remove_claude_hooks(dest_dir: Path) -> bool:
    """Remove HelloAGENTS hooks from Claude Code settings.json.

    Returns True if any hooks were removed.
    """
    import json
    settings_path = dest_dir / "settings.json"
    if not settings_path.exists():
        return False

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except Exception:
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
        hook_list[:] = [h for h in hook_list if not _is_helloagents_hook(h)]
        removed_count += original_len - len(hook_list)
        if not hook_list:
            empty_events.append(event)

    for event in empty_events:
        del hooks[event]
    if not hooks:
        del settings["hooks"]

    if removed_count > 0:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
        print(_msg(f"  已移除 {removed_count} 个 HelloAGENTS Hooks ({settings_path.name})",
                   f"  Removed {removed_count} HelloAGENTS hook(s) ({settings_path.name})"))
        return True
    return False


def _configure_codex_notify(dest_dir: Path) -> None:
    """Add HelloAGENTS notify hook to Codex CLI config.toml.

    Codex CLI expects notify as an array: notify = ["command"]

    - If notify is not set → add it
    - If notify is ours (old string or array format) → update to array format
    - If notify is user-defined → skip (don't overwrite)
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    notify_line = f'notify = ["{CODEX_NOTIFY_CMD}"]'

    # Match both old string format and new array format
    m_str = re.search(r'^notify\s*=\s*"([^"]*)"', content, re.MULTILINE)
    m_arr = re.search(r'^notify\s*=\s*\[([^\]]*)\]', content, re.MULTILINE)

    if m_str:
        # Old string format — upgrade to array if ours, skip if user's
        if "helloagents" in m_str.group(1):
            content = re.sub(
                r'^notify\s*=\s*"[^"]*"',
                notify_line,
                content, count=1, flags=re.MULTILINE)
            config_path.write_text(content, encoding="utf-8")
            print(_msg("  已更新 notify hook 为数组格式 (config.toml)",
                       "  Updated notify hook to array format (config.toml)"))
            return
        print(_msg("  跳过 notify 配置（已有用户自定义值）",
                   "  Skipped notify config (user-defined value exists)"))
        return

    if m_arr:
        # Array format — check if ours
        arr_content = m_arr.group(1)
        if "helloagents" in arr_content:
            if f'"{CODEX_NOTIFY_CMD}"' not in arr_content:
                content = re.sub(
                    r'^notify\s*=\s*\[[^\]]*\]',
                    notify_line,
                    content, count=1, flags=re.MULTILINE)
                config_path.write_text(content, encoding="utf-8")
                print(_msg("  已更新 notify hook (config.toml)",
                           "  Updated notify hook (config.toml)"))
            return
        print(_msg("  跳过 notify 配置（已有用户自定义值）",
                   "  Skipped notify config (user-defined value exists)"))
        return

    # Not present — add before first [section] or at top
    insert_pos = 0
    section_match = re.search(r'^\[', content, re.MULTILINE)
    if section_match:
        insert_pos = section_match.start()
    line = notify_line + "\n"
    if insert_pos > 0:
        line += "\n"
    content = content[:insert_pos] + line + content[insert_pos:]

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 notify hook (config.toml)",
               "  Configured notify hook (config.toml)"))


def _remove_codex_notify(dest_dir: Path) -> bool:
    """Remove HelloAGENTS notify hook from Codex CLI config.toml.

    Handles both old string format and new array format.
    Returns True if the notify line was removed.
    """
    config_path = dest_dir / "config.toml"
    if not config_path.exists():
        return False

    content = config_path.read_text(encoding="utf-8")

    # Try array format first, then old string format
    m_arr = re.search(r'^notify\s*=\s*\[([^\]]*)\]', content, re.MULTILINE)
    m_str = re.search(r'^notify\s*=\s*"([^"]*)"', content, re.MULTILINE)

    matched = None
    if m_arr and "helloagents" in m_arr.group(1):
        matched = r'^notify\s*=\s*\[[^\]]*\]\n?\n?'
    elif m_str and "helloagents" in m_str.group(1):
        matched = r'^notify\s*=\s*"[^"]*"\n?\n?'

    if not matched:
        return False

    content = re.sub(matched, '', content, count=1, flags=re.MULTILINE)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已移除 notify hook (config.toml)",
               "  Removed notify hook (config.toml)"))
    return True

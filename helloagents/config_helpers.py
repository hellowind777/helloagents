"""HelloAGENTS Config Helpers - CLI-specific configuration and hooks deployment."""

import re
from pathlib import Path

from .cli import (
    _msg,
    HOOKS_FINGERPRINT, CODEX_NOTIFY_CMD, PLUGIN_DIR_NAME,
    get_helloagents_module_path,
)


# ---------------------------------------------------------------------------
# Shared TOML helpers
# ---------------------------------------------------------------------------

def _insert_before_first_section(content: str, line: str) -> str:
    """Insert a line before the first TOML [section] header, or at the top.

    Adds a trailing blank line if inserting mid-file (before a section).
    """
    insert_pos = 0
    section_match = re.search(r'^\[[\w]', content, re.MULTILINE)
    if section_match:
        insert_pos = section_match.start()
    text = line + "\n"
    if insert_pos > 0:
        text += "\n"
    return content[:insert_pos] + text + content[insert_pos:]


# ---------------------------------------------------------------------------
# Codex config helper
# ---------------------------------------------------------------------------

def _configure_codex_toml(dest_dir: Path) -> None:
    """Ensure config.toml has project_doc_max_bytes >= 131072."""
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    # Already set and large enough — nothing to do
    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', content)
    if m and int(m.group(1)) >= 131072:
        return

    if m:
        # Exists but value is too small — replace it
        content = re.sub(
            r'project_doc_max_bytes\s*=\s*\d+',
            'project_doc_max_bytes = 131072',
            content)
    else:
        # Not present — insert before the first [section] or at the top
        content = _insert_before_first_section(
            content, "project_doc_max_bytes = 131072")

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 project_doc_max_bytes = 131072 (防止 AGENTS.md 被截断)",
               "  Configured project_doc_max_bytes = 131072 (prevent AGENTS.md truncation)"))


def _configure_codex_csv_batch(dest_dir: Path) -> None:
    """Ensure config.toml has multi-agent settings for spawn_agents_on_csv.

    - agents.max_threads: top-level, max concurrent sub-agents (>= 64)
    - agents.max_depth: top-level, sub-agent nesting depth (= 1)
    - sqlite: [features], CSV batch orchestration persistence
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")
    changed = False

    # --- agents.max_threads >= 64 (minimum required for CSV batch orchestration) ---
    # Enforces minimum: overwrites values < 64. This differs from max_depth which
    # only adds when absent, because max_threads has a hard minimum for CSV batching.
    m = re.search(r'agents\.max_threads\s*=\s*(\d+)', content)
    if m:
        if int(m.group(1)) < 64:
            content = re.sub(
                r'agents\.max_threads\s*=\s*\d+',
                'agents.max_threads = 64',
                content)
            changed = True
    else:
        content = _insert_before_first_section(
            content, "agents.max_threads = 64")
        changed = True

    # --- agents.max_depth = 1 (prevent deep nesting) ---
    # Only adds when absent — does NOT overwrite user-customized values, since
    # users may intentionally set deeper nesting for advanced workflows.
    md = re.search(r'agents\.max_depth\s*=\s*(\d+)', content)
    if not md:
        content = _insert_before_first_section(
            content, "agents.max_depth = 1")
        changed = True

    # --- [features] sqlite = true ---
    sqlite_added = False
    features_match = re.search(r'^\[features\]', content, re.MULTILINE)
    if features_match:
        sqlite_match = re.search(
            r'^sqlite\s*=', content[features_match.end():], re.MULTILINE)
        if not sqlite_match:
            # Find end of [features] section (next TOML [section] header or EOF)
            # Use ^\[[\w] to avoid matching TOML array values like ["..."]
            next_section = re.search(
                r'^\[[\w]', content[features_match.end():], re.MULTILINE)
            if next_section:
                pos = features_match.end() + next_section.start()
            else:
                pos = len(content)
            insert = "sqlite = true\n"
            content = content[:pos] + insert + content[pos:]
            changed = True
            sqlite_added = True
    else:
        # No [features] section — append one
        content = content.rstrip() + "\n\n[features]\nsqlite = true\n"
        changed = True
        sqlite_added = True

    if changed:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(content, encoding="utf-8")
        msgs = []
        if not m or int(m.group(1)) < 64:
            msgs.append("agents.max_threads = 64")
        if not md:
            msgs.append("agents.max_depth = 1")
        if sqlite_added:
            msgs.append("sqlite = true")
        print(_msg(
            f"  已配置多代理: {', '.join(msgs)}",
            f"  Configured multi-agent: {', '.join(msgs)}"))


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


def _resolve_hook_placeholders(hooks: dict, scripts_dir: str) -> dict:
    """Replace placeholders in hook commands with actual values.

    Resolves:
    - {SCRIPTS_DIR} → actual installed scripts path
    - python3 → platform-appropriate Python command (Windows: python)

    Uses recursive dict/list traversal instead of JSON string replacement
    to avoid issues with special characters in paths.
    """
    import sys
    win = sys.platform == "win32"

    def _replace(obj):
        if isinstance(obj, str):
            obj = obj.replace("{SCRIPTS_DIR}", scripts_dir)
            if win:
                obj = obj.replace("python3 ", "python ")
            return obj
        if isinstance(obj, dict):
            return {k: _replace(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_replace(item) for item in obj]
        return obj

    return _replace(hooks)


def _configure_claude_hooks(dest_dir: Path) -> None:
    """Merge HelloAGENTS hooks into Claude Code settings.json.

    - Preserves all user-defined hooks
    - Replaces old HelloAGENTS hooks with current version (idempotent)
    - Resolves {SCRIPTS_DIR} placeholder to actual installed scripts path
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

    # Resolve {SCRIPTS_DIR} to actual installed path
    scripts_path = (dest_dir / PLUGIN_DIR_NAME / "scripts").as_posix()
    our_hooks = _resolve_hook_placeholders(our_hooks, scripts_path)

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

    # Not present — add before first TOML [section] header or at top
    content = _insert_before_first_section(content, notify_line)

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


# ---------------------------------------------------------------------------
# Claude Code permissions helpers
# ---------------------------------------------------------------------------

# Fingerprint prefix to identify HelloAGENTS-managed permission entries
_PERM_FINGERPRINT = "HelloAGENTS:"

def _get_helloagents_permissions(dest_dir: Path) -> list[str]:
    """Return the list of permissions.allow entries HelloAGENTS needs.

    Based on Claude Code permission rule syntax:
    - Read operations are auto-approved (no rules needed)
    - Edit rules cover both Edit and Write tools (gitignore patterns)
    - Bash rules support glob with * wildcard
    - Path prefixes: ~/ = home, / = project root, ./ or bare = CWD

    Covers:
    - Script & RLM execution (Bash)
    - HelloAGENTS CLI commands (Bash)
    - Global config cache read via cat (Bash)
    - Project knowledge base writes (Edit)
    - Global config writes (Edit)
    """
    plugin_posix = (dest_dir / PLUGIN_DIR_NAME).as_posix()
    home_ha = "~/.helloagents"
    return [
        # Bash: Python script execution (with and without -X utf8)
        f'Bash(python "{plugin_posix}/scripts/*")',
        f'Bash(python -X utf8 "{plugin_posix}/scripts/*")',
        f'Bash(python "{plugin_posix}/rlm/*")',
        f'Bash(python -X utf8 "{plugin_posix}/rlm/*")',
        # Bash: CLI commands & cache read
        "Bash(helloagents *)",
        f"Bash(cat {home_ha}/*)",
        # Edit (covers Write too): project knowledge base
        "Edit(.helloagents/**)",
        # Edit: global config directory
        f"Edit({home_ha}/**)",
    ]


def _configure_claude_permissions(dest_dir: Path) -> None:
    """Add HelloAGENTS tool permissions to Claude Code settings.json.

    Merges into permissions.allow without duplicating or removing
    user-defined entries. Idempotent: re-running updates existing entries.
    """
    import json
    settings_path = dest_dir / "settings.json"

    settings = {}
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
        except Exception:
            return

    perms = settings.setdefault("permissions", {})
    allow = perms.setdefault("allow", [])

    our_entries = _get_helloagents_permissions(dest_dir)

    # Remove old HelloAGENTS entries (exact match), then add current ones
    allow[:] = [e for e in allow if e not in our_entries]
    allow.extend(our_entries)

    settings_path.write_text(
        json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    print(_msg(f"  已配置 {len(our_entries)} 条工具权限 (settings.json)",
               f"  Configured {len(our_entries)} tool permission(s) (settings.json)"))


def _remove_claude_permissions(dest_dir: Path) -> bool:
    """Remove HelloAGENTS tool permissions from Claude Code settings.json."""
    import json
    settings_path = dest_dir / "settings.json"
    if not settings_path.exists():
        return False

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    perms = settings.get("permissions", {})
    allow = perms.get("allow", [])
    if not allow:
        return False

    our_entries = set(_get_helloagents_permissions(dest_dir))
    new_allow = [e for e in allow if e not in our_entries]

    if len(new_allow) == len(allow):
        return False

    removed = len(allow) - len(new_allow)
    perms["allow"] = new_allow
    settings_path.write_text(
        json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    print(_msg(f"  已移除 {removed} 条 HelloAGENTS 工具权限 (settings.json)",
               f"  Removed {removed} HelloAGENTS tool permission(s) (settings.json)"))
    return True

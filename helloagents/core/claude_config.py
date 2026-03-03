"""HelloAGENTS Claude Config - Claude Code settings.json configuration helpers."""

import re
import sys
from pathlib import Path

from .._common import (
    _msg,
    HOOKS_FINGERPRINT, PLUGIN_DIR_NAME,
    HELLOAGENTS_RULE_MARKER,
    get_helloagents_module_path,
)


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
    except Exception as e:
        print(f"[HelloAGENTS] Warning: failed to parse hooks JSON: {e}",
              file=sys.stderr)
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
        hook_list[:] = [h for h in hook_list if not _is_helloagents_hook(h)]
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
            print(_msg(f"  ⚠ 无法写入 {settings_path}（文件被占用，请关闭 Claude Code 后重试）",
                       f"  ⚠ Cannot write {settings_path} (file locked, close Claude Code and retry)"))
            return False
        print(_msg(f"  已移除 {removed_count} 个 HelloAGENTS Hooks ({settings_path.name})",
                   f"  Removed {removed_count} HelloAGENTS hook(s) ({settings_path.name})"))
        return True
    return False


# ---------------------------------------------------------------------------
# Claude Code permissions helpers
# ---------------------------------------------------------------------------

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
    except Exception as e:
        print(_msg(f"  ⚠ 无法读取 {settings_path}: {e}",
                   f"  ⚠ Cannot read {settings_path}: {e}"))
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
    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg(f"  ⚠ 无法写入 {settings_path}（文件被占用，请关闭 Claude Code 后重试）",
                   f"  ⚠ Cannot write {settings_path} (file locked, close Claude Code and retry)"))
        return False
    print(_msg(f"  已移除 {removed} 条 HelloAGENTS 工具权限 (settings.json)",
               f"  Removed {removed} HelloAGENTS tool permission(s) (settings.json)"))
    return True


# ---------------------------------------------------------------------------
# Claude Code split rules deployment
# ---------------------------------------------------------------------------

# Mapping: output filename -> list of G section numbers
_RULE_FILE_MAP = {
    "config.md": [1, 2, 3],
    "stages.md": [5, 6, 7, 8],
    "subagent.md": [9, 10],
    "attention.md": [11, 12],
}

_RULE_MARKER_LINE = f"<!-- {HELLOAGENTS_RULE_MARKER} -->\n"


def _split_agents_md(content: str) -> dict[str, str]:
    """Split AGENTS.md content into root file and rule files.

    Splits by ``## G{N}`` section headers. Returns a dict mapping
    filename to content:

    - ``CLAUDE.md``:    preamble + G4
    - ``config.md``:    G1 + G2 + G3
    - ``stages.md``:    G5 + G6 + G7 + G8
    - ``subagent.md``:  G9 + G10
    - ``attention.md``: G11 + G12
    """
    pattern = re.compile(r'^## G(\d+)', re.MULTILINE)
    matches = list(pattern.finditer(content))

    if not matches:
        return {"CLAUDE.md": content}

    # Preamble: everything before first ## G section
    preamble = content[:matches[0].start()]

    # Extract each G section (from header to next header or EOF)
    sections: dict[int, str] = {}
    for i, m in enumerate(matches):
        g_num = int(m.group(1))
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        sections[g_num] = content[start:end]

    # Root file: preamble + G4
    result: dict[str, str] = {
        "CLAUDE.md": preamble + sections.get(4, ""),
    }

    # Rule files: grouped G sections with marker header
    for filename, g_nums in _RULE_FILE_MAP.items():
        parts = [_RULE_MARKER_LINE]
        for g in g_nums:
            if g in sections:
                parts.append(sections[g])
        result[filename] = "".join(parts)

    return result


def _deploy_claude_rules(dest_dir: Path, agents_md_path: Path) -> int:
    """Split AGENTS.md and deploy as root + rule files for Claude Code.

    Writes:
    - ``dest_dir/CLAUDE.md`` (preamble + G4)
    - ``dest_dir/rules/helloagents/*.md`` (grouped G sections)

    Returns the total number of files deployed.
    """
    content = agents_md_path.read_text(encoding="utf-8")
    files = _split_agents_md(content)

    # Write root file
    (dest_dir / "CLAUDE.md").write_text(files["CLAUDE.md"], encoding="utf-8")

    # Write rule files
    rules_dir = dest_dir / "rules" / "helloagents"
    rules_dir.mkdir(parents=True, exist_ok=True)
    count = 1  # CLAUDE.md already counted
    for filename, file_content in files.items():
        if filename == "CLAUDE.md":
            continue
        (rules_dir / filename).write_text(file_content, encoding="utf-8")
        count += 1

    return count


def _remove_claude_rules(dest_dir: Path) -> bool:
    """Remove HelloAGENTS split rule files from rules/helloagents/.

    Only removes files that contain the HELLOAGENTS_RULE marker.
    Cleans up empty parent directories afterwards.

    Returns True if any files were removed.
    """
    rules_dir = dest_dir / "rules" / "helloagents"
    if not rules_dir.exists():
        return False

    removed_any = False
    for f in rules_dir.glob("*.md"):
        try:
            head = f.read_text(encoding="utf-8", errors="ignore")[:256]
            if HELLOAGENTS_RULE_MARKER in head:
                f.unlink()
                removed_any = True
        except Exception:
            pass

    # Clean up empty directories
    if rules_dir.exists() and not any(rules_dir.iterdir()):
        rules_dir.rmdir()
        rules_parent = dest_dir / "rules"
        if rules_parent.exists() and not any(rules_parent.iterdir()):
            rules_parent.rmdir()

    if removed_any:
        print(_msg("  已移除拆分规则文件 (rules/helloagents/)",
                   "  Removed split rule files (rules/helloagents/)"))
    return removed_any

"""HelloAGENTS Claude Config - Claude Code settings.json configuration helpers."""

import json
import re
import sys
from pathlib import Path

from .._common import (
    _msg,
    PLUGIN_DIR_NAME,
    HELLOAGENTS_RULE_MARKER,
    get_helloagents_module_path,
    is_helloagents_hook as _is_helloagents_hook,
    resolve_hook_placeholders as _resolve_hook_placeholders,
)


# ---------------------------------------------------------------------------
# Hooks configuration helpers
# ---------------------------------------------------------------------------

def _load_hooks_source() -> dict:
    """Load HelloAGENTS hooks definition from the package."""
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


def _configure_claude_hooks(dest_dir: Path) -> None:
    """Merge HelloAGENTS hooks into Claude Code settings.json.

    - Preserves all user-defined hooks
    - Replaces old HelloAGENTS hooks with current version (idempotent)
    - Resolves {SCRIPTS_DIR} placeholder to actual installed scripts path
    - Identifies our hooks by HOOKS_FINGERPRINT in description field
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
    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用，请关闭 Claude Code 后重试）",
                   "  ⚠ Cannot write settings.json (file locked, close Claude Code and retry)"))
        return

    count = sum(len(v) for v in our_hooks.values())
    print(_msg(f"  已配置 {count} 个 Hooks ({settings_path.name})",
               f"  Configured {count} hook(s) ({settings_path.name})"))


def _remove_claude_hooks(dest_dir: Path) -> bool:
    """Remove HelloAGENTS hooks from Claude Code settings.json.

    Returns True if any hooks were removed.
    """
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
# Auto-memory configuration
# ---------------------------------------------------------------------------

def _configure_claude_auto_memory(dest_dir: Path) -> None:
    """在 settings.json 设置 autoMemoryEnabled: false，防止与 AGENTS.md 规则冲突。

    每次安装/更新都强制设为 false，即使用户手动改为 true。
    """
    settings_path = dest_dir / "settings.json"

    settings = {}
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
        except Exception:
            print(_msg("  ⚠ settings.json 格式异常，跳过 autoMemory 配置",
                       "  ⚠ settings.json malformed, skipping autoMemory config"))
            return

    settings["autoMemoryEnabled"] = False
    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用，请关闭 Claude Code 后重试）",
                   "  ⚠ Cannot write settings.json (file locked, close Claude Code and retry)"))
        return
    print(_msg("  已关闭 autoMemory (settings.json)",
               "  Disabled autoMemory (settings.json)"))


def _remove_claude_auto_memory(dest_dir: Path) -> bool:
    """卸载时删除 autoMemoryEnabled 键，恢复 Claude Code 默认行为。"""
    settings_path = dest_dir / "settings.json"
    if not settings_path.exists():
        return False

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    if "autoMemoryEnabled" not in settings:
        return False

    del settings["autoMemoryEnabled"]
    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用）",
                   "  ⚠ Cannot write settings.json (file locked)"))
        return False
    print(_msg("  已恢复 autoMemory 默认设置 (settings.json)",
               "  Restored autoMemory default (settings.json)"))
    return True


# ---------------------------------------------------------------------------
# Claude Code permissions helpers
# ---------------------------------------------------------------------------

def _get_helloagents_permissions(dest_dir: Path) -> list[str]:
    """Return the list of permissions.allow entries HelloAGENTS needs.

    Based on Claude Code permission rule syntax:
    - Read rules: needed for files outside the project directory
    - Edit rules cover both Edit and Write tools (gitignore patterns)
    - Bash rules support glob with ** for recursive matching
    - Path prefixes: ~/ = home, / = project root, ./ or bare = CWD

    Covers:
    - Module file reads (outside project dir, loaded by G7 on-demand rules)
    - Script & RLM execution (Bash, supports subdirectories)
    - HelloAGENTS CLI commands (Bash)
    - Global config cache read via cat (Bash)
    - Project knowledge base writes (Edit)
    - Global config writes (Edit)
    """
    plugin_posix = (dest_dir / PLUGIN_DIR_NAME).as_posix()
    dest_posix = dest_dir.as_posix()
    home_ha = "~/.helloagents"
    return [
        # Read: helloagents module files (loaded by G7 on-demand rules)
        f"Read({plugin_posix}/**)",
        # Read: split rule files (rules/helloagents/*.md)
        f"Read({dest_posix}/rules/helloagents/**)",
        # Read: global config/cache
        f"Read({home_ha}/**)",
        # Bash: Python script execution (with and without -X utf8, supports subdirectories)
        f'Bash(python "{plugin_posix}/scripts/**")',
        f'Bash(python -X utf8 "{plugin_posix}/scripts/**")',
        f'Bash(python "{plugin_posix}/rlm/**")',
        f'Bash(python -X utf8 "{plugin_posix}/rlm/**")',
        # Bash: CLI commands & cache read
        "Bash(helloagents *)",
        f"Bash(cat {home_ha}/*)",
        f"Bash(ls {plugin_posix}/**)",
        f"Bash(find {plugin_posix} *)",
        # Edit (covers Write too): plugin user data (memory, sessions, commands)
        f"Edit({plugin_posix}/user/**)",
        f"Edit({plugin_posix}/commands/**)",
        # Edit: project knowledge base
        "Edit(.helloagents/**)",
        # Edit: global config directory
        f"Edit({home_ha}/**)",
    ]


def _is_helloagents_permission(entry: str, dest_dir: Path) -> bool:
    """Check if a permission entry belongs to HelloAGENTS.

    Uses path pattern matching instead of exact string comparison,
    so old-version entries and user-modified entries are still identified.
    """
    plugin_posix = (dest_dir / PLUGIN_DIR_NAME).as_posix()
    dest_posix = dest_dir.as_posix()
    home_ha = "~/.helloagents"

    if plugin_posix in entry:
        return True
    if f"{dest_posix}/rules/helloagents" in entry:
        return True
    if home_ha in entry:
        return True
    if entry == "Edit(.helloagents/**)":
        return True
    if entry.startswith("Bash(helloagents "):
        return True
    return False


def _configure_claude_permissions(dest_dir: Path) -> None:
    """Add HelloAGENTS tool permissions to Claude Code settings.json.

    Uses pattern matching to identify and replace HelloAGENTS entries,
    so old-version or user-modified entries are properly cleaned up.
    Preserves user-defined entries that don't match HelloAGENTS patterns.
    """
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

    # Remove ALL HelloAGENTS entries (pattern match), then add current ones
    allow[:] = [e for e in allow
                if not _is_helloagents_permission(e, dest_dir)]
    allow.extend(our_entries)

    try:
        settings_path.write_text(
            json.dumps(settings, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8")
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用，请关闭 Claude Code 后重试）",
                   "  ⚠ Cannot write settings.json (file locked, close Claude Code and retry)"))
        return
    print(_msg(f"  已配置 {len(our_entries)} 条工具权限 (settings.json)",
               f"  Configured {len(our_entries)} tool permission(s) (settings.json)"))


def _remove_claude_permissions(dest_dir: Path) -> bool:
    """Remove HelloAGENTS tool permissions from Claude Code settings.json."""
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

    new_allow = [e for e in allow
                 if not _is_helloagents_permission(e, dest_dir)]

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
    "config.md": [1, 2, 3, 7],
    "stages.md": [5, 6, 8],
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

    # Verify split completeness: check that G4 exists in CLAUDE.md
    if "## G4" not in files.get("CLAUDE.md", ""):
        print(_msg("  ⚠ AGENTS.md 拆分警告: G4 章节未找到",
                   "  ⚠ AGENTS.md split warning: G4 section not found"))

    # Verify expected rule files were generated
    expected_files = set(_RULE_FILE_MAP.keys())
    actual_files = set(f for f in files.keys() if f != "CLAUDE.md")
    if expected_files != actual_files:
        print(_msg(f"  ⚠ 拆分规则文件不完整: 预期 {expected_files}, 实际 {actual_files}",
                   f"  ⚠ Incomplete rule files: expected {expected_files}, got {actual_files}"))

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

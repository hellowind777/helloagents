"""HelloAGENTS Codex Config - Codex CLI config.toml configuration helpers."""

import re
from pathlib import Path

from .._common import _msg, CODEX_NOTIFY_SCRIPT, PLUGIN_DIR_NAME, get_python_cmd


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
# Codex config.toml helpers
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


def _get_agents_section_val(content: str, key: str) -> int | None:
    """Get a key's integer value from a TOML ``[agents]`` section, or None."""
    sec = re.search(r'^\[agents\]', content, re.MULTILINE)
    if not sec:
        return None
    after = content[sec.end():]
    next_sec = re.search(r'^\[[\w]', after, re.MULTILINE)
    scope = after[:next_sec.start()] if next_sec else after
    m = re.search(rf'^{re.escape(key)}\s*=\s*(\d+)', scope, re.MULTILINE)
    return int(m.group(1)) if m else None


def _cleanup_codex_agents_dotted(content: str) -> tuple[str, bool]:
    """Remove dotted ``agents.xxx`` keys that conflict with ``[agents]`` section.

    Returns (cleaned_content, was_changed).
    """
    cleaned = content
    changed = False
    for dotted in ('agents.max_threads', 'agents.max_depth'):
        cleaned, n = re.subn(
            rf'^{re.escape(dotted)}\s*=\s*\d+\s*\n?', '',
            cleaned, flags=re.MULTILINE)
        if n:
            changed = True
    if changed:
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned, changed


def _ensure_agents_section(
    content: str,
    dotted_mt_val: int | None,
    dotted_md_val: int | None,
) -> tuple[str, bool, bool]:
    """Ensure ``[agents]`` section has max_threads >= 64 and max_depth.

    Returns (content, mt_changed, md_changed).
    """
    mt_changed = md_changed = False

    if not re.search(r'^\[agents\]', content, re.MULTILINE):
        first_sec = re.search(r'^\[[\w]', content, re.MULTILINE)
        mt_val = max(dotted_mt_val or 0, 64)
        md_val = dotted_md_val if dotted_md_val is not None else 1
        block = f"[agents]\nmax_threads = {mt_val}\nmax_depth = {md_val}\n\n"
        if first_sec:
            content = content[:first_sec.start()] + block + content[first_sec.start():]
        else:
            content = content.rstrip() + "\n\n" + block
        return content, True, True

    # max_threads >= 64
    mt_val = _get_agents_section_val(content, 'max_threads')
    if mt_val is None:
        val = max(dotted_mt_val or 0, 64)
        sec = re.search(r'^\[agents\]', content, re.MULTILINE)
        content = content[:sec.end()] + f'\nmax_threads = {val}' + content[sec.end():]
        mt_changed = True
    elif mt_val < 64:
        sec = re.search(r'^\[agents\]', content, re.MULTILINE)
        after = content[sec.end():]
        new_after = re.sub(
            r'^(max_threads\s*=\s*)\d+', r'\g<1>64',
            after, count=1, flags=re.MULTILINE)
        content = content[:sec.end()] + new_after
        mt_changed = True

    # max_depth (add if absent, don't overwrite)
    md_val = _get_agents_section_val(content, 'max_depth')
    if md_val is None:
        val = dotted_md_val if dotted_md_val is not None else 1
        sec = re.search(r'^\[agents\]', content, re.MULTILINE)
        content = content[:sec.end()] + f'\nmax_depth = {val}' + content[sec.end():]
        md_changed = True

    return content, mt_changed, md_changed


def _ensure_feature_bool(content: str, key: str) -> tuple[str, bool]:
    """Ensure ``[features]`` section has ``{key} = true``. Returns (content, changed)."""
    kv = f"{key} = true"
    feat = re.search(r'^\[features\]', content, re.MULTILINE)
    if feat:
        after = content[feat.end():]
        ns = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:ns.start()] if ns else after
        m = re.search(rf'^{re.escape(key)}\s*=\s*(\S+)', scope, re.MULTILINE)
        if m:
            if m.group(1) == "true":
                return content, False
            s = feat.end() + m.start()
            return content[:s] + kv + content[s + len(m.group(0)):], True
        ns2 = re.search(r'^\[[\w]', content[feat.end():], re.MULTILINE)
        pos = (feat.end() + ns2.start()) if ns2 else len(content)
        return content[:pos] + kv + "\n" + content[pos:], True
    return content.rstrip() + f"\n\n[features]\n{kv}\n", True


def _remove_feature_key(content: str, key: str) -> tuple[str, bool]:
    """Remove a key from ``[features]`` section. Returns (content, changed)."""
    feat = re.search(r'^\[features\]', content, re.MULTILINE)
    if not feat:
        return content, False
    after = content[feat.end():]
    ns = re.search(r'^\[[\w]', after, re.MULTILINE)
    scope = after[:ns.start()] if ns else after
    m = re.search(rf'^{re.escape(key)}\s*=\s*\S+\s*\n?', scope, re.MULTILINE)
    if not m:
        return content, False
    abs_start = feat.end() + m.start()
    abs_end = feat.end() + m.end()
    content = content[:abs_start] + content[abs_end:]
    # Clean up empty [features] section
    feat2 = re.search(r'^\[features\]\s*\n', content, re.MULTILINE)
    if feat2:
        after2 = content[feat2.end():]
        ns2 = re.search(r'^\[[\w]', after2, re.MULTILINE)
        scope2 = after2[:ns2.start()] if ns2 else after2
        if not scope2.strip():
            end2 = feat2.end() + (ns2.start() if ns2 else len(after2))
            content = content[:feat2.start()] + content[end2:]
    content = re.sub(r'\n{3,}', '\n\n', content)
    return content, True


def _configure_codex_csv_batch(dest_dir: Path) -> None:
    """Ensure config.toml has multi-agent settings for spawn_agents_on_csv.

    - ``[agents]`` max_threads >= 64, max_depth = 1
    - ``[features]`` enable_fanout = true (CSV batch orchestration)
    - Migrates dotted keys (``agents.max_threads``) into ``[agents]`` section
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")
    changed = False

    # Harvest dotted values before removing them
    dotted_mt = re.search(r'agents\.max_threads\s*=\s*(\d+)', content)
    dotted_md = re.search(r'agents\.max_depth\s*=\s*(\d+)', content)
    dotted_mt_val = int(dotted_mt.group(1)) if dotted_mt else None
    dotted_md_val = int(dotted_md.group(1)) if dotted_md else None

    content, did_clean = _cleanup_codex_agents_dotted(content)
    if did_clean:
        changed = True

    content, mt_changed, md_changed = _ensure_agents_section(
        content, dotted_mt_val, dotted_md_val)
    if mt_changed or md_changed:
        changed = True

    content, fanout_added = _ensure_feature_bool(content, "enable_fanout")
    if fanout_added:
        changed = True

    if changed:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(content, encoding="utf-8")
        msgs = []
        if mt_changed:
            final_mt = _get_agents_section_val(content, 'max_threads') or 64
            msgs.append(f"agents.max_threads = {final_mt}")
        if md_changed:
            final_md = _get_agents_section_val(content, 'max_depth') or 1
            msgs.append(f"agents.max_depth = {final_md}")
        if fanout_added:
            msgs.append("enable_fanout = true")
        if msgs:
            print(_msg(
                f"  已配置多代理: {', '.join(msgs)}",
                f"  Configured multi-agent: {', '.join(msgs)}"))


# ---------------------------------------------------------------------------
# Codex developer_instructions — elevate HelloAGENTS routing to developer role
# ---------------------------------------------------------------------------

_CODEX_DEVELOPER_INSTRUCTIONS = """\
CRITICAL: As the main agent, strictly follow HelloAGENTS protocol — never skip \
routing, evaluation, or G3 format rules. Spawned sub-agents are exempt: execute \
assigned tasks directly, without routing, evaluation, scoring, or G3 format.

If context was compressed during the session (previous messages were summarized, \
not at session start): Immediately read {KB_ROOT}/plan/*/tasks.md (specifically \
LIVE_STATUS section) to restore workflow state (all G6-defined state variables: \
workflow variables, task complexity variables, knowledge base and package \
variables). Combine restored state with current user input to determine actual \
current state and correct next action, avoiding incorrect re-evaluation or stage \
confusion. Continue from interruption point if workflow should proceed (user \
input is task-related or continuation request), or enter routing if user \
requests new task.\
"""

# Match developer_instructions = """...""" or "..." (top-level only)
_DI_RE = re.compile(
    r'^developer_instructions\s*=\s*(?:"{3}[\s\S]*?"{3}|"[^"]*")',
    re.MULTILINE,
)


def _configure_codex_developer_instructions(dest_dir: Path) -> None:
    """Ensure config.toml has developer_instructions with HelloAGENTS protocol."""
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    toml_val = f'developer_instructions = """\n{_CODEX_DEVELOPER_INSTRUCTIONS}\n"""'

    # Check if existing developer_instructions is user-defined (not ours)
    m = _DI_RE.search(content)
    if m:
        existing = m.group(0)
        if "HelloAGENTS" not in existing:
            # User-defined content — backup before overwriting
            backup_path = config_path.parent / "developer_instructions.bak"
            backup_path.write_text(existing, encoding="utf-8")
            print(_msg(
                f"  ⚠ 已备份现有 developer_instructions 到: {backup_path}",
                f"  ⚠ Backed up existing developer_instructions to: {backup_path}"))

    # Remove existing developer_instructions (ours or user's) and trailing blanks
    if m:
        end = m.end()
        while end < len(content) and content[end] in '\n\r':
            end += 1
        content = content[:m.start()] + content[end:]
        content = re.sub(r'\n{3,}', '\n\n', content)

    # Insert before notify (if exists) or before first section
    notify_match = re.search(r'^notify\s*=', content, re.MULTILINE)
    if notify_match:
        # Insert before notify
        content = content[:notify_match.start()] + toml_val + "\n\n" + content[notify_match.start():]
    else:
        # No notify, insert before first section
        first_section = re.search(r'^\[[\w]', content, re.MULTILINE)
        if first_section:
            content = content[:first_section.start()] + toml_val + "\n\n" + content[first_section.start():]
        else:
            # No sections, append at end
            content = content.rstrip() + "\n\n" + toml_val + "\n"

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 developer_instructions（HelloAGENTS 完整恢复协议）",
               "  Configured developer_instructions (HelloAGENTS recovery protocol)"))


def _remove_codex_developer_instructions(dest_dir: Path) -> bool:
    """Remove developer_instructions from config.toml. Returns True if removed."""
    config_path = dest_dir / "config.toml"
    if not config_path.exists():
        return False
    content = config_path.read_text(encoding="utf-8")

    m = _DI_RE.search(content)
    if not m:
        return False

    # Remove the entire key-value pair and trailing blank lines
    end = m.end()
    while end < len(content) and content[end] in '\n\r':
        end += 1
    content = content[:m.start()] + content[end:]
    content = re.sub(r'\n{3,}', '\n\n', content)

    config_path.write_text(content, encoding="utf-8")
    return True


# ---------------------------------------------------------------------------
# Codex notify hook
# ---------------------------------------------------------------------------

def _resolve_codex_notify_argv(dest_dir: Path) -> list[str]:
    """Resolve notify command to argv tokens for Codex CLI.

    Codex CLI ``notify`` is an argv array — each element is a separate token,
    and Codex appends the JSON payload as the last argument.
    """
    scripts_dir = (dest_dir / PLUGIN_DIR_NAME / "scripts").as_posix()
    script_path = f"{scripts_dir}/{CODEX_NOTIFY_SCRIPT}"
    return [get_python_cmd(), script_path]


def _configure_codex_notify(dest_dir: Path) -> None:
    """Add HelloAGENTS notify hook to Codex CLI config.toml.

    This key is fully managed by HelloAGENTS — any existing content is
    overwritten on install/update. User-defined notify will be backed up.
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    argv = _resolve_codex_notify_argv(dest_dir)
    # Format as TOML array: notify = ["python", "path/to/script.py"]
    toml_elements = ", ".join(f'"{token}"' for token in argv)
    notify_line = f'notify = [{toml_elements}]'

    # Check for existing notify (string or array format)
    m_str = re.search(r'^notify\s*=\s*"([^"]*)"', content, re.MULTILINE)
    m_arr = re.search(r'^notify\s*=\s*\[([^\]]*)\]', content, re.MULTILINE)

    existing = m_str or m_arr
    if existing:
        existing_val = existing.group(0)
        # Backup if user-defined (not HelloAGENTS)
        if "helloagents" not in existing_val.lower():
            backup_path = config_path.parent / "notify.bak"
            backup_path.write_text(existing_val, encoding="utf-8")
            print(_msg(f"  ⚠ 已备份现有 notify 到: {backup_path}",
                       f"  ⚠ Backed up existing notify to: {backup_path}"))

        # Remove existing notify (match trailing newline too)
        content = re.sub(r'^notify\s*=\s*(?:"[^"]*"|\[[^\]]*\])\s*\n?', '', content, count=1, flags=re.MULTILINE)

    # Add new notify
    content = _insert_before_first_section(content, notify_line)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 notify hook (config.toml)",
               "  Configured notify hook (config.toml)"))


def _remove_codex_notify(dest_dir: Path) -> bool:
    """Remove HelloAGENTS notify hook from config.toml. Returns True if removed."""
    config_path = dest_dir / "config.toml"
    if not config_path.exists():
        return False

    try:
        content = config_path.read_text(encoding="utf-8")
    except Exception as e:
        print(_msg(f"  ⚠ 无法读取 {config_path}: {e}",
                   f"  ⚠ Cannot read {config_path}: {e}"))
        return False

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
    try:
        config_path.write_text(content, encoding="utf-8")
    except PermissionError:
        print(_msg(f"  ⚠ 无法写入 {config_path}（文件被占用，请关闭 Codex CLI 后重试）",
                   f"  ⚠ Cannot write {config_path} (file locked, close Codex CLI and retry)"))
        return False
    print(_msg("  已移除 notify hook (config.toml)",
               "  Removed notify hook (config.toml)"))
    return True


# ---------------------------------------------------------------------------
# Codex TUI notification method (suppress BEL bell)
# ---------------------------------------------------------------------------

def _configure_codex_tui_notification(dest_dir: Path) -> None:
    """Set tui.notification_method = "osc9" to suppress BEL bell."""
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    # Check for existing notification_method (dotted or in [tui] section)
    dotted_match = re.search(r'tui\.notification_method\s*=\s*"([^"]*)"', content)

    tui_section_match = re.search(r'^\[tui\]', content, re.MULTILINE)
    section_match = None
    if tui_section_match:
        after = content[tui_section_match.end():]
        next_sec = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:next_sec.start()] if next_sec else after
        section_match = re.search(r'^notification_method\s*=\s*"([^"]*)"', scope, re.MULTILINE)

    existing = dotted_match or section_match
    if existing:
        existing_val = existing.group(1)
        # Backup if user-defined (not "osc9")
        if existing_val != "osc9":
            backup_path = config_path.parent / "tui_notification.bak"
            backup_path.write_text(f'notification_method = "{existing_val}"', encoding="utf-8")
            print(_msg(f"  ⚠ 已备份现有 tui.notification_method 到: {backup_path}",
                       f"  ⚠ Backed up existing tui.notification_method to: {backup_path}"))

        # Remove existing — section form first to avoid stale positions
        # (removing dotted form first would shift content, invalidating
        # tui_section_match/section_match positions captured above)
        if section_match and tui_section_match:
            start = tui_section_match.end() + section_match.start()
            end = start + len(section_match.group(0))
            content = content[:start] + content[end:]
            content = re.sub(r'\n{3,}', '\n\n', content)
        if dotted_match:
            content = re.sub(r'tui\.notification_method\s*=\s*"[^"]*"\s*\n?', '', content)

    # Add new value in [tui] section
    tui_match = re.search(r'^\[tui\]', content, re.MULTILINE)
    if tui_match:
        content = (content[:tui_match.end()]
                   + '\nnotification_method = "osc9"'
                   + content[tui_match.end():])
    else:
        section = '[tui]\nnotification_method = "osc9"\n'
        first_sec = re.search(r'^\[[\w]', content, re.MULTILINE)
        if first_sec:
            content = content[:first_sec.start()] + section + "\n" + content[first_sec.start():]
        else:
            content = content.rstrip() + "\n\n" + section

    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 tui.notification_method = osc9（抑制 BEL 铃声）",
               "  Configured tui.notification_method = osc9 (suppress BEL bell)"))


def _remove_codex_tui_notification(dest_dir: Path) -> bool:
    """Remove tui.notification_method from config.toml if "osc9". Returns True if removed."""
    config_path = dest_dir / "config.toml"
    if not config_path.exists():
        return False

    content = config_path.read_text(encoding="utf-8")

    # Only remove if it's our "osc9" value
    m = re.search(r'^notification_method\s*=\s*"osc9"\s*\n?', content, re.MULTILINE)
    if not m:
        # Also check dotted form
        m = re.search(r'^tui\.notification_method\s*=\s*"osc9"\s*\n?', content, re.MULTILINE)
    if not m:
        return False

    content = content[:m.start()] + content[m.end():]

    # Clean up empty [tui] section if nothing left in it
    tui_match = re.search(r'^\[tui\]\s*\n', content, re.MULTILINE)
    if tui_match:
        after = content[tui_match.end():]
        next_sec = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:next_sec.start()] if next_sec else after
        if not scope.strip():
            # Section is empty — remove it
            end = tui_match.end() + (next_sec.start() if next_sec else len(after))
            content = content[:tui_match.start()] + content[end:]

    content = re.sub(r'\n{3,}', '\n\n', content)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已移除 tui.notification_method (config.toml)",
               "  Removed tui.notification_method (config.toml)"))
    return True


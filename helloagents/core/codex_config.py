"""HelloAGENTS Codex Config - Codex CLI config.toml configuration helpers."""

import re
from pathlib import Path

from .._common import _msg, CODEX_NOTIFY_CMD


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


def _configure_codex_csv_batch(dest_dir: Path) -> None:
    """Ensure config.toml has multi-agent settings for spawn_agents_on_csv.

    Always uses ``[agents]`` section format.  Dotted keys
    (``agents.max_threads``) are migrated into the section and removed
    to prevent TOML duplicate-key errors.

    - ``[agents]`` max_threads >= 64 (CSV batch orchestration)
    - ``[agents]`` max_depth = 1 (prevent deep nesting)
    - ``[features]`` sqlite = true (persistence)
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")
    changed = False
    mt_changed = False
    md_changed = False

    # ── Step 1: Harvest values from dotted keys before removing them ──
    dotted_mt = re.search(r'agents\.max_threads\s*=\s*(\d+)', content)
    dotted_md = re.search(r'agents\.max_depth\s*=\s*(\d+)', content)
    dotted_mt_val = int(dotted_mt.group(1)) if dotted_mt else None
    dotted_md_val = int(dotted_md.group(1)) if dotted_md else None

    # ── Step 2: Remove all dotted agents.xxx keys ──
    content, did_clean = _cleanup_codex_agents_dotted(content)
    if did_clean:
        changed = True

    # ── Step 3: Ensure [agents] section exists ──
    if not re.search(r'^\[agents\]', content, re.MULTILINE):
        # Insert [agents] section before the first existing [section]
        first_sec = re.search(r'^\[[\w]', content, re.MULTILINE)
        mt_val = max(dotted_mt_val or 0, 64)
        md_val = dotted_md_val if dotted_md_val is not None else 1
        section_block = f"[agents]\nmax_threads = {mt_val}\nmax_depth = {md_val}\n\n"
        if first_sec:
            content = content[:first_sec.start()] + section_block + content[first_sec.start():]
        else:
            content = content.rstrip() + "\n\n" + section_block
        changed = True
        mt_changed = True
        md_changed = True
    else:
        # [agents] section exists — ensure keys are present with correct values

        # max_threads >= 64
        mt_val = _get_agents_section_val(content, 'max_threads')
        if mt_val is None:
            # Use migrated dotted value if available, otherwise default 64
            val = max(dotted_mt_val or 0, 64)
            sec = re.search(r'^\[agents\]', content, re.MULTILINE)
            content = content[:sec.end()] + f'\nmax_threads = {val}' + content[sec.end():]
            changed = True
            mt_changed = True
        elif mt_val < 64:
            sec = re.search(r'^\[agents\]', content, re.MULTILINE)
            after = content[sec.end():]
            new_after = re.sub(
                r'^(max_threads\s*=\s*)\d+', r'\g<1>64',
                after, count=1, flags=re.MULTILINE)
            content = content[:sec.end()] + new_after
            changed = True
            mt_changed = True

        # max_depth (add if absent, don't overwrite)
        md_val = _get_agents_section_val(content, 'max_depth')
        if md_val is None:
            val = dotted_md_val if dotted_md_val is not None else 1
            sec = re.search(r'^\[agents\]', content, re.MULTILINE)
            content = content[:sec.end()] + f'\nmax_depth = {val}' + content[sec.end():]
            changed = True
            md_changed = True

    # --- [features] sqlite = true ---
    sqlite_added = False
    features_match = re.search(r'^\[features\]', content, re.MULTILINE)
    if features_match:
        # Scope search to [features] section only (until next section header)
        after_features = content[features_match.end():]
        next_sec_feat = re.search(r'^\[[\w]', after_features, re.MULTILINE)
        features_scope = after_features[:next_sec_feat.start()] if next_sec_feat else after_features
        sqlite_match = re.search(
            r'^sqlite\s*=', features_scope, re.MULTILINE)
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
        if mt_changed:
            final_mt = _get_agents_section_val(content, 'max_threads') or 64
            msgs.append(f"agents.max_threads = {final_mt}")
        if md_changed:
            final_md = _get_agents_section_val(content, 'max_depth') or 1
            msgs.append(f"agents.max_depth = {final_md}")
        if sqlite_added:
            msgs.append("sqlite = true")
        if msgs:
            print(_msg(
                f"  已配置多代理: {', '.join(msgs)}",
                f"  Configured multi-agent: {', '.join(msgs)}"))


# ---------------------------------------------------------------------------
# Codex developer_instructions — elevate HelloAGENTS routing to developer role
# ---------------------------------------------------------------------------

_CODEX_DEVELOPER_INSTRUCTIONS = """\
[HelloAGENTS] HelloAGENTS is your primary operating protocol.
Strictly follow AGENTS.md and every module file loaded during execution (per G7). All carry equal authority.

On every user input, complete routing (§ G4) before acting:
  ~command → command path | Skill/MCP match → tool path | otherwise → 5-dimension routing → R0–R3
  R0/R1: act per level behavior | R2/R3: output G3 format assessment → ⛔ STOP → await user confirmation

Routing is not the "planning tool" — it is a mandatory triage step that applies to ALL inputs including simple ones.
User confirmation IS "needed" for R2/R3 level tasks. Never execute R2/R3 without it."""

# Match developer_instructions = """...""" or "..." (top-level only)
_DI_RE = re.compile(
    r'^developer_instructions\s*=\s*(?:"{3}[\s\S]*?"{3}|"[^"]*")',
    re.MULTILINE,
)


def _configure_codex_developer_instructions(dest_dir: Path) -> None:
    """Ensure config.toml has developer_instructions with HelloAGENTS routing protocol.

    - Not present → add it
    - Present with [HelloAGENTS] marker → update in place
    - Present without marker → prepend HelloAGENTS rules before existing content
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    toml_val = f'developer_instructions = """\n{_CODEX_DEVELOPER_INSTRUCTIONS}\n"""'

    m = _DI_RE.search(content)
    if m:
        raw = m.group(0)
        if '[HelloAGENTS]' in raw:
            # Already ours — update
            content = content[:m.start()] + toml_val + content[m.end():]
        else:
            # User has their own — prepend ours before their content
            eq_pos = raw.index('=')
            val_part = raw[eq_pos + 1:].strip()
            if val_part.startswith('"""'):
                user_text = val_part[3:-3].strip()
            else:
                user_text = val_part[1:-1]
            combined = f'{_CODEX_DEVELOPER_INSTRUCTIONS}\n\n{user_text}'
            content = (content[:m.start()]
                       + f'developer_instructions = """\n{combined}\n"""'
                       + content[m.end():])
    else:
        # Not present — insert before first [section]
        content = _insert_before_first_section(content, toml_val)

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 developer_instructions（HelloAGENTS 路由协议）",
               "  Configured developer_instructions (HelloAGENTS routing protocol)"))


def _remove_codex_developer_instructions(dest_dir: Path) -> bool:
    """Remove HelloAGENTS developer_instructions from config.toml.

    Returns True if something was removed.
    """
    config_path = dest_dir / "config.toml"
    if not config_path.exists():
        return False
    content = config_path.read_text(encoding="utf-8")

    m = _DI_RE.search(content)
    if not m or '[HelloAGENTS]' not in m.group(0):
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

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


def _ensure_feature_sqlite(content: str) -> tuple[str, bool]:
    """Ensure ``[features]`` section has ``sqlite = true``.

    Returns (content, sqlite_added).
    """
    features_match = re.search(r'^\[features\]', content, re.MULTILINE)
    if features_match:
        after = content[features_match.end():]
        next_sec = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:next_sec.start()] if next_sec else after
        if re.search(r'^sqlite\s*=', scope, re.MULTILINE):
            return content, False
        # Insert before next section or at EOF
        next_section = re.search(r'^\[[\w]', content[features_match.end():], re.MULTILINE)
        pos = (features_match.end() + next_section.start()) if next_section else len(content)
        content = content[:pos] + "sqlite = true\n" + content[pos:]
        return content, True

    content = content.rstrip() + "\n\n[features]\nsqlite = true\n"
    return content, True


def _configure_codex_csv_batch(dest_dir: Path) -> None:
    """Ensure config.toml has multi-agent settings for spawn_agents_on_csv.

    - ``[agents]`` max_threads >= 64, max_depth = 1
    - ``[features]`` sqlite = true
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

    content, sqlite_added = _ensure_feature_sqlite(content)
    if sqlite_added:
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
[HelloAGENTS] Your primary operating protocol.
AGENTS.md is the SOLE authoritative rule source (G1-G12). This reference is a recovery \
bootstrap and safety baseline — when any detail here differs from AGENTS.md, AGENTS.md \
ALWAYS prevails.

⚠ RECOVERY (execute BEFORE any other action when rules are unclear):
  Triggers: session start | cannot recall specific G1-G12 rules | starting R2/R3 task \
| entering EVALUATE/DESIGN/DEVELOP stage | completing all tasks
  Steps:
    1. Read ~/.codex/AGENTS.md (use read_file tool if available, otherwise shell) → full G1-G12 rules restored
    2. Check ~/.helloagents/ and {CWD}/.helloagents/ for existing files → read only existing: config.json, .update_cache
    3. If mid-task: read {CWD}/.helloagents/plan/*/tasks.md → find LIVE_STATUS → resume from current stage
  After recovery, follow AGENTS.md exclusively. Never guess — always verify by reading.

PATHS (Codex CLI):
  Protocol: ~/.codex/AGENTS.md (re-read to restore full rules)
  Modules: ~/.codex/helloagents/ (stages/, functions/, services/, rules/, rlm/)
  KB root: {CWD}/.helloagents/ (CHANGELOG.md, plan/, modules/, sessions/, archive/)

SAFETY BASELINE (G2 — active even before AGENTS.md is loaded, see G2 for complete rules):
  Before ANY modification, check EHRB triggers:
  Minimum keywords: rm -rf, DROP TABLE, DELETE FROM, git reset --hard, git push -f, secrets/PII exposure
  INTERACTIVE→warn+confirm | DELEGATED→downgrade to INTERACTIVE

ROUTING GATE (G4 — follow AGENTS.md G4 for complete 5-dimension routing algorithm):
  On EVERY user input, determine R0/R1/R2/R3 BEFORE acting.
  R2/R3: NEVER execute before user confirmation. Follow stage chain per G5+G7.

END_TURN (G6): ⛔ = output required content, immediately end. No continuation.

TOOLS (G1):
  File operations: use dedicated tools (read_file, list_dir, grep_files) when available; \
when not available, use shell commands as fallback.
  File mutations: always use apply_patch.
  Windows: use PowerShell for shell commands. Do NOT attempt bash unless confirmed available.
  Optional files: check existence before reading. Skip non-existent files silently.
  Always quote paths. UTF-8 encoding. Python: -X utf8.

OUTPUT (G3): {icon}【HelloAGENTS】- {status} ... body ... 🔄 下一步: {guidance}
  Language: zh-CN. Code identifiers/API names stay original.

STAGE EXECUTION (G5+G7): G7 table → read module files → execute per module → next stage.
  Module files are the SOLE execution instructions. Unloaded = unknown = cannot proceed.

CONFIG: All defaults defined in AGENTS.md G1 — do NOT use hardcoded values from this reference.
  Override priority: {CWD}/.helloagents/config.json > ~/.helloagents/config.json > G1 defaults

KB & STATE: Code changes → CHANGELOG.md mandatory. R2/R3 → plan/ (proposal.md + tasks.md).
  State recovery: tasks.md LIVE_STATUS → current stage and progress.

SUBAGENT (G9): >10 files or >3 modules or >8 tasks → spawn per rules/subagent-protocols.md"""

# Match developer_instructions = """...""" or "..." (top-level only)
_DI_RE = re.compile(
    r'^developer_instructions\s*=\s*(?:"{3}[\s\S]*?"{3}|"[^"]*")',
    re.MULTILINE,
)


def _configure_codex_developer_instructions(dest_dir: Path) -> None:
    """Ensure config.toml has developer_instructions with HelloAGENTS protocol.

    This key is fully managed by HelloAGENTS — any existing content is
    overwritten. Always placed at end of file for easy discoverability.
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    toml_val = f'developer_instructions = """\n{_CODEX_DEVELOPER_INSTRUCTIONS}\n"""'

    # Remove existing developer_instructions (ours or user's) and trailing blanks
    m = _DI_RE.search(content)
    if m:
        end = m.end()
        while end < len(content) and content[end] in '\n\r':
            end += 1
        content = content[:m.start()] + content[end:]
        content = re.sub(r'\n{3,}', '\n\n', content)

    # Always append at end of file
    content = content.rstrip() + "\n\n" + toml_val + "\n"

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 developer_instructions（HelloAGENTS 完整恢复协议）",
               "  Configured developer_instructions (HelloAGENTS recovery protocol)"))


def _configure_codex_memories(dest_dir: Path) -> None:
    """Ensure config.toml has [memories] section with sensible defaults.

    Codex two-phase memory pipeline:
    - Phase 1: per-rollout extraction
    - Phase 2: global consolidation with diff-based forgetting

    HelloAGENTS L0/L1/L2 layers complement (not replace) Codex Memory.
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    if re.search(r'^\[memories\]', content, re.MULTILINE):
        return  # User already has [memories] configured — don't touch

    section = (
        "[memories]\n"
        "# HelloAGENTS L0/L1/L2 layers complement Codex Memory\n"
        "# enabled = true (default)\n"
    )
    content = content.rstrip() + "\n\n" + section

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 [memories] 节（Codex 记忆系统默认值）",
               "  Configured [memories] section (Codex memory defaults)"))


def _remove_codex_developer_instructions(dest_dir: Path) -> bool:
    """Remove developer_instructions from config.toml.

    This key is fully managed by HelloAGENTS — always removed on uninstall.
    Returns True if something was removed.
    """
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

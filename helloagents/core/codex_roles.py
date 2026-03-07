"""HelloAGENTS Codex Roles - Agent role definitions for Codex CLI config.toml."""

import re
from pathlib import Path

from .._common import _msg


# ---------------------------------------------------------------------------
# TOML section helpers (used by role management)
# ---------------------------------------------------------------------------

def _toml_str_array(arr: list[str]) -> str:
    """Format a list of strings as a TOML inline array."""
    return "[" + ", ".join(f'"{s}"' for s in arr) + "]"


def _get_section_scope(content: str, section_name: str) -> tuple[int, int] | None:
    """Find the start and end of a TOML section's scope.

    Returns (section_header_start, scope_end) or None if not found.
    scope_end is the position of the next section header or EOF.
    """
    m = re.search(rf'^\[{re.escape(section_name)}\]', content, re.MULTILINE)
    if not m:
        return None
    after = content[m.end():]
    next_sec = re.search(r'^\[', after, re.MULTILINE)
    end = m.end() + (next_sec.start() if next_sec else len(after))
    return m.start(), end


def _upsert_key_in_section(
    content: str, section_name: str, key: str, value: str,
) -> tuple[str, bool]:
    """Update or insert a key within a TOML section.

    Returns (updated_content, changed).
    """
    bounds = _get_section_scope(content, section_name)
    if not bounds:
        return content, False

    sec_start, sec_end = bounds
    scope = content[sec_start:sec_end]

    key_pat = rf'^{re.escape(key)}\s*=\s*(?:\[[^\]]*\]|.*)'
    key_match = re.search(key_pat, scope, re.MULTILINE)

    new_line = f"{key} = {value}"

    if key_match:
        old_line = key_match.group(0)
        if old_line == new_line:
            return content, False
        abs_start = sec_start + key_match.start()
        abs_end = abs_start + len(old_line)
        return content[:abs_start] + new_line + content[abs_end:], True

    header_line_end = content.index('\n', sec_start) + 1
    return content[:header_line_end] + new_line + "\n" + content[header_line_end:], True


def _find_agents_group_end(content: str) -> int:
    """Find the insertion point after all [agents] and [agents.*] sections."""
    all_sections = list(re.finditer(r'^\[([^\]]+)\]', content, re.MULTILINE))
    last_agents_end = -1

    for i, m in enumerate(all_sections):
        name = m.group(1)
        if name == "agents" or name.startswith("agents."):
            if i + 1 < len(all_sections):
                next_start = all_sections[i + 1].start()
            else:
                next_start = len(content)
            last_agents_end = max(last_agents_end, next_start)

    return last_agents_end if last_agents_end >= 0 else len(content)


# ---------------------------------------------------------------------------
# Codex agent role definitions (nickname_candidates)
# ---------------------------------------------------------------------------

# HelloAGENTS-managed roles — only these sections are created/updated/removed.
# User-defined [agents.xxx] sections are never touched.
#
# Each role is registered as a distinct agent_type in config.toml, so
# spawn_agent(agent_type="{role}") picks up the correct nickname_candidates.
# Sub-agent routing exemption is handled by the parent developer_instructions
# (see codex_config.py) — no per-role config_file override needed.
_HA_AGENT_ROLES: list[tuple[str, dict]] = [
    ("explorer", {
        "description": "Codebase exploration and dependency analysis",
        "nickname_candidates": ["Scout", "Pathfinder", "Tracker"],
    }),
    ("worker", {
        "description": "Code implementation and modification",
        "nickname_candidates": ["Builder", "Forge", "Smith"],
    }),
    ("monitor", {
        "description": "Long-running monitoring and polling tasks",
        "nickname_candidates": ["Watcher", "Radar", "Lookout"],
    }),
    ("reviewer", {
        "description": "Code review and quality inspection",
        "nickname_candidates": ["Inspector", "Sentinel", "Auditor"],
    }),
    ("writer", {
        "description": "Standalone document generation",
        "nickname_candidates": ["Scribe", "Quill", "Chronicler"],
    }),
    ("brainstormer", {
        "description": "Proposal brainstorming specialist for multi-proposal comparison",
        "nickname_candidates": ["Muse", "Ideator", "Catalyst"],
    }),
]


def _configure_codex_agent_roles(dest_dir: Path) -> None:
    """Write HelloAGENTS agent role definitions to config.toml.

    Creates missing [agents.{role}] sections with description and
    nickname_candidates.  Updates managed keys on existing sections while
    preserving user-added keys (model, etc.).
    """
    config_path = dest_dir / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    created: list[str] = []
    updated: list[str] = []

    for role, cfg in _HA_AGENT_ROLES:
        section_name = f"agents.{role}"

        if _get_section_scope(content, section_name) is not None:
            # Section exists — update managed keys only
            role_changed = False

            nick_val = _toml_str_array(cfg["nickname_candidates"])
            content, changed = _upsert_key_in_section(
                content, section_name, "nickname_candidates", nick_val)
            role_changed = role_changed or changed

            content, changed = _upsert_key_in_section(
                content, section_name, "description",
                f'"{cfg["description"]}"')
            role_changed = role_changed or changed

            if role_changed:
                updated.append(role)
        else:
            # Section doesn't exist — create with all managed keys
            lines = [
                f"[agents.{role}]",
                f'description = "{cfg["description"]}"',
                f'nickname_candidates = {_toml_str_array(cfg["nickname_candidates"])}',
            ]
            section_text = "\n".join(lines)

            insert_pos = _find_agents_group_end(content)
            before = content[:insert_pos].rstrip("\n")
            after_text = content[insert_pos:].lstrip("\n")

            if after_text:
                content = before + "\n\n" + section_text + "\n\n" + after_text
            else:
                content = before + "\n\n" + section_text + "\n"

            created.append(role)

    if created or updated:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(content, encoding="utf-8")
        cn_parts: list[str] = []
        en_parts: list[str] = []
        if created:
            cn_parts.append(f"新增 {len(created)} 个")
            en_parts.append(f"created {len(created)}")
        if updated:
            cn_parts.append(f"更新 {len(updated)} 个")
            en_parts.append(f"updated {len(updated)}")
        all_roles = created + updated
        print(_msg(
            f"  已配置子代理角色: {', '.join(cn_parts)} ({', '.join(all_roles)})",
            f"  Configured agent roles: {', '.join(en_parts)} ({', '.join(all_roles)})"))
    else:
        print(_msg("  子代理角色配置已是最新",
                    "  Agent roles config is up to date"))

def _remove_codex_agent_roles(dest_dir: Path) -> bool:
    """Remove HelloAGENTS-managed agent role sections from config.toml.

    Only removes sections for known HA roles; user-defined roles are preserved.
    Also cleans up legacy role TOML config files if present.
    Returns True if any sections were removed.
    """
    config_path = dest_dir / "config.toml"
    removed_sections = False

    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")
        removed: list[str] = []

        for role, _ in _HA_AGENT_ROLES:
            section_name = f"agents.{role}"
            bounds = _get_section_scope(content, section_name)
            if bounds:
                sec_start, sec_end = bounds
                content = content[:sec_start] + content[sec_end:]
                content = re.sub(r'\n{3,}', '\n\n', content)
                removed.append(role)

        if removed:
            content = content.rstrip("\n") + "\n"
            config_path.write_text(content, encoding="utf-8")
            print(_msg(
                f"  已移除 {len(removed)} 个子代理角色定义 ({', '.join(removed)})",
                f"  Removed {len(removed)} agent role definition(s) ({', '.join(removed)})"))
            removed_sections = True

    # Clean up legacy role TOML config files (from older versions)
    roles_dir = dest_dir / "roles"
    if roles_dir.exists():
        for role, _ in _HA_AGENT_ROLES:
            toml_path = roles_dir / f"{role}.toml"
            if toml_path.exists():
                toml_path.unlink()
        try:
            if not any(roles_dir.iterdir()):
                roles_dir.rmdir()
        except OSError:
            pass

    return removed_sections

"""HelloAGENTS Claude Rules - AGENTS.md splitting and rule deployment for Claude Code."""

import re
from pathlib import Path

from .._common import _msg, HELLOAGENTS_RULE_MARKER


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
    - ``config.md``:    G1 + G2 + G3 + G7
    - ``stages.md``:    G5 + G6 + G8
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

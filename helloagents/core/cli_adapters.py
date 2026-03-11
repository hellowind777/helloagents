"""HelloAGENTS CLI Adapters - Unified CLI configuration for all supported platforms.

Consolidated from: claude_config, claude_rules, settings_hooks, codex_config, codex_roles.
"""

import json
import re
import sys
from pathlib import Path

from .._common import (
    _msg, HELLOAGENTS_HOME,
    HOOKS_FINGERPRINT, CODEX_NOTIFY_SCRIPT,
    GEMINI_HOOKS_JSON, GROK_HOOKS_JSON,
    get_helloagents_module_path, get_python_cmd,
    is_helloagents_hook, resolve_hook_placeholders,
)


# ═══════════════════════════════════════════════════════════════════════════
# Shared helpers
# ═══════════════════════════════════════════════════════════════════════════

def _read_settings(dest_dir: Path) -> tuple[Path, dict]:
    sp = dest_dir / "settings.json"
    if not sp.exists():
        return sp, {}
    try:
        return sp, json.loads(sp.read_text(encoding="utf-8"))
    except Exception:
        return sp, {}


def _write_settings(sp: Path, data: dict) -> bool:
    try:
        sp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        return True
    except PermissionError:
        print(_msg("  ⚠ 无法写入 settings.json（文件被占用）",
                   "  ⚠ Cannot write settings.json (file locked)"))
        return False


def _toml_insert_before_section(content: str, line: str) -> str:
    """Insert a top-level key=value line before the first [section] header.

    If no section header exists, append to the end of the file.
    """
    m = re.search(r'^\[[\w]', content, re.MULTILINE)
    if m:
        return content[:m.start()] + line + "\n\n" + content[m.start():]
    # No section headers — append to end
    return content.rstrip() + ("\n" if content.strip() else "") + line + "\n"


# ═══════════════════════════════════════════════════════════════════════════
# Bootstrap deployment
# ═══════════════════════════════════════════════════════════════════════════

def deploy_bootstrap(dest_dir: Path, bootstrap_path: Path,
                     rules_filename: str = "CLAUDE.md") -> int:
    (dest_dir / rules_filename).write_text(
        bootstrap_path.read_text(encoding="utf-8"), encoding="utf-8")
    return 1



# ═══════════════════════════════════════════════════════════════════════════
# Settings.json hooks (Claude / Gemini / Qwen / Grok)
# ═══════════════════════════════════════════════════════════════════════════

def _load_hooks_json(name: str) -> dict:
    f = get_helloagents_module_path() / "hooks" / name
    if not f.exists():
        return {}
    try:
        return json.loads(f.read_text(encoding="utf-8")).get("hooks", {})
    except Exception:
        return {}


def configure_settings_hooks(dest_dir: Path, hooks_json_name: str) -> None:
    sp, settings = _read_settings(dest_dir)
    our = _load_hooks_json(hooks_json_name)
    if not our:
        return
    our = resolve_hook_placeholders(our, (HELLOAGENTS_HOME / "scripts").as_posix())
    existing = settings.get("hooks", {})
    for event, entries in our.items():
        existing[event] = [h for h in existing.get(event, [])
                           if not is_helloagents_hook(h)] + entries
    settings["hooks"] = existing
    if _write_settings(sp, settings):
        n = sum(len(v) for v in our.values())
        print(_msg(f"  已配置 {n} 个 Hooks", f"  Configured {n} hook(s)"))


def remove_settings_hooks(dest_dir: Path) -> bool:
    sp, settings = _read_settings(dest_dir)
    hooks = settings.get("hooks")
    if not hooks or not isinstance(hooks, dict):
        return False
    removed = 0
    empty = []
    for event, lst in hooks.items():
        if not isinstance(lst, list):
            continue
        orig = len(lst)
        lst[:] = [h for h in lst if not is_helloagents_hook(h)]
        removed += orig - len(lst)
        if not lst:
            empty.append(event)
    for e in empty:
        del hooks[e]
    if not hooks:
        del settings["hooks"]
    if removed > 0 and _write_settings(sp, settings):
        print(_msg(f"  已移除 {removed} 个 Hooks", f"  Removed {removed} hook(s)"))
        return True
    return False


# CLI wrappers
def configure_claude_hooks(d): configure_settings_hooks(d, "claude_code_hooks.json")
def remove_claude_hooks(d): return remove_settings_hooks(d)
def configure_gemini_hooks(d): configure_settings_hooks(d, GEMINI_HOOKS_JSON)
def remove_gemini_hooks(d): return remove_settings_hooks(d)
def configure_qwen_hooks(d): configure_settings_hooks(d, GEMINI_HOOKS_JSON)
def remove_qwen_hooks(d): return remove_settings_hooks(d)
def configure_grok_hooks(d): configure_settings_hooks(d, GROK_HOOKS_JSON)
def remove_grok_hooks(d): return remove_settings_hooks(d)


# ═══════════════════════════════════════════════════════════════════════════
# Claude Code: auto-memory + permissions
# ═══════════════════════════════════════════════════════════════════════════

def configure_claude_auto_memory(dest_dir: Path) -> None:
    sp, s = _read_settings(dest_dir)
    s["autoMemoryEnabled"] = False
    if _write_settings(sp, s):
        print(_msg("  已关闭 autoMemory", "  Disabled autoMemory"))

def remove_claude_auto_memory(dest_dir: Path) -> bool:
    sp, s = _read_settings(dest_dir)
    if "autoMemoryEnabled" not in s:
        return False
    del s["autoMemoryEnabled"]
    return _write_settings(sp, s)


def get_helloagents_permissions(dest_dir: Path) -> list[str]:
    h = HELLOAGENTS_HOME.as_posix()
    t = "~/.helloagents"
    return [
        f"Read({h}/**)", f"Read({t}/**)",
        f'Bash(python "{h}/scripts/**")', f'Bash(python -X utf8 "{h}/scripts/**")',
        "Bash(helloagents *)", f"Bash(cat {t}/*)", f"Bash(ls {h}/**)", f"Bash(find {h} *)",
        f"Edit({h}/user/**)", f"Edit({t}/user/**)", "Edit(.helloagents/**)", f"Edit({h}/**)",
    ]


def _is_ha_perm(entry: str, dest_dir: Path) -> bool:
    h = HELLOAGENTS_HOME.as_posix()
    return (h in entry or "~/.helloagents" in entry
            or entry == "Edit(.helloagents/**)" or entry.startswith("Bash(helloagents "))


def configure_claude_permissions(dest_dir: Path) -> None:
    sp, s = _read_settings(dest_dir)
    allow = s.setdefault("permissions", {}).setdefault("allow", [])
    ours = get_helloagents_permissions(dest_dir)
    allow[:] = [e for e in allow if not _is_ha_perm(e, dest_dir)] + ours
    if _write_settings(sp, s):
        print(_msg(f"  已配置 {len(ours)} 条权限", f"  Configured {len(ours)} permission(s)"))


def remove_claude_permissions(dest_dir: Path) -> bool:
    sp, s = _read_settings(dest_dir)
    allow = s.get("permissions", {}).get("allow", [])
    if not allow:
        return False
    new = [e for e in allow if not _is_ha_perm(e, dest_dir)]
    if len(new) == len(allow):
        return False
    s["permissions"]["allow"] = new
    return _write_settings(sp, s)


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: config.toml helpers
# ═══════════════════════════════════════════════════════════════════════════

def _toml_section_val(content, section, key):
    m = re.search(rf'^\[{re.escape(section)}\]', content, re.MULTILINE)
    if not m:
        return None
    after = content[m.end():]
    ns = re.search(r'^\[[\w]', after, re.MULTILINE)
    scope = after[:ns.start()] if ns else after
    km = re.search(rf'^{re.escape(key)}\s*=\s*(\S+)', scope, re.MULTILINE)
    return km.group(1) if km else None


def _toml_read(dest_dir):
    p = dest_dir / "config.toml"
    return p, (p.read_text(encoding="utf-8") if p.exists() else "")


def _toml_write(p, content):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")



# ---------------------------------------------------------------------------
# Codex config.toml: content-level transforms (no file I/O)
#
# Each _apply_* function takes a content string and returns (content, changed).
# They are composed by configure_codex_all() which does a single read/write.
# ---------------------------------------------------------------------------

def _apply_project_doc_max_bytes(c: str) -> tuple[str, bool]:
    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', c)
    if m and int(m.group(1)) >= 131072:
        return c, False
    if m:
        return re.sub(r'project_doc_max_bytes\s*=\s*\d+', 'project_doc_max_bytes = 131072', c), True
    return _toml_insert_before_section(c, "project_doc_max_bytes = 131072"), True


def _apply_notify(c: str, dest_dir: Path) -> tuple[str, bool]:
    sd = (HELLOAGENTS_HOME / "scripts").as_posix()
    argv = [get_python_cmd(), f"{sd}/{CODEX_NOTIFY_SCRIPT}"]
    line = 'notify = [' + ", ".join(f'"{t}"' for t in argv) + ']'
    existing = re.search(r'^notify\s*=\s*(?:"[^"]*"|\[[^\]]*\])', c, re.MULTILINE)
    if existing:
        if "helloagents" not in existing.group(0).lower():
            bak = dest_dir / "notify.bak"
            bak.write_text(existing.group(0), encoding="utf-8")
        c = re.sub(r'^notify\s*=\s*(?:"[^"]*"|\[[^\]]*\])\s*\n?', '', c, count=1, flags=re.MULTILINE)
    return _toml_insert_before_section(c, line), True


def _apply_tui_notification(c: str) -> tuple[str, bool]:
    for pat in (r'tui\.notification_method\s*=\s*"[^"]*"\s*\n?',
                r'^notification_method\s*=\s*"[^"]*"\s*\n?'):
        c = re.sub(pat, '', c, flags=re.MULTILINE)
    tui = re.search(r'^\[tui\]', c, re.MULTILINE)
    if tui:
        c = c[:tui.end()] + '\nnotification_method = "osc9"' + c[tui.end():]
    else:
        m = re.search(r'^\[[\w]', c, re.MULTILINE)
        section = '[tui]\nnotification_method = "osc9"\n'
        c = (c[:m.start()] + section + "\n" + c[m.start():]) if m else c.rstrip() + "\n\n" + section
    return c, True


def _apply_csv_batch(c: str) -> tuple[str, bool]:
    changed = False
    c, mt, md = _ensure_agents_section(c, None, None)
    changed = changed or mt or md
    for feat in ("sqlite", "collaboration_modes"):
        c, added = _ensure_feature(c, feat)
        changed = changed or added
    return c, changed


def _apply_developer_instructions(c: str, dest_dir: Path) -> tuple[str, bool]:
    toml_val = f'developer_instructions = """\n{_DI_TEXT}\n"""'
    m = _DI_RE.search(c)
    if m:
        if "HelloAGENTS" not in m.group(0):
            (dest_dir / "developer_instructions.bak").write_text(m.group(0), encoding="utf-8")
        end = m.end()
        while end < len(c) and c[end] in '\n\r':
            end += 1
        c = re.sub(r'\n{3,}', '\n\n', c[:m.start()] + c[end:])
    return _toml_insert_before_section(c, toml_val), True



def _ensure_agents_section(content, dot_mt, dot_md):
    mt_ch = md_ch = False
    if not re.search(r'^\[agents\]', content, re.MULTILINE):
        mt = max(dot_mt or 0, 64)
        md = dot_md if dot_md is not None else 1
        block = f"[agents]\nmax_threads = {mt}\nmax_depth = {md}\n\n"
        m = re.search(r'^\[[\w]', content, re.MULTILINE)
        content = (content[:m.start()] + block + content[m.start():] if m
                   else content.rstrip() + "\n\n" + block)
        return content, True, True
    for key, dot_val, minimum in [('max_threads', dot_mt, 64), ('max_depth', dot_md, None)]:
        val = _toml_section_val(content, 'agents', key)
        if val is None:
            v = max(dot_val or 0, minimum) if minimum else (dot_val if dot_val is not None else 1)
            m = re.search(r'^\[agents\]', content, re.MULTILINE)
            content = content[:m.end()] + f'\n{key} = {v}' + content[m.end():]
            if key == 'max_threads': mt_ch = True
            else: md_ch = True
        elif minimum and int(val) < minimum:
            m = re.search(r'^\[agents\]', content, re.MULTILINE)
            after = content[m.end():]
            after = re.sub(rf'^({re.escape(key)}\s*=\s*)\d+', rf'\g<1>{minimum}',
                           after, count=1, flags=re.MULTILINE)
            content = content[:m.end()] + after
            mt_ch = True
    return content, mt_ch, md_ch


def _ensure_feature(content, key):
    kv = f"{key} = true"
    feat = re.search(r'^\[features\]', content, re.MULTILINE)
    if feat:
        after = content[feat.end():]
        ns = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:ns.start()] if ns else after
        m = re.search(rf'^{re.escape(key)}\s*=\s*(\S+)', scope, re.MULTILINE)
        if m:
            return (content, False) if m.group(1) == "true" else (
                content[:feat.end() + m.start()] + kv + content[feat.end() + m.start() + len(m.group(0)):], True)
        ns2 = re.search(r'^\[[\w]', content[feat.end():], re.MULTILINE)
        pos = (feat.end() + ns2.start()) if ns2 else len(content)
        return content[:pos] + kv + "\n" + content[pos:], True
    return content.rstrip() + f"\n\n[features]\n{kv}\n", True


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: developer_instructions
# ═══════════════════════════════════════════════════════════════════════════

_DI_TEXT = """\
CRITICAL: As the main agent, strictly follow HelloAGENTS protocol — never skip \
routing, evaluation, or G3 format rules. Spawned sub-agents are exempt: execute \
assigned tasks directly, without routing, evaluation, scoring, or G3 format.

If context was compressed during the session (previous messages were summarized, \
not at session start): Immediately read {KB_ROOT}/plan/*/tasks.md (specifically \
LIVE_STATUS section) to restore workflow state. Continue from interruption point \
if workflow should proceed, or enter routing if user requests new task.\
"""

_DI_RE = re.compile(r'^developer_instructions\s*=\s*(?:"{3}[\s\S]*?"{3}|"[^"]*")', re.MULTILINE)


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: unified configure (single read → all transforms → single write)
# ═══════════════════════════════════════════════════════════════════════════

def configure_codex_all(dest_dir: Path) -> None:
    """Apply all Codex config.toml settings in a single read/write cycle.

    This prevents cascading corruption from multiple independent read/write
    cycles, and creates a backup before any modifications.
    """
    import shutil
    p, c = _toml_read(dest_dir)
    original = c

    # Backup before modification (only if file has content)
    if c.strip():
        bak = p.parent / "config.toml.bak"
        try:
            shutil.copy2(p, bak)
        except Exception:
            pass

    steps = []

    # 1. project_doc_max_bytes
    c, changed = _apply_project_doc_max_bytes(c)
    if changed:
        steps.append("project_doc_max_bytes")

    # 2. notify hook
    c, changed = _apply_notify(c, dest_dir)
    if changed:
        steps.append("notify")

    # 3. TUI notification
    c, changed = _apply_tui_notification(c)
    if changed:
        steps.append("tui_notification")

    # 4. CSV batch (agents section + features)
    c, changed = _apply_csv_batch(c)
    if changed:
        steps.append("csv_batch")

    # 5. developer_instructions
    c, changed = _apply_developer_instructions(c, dest_dir)
    if changed:
        steps.append("developer_instructions")

    # Single write
    if c != original:
        # Final cleanup: collapse excessive blank lines
        c = re.sub(r'\n{3,}', '\n\n', c)
        _toml_write(p, c)
        print(_msg(f"  已配置 config.toml ({', '.join(steps)})",
                   f"  Configured config.toml ({', '.join(steps)})"))


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: remove functions (used by uninstaller)
# ═══════════════════════════════════════════════════════════════════════════

def remove_codex_developer_instructions(dest_dir: Path) -> bool:
    p, c = _toml_read(dest_dir)
    m = _DI_RE.search(c)
    if not m:
        return False
    end = m.end()
    while end < len(c) and c[end] in '\n\r':
        end += 1
    _toml_write(p, re.sub(r'\n{3,}', '\n\n', c[:m.start()] + c[end:]))
    return True


def remove_codex_notify(dest_dir: Path) -> bool:
    p, c = _toml_read(dest_dir)
    for pat, check in [(r'^notify\s*=\s*\[([^\]]*)\]', lambda m: "helloagents" in m.group(1)),
                        (r'^notify\s*=\s*"([^"]*)"', lambda m: "helloagents" in m.group(1))]:
        m = re.search(pat, c, re.MULTILINE)
        if m and check(m):
            c = re.sub(pat + r'\n?\n?', '', c, count=1, flags=re.MULTILINE)
            _toml_write(p, c)
            return True
    return False


def remove_codex_tui_notification(dest_dir: Path) -> bool:
    p, c = _toml_read(dest_dir)
    m = re.search(r'^notification_method\s*=\s*"osc9"\s*\n?', c, re.MULTILINE)
    if not m:
        m = re.search(r'^tui\.notification_method\s*=\s*"osc9"\s*\n?', c, re.MULTILINE)
    if not m:
        return False
    c = c[:m.start()] + c[m.end():]
    # Remove empty [tui] section
    tui = re.search(r'^\[tui\]\s*\n', c, re.MULTILINE)
    if tui:
        after = c[tui.end():]
        ns = re.search(r'^\[[\w]', after, re.MULTILINE)
        scope = after[:ns.start()] if ns else after
        if not scope.strip():
            end = tui.end() + (ns.start() if ns else len(after))
            c = c[:tui.start()] + c[end:]
    _toml_write(p, re.sub(r'\n{3,}', '\n\n', c))
    return True


def _section_bounds(content, name):
    m = re.search(rf'^\[{re.escape(name)}\]', content, re.MULTILINE)
    if not m:
        return None
    ns = re.search(r'^\[[\w]', content[m.end():], re.MULTILINE)
    return m.start(), m.end() + (ns.start() if ns else len(content[m.end():]))


_ROLES = [
    ("explorer", "Codebase exploration and dependency analysis"),
    ("worker", "Code implementation and modification"),
    ("monitor", "Long-running monitoring and polling tasks"),
    ("reviewer", "Code review and quality inspection"),
    ("writer", "Standalone document generation"),
    ("brainstormer", "Proposal brainstorming specialist"),
]


def remove_codex_agent_roles(dest_dir: Path) -> bool:
    """Remove [agents.xxx] role sections from config.toml."""
    p, c = _toml_read(dest_dir)
    removed = []
    for role, _ in _ROLES:
        bounds = _section_bounds(c, f"agents.{role}")
        if bounds:
            c = re.sub(r'\n{3,}', '\n\n', c[:bounds[0]] + c[bounds[1]:])
            removed.append(role)
    if removed:
        _toml_write(p, c.rstrip("\n") + "\n")
        print(_msg(f"  已移除 {len(removed)} 个角色", f"  Removed {len(removed)} role(s)"))
    return bool(removed)

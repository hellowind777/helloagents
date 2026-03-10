"""HelloAGENTS CLI Adapters - Unified CLI configuration for all supported platforms.

Consolidated from: claude_config, claude_rules, settings_hooks, codex_config, codex_roles.
"""

import json
import re
import sys
from pathlib import Path

from .._common import (
    _msg, HELLOAGENTS_HOME, HELLOAGENTS_RULE_MARKER,
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
    m = re.search(r'^\[[\w]', content, re.MULTILINE)
    pos = m.start() if m else 0
    text = line + "\n" + ("\n" if pos > 0 else "")
    return content[:pos] + text + content[pos:]


# ═══════════════════════════════════════════════════════════════════════════
# Bootstrap deployment
# ═══════════════════════════════════════════════════════════════════════════

def deploy_bootstrap(dest_dir: Path, bootstrap_path: Path,
                     rules_filename: str = "CLAUDE.md") -> int:
    (dest_dir / rules_filename).write_text(
        bootstrap_path.read_text(encoding="utf-8"), encoding="utf-8")
    return 1


def remove_legacy_rules(dest_dir: Path) -> bool:
    rules_dir = dest_dir / "rules" / "helloagents"
    if not rules_dir.exists():
        return False
    removed = False
    for f in rules_dir.glob("*.md"):
        if HELLOAGENTS_RULE_MARKER in f.read_text(encoding="utf-8", errors="ignore")[:256]:
            f.unlink()
            removed = True
    if rules_dir.exists() and not any(rules_dir.iterdir()):
        rules_dir.rmdir()
        p = dest_dir / "rules"
        if p.exists() and not any(p.iterdir()):
            p.rmdir()
    if removed:
        print(_msg("  已移除旧版拆分规则", "  Removed legacy split rules"))
    return removed


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


def cleanup_codex_agents_dotted(content):
    cleaned, changed = content, False
    for d in ('agents.max_threads', 'agents.max_depth'):
        cleaned, n = re.subn(rf'^{re.escape(d)}\s*=\s*\d+\s*\n?', '', cleaned, flags=re.MULTILINE)
        if n:
            changed = True
    return (re.sub(r'\n{3,}', '\n\n', cleaned) if changed else cleaned), changed


def configure_codex_toml(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', c)
    if m and int(m.group(1)) >= 131072:
        return
    if m:
        c = re.sub(r'project_doc_max_bytes\s*=\s*\d+', 'project_doc_max_bytes = 131072', c)
    else:
        c = _toml_insert_before_section(c, "project_doc_max_bytes = 131072")
    _toml_write(p, c)
    print(_msg("  已配置 project_doc_max_bytes = 131072", "  Configured project_doc_max_bytes"))


def _ensure_agents_section(content, dot_mt, dot_md):
    mt_ch = md_ch = False
    if not re.search(r'^\[agents\]', content, re.MULTILINE):
        mt = max(dot_mt or 0, 64)
        md = dot_md if dot_md is not None else 1
        block = f"[agents]\nmax_threads = {mt}\nmax_depth = {md}\n\n"
        m = re.search(r'^\[[\w]', content, re.MULTILINE)
        content = (content[:m.start()] + block + content[m.start()] if m
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


def configure_codex_csv_batch(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    changed = False
    dot_mt = re.search(r'agents\.max_threads\s*=\s*(\d+)', c)
    dot_md = re.search(r'agents\.max_depth\s*=\s*(\d+)', c)
    c, did = cleanup_codex_agents_dotted(c)
    changed = changed or did
    c, mt, md = _ensure_agents_section(c, int(dot_mt.group(1)) if dot_mt else None,
                                        int(dot_md.group(1)) if dot_md else None)
    changed = changed or mt or md
    for feat in ("sqlite", "collaboration_modes"):
        c, added = _ensure_feature(c, feat)
        changed = changed or added
    if changed:
        _toml_write(p, c)
        print(_msg("  已配置多代理设置", "  Configured multi-agent settings"))


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


def configure_codex_developer_instructions(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    toml_val = f'developer_instructions = """\n{_DI_TEXT}\n"""'
    m = _DI_RE.search(c)
    if m:
        if "HelloAGENTS" not in m.group(0):
            (p.parent / "developer_instructions.bak").write_text(m.group(0), encoding="utf-8")
        end = m.end()
        while end < len(c) and c[end] in '\n\r':
            end += 1
        c = re.sub(r'\n{3,}', '\n\n', c[:m.start()] + c[end:])
    c = _toml_insert_before_section(c, toml_val)
    _toml_write(p, c)
    print(_msg("  已配置 developer_instructions", "  Configured developer_instructions"))


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


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: notify hook
# ═══════════════════════════════════════════════════════════════════════════

def configure_codex_notify(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    sd = (HELLOAGENTS_HOME / "scripts").as_posix()
    argv = [get_python_cmd(), f"{sd}/{CODEX_NOTIFY_SCRIPT}"]
    line = 'notify = [' + ", ".join(f'"{t}"' for t in argv) + ']'
    existing = re.search(r'^notify\s*=\s*(?:"[^"]*"|\[[^\]]*\])', c, re.MULTILINE)
    if existing:
        if "helloagents" not in existing.group(0).lower():
            (p.parent / "notify.bak").write_text(existing.group(0), encoding="utf-8")
        c = re.sub(r'^notify\s*=\s*(?:"[^"]*"|\[[^\]]*\])\s*\n?', '', c, count=1, flags=re.MULTILINE)
    c = _toml_insert_before_section(c, line)
    _toml_write(p, c)
    print(_msg("  已配置 notify hook", "  Configured notify hook"))


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


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: TUI notification
# ═══════════════════════════════════════════════════════════════════════════

def configure_codex_tui_notification(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    # Remove existing notification_method entries
    for pat in (r'tui\.notification_method\s*=\s*"[^"]*"\s*\n?',
                r'^notification_method\s*=\s*"[^"]*"\s*\n?'):
        c = re.sub(pat, '', c, flags=re.MULTILINE)
    # Add under [tui] section
    tui = re.search(r'^\[tui\]', c, re.MULTILINE)
    if tui:
        c = c[:tui.end()] + '\nnotification_method = "osc9"' + c[tui.end():]
    else:
        m = re.search(r'^\[[\w]', c, re.MULTILINE)
        section = '[tui]\nnotification_method = "osc9"\n'
        c = (c[:m.start()] + section + "\n" + c[m.start()]) if m else c.rstrip() + "\n\n" + section
    _toml_write(p, c)
    print(_msg("  已配置 tui.notification_method = osc9", "  Configured tui notification"))


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


# ═══════════════════════════════════════════════════════════════════════════
# Codex CLI: agent role definitions
# ═══════════════════════════════════════════════════════════════════════════

_ROLES = [
    ("explorer", "Codebase exploration and dependency analysis", ["Scout", "Pathfinder", "Tracker"]),
    ("worker", "Code implementation and modification", ["Builder", "Forge", "Smith"]),
    ("monitor", "Long-running monitoring and polling tasks", ["Watcher", "Radar", "Lookout"]),
    ("reviewer", "Code review and quality inspection", ["Inspector", "Sentinel", "Auditor"]),
    ("writer", "Standalone document generation", ["Scribe", "Quill", "Chronicler"]),
    ("brainstormer", "Proposal brainstorming specialist", ["Muse", "Ideator", "Catalyst"]),
]


def _toml_arr(arr):
    return "[" + ", ".join(f'"{s}"' for s in arr) + "]"


def _section_bounds(content, name):
    m = re.search(rf'^\[{re.escape(name)}\]', content, re.MULTILINE)
    if not m:
        return None
    ns = re.search(r'^\[', content[m.end():], re.MULTILINE)
    return m.start(), m.end() + (ns.start() if ns else len(content[m.end():]))


def configure_codex_agent_roles(dest_dir: Path) -> None:
    p, c = _toml_read(dest_dir)
    created = []
    for role, desc, nicks in _ROLES:
        sec = f"agents.{role}"
        if _section_bounds(c, sec):
            continue  # Don't overwrite existing role configs
        lines = [f"[{sec}]", f'description = "{desc}"',
                 f'nickname_candidates = {_toml_arr(nicks)}']
        # Find end of agents.* sections
        all_sec = list(re.finditer(r'^\[([^\]]+)\]', c, re.MULTILINE))
        last_end = max((all_sec[i+1].start() if i+1 < len(all_sec) else len(c)
                        for i, m in enumerate(all_sec)
                        if m.group(1) == "agents" or m.group(1).startswith("agents.")),
                       default=len(c))
        before = c[:last_end].rstrip("\n")
        after = c[last_end:].lstrip("\n")
        c = before + "\n\n" + "\n".join(lines) + ("\n\n" + after if after else "\n")
        created.append(role)
    if created:
        _toml_write(p, c)
        print(_msg(f"  已配置 {len(created)} 个子代理角色",
                   f"  Configured {len(created)} agent role(s)"))


def remove_codex_agent_roles(dest_dir: Path) -> bool:
    p, c = _toml_read(dest_dir)
    removed = []
    for role, _, _ in _ROLES:
        bounds = _section_bounds(c, f"agents.{role}")
        if bounds:
            c = re.sub(r'\n{3,}', '\n\n', c[:bounds[0]] + c[bounds[1]:])
            removed.append(role)
    if removed:
        _toml_write(p, c.rstrip("\n") + "\n")
        print(_msg(f"  已移除 {len(removed)} 个角色", f"  Removed {len(removed)} role(s)"))
    # Clean up roles/ directory
    roles_dir = dest_dir / "roles"
    if roles_dir.exists():
        for role, _, _ in _ROLES:
            t = roles_dir / f"{role}.toml"
            if t.exists():
                t.unlink()
        try:
            if not any(roles_dir.iterdir()):
                roles_dir.rmdir()
        except OSError:
            pass
    return bool(removed)

"""HelloAGENTS Status - Installation status display and cache cleaning."""

import json
import re
import sys
from pathlib import Path
from importlib.metadata import version as get_version

from .._common import (
    _msg, _header,
    CLI_TARGETS, PLUGIN_DIR_NAME,
    _detect_installed_targets,
    is_helloagents_hook as _is_helloagents_hook,
)
from .claude_config import _get_helloagents_permissions
from .win_helpers import win_safe_rmtree


# ---------------------------------------------------------------------------
# Status helper functions
# ---------------------------------------------------------------------------

def _show_config_status() -> None:
    """Display config.json override status."""
    global_cfg = Path.home() / ".helloagents" / "config.json"
    project_cfg = Path.cwd() / ".helloagents" / "config.json"

    for label, path in [
        (_msg("全局配置", "Global config"), global_cfg),
        (_msg("项目配置", "Project config"), project_cfg),
    ]:
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                keys = ", ".join(data.keys()) if data else _msg("空", "empty")
                print(f"  ✓ {label}: {path}")
                print(f"    {_msg('覆盖项', 'Overrides')}: {keys}")
            except Exception:
                print(f"  ⚠ {label}: {path} ({_msg('解析失败', 'parse error')})")
        else:
            print(f"  · {label}: {_msg('未配置', 'not set')}")


def _show_claude_cli_details(cli_dir: Path) -> None:
    """Show Claude Code specific status details (hooks + agent definitions)."""
    try:
        sp = cli_dir / "settings.json"
        if sp.exists():
            st = json.loads(sp.read_text(encoding="utf-8"))
            hooks = st.get("hooks", {})
            ha_count = sum(
                1 for hl in hooks.values() if isinstance(hl, list)
                for mg in hl if _is_helloagents_hook(mg)
            )
            if ha_count > 0:
                print(f"    hooks: {ha_count} HelloAGENTS hook(s) ✓")
            else:
                print(_msg("    ⚠ 未检测到 HelloAGENTS Hooks，建议重新安装",
                           "    ⚠ No HelloAGENTS hooks found, reinstall recommended"))
        else:
            print(_msg("    ⚠ settings.json 不存在，Hooks 未配置",
                       "    ⚠ settings.json missing, hooks not configured"))
    except Exception:
        pass
    # Agent definition files check
    agents_dir = cli_dir / "agents"
    ha_agents = list(agents_dir.glob("ha-*.md")) if agents_dir.exists() else []
    if ha_agents:
        print(f"    agents: {len(ha_agents)} ha-*.md ✓")
    else:
        print(_msg("    ⚠ 未检测到 ha-*.md 子代理定义，建议重新安装",
                   "    ⚠ No ha-*.md agent definitions found, reinstall recommended"))
    # Split rule files check
    rules_ha_dir = cli_dir / "rules" / "helloagents"
    ha_rules = list(rules_ha_dir.glob("*.md")) if rules_ha_dir.exists() else []
    if ha_rules:
        print(f"    rules: {len(ha_rules)} file(s) ✓")
    else:
        print(_msg("    ⚠ 未检测到拆分规则文件，建议重新安装",
                   "    ⚠ No split rule files found, reinstall recommended"))
    # Permissions check
    try:
        sp = cli_dir / "settings.json"
        if sp.exists():
            _st = json.loads(sp.read_text(encoding="utf-8"))
            allow = _st.get("permissions", {}).get("allow", [])
            our_perms = _get_helloagents_permissions(cli_dir)
            found = sum(1 for p in our_perms if p in allow)
            if found == len(our_perms):
                print(f"    permissions: {found} rule(s) ✓")
            elif found > 0:
                print(_msg(f"    ⚠ 工具权限不完整（{found}/{len(our_perms)}），建议重新安装",
                           f"    ⚠ Permissions incomplete ({found}/{len(our_perms)}), reinstall recommended"))
            else:
                print(_msg("    ⚠ 未配置工具权限，建议重新安装",
                           "    ⚠ No tool permissions configured, reinstall recommended"))
    except Exception:
        pass


def _show_codex_cli_details(cli_dir: Path) -> None:
    """Show Codex CLI specific status details (notify + multi-agent config)."""
    try:
        ct_path = cli_dir / "config.toml"
        if not ct_path.exists():
            return
        ct_text = ct_path.read_text(encoding="utf-8")
        # --- notify check ---
        nm_arr = re.search(r'^notify\s*=\s*\[([^\]]*)\]', ct_text, re.MULTILINE)
        nm_str = re.search(r'^notify\s*=\s*"([^"]*)"', ct_text, re.MULTILINE)
        notify_val = (nm_arr.group(1) if nm_arr else
                      nm_str.group(1) if nm_str else None)
        if notify_val and "helloagents" in notify_val:
            print("    notify: helloagents ✓")
        elif notify_val:
            print(_msg("    notify: 用户自定义（非 HelloAGENTS）",
                       "    notify: user-defined (not HelloAGENTS)"))
        else:
            print(_msg("    ⚠ notify 未配置，建议重新安装",
                       "    ⚠ notify not configured, reinstall recommended"))
        # --- multi-agent config check ---
        ma_items = []
        # Check max_threads: dotted form OR scoped within [agents] section
        agents_sec = re.search(r'^\[agents\]', ct_text, re.MULTILINE)
        agents_scope = ""
        if agents_sec:
            after_agents = ct_text[agents_sec.end():]
            next_sec_a = re.search(r'^\[[\w]', after_agents, re.MULTILINE)
            agents_scope = after_agents[:next_sec_a.start()] if next_sec_a else after_agents
        has_mt = (re.search(r'agents\.max_threads\s*=', ct_text)
                  or (agents_scope and re.search(r'^max_threads\s*=', agents_scope, re.MULTILINE)))
        if has_mt:
            ma_items.append("agents.max_threads")
        has_md = (re.search(r'agents\.max_depth\s*=', ct_text)
                  or (agents_scope and re.search(r'^max_depth\s*=', agents_scope, re.MULTILINE)))
        if has_md:
            ma_items.append("agents.max_depth")
        feat_m = re.search(r'^\[features\]', ct_text, re.MULTILINE)
        if feat_m:
            after_feat = ct_text[feat_m.end():]
            next_sec_f = re.search(r'^\[[\w]', after_feat, re.MULTILINE)
            feat_scope = after_feat[:next_sec_f.start()] if next_sec_f else after_feat
            if re.search(r'^sqlite\s*=\s*true', feat_scope, re.MULTILINE):
                ma_items.append("sqlite")
        if ma_items:
            print(f"    multi-agent: {', '.join(ma_items)} ✓")
        else:
            print(_msg("    ⚠ 多代理配置缺失，建议重新安装",
                       "    ⚠ Multi-agent config missing, reinstall recommended"))
    except Exception:
        pass


def _show_codex_rules_warning(cli_dir: Path, rules_file: Path) -> None:
    """Warn if AGENTS.md exceeds Codex project_doc_max_bytes limit."""
    try:
        rules_size = rules_file.stat().st_size
        max_bytes = 32768  # Codex default
        config_toml = cli_dir / "config.toml"
        if config_toml.exists():
            ct = config_toml.read_text(encoding="utf-8")
            m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', ct)
            if m:
                max_bytes = int(m.group(1))
        if rules_size > max_bytes:
            print(_msg(
                f"    ⚠ AGENTS.md ({rules_size} 字节) 超过 project_doc_max_bytes ({max_bytes})，内容会被截断",
                f"    ⚠ AGENTS.md ({rules_size} bytes) exceeds project_doc_max_bytes ({max_bytes}), content will be truncated"))
            print(_msg(
                "    → 执行 helloagents install codex 可自动修复此问题",
                "    → Run helloagents install codex to fix this automatically"))
    except Exception:
        pass


def _show_wsl_hint() -> None:
    """Show WSL environment hint if applicable."""
    try:
        _is_wsl = False
        if sys.platform != "win32":
            try:
                _is_wsl = "microsoft" in Path("/proc/version").read_text().lower()
            except Exception:
                pass
        if _is_wsl:
            print()
            print(_msg("  ⚠ 当前运行在 WSL 环境中。WSL 与 Windows 宿主的配置路径互相独立，",
                       "  ⚠ Running inside WSL. WSL and Windows host have separate config paths,"))
            print(_msg("    若需在两侧使用 HelloAGENTS，需分别安装。",
                       "    install HelloAGENTS on both sides if needed."))
        elif sys.platform == "win32":
            import shutil as _sh
            if _sh.which("wsl"):
                print()
                print(_msg("  ⚠ 检测到 WSL。若在 VS Code 中以 WSL Remote 模式使用 HelloAGENTS，",
                           "  ⚠ WSL detected. If using HelloAGENTS via VS Code WSL Remote,"))
                print(_msg("    需在 WSL 内部单独执行 helloagents install，两侧配置路径互相独立。",
                           "    run helloagents install inside WSL separately — config paths are independent."))
    except Exception:
        pass


# ---------------------------------------------------------------------------
# status command
# ---------------------------------------------------------------------------

def status() -> None:
    """Show installation status for all CLIs."""
    _header(_msg("安装状态", "Installation Status"))

    try:
        local_ver = get_version("helloagents")
        from .version_check import _detect_channel
        branch = _detect_channel()
        print(_msg(f"  包版本: {local_ver} ({branch})",
                   f"  Package version: {local_ver} ({branch})"))
    except Exception:
        print(_msg("  包版本: 未知", "  Package version: unknown"))

    _show_config_status()
    print()

    _module_dirs = ("functions", "stages", "scripts")
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]
        skill_file = cli_dir / "skills" / "helloagents" / "SKILL.md"

        cli_exists = cli_dir.exists()
        # Check for actual module content, not just user-data remnants
        has_modules = any((plugin_dir / d).is_dir() for d in _module_dirs)
        rules_exists = rules_file.exists() and rules_file.stat().st_size > 0
        skill_exists = skill_file.exists()

        if not cli_exists:
            mark = "·"
            status_str = _msg("未检测到该工具", "tool not found")
        elif has_modules and rules_exists and skill_exists:
            mark = "✓"
            status_str = _msg("已安装 HelloAGENTS", "HelloAGENTS installed")
        elif has_modules and rules_exists:
            mark = "!"
            status_str = _msg("已安装但缺少 SKILL.md，建议重新安装",
                              "installed but SKILL.md missing, reinstall recommended")
        elif has_modules or rules_exists:
            mark = "!"
            status_str = _msg("安装不完整", "partial install")
        else:
            mark = "·"
            status_str = _msg("未安装 HelloAGENTS", "HelloAGENTS not installed")

        print(f"  {mark} {name:10} {status_str}")

        # CLI-specific details (only for installed targets)
        if has_modules and rules_exists:
            if name == "claude":
                _show_claude_cli_details(cli_dir)
            elif name == "codex":
                _show_codex_cli_details(cli_dir)
        if name == "codex" and rules_exists:
            _show_codex_rules_warning(cli_dir, rules_file)

    _show_wsl_hint()
    print()


# ---------------------------------------------------------------------------
# clean command
# ---------------------------------------------------------------------------

def clean() -> None:
    """Clean caches from all installed CLI targets."""
    _header(_msg("清理缓存", "Clean Caches"))

    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  未检测到已安装的 CLI 目标，无需清理。",
                   "  No installed CLI targets detected. Nothing to clean."))
        return

    total_removed = 0
    for name in targets:
        cfg = CLI_TARGETS[name]
        cli_dir = Path.home() / cfg["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        removed = 0

        if not plugin_dir.exists():
            continue

        for cache_dir in list(plugin_dir.rglob("__pycache__")):
            if cache_dir.is_dir():
                if win_safe_rmtree(cache_dir):
                    removed += 1
                else:
                    print(_msg(f"  ⚠ 无法清理 {cache_dir}",
                               f"  ⚠ Cannot clean {cache_dir}"))

        for pyc_file in list(plugin_dir.rglob("*.pyc")):
            if pyc_file.is_file():
                try:
                    pyc_file.unlink()
                    removed += 1
                except Exception as e:
                    print(_msg(f"  ⚠ 无法清理 {pyc_file}: {e}",
                               f"  ⚠ Cannot clean {pyc_file}: {e}"))

        if removed:
            print(f"  ✓ {name:10} {_msg(f'清理了 {removed} 个缓存项', f'cleaned {removed} cache item(s)')}")
            total_removed += removed
        else:
            print(f"  · {name:10} {_msg('无缓存', 'no cache')}")

    print()
    if total_removed:
        print(_msg(f"  共清理 {total_removed} 个缓存项。",
                   f"  Total: {total_removed} cache item(s) removed."))
    else:
        print(_msg("  已是干净状态。", "  Already clean."))

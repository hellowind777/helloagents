"""HelloAGENTS Uninstaller - Uninstall and purge operations."""

import shutil
import subprocess
import sys
from pathlib import Path

from .._common import (
    _msg,
    CLI_TARGETS, PLUGIN_DIR_NAME, AGENT_PREFIX,
    HELLOAGENTS_HOME,
    is_helloagents_file, clean_skills_dir, cleanup_empty_parent,
    _detect_installed_targets, _detect_install_method,
)
from .cli_adapters import (
    remove_legacy_rules, cleanup_codex_agents_dotted,
    remove_claude_hooks, remove_claude_permissions, remove_claude_auto_memory,
    remove_codex_notify, remove_codex_developer_instructions,
    remove_codex_tui_notification, remove_codex_agent_roles,
    remove_gemini_hooks, remove_qwen_hooks, remove_grok_hooks,
)
from .win_helpers import (
    _cleanup_pip_remnants, _win_deferred_pip,
    _win_schedule_exe_cleanup,
    build_pip_cleanup_cmd,
    win_preemptive_unlock, win_finish_unlock, win_safe_rmtree,
)


def _clean_helloagents_home(preserve_user: bool = True) -> None:
    """Clean ~/.helloagents/ directory."""
    home = HELLOAGENTS_HOME
    if not home.exists():
        return
    if preserve_user:
        for item in home.iterdir():
            if item.name == "user":
                continue
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            except Exception:
                pass
        print(_msg(f"  已清理 {home}（保留 user/）",
                   f"  Cleaned {home} (preserved user/)"))
    else:
        try:
            shutil.rmtree(home)
            print(_msg(f"  已移除 {home}", f"  Removed {home}"))
        except Exception as e:
            print(_msg(f"  ⚠ 无法移除 {home}: {e}",
                       f"  ⚠ Cannot remove {home}: {e}"))


def _self_uninstall() -> bool:
    """Remove the helloagents Python package itself."""
    method = _detect_install_method()
    if method == "uv":
        cmd = ["uv", "tool", "uninstall", "helloagents"]
    else:
        cmd = [sys.executable, "-m", "pip", "uninstall", "helloagents", "-y"]

    print(_msg(f"  正在移除 helloagents 包 ({method})...",
               f"  Removing helloagents package ({method})..."))

    bak = win_preemptive_unlock()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
        if result.returncode == 0:
            print(_msg("  ✓ helloagents 包已移除。",
                       "  ✓ helloagents package removed."))
            _cleanup_pip_remnants()
            _clean_helloagents_home(preserve_user=False)
            win_finish_unlock(bak, True)
            _win_schedule_exe_cleanup(bak)
            return True

        stderr = result.stderr.strip()
        if sys.platform == "win32" and ("WinError" in stderr or "helloagents.exe" in stderr):
            if _win_deferred_pip(cmd, post_cmds=[build_pip_cleanup_cmd()]):
                print(_msg("  包将在退出后移除。",
                           "  Package will be removed after exit."))
                win_finish_unlock(bak, False)
                return True
            print(_msg("  ✗ 无法自动移除，请手动执行:",
                       "  ✗ Cannot auto-remove. Run manually:"))
            print("    pip uninstall helloagents")
            win_finish_unlock(bak, False)
            return False

        if stderr:
            print(f"  ✗ {stderr}")
        win_finish_unlock(bak, False)
        return False
    except FileNotFoundError:
        print(_msg(f"  ✗ 未找到 {method}。",
                   f"  ✗ {method} not found."))
        win_finish_unlock(bak, False)
        return False


def _remove_agent_files(dest_dir: Path) -> list[str]:
    agents_dir = dest_dir / "agents"
    removed = []
    if not agents_dir.exists():
        return removed
    for f in agents_dir.glob(f"{AGENT_PREFIX}*.md"):
        f.unlink()
        removed.append(str(f))
    if cleanup_empty_parent(agents_dir):
        removed.append(f"{agents_dir} (empty)")
    return removed


def _uninstall_claude_extras(dest_dir: Path) -> list[str]:
    removed = []
    try:
        removed.extend(_remove_agent_files(dest_dir))
    except Exception:
        pass
    for fn, label in [
        (remove_legacy_rules, "rules"), (remove_claude_hooks, "hooks"),
        (remove_claude_permissions, "permissions"),
        (remove_claude_auto_memory, "autoMemory"),
    ]:
        try:
            if fn(dest_dir):
                removed.append(label)
        except Exception:
            pass
    return removed


def _uninstall_codex_extras(dest_dir: Path) -> list[str]:
    removed = []
    for fn, label in [
        (remove_codex_notify, "notify"), (remove_codex_developer_instructions, "dev_instructions"),
        (remove_codex_tui_notification, "tui_notification"),
        (remove_codex_agent_roles, "agent_roles"),
    ]:
        try:
            if fn(dest_dir):
                removed.append(label)
        except Exception:
            pass
    try:
        ct = dest_dir / "config.toml"
        if ct.exists():
            content = ct.read_text(encoding="utf-8")
            cleaned, did = cleanup_codex_agents_dotted(content)
            if did:
                ct.write_text(cleaned, encoding="utf-8")
    except Exception:
        pass
    return removed


def _uninstall_hooks_extras(dest_dir: Path, remove_fn) -> list[str]:
    removed = []
    try:
        if remove_fn(dest_dir):
            removed.append("hooks")
    except Exception:
        pass
    return removed


def uninstall(target: str, show_package_hint: bool = True) -> bool:
    """Uninstall HelloAGENTS from a specific CLI target."""
    if target not in CLI_TARGETS:
        print(_msg(f"  未知目标: {target}", f"  Unknown target: {target}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file
    removed = []

    if not dest_dir.exists():
        print(_msg(f"  {target}: 目录不存在，跳过。",
                   f"  {target}: directory missing, skipping."))
        return True

    print(_msg(f"  正在卸载 {target}...", f"  Uninstalling {target}..."))

    ok = True
    if plugin_dest.exists():
        import tempfile
        _user_bak = None
        try:
            _user_src = plugin_dest / "user"
            if _user_src.exists() and any(_user_src.iterdir()):
                _user_bak = Path(tempfile.mkdtemp()) / "user"
                shutil.copytree(_user_src, _user_bak)
            if win_safe_rmtree(plugin_dest):
                removed.append(str(plugin_dest))
            else:
                ok = False
            if _user_bak and _user_bak.exists():
                _restore = plugin_dest / "user"
                if not _restore.exists():
                    _restore.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(_user_bak, _restore)
        except Exception:
            ok = False
        finally:
            if _user_bak and _user_bak.parent.exists():
                shutil.rmtree(_user_bak.parent, ignore_errors=True)

    if rules_dest.exists():
        if is_helloagents_file(rules_dest) or rules_dest.stat().st_size == 0:
            try:
                rules_dest.unlink()
                removed.append(str(rules_dest))
            except Exception:
                ok = False
        else:
            print(_msg(f"  保留 {rules_dest}（用户文件）",
                       f"  Kept {rules_dest} (user file)"))

    try:
        removed.extend(clean_skills_dir(dest_dir))
    except Exception:
        ok = False

    extras_map = {
        "claude": lambda d: _uninstall_claude_extras(d),
        "codex": lambda d: _uninstall_codex_extras(d),
        "gemini": lambda d: _uninstall_hooks_extras(d, remove_gemini_hooks),
        "qwen": lambda d: _uninstall_hooks_extras(d, remove_qwen_hooks),
        "grok": lambda d: _uninstall_hooks_extras(d, remove_grok_hooks),
    }
    handler = extras_map.get(target)
    if handler:
        removed.extend(handler(dest_dir))

    if removed:
        print(_msg(f"  已移除 {len(removed)} 项。",
                   f"  Removed {len(removed)} item(s)."))

    if show_package_hint and not _detect_installed_targets():
        print()
        print(_msg("  [1] 彻底移除 helloagents 包", "  [1] Remove package"))
        print(_msg("  [2] 保留", "  [2] Keep"))
        try:
            choice = input(_msg("  请输入编号: ", "  Enter number: ")).strip()
        except (EOFError, KeyboardInterrupt):
            choice = ""
        if choice == "1":
            _self_uninstall()
        else:
            method = _detect_install_method()
            cmd = "uv tool uninstall helloagents" if method == "uv" else "pip uninstall helloagents"
            print(_msg(f"  如需移除: {cmd}", f"  To remove: {cmd}"))

    return ok


def uninstall_all(purge: bool = False) -> None:
    """Uninstall from all detected CLI targets."""
    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  未检测到安装。", "  No installations detected."))
        if purge:
            _self_uninstall()
        return

    for t in targets:
        uninstall(t, show_package_hint=False)
        print()

    if purge:
        remaining = _detect_installed_targets()
        if not remaining:
            _self_uninstall()
    elif not _detect_installed_targets():
        print(_msg("  [1] 彻底移除包  [2] 保留",
                   "  [1] Remove package  [2] Keep"))
        try:
            choice = input(_msg("  请输入编号: ", "  Enter number: ")).strip()
        except (EOFError, KeyboardInterrupt):
            choice = ""
        if choice == "1":
            _self_uninstall()

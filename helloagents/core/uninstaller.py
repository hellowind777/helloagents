"""HelloAGENTS Uninstaller - Uninstall and purge operations."""

import shutil
import subprocess
import sys
from pathlib import Path

from .._common import (
    _msg,
    CLI_TARGETS, PLUGIN_DIR_NAME, HELLOAGENTS_MARKER, AGENT_PREFIX,
    is_helloagents_file, clean_skills_dir, cleanup_empty_parent,
    _detect_installed_targets, _detect_install_method,
)
from .codex_config import _cleanup_codex_agents_dotted, _remove_codex_notify
from .codex_config import _remove_codex_developer_instructions
from .codex_config import _remove_codex_tui_notification
from .codex_roles import _remove_codex_agent_roles
from .claude_config import (
    _remove_claude_hooks, _remove_claude_permissions,
    _remove_claude_auto_memory,
)
from .claude_rules import _remove_claude_rules
from .settings_hooks import (
    _remove_gemini_hooks, _remove_qwen_hooks, _remove_grok_hooks,
)
from .win_helpers import (
    _cleanup_pip_remnants, _win_deferred_pip,
    _win_schedule_exe_cleanup,
    build_pip_cleanup_cmd,
    win_preemptive_unlock, win_finish_unlock, win_safe_rmtree,
)


# ---------------------------------------------------------------------------
# Self-uninstall (remove the helloagents package itself)
# ---------------------------------------------------------------------------

def _self_uninstall() -> bool:
    """Remove the helloagents Python package itself (pip/uv)."""
    method = _detect_install_method()
    if method == "uv":
        cmd = ["uv", "tool", "uninstall", "helloagents"]
    else:
        cmd = [sys.executable, "-m", "pip", "uninstall", "helloagents", "-y"]

    print(_msg(f"  正在移除 helloagents 包 ({method})...",
               f"  Removing helloagents package ({method})..."))

    # Preemptive unlock: rename exe before pip/uv to avoid lock
    bak = win_preemptive_unlock()

    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
        if result.returncode == 0:
            print(_msg("  ✓ helloagents 包已移除。",
                       "  ✓ helloagents package removed."))
            _cleanup_pip_remnants()
            win_finish_unlock(bak, True)
            _win_schedule_exe_cleanup(bak)
            return True

        stderr = result.stderr.strip()

        # Preemptive unlock failed or not Windows — last resort deferred
        if sys.platform == "win32" and (
                "WinError" in stderr or "helloagents.exe" in stderr):
            if _win_deferred_pip(cmd, post_cmds=[build_pip_cleanup_cmd()]):
                print(_msg(
                    "  helloagents 包将在程序退出后自动移除。",
                    "  helloagents package will be removed after exit."))
                win_finish_unlock(bak, False)
                return True
            # Deferred also failed
            print(_msg(
                "  ✗ 无法自动移除。请退出后手动执行:",
                "  ✗ Cannot auto-remove. Please exit and run manually:"))
            print("    pip uninstall helloagents")
            win_finish_unlock(bak, False)
            return False

        if stderr:
            print(f"  ✗ {stderr}")
        win_finish_unlock(bak, False)
        return False
    except FileNotFoundError:
        print(_msg(f"  ✗ 未找到 {method}。请手动执行:",
                   f"  ✗ {method} not found. Please run manually:"))
        if method == "uv":
            print("    uv tool uninstall helloagents")
        else:
            print("    pip uninstall helloagents")
        win_finish_unlock(bak, False)
        return False


# ---------------------------------------------------------------------------
# Agent definition files (Claude Code only)
# ---------------------------------------------------------------------------


def _remove_agent_files(dest_dir: Path) -> list[str]:
    """Remove HelloAGENTS agent definition files from ~/.claude/agents/."""
    agents_dir = dest_dir / "agents"
    removed = []
    if not agents_dir.exists():
        return removed
    for f in agents_dir.glob(f"{AGENT_PREFIX}*.md"):
        f.unlink()
        removed.append(str(f))
    if cleanup_empty_parent(agents_dir):
        removed.append(f"{agents_dir} (empty parent)")
    return removed


def _uninstall_claude_extras(dest_dir: Path) -> list[str]:
    """Remove Claude Code specific items (agents, rules, hooks, permissions)."""
    removed = []
    try:
        removed.extend(_remove_agent_files(dest_dir))
    except Exception as e:
        print(_msg(f"  ⚠ 移除子代理定义时出错: {e}",
                   f"  ⚠ Error removing agent definitions: {e}"))
    try:
        if _remove_claude_rules(dest_dir):
            removed.append("rules/helloagents/ (split rules)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除拆分规则时出错: {e}",
                   f"  ⚠ Error removing split rules: {e}"))
    try:
        if _remove_claude_hooks(dest_dir):
            removed.append("hooks (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 Hooks 时出错: {e}",
                   f"  ⚠ Error removing hooks: {e}"))
    try:
        if _remove_claude_permissions(dest_dir):
            removed.append("permissions (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除工具权限时出错: {e}",
                   f"  ⚠ Error removing tool permissions: {e}"))
    try:
        if _remove_claude_auto_memory(dest_dir):
            removed.append("autoMemory (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 恢复 autoMemory 时出错: {e}",
                   f"  ⚠ Error restoring autoMemory: {e}"))
    return removed


def _uninstall_gemini_extras(dest_dir: Path) -> list[str]:
    """Remove Gemini CLI specific items (hooks)."""
    removed = []
    try:
        if _remove_gemini_hooks(dest_dir):
            removed.append("hooks (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 Gemini Hooks 时出错: {e}",
                   f"  ⚠ Error removing Gemini hooks: {e}"))
    return removed


def _uninstall_qwen_extras(dest_dir: Path) -> list[str]:
    """Remove Qwen Code specific items (hooks)."""
    removed = []
    try:
        if _remove_qwen_hooks(dest_dir):
            removed.append("hooks (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 Qwen Hooks 时出错: {e}",
                   f"  ⚠ Error removing Qwen hooks: {e}"))
    return removed


def _uninstall_grok_extras(dest_dir: Path) -> list[str]:
    """Remove Grok CLI specific items (hooks)."""
    removed = []
    try:
        if _remove_grok_hooks(dest_dir):
            removed.append("hooks (settings.json)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 Grok Hooks 时出错: {e}",
                   f"  ⚠ Error removing Grok hooks: {e}"))
    return removed


def _uninstall_codex_extras(dest_dir: Path) -> list[str]:
    """Remove Codex CLI specific items (notify, developer_instructions, dotted keys)."""
    removed = []
    try:
        if _remove_codex_notify(dest_dir):
            removed.append("notify hook (config.toml)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 notify hook 时出错: {e}",
                   f"  ⚠ Error removing notify hook: {e}"))
    try:
        if _remove_codex_developer_instructions(dest_dir):
            removed.append("developer_instructions (config.toml)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 developer_instructions 时出错: {e}",
                   f"  ⚠ Error removing developer_instructions: {e}"))
    try:
        if _remove_codex_tui_notification(dest_dir):
            removed.append("tui.notification_method (config.toml)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除 tui.notification_method 时出错: {e}",
                   f"  ⚠ Error removing tui.notification_method: {e}"))
    try:
        if _remove_codex_agent_roles(dest_dir):
            removed.append("agent role definitions (config.toml)")
    except Exception as e:
        print(_msg(f"  ⚠ 移除子代理角色定义时出错: {e}",
                   f"  ⚠ Error removing agent role definitions: {e}"))
    try:
        config_toml = dest_dir / "config.toml"
        if config_toml.exists():
            content = config_toml.read_text(encoding="utf-8")
            cleaned, did_clean = _cleanup_codex_agents_dotted(content)
            if did_clean:
                config_toml.write_text(cleaned, encoding="utf-8")
                print(_msg("  已清理 config.toml 中的 dotted agents.xxx 键",
                           "  Cleaned dotted agents.xxx keys from config.toml"))
    except Exception as e:
        print(_msg(f"  ⚠ 清理 dotted agents 键时出错: {e}",
                   f"  ⚠ Error cleaning dotted agents keys: {e}"))
    # Note: The following config keys are intentionally preserved during uninstall:
    # - project_doc_max_bytes: May be used by other project documentation tools
    # - agents.max_threads / agents.max_depth: Generic multi-agent settings
    # - [features] sqlite: May be used by other Codex features
    # - [memories]: Codex native memory system (not HelloAGENTS-exclusive)
    # These keys correspond to installer functions:
    # - _configure_codex_toml() → project_doc_max_bytes (preserved)
    # - _configure_codex_csv_batch() → agents.max_threads/max_depth, sqlite (preserved)
    # - [memories] section is Codex-native, not created by HelloAGENTS (preserved)
    # Users can manually remove these if desired.
    print(_msg(
        "  ℹ config.toml 中的 project_doc_max_bytes / agents.max_threads / agents.max_depth / sqlite / memories 配置已保留（可能被其他工具使用）。",
        "  ℹ project_doc_max_bytes / agents.max_threads / agents.max_depth / sqlite / memories kept in config.toml (may be used by other tools)."))
    return removed


# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

def uninstall(target: str, show_package_hint: bool = True) -> bool:
    """Uninstall HelloAGENTS from a specific CLI target.

    Args:
        target: CLI target name (e.g. 'codex', 'claude').
        show_package_hint: If True and no targets remain after uninstall,
            print a hint about removing the package. Set to False when
            the caller handles package removal itself (interactive mode).
    """
    if target not in CLI_TARGETS:
        print(_msg(f"  未知目标: {target}", f"  Unknown target: {target}"))
        print(_msg(f"  可用目标: {', '.join(CLI_TARGETS.keys())}",
                   f"  Available targets: {', '.join(CLI_TARGETS.keys())}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file
    removed = []

    if not dest_dir.exists():
        print(_msg(f"  {target}: 目录 {dest_dir} 不存在，跳过。",
                   f"  {target}: directory {dest_dir} does not exist, skipping."))
        return True

    print(_msg(f"  正在从 {target} 卸载 HelloAGENTS...",
               f"  Uninstalling HelloAGENTS from {target}..."))

    ok = True
    if plugin_dest.exists():
        # Preserve user/ directory (all user content consolidated here)
        import tempfile
        _user_bak: Path | None = None
        try:
            _user_src = plugin_dest / "user"
            if _user_src.exists() and any(_user_src.iterdir()):
                _user_bak = Path(tempfile.mkdtemp()) / "user"
                shutil.copytree(_user_src, _user_bak)

            if win_safe_rmtree(plugin_dest):
                removed.append(str(plugin_dest))
            else:
                print(_msg(f"  ✗ 无法移除 {plugin_dest}（可能被 CLI 进程占用）",
                           f"  ✗ Cannot remove {plugin_dest} (may be locked by CLI)"))
                ok = False

            # Restore preserved user/ directory
            if _user_bak and _user_bak.exists():
                _restore = plugin_dest / "user"
                if not _restore.exists():
                    _restore.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(_user_bak, _restore)
                print(_msg(f"  已保留用户目录: {_restore}",
                           f"  Preserved user directory: {_restore}"))
        except Exception as e:
            print(_msg(f"  ⚠ 移除插件目录时出错: {e}",
                       f"  ⚠ Error removing plugin directory: {e}"))
            ok = False
        finally:
            if _user_bak and _user_bak.parent.exists():
                shutil.rmtree(_user_bak.parent, ignore_errors=True)

    if rules_dest.exists():
        if is_helloagents_file(rules_dest) or rules_dest.stat().st_size == 0:
            try:
                rules_dest.unlink()
                removed.append(str(rules_dest))
            except Exception as e:
                print(_msg(f"  ✗ 无法移除 {rules_dest}: {e}",
                           f"  ✗ Cannot remove {rules_dest}: {e}"))
                ok = False
        else:
            print(_msg(f"  保留 {rules_dest}（用户创建，非 HelloAGENTS）",
                       f"  Kept {rules_dest} (user-created, not HelloAGENTS)"))

    # Remove skills/helloagents/ directory (SKILL.md deployment)
    try:
        removed.extend(clean_skills_dir(dest_dir))
    except Exception as e:
        print(_msg(f"  ⚠ 移除 skills 目录时出错: {e}",
                   f"  ⚠ Error removing skills directory: {e}"))
        ok = False

    # Target-specific cleanup
    if target == "claude":
        removed.extend(_uninstall_claude_extras(dest_dir))
    elif target == "codex":
        removed.extend(_uninstall_codex_extras(dest_dir))
    elif target == "gemini":
        removed.extend(_uninstall_gemini_extras(dest_dir))
    elif target == "qwen":
        removed.extend(_uninstall_qwen_extras(dest_dir))
    elif target == "grok":
        removed.extend(_uninstall_grok_extras(dest_dir))

    if removed:
        print(_msg(f"  已移除 {len(removed)} 个项目:",
                   f"  Removed {len(removed)} item(s):"))
        for r in removed:
            print(f"    - {r}")
        print(_msg(f"  {target} 卸载完成。请重启终端以应用更改。",
                   f"  Uninstall complete for {target}. Please restart your terminal to apply changes."))
    else:
        print(_msg(f"  {target}: 无需移除。",
                   f"  {target}: nothing to remove."))

    if show_package_hint:
        remaining = _detect_installed_targets()
        if not remaining:
            print()
            print(_msg("  已无已安装的 CLI 目标。是否同时移除 helloagents 包本身？",
                       "  No installed CLI targets remaining. "
                       "Also remove the helloagents package itself?"))
            print()
            print(_msg("  [1] 是，彻底移除", "  [1] Yes, remove completely"))
            print(_msg("  [2] 否，保留并退出",
                       "  [2] No, keep and exit"))
            print()

            prompt = _msg("  请输入编号（直接回车跳过）: ",
                          "  Enter number (press Enter to skip): ")
            try:
                choice = input(prompt).strip()
            except (EOFError, KeyboardInterrupt):
                print()
                choice = ""

            if choice == "1":
                _self_uninstall()
            else:
                method = _detect_install_method()
                print(_msg("  如需稍后移除，请执行:",
                           "  To remove later, run:"))
                if method == "uv":
                    print("    uv tool uninstall helloagents")
                else:
                    print("    pip uninstall helloagents")

    return ok


def uninstall_all(purge: bool = False) -> None:
    """Uninstall HelloAGENTS from all detected CLI targets.

    Args:
        purge: If True, also remove the helloagents package itself.
    """
    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  未检测到任何 CLI 安装。",
                   "  No CLI installations detected."))
        if purge:
            _self_uninstall()
        else:
            print()
            print(_msg("  是否彻底移除 helloagents 包本身？",
                       "  Remove the helloagents package itself?"))
            print()
            print(_msg("  [1] 是，彻底移除", "  [1] Yes, remove completely"))
            print(_msg("  [2] 否，保留并退出",
                       "  [2] No, keep and exit"))
            print()

            prompt = _msg("  请输入编号（直接回车跳过）: ",
                          "  Enter number (press Enter to skip): ")
            try:
                choice = input(prompt).strip()
            except (EOFError, KeyboardInterrupt):
                print()
                choice = ""

            if choice == "1":
                _self_uninstall()
        return

    print(_msg(f"  将卸载的目标: {', '.join(targets)}",
               f"  Targets to uninstall: {', '.join(targets)}"))
    for t in targets:
        uninstall(t, show_package_hint=False)
        print()

    if purge:
        remaining = _detect_installed_targets()
        if not remaining:
            _self_uninstall()
        else:
            print(_msg(f"  ⚠ 仍有 {len(remaining)} 个目标未卸载完成: {', '.join(remaining)}",
                       f"  ⚠ {len(remaining)} target(s) still installed: {', '.join(remaining)}"))
            print(_msg("  跳过包移除。请先解决卸载失败的目标后再尝试。",
                       "  Skipping package removal. Please resolve failed targets first."))
    else:
        remaining = _detect_installed_targets()
        if not remaining:
            print(_msg("  是否同时移除 helloagents 包本身？",
                       "  Also remove the helloagents package itself?"))
            print()
            print(_msg("  [1] 是，彻底移除", "  [1] Yes, remove completely"))
            print(_msg("  [2] 否，保留并退出",
                       "  [2] No, keep and exit"))
            print()

            prompt = _msg("  请输入编号（直接回车跳过）: ",
                          "  Enter number (press Enter to skip): ")
            try:
                choice = input(prompt).strip()
            except (EOFError, KeyboardInterrupt):
                print()
                choice = ""

            if choice == "1":
                _self_uninstall()
            else:
                method = _detect_install_method()
                print(_msg("  如需稍后移除，请执行:",
                           "  To remove later, run:"))
                if method == "uv":
                    print("    uv tool uninstall helloagents")
                else:
                    print("    pip uninstall helloagents")

"""HelloAGENTS Installer - Install and uninstall operations."""

import shutil
from pathlib import Path

import subprocess
import sys

from .cli import (
    _msg,
    CLI_TARGETS, PLUGIN_DIR_NAME, HELLOAGENTS_MARKER,
    is_helloagents_file, is_helloagents_rule, backup_user_file,
    get_agents_md_path, get_skill_md_path, get_helloagents_module_path,
    detect_installed_clis, _detect_installed_targets, _detect_install_method,
)
from .config_helpers import (
    _configure_codex_toml, _configure_codex_csv_batch,
    _configure_codex_notify, _remove_codex_notify,
    _configure_claude_hooks, _remove_claude_hooks,
    _configure_claude_permissions, _remove_claude_permissions,
    _deploy_claude_rules, _remove_claude_rules,
)
from .win_helpers import (
    _cleanup_pip_remnants, _win_deferred_pip,
    build_pip_cleanup_cmd,
    win_preemptive_unlock, win_finish_unlock, win_safe_rmtree,
    win_exe_retry,  # noqa: F401 — backward-compatible re-export
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

_AGENT_PREFIX = "ha-"  # HelloAGENTS agent files use this prefix


def _deploy_agent_files(dest_dir: Path) -> None:
    """Deploy HelloAGENTS agent definition files to ~/.claude/agents/."""
    agents_src = get_helloagents_module_path() / "agents"
    if not agents_src.exists():
        return
    agents_dest = dest_dir / "agents"
    agents_dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for src_file in agents_src.glob(f"{_AGENT_PREFIX}*.md"):
        shutil.copy2(src_file, agents_dest / src_file.name)
        count += 1
    if count:
        print(_msg(f"  已部署 {count} 个子代理定义 ({agents_dest})",
                   f"  Deployed {count} agent definition(s) ({agents_dest})"))


def _remove_agent_files(dest_dir: Path) -> list[str]:
    """Remove HelloAGENTS agent definition files from ~/.claude/agents/."""
    agents_dir = dest_dir / "agents"
    removed = []
    if not agents_dir.exists():
        return removed
    for f in agents_dir.glob(f"{_AGENT_PREFIX}*.md"):
        f.unlink()
        removed.append(str(f))
    if agents_dir.exists() and not any(agents_dir.iterdir()):
        agents_dir.rmdir()
        removed.append(f"{agents_dir} (empty parent)")
    return removed


# ---------------------------------------------------------------------------
# File cleanup
# ---------------------------------------------------------------------------

def clean_stale_files(dest_dir: Path, current_rules_file: str) -> list[str]:
    """Remove stale files from previous HelloAGENTS versions.

    Handles both current-version stale files and legacy (pre-v2.2) remnants.
    Only removes files confirmed to be HelloAGENTS-related.

    Args:
        dest_dir: CLI config directory (e.g. ~/.claude/).
        current_rules_file: Rules file name for this CLI target.

    Returns:
        List of removed file/directory paths.
    """
    removed = []

    # --- Clean skills/helloagents/ directory (will be re-deployed fresh if needed) ---
    legacy_skills_dir = dest_dir / "skills" / "helloagents"
    if legacy_skills_dir.exists():
        if win_safe_rmtree(legacy_skills_dir):
            removed.append(f"{legacy_skills_dir} (stale)")
            skills_parent = dest_dir / "skills"
            if skills_parent.exists() and not any(skills_parent.iterdir()):
                skills_parent.rmdir()
                removed.append(f"{skills_parent} (empty parent)")

    # --- Current-version stale rules files ---
    # Only removes files confirmed to be HelloAGENTS-related (is_helloagents_file check).
    # User-created files with the same name but without HELLOAGENTS_MARKER are never touched.
    all_rules_files = {cfg["rules_file"] for cfg in CLI_TARGETS.values()}
    stale_rules = all_rules_files - {current_rules_file}
    for name in stale_rules:
        stale_path = dest_dir / name
        if stale_path.exists() and stale_path.is_file():
            if is_helloagents_file(stale_path):
                stale_path.unlink()
                removed.append(str(stale_path))

    # --- __pycache__ under helloagents plugin dir ---
    plugin_dir = dest_dir / PLUGIN_DIR_NAME
    if plugin_dir.exists():
        for cache_dir in plugin_dir.rglob("__pycache__"):
            if cache_dir.is_dir():
                if win_safe_rmtree(cache_dir):
                    removed.append(str(cache_dir))

    # --- Clean stale rules/helloagents/ split rule files ---
    rules_ha_dir = dest_dir / "rules" / "helloagents"
    if rules_ha_dir.exists():
        for f in rules_ha_dir.glob("*.md"):
            if is_helloagents_rule(f):
                try:
                    f.unlink()
                    removed.append(f"{f} (stale rule)")
                except Exception:
                    pass
        if rules_ha_dir.exists() and not any(rules_ha_dir.iterdir()):
            rules_ha_dir.rmdir()
            removed.append(f"{rules_ha_dir} (empty)")

    return removed


# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

def install(target: str) -> bool:
    """Install HelloAGENTS to a specific CLI."""
    if target not in CLI_TARGETS:
        print(_msg(f"  未知目标: {target}", f"  Unknown target: {target}"))
        print(_msg(f"  可用目标: {', '.join(CLI_TARGETS.keys())}",
                   f"  Available targets: {', '.join(CLI_TARGETS.keys())}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]

    if not dest_dir.exists():
        print(_msg(f"  警告: {dest_dir} 不存在，{target} CLI 可能未安装。",
                   f"  Warning: {dest_dir} does not exist. {target} CLI may not be installed."))
    dest_dir.mkdir(parents=True, exist_ok=True)

    agents_md_src = get_agents_md_path()
    module_src = get_helloagents_module_path()
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file

    print(_msg(f"  正在安装 HelloAGENTS 到 {target}...",
               f"  Installing HelloAGENTS to {target}..."))
    print(_msg(f"  目标目录: {dest_dir}", f"  Target directory: {dest_dir}"))

    # Clean stale files
    removed = clean_stale_files(dest_dir, rules_file)
    if removed:
        print(_msg(f"  清理了 {len(removed)} 个过期文件:",
                   f"  Cleaned {len(removed)} stale file(s):"))
        for r in removed:
            print(f"    - {r}")

    try:
        # Preserve user/ directory (contains user preferences, not overwritable)
        user_dir = plugin_dest / "user"
        user_backup = None
        if user_dir.exists():
            import tempfile
            user_backup = Path(tempfile.mkdtemp()) / "user"
            shutil.copytree(user_dir, user_backup)

        # Remove old module directory completely before copying
        if plugin_dest.exists():
            if not win_safe_rmtree(plugin_dest):
                print(_msg(f"  ✗ 无法移除旧模块（可能被 CLI 进程占用）: {plugin_dest}",
                           f"  ✗ Cannot remove old module (may be locked by CLI): {plugin_dest}"))
                return False
            print(_msg(f"  已移除旧模块: {plugin_dest}",
                       f"  Removed old module: {plugin_dest}"))

        # Copy new module directory
        shutil.copytree(
            module_src, plugin_dest,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "hooks", "agents"),
        )
        print(_msg(f"  已安装模块到: {plugin_dest}",
                   f"  Installed module to: {plugin_dest}"))

        # Restore user/ directory (overwrite template with user data)
        if user_backup and user_backup.exists():
            target_user = plugin_dest / "user"
            if target_user.exists():
                shutil.rmtree(target_user)
            shutil.copytree(user_backup, target_user)
            shutil.rmtree(user_backup.parent)

        # Deploy rules
        if agents_md_src.exists():
            if target == "claude":
                # Split deployment for Claude Code (avoid 40k char warning)
                if rules_dest.exists() and not is_helloagents_file(rules_dest):
                    backup = backup_user_file(rules_dest)
                    print(_msg(f"  已备份现有规则到: {backup}",
                               f"  Backed up existing rules to: {backup}"))
                count = _deploy_claude_rules(dest_dir, agents_md_src)
                print(_msg(f"  已部署拆分规则: {count} 个文件 (CLAUDE.md + rules/helloagents/)",
                           f"  Deployed split rules: {count} file(s) (CLAUDE.md + rules/helloagents/)"))
            else:
                if rules_dest.exists():
                    if is_helloagents_file(rules_dest):
                        shutil.copy2(agents_md_src, rules_dest)
                        print(_msg(f"  已更新规则: {rules_dest}",
                                   f"  Updated rules: {rules_dest}"))
                    else:
                        backup = backup_user_file(rules_dest)
                        print(_msg(f"  已备份现有规则到: {backup}",
                                   f"  Backed up existing rules to: {backup}"))
                        shutil.copy2(agents_md_src, rules_dest)
                        print(_msg(f"  已安装规则到: {rules_dest}",
                                   f"  Installed rules to: {rules_dest}"))
                else:
                    shutil.copy2(agents_md_src, rules_dest)
                    print(_msg(f"  已安装规则到: {rules_dest}",
                               f"  Installed rules to: {rules_dest}"))
        else:
            print(_msg(f"  警告: 未找到 AGENTS.md ({agents_md_src})",
                       f"  Warning: AGENTS.md not found at {agents_md_src}"))

        # Deploy SKILL.md to skills discovery directory
        skill_md_src = get_skill_md_path()
        if skill_md_src.exists():
            skill_dest_dir = dest_dir / "skills" / "helloagents"
            skill_dest = skill_dest_dir / "SKILL.md"
            skill_dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill_md_src, skill_dest)
            print(_msg(f"  已部署技能: {skill_dest}",
                       f"  Deployed skill: {skill_dest}"))

        # Deploy agent definition files (Claude Code only)
        if target == "claude":
            _deploy_agent_files(dest_dir)
    except Exception as e:
        # Clean up temp directory on failure
        if user_backup and user_backup.parent.exists():
            shutil.rmtree(user_backup.parent, ignore_errors=True)
        print(_msg(f"  ✗ 安装失败: {e}", f"  ✗ Installation failed: {e}"))
        return False

    print(_msg(f"  {target} 安装完成！请重启终端以应用更改。",
               f"  Installation complete for {target}! Please restart your terminal to apply changes."))
    config_path = Path.home() / ".helloagents" / "config.json"
    if not config_path.exists():
        print(_msg("  ℹ 个性化配置可写入 ~/.helloagents/config.json，更新时不会被覆盖。",
                   "  ℹ Custom settings can be saved to ~/.helloagents/config.json (preserved across updates)."))

    # Target-specific post-install: hooks & config
    if target == "claude":
        try:
            _configure_claude_hooks(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置 Hooks 时出错: {e}",
                       f"  ⚠ Error configuring hooks: {e}"))
        try:
            _configure_claude_permissions(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置工具权限时出错: {e}",
                       f"  ⚠ Error configuring tool permissions: {e}"))
    elif target == "codex":
        try:
            _configure_codex_toml(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置 config.toml 时出错: {e}",
                       f"  ⚠ Error configuring config.toml: {e}"))
        try:
            _configure_codex_notify(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置 notify hook 时出错: {e}",
                       f"  ⚠ Error configuring notify hook: {e}"))
        try:
            _configure_codex_csv_batch(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置 CSV 批处理时出错: {e}",
                       f"  ⚠ Error configuring CSV batch: {e}"))
        print(_msg("  提示: 需在 Codex CLI 中执行 /experimental 开启多代理功能。",
                   "  Note: Run /experimental in Codex CLI to enable multi-agent features."))
        print(_msg("  提示: VS Code Codex 插件对 HelloAGENTS 系统的支持可能与 CLI 不同，建议优先在 Codex CLI 中使用。",
                   "  Note: VS Code Codex plugin may not fully support HelloAGENTS. Codex CLI is recommended."))

    return True


def install_all() -> bool:
    """Install to all detected CLI directories."""
    detected = detect_installed_clis()
    if not detected:
        print(_msg("  未检测到 CLI 目录。", "  No CLI directories detected."))
        print(_msg(f"  支持的 CLI: {', '.join(CLI_TARGETS.keys())}",
                   f"  Supported CLIs: {', '.join(CLI_TARGETS.keys())}"))
        return False

    print(_msg(f"  检测到的 CLI: {', '.join(detected)}",
               f"  Detected CLIs: {', '.join(detected)}"))
    failed = []
    for target in detected:
        if not install(target):
            failed.append(target)
        print()

    if failed:
        print(_msg(f"  失败: {', '.join(failed)}", f"  Failed: {', '.join(failed)}"))
        return False
    return True


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
        # Preserve user/ directory before removing plugin (contains user preferences)
        user_dir = plugin_dest / "user"
        user_backup = None
        try:
            if user_dir.exists() and any(user_dir.iterdir()):
                import tempfile
                user_backup = Path(tempfile.mkdtemp()) / "user"
                shutil.copytree(user_dir, user_backup)

            if win_safe_rmtree(plugin_dest):
                removed.append(str(plugin_dest))
            else:
                print(_msg(f"  ✗ 无法移除 {plugin_dest}（可能被 CLI 进程占用）",
                           f"  ✗ Cannot remove {plugin_dest} (may be locked by CLI)"))
                ok = False

            # Restore user/ directory if it was backed up
            if user_backup and user_backup.exists():
                restore_dir = plugin_dest / "user"
                restore_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(user_backup, restore_dir)
                print(_msg(f"  已保留用户偏好目录: {restore_dir}",
                           f"  Preserved user preferences: {restore_dir}"))
        finally:
            # Always clean up temp directory
            if user_backup and user_backup.parent.exists():
                shutil.rmtree(user_backup.parent, ignore_errors=True)

    if rules_dest.exists():
        if is_helloagents_file(rules_dest):
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
    skills_dir = dest_dir / "skills" / "helloagents"
    if skills_dir.exists():
        if win_safe_rmtree(skills_dir):
            removed.append(str(skills_dir))
            skills_parent = dest_dir / "skills"
            if skills_parent.exists() and not any(skills_parent.iterdir()):
                skills_parent.rmdir()
                removed.append(f"{skills_parent} (empty parent)")
        else:
            print(_msg(f"  ✗ 无法移除 {skills_dir}（可能被 CLI 进程占用）",
                       f"  ✗ Cannot remove {skills_dir} (may be locked by CLI)"))
            ok = False

    # Remove agent definition files (Claude Code only)
    if target == "claude":
        removed.extend(_remove_agent_files(dest_dir))

    # Remove split rule files (Claude Code only)
    if target == "claude":
        try:
            if _remove_claude_rules(dest_dir):
                removed.append("rules/helloagents/ (split rules)")
        except Exception as e:
            print(_msg(f"  ⚠ 移除拆分规则时出错: {e}",
                       f"  ⚠ Error removing split rules: {e}"))

    # Remove hooks configuration
    if target == "claude":
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
    elif target == "codex":
        try:
            if _remove_codex_notify(dest_dir):
                removed.append("notify hook (config.toml)")
        except Exception as e:
            print(_msg(f"  ⚠ 移除 notify hook 时出错: {e}",
                       f"  ⚠ Error removing notify hook: {e}"))
        print(_msg(
            "  ℹ config.toml 中的 project_doc_max_bytes / agents.max_threads / agents.max_depth / sqlite 配置已保留（可能被其他工具使用）。",
            "  ℹ project_doc_max_bytes / agents.max_threads / agents.max_depth / sqlite kept in config.toml (may be used by other tools)."))

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
            method = _detect_install_method()
            print()
            print(_msg("  已无已安装的 CLI 目标。",
                       "  No installed CLI targets remaining."))
            print(_msg("  如需同时移除 helloagents 包本身，请执行:",
                       "  To also remove the helloagents package itself, run:"))
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
        _self_uninstall()
    else:
        method = _detect_install_method()
        print(_msg("  如需同时移除 helloagents 包本身，请执行:",
                   "  To also remove the helloagents package itself, run:"))
        if method == "uv":
            print("    uv tool uninstall helloagents")
        else:
            print("    pip uninstall helloagents")

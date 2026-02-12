"""HelloAGENTS Installer - Install and uninstall operations."""

import shutil
from pathlib import Path
from importlib.metadata import version as get_version

import subprocess
import sys

from .cli import (
    _msg, _header,
    CLI_TARGETS, PLUGIN_DIR_NAME, HELLOAGENTS_MARKER,
    is_helloagents_file, backup_user_file,
    get_agents_md_path, get_helloagents_module_path,
    detect_installed_clis, _detect_installed_targets, _detect_install_method,
)
from .win_helpers import (
    _cleanup_pip_remnants, _win_deferred_pip,
    build_pip_cleanup_cmd, win_exe_retry,
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
    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                encoding="utf-8", errors="replace")
        if result.returncode == 0:
            print(_msg("  ✓ helloagents 包已移除。",
                       "  ✓ helloagents package removed."))
            _cleanup_pip_remnants()
            return True

        stderr = result.stderr.strip()

        # Windows .exe locking — use shared retry helper
        if sys.platform == "win32" and method == "pip" and (
                "WinError" in stderr or "helloagents.exe" in stderr):
            ok, _ = win_exe_retry(cmd, label=method)
            if ok:
                _cleanup_pip_remnants()
                return True
            # Rename-and-retry failed; schedule deferred uninstall
            if _win_deferred_pip(cmd, post_cmds=[build_pip_cleanup_cmd()]):
                print(_msg(
                    "  helloagents 包将在程序退出后自动移除。",
                    "  helloagents package will be removed after exit."))
                return True
            # Deferred also failed
            print(_msg(
                "  ✗ 无法自动移除。请退出后手动执行:",
                "  ✗ Cannot auto-remove. Please exit and run manually:"))
            print("    pip uninstall helloagents")
            return False

        if stderr:
            print(f"  ✗ {stderr}")
        return False
    except FileNotFoundError:
        print(_msg(f"  ✗ 未找到 {method}。请手动执行:",
                   f"  ✗ {method} not found. Please run manually:"))
        if method == "uv":
            print("    uv tool uninstall helloagents")
        else:
            print("    pip uninstall helloagents")
        return False


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

    # --- Legacy v1/v2.0 cleanup: skills/helloagents/ directory ---
    legacy_skills_dir = dest_dir / "skills" / "helloagents"
    if legacy_skills_dir.exists():
        shutil.rmtree(legacy_skills_dir)
        removed.append(f"{legacy_skills_dir} (legacy)")
        skills_parent = dest_dir / "skills"
        if skills_parent.exists() and not any(skills_parent.iterdir()):
            skills_parent.rmdir()
            removed.append(f"{skills_parent} (empty parent)")

    # --- Current-version stale rules files ---
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
                shutil.rmtree(cache_dir)
                removed.append(str(cache_dir))

    return removed


# ---------------------------------------------------------------------------
# Codex config helper
# ---------------------------------------------------------------------------

def _configure_codex_toml() -> None:
    """Ensure ~/.codex/config.toml has project_doc_max_bytes >= 98304."""
    import re
    config_path = Path.home() / ".codex" / "config.toml"
    content = ""
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")

    # Already set and large enough — nothing to do
    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', content)
    if m and int(m.group(1)) >= 98304:
        return

    if m:
        # Exists but value is too small — replace it
        content = re.sub(
            r'project_doc_max_bytes\s*=\s*\d+',
            'project_doc_max_bytes = 98304',
            content)
    else:
        # Not present — insert before the first [section] or at the top
        insert_pos = 0
        section_match = re.search(r'^\[', content, re.MULTILINE)
        if section_match:
            insert_pos = section_match.start()
        line = "project_doc_max_bytes = 98304\n"
        if insert_pos > 0:
            line += "\n"
        content = content[:insert_pos] + line + content[insert_pos:]

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8")
    print(_msg("  已配置 project_doc_max_bytes = 98304 (防止 AGENTS.md 被截断)",
               "  Configured project_doc_max_bytes = 98304 (prevent AGENTS.md truncation)"))


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
        legacy_items = [r for r in removed if "(legacy)" in r]
        other_items = [r for r in removed if "(legacy)" not in r]
        if legacy_items:
            print(_msg(f"  从旧版迁移: 清理了 {len(legacy_items)} 个旧文件",
                       f"  Migrated from legacy version: cleaned {len(legacy_items)} old item(s)"))
            for r in legacy_items:
                print(f"    - {r}")
        if other_items:
            print(_msg(f"  清理了 {len(other_items)} 个过期文件:",
                       f"  Cleaned {len(other_items)} stale file(s):"))
            for r in other_items:
                print(f"    - {r}")

    # Remove old module directory completely before copying
    if plugin_dest.exists():
        shutil.rmtree(plugin_dest)
        print(_msg(f"  已移除旧模块: {plugin_dest}",
                   f"  Removed old module: {plugin_dest}"))

    # Copy new module directory
    shutil.copytree(
        module_src, plugin_dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    print(_msg(f"  已安装模块到: {plugin_dest}",
               f"  Installed module to: {plugin_dest}"))

    # Copy and rename AGENTS.md to target rules file
    if agents_md_src.exists():
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

    print(_msg(f"  {target} 安装完成！请重启终端以应用更改。",
               f"  Installation complete for {target}! Please restart your terminal to apply changes."))

    # Target-specific post-install configuration
    if target == "codex":
        try:
            _configure_codex_toml()
        except Exception:
            pass
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

    if plugin_dest.exists():
        shutil.rmtree(plugin_dest)
        removed.append(str(plugin_dest))

    if rules_dest.exists():
        if is_helloagents_file(rules_dest):
            rules_dest.unlink()
            removed.append(str(rules_dest))
        else:
            print(_msg(f"  保留 {rules_dest}（用户创建，非 HelloAGENTS）",
                       f"  Kept {rules_dest} (user-created, not HelloAGENTS)"))

    legacy_dir = dest_dir / "skills" / "helloagents"
    if legacy_dir.exists():
        shutil.rmtree(legacy_dir)
        removed.append(f"{legacy_dir} (legacy)")
        skills_parent = dest_dir / "skills"
        if skills_parent.exists() and not any(skills_parent.iterdir()):
            skills_parent.rmdir()
            removed.append(f"{skills_parent} (empty parent)")

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

    return True


def uninstall_all(purge: bool = False) -> None:
    """Uninstall HelloAGENTS from all detected CLI targets.

    Args:
        purge: If True, also remove the helloagents package itself.
    """
    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  未检测到已安装的 CLI 目标。",
                   "  No installed CLI targets detected."))
        if purge:
            _self_uninstall()
        return

    print(_msg(f"  将卸载的目标: {', '.join(targets)}",
               f"  Targets to uninstall: {', '.join(targets)}"))
    for t in targets:
        uninstall(t, show_package_hint=not purge)
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

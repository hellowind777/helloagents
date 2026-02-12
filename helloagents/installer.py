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
            from .updater import _cleanup_pip_remnants
            _cleanup_pip_remnants()
            return True

        stderr = result.stderr.strip()

        # Windows .exe locking — rename and retry
        if sys.platform == "win32" and method == "pip" and (
                "WinError" in stderr or "helloagents.exe" in stderr):
            exe = shutil.which("helloagents")
            if exe:
                exe_path = Path(exe)
                bak_path = exe_path.with_suffix(".exe.bak")
                try:
                    exe_path.rename(bak_path)
                    print(_msg("  .exe 文件已锁定，重命名后重试...",
                               "  .exe file locked, renamed and retrying..."))
                    retry = subprocess.run(cmd, capture_output=True, text=True,
                                           encoding="utf-8", errors="replace")
                    if retry.returncode == 0:
                        print(_msg("  ✓ helloagents 包已移除。",
                                   "  ✓ helloagents package removed."))
                        try:
                            bak_path.unlink()
                        except OSError:
                            pass  # locked by current process, harmless
                        from .updater import _cleanup_pip_remnants
                        _cleanup_pip_remnants()
                        return True
                    else:
                        # Restore .exe
                        try:
                            bak_path.rename(exe_path)
                        except OSError:
                            pass
                        retry_err = retry.stderr.strip()
                        if retry_err:
                            print(f"  ✗ {retry_err}")
                        return False
                except OSError:
                    pass

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
# Interactive install
# ---------------------------------------------------------------------------

def _interactive_install() -> bool:
    """Show interactive menu for selecting CLI targets to install."""
    targets = list(CLI_TARGETS.keys())
    detected = detect_installed_clis()
    installed = _detect_installed_targets()

    _header(_msg("步骤 1/3: 选择目标", "Step 1/3: Select Targets"))

    for i, name in enumerate(targets, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        if name in installed:
            tag = _msg("[已安装 HelloAGENTS]", "[HelloAGENTS installed]")
        elif name in detected:
            tag = _msg("[已检测到该工具]", "[tool found]")
        else:
            tag = ""
        print(f"  [{i}] {name:10} {dir_path:20} {tag}")

    print()
    prompt = _msg(
        "  请输入编号，可多选（如 1 3 5）或 all 全选，直接回车跳过: ",
        "  Enter numbers, multi-select supported (e.g. 1 3 5) or 'all', press Enter to skip: ",
    )

    try:
        choice = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return True

    if not choice:
        print(_msg("  已跳过安装。", "  Skipped."))
        return True

    if choice.lower() == "all":
        selected = targets
    else:
        nums = choice.replace(",", " ").split()
        seen = set()
        selected = []
        for n in nums:
            try:
                idx = int(n)
                if 1 <= idx <= len(targets):
                    name = targets[idx - 1]
                    if name not in seen:
                        seen.add(name)
                        selected.append(name)
                else:
                    print(_msg(f"  忽略无效编号: {n}",
                               f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}",
                           f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    _header(_msg(f"步骤 2/3: 执行安装（共 {len(selected)} 个目标）",
                 f"Step 2/3: Installing ({len(selected)} target(s))"))

    results = {}
    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}",
                   f"  [{i}/{len(selected)}] {t}"))
        results[t] = install(t)
        print()

    _header(_msg("步骤 3/3: 安装结果", "Step 3/3: Installation Summary"))
    for t, ok in results.items():
        mark = "✓" if ok else "✗"
        status_text = _msg("成功", "OK") if ok else _msg("失败", "FAILED")
        print(f"  {mark} {t:10} {status_text}")

    succeeded = sum(1 for v in results.values() if v)
    failed_count = len(results) - succeeded
    print()
    if failed_count:
        print(_msg(f"  共 {succeeded} 个成功，{failed_count} 个失败。",
                   f"  {succeeded} succeeded, {failed_count} failed."))
        return False
    print(_msg(
        f"  共 {succeeded} 个目标安装成功。请重启终端以应用更改。",
        f"  All {succeeded} target(s) installed successfully. "
        f"Please restart your terminal to apply changes."))
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


# ---------------------------------------------------------------------------
# Interactive uninstall
# ---------------------------------------------------------------------------

def _interactive_uninstall() -> bool:
    """Show interactive menu for selecting CLI targets to uninstall."""
    installed = _detect_installed_targets()
    if not installed:
        print(_msg("  未检测到已安装的 CLI 目标。",
                   "  No installed CLI targets detected."))
        return True

    _header(_msg("步骤 1/3: 选择要卸载的目标",
                 "Step 1/3: Select Targets to Uninstall"))

    for i, name in enumerate(installed, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        print(f"  [{i}] {name:10} {dir_path}")

    print()
    prompt = _msg(
        "  请输入要卸载的编号，可多选（如 1 3）或 all 全选，直接回车跳过: ",
        "  Enter numbers to uninstall, multi-select supported (e.g. 1 3) "
        "or 'all', press Enter to skip: ",
    )

    try:
        choice = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return True

    if not choice:
        print(_msg("  已跳过。", "  Skipped."))
        return True

    if choice.lower() == "all":
        selected = installed
    else:
        nums = choice.replace(",", " ").split()
        seen = set()
        selected = []
        for n in nums:
            try:
                idx = int(n)
                if 1 <= idx <= len(installed):
                    name = installed[idx - 1]
                    if name not in seen:
                        seen.add(name)
                        selected.append(name)
                else:
                    print(_msg(f"  忽略无效编号: {n}",
                               f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}",
                           f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    # Determine total steps: 3 if no purge prompt needed, 4 if we'll ask
    remaining_after = set(_detect_installed_targets()) - set(selected)
    total_steps = 4 if not remaining_after else 3

    _header(_msg(f"步骤 2/{total_steps}: 执行卸载（共 {len(selected)} 个目标）",
                 f"Step 2/{total_steps}: Uninstalling ({len(selected)} target(s))"))

    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}",
                   f"  [{i}/{len(selected)}] {t}"))
        uninstall(t, show_package_hint=False)
        print()

    _header(_msg(f"步骤 3/{total_steps}: 卸载结果",
                 f"Step 3/{total_steps}: Uninstall Summary"))
    for t in selected:
        print(f"  ✓ {t:10} {_msg('已卸载', 'removed')}")

    print()
    print(_msg(f"  共卸载 {len(selected)} 个目标。请重启终端以应用更改。",
               f"  {len(selected)} target(s) uninstalled. "
               f"Please restart your terminal to apply changes."))

    # If no CLI targets remain, offer to remove the package itself
    if not remaining_after:
        _header(_msg(f"步骤 4/{total_steps}: 移除 helloagents 包",
                     f"Step 4/{total_steps}: Remove helloagents Package"))

        print(_msg("  已无已安装的 CLI 目标。是否同时移除 helloagents 包本身？",
                   "  No installed CLI targets remaining. "
                   "Also remove the helloagents package itself?"))
        print()
        print(_msg("  [1] 是，彻底移除", "  [1] Yes, remove completely"))
        print(_msg("  [2] 否，仅卸载 CLI 目标",
                   "  [2] No, only uninstall CLI targets"))
        print()

        prompt = _msg("  请输入编号（直接回车跳过）: ",
                      "  Enter number (press Enter to skip): ")
        try:
            purge_choice = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            purge_choice = ""

        if purge_choice == "1":
            _self_uninstall()
        else:
            method = _detect_install_method()
            print(_msg("  如需稍后移除，请执行:",
                       "  To remove later, run:"))
            if method == "uv":
                print("    uv tool uninstall helloagents")
            else:
                print("    pip uninstall helloagents")

    return True

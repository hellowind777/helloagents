"""HelloAGENTS CLI - Multi-CLI installer and version checker.

Supports installation to:
- Claude Code (~/.claude/)
- Codex CLI (~/.codex/)
- OpenCode (~/.opencode/)
- Gemini CLI (~/.gemini/)
- Qwen CLI (~/.qwen/)
- Grok CLI (~/.grok/)
"""

import json
import locale
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from importlib.metadata import version as get_version
from importlib.resources import files
from urllib.request import urlopen, Request

REPO_URL = "https://github.com/hellowind777/helloagents"
REPO_API_LATEST = "https://api.github.com/repos/hellowind777/helloagents/releases/latest"

CLI_TARGETS = {
    "codex": {"dir": ".codex", "rules_file": "AGENTS.md"},
    "claude": {"dir": ".claude", "rules_file": "CLAUDE.md"},
    "gemini": {"dir": ".gemini", "rules_file": "GEMINI.md"},
    "qwen": {"dir": ".qwen", "rules_file": "QWEN.md"},
    "grok": {"dir": ".grok", "rules_file": "GROK.md"},
    "opencode": {"dir": ".opencode", "rules_file": "OpenCode.md"},
}

PLUGIN_DIR_NAME = "helloagents"

# Fingerprint marker to identify HelloAGENTS-created files
HELLOAGENTS_MARKER = "HELLOAGENTS_ROUTER:"


def _detect_locale() -> str:
    """Detect system locale. Returns 'zh' for Chinese locales, 'en' otherwise."""
    for var in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        val = os.environ.get(var, "")
        if val.lower().startswith("zh"):
            return "zh"
    try:
        loc = locale.getlocale()[0] or ""
        if loc.lower().startswith("zh"):
            return "zh"
    except Exception:
        pass
    # Windows fallback: check default locale
    if sys.platform == "win32":
        try:
            import ctypes
            lcid = ctypes.windll.kernel32.GetUserDefaultUILanguage()
            # Chinese language IDs: 0x0004 (zh), 0x0804 (zh-CN), 0x0404 (zh-TW), etc.
            if (lcid & 0xFF) == 0x04:
                return "zh"
        except Exception:
            pass
    return "en"


_LANG = _detect_locale()


def _msg(zh: str, en: str) -> str:
    """Return message based on detected locale."""
    return zh if _LANG == "zh" else en


def _divider(width: int = 40) -> None:
    """Print a divider line."""
    print("─" * width)


def _header(title: str) -> None:
    """Print a section header with divider."""
    print(f"\n── {title} ──")
    print()


def is_helloagents_file(file_path: Path) -> bool:
    """Check if a file was created by HelloAGENTS.

    Args:
        file_path: Path to the file to check.

    Returns:
        True if the file contains the HelloAGENTS marker, False otherwise.
    """
    try:
        # Read first 1KB to check for marker (enough to cover the header)
        content = file_path.read_text(encoding="utf-8", errors="ignore")[:1024]
        return HELLOAGENTS_MARKER in content
    except Exception:
        return False


def backup_user_file(file_path: Path) -> Path:
    """Backup a non-HelloAGENTS file with timestamp suffix.

    Args:
        file_path: Path to the file to backup.

    Returns:
        Path to the backup file.
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_name = f"{file_path.stem}_{timestamp}_bak{file_path.suffix}"
    backup_path = file_path.parent / backup_name
    shutil.copy2(file_path, backup_path)
    return backup_path


def _parse_version(ver: str) -> tuple[tuple[int, ...], bool]:
    """Parse version string into (numeric_tuple, is_stable).

    Handles formats like '2.3.0', '2.3.0-beta.1', '2.3.0b1'.
    Returns numeric parts and whether it's a stable release.
    """
    import re
    # Strip pre-release suffix: '2.3.0-beta.1' → '2.3.0', '2.3.0b1' → '2.3.0'
    match = re.match(r"^(\d+(?:\.\d+)*)", ver)
    if not match:
        raise ValueError(f"Invalid version: {ver}")
    numeric = tuple(int(x) for x in match.group(1).split("."))
    is_stable = match.group(0) == ver  # no suffix means stable
    return numeric, is_stable


def _version_newer(remote: str, local: str) -> bool:
    """Semantic version comparison. Returns True if remote > local.

    Pre-release versions (e.g. 2.3.0-beta.1) are compared by numeric
    parts only. Stable releases are considered newer than pre-releases
    with the same numeric version.
    """
    try:
        r_num, r_stable = _parse_version(remote)
        l_num, l_stable = _parse_version(local)
        if r_num != l_num:
            return r_num > l_num
        # Same numeric version: stable > pre-release
        return r_stable and not l_stable
    except (ValueError, TypeError):
        return False


def _detect_channel() -> str:
    """Detect install branch from package metadata. Returns actual branch name."""
    try:
        from importlib.metadata import distribution
        dist = distribution("helloagents")
        direct_url = dist.read_text("direct_url.json")
        if direct_url:
            info = json.loads(direct_url)
            vcs_info = info.get("vcs_info", {})
            ref = vcs_info.get("requested_revision", "")
            if ref:
                return ref
    except Exception:
        pass
    return "main"


def _fetch_remote_version(branch: str) -> str:
    """Fetch version from pyproject.toml on a remote branch."""
    import re
    url = f"https://raw.githubusercontent.com/hellowind777/helloagents/{branch}/pyproject.toml"
    req = Request(url, headers={"User-Agent": "helloagents-update-checker"})
    with urlopen(req, timeout=3) as resp:
        content = resp.read().decode("utf-8")
    m = re.search(r'version\s*=\s*"([^"]+)"', content)
    return m.group(1) if m else ""


def check_update() -> None:
    """Check for newer version on GitHub, respecting install branch."""
    try:
        local_ver = get_version("helloagents")
        branch = _detect_channel()
        remote_ver = ""
        if branch == "main":
            try:
                req = Request(REPO_API_LATEST, headers={"Accept": "application/vnd.github.v3+json"})
                with urlopen(req, timeout=3) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    remote_ver = data.get("tag_name", "").lstrip("v")
            except Exception:
                pass
            if not remote_ver:
                remote_ver = _fetch_remote_version("main")
        else:
            remote_ver = _fetch_remote_version(branch)
        if remote_ver and _version_newer(remote_ver, local_ver):
            print(_msg(f"发现新版本: {remote_ver}（当前: {local_ver}, 分支: {branch}）",
                       f"New version available: {remote_ver} (current: {local_ver}, branch: {branch})"))
            print(_msg("  执行 'helloagents update' 更新",
                       "  Run 'helloagents update' to update"))
    except Exception:
        pass


def get_package_root() -> Path:
    """Get the root directory of the installed package."""
    return Path(str(files("helloagents"))).parent


def get_agents_md_path() -> Path:
    """Get the path to AGENTS.md source file."""
    package_root = get_package_root()
    # AGENTS.md is at the same level as the helloagents package
    return package_root / "AGENTS.md"


def get_helloagents_module_path() -> Path:
    """Get the path to the helloagents module directory."""
    return Path(str(files("helloagents")))


def detect_installed_clis() -> list[str]:
    """Detect which CLI config directories exist."""
    installed = []
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        if cli_dir.exists():
            installed.append(name)
    return installed


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
        # Remove skills/ parent if now empty
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


def install(target: str) -> bool:
    """Install HelloAGENTS to a specific CLI."""
    if target not in CLI_TARGETS:
        print(_msg(f"未知目标: {target}", f"Unknown target: {target}"))
        print(_msg(f"可用目标: {', '.join(CLI_TARGETS.keys())}",
                   f"Available targets: {', '.join(CLI_TARGETS.keys())}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]

    # Warn if CLI directory doesn't exist (CLI may not be installed)
    if not dest_dir.exists():
        print(_msg(f"  警告: {dest_dir} 不存在，{target} CLI 可能未安装。",
                   f"  Warning: {dest_dir} does not exist. {target} CLI may not be installed."))
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Source paths
    agents_md_src = get_agents_md_path()
    module_src = get_helloagents_module_path()

    # Destination paths
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file

    print(_msg(f"正在安装 HelloAGENTS 到 {target}...",
               f"Installing HelloAGENTS to {target}..."))
    print(_msg(f"  目标目录: {dest_dir}", f"  Target directory: {dest_dir}"))

    # Clean stale files from previous versions (including legacy skills/)
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
        print(_msg(f"  已移除旧模块: {plugin_dest}", f"  Removed old module: {plugin_dest}"))

    # Copy new module directory
    shutil.copytree(
        module_src,
        plugin_dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    print(_msg(f"  已安装模块到: {plugin_dest}", f"  Installed module to: {plugin_dest}"))

    # Copy and rename AGENTS.md to target rules file
    if agents_md_src.exists():
        if rules_dest.exists():
            if is_helloagents_file(rules_dest):
                shutil.copy2(agents_md_src, rules_dest)
                print(_msg(f"  已更新规则: {rules_dest}", f"  Updated rules: {rules_dest}"))
            else:
                backup = backup_user_file(rules_dest)
                print(_msg(f"  已备份现有规则到: {backup}", f"  Backed up existing rules to: {backup}"))
                shutil.copy2(agents_md_src, rules_dest)
                print(_msg(f"  已安装规则到: {rules_dest}", f"  Installed rules to: {rules_dest}"))
        else:
            shutil.copy2(agents_md_src, rules_dest)
            print(_msg(f"  已安装规则到: {rules_dest}", f"  Installed rules to: {rules_dest}"))
    else:
        print(_msg(f"  警告: 未找到 AGENTS.md ({agents_md_src})",
                   f"  Warning: AGENTS.md not found at {agents_md_src}"))

    print(_msg(f"{target} 安装完成！", f"Installation complete for {target}!"))
    return True


def install_all() -> bool:
    """Install to all detected CLI directories.

    Returns:
        True if all installations succeeded, False if any failed.
    """
    detected = detect_installed_clis()
    if not detected:
        print(_msg("未检测到 CLI 目录。", "No CLI directories detected."))
        print(_msg(f"支持的 CLI: {', '.join(CLI_TARGETS.keys())}",
                   f"Supported CLIs: {', '.join(CLI_TARGETS.keys())}"))
        return False

    print(_msg(f"检测到的 CLI: {', '.join(detected)}",
               f"Detected CLIs: {', '.join(detected)}"))
    failed = []
    for target in detected:
        if not install(target):
            failed.append(target)
        print()

    if failed:
        print(_msg(f"失败: {', '.join(failed)}", f"Failed: {', '.join(failed)}"))
        return False
    return True


def _interactive_install() -> bool:
    """Show interactive menu for selecting CLI targets to install."""
    targets = list(CLI_TARGETS.keys())
    detected = detect_installed_clis()
    installed = _detect_installed_targets()

    # ── Phase 1: Select targets ──
    _header(_msg("选择目标", "Select Targets"))

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
                    print(_msg(f"  忽略无效编号: {n}", f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}", f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    # ── Phase 2: Execute installation ──
    _header(_msg(f"开始安装（共 {len(selected)} 个目标）",
                 f"Installing ({len(selected)} target(s))"))

    results = {}
    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}", f"  [{i}/{len(selected)}] {t}"))
        if install(t):
            results[t] = True
        else:
            results[t] = False
        print()

    # ── Phase 3: Summary ──
    _header(_msg("安装结果", "Installation Summary"))
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
    print(_msg(f"  共 {succeeded} 个目标安装成功。",
               f"  All {succeeded} target(s) installed successfully."))
    return True


def _interactive_uninstall() -> bool:
    """Show interactive menu for selecting CLI targets to uninstall."""
    installed = _detect_installed_targets()
    if not installed:
        print(_msg("  未检测到已安装的 CLI 目标。", "  No installed CLI targets detected."))
        return True

    # ── Phase 1: Select targets ──
    _header(_msg("选择要卸载的目标", "Select Targets to Uninstall"))

    for i, name in enumerate(installed, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        print(f"  [{i}] {name:10} {dir_path}")

    print()
    prompt = _msg(
        "  请输入要卸载的编号，可多选（如 1 3）或 all 全选，直接回车跳过: ",
        "  Enter numbers to uninstall, multi-select supported (e.g. 1 3) or 'all', press Enter to skip: ",
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
                    print(_msg(f"  忽略无效编号: {n}", f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}", f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    # ── Phase 2: Execute uninstall ──
    _header(_msg(f"开始卸载（共 {len(selected)} 个目标）",
                 f"Uninstalling ({len(selected)} target(s))"))

    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}", f"  [{i}/{len(selected)}] {t}"))
        uninstall(t)
        print()

    # ── Phase 3: Summary ──
    _header(_msg("卸载结果", "Uninstall Summary"))
    for t in selected:
        print(f"  ✓ {t:10} {_msg('已卸载', 'removed')}")

    print()
    print(_msg(f"  共卸载 {len(selected)} 个目标。",
               f"  {len(selected)} target(s) uninstalled."))
    return True
    return True


def uninstall(target: str) -> bool:
    """Uninstall HelloAGENTS from a specific CLI target.

    Removes plugin directory, rules file (if HelloAGENTS-created),
    and legacy skills/helloagents/ remnants.
    """
    if target not in CLI_TARGETS:
        print(_msg(f"未知目标: {target}", f"Unknown target: {target}"))
        print(_msg(f"可用目标: {', '.join(CLI_TARGETS.keys())}",
                   f"Available targets: {', '.join(CLI_TARGETS.keys())}"))
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

    print(_msg(f"正在从 {target} 卸载 HelloAGENTS...",
               f"Uninstalling HelloAGENTS from {target}..."))

    # Remove plugin directory
    if plugin_dest.exists():
        shutil.rmtree(plugin_dest)
        removed.append(str(plugin_dest))

    # Remove rules file (only if HelloAGENTS-created)
    if rules_dest.exists():
        if is_helloagents_file(rules_dest):
            rules_dest.unlink()
            removed.append(str(rules_dest))
        else:
            print(_msg(f"  保留 {rules_dest}（用户创建，非 HelloAGENTS）",
                       f"  Kept {rules_dest} (user-created, not HelloAGENTS)"))

    # Remove legacy skills/helloagents/
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
        print(_msg(f"{target} 卸载完成。", f"Uninstall complete for {target}."))
    else:
        print(_msg(f"  {target}: 无需移除。", f"  {target}: nothing to remove."))

    # Hint about package removal if no targets remain
    remaining = _detect_installed_targets()
    if not remaining:
        method = _detect_install_method()
        print()
        print(_msg("已无已安装的 CLI 目标。",
                   "No installed CLI targets remaining."))
        print(_msg("如需同时移除 helloagents 包本身，请执行:",
                   "To also remove the helloagents package itself, run:"))
        if method == "uv":
            print("  uv tool uninstall helloagents")
        else:
            print("  pip uninstall helloagents")

    return True


def _detect_install_method() -> str:
    """Detect whether helloagents was installed via uv or pip.

    Returns:
        'uv' if installed as a uv tool, 'pip' otherwise.
    """
    import subprocess
    try:
        result = subprocess.run(
            ["uv", "tool", "list"],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=5,
        )
        if result.returncode == 0 and "helloagents" in result.stdout:
            return "uv"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return "pip"


def uninstall_all() -> None:
    """Uninstall HelloAGENTS from all detected CLI targets."""
    targets = _detect_installed_targets()
    if not targets:
        print(_msg("未检测到已安装的 CLI 目标。", "No installed CLI targets detected."))
        return

    print(_msg(f"将卸载的目标: {', '.join(targets)}",
               f"Targets to uninstall: {', '.join(targets)}"))
    for t in targets:
        uninstall(t)
        print()

    method = _detect_install_method()
    print(_msg("如需同时移除 helloagents 包本身，请执行:",
               "To also remove the helloagents package itself, run:"))
    if method == "uv":
        print("  uv tool uninstall helloagents")
    else:
        print("  pip uninstall helloagents")


def _detect_installed_targets() -> list[str]:
    """Detect which CLI targets have HelloAGENTS installed (module + rules)."""
    installed = []
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]
        if plugin_dir.exists() and rules_file.exists():
            installed.append(name)
    return installed


def update(switch_branch: str = None) -> None:
    """Update HelloAGENTS to the latest version, then auto-sync installed targets."""
    import subprocess

    # ── Phase 1: Update package ──
    _header(_msg("更新 HelloAGENTS 包", "Update HelloAGENTS Package"))

    local_ver = "unknown"
    try:
        local_ver = get_version("helloagents")
    except Exception:
        pass

    branch = switch_branch or _detect_channel()
    print(_msg(f"  当前版本: {local_ver}", f"  Current version: {local_ver}"))
    print(_msg(f"  分支: {branch}", f"  Branch: {branch}"))
    print()

    branch_suffix = f"@{branch}" if branch != "main" else ""
    updated = False
    method = _detect_install_method()

    if method == "uv":
        uv_url = f"git+{REPO_URL}" + branch_suffix
        uv_cmd = ["uv", "tool", "install", "--from", uv_url, "helloagents", "--force"]
        try:
            result = subprocess.run(uv_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if result.returncode == 0:
                print(result.stdout.strip() if result.stdout.strip() else _msg("  ✓ 包更新完成 (uv)", "  ✓ Package updated (uv)"))
                updated = True
            else:
                stderr = result.stderr.strip()
                if stderr:
                    print(f"  uv error: {stderr}")
        except FileNotFoundError:
            print(_msg("  警告: 未找到 uv，回退到 pip。", "  Warning: uv not found, falling back to pip."))

    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade", pip_url]
        if method == "uv":
            print(_msg("  尝试 pip 回退...", "  Trying pip fallback..."))
        try:
            result = subprocess.run(pip_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if result.returncode == 0:
                print(_msg("  ✓ 包更新完成 (pip)", "  ✓ Package updated (pip)"))
                updated = True
            else:
                stderr = result.stderr.strip()
                if stderr:
                    print(f"  pip error: {stderr}")
        except FileNotFoundError:
            print(_msg("  错误: 未找到 pip。", "  Error: pip not found."))

    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        print(_msg("  ✗ 更新失败。请手动执行:", "  ✗ Update failed. Try manually:"))
        print(f"    pip install --upgrade {pip_url}")
        return

    # ── Phase 2: Sync installed targets ──
    targets = _detect_installed_targets()
    if targets:
        _header(_msg(f"同步已安装的 CLI 工具（共 {len(targets)} 个）",
                     f"Syncing Installed CLI Targets ({len(targets)} target(s))"))
        for i, t in enumerate(targets, 1):
            print(_msg(f"  [{i}/{len(targets)}] {t}", f"  [{i}/{len(targets)}] {t}"))
            install(t)
            print()

        _header(_msg("更新完成", "Update Complete"))
        for t in targets:
            print(f"  ✓ {t:10} {_msg('已同步', 'synced')}")
        print()
    else:
        print()
        print(_msg("  未检测到已安装的 CLI 目标。执行 'helloagents' 选择安装。",
                   "  No installed CLI targets detected. Run 'helloagents' to install."))


def status() -> None:
    """Show installation status for all CLIs."""
    _header(_msg("安装状态", "Installation Status"))

    try:
        local_ver = get_version("helloagents")
        branch = _detect_channel()
        print(_msg(f"  包版本: {local_ver} ({branch})", f"  Package version: {local_ver} ({branch})"))
    except Exception:
        print(_msg("  包版本: 未知", "  Package version: unknown"))

    print()

    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]

        cli_exists = cli_dir.exists()
        plugin_exists = plugin_dir.exists()
        rules_exists = rules_file.exists()

        if not cli_exists:
            mark = "·"
            status_str = _msg("未检测到该工具", "tool not found")
        elif plugin_exists and rules_exists:
            mark = "✓"
            status_str = _msg("已安装 HelloAGENTS", "HelloAGENTS installed")
        elif plugin_exists or rules_exists:
            mark = "!"
            status_str = _msg("安装不完整", "partial install")
        else:
            mark = "·"
            status_str = _msg("未安装 HelloAGENTS", "HelloAGENTS not installed")

        print(f"  {mark} {name:10} {status_str}")

    print()


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
        config = CLI_TARGETS[name]
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        removed = 0

        if not plugin_dir.exists():
            continue

        for cache_dir in list(plugin_dir.rglob("__pycache__")):
            if cache_dir.is_dir():
                shutil.rmtree(cache_dir)
                removed += 1

        for pyc_file in list(plugin_dir.rglob("*.pyc")):
            if pyc_file.is_file():
                pyc_file.unlink()
                removed += 1

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


def _interactive_main() -> None:
    """Show main interactive menu for all operations."""
    _divider()
    try:
        ver = get_version("helloagents")
        print(f"  HelloAGENTS v{ver}")
    except Exception:
        print("  HelloAGENTS")
    _divider()

    actions = [
        (_msg("安装到 CLI 工具", "Install to CLI targets"), "install"),
        (_msg("卸载已安装的 CLI 工具", "Uninstall from CLI targets"), "uninstall"),
        (_msg("重新安装（覆盖已有目标）", "Reinstall (overwrite existing targets)"), "reinstall"),
        (_msg("更新 HelloAGENTS 包", "Update HelloAGENTS package"), "update"),
        None,  # separator
        (_msg("查看安装状态", "Show installation status"), "status"),
        (_msg("清理缓存", "Clean caches"), "clean"),
    ]

    print()
    print(_msg("  请选择操作:", "  Select an action:"))
    print()
    num = 1
    for item in actions:
        if item is None:
            print("  " + "─" * 30)
            continue
        label, _ = item
        print(f"  [{num}] {label}")
        num += 1

    print()
    prompt = _msg("  请输入编号: ", "  Enter number: ")

    try:
        choice = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if not choice:
        return

    # Build flat action list (without separators) for index mapping
    flat_actions = [a for a in actions if a is not None]

    try:
        idx = int(choice)
        if idx < 1 or idx > len(flat_actions):
            print(_msg("  无效编号。", "  Invalid number."))
            return
    except ValueError:
        print(_msg("  无效输入。", "  Invalid input."))
        return

    action = flat_actions[idx - 1][1]

    if action == "install":
        _interactive_install()
    elif action == "update":
        update()
    elif action == "uninstall":
        _interactive_uninstall()
    elif action == "reinstall":
        _interactive_reinstall()
    elif action == "status":
        status()
    elif action == "clean":
        clean()


def _interactive_reinstall() -> bool:
    """Reinstall HelloAGENTS to selected CLI targets (overwrite)."""
    installed = _detect_installed_targets()
    if not installed:
        print(_msg("  未检测到已安装的 CLI 目标，请先使用安装功能。",
                    "  No installed CLI targets detected. Please install first."))
        return True

    # ── Phase 1: Select targets ──
    _header(_msg("选择要重装的目标（将覆盖）", "Select Targets to Reinstall (overwrite)"))

    for i, name in enumerate(installed, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        print(f"  [{i}] {name:10} {dir_path}")

    print()
    prompt = _msg(
        "  请输入要重装的编号，可多选（如 1 3）或 all 全选，直接回车跳过: ",
        "  Enter numbers to reinstall, multi-select supported (e.g. 1 3) or 'all', press Enter to skip: ",
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
                    print(_msg(f"  忽略无效编号: {n}", f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}", f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    # ── Phase 2: Execute reinstall ──
    _header(_msg(f"开始重装（共 {len(selected)} 个目标）",
                 f"Reinstalling ({len(selected)} target(s))"))

    results = {}
    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}", f"  [{i}/{len(selected)}] {t}"))
        if install(t):
            results[t] = True
        else:
            results[t] = False
        print()

    # ── Phase 3: Summary ──
    _header(_msg("重装结果", "Reinstall Summary"))
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
    print(_msg(f"  共 {succeeded} 个目标重装成功。",
               f"  All {succeeded} target(s) reinstalled successfully."))
    return True


def print_usage() -> None:
    """Print usage information."""
    print("HelloAGENTS - Multi-CLI Agent Framework")
    print()
    print(_msg("用法:", "Usage:"))
    print(_msg("  helloagents install <target>    安装到指定 CLI",
               "  helloagents install <target>    Install to a specific CLI"))
    print(_msg("  helloagents install --all       安装到所有已检测的 CLI",
               "  helloagents install --all       Install to all detected CLIs"))
    print(_msg("  helloagents uninstall <target>  从指定 CLI 卸载",
               "  helloagents uninstall <target>  Uninstall from a specific CLI"))
    print(_msg("  helloagents uninstall --all     从所有已安装的 CLI 卸载",
               "  helloagents uninstall --all     Uninstall from all installed CLIs"))
    print(_msg("  helloagents update              更新到最新版本",
               "  helloagents update              Update to latest version"))
    print(_msg("  helloagents update <branch>     切换到指定分支",
               "  helloagents update <branch>     Switch to a specific branch"))
    print(_msg("  helloagents clean               清理已安装目标的缓存",
               "  helloagents clean               Clean caches from installed targets"))
    print(_msg("  helloagents status              查看安装状态",
               "  helloagents status              Show installation status"))
    print(_msg("  helloagents version             查看版本",
               "  helloagents version             Show version"))
    print()
    print(_msg("目标:", "Targets:"))
    for name in CLI_TARGETS:
        print(f"  {name}")
    print()


def main() -> None:
    """Main entry point."""
    # Ensure stdout/stderr can handle all characters without crashing
    # (Windows GBK consoles may fail on certain Unicode chars)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(errors="replace")
            except Exception:
                pass

    cmd = sys.argv[1] if len(sys.argv) >= 2 else None

    if cmd != "update":
        check_update()

    if not cmd:
        _interactive_main()
        sys.exit(0)

    if cmd == "install":
        if len(sys.argv) < 3:
            if not _interactive_install():
                sys.exit(1)
        else:
            target = sys.argv[2]
            if target == "--all":
                if not install_all():
                    sys.exit(1)
            else:
                if not install(target):
                    sys.exit(1)
    elif cmd == "uninstall":
        if len(sys.argv) < 3:
            if not _interactive_uninstall():
                sys.exit(1)
        else:
            target = sys.argv[2]
            if target == "--all":
                uninstall_all()
            else:
                if not uninstall(target):
                    sys.exit(1)
    elif cmd == "update":
        switch = sys.argv[2] if len(sys.argv) >= 3 else None
        update(switch)
    elif cmd == "clean":
        clean()
    elif cmd == "status":
        status()
    elif cmd == "version":
        try:
            ver = get_version("helloagents")
            print(f"HelloAGENTS v{ver}")
        except Exception:
            print("HelloAGENTS (version unknown)")
    else:
        print(_msg(f"未知命令: {cmd}", f"Unknown command: {cmd}"))
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()

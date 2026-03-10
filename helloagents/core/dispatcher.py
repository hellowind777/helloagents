"""HelloAGENTS Dispatcher - Command routing, interactive menus, status/clean.

Consolidated from: dispatcher.py, interactive.py, status.py.
All CLI routing logic lives here; cli.py is a thin stable shim.
"""

import json
import os
import re
import sys
from importlib.metadata import version as get_version
from pathlib import Path

from .._common import (
    _msg, _divider, _header,
    CLI_TARGETS, HELLOAGENTS_HOME,
    _detect_installed_targets, _detect_install_method,
    detect_installed_clis, is_helloagents_hook as _is_helloagents_hook,
)


# ═══════════════════════════════════════════════════════════════════════════
# Interactive install/uninstall (from interactive.py)
# ═══════════════════════════════════════════════════════════════════════════

def _parse_multi_choice(choice: str, max_val: int) -> list[int]:
    """Parse user multi-select input like '1 3 5' or '1,3,5'."""
    nums = choice.replace(",", " ").replace("、", " ").replace("，", " ").split()
    result, seen = [], set()
    for n in nums:
        try:
            idx = int(n)
            if 1 <= idx <= max_val and idx not in seen:
                seen.add(idx)
                result.append(idx)
            else:
                print(_msg(f"  忽略无效编号: {n}", f"  Ignoring invalid number: {n}"))
        except ValueError:
            print(_msg(f"  忽略无效输入: {n}", f"  Ignoring invalid input: {n}"))
    return result


def _interactive_install() -> bool:
    """Show interactive menu for selecting CLI targets to install."""
    from .installer import install
    targets = list(CLI_TARGETS.keys())
    detected = detect_installed_clis()
    installed = _detect_installed_targets()

    _header(_msg("步骤 1/3: 选择目标", "Step 1/3: Select Targets"))
    for i, name in enumerate(targets, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        tag = ""
        if name in installed:
            tag = _msg("[已安装 HelloAGENTS]", "[HelloAGENTS installed]")
        elif name in detected:
            tag = _msg("[已检测到该工具]", "[tool found]")
        print(f"  [{i}] {name:10} {dir_path:20} {tag}")

    print()
    prompt = _msg("  请输入编号，可多选或 all 全选，直接回车跳过: ",
                  "  Enter numbers, multi-select or 'all', Enter to skip: ")

    selected = []
    while not selected:
        try:
            choice = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return True
        if not choice:
            return True
        if choice.lower() == "all":
            selected = targets
        else:
            indices = _parse_multi_choice(choice, len(targets))
            selected = [targets[i - 1] for i in indices]
        if not selected:
            print(_msg("  未选择有效目标，请重新输入。",
                       "  No valid targets, try again."))

    _header(_msg(f"步骤 2/3: 执行安装（{len(selected)} 个）",
                 f"Step 2/3: Installing ({len(selected)})"))
    results = {}
    for i, t in enumerate(selected, 1):
        print(f"  [{i}/{len(selected)}] {t}")
        results[t] = install(t)
        print()

    _header(_msg("步骤 3/3: 安装结果", "Step 3/3: Summary"))
    for t, ok in results.items():
        mark = "✓" if ok else "✗"
        st = _msg("成功", "OK") if ok else _msg("失败", "FAILED")
        print(f"  {mark} {t:10} {st}")

    succeeded = sum(1 for v in results.values() if v)
    failed_count = len(results) - succeeded
    print()
    if failed_count:
        print(_msg(f"  {succeeded} 成功，{failed_count} 失败。",
                   f"  {succeeded} succeeded, {failed_count} failed."))
        return False
    print(_msg(f"  {succeeded} 个安装成功。请重启终端。",
               f"  All {succeeded} installed. Restart terminal."))
    return True


def _interactive_uninstall() -> bool:
    """Show interactive menu for uninstalling CLI targets."""
    from .uninstaller import uninstall, _self_uninstall
    installed = _detect_installed_targets()

    if not installed:
        print(_msg("  未检测到任何 CLI 安装。", "  No CLI installations detected."))
        print()
        print(_msg("  [1] 彻底移除 helloagents 包", "  [1] Remove helloagents package"))
        print(_msg("  [2] 退出", "  [2] Exit"))
        try:
            choice = input(_msg("  请输入编号: ", "  Enter number: ")).strip()
        except (EOFError, KeyboardInterrupt):
            choice = ""
        if choice == "1":
            _self_uninstall()
        return True

    _header(_msg("步骤 1/3: 选择卸载目标", "Step 1/3: Select Targets"))
    for i, name in enumerate(installed, 1):
        print(f"  [{i}] {name:10} ~/{CLI_TARGETS[name]['dir']}/")

    print()
    prompt = _msg("  请输入编号或 all 全选，回车跳过: ",
                  "  Enter numbers or 'all', Enter to skip: ")
    selected = []
    while not selected:
        try:
            choice = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            return True
        if not choice:
            return True
        if choice.lower() == "all":
            selected = installed
        else:
            indices = _parse_multi_choice(choice, len(installed))
            selected = [installed[i - 1] for i in indices]
        if not selected:
            print(_msg("  请重新输入。", "  Try again."))

    _header(_msg(f"步骤 2/3: 执行卸载（{len(selected)} 个）",
                 f"Step 2/3: Uninstalling ({len(selected)})"))
    results = {}
    for i, t in enumerate(selected, 1):
        print(f"  [{i}/{len(selected)}] {t}")
        results[t] = uninstall(t, show_package_hint=False)
        print()

    _header(_msg("步骤 3/3: 卸载结果", "Step 3/3: Summary"))
    for t, ok in results.items():
        mark = "✓" if ok else "✗"
        st = _msg("已卸载", "removed") if ok else _msg("失败", "FAILED")
        print(f"  {mark} {t:10} {st}")

    remaining = _detect_installed_targets()
    if not remaining:
        _header(_msg("附加: 移除包", "Extra: Remove Package"))
        print(_msg("  [1] 彻底移除", "  [1] Remove completely"))
        print(_msg("  [2] 保留", "  [2] Keep"))
        try:
            c = input(_msg("  请输入编号: ", "  Enter number: ")).strip()
        except (EOFError, KeyboardInterrupt):
            c = ""
        if c == "1":
            _self_uninstall()
        else:
            method = _detect_install_method()
            cmd = "uv tool uninstall helloagents" if method == "uv" else "pip uninstall helloagents"
            print(_msg(f"  如需稍后移除: {cmd}", f"  To remove later: {cmd}"))
    return True


# ═══════════════════════════════════════════════════════════════════════════
# Status & Clean (from status.py)
# ═══════════════════════════════════════════════════════════════════════════

def status() -> None:
    """Show installation status for all CLIs."""
    from .cli_adapters import get_helloagents_permissions
    from .win_helpers import win_safe_rmtree

    _header(_msg("安装状态", "Installation Status"))

    try:
        local_ver = get_version("helloagents")
        from .version_check import _detect_channel
        branch = _detect_channel()
        print(_msg(f"  包版本: {local_ver} ({branch})",
                   f"  Package version: {local_ver} ({branch})"))
    except Exception:
        print(_msg("  包版本: 未知", "  Package version: unknown"))

    # Config status
    for label, path in [
        (_msg("全局配置", "Global config"), Path.home() / ".helloagents" / "config.json"),
        (_msg("项目配置", "Project config"), Path.cwd() / ".helloagents" / "config.json"),
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
    print()

    _home_exists = HELLOAGENTS_HOME.exists()
    _skills_exist = (HELLOAGENTS_HOME / "skills").is_dir()

    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        rules_file = cli_dir / config["rules_file"]
        skills_link = cli_dir / "skills" / "helloagents"

        cli_exists = cli_dir.exists()
        has_home = _home_exists and _skills_exist
        rules_exists = rules_file.exists() and rules_file.stat().st_size > 0
        link_exists = skills_link.exists() or skills_link.is_symlink()

        if not cli_exists:
            mark, status_str = "·", _msg("未检测到", "not found")
        elif has_home and rules_exists and link_exists:
            mark, status_str = "✓", _msg("已安装", "installed")
        elif has_home and rules_exists:
            mark, status_str = "!", _msg("缺少 skills 链接", "skills link missing")
        elif rules_exists:
            mark, status_str = "!", _msg("安装不完整", "partial")
        else:
            mark, status_str = "·", _msg("未安装", "not installed")

        print(f"  {mark} {name:10} {status_str}")

        if has_home and rules_exists:
            if name == "claude":
                _show_claude_details(cli_dir, get_helloagents_permissions)
            elif name == "codex":
                _show_codex_details(cli_dir)
    print()


def _show_claude_details(cli_dir: Path, get_perms_fn) -> None:
    try:
        sp = cli_dir / "settings.json"
        if sp.exists():
            st = json.loads(sp.read_text(encoding="utf-8"))
            hooks = st.get("hooks", {})
            ha_count = sum(1 for hl in hooks.values() if isinstance(hl, list)
                           for mg in hl if _is_helloagents_hook(mg))
            if ha_count > 0:
                print(f"    hooks: {ha_count} HelloAGENTS hook(s) ✓")
            # Permissions
            allow = st.get("permissions", {}).get("allow", [])
            our_perms = get_perms_fn(cli_dir)
            found = sum(1 for p in our_perms if p in allow)
            if found == len(our_perms):
                print(f"    permissions: {found} rule(s) ✓")
    except Exception:
        pass


def _show_codex_details(cli_dir: Path) -> None:
    try:
        ct_path = cli_dir / "config.toml"
        if not ct_path.exists():
            return
        ct = ct_path.read_text(encoding="utf-8")
        nm = re.search(r'^notify\s*=\s*(?:\[([^\]]*)\]|"([^"]*)")', ct, re.MULTILINE)
        if nm:
            val = nm.group(1) or nm.group(2) or ""
            if "helloagents" in val:
                print("    notify: helloagents ✓")
    except Exception:
        pass


def clean() -> None:
    """Clean caches from installed CLI targets."""
    from .win_helpers import win_safe_rmtree

    _header(_msg("清理缓存", "Clean Caches"))
    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  无需清理。", "  Nothing to clean."))
        return

    total = 0
    scripts_dir = HELLOAGENTS_HOME / "scripts"
    if scripts_dir.exists():
        removed = 0
        for cache_dir in list(scripts_dir.rglob("__pycache__")):
            if cache_dir.is_dir() and win_safe_rmtree(cache_dir):
                removed += 1
        for pyc in list(scripts_dir.rglob("*.pyc")):
            if pyc.is_file():
                try:
                    pyc.unlink()
                    removed += 1
                except Exception:
                    pass
        if removed:
            print(f"  ✓ {'~/.helloagents':10} {_msg(f'{removed} 个缓存项', f'{removed} cache item(s)')}")
            total += removed
        else:
            print(f"  · {'~/.helloagents':10} {_msg('无缓存', 'no cache')}")

    print()
    if total:
        print(_msg(f"  共清理 {total} 项。", f"  Total: {total} item(s) removed."))
    else:
        print(_msg("  已是干净状态。", "  Already clean."))


# ═══════════════════════════════════════════════════════════════════════════
# Interactive main menu
# ═══════════════════════════════════════════════════════════════════════════

def _interactive_main() -> None:
    """Show main interactive menu."""
    from .updater import update

    _divider()
    try:
        print(f"  HelloAGENTS v{get_version('helloagents')}")
    except Exception:
        print("  HelloAGENTS")
    _divider()

    actions = [
        (_msg("安装到 CLI 工具", "Install"), "install"),
        (_msg("卸载", "Uninstall"), "uninstall"),
        (_msg("更新", "Update"), "update"),
        None,
        (_msg("查看状态", "Status"), "status"),
        (_msg("清理缓存", "Clean"), "clean"),
    ]
    flat = [a for a in actions if a is not None]

    while True:
        print()
        print(_msg("  请选择操作:", "  Select:"))
        print()
        num = 1
        for item in actions:
            if item is None:
                print("  " + "─" * 30)
                continue
            print(f"  [{num}] {item[0]}")
            num += 1
        print(_msg("\n  [0] 退出", "\n  [0] Exit"))
        print()

        try:
            choice = input(_msg("  请输入编号: ", "  Enter number: ")).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not choice or choice == "0":
            return

        try:
            idx = int(choice)
            if idx < 1 or idx > len(flat):
                continue
        except ValueError:
            continue

        action = flat[idx - 1][1]
        if action == "install":
            _interactive_install()
        elif action == "update":
            update()
            return
        elif action == "uninstall":
            _interactive_uninstall()
        elif action == "status":
            status()
        elif action == "clean":
            clean()

        print()
        try:
            p = input(_msg("Enter 返回主菜单，0 退出: ",
                           "Enter to return, 0 to exit: ")).strip()
            if p == "0":
                return
        except (EOFError, KeyboardInterrupt):
            return
        _divider()


# ═══════════════════════════════════════════════════════════════════════════
# Usage & Dispatch
# ═══════════════════════════════════════════════════════════════════════════

def print_usage() -> None:
    print("HelloAGENTS - Multi-CLI Agent Framework")
    print()
    print(_msg("用法:", "Usage:"))
    for line in [
        ("install <target>", "安装到指定 CLI", "Install to a CLI"),
        ("install --all", "安装到所有 CLI", "Install to all CLIs"),
        ("uninstall <target>", "从指定 CLI 卸载", "Uninstall from a CLI"),
        ("uninstall --all", "卸载所有", "Uninstall all"),
        ("uninstall --all --purge", "卸载并移除包", "Uninstall all + remove package"),
        ("update", "更新到最新版", "Update to latest"),
        ("update <branch>", "切换分支", "Switch branch"),
        ("clean", "清理缓存", "Clean caches"),
        ("status", "查看状态", "Show status"),
        ("version", "查看版本", "Show version"),
    ]:
        print(f"  helloagents {line[0]:30} {_msg(line[1], line[2])}")
    print()


def dispatch(args: list[str]) -> None:
    """Route CLI arguments to the appropriate command handler."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(errors="replace")
            except Exception:
                pass

    cmd = args[0] if args else None

    if cmd in ("--help", "-h", "help"):
        print_usage()
        sys.exit(0)

    if cmd == "--check-update":
        from .version_check import check_update
        silent = "--silent" in args[1:]
        check_update(cache_ttl_hours=24, show_version=not silent)
        sys.exit(0)

    if cmd and cmd != "update" and not os.environ.get("HELLOAGENTS_NO_UPDATE_CHECK"):
        from .version_check import check_update
        force = cmd == "version" and "--force" in args[1:]
        cache_ttl = None
        if cmd == "version" and "--cache-ttl" in args[1:]:
            try:
                idx = args.index("--cache-ttl")
                cache_ttl = int(args[idx + 1])
            except (ValueError, IndexError):
                pass
        check_update(force=force, cache_ttl_hours=cache_ttl,
                     show_version=(cmd == "version"))

    if not cmd:
        _interactive_main()
        sys.exit(0)

    if cmd == "install":
        from .installer import install, install_all
        if len(args) < 2:
            if not _interactive_install():
                sys.exit(1)
        else:
            target = args[1]
            if target == "--all":
                if not install_all():
                    sys.exit(1)
            elif not install(target):
                sys.exit(1)
    elif cmd == "uninstall":
        from .uninstaller import uninstall, uninstall_all, _self_uninstall
        if len(args) < 2:
            if not _interactive_uninstall():
                sys.exit(1)
        else:
            purge = "--purge" in args[1:]
            rest = [a for a in args[1:] if a != "--purge"]
            target = rest[0] if rest else None
            if target == "--all" or not target:
                uninstall_all(purge=purge)
            else:
                if not uninstall(target):
                    sys.exit(1)
                if purge and not _detect_installed_targets():
                    _self_uninstall()
    elif cmd == "update":
        from .updater import update
        update(args[1] if len(args) >= 2 else None)
    elif cmd == "_post_update":
        from .updater import _post_update_sync
        _post_update_sync(
            args[1] if len(args) >= 2 else None,
            int(args[2]) if len(args) >= 3 else None)
    elif cmd == "clean":
        clean()
    elif cmd == "status":
        status()
    elif cmd == "version":
        pass  # handled by check_update above
    else:
        print(_msg(f"未知命令: {cmd}", f"Unknown command: {cmd}"))
        print_usage()
        sys.exit(1)

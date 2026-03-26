"""HelloAGENTS Dispatcher - Command routing and interactive menu.

All CLI routing logic lives here; cli.py is a thin stable shim that
delegates to ``dispatch()``.  This separation ensures that even if this
file breaks, ``helloagents install`` / ``helloagents update`` still work
via the shim's stdlib-only fallback.
"""

import os
import sys

from .._common import (
    _msg, _divider, _header, get_version,
    CLI_TARGETS, _detect_installed_targets,
)


# ---------------------------------------------------------------------------
# Interactive main menu
# ---------------------------------------------------------------------------

def _interactive_main() -> None:
    """Show main interactive menu for all operations (loops until exit)."""
    from .updater import update
    from .status import status, clean
    from .interactive import _interactive_install, _interactive_uninstall

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
        (_msg("更新 HelloAGENTS 包", "Update HelloAGENTS package"), "update"),
        None,  # separator
        (_msg("查看安装状态", "Show installation status"), "status"),
        (_msg("清理缓存", "Clean caches"), "clean"),
    ]
    flat_actions = [a for a in actions if a is not None]

    while True:
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
        print(_msg("  [0] 退出", "  [0] Exit"))

        print()
        prompt = _msg("  请输入编号: ", "  Enter number: ")

        try:
            choice = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return

        if not choice or choice == "0":
            return

        try:
            idx = int(choice)
            if idx < 1 or idx > len(flat_actions):
                print(_msg("  无效编号。", "  Invalid number."))
                continue
        except ValueError:
            print(_msg("  无效输入。", "  Invalid input."))
            continue

        action = flat_actions[idx - 1][1]

        if action == "install":
            _interactive_install()
        elif action == "update":
            update()
            return  # package changed, exit to avoid stale code
        elif action == "uninstall":
            _interactive_uninstall()
        elif action == "status":
            status()
        elif action == "clean":
            clean()

        # 操作完成后暂停（update 已经 return，不会到这里）
        print()
        try:
            pause = input(_msg("按 Enter 返回主菜单，输入 0 退出: ",
                               "Press Enter to return, 0 to exit: ")).strip()
            if pause == "0":
                return
        except (EOFError, KeyboardInterrupt):
            print()
            return
        _divider()


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

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
    print(_msg("  helloagents uninstall --all --purge  卸载所有 CLI 并移除包本身",
               "  helloagents uninstall --all --purge  Uninstall all CLIs and remove package"))
    print(_msg("  helloagents update              更新到最新版本",
               "  helloagents update              Update to latest version"))
    print(_msg("  helloagents update <branch>     切换到指定分支",
               "  helloagents update <branch>     Switch to a specific branch"))
    print(_msg("  helloagents clean               清理已安装目标的缓存",
               "  helloagents clean               Clean caches from installed targets"))
    print(_msg("  helloagents status              查看安装状态",
               "  helloagents status              Show installation status"))
    print(_msg("  helloagents version             查看版本（--force 跳过缓存，--cache-ttl N 设置缓存小时数）",
               "  helloagents version             Show version (--force skip cache, --cache-ttl N set cache hours)"))
    print()
    print(_msg("目标:", "Targets:"))
    for name in CLI_TARGETS:
        print(f"  {name}")
    print()


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def dispatch(args: list[str]) -> None:
    """Route CLI arguments to the appropriate command handler.

    Called by cli.py:main().  Sub-module imports are deferred to each command
    branch so that a broken sub-module only affects the command that uses it,
    not the entire CLI entry point.
    """
    # Ensure stdout/stderr can handle all characters
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

    # Hook-triggered update check (e.g. Codex CLI notify)
    if cmd == "--check-update":
        from .version_check import check_update
        silent = "--silent" in args[1:]
        check_update(cache_ttl_hours=24, show_version=not silent)
        sys.exit(0)

    if cmd and cmd != "update" and not os.environ.get("HELLOAGENTS_NO_UPDATE_CHECK"):
        from .version_check import check_update
        force = cmd == "version" and "--force" in args[1:]
        cache_ttl = 72  # default TTL for regular commands (hours)
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
        from .interactive import _interactive_install
        if len(args) < 2:
            if not _interactive_install():
                sys.exit(1)
        else:
            target = args[1]
            if target == "--all":
                if not install_all():
                    sys.exit(1)
            else:
                if not install(target):
                    sys.exit(1)
    elif cmd == "uninstall":
        from .uninstaller import uninstall, uninstall_all, _self_uninstall
        from .interactive import _interactive_uninstall
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
                if purge:
                    remaining = _detect_installed_targets()
                    if not remaining:
                        _self_uninstall()
    elif cmd == "update":
        from .updater import update
        switch = args[1] if len(args) >= 2 else None
        update(switch)
    elif cmd == "_post_update":
        from .updater import _post_update_sync
        branch = args[1] if len(args) >= 2 else None
        total = int(args[2]) if len(args) >= 3 else None
        _post_update_sync(branch, total)
    elif cmd == "clean":
        from .status import clean
        clean()
    elif cmd == "status":
        from .status import status
        status()
    elif cmd == "version":
        pass  # already handled by check_update(show_version=True)
    else:
        print(_msg(f"未知命令: {cmd}", f"Unknown command: {cmd}"))
        print_usage()
        sys.exit(1)

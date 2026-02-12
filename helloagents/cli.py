"""HelloAGENTS CLI - Multi-CLI installer and version checker.

Supports installation to:
- Claude Code (~/.claude/)
- Codex CLI (~/.codex/)
- OpenCode (~/.opencode/)
- Gemini CLI (~/.gemini/)
- Qwen CLI (~/.qwen/)
- Grok CLI (~/.grok/)
"""

import locale
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from importlib.metadata import version as get_version
from importlib.resources import files

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


# ---------------------------------------------------------------------------
# Locale & messaging
# ---------------------------------------------------------------------------

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
    if sys.platform == "win32":
        try:
            import ctypes
            lcid = ctypes.windll.kernel32.GetUserDefaultUILanguage()
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


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def is_helloagents_file(file_path: Path) -> bool:
    """Check if a file was created by HelloAGENTS."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")[:1024]
        return HELLOAGENTS_MARKER in content
    except Exception:
        return False


def backup_user_file(file_path: Path) -> Path:
    """Backup a non-HelloAGENTS file with timestamp suffix."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_name = f"{file_path.stem}_{timestamp}_bak{file_path.suffix}"
    backup_path = file_path.parent / backup_name
    shutil.copy2(file_path, backup_path)
    return backup_path


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def get_package_root() -> Path:
    """Get the root directory of the installed package."""
    return Path(str(files("helloagents"))).parent


def get_agents_md_path() -> Path:
    """Get the path to AGENTS.md source file."""
    return get_package_root() / "AGENTS.md"


def get_helloagents_module_path() -> Path:
    """Get the path to the helloagents module directory."""
    return Path(str(files("helloagents")))


# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

def detect_installed_clis() -> list[str]:
    """Detect which CLI config directories exist."""
    installed = []
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        if cli_dir.exists():
            installed.append(name)
    return installed


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


def _detect_install_method() -> str:
    """Detect whether helloagents was installed via uv or pip."""
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


# ---------------------------------------------------------------------------
# Interactive main menu
# ---------------------------------------------------------------------------

def _interactive_main() -> None:
    """Show main interactive menu for all operations (loops until exit)."""
    from .updater import update, status, clean
    from .installer import _interactive_install, _interactive_uninstall

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
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Main entry point."""
    from .updater import check_update, update, status, clean
    from .installer import (
        install, install_all, _interactive_install,
        uninstall, uninstall_all, _interactive_uninstall,
        _self_uninstall,
    )

    # Ensure stdout/stderr can handle all characters
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(errors="replace")
            except Exception:
                pass

    cmd = sys.argv[1] if len(sys.argv) >= 2 else None

    if cmd in ("--help", "-h", "help"):
        print_usage()
        sys.exit(0)

    has_update = False
    if cmd != "update":
        force = cmd == "version" and "--force" in sys.argv[2:]
        cache_ttl = None
        if cmd == "version" and "--cache-ttl" in sys.argv[2:]:
            try:
                idx = sys.argv.index("--cache-ttl")
                cache_ttl = int(sys.argv[idx + 1])
            except (ValueError, IndexError):
                pass
        has_update = check_update(force=force, cache_ttl_hours=cache_ttl,
                                  show_version=(cmd == "version"))

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
            purge = "--purge" in sys.argv[2:]
            args = [a for a in sys.argv[2:] if a != "--purge"]
            target = args[0] if args else None
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
        switch = sys.argv[2] if len(sys.argv) >= 3 else None
        update(switch)
    elif cmd == "clean":
        clean()
    elif cmd == "status":
        status()
    elif cmd == "version":
        pass  # already handled by check_update(show_version=True)
    else:
        print(_msg(f"未知命令: {cmd}", f"Unknown command: {cmd}"))
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()

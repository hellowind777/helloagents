"""HelloAGENTS CLI — stable entry point.

DO NOT add imports beyond stdlib.  This file is the persistence contract:
as long as it can be imported, ``helloagents install`` / ``helloagents update``
always work — even when every other module in the package is broken.
"""

import locale
import os
import sys

_REPO = "https://github.com/hellowind777/helloagents"


# ---------------------------------------------------------------------------
# Locale (stdlib-only, mirrors _common._detect_locale)
# ---------------------------------------------------------------------------

def _detect_locale() -> str:
    """Detect system locale. Returns 'zh' for Chinese, 'en' otherwise."""
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


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Main entry point (referenced by pyproject.toml ``[project.scripts]``)."""
    args = sys.argv[1:]
    cmd = args[0] if args else None

    try:
        from helloagents.core.dispatcher import dispatch
        dispatch(args)
    except KeyboardInterrupt:
        print()
    except Exception as e:
        # Dispatcher broken — recovery commands still work
        if cmd in ("install", "update"):
            _reinstall(args[1:])
        else:
            print(_msg(f"\nHelloAGENTS 错误: {e}",
                       f"\nHelloAGENTS error: {e}"))
            print(_msg("请执行 'helloagents update' 重新安装并修复。\n",
                       "Run 'helloagents update' to reinstall and fix.\n"))
            sys.exit(1)


def _reinstall(extra_args: list[str] | None = None) -> None:
    """Reinstall from GitHub using only stdlib — works even when package is broken."""
    import subprocess
    import shutil

    # Extract branch from extra args (e.g. helloagents update --branch beta)
    branch = "main"
    if extra_args:
        for i, a in enumerate(extra_args):
            if a in ("--branch", "-b") and i + 1 < len(extra_args):
                branch = extra_args[i + 1]
                break
            # helloagents update <branch> (positional)
            if not a.startswith("-") and i == 0:
                branch = a

    print(_msg(f"正在从 {_REPO}@{branch} 重新安装 HelloAGENTS ...",
               f"Reinstalling HelloAGENTS from {_REPO}@{branch} ..."))

    if shutil.which("uv"):
        r = subprocess.run(
            ["uv", "tool", "install", "--from",
             f"git+{_REPO}@{branch}", "helloagents", "--force"])
        if r.returncode == 0:
            print(_msg("重新安装成功。请重试您的命令。",
                       "Reinstall successful. Please retry your command."))
            return

    pip_url = f"git+{_REPO}.git@{branch}"
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install",
         "--upgrade", "--force-reinstall", "--no-cache-dir", pip_url])
    if r.returncode == 0:
        print(_msg("重新安装成功。请重试您的命令。",
                   "Reinstall successful. Please retry your command."))
    else:
        print(_msg(f"重新安装失败。请手动执行:\n  pip install --upgrade --force-reinstall {pip_url}",
                   f"Reinstall failed. Try manually:\n  pip install --upgrade --force-reinstall {pip_url}"))


if __name__ == "__main__":
    main()

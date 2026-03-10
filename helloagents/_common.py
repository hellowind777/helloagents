"""HelloAGENTS Common - Shared constants, utilities, and detection helpers.

Single source of truth for all shared definitions. Both cli.py and core/*
import from here — never from each other for shared symbols.
"""

import locale
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from importlib.metadata import version as get_version  # noqa: F401
from importlib.resources import files


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_URL = "https://github.com/hellowind777/helloagents"
REPO_API_LATEST = "https://api.github.com/repos/hellowind777/helloagents/releases/latest"

CLI_TARGETS = {
    "codex": {"dir": ".codex", "rules_file": "AGENTS.md"},
    "claude": {"dir": ".claude", "rules_file": "CLAUDE.md"},
    "gemini": {"dir": ".gemini", "rules_file": "GEMINI.md"},
    "qwen": {"dir": ".qwen", "rules_file": "QWEN.md"},
    "grok": {"dir": ".grok", "rules_file": "GROK.md", "status": "experimental"},
    "opencode": {"dir": ".config/opencode", "rules_file": "AGENTS.md"},
}

PLUGIN_DIR_NAME = "helloagents"  # Legacy: kept for v2→v3 uninstaller compat
HELLOAGENTS_HOME = Path.home() / ".helloagents"
AGENT_PREFIX = "ha-"
HOOKS_FINGERPRINT = "HelloAGENTS"
CODEX_NOTIFY_SCRIPT = "codex_notify.py"
GEMINI_HOOKS_JSON = "gemini_hooks.json"
GROK_HOOKS_JSON = "grok_hooks.json"
HELLOAGENTS_MARKER = "HELLOAGENTS_ROUTER:"
HELLOAGENTS_RULE_MARKER = "HELLOAGENTS_RULE"


# ---------------------------------------------------------------------------
# Locale & messaging
# ---------------------------------------------------------------------------

def _detect_locale() -> str:
    for var in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        if os.environ.get(var, "").lower().startswith("zh"):
            return "zh"
    try:
        if (locale.getlocale()[0] or "").lower().startswith("zh"):
            return "zh"
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            import ctypes
            if (ctypes.windll.kernel32.GetUserDefaultUILanguage() & 0xFF) == 0x04:
                return "zh"
        except Exception:
            pass
    return "en"

_LANG = _detect_locale()

def _msg(zh: str, en: str) -> str:
    return zh if _LANG == "zh" else en

def _divider(width: int = 40) -> None:
    print("─" * width)

def _header(title: str) -> None:
    print(f"\n── {title} ──\n")


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def is_helloagents_file(file_path: Path) -> bool:
    try:
        return HELLOAGENTS_MARKER in file_path.read_text(encoding="utf-8", errors="ignore")[:1024]
    except Exception:
        return False

def is_helloagents_rule(file_path: Path) -> bool:
    try:
        return HELLOAGENTS_RULE_MARKER in file_path.read_text(encoding="utf-8", errors="ignore")[:256]
    except Exception:
        return False

def backup_user_file(file_path: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    backup = file_path.parent / f"{file_path.stem}_{ts}_bak{file_path.suffix}"
    shutil.copy2(file_path, backup)
    return backup

def clean_skills_dir(dest_dir: Path) -> list[str]:
    from .core.win_helpers import win_safe_rmtree
    removed = []
    sd = dest_dir / "skills" / "helloagents"
    if sd.exists() and win_safe_rmtree(sd):
        removed.append(str(sd))
        parent = dest_dir / "skills"
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
            removed.append(f"{parent} (empty)")
    return removed

def get_python_cmd() -> str:
    return "python" if sys.platform == "win32" else "python3"

def is_windows() -> bool:
    return sys.platform == "win32"

def cleanup_empty_parent(path: Path) -> bool:
    if path.exists() and not any(path.iterdir()):
        path.rmdir()
        return True
    return False


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def get_package_root() -> Path:
    return Path(str(files("helloagents"))).parent

def get_helloagents_module_path() -> Path:
    return Path(str(files("helloagents")))

def create_symlink(target: Path, link: Path) -> bool:
    try:
        if link.exists() or link.is_symlink():
            if link.is_symlink() and link.resolve() == target.resolve():
                return True
            if link.is_symlink() or link.is_file():
                link.unlink()
            elif link.is_dir():
                shutil.rmtree(link)
        link.parent.mkdir(parents=True, exist_ok=True)
        if sys.platform == "win32":
            import subprocess
            subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)],
                           capture_output=True, check=True)
        else:
            link.symlink_to(target)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Shared hooks helpers
# ---------------------------------------------------------------------------

def _is_helloagents_command(cmd: str) -> bool:
    if not cmd:
        return False
    return ("helloagents/scripts/" in cmd or "helloagents\\scripts\\" in cmd
            or cmd.startswith("helloagents "))

def is_helloagents_hook(hook: dict) -> bool:
    if HOOKS_FINGERPRINT in hook.get("description", ""):
        return True
    if _is_helloagents_command(hook.get("command", "")):
        return True
    for h in (hook.get("hooks") or []):
        if (HOOKS_FINGERPRINT in h.get("description", "")
                or _is_helloagents_command(h.get("command", ""))):
            return True
    return False

def resolve_hook_placeholders(hooks: dict, scripts_dir: str) -> dict:
    win = sys.platform == "win32"
    def _r(obj):
        if isinstance(obj, str):
            obj = obj.replace("{SCRIPTS_DIR}", scripts_dir)
            if win:
                obj = obj.replace("python3 ", "python ")
            return obj
        if isinstance(obj, dict):
            return {k: _r(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_r(i) for i in obj]
        return obj
    return _r(hooks)


# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

def detect_installed_clis() -> list[str]:
    return [n for n, c in CLI_TARGETS.items() if (Path.home() / c["dir"]).exists()]

def _detect_installed_targets() -> list[str]:
    installed = []
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        rules = cli_dir / config["rules_file"]
        skills = cli_dir / "skills" / "helloagents"
        if (skills.exists() or skills.is_symlink()) and rules.exists() and rules.stat().st_size > 0:
            installed.append(name)
    return installed

def _detect_install_method() -> str:
    import subprocess
    try:
        r = subprocess.run(["uv", "tool", "list"], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=5)
        if r.returncode == 0 and "helloagents" in r.stdout:
            return "uv"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return "pip"

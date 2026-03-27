"""HelloAGENTS Common - Shared constants, utilities, and detection helpers.

This module is the single source of truth for all shared definitions used
across the package.  Both ``cli.py`` (entry point) and ``core/*`` (CLI
management subpackage) import from here — never from each other for
shared symbols.
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

PLUGIN_DIR_NAME = "helloagents"

# Global config paths
GLOBAL_CONFIG_DIR = Path.home() / ".helloagents"
GLOBAL_CONFIG_FILE = GLOBAL_CONFIG_DIR / "helloagents.json"

# Canonical config key registry — single source of truth for valid keys & defaults.
# installer._sync_global_config() and scripts/_config.validate_config() both
# reference this (scripts/ keeps a standalone copy because it deploys independently).
VALID_CONFIG_KEYS: dict[str, int | str] = {
    "OUTPUT_LANGUAGE": "zh-CN",
    "KB_CREATE_MODE": 2,
    "BILINGUAL_COMMIT": 1,
    "EVAL_MODE": 1,
    "UPDATE_CHECK": 72,
    "CSV_BATCH_MAX": 16,
    "NOTIFY_LEVEL": 0,
}

# Legacy alias: notify_level → NOTIFY_LEVEL (backward compatibility)
_CONFIG_KEY_ALIASES: dict[str, str] = {"notify_level": "NOTIFY_LEVEL"}

# Agent definition files prefix (Claude Code only)
AGENT_PREFIX = "ha-"

# Hooks identification
HOOKS_FINGERPRINT = "HelloAGENTS"  # description field marker to identify our hooks
CODEX_NOTIFY_SCRIPT = "codex_notify.py"

# Hooks JSON filenames for each CLI
GEMINI_HOOKS_JSON = "gemini_hooks.json"
GROK_HOOKS_JSON = "grok_hooks.json"

# Fingerprint marker to identify HelloAGENTS-created files
HELLOAGENTS_MARKER = "HELLOAGENTS_ROUTER:"

# Marker for split rule files deployed to .claude/rules/helloagents/
HELLOAGENTS_RULE_MARKER = "HELLOAGENTS_RULE"


# ---------------------------------------------------------------------------
# Locale & messaging
# NOTE: _detect_locale() and _msg() are intentionally duplicated in:
#   - cli.py (stdlib-only shim, must work when package is broken)
#   - scripts/utils.py (deployed independently to CLI config dirs)
# Keep all three copies in sync when modifying.
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


def is_helloagents_rule(file_path: Path) -> bool:
    """Check if a file is a HelloAGENTS split rule file."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")[:256]
        return HELLOAGENTS_RULE_MARKER in content
    except Exception:
        return False


def backup_user_file(file_path: Path) -> Path:
    """Backup a non-HelloAGENTS file with timestamp suffix."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_name = f"{file_path.stem}_{timestamp}_bak{file_path.suffix}"
    backup_path = file_path.parent / backup_name
    shutil.copy2(file_path, backup_path)
    return backup_path


def clean_skills_dir(dest_dir: Path) -> list[str]:
    """Remove skills/helloagents/ directory and empty parent if needed.

    Returns list of removed paths.
    """
    from .core.win_helpers import win_safe_rmtree
    removed = []
    skills_dir = dest_dir / "skills" / "helloagents"
    if skills_dir.exists():
        if win_safe_rmtree(skills_dir):
            removed.append(str(skills_dir))
            skills_parent = dest_dir / "skills"
            if skills_parent.exists() and not any(skills_parent.iterdir()):
                skills_parent.rmdir()
                removed.append(f"{skills_parent} (empty parent)")
    return removed


def get_python_cmd() -> str:
    """Return platform-appropriate Python command name.

    Returns 'python' on Windows, 'python3' elsewhere.
    """
    return "python" if sys.platform == "win32" else "python3"


def is_windows() -> bool:
    """Check if running on Windows platform.

    Use this instead of platform.system() == "Windows" for consistency.
    """
    return sys.platform == "win32"


def cleanup_empty_parent(path: Path) -> bool:
    """Remove parent directory if it's empty after child removal.

    Returns True if parent was removed, False otherwise.
    """
    if path.exists() and not any(path.iterdir()):
        path.rmdir()
        return True
    return False


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def get_package_root() -> Path:
    """Get the root directory of the installed package."""
    return Path(str(files("helloagents"))).parent


def get_agents_md_path() -> Path:
    """Get the path to AGENTS.md source file."""
    return get_package_root() / "AGENTS.md"


def get_skill_md_path() -> Path:
    """Get the path to SKILL.md source file."""
    return get_package_root() / "SKILL.md"


def get_helloagents_module_path() -> Path:
    """Get the path to the helloagents module directory."""
    return Path(str(files("helloagents")))


# ---------------------------------------------------------------------------
# Shared hooks helpers (used by claude_config.py and settings_hooks.py)
# ---------------------------------------------------------------------------

def _is_helloagents_command(cmd: str) -> bool:
    """Check if a command string references HelloAGENTS scripts or CLI."""
    if not cmd:
        return False
    if "helloagents/scripts/" in cmd or "helloagents\\scripts\\" in cmd:
        return True
    if cmd.startswith("helloagents "):
        return True
    return False


def is_helloagents_hook(hook: dict) -> bool:
    """Check if a hook entry belongs to HelloAGENTS.

    Identifies by description fingerprint OR command path patterns.
    This ensures hooks are properly identified even if user edits the description.
    Works with both flat hook objects and matcher-group objects.
    """
    if HOOKS_FINGERPRINT in hook.get("description", ""):
        return True
    if _is_helloagents_command(hook.get("command", "")):
        return True
    inner = hook.get("hooks", [])
    if isinstance(inner, list):
        for h in inner:
            if HOOKS_FINGERPRINT in h.get("description", ""):
                return True
            if _is_helloagents_command(h.get("command", "")):
                return True
    return False


def resolve_hook_placeholders(hooks: dict, scripts_dir: str) -> dict:
    """Replace placeholders in hook commands with actual values.

    Resolves:
    - {SCRIPTS_DIR} → actual installed scripts path
    - python3 → platform-appropriate Python command (Windows: python)

    Validates that all placeholders are resolved and warns if issues found.
    """
    win = sys.platform == "win32"
    unresolved = []

    def _replace(obj):
        if isinstance(obj, str):
            original = obj
            obj = obj.replace("{SCRIPTS_DIR}", scripts_dir)
            if win:
                obj = obj.replace("python3 ", "python ")
            # Check for unresolved placeholders
            if "{" in obj and "}" in obj:
                unresolved.append(original)
            return obj
        if isinstance(obj, dict):
            return {k: _replace(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_replace(item) for item in obj]
        return obj

    result = _replace(hooks)

    if unresolved:
        print(f"[HelloAGENTS] Warning: unresolved placeholders in hooks: {unresolved[:3]}",
              file=sys.stderr)

    return result


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
    """Detect which CLI targets have HelloAGENTS installed (module + rules).

    Checks for actual module content (not just directory existence) to avoid
    false positives from user-data remnants after uninstall.
    """
    installed = []
    _module_dirs = ("functions", "stages", "scripts")
    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]
        has_modules = any((plugin_dir / d).is_dir() for d in _module_dirs)
        has_rules = rules_file.exists() and rules_file.stat().st_size > 0
        if has_modules and has_rules:
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

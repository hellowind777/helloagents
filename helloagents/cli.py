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
    "claude": {"dir": ".claude", "rules_file": "CLAUDE.md"},
    "codex": {"dir": ".codex", "rules_file": "AGENTS.md"},
    "opencode": {"dir": ".opencode", "rules_file": "OpenCode.md"},
    "gemini": {"dir": ".gemini", "rules_file": "GEMINI.md"},
    "qwen": {"dir": ".qwen", "rules_file": "QWEN.md"},
    "grok": {"dir": ".grok", "rules_file": "GROK.md"},
}

PLUGIN_DIR_NAME = "helloagents"

# Fingerprint marker to identify HelloAGENTS-created files
HELLOAGENTS_MARKER = "HELLOAGENTS_ROUTER:"


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
            print(f"New version available: {remote_ver} (current: {local_ver}, branch: {branch})")
            print("  Run 'helloagents update' to update")
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

    Only removes files that are confirmed to be created by HelloAGENTS
    (containing the HELLOAGENTS_MARKER). This prevents accidental deletion
    of user-created files that happen to have the same name.

    Args:
        dest_dir: CLI config directory (e.g. ~/.claude/).
        current_rules_file: Rules file name for this CLI target.

    Returns:
        List of removed file/directory paths.
    """
    removed = []

    # All possible rules file names from different CLI targets
    all_rules_files = {cfg["rules_file"] for cfg in CLI_TARGETS.values()}
    # Check for stale rules files that don't belong to this target
    stale_rules = all_rules_files - {current_rules_file}
    for name in stale_rules:
        stale_path = dest_dir / name
        if stale_path.exists() and stale_path.is_file():
            # Only delete if it's a HelloAGENTS-created file
            if is_helloagents_file(stale_path):
                stale_path.unlink()
                removed.append(str(stale_path))

    # Remove __pycache__ directories ONLY under the helloagents plugin dir
    # This is safe because the entire plugin directory belongs to HelloAGENTS
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
        print(f"Unknown target: {target}")
        print(f"Available targets: {', '.join(CLI_TARGETS.keys())}")
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]

    # Warn if CLI directory doesn't exist (CLI may not be installed)
    if not dest_dir.exists():
        print(f"  Warning: {dest_dir} does not exist. {target} CLI may not be installed.")
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Source paths
    agents_md_src = get_agents_md_path()
    module_src = get_helloagents_module_path()

    # Destination paths
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file

    print(f"Installing HelloAGENTS to {target}...")
    print(f"  Target directory: {dest_dir}")

    # Clean stale files from previous versions
    removed = clean_stale_files(dest_dir, rules_file)
    if removed:
        print(f"  Cleaned {len(removed)} stale file(s):")
        for r in removed:
            print(f"    - {r}")

    # Remove old module directory completely before copying
    if plugin_dest.exists():
        shutil.rmtree(plugin_dest)
        print(f"  Removed old module: {plugin_dest}")

    # Copy new module directory
    shutil.copytree(
        module_src,
        plugin_dest,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    print(f"  Installed module to: {plugin_dest}")

    # Copy and rename AGENTS.md to target rules file
    if agents_md_src.exists():
        if rules_dest.exists():
            if is_helloagents_file(rules_dest):
                shutil.copy2(agents_md_src, rules_dest)
                print(f"  Updated rules: {rules_dest}")
            else:
                backup = backup_user_file(rules_dest)
                print(f"  Backed up existing rules to: {backup}")
                shutil.copy2(agents_md_src, rules_dest)
                print(f"  Installed rules to: {rules_dest}")
        else:
            shutil.copy2(agents_md_src, rules_dest)
            print(f"  Installed rules to: {rules_dest}")
    else:
        print(f"  Warning: AGENTS.md not found at {agents_md_src}")

    print(f"Installation complete for {target}!")
    return True


def install_all() -> bool:
    """Install to all detected CLI directories.

    Returns:
        True if all installations succeeded, False if any failed.
    """
    detected = detect_installed_clis()
    if not detected:
        print("No CLI directories detected.")
        print("Supported CLIs: " + ", ".join(CLI_TARGETS.keys()))
        return False

    print(f"Detected CLIs: {', '.join(detected)}")
    failed = []
    for target in detected:
        if not install(target):
            failed.append(target)
        print()

    if failed:
        print(f"Failed: {', '.join(failed)}")
        return False
    return True


def update(switch_branch: str = None) -> None:
    """Update HelloAGENTS to the latest version.

    Args:
        switch_branch: If provided, switch to this branch (e.g. 'beta', 'main').
    """
    import subprocess

    local_ver = "unknown"
    try:
        local_ver = get_version("helloagents")
    except Exception:
        pass

    branch = switch_branch or _detect_channel()
    print(f"Current version: {local_ver}")
    print(f"Branch: {branch}")

    source = f"git+{REPO_URL}" + (f"@{branch}" if branch != "main" else "")
    cmd = ["uv", "tool", "install", "--from", source, "helloagents", "--force"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(result.stdout.strip() if result.stdout.strip() else "Update complete.")
            print("\nRun 'helloagents install --all' to sync CLI targets.")
            return
        else:
            stderr = result.stderr.strip()
            if stderr:
                print(f"  Error: {stderr}")
    except FileNotFoundError:
        print("  Error: uv not found. Please install uv first.")

    print("Update failed. Try manually:")
    print(f"  {' '.join(cmd)}")


def status() -> None:
    """Show installation status for all CLIs."""
    print("HelloAGENTS Installation Status")
    print("=" * 40)

    try:
        local_ver = get_version("helloagents")
        branch = _detect_channel()
        print(f"Package version: {local_ver} ({branch})")
    except Exception:
        print("Package version: unknown")

    print()

    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]

        cli_exists = cli_dir.exists()
        plugin_exists = plugin_dir.exists()
        rules_exists = rules_file.exists()

        if not cli_exists:
            status_str = "not detected"
        elif plugin_exists and rules_exists:
            status_str = "installed"
        elif cli_exists:
            status_str = "not installed"
        else:
            status_str = "partial"

        print(f"  {name:10} [{status_str}]")
        if cli_exists:
            print(f"             Dir: {cli_dir}")

    print()


def print_usage() -> None:
    """Print usage information."""
    print("HelloAGENTS - Multi-CLI Agent Framework")
    print()
    print("Usage:")
    print("  helloagents install <target>  Install to a specific CLI")
    print("  helloagents install --all     Install to all detected CLIs")
    print("  helloagents update            Update to latest version")
    print("  helloagents update <branch>   Switch to a specific branch")
    print("  helloagents status            Show installation status")
    print("  helloagents version           Show version")
    print()
    print("Targets:")
    for name in CLI_TARGETS:
        print(f"  {name}")
    print()


def main() -> None:
    """Main entry point."""
    cmd = sys.argv[1] if len(sys.argv) >= 2 else None

    if cmd != "update":
        check_update()

    if not cmd:
        print_usage()
        sys.exit(0)

    if cmd == "install":
        if len(sys.argv) < 3:
            print("Error: Missing target")
            print_usage()
            sys.exit(1)
        target = sys.argv[2]
        if target == "--all":
            if not install_all():
                sys.exit(1)
        else:
            if not install(target):
                sys.exit(1)
    elif cmd == "update":
        switch = sys.argv[2] if len(sys.argv) >= 3 else None
        update(switch)
    elif cmd == "status":
        status()
    elif cmd == "version":
        try:
            ver = get_version("helloagents")
            print(f"HelloAGENTS v{ver}")
        except Exception:
            print("HelloAGENTS (version unknown)")
    else:
        print(f"Unknown command: {cmd}")
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()

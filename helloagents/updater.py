"""HelloAGENTS Updater - Version management, update cache, and maintenance commands."""

import functools
import json
import sys
from pathlib import Path
from importlib.metadata import version as get_version
from urllib.request import urlopen, Request

from .cli import (
    _msg, _header, _divider,
    CLI_TARGETS, PLUGIN_DIR_NAME, REPO_URL, REPO_API_LATEST,
    _detect_installed_targets, _detect_install_method,
)


# ---------------------------------------------------------------------------
# Version parsing & comparison
# ---------------------------------------------------------------------------

def _parse_version(ver: str) -> tuple[tuple[int, ...], bool]:
    """Parse version string into (numeric_tuple, is_stable).

    Handles formats like '2.3.0', '2.3.0-beta.1', '2.3.0b1'.
    Returns numeric parts and whether it's a stable release.
    """
    import re
    match = re.match(r"^(\d+(?:\.\d+)*)", ver)
    if not match:
        raise ValueError(f"Invalid version: {ver}")
    numeric = tuple(int(x) for x in match.group(1).split("."))
    is_stable = match.group(0) == ver
    return numeric, is_stable


def _version_newer(remote: str, local: str) -> bool:
    """Semantic version comparison. Returns True if remote > local.

    Pre-release versions are compared by numeric parts only.
    Stable releases are considered newer than pre-releases
    with the same numeric version.
    """
    try:
        r_num, r_stable = _parse_version(remote)
        l_num, l_stable = _parse_version(local)
        if r_num != l_num:
            return r_num > l_num
        return r_stable and not l_stable
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Remote version / commit fetching
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=1)
def _read_direct_url() -> dict:
    """Read direct_url.json from package metadata (cached)."""
    try:
        from importlib.metadata import distribution
        dist = distribution("helloagents")
        raw = dist.read_text("direct_url.json")
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return {}


def _detect_channel() -> str:
    """Detect install branch from package metadata. Returns actual branch name."""
    info = _read_direct_url()
    ref = info.get("vcs_info", {}).get("requested_revision", "")
    return ref if ref else "main"


def _local_commit_id() -> str:
    """Get the git commit hash recorded at install time from direct_url.json."""
    info = _read_direct_url()
    return info.get("vcs_info", {}).get("commit_id", "")


def _remote_commit_id(branch: str) -> str:
    """Fetch the latest commit hash on a remote branch via GitHub API."""
    url = f"https://api.github.com/repos/hellowind777/helloagents/commits/{branch}"
    req = Request(url, headers={
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "helloagents-update-checker",
    })
    with urlopen(req, timeout=3) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("sha", "")


def _fetch_remote_version(branch: str) -> str:
    """Fetch version from pyproject.toml on a remote branch."""
    import re
    url = f"https://raw.githubusercontent.com/hellowind777/helloagents/{branch}/pyproject.toml"
    req = Request(url, headers={"User-Agent": "helloagents-update-checker"})
    with urlopen(req, timeout=3) as resp:
        content = resp.read().decode("utf-8")
    m = re.search(r'version\s*=\s*"([^"]+)"', content)
    return m.group(1) if m else ""


# ---------------------------------------------------------------------------
# Update cache
# ---------------------------------------------------------------------------

_UPDATE_CACHE_DIR = Path.home() / ".helloagents"
_UPDATE_CACHE_FILE = _UPDATE_CACHE_DIR / ".update_cache"


def _read_update_cache(local_ver: str, branch: str) -> dict | None:
    """Read update cache. Returns cached data if fresh, else None.

    Uses expires_at (ISO date) from cache file to determine freshness.
    Cache is invalidated when local version or branch changes.
    """
    try:
        if not _UPDATE_CACHE_FILE.exists():
            return None
        data = json.loads(_UPDATE_CACHE_FILE.read_text(encoding="utf-8"))
        expires_at = data.get("expires_at", "")
        if not expires_at:
            return None
        from datetime import datetime, timezone
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) >= expiry:
            return None
        if data.get("local_version") != local_ver:
            return None
        if data.get("branch") != branch:
            return None
        return data
    except Exception:
        return None


def _write_update_cache(has_update: bool, local_ver: str,
                        remote_ver: str, branch: str,
                        cache_ttl_hours: int | None = None) -> None:
    """Write update check result to central cache file (~/.helloagents/).

    Args:
        cache_ttl_hours: If provided, expires_at = now + N hours.
            If None, preserves existing expires_at from cache file
            (falls back to now if no prior cache exists).
    """
    import time
    from datetime import datetime, timezone, timedelta
    try:
        now = time.time()
        if cache_ttl_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=cache_ttl_hours)
        else:
            # Preserve existing expires_at from prior cache
            expires_at = datetime.now(timezone.utc)
            try:
                if _UPDATE_CACHE_FILE.exists():
                    old = json.loads(_UPDATE_CACHE_FILE.read_text(encoding="utf-8"))
                    old_exp = old.get("expires_at", "")
                    if old_exp:
                        expires_at = datetime.fromisoformat(old_exp.replace("Z", "+00:00"))
            except Exception:
                pass
        _UPDATE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _UPDATE_CACHE_FILE.write_text(json.dumps({
            "last_check": now,
            "expires_at": expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "has_update": has_update,
            "local_version": local_ver,
            "remote_version": remote_ver,
            "branch": branch,
        }, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# check_update
# ---------------------------------------------------------------------------

def check_update(force: bool = False,
                 cache_ttl_hours: int | None = None) -> bool:
    """Check for newer version or commits on GitHub.

    Two-layer detection:
    1. Compare version numbers (catches version bumps).
    2. If versions match, compare git commit hashes (catches same-version pushes).

    Results cached to ~/.helloagents/.update_cache.
    Cache auto-invalidates when local version or branch changes.

    Args:
        force: Skip cache and always perform network check.
        cache_ttl_hours: Cache validity in hours. Passed through to
            _write_update_cache to compute expires_at. None means
            cache expires immediately (direct CLI usage).

    Returns True if a version update notice was printed.
    """
    try:
        local_ver = get_version("helloagents")
        branch = _detect_channel()

        # --- cache hit path (skipped when force=True) ---
        if not force:
            cache = _read_update_cache(local_ver, branch)
            if cache is not None:
                if cache.get("has_update"):
                    rv = cache.get("remote_version", "?")
                    print(f"New version {rv} available (current {local_ver}, branch {branch}). Run 'helloagents update' to upgrade.")
                    return True
                return False  # fresh cache, no update

        # --- cache miss / stale — do network check ---
        remote_ver = ""
        if branch == "main":
            try:
                req = Request(REPO_API_LATEST, headers={
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "helloagents-update-checker",
                })
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
            _write_update_cache(True, local_ver, remote_ver, branch, cache_ttl_hours)
            print(f"New version {remote_ver} available (current {local_ver}, branch {branch}). Run 'helloagents update' to upgrade.")
            return True
        # Version matches — check if remote has newer commits
        local_sha = _local_commit_id()
        if local_sha:
            try:
                remote_sha = _remote_commit_id(branch)
                if remote_sha and remote_sha != local_sha:
                    print(_msg(f"远程仓库有新提交（分支 {branch}），请执行 'helloagents update' 同步最新代码。",
                               f"Remote has new commits (branch {branch}). Run 'helloagents update' to sync."))
            except Exception:
                pass
        _write_update_cache(False, local_ver, remote_ver or "", branch, cache_ttl_hours)
    except Exception:
        pass
    return False


# ---------------------------------------------------------------------------
# update command
# ---------------------------------------------------------------------------

def update(switch_branch: str = None) -> None:
    """Update HelloAGENTS to the latest version, then auto-sync installed targets."""
    import subprocess

    pre_targets = _detect_installed_targets()
    total_steps = 3 if pre_targets else 1

    # ── Phase 1: Update package ──
    _header(_msg(f"步骤 1/{total_steps}: 更新 HelloAGENTS 包",
                 f"Step 1/{total_steps}: Update HelloAGENTS Package"))

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
            result = subprocess.run(uv_cmd, capture_output=True, text=True,
                                    encoding="utf-8", errors="replace")
            if result.returncode == 0:
                print(result.stdout.strip() if result.stdout.strip()
                      else _msg("  ✓ 包更新完成 (uv)", "  ✓ Package updated (uv)"))
                updated = True
            else:
                stderr = result.stderr.strip()
                if stderr:
                    print(f"  uv error: {stderr}")
        except FileNotFoundError:
            print(_msg("  警告: 未找到 uv，回退到 pip。",
                       "  Warning: uv not found, falling back to pip."))

    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade",
                   "--force-reinstall", pip_url]
        if method == "uv":
            print(_msg("  尝试 pip 回退...", "  Trying pip fallback..."))
        try:
            result = subprocess.run(pip_cmd, capture_output=True, text=True,
                                    encoding="utf-8", errors="replace")
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
        print(f"    pip install --upgrade --force-reinstall {pip_url}")
        return

    # Update succeeded — clear stale update cache
    try:
        new_ver = get_version("helloagents")
    except Exception:
        new_ver = local_ver
    _write_update_cache(False, new_ver, new_ver, branch)

    # ── Phase 2: Sync installed targets ──
    targets = _detect_installed_targets()
    if targets:
        _header(_msg(
            f"步骤 2/{total_steps}: 同步已安装的 CLI 工具（共 {len(targets)} 个）",
            f"Step 2/{total_steps}: Syncing Installed CLI Targets ({len(targets)} target(s))"))
        results = {}
        for i, t in enumerate(targets, 1):
            print(_msg(f"  [{i}/{len(targets)}] {t}", f"  [{i}/{len(targets)}] {t}"))
            ret = subprocess.run(
                [sys.executable, "-m", "helloagents.cli", "install", t],
                encoding="utf-8", errors="replace",
            )
            results[t] = ret.returncode == 0
            print()

        _header(_msg(f"步骤 3/{total_steps}: 更新完成",
                     f"Step 3/{total_steps}: Update Complete"))
        for t, ok in results.items():
            mark = "✓" if ok else "✗"
            status_text = (_msg("已同步", "synced") if ok
                           else _msg("同步失败", "sync failed"))
            print(f"  {mark} {t:10} {status_text}")
        print()
    else:
        print()
        print(_msg("  未检测到已安装的 CLI 目标。执行 'helloagents' 选择安装。",
                   "  No installed CLI targets detected. Run 'helloagents' to install."))


# ---------------------------------------------------------------------------
# status / clean commands
# ---------------------------------------------------------------------------

def status() -> None:
    """Show installation status for all CLIs."""
    _header(_msg("安装状态", "Installation Status"))

    try:
        local_ver = get_version("helloagents")
        branch = _detect_channel()
        print(_msg(f"  包版本: {local_ver} ({branch})",
                   f"  Package version: {local_ver} ({branch})"))
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
    import shutil

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

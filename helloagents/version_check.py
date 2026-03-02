"""HelloAGENTS Version Check - Version detection, comparison, and update cache.

Leaf module: only depends on stdlib + cli.REPO_API_LATEST.
All output from check_update() is pure English to ensure AI CLI keyword matching
works regardless of system locale.
"""

import functools
import json
from pathlib import Path
from importlib.metadata import version as get_version
from urllib.request import urlopen, Request

from .cli import REPO_API_LATEST


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


def fetch_latest_version(branch: str, timeout: int = 5) -> str:
    """Unified remote version fetching (deduplicates check_update & update logic).

    For 'main' branch: tries GitHub Releases API first, falls back to pyproject.toml.
    For other branches: fetches from pyproject.toml directly.

    Args:
        branch: Git branch name.
        timeout: HTTP timeout for the Releases API call (seconds).

    Returns:
        Remote version string, or empty string on failure.
    """
    remote_ver = ""
    if branch == "main":
        try:
            req = Request(REPO_API_LATEST, headers={
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "helloagents-update-checker",
            })
            with urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                remote_ver = data.get("tag_name", "").lstrip("v")
        except Exception:
            pass
        if not remote_ver:
            try:
                remote_ver = _fetch_remote_version("main")
            except Exception:
                pass
    else:
        try:
            remote_ver = _fetch_remote_version(branch)
        except Exception:
            pass
    return remote_ver


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
        if cache_ttl_hours is not None:
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
# check_update (all output is pure English for AI CLI compatibility)
# ---------------------------------------------------------------------------

def check_update(force: bool = False,
                 cache_ttl_hours: int | None = None,
                 show_version: bool = False) -> bool:
    """Check for newer version or commits on GitHub.

    Two-layer detection:
    1. Compare version numbers (catches version bumps).
    2. If versions match, compare git commit hashes (catches same-version pushes).

    Results cached to ~/.helloagents/.update_cache.
    Cache auto-invalidates when local version or branch changes.

    NOTE: All output is pure English to ensure AI CLI keyword matching
    (e.g. "New version") works regardless of system locale.

    Args:
        force: Skip cache and always perform network check.
        cache_ttl_hours: Cache validity in hours. Passed through to
            _write_update_cache to compute expires_at. None means
            cache expires immediately (direct CLI usage).
        show_version: If True and no update found, print current
            version with branch info (used by 'version' command).

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
                    print(f"New version {rv} available (local {local_ver}, branch {branch}). Run 'helloagents update' to upgrade.")
                    return True
                if show_version:
                    rv = cache.get("remote_version", "")
                    if rv:
                        print(f"HelloAGENTS local v{local_ver} / remote v{rv} (branch {branch})")
                    else:
                        print(f"HelloAGENTS local v{local_ver} (branch {branch})")
                return False  # fresh cache, no update

        # --- cache miss / stale — do network check ---
        remote_ver = fetch_latest_version(branch, timeout=3)
        if remote_ver and _version_newer(remote_ver, local_ver):
            _write_update_cache(True, local_ver, remote_ver, branch, cache_ttl_hours)
            print(f"New version {remote_ver} available (local {local_ver}, branch {branch}). Run 'helloagents update' to upgrade.")
            return True
        # Version matches — check if remote has newer commits
        local_sha = _local_commit_id()
        if local_sha:
            try:
                remote_sha = _remote_commit_id(branch)
                if remote_sha and remote_sha != local_sha:
                    # Fixed: pure English output (was _msg() bilingual, broke AI CLI matching)
                    print(f"Remote has new commits (branch {branch}). Run 'helloagents update' to sync.")
            except Exception:
                pass
        _write_update_cache(False, local_ver, remote_ver or "", branch, cache_ttl_hours)
        if show_version:
            if remote_ver:
                print(f"HelloAGENTS local v{local_ver} / remote v{remote_ver} (branch {branch})")
            else:
                print(f"HelloAGENTS local v{local_ver} (branch {branch})")
    except Exception:
        if show_version:
            try:
                ver = get_version("helloagents")
                br = _detect_channel()
                print(f"HelloAGENTS local v{ver} / branch {br} (update check failed)")
            except Exception:
                print("HelloAGENTS (version unknown, update check failed)")
    return False

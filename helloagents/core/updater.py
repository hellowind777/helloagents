"""HelloAGENTS Updater - Update command and post-update sync."""

import os
import sys
from pathlib import Path
from importlib.metadata import version as get_version

from .._common import (
    _msg, _header,
    REPO_URL,
    _detect_installed_targets, _detect_install_method,
)
from .version_check import (
    _detect_channel, _local_commit_id, _remote_commit_id,
    _version_newer, _write_update_cache, fetch_latest_version,
)
from .win_helpers import (
    _cleanup_pip_remnants, _win_cleanup_bak,
    _win_deferred_pip, build_pip_cleanup_cmd,
    win_preemptive_unlock, win_finish_unlock,
)


# ---------------------------------------------------------------------------
# update command
# ---------------------------------------------------------------------------

def update(switch_branch: str | None = None) -> None:
    """Update HelloAGENTS to the latest version, then auto-sync installed targets."""
    import subprocess

    # Clean up corrupted pip remnants and leftover .exe.bak
    _cleanup_pip_remnants()
    if sys.platform == "win32":
        _win_cleanup_bak()

    # Snapshot installed targets before update. In deferred mode (Windows exe lock),
    # these targets are passed as post_cmds to the deferred script. The slight timing
    # gap is acceptable — users won't modify install state during an active update.
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

    # Fetch remote version (unified helper — deduplicates old inline logic)
    print(_msg("  正在检查远程版本...", "  Checking remote version..."))
    remote_ver = fetch_latest_version(branch, timeout=5)

    print(_msg(f"  本地版本: {local_ver}", f"  Local version: {local_ver}"))
    print(_msg(f"  远程版本: {remote_ver or '未知'}", f"  Remote version: {remote_ver or 'unknown'}"))
    print(_msg(f"  分支: {branch}", f"  Branch: {branch}"))
    print()

    # --- user confirmation ---
    if remote_ver and _version_newer(remote_ver, local_ver):
        prompt = _msg(
            f"  发现新版本 {remote_ver}，是否更新？(Y/n): ",
            f"  New version {remote_ver} available. Update? (Y/n): ")
        default_yes = True
    elif remote_ver and remote_ver == local_ver:
        local_sha = _local_commit_id()
        remote_sha = ""
        try:
            remote_sha = _remote_commit_id(branch)
        except Exception:
            pass
        if local_sha and remote_sha and local_sha == remote_sha:
            prompt = _msg(
                "  本地版本与远程仓库完全一致，是否强制覆盖更新？(y/N): ",
                "  Local version matches remote. Force reinstall? (y/N): ")
            default_yes = False
        else:
            prompt = _msg(
                "  版本号相同但远程仓库可能有新提交，是否更新？(Y/n): ",
                "  Same version but remote may have new commits. Update? (Y/n): ")
            default_yes = True
    else:
        prompt = _msg(
            "  无法确认远程版本，是否继续更新？(Y/n): ",
            "  Cannot determine remote version. Continue? (Y/n): ")
        default_yes = True

    try:
        answer = input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        print(_msg("  已取消。", "  Cancelled."))
        return

    if default_yes:
        if answer in ("n", "no"):
            print(_msg("  已取消。", "  Cancelled."))
            return
    else:
        if answer not in ("y", "yes"):
            print(_msg("  已取消。", "  Cancelled."))
            return

    print()

    # --- execute update ---
    branch_suffix = f"@{branch}" if branch != "main" else ""
    updated = False
    method = _detect_install_method()
    print(_msg("  正在从远程仓库下载并安装，请稍候...",
               "  Downloading and installing from remote, please wait..."))

    # Preemptive unlock: rename exe BEFORE pip/uv to avoid lock entirely
    bak = win_preemptive_unlock()

    # Try uv first
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

    # Fallback to pip
    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        pip_cmd = [sys.executable, "-m", "pip", "install", "--upgrade",
                   "--no-cache-dir", pip_url]
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
                # Preemptive unlock failed or not Windows — last resort deferred
                if sys.platform == "win32" and (
                        "WinError" in stderr or "helloagents.exe" in stderr):
                    # Let the new code detect targets itself via _post_update
                    post = [[sys.executable, "-m", "helloagents.cli",
                             "_post_update", branch]]
                    all_post = post + [build_pip_cleanup_cmd()]
                    if _win_deferred_pip(pip_cmd, post_cmds=all_post):
                        print(_msg(
                            "  helloagents.exe 被当前进程锁定，"
                            "更新将在退出后自动完成。",
                            "  helloagents.exe is locked, "
                            "update will complete after exit."))
                        if pre_targets:
                            print(_msg(
                                f"  已安装的 {len(pre_targets)} 个 CLI "
                                f"工具也将自动同步。",
                                f"  {len(pre_targets)} installed target(s) "
                                f"will also be synced."))
                        win_finish_unlock(bak, False)
                        return
                elif stderr:
                    print(f"  pip error: {stderr}")
        except FileNotFoundError:
            print(_msg("  错误: 未找到 pip。", "  Error: pip not found."))

    # Finish preemptive unlock: clean .bak on success, restore on failure
    win_finish_unlock(bak, updated)

    # Clean up pip remnants created during upgrade (pure file cleanup, safe with old code)
    _cleanup_pip_remnants()

    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        print(_msg("  ✗ 更新失败。请手动执行:", "  ✗ Update failed. Try manually:"))
        print(f"    pip install --upgrade --no-cache-dir {pip_url}")
        return

    # Re-exec: launch a NEW process for Phase 2+3 so that the freshly
    # installed code on disk is what actually runs (cache write, target
    # detection, sync).  This avoids stale in-memory code after branch switch.
    env = os.environ.copy()
    env["HELLOAGENTS_NO_UPDATE_CHECK"] = "1"
    subprocess.run(
        [sys.executable, "-m", "helloagents.cli",
         "_post_update", branch, str(total_steps)],
        env=env,
    )
    return


# ---------------------------------------------------------------------------
# _post_update_sync – Phase 2+3 entry point (runs in new process after update)
# ---------------------------------------------------------------------------

def _post_update_sync(branch: str | None = None,
                      total_steps: int | None = None) -> None:
    """Execute Phase 2+3 after a successful package update.

    This function is designed to be called from a *new* process so that the
    freshly-installed code on disk is what actually runs.  It covers:
      - Writing the update cache with the new version
      - Detecting currently installed targets (using new code)
      - Syncing each target via ``helloagents install``
      - Printing a summary
    """
    import subprocess

    # Resolve branch if not provided
    if not branch:
        branch = _detect_channel()

    # Write update cache with new version
    try:
        new_ver = get_version("helloagents")
    except Exception:
        new_ver = "unknown"
    _write_update_cache(False, new_ver, new_ver, branch)

    # Detect targets using new code
    targets = _detect_installed_targets()

    # Resolve total_steps if not provided
    if total_steps is None:
        total_steps = 3 if targets else 1

    # ── Phase 2: Sync installed targets ──
    if targets:
        _header(_msg(
            f"步骤 2/{total_steps}: 同步已安装的 CLI 工具（共 {len(targets)} 个）",
            f"Step 2/{total_steps}: Syncing Installed CLI Targets ({len(targets)} target(s))"))
        results = {}
        for i, t in enumerate(targets, 1):
            print(_msg(f"  [{i}/{len(targets)}] {t}", f"  [{i}/{len(targets)}] {t}"))
            env = os.environ.copy()
            env["HELLOAGENTS_NO_UPDATE_CHECK"] = "1"
            ret = subprocess.run(
                [sys.executable, "-m", "helloagents.cli", "install", t],
                encoding="utf-8", errors="replace", env=env,
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

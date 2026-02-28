"""HelloAGENTS Updater - Update command, status, and clean operations."""

import os
import sys
from pathlib import Path
from importlib.metadata import version as get_version

from .cli import (
    _msg, _header,
    CLI_TARGETS, PLUGIN_DIR_NAME, REPO_URL,
    HOOKS_FINGERPRINT,
    _detect_installed_targets, _detect_install_method,
)
from .version_check import (
    # Used by update() / status()
    _detect_channel, _local_commit_id, _remote_commit_id,
    _version_newer, _write_update_cache, fetch_latest_version,
    # Backward-compatible re-exports (originally defined in this module)
    check_update,  # noqa: F401
    _parse_version, _read_direct_url,  # noqa: F401
    _fetch_remote_version, _read_update_cache,  # noqa: F401
)
from .win_helpers import (
    # Used by update()
    _cleanup_pip_remnants, _win_cleanup_bak,
    _win_deferred_pip, build_pip_cleanup_cmd,
    win_preemptive_unlock, win_finish_unlock, win_safe_rmtree,
    # Backward-compatible re-exports
    _win_find_exe, win_exe_retry,  # noqa: F401
)


# ---------------------------------------------------------------------------
# update command
# ---------------------------------------------------------------------------

def update(switch_branch: str = None) -> None:
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
                    post = [[sys.executable, "-m", "helloagents.cli",
                             "install", t] for t in pre_targets]
                    all_post = (post or []) + [build_pip_cleanup_cmd()]
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

    # Clean up pip remnants created during upgrade
    _cleanup_pip_remnants()

    if not updated:
        pip_url = f"git+{REPO_URL}.git" + branch_suffix
        print(_msg("  ✗ 更新失败。请手动执行:", "  ✗ Update failed. Try manually:"))
        print(f"    pip install --upgrade --no-cache-dir {pip_url}")
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


# ---------------------------------------------------------------------------
# status command
# ---------------------------------------------------------------------------

def _show_config_status() -> None:
    """Display config.json override status."""
    import json
    global_cfg = Path.home() / ".helloagents" / "config.json"
    project_cfg = Path.cwd() / ".helloagents" / "config.json"

    for label, path in [
        (_msg("全局配置", "Global config"), global_cfg),
        (_msg("项目配置", "Project config"), project_cfg),
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

    # Config override status
    _show_config_status()

    print()

    for name, config in CLI_TARGETS.items():
        cli_dir = Path.home() / config["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        rules_file = cli_dir / config["rules_file"]
        skill_file = cli_dir / "skills" / "helloagents" / "SKILL.md"

        cli_exists = cli_dir.exists()
        plugin_exists = plugin_dir.exists()
        rules_exists = rules_file.exists()
        skill_exists = skill_file.exists()

        if not cli_exists:
            mark = "·"
            status_str = _msg("未检测到该工具", "tool not found")
        elif plugin_exists and rules_exists and skill_exists:
            mark = "✓"
            status_str = _msg("已安装 HelloAGENTS", "HelloAGENTS installed")
        elif plugin_exists and rules_exists:
            mark = "!"
            status_str = _msg("已安装但缺少 SKILL.md，建议重新安装",
                              "installed but SKILL.md missing, reinstall recommended")
        elif plugin_exists or rules_exists:
            mark = "!"
            status_str = _msg("安装不完整", "partial install")
        else:
            mark = "·"
            status_str = _msg("未安装 HelloAGENTS", "HelloAGENTS not installed")

        print(f"  {mark} {name:10} {status_str}")

        # Hooks status check (only for installed targets)
        if plugin_exists and rules_exists:
            if name == "claude":
                try:
                    import json
                    sp = cli_dir / "settings.json"
                    if sp.exists():
                        st = json.loads(sp.read_text(encoding="utf-8"))
                        hooks = st.get("hooks", {})
                        ha_count = 0
                        for hl in hooks.values():
                            if not isinstance(hl, list):
                                continue
                            for mg in hl:
                                # New nested structure: matcher group with inner hooks
                                inner = mg.get("hooks", [])
                                if isinstance(inner, list):
                                    for h in inner:
                                        if HOOKS_FINGERPRINT in h.get("description", ""):
                                            ha_count += 1
                                # Legacy flat structure fallback
                                elif HOOKS_FINGERPRINT in mg.get("description", ""):
                                    ha_count += 1
                        if ha_count > 0:
                            print(f"    hooks: {ha_count} HelloAGENTS hook(s) ✓")
                        else:
                            print(_msg("    ⚠ 未检测到 HelloAGENTS Hooks，建议重新安装",
                                       "    ⚠ No HelloAGENTS hooks found, reinstall recommended"))
                    else:
                        print(_msg("    ⚠ settings.json 不存在，Hooks 未配置",
                                   "    ⚠ settings.json missing, hooks not configured"))
                except Exception:
                    pass
                # Agent definition files check
                agents_dir = cli_dir / "agents"
                ha_agents = list(agents_dir.glob("ha-*.md")) if agents_dir.exists() else []
                if ha_agents:
                    print(f"    agents: {len(ha_agents)} ha-*.md ✓")
                else:
                    print(_msg("    ⚠ 未检测到 ha-*.md 子代理定义，建议重新安装",
                               "    ⚠ No ha-*.md agent definitions found, reinstall recommended"))
            elif name == "codex":
                try:
                    import re as _re
                    ct_path = cli_dir / "config.toml"
                    if ct_path.exists():
                        ct_text = ct_path.read_text(encoding="utf-8")
                        # Match both array format and legacy string format
                        nm_arr = _re.search(r'^notify\s*=\s*\[([^\]]*)\]', ct_text, _re.MULTILINE)
                        nm_str = _re.search(r'^notify\s*=\s*"([^"]*)"', ct_text, _re.MULTILINE)
                        notify_val = (nm_arr.group(1) if nm_arr else
                                      nm_str.group(1) if nm_str else None)
                        if notify_val and "helloagents" in notify_val:
                            print("    notify: helloagents ✓")
                        elif notify_val:
                            print(_msg("    notify: 用户自定义（非 HelloAGENTS）",
                                       "    notify: user-defined (not HelloAGENTS)"))
                        else:
                            print(_msg("    ⚠ notify 未配置，建议重新安装",
                                       "    ⚠ notify not configured, reinstall recommended"))
                except Exception:
                    pass
                # Multi-agent config check
                try:
                    import re as _re2
                    ct_path2 = cli_dir / "config.toml"
                    if ct_path2.exists():
                        ct2 = ct_path2.read_text(encoding="utf-8")
                        ma_items = []
                        if _re2.search(r'agents\.max_threads\s*=', ct2):
                            ma_items.append("agents.max_threads")
                        if _re2.search(r'agents\.max_depth\s*=', ct2):
                            ma_items.append("agents.max_depth")
                        if _re2.search(r'^sqlite\s*=\s*true', ct2, _re2.MULTILINE):
                            ma_items.append("sqlite")
                        if ma_items:
                            print(f"    multi-agent: {', '.join(ma_items)} ✓")
                        else:
                            print(_msg("    ⚠ 多代理配置缺失，建议重新安装",
                                       "    ⚠ Multi-agent config missing, reinstall recommended"))
                except Exception:
                    pass
        if name == "codex" and rules_exists:
            try:
                rules_size = rules_file.stat().st_size
                max_bytes = 32768  # Codex default
                config_toml = cli_dir / "config.toml"
                if config_toml.exists():
                    import re
                    ct = config_toml.read_text(encoding="utf-8")
                    m = re.search(r'project_doc_max_bytes\s*=\s*(\d+)', ct)
                    if m:
                        max_bytes = int(m.group(1))
                if rules_size > max_bytes:
                    print(_msg(
                        f"    ⚠ AGENTS.md ({rules_size} 字节) 超过 project_doc_max_bytes ({max_bytes})，内容会被截断",
                        f"    ⚠ AGENTS.md ({rules_size} bytes) exceeds project_doc_max_bytes ({max_bytes}), content will be truncated"))
                    print(_msg(
                        "    → 执行 helloagents install codex 可自动修复此问题",
                        "    → Run helloagents install codex to fix this automatically"))
            except Exception:
                pass

    # WSL environment hint
    try:
        _is_wsl = False
        if sys.platform != "win32":
            try:
                _is_wsl = "microsoft" in Path("/proc/version").read_text().lower()
            except Exception:
                pass
        if _is_wsl:
            print()
            print(_msg("  ⚠ 当前运行在 WSL 环境中。WSL 与 Windows 宿主的配置路径互相独立，",
                       "  ⚠ Running inside WSL. WSL and Windows host have separate config paths,"))
            print(_msg("    若需在两侧使用 HelloAGENTS，需分别安装。",
                       "    install HelloAGENTS on both sides if needed."))
        elif sys.platform == "win32":
            import shutil as _sh
            if _sh.which("wsl"):
                print()
                print(_msg("  ⚠ 检测到 WSL。若在 VS Code 中以 WSL Remote 模式使用 HelloAGENTS，",
                           "  ⚠ WSL detected. If using HelloAGENTS via VS Code WSL Remote,"))
                print(_msg("    需在 WSL 内部单独执行 helloagents install，两侧配置路径互相独立。",
                           "    run helloagents install inside WSL separately — config paths are independent."))
    except Exception:
        pass

    print()


# ---------------------------------------------------------------------------
# clean command
# ---------------------------------------------------------------------------

def clean() -> None:
    """Clean caches from all installed CLI targets."""
    _header(_msg("清理缓存", "Clean Caches"))

    targets = _detect_installed_targets()
    if not targets:
        print(_msg("  未检测到已安装的 CLI 目标，无需清理。",
                   "  No installed CLI targets detected. Nothing to clean."))
        return

    total_removed = 0
    for name in targets:
        cfg = CLI_TARGETS[name]
        cli_dir = Path.home() / cfg["dir"]
        plugin_dir = cli_dir / PLUGIN_DIR_NAME
        removed = 0

        if not plugin_dir.exists():
            continue

        for cache_dir in list(plugin_dir.rglob("__pycache__")):
            if cache_dir.is_dir():
                if win_safe_rmtree(cache_dir):
                    removed += 1
                else:
                    print(_msg(f"  ⚠ 无法清理 {cache_dir}",
                               f"  ⚠ Cannot clean {cache_dir}"))

        for pyc_file in list(plugin_dir.rglob("*.pyc")):
            if pyc_file.is_file():
                try:
                    pyc_file.unlink()
                    removed += 1
                except Exception as e:
                    print(_msg(f"  ⚠ 无法清理 {pyc_file}: {e}",
                               f"  ⚠ Cannot clean {pyc_file}: {e}"))

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

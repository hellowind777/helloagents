"""HelloAGENTS Windows Helpers - Platform-specific utilities and pip cleanup tools.

Leaf module: only depends on stdlib + cli._msg.
"""

import shutil
import sys
from pathlib import Path

from .cli import _msg


# ---------------------------------------------------------------------------
# pip remnant cleanup
# ---------------------------------------------------------------------------

def _cleanup_pip_remnants() -> None:
    """Clean up corrupted pip remnant directories (~-prefixed) in site-packages.

    Uses multiple strategies to locate site-packages directories:
    1. Derive from this module's own __file__ (most reliable for installed packages)
    2. Derive from sys.executable (covers standard Python layouts)
    3. Fall back to site.getsitepackages()
    """
    # Collect candidate site-packages paths from multiple sources
    sp_paths: set[Path] = set()

    # Strategy 1: this module's own location (most reliable when installed)
    try:
        sp_paths.add(Path(__file__).resolve().parent.parent)
    except Exception:
        pass

    # Strategy 2: derive from sys.executable
    try:
        exe_dir = Path(sys.executable).resolve().parent
        sp_paths.add(exe_dir / "Lib" / "site-packages")  # Windows
        vi = sys.version_info
        sp_paths.add(exe_dir / "lib" / f"python{vi.major}.{vi.minor}" / "site-packages")  # Unix
    except Exception:
        pass

    # Strategy 3: site.getsitepackages()
    try:
        import site
        for sp in site.getsitepackages():
            sp_paths.add(Path(sp))
    except Exception:
        pass

    # Filter to existing directories only
    sp_paths = {p for p in sp_paths if p.is_dir()}

    for sp_path in sp_paths:
        try:
            for remnant in sp_path.iterdir():
                if not (remnant.is_dir() and remnant.name.startswith("~")):
                    continue
                try:
                    shutil.rmtree(remnant)
                except OSError:
                    # Windows: try removing read-only attributes and retry
                    if sys.platform == "win32":
                        try:
                            import os
                            import stat
                            for root, dirs, files in os.walk(remnant):
                                for f in files:
                                    fp = Path(root) / f
                                    fp.chmod(stat.S_IWRITE)
                            shutil.rmtree(remnant)
                        except OSError:
                            print(_msg(
                                f"  [warn] 无法删除残留目录: {remnant}，请手动删除。",
                                f"  [warn] Cannot remove remnant: {remnant}, please delete manually."))
                    else:
                        print(_msg(
                            f"  [warn] 无法删除残留目录: {remnant}，请手动删除。",
                            f"  [warn] Cannot remove remnant: {remnant}, please delete manually."))
        except PermissionError:
            pass  # No permission to list directory contents


# ---------------------------------------------------------------------------
# Windows .exe helpers
# ---------------------------------------------------------------------------

def _win_find_exe() -> Path | None:
    """Find the helloagents.exe entry point on Windows."""
    exe = shutil.which("helloagents")
    if exe:
        return Path(exe)
    # Fallback: same directory as python.exe
    candidate = Path(sys.executable).parent / "Scripts" / "helloagents.exe"
    return candidate if candidate.exists() else None


def _win_cleanup_bak() -> None:
    """Clean up leftover .exe.bak from a previous rename-based update."""
    exe = _win_find_exe()
    if exe:
        bak = exe.with_suffix(".exe.bak")
        try:
            if bak.exists():
                bak.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Preemptive unlock: rename exe BEFORE pip/uv to avoid lock entirely
# ---------------------------------------------------------------------------

def win_preemptive_unlock() -> Path | None:
    """Preemptively rename helloagents.exe → .exe.bak before pip/uv operations.

    Windows locks a running .exe, preventing pip/uv from overwriting it.
    By renaming first, the original path is freed for pip/uv to write to.

    Returns the .bak Path if renamed successfully, None otherwise.
    Caller MUST call win_finish_unlock() after the operation completes.
    """
    if sys.platform != "win32":
        return None

    exe = _win_find_exe()
    if not exe:
        return None

    bak = exe.with_suffix(".exe.bak")
    try:
        # Clean up stale .bak from previous runs
        if bak.exists():
            bak.unlink()
    except OSError:
        pass

    try:
        exe.rename(bak)
        return bak
    except OSError:
        return None


def win_finish_unlock(bak: Path | None, success: bool) -> None:
    """Clean up after preemptive unlock.

    On success: delete .bak (pip/uv already created a new exe).
    On failure: restore .bak → .exe so the command still works next time.
    """
    if bak is None:
        return

    exe = bak.with_suffix(".exe")
    if success:
        try:
            if bak.exists():
                bak.unlink()
        except OSError:
            pass  # caller should schedule deferred cleanup for uninstall
    else:
        try:
            if not exe.exists() and bak.exists():
                bak.rename(exe)
        except OSError:
            pass


def _win_schedule_exe_cleanup(bak: Path | None = None) -> None:
    """Schedule deletion of helloagents exe/bak after the current process exits.

    After ``_self_uninstall``, the running exe (or its ``.bak`` rename) cannot
    be deleted by the current process because Windows locks running executables.

    **Reuses the proven ``_win_deferred_pip`` mechanism**: a background
    ``pythonw.exe`` script that waits for the current PID to exit, then runs
    the cleanup command.  The cleanup command itself retries deletion up to 30
    times with 1-second intervals, handling the brief delay between
    ``python.exe`` exit and ``helloagents.exe`` launcher exit / file-lock
    release.

    Falls back to ``MoveFileExW(MOVEFILE_DELAY_UNTIL_REBOOT)`` as a
    belt-and-suspenders backup (schedules deletion on next system reboot).

    Args:
        bak: The ``.exe.bak`` path from ``win_preemptive_unlock()``, or
             ``None`` if the preemptive unlock was not performed / failed.
    """
    if sys.platform != "win32":
        return

    # Determine target files to clean up
    if bak is not None:
        targets = [bak, bak.with_suffix(".exe")]
    else:
        exe = _win_find_exe()
        if exe is None:
            exe = Path(sys.executable).parent / "Scripts" / "helloagents.exe"
        targets = [exe, exe.with_suffix(".exe.bak")]

    targets = [str(t) for t in targets if t.exists()]
    if not targets:
        return

    # --- Layer 1: reuse _win_deferred_pip (proven mechanism) ---
    # Build a Python -c script that retries deletion up to 30 times.
    # _win_deferred_pip waits for our PID (python.exe) to exit first;
    # the retry loop handles the brief extra delay before helloagents.exe
    # (the parent launcher that holds the file lock) fully exits.
    cleanup_script = (
        "import os,time\n"
        f"T={targets!r}\n"
        "for _ in range(30):\n"
        " R=[p for p in T if os.path.exists(p)]\n"
        " if not R: break\n"
        " for p in R:\n"
        "  try: os.unlink(p)\n"
        "  except OSError: pass\n"
        " time.sleep(1)\n"
    )
    _win_deferred_pip([sys.executable, "-c", cleanup_script])

    # --- Layer 2: MoveFileEx fallback (schedules deletion on next reboot) ---
    try:
        import ctypes
        for t in targets:
            if Path(t).exists():
                ctypes.windll.kernel32.MoveFileExW(t, None, 0x4)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Safe rmtree: rename-aside fallback for locked directories
# ---------------------------------------------------------------------------

def win_safe_rmtree(path: Path) -> bool:
    """Remove a directory tree, with rename-aside fallback on Windows.

    If shutil.rmtree fails (e.g. a CLI process holds files open),
    rename the directory to a ~name.old.PID.TIMESTAMP suffix so the original
    path is freed. Stale .old directories are cleaned up automatically.

    Returns True if the path no longer exists (removed or renamed aside).
    """
    if not path.exists():
        return True

    # First, clean up any stale .old directories from previous runs
    _cleanup_old_dirs(path.parent, path.name)

    try:
        shutil.rmtree(path)
        return True
    except OSError:
        if sys.platform != "win32":
            return False

    # Rename-aside: free the original path
    import os
    import time
    suffix = f"{os.getpid()}.{int(time.time())}"
    aside = path.with_name(f"~{path.name}.old.{suffix}")
    try:
        path.rename(aside)
        return True
    except OSError:
        return False


def _cleanup_old_dirs(parent: Path, base_name: str) -> None:
    """Clean up stale ~name.old.* directories from previous rename-aside ops."""
    if not parent.exists():
        return
    prefix = f"~{base_name}.old."
    for item in parent.iterdir():
        if item.is_dir() and item.name.startswith(prefix):
            try:
                shutil.rmtree(item)
            except OSError:
                pass  # still locked, will be cleaned next time


def _win_deferred_pip(pip_args: list[str],
                      post_cmds: list[list[str]] | None = None) -> bool:
    """Schedule a pip command to run after the current process exits (Windows).

    Creates a temporary .pyw script that:
    1. Waits for the current process to exit (polls PID)
    2. Runs the specified pip command
    3. Optionally runs post-commands (e.g., re-sync CLI targets)
    4. Self-deletes

    Uses pythonw.exe (GUI-mode Python, no console) to ensure completely
    silent execution without any visible window or AV false positives.

    Returns True if the deferred command was scheduled successfully.
    """
    import os
    import subprocess
    import tempfile

    pid = os.getpid()
    python_exe = sys.executable

    # Prefer pythonw.exe (GUI, no console window) over python.exe
    # Use case-insensitive matching (Windows may have Python.EXE etc.)
    exe_name_lower = Path(python_exe).name.lower()
    if exe_name_lower == "python.exe":
        pythonw_name = "pythonw.exe"
    else:
        pythonw_name = exe_name_lower.replace("python", "pythonw")
    pythonw = Path(python_exe).with_name(pythonw_name)
    if not pythonw.exists():
        pythonw = Path(python_exe)  # fallback to python.exe

    # Build the deferred Python script
    no_window = "0x08000000"  # CREATE_NO_WINDOW
    script_lines = [
        "import subprocess, sys, os, time",
        "",
        f"pid = {pid}",
        "",
        "# Wait for parent process to exit",
        "while True:",
        "    r = subprocess.run(",
        '        ["tasklist", "/fi", f"PID eq {pid}", "/nh"],',
        f"        capture_output=True, text=True, creationflags={no_window},",
        "    )",
        "    if str(pid) not in r.stdout:",
        "        break",
        "    time.sleep(1)",
        "",
        "# Run pip command",
        f"subprocess.run({pip_args!r}, creationflags={no_window})",
    ]

    if post_cmds:
        script_lines.append("")
        script_lines.append("# Post-commands (e.g. sync CLI targets)")
        for cmd in post_cmds:
            script_lines.append(
                f"subprocess.run({cmd!r}, creationflags={no_window})")

    script_lines += [
        "",
        "# Self-delete",
        "try:",
        "    os.unlink(sys.argv[0])",
        "except OSError:",
        "    pass",
    ]

    try:
        fd, script_path = tempfile.mkstemp(suffix=".pyw", prefix="helloagents_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("\n".join(script_lines))

        subprocess.Popen(
            [str(pythonw), script_path],
            creationflags=0x08000000,  # CREATE_NO_WINDOW fallback for python.exe
        )
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Deduplicated helpers (were duplicated in installer.py and updater.py)
# ---------------------------------------------------------------------------

def build_pip_cleanup_cmd() -> list[str]:
    """Build a command to clean up ~prefixed pip remnant directories.

    Returns a subprocess-ready command list that runs an inline Python script
    to remove corrupted pip remnants from site-packages.
    """
    return [
        sys.executable, "-c",
        "import shutil,pathlib,site;"
        "[shutil.rmtree(p,ignore_errors=True) "
        "for d in site.getsitepackages() "
        "if pathlib.Path(d).is_dir() "
        "for p in pathlib.Path(d).iterdir() "
        "if p.is_dir() and p.name.startswith('~')]",
    ]


def win_exe_retry(cmd: list[str], label: str = "pip") -> tuple[bool, str]:
    """Rename helloagents.exe → .exe.bak, retry command, restore on failure.

    This handles the Windows .exe file locking issue where pip cannot
    overwrite a running executable.

    Args:
        cmd: The subprocess command to retry after renaming.
        label: Label for success messages (e.g. "pip").

    Returns:
        (success, stderr) — success is True if retry succeeded.
    """
    import subprocess

    exe = _win_find_exe()
    if not exe:
        return False, ""

    bak = exe.with_suffix(".exe.bak")
    try:
        exe.rename(bak)
    except OSError:
        return False, ""

    print(_msg("  .exe 文件已锁定，重命名后重试...",
               "  .exe file locked, renamed and retrying..."))
    retry = subprocess.run(cmd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
    if retry.returncode == 0:
        print(_msg(f"  ✓ 包更新完成 ({label})", f"  ✓ Package updated ({label})"))
        try:
            bak.unlink()
        except OSError:
            pass  # will be cleaned up on next run
        return True, ""

    # Restore original exe on failure
    try:
        bak.rename(exe)
    except OSError:
        pass
    return False, retry.stderr.strip() if retry.stderr else ""

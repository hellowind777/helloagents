"""HelloAGENTS Installer - Install operations (v3 architecture).

Deployment model:
1. Deploy core files to ~/.helloagents/ (independent, shared across CLIs)
2. Inject bootstrap (~30 lines) into each CLI's rules file
3. Create symlinks from CLI skills dirs to ~/.helloagents/skills/
4. CLI-specific post-install (hooks, agent defs, etc.)
"""

import shutil
from pathlib import Path

from .._common import (
    _msg,
    CLI_TARGETS, HELLOAGENTS_HOME,
    is_helloagents_file, backup_user_file,
    get_helloagents_module_path,
    detect_installed_clis, create_symlink,
)
from .cli_adapters import (
    deploy_bootstrap,
    configure_claude_hooks, configure_claude_permissions,
    configure_claude_auto_memory,
    configure_codex_all,
    configure_gemini_hooks, configure_qwen_hooks, configure_grok_hooks,
)
from .win_helpers import win_safe_rmtree


def _deploy_home(module_src: Path) -> None:
    """Deploy skills, templates, scripts, user to ~/.helloagents/."""
    import tempfile
    home = HELLOAGENTS_HOME
    home.mkdir(parents=True, exist_ok=True)

    _user_bak: Path | None = None
    _user_src = home / "user"
    if _user_src.exists():
        _user_bak = Path(tempfile.mkdtemp()) / "user"
        shutil.copytree(_user_src, _user_bak)

    for dirname in ("skills", "templates", "scripts", "user"):
        src = module_src / dirname
        dest = home / dirname
        if not src.exists():
            continue
        if dest.exists():
            win_safe_rmtree(dest)
        shutil.copytree(src, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    bootstrap_src = module_src / "bootstrap.md"
    if bootstrap_src.exists():
        shutil.copy2(bootstrap_src, home / "bootstrap.md")

    if _user_bak and _user_bak.exists():
        _target = home / "user"
        for _f in _user_bak.rglob("*"):
            if not _f.is_file() or _f.name.startswith("_") or _f.name == ".gitkeep":
                continue
            _rel = _f.relative_to(_user_bak)
            _dest = _target / _rel
            _dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(_f, _dest)
        shutil.rmtree(_user_bak.parent)

    print(_msg(f"  已部署核心文件到: {home}", f"  Deployed core files to: {home}"))


def install(target: str) -> bool:
    """Install HelloAGENTS to a specific CLI."""
    if target not in CLI_TARGETS:
        print(_msg(f"  未知目标: {target}", f"  Unknown target: {target}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]

    if config.get("status") == "experimental":
        print(_msg(f"  ℹ️ {target} 为实验性/社区项目。",
                   f"  ℹ️ {target} is experimental/community."))

    dest_dir.mkdir(parents=True, exist_ok=True)
    module_src = get_helloagents_module_path()
    rules_dest = dest_dir / rules_file

    print(_msg(f"  正在安装 HelloAGENTS 到 {target}...",
               f"  Installing HelloAGENTS to {target}..."))

    _deploy_home(module_src)

    bootstrap_src = module_src / "bootstrap.md"
    if rules_dest.exists() and not is_helloagents_file(rules_dest):
        backup = backup_user_file(rules_dest)
        print(_msg(f"  已备份: {backup}", f"  Backed up: {backup}"))
    deploy_bootstrap(dest_dir, bootstrap_src, rules_file)
    print(_msg(f"  已部署规则: {rules_dest}", f"  Deployed rules: {rules_dest}"))

    skills_target = HELLOAGENTS_HOME / "skills"
    skills_link = dest_dir / "skills" / "helloagents"
    if create_symlink(skills_target, skills_link):
        print(_msg(f"  已创建技能链接: {skills_link}",
                   f"  Created skills link: {skills_link}"))
    else:
        skills_link.parent.mkdir(parents=True, exist_ok=True)
        if skills_link.exists():
            win_safe_rmtree(skills_link)
        shutil.copytree(skills_target, skills_link)
        print(_msg(f"  已复制技能目录: {skills_link}",
                   f"  Copied skills dir: {skills_link}"))

    print(_msg(f"  {target} 安装完成！", f"  Installation complete for {target}!"))

    _POST_INSTALL = {
        "claude": [
            (configure_claude_hooks, "Hooks", "Hooks"),
            (configure_claude_permissions, "工具权限", "tool permissions"),
            (configure_claude_auto_memory, "autoMemory", "autoMemory"),
        ],
        "codex": [
            (configure_codex_all, "config.toml", "config.toml"),
        ],
        "gemini": [(configure_gemini_hooks, "Hooks", "Hooks")],
        "qwen": [(configure_qwen_hooks, "Hooks", "Hooks")],
        "grok": [(configure_grok_hooks, "Hooks", "Hooks")],
    }
    for fn, cn_label, en_label in _POST_INSTALL.get(target, []):
        try:
            fn(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ {cn_label}: {e}", f"  ⚠ {en_label}: {e}"))

    return True


def install_all() -> bool:
    """Install to all detected CLI directories."""
    detected = detect_installed_clis()
    if not detected:
        print(_msg("  未检测到 CLI 目录。", "  No CLI directories detected."))
        return False
    print(_msg(f"  检测到: {', '.join(detected)}", f"  Detected: {', '.join(detected)}"))
    failed = [t for t in detected if not install(t)]
    if failed:
        print(_msg(f"  失败: {', '.join(failed)}", f"  Failed: {', '.join(failed)}"))
        return False
    return True

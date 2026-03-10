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
    CLI_TARGETS, AGENT_PREFIX, HELLOAGENTS_HOME,
    is_helloagents_file, is_helloagents_rule, backup_user_file,
    get_helloagents_module_path,
    detect_installed_clis, clean_skills_dir, create_symlink,
)
from .cli_adapters import (
    deploy_bootstrap, cleanup_codex_agents_dotted,
    configure_claude_hooks, configure_claude_permissions,
    configure_claude_auto_memory,
    configure_codex_toml, configure_codex_csv_batch,
    configure_codex_notify, configure_codex_tui_notification,
    configure_codex_developer_instructions, configure_codex_agent_roles,
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


def _deploy_agent_files(dest_dir: Path) -> None:
    """Deploy HelloAGENTS agent definition files to ~/.claude/agents/."""
    agents_src = get_helloagents_module_path() / "agents"
    if not agents_src.exists():
        return
    agents_dest = dest_dir / "agents"
    agents_dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for src_file in agents_src.glob(f"{AGENT_PREFIX}*.md"):
        shutil.copy2(src_file, agents_dest / src_file.name)
        count += 1
    if count:
        print(_msg(f"  已部署 {count} 个子代理定义 ({agents_dest})",
                   f"  Deployed {count} agent definition(s) ({agents_dest})"))


def _clean_v2_remnants(dest_dir: Path) -> list[str]:
    """Remove remnants from v2 installations."""
    removed = []
    try:
        removed.extend(clean_skills_dir(dest_dir))
    except Exception:
        pass

    all_rules_files = {cfg["rules_file"] for cfg in CLI_TARGETS.values()}
    for name in all_rules_files:
        stale_path = dest_dir / name
        if stale_path.exists() and stale_path.is_file() and is_helloagents_file(stale_path):
            stale_path.unlink()
            removed.append(str(stale_path))

    from .._common import PLUGIN_DIR_NAME
    plugin_dir = dest_dir / PLUGIN_DIR_NAME
    if plugin_dir.exists():
        if win_safe_rmtree(plugin_dir):
            removed.append(str(plugin_dir))

    rules_ha_dir = dest_dir / "rules" / "helloagents"
    if rules_ha_dir.exists():
        for f in rules_ha_dir.glob("*.md"):
            if is_helloagents_rule(f):
                f.unlink()
                removed.append(f"{f}")
        if rules_ha_dir.exists() and not any(rules_ha_dir.iterdir()):
            rules_ha_dir.rmdir()

    config_toml = dest_dir / "config.toml"
    if config_toml.exists():
        content = config_toml.read_text(encoding="utf-8")
        cleaned, did_clean = cleanup_codex_agents_dotted(content)
        if did_clean:
            config_toml.write_text(cleaned, encoding="utf-8")
            removed.append("config.toml dotted agents.xxx keys")

    return removed


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

    removed = _clean_v2_remnants(dest_dir)
    if removed:
        print(_msg(f"  清理了 {len(removed)} 个旧版文件",
                   f"  Cleaned {len(removed)} legacy file(s)"))

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

    if target == "claude":
        _deploy_agent_files(dest_dir)

    print(_msg(f"  {target} 安装完成！", f"  Installation complete for {target}!"))

    _POST_INSTALL = {
        "claude": [
            (configure_claude_hooks, "Hooks", "Hooks"),
            (configure_claude_permissions, "工具权限", "tool permissions"),
            (configure_claude_auto_memory, "autoMemory", "autoMemory"),
        ],
        "codex": [
            (configure_codex_toml, "config.toml", "config.toml"),
            (configure_codex_notify, "notify hook", "notify hook"),
            (configure_codex_tui_notification, "TUI 通知方式", "TUI notification"),
            (configure_codex_csv_batch, "CSV 批处理", "CSV batch"),
            (configure_codex_agent_roles, "子代理角色", "agent roles"),
            (configure_codex_developer_instructions, "developer_instructions", "developer_instructions"),
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

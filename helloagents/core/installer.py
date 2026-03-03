"""HelloAGENTS Installer - Install operations."""

import shutil
from pathlib import Path

from .._common import (
    _msg,
    CLI_TARGETS, PLUGIN_DIR_NAME, AGENT_PREFIX,
    is_helloagents_file, is_helloagents_rule, backup_user_file,
    get_agents_md_path, get_skill_md_path, get_helloagents_module_path,
    detect_installed_clis,
)
from .codex_config import (
    _configure_codex_toml, _configure_codex_csv_batch,
    _configure_codex_notify,
    _configure_codex_developer_instructions,
    _configure_codex_memories,
    _cleanup_codex_agents_dotted,
)
from .claude_config import (
    _configure_claude_hooks,
    _configure_claude_permissions,
    _configure_claude_auto_memory,
    _deploy_claude_rules,
)
from .settings_hooks import (
    _configure_gemini_hooks, _configure_qwen_hooks, _configure_grok_hooks,
)
from .win_helpers import win_safe_rmtree


# ---------------------------------------------------------------------------
# Agent definition files (Claude Code only)
# ---------------------------------------------------------------------------



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


# ---------------------------------------------------------------------------
# File cleanup
# ---------------------------------------------------------------------------

def clean_stale_files(dest_dir: Path, current_rules_file: str) -> list[str]:
    """Remove stale files from previous HelloAGENTS versions.

    Handles both current-version stale files and legacy (pre-v2.2) remnants.
    Only removes files confirmed to be HelloAGENTS-related.

    Args:
        dest_dir: CLI config directory (e.g. ~/.claude/).
        current_rules_file: Rules file name for this CLI target.

    Returns:
        List of removed file/directory paths.
    """
    removed = []

    # --- Clean skills/helloagents/ directory (will be re-deployed fresh if needed) ---
    legacy_skills_dir = dest_dir / "skills" / "helloagents"
    if legacy_skills_dir.exists():
        if win_safe_rmtree(legacy_skills_dir):
            removed.append(f"{legacy_skills_dir} (stale)")
            skills_parent = dest_dir / "skills"
            if skills_parent.exists() and not any(skills_parent.iterdir()):
                skills_parent.rmdir()
                removed.append(f"{skills_parent} (empty parent)")

    # --- Current-version stale rules files ---
    # Only removes files confirmed to be HelloAGENTS-related (is_helloagents_file check).
    # User-created files with the same name but without HELLOAGENTS_MARKER are never touched.
    all_rules_files = {cfg["rules_file"] for cfg in CLI_TARGETS.values()}
    stale_rules = all_rules_files - {current_rules_file}
    for name in stale_rules:
        stale_path = dest_dir / name
        if stale_path.exists() and stale_path.is_file():
            if is_helloagents_file(stale_path):
                stale_path.unlink()
                removed.append(str(stale_path))

    # --- __pycache__ under helloagents plugin dir ---
    plugin_dir = dest_dir / PLUGIN_DIR_NAME
    if plugin_dir.exists():
        for cache_dir in plugin_dir.rglob("__pycache__"):
            if cache_dir.is_dir():
                if win_safe_rmtree(cache_dir):
                    removed.append(str(cache_dir))

    # --- Clean stale rules/helloagents/ split rule files ---
    rules_ha_dir = dest_dir / "rules" / "helloagents"
    if rules_ha_dir.exists():
        for f in rules_ha_dir.glob("*.md"):
            if is_helloagents_rule(f):
                try:
                    f.unlink()
                    removed.append(f"{f} (stale rule)")
                except Exception:
                    pass
        if rules_ha_dir.exists() and not any(rules_ha_dir.iterdir()):
            rules_ha_dir.rmdir()
            removed.append(f"{rules_ha_dir} (empty)")

    # --- Clean dotted agents.xxx keys in config.toml (Codex) ---
    config_toml = dest_dir / "config.toml"
    if config_toml.exists():
        try:
            content = config_toml.read_text(encoding="utf-8")
            cleaned, did_clean = _cleanup_codex_agents_dotted(content)
            if did_clean:
                config_toml.write_text(cleaned, encoding="utf-8")
                removed.append("config.toml dotted agents.xxx keys (migrated to [agents])")
        except Exception:
            pass

    return removed


# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

def install(target: str) -> bool:
    """Install HelloAGENTS to a specific CLI."""
    if target not in CLI_TARGETS:
        print(_msg(f"  未知目标: {target}", f"  Unknown target: {target}"))
        print(_msg(f"  可用目标: {', '.join(CLI_TARGETS.keys())}",
                   f"  Available targets: {', '.join(CLI_TARGETS.keys())}"))
        return False

    config = CLI_TARGETS[target]
    dest_dir = Path.home() / config["dir"]
    rules_file = config["rules_file"]

    if not dest_dir.exists():
        print(_msg(f"  警告: {dest_dir} 不存在，{target} CLI 可能未安装。",
                   f"  Warning: {dest_dir} does not exist. {target} CLI may not be installed."))
    dest_dir.mkdir(parents=True, exist_ok=True)

    agents_md_src = get_agents_md_path()
    module_src = get_helloagents_module_path()
    plugin_dest = dest_dir / PLUGIN_DIR_NAME
    rules_dest = dest_dir / rules_file

    print(_msg(f"  正在安装 HelloAGENTS 到 {target}...",
               f"  Installing HelloAGENTS to {target}..."))
    print(_msg(f"  目标目录: {dest_dir}", f"  Target directory: {dest_dir}"))

    # Clean stale files
    removed = clean_stale_files(dest_dir, rules_file)
    if removed:
        print(_msg(f"  清理了 {len(removed)} 个过期文件:",
                   f"  Cleaned {len(removed)} stale file(s):"))
        for r in removed:
            print(f"    - {r}")

    try:
        # Preserve user/ directory (contains user preferences, not overwritable)
        user_dir = plugin_dest / "user"
        user_backup = None
        if user_dir.exists():
            import tempfile
            user_backup = Path(tempfile.mkdtemp()) / "user"
            shutil.copytree(user_dir, user_backup)

        # Remove old module directory completely before copying
        if plugin_dest.exists():
            if not win_safe_rmtree(plugin_dest):
                print(_msg(f"  ✗ 无法移除旧模块（可能被 CLI 进程占用）: {plugin_dest}",
                           f"  ✗ Cannot remove old module (may be locked by CLI): {plugin_dest}"))
                return False
            print(_msg(f"  已移除旧模块: {plugin_dest}",
                       f"  Removed old module: {plugin_dest}"))

        # Copy new module directory
        shutil.copytree(
            module_src, plugin_dest,
            ignore=shutil.ignore_patterns(
                "__pycache__", "*.pyc", "hooks", "agents",
                "core",         # CLI management modules (not needed at deploy target)
                "cli.py", "__main__.py",  # CLI entry points
            ),
        )
        print(_msg(f"  已安装模块到: {plugin_dest}",
                   f"  Installed module to: {plugin_dest}"))

        # Restore user/ directory (overwrite template with user data)
        if user_backup and user_backup.exists():
            target_user = plugin_dest / "user"
            if target_user.exists():
                shutil.rmtree(target_user)
            shutil.copytree(user_backup, target_user)
            shutil.rmtree(user_backup.parent)

        # Deploy rules
        if agents_md_src.exists():
            if target == "claude":
                # Split deployment for Claude Code (avoid 40k char warning)
                if rules_dest.exists() and not is_helloagents_file(rules_dest):
                    backup = backup_user_file(rules_dest)
                    print(_msg(f"  已备份现有规则到: {backup}",
                               f"  Backed up existing rules to: {backup}"))
                count = _deploy_claude_rules(dest_dir, agents_md_src)
                print(_msg(f"  已部署拆分规则: {count} 个文件 (CLAUDE.md + rules/helloagents/)",
                           f"  Deployed split rules: {count} file(s) (CLAUDE.md + rules/helloagents/)"))
            else:
                if rules_dest.exists():
                    if is_helloagents_file(rules_dest):
                        shutil.copy2(agents_md_src, rules_dest)
                        print(_msg(f"  已更新规则: {rules_dest}",
                                   f"  Updated rules: {rules_dest}"))
                    else:
                        backup = backup_user_file(rules_dest)
                        print(_msg(f"  已备份现有规则到: {backup}",
                                   f"  Backed up existing rules to: {backup}"))
                        shutil.copy2(agents_md_src, rules_dest)
                        print(_msg(f"  已安装规则到: {rules_dest}",
                                   f"  Installed rules to: {rules_dest}"))
                else:
                    shutil.copy2(agents_md_src, rules_dest)
                    print(_msg(f"  已安装规则到: {rules_dest}",
                               f"  Installed rules to: {rules_dest}"))
        else:
            print(_msg(f"  警告: 未找到 AGENTS.md ({agents_md_src})",
                       f"  Warning: AGENTS.md not found at {agents_md_src}"))

        # Deploy SKILL.md to skills discovery directory
        skill_md_src = get_skill_md_path()
        if skill_md_src.exists():
            skill_dest_dir = dest_dir / "skills" / "helloagents"
            skill_dest = skill_dest_dir / "SKILL.md"
            skill_dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(skill_md_src, skill_dest)
            print(_msg(f"  已部署技能: {skill_dest}",
                       f"  Deployed skill: {skill_dest}"))

        # Deploy agent definition files (Claude Code only)
        if target == "claude":
            _deploy_agent_files(dest_dir)
    except Exception as e:
        # Clean up temp directory on failure
        if user_backup and user_backup.parent.exists():
            shutil.rmtree(user_backup.parent, ignore_errors=True)
        print(_msg(f"  ✗ 安装失败: {e}", f"  ✗ Installation failed: {e}"))
        return False

    print(_msg(f"  {target} 安装完成！请重启终端以应用更改。",
               f"  Installation complete for {target}! Please restart your terminal to apply changes."))
    config_path = Path.home() / ".helloagents" / "config.json"
    if not config_path.exists():
        print(_msg("  ℹ 个性化配置可写入 ~/.helloagents/config.json，更新时不会被覆盖。",
                   "  ℹ Custom settings can be saved to ~/.helloagents/config.json (preserved across updates)."))

    # Target-specific post-install: hooks & config
    _POST_INSTALL = {
        "claude": [
            (_configure_claude_hooks,       "Hooks",       "Hooks"),
            (_configure_claude_permissions, "工具权限",    "tool permissions"),
            (_configure_claude_auto_memory, "autoMemory",  "autoMemory"),
        ],
        "codex": [
            (_configure_codex_toml,                   "config.toml",              "config.toml"),
            (_configure_codex_notify,                 "notify hook",              "notify hook"),
            (_configure_codex_csv_batch,              "CSV 批处理",              "CSV batch"),
            (_configure_codex_developer_instructions, "developer_instructions",   "developer_instructions"),
            (_configure_codex_memories,               "[memories]",               "[memories]"),
        ],
        "gemini": [
            (_configure_gemini_hooks, "Hooks", "Hooks"),
        ],
        "qwen": [
            (_configure_qwen_hooks, "Hooks", "Hooks"),
        ],
        "grok": [
            (_configure_grok_hooks, "Hooks", "Hooks"),
        ],
    }
    for fn, cn_label, en_label in _POST_INSTALL.get(target, []):
        try:
            fn(dest_dir)
        except Exception as e:
            print(_msg(f"  ⚠ 配置 {cn_label} 时出错: {e}",
                       f"  ⚠ Error configuring {en_label}: {e}"))

    if target == "codex":
        print(_msg("  提示: 需在 Codex CLI 中执行 /experimental 开启多代理功能。",
                   "  Note: Run /experimental in Codex CLI to enable multi-agent features."))
        print(_msg("  提示: VS Code Codex 插件对 HelloAGENTS 系统的支持可能与 CLI 不同，建议优先在 Codex CLI 中使用。",
                   "  Note: VS Code Codex plugin may not fully support HelloAGENTS. Codex CLI is recommended."))

    return True


def install_all() -> bool:
    """Install to all detected CLI directories."""
    detected = detect_installed_clis()
    if not detected:
        print(_msg("  未检测到 CLI 目录。", "  No CLI directories detected."))
        print(_msg(f"  支持的 CLI: {', '.join(CLI_TARGETS.keys())}",
                   f"  Supported CLIs: {', '.join(CLI_TARGETS.keys())}"))
        return False

    print(_msg(f"  检测到的 CLI: {', '.join(detected)}",
               f"  Detected CLIs: {', '.join(detected)}"))
    failed = []
    for target in detected:
        if not install(target):
            failed.append(target)
        print()

    if failed:
        print(_msg(f"  失败: {', '.join(failed)}", f"  Failed: {', '.join(failed)}"))
        return False
    return True

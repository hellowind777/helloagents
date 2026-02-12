"""HelloAGENTS Interactive - Interactive install and uninstall menus."""

from .cli import (
    _msg, _header,
    CLI_TARGETS,
    detect_installed_clis, _detect_installed_targets, _detect_install_method,
)
from .installer import install, uninstall, _self_uninstall


# ---------------------------------------------------------------------------
# Interactive install
# ---------------------------------------------------------------------------

def _interactive_install() -> bool:
    """Show interactive menu for selecting CLI targets to install."""
    targets = list(CLI_TARGETS.keys())
    detected = detect_installed_clis()
    installed = _detect_installed_targets()

    _header(_msg("步骤 1/3: 选择目标", "Step 1/3: Select Targets"))

    for i, name in enumerate(targets, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        if name in installed:
            tag = _msg("[已安装 HelloAGENTS]", "[HelloAGENTS installed]")
        elif name in detected:
            tag = _msg("[已检测到该工具]", "[tool found]")
        else:
            tag = ""
        print(f"  [{i}] {name:10} {dir_path:20} {tag}")

    print()
    prompt = _msg(
        "  请输入编号，可多选（如 1 3 5）或 all 全选，直接回车跳过: ",
        "  Enter numbers, multi-select supported (e.g. 1 3 5) or 'all', press Enter to skip: ",
    )

    try:
        choice = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        print(_msg("  已取消。", "  Cancelled."))
        return True

    if not choice:
        print(_msg("  已跳过安装。", "  Skipped."))
        return True

    if choice.lower() == "all":
        selected = targets
    else:
        nums = choice.replace(",", " ").split()
        seen = set()
        selected = []
        for n in nums:
            try:
                idx = int(n)
                if 1 <= idx <= len(targets):
                    name = targets[idx - 1]
                    if name not in seen:
                        seen.add(name)
                        selected.append(name)
                else:
                    print(_msg(f"  忽略无效编号: {n}",
                               f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}",
                           f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    _header(_msg(f"步骤 2/3: 执行安装（共 {len(selected)} 个目标）",
                 f"Step 2/3: Installing ({len(selected)} target(s))"))

    results = {}
    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}",
                   f"  [{i}/{len(selected)}] {t}"))
        results[t] = install(t)
        print()

    _header(_msg("步骤 3/3: 安装结果", "Step 3/3: Installation Summary"))
    for t, ok in results.items():
        mark = "✓" if ok else "✗"
        status_text = _msg("成功", "OK") if ok else _msg("失败", "FAILED")
        print(f"  {mark} {t:10} {status_text}")

    succeeded = sum(1 for v in results.values() if v)
    failed_count = len(results) - succeeded
    print()
    if failed_count:
        print(_msg(f"  共 {succeeded} 个成功，{failed_count} 个失败。",
                   f"  {succeeded} succeeded, {failed_count} failed."))
        return False
    print(_msg(
        f"  共 {succeeded} 个目标安装成功。请重启终端以应用更改。",
        f"  All {succeeded} target(s) installed successfully. "
        f"Please restart your terminal to apply changes."))
    return True


# ---------------------------------------------------------------------------
# Interactive uninstall
# ---------------------------------------------------------------------------

def _interactive_uninstall() -> bool:
    """Show interactive menu for selecting CLI targets to uninstall."""
    installed = _detect_installed_targets()
    if not installed:
        print(_msg("  未检测到已安装的 CLI 目标。",
                   "  No installed CLI targets detected."))
        return True

    _header(_msg("步骤 1/3: 选择要卸载的目标",
                 "Step 1/3: Select Targets to Uninstall"))

    for i, name in enumerate(installed, 1):
        config = CLI_TARGETS[name]
        dir_path = f"~/{config['dir']}/"
        print(f"  [{i}] {name:10} {dir_path}")

    print()
    prompt = _msg(
        "  请输入要卸载的编号，可多选（如 1 3 5）或 all 全选，直接回车跳过: ",
        "  Enter numbers to uninstall, multi-select supported (e.g. 1 3 5) "
        "or 'all', press Enter to skip: ",
    )

    try:
        choice = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        print(_msg("  已取消。", "  Cancelled."))
        return True

    if not choice:
        print(_msg("  已跳过。", "  Skipped."))
        return True

    if choice.lower() == "all":
        selected = installed
    else:
        nums = choice.replace(",", " ").split()
        seen = set()
        selected = []
        for n in nums:
            try:
                idx = int(n)
                if 1 <= idx <= len(installed):
                    name = installed[idx - 1]
                    if name not in seen:
                        seen.add(name)
                        selected.append(name)
                else:
                    print(_msg(f"  忽略无效编号: {n}",
                               f"  Ignoring invalid number: {n}"))
            except ValueError:
                print(_msg(f"  忽略无效输入: {n}",
                           f"  Ignoring invalid input: {n}"))

    if not selected:
        print(_msg("  未选择任何目标。", "  No targets selected."))
        return True

    # Determine whether we'll offer to remove the package itself
    remaining_after = set(_detect_installed_targets()) - set(selected)

    _header(_msg(f"步骤 2/3: 执行卸载（共 {len(selected)} 个目标）",
                 f"Step 2/3: Uninstalling ({len(selected)} target(s))"))

    for i, t in enumerate(selected, 1):
        print(_msg(f"  [{i}/{len(selected)}] {t}",
                   f"  [{i}/{len(selected)}] {t}"))
        uninstall(t, show_package_hint=False)
        print()

    _header(_msg("步骤 3/3: 卸载结果",
                 "Step 3/3: Uninstall Summary"))
    for t in selected:
        print(f"  ✓ {t:10} {_msg('已卸载', 'removed')}")

    print()
    print(_msg(f"  共卸载 {len(selected)} 个目标。请重启终端以应用更改。",
               f"  {len(selected)} target(s) uninstalled. "
               f"Please restart your terminal to apply changes."))

    # If no CLI targets remain, offer to remove the package itself
    if not remaining_after:
        _header(_msg("附加: 移除 helloagents 包",
                     "Extra: Remove helloagents Package"))

        print(_msg("  已无已安装的 CLI 目标。是否同时移除 helloagents 包本身？",
                   "  No installed CLI targets remaining. "
                   "Also remove the helloagents package itself?"))
        print()
        print(_msg("  [1] 是，彻底移除", "  [1] Yes, remove completely"))
        print(_msg("  [2] 否，仅卸载 CLI 目标",
                   "  [2] No, only uninstall CLI targets"))
        print()

        prompt = _msg("  请输入编号（直接回车跳过）: ",
                      "  Enter number (press Enter to skip): ")
        try:
            purge_choice = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            purge_choice = ""

        if purge_choice == "1":
            _self_uninstall()
        else:
            method = _detect_install_method()
            print(_msg("  如需稍后移除，请执行:",
                       "  To remove later, run:"))
            if method == "uv":
                print("    uv tool uninstall helloagents")
            else:
                print("    pip uninstall helloagents")

    return True

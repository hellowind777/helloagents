#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
迁移 HelloAGENTS 方案包到 archive/

Usage:
    python migrate_package.py <package-name> [--path <base-path>] [--status <completed|skipped>]

Examples:
    python migrate_package.py 202512191430_login
    python migrate_package.py 202512191430_login --status skipped
    python migrate_package.py --all --status skipped
"""

import argparse
import re
import shutil
import sys
from pathlib import Path
from datetime import datetime

# 确保能找到同目录下的 utils 模块
sys.path.insert(0, str(Path(__file__).parent))
from utils import (
    setup_encoding,
    get_plan_path,
    get_archive_path,
    parse_package_name,
    get_year_month,
    list_packages,
    print_error,
    print_success,
    script_error_handler,
    validate_base_path,
    get_template_loader,
    ExecutionReport
)


def update_task_status(task_file: Path, status: str):
    """
    更新 tasks.md 的状态备注

    Args:
        task_file: tasks.md 文件路径
        status: 状态类型 (completed/skipped)
    """
    if not task_file.exists():
        return

    content = task_file.read_text(encoding='utf-8')
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 使用语言无关的标识符 @status（不会被翻译）
    if status == "completed":
        status_line = f"> **@status:** completed | {timestamp}"
    else:
        status_line = f"> **@status:** skipped | {timestamp}"

    # 检测是否已有状态备注（兼容新旧格式）
    status_pattern = r'^> \*\*(?:@status|Status|状态):\*\*'
    lines = content.split('\n')

    # 查找并替换已有的状态行
    found_status = False
    for i, line in enumerate(lines):
        if re.match(status_pattern, line):
            lines[i] = status_line
            found_status = True
            break

    if not found_status:
        # 在标题后插入
        if content.startswith('#'):
            # 找到第一个空行
            insert_pos = 1
            for i, line in enumerate(lines[1:], 1):
                if not line.strip():
                    insert_pos = i + 1
                    break
            lines.insert(insert_pos, status_line)
            lines.insert(insert_pos + 1, '')  # 添加空行
        else:
            lines.insert(0, status_line)
            lines.insert(1, '')

    content = '\n'.join(lines)
    task_file.write_text(content, encoding='utf-8')


def update_archive_index(archive_path: Path, package_name: str, status: str):
    """
    更新 archive/_index.md

    Args:
        archive_path: archive/ 目录路径
        package_name: 方案包名称
        status: 状态 (completed/skipped)
    """
    index_file = archive_path / "_index.md"

    # 解析方案包名称
    parsed = parse_package_name(package_name)
    if not parsed:
        return

    timestamp, feature = parsed
    year_month = get_year_month(timestamp)
    # 使用中文状态标识符，与模板一致（无空格格式）
    status_icon = "✅完成" if status == "completed" else "⏸未执行"

    # 新记录行（6列：时间戳、名称、类型、涉及模块、决策、结果）
    new_entry = f"| {timestamp} | {feature} | - | - | - | {status_icon} |"

    if index_file.exists():
        content = index_file.read_text(encoding='utf-8')

        # 在索引表中插入新记录（表头之后）
        lines = content.split('\n')
        insert_pos = -1
        for i, line in enumerate(lines):
            # 检测表格分隔行（语言无关）
            if line.startswith('|') and '---' in line:
                insert_pos = i + 1
                break

        if insert_pos > 0 and insert_pos <= len(lines):
            lines.insert(insert_pos, new_entry)
            content = '\n'.join(lines)
        else:
            content += f"\n{new_entry}"
    else:
        # 创建新的 _index.md - 从模板加载
        loader = get_template_loader()
        template_content = loader.load("archive/_index.md")

        if template_content:
            # 在表格分隔行后插入新记录
            lines = template_content.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('|') and '---' in line:
                    lines.insert(i + 1, new_entry)
                    break
            content = '\n'.join(lines)
        else:
            raise FileNotFoundError("模板文件不存在: archive/_index.md")

    index_file.write_text(content, encoding='utf-8')


def migrate_package(package_path: Path, archive_base: Path, status: str = "completed") -> ExecutionReport:
    """
    迁移单个方案包到 archive/（支持 AI 降级接手）

    Args:
        package_path: 方案包源路径
        archive_base: archive/ 基础路径
        status: 迁移状态

    Returns:
        ExecutionReport: 执行报告
    """
    report = ExecutionReport("migrate_package")
    report.set_context(
        package_name=package_path.name,
        source_path=str(package_path),
        archive_base=str(archive_base),
        status=status
    )

    # 步骤1: 验证方案包存在
    if not package_path.exists():
        report.mark_failed(
            "验证方案包存在",
            ["迁移方案包"],
            f"方案包不存在: {package_path}"
        )
        return report

    report.mark_completed(
        "验证方案包存在",
        str(package_path),
        "检查源路径是否存在"
    )

    # 步骤2: 解析时间戳获取年月
    parsed = parse_package_name(package_path.name)
    if not parsed:
        # 使用当前年月
        year_month = datetime.now().strftime("%Y-%m")
        report.set_context(year_month=year_month, name_format_warning=True)
    else:
        year_month = get_year_month(parsed[0])
        report.set_context(year_month=year_month)

    # 步骤3: 创建目标目录
    target_dir = archive_base / year_month
    target_path = target_dir / package_path.name
    report.set_context(target_path=str(target_path))

    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        report.mark_completed(
            "创建归档目录",
            str(target_dir),
            "检查 archive/YYYY-MM/ 目录是否存在"
        )
    except PermissionError as e:
        report.mark_failed(
            "创建归档目录",
            ["创建归档目录", "更新 tasks.md 状态", "移动方案包", "更新 _index.md"],
            f"权限不足: {e}"
        )
        return report

    # 步骤4: 更新 tasks.md 状态
    task_file = package_path / "tasks.md"
    try:
        update_task_status(task_file, status)
        report.mark_completed(
            "更新 tasks.md 状态",
            str(task_file),
            "检查 tasks.md 中是否包含 @status 状态行"
        )
    except Exception as e:
        report.mark_failed(
            "更新 tasks.md 状态",
            ["更新 tasks.md 状态", "移动方案包", "更新 _index.md"],
            str(e)
        )
        return report

    # 步骤5: 移动方案包（覆盖已存在的）
    try:
        if target_path.exists():
            shutil.rmtree(target_path)
            report.set_context(overwritten=True)

        shutil.move(str(package_path), str(target_path))
        report.mark_completed(
            "移动方案包",
            str(target_path),
            "检查目标路径存在且源路径已删除"
        )
    except Exception as e:
        report.mark_failed(
            "移动方案包",
            ["移动方案包", "更新 _index.md"],
            str(e)
        )
        return report

    # 步骤6: 更新 _index.md
    try:
        update_archive_index(archive_base, package_path.name, status)
        report.mark_completed(
            "更新 _index.md",
            str(archive_base / "_index.md"),
            "检查 _index.md 中是否包含新迁移的方案包记录"
        )
    except FileNotFoundError as e:
        # 模板不存在的特殊情况
        report.mark_failed(
            "更新 _index.md",
            ["创建 _index.md（需包含表格：时间戳、名称、类型、涉及模块、决策、结果）"],
            str(e)
        )
        return report
    except Exception as e:
        report.mark_failed(
            "更新 _index.md",
            ["更新 _index.md"],
            str(e)
        )
        return report

    # 全部完成
    report.mark_success(str(target_path))
    return report


def main():
    setup_encoding()
    parser = argparse.ArgumentParser(
        description="迁移 HelloAGENTS 方案包到 archive/"
    )
    parser.add_argument(
        "package",
        nargs="?",
        help="方案包名称"
    )
    parser.add_argument(
        "--path",
        default=None,
        help="项目根目录 (默认: 当前目录)"
    )
    parser.add_argument(
        "--status",
        choices=["completed", "skipped"],
        default="completed",
        help="迁移状态: completed(已完成) 或 skipped(未执行)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="迁移 plan/ 中的所有方案包"
    )

    args = parser.parse_args()

    # 验证基础路径
    try:
        validate_base_path(args.path)
    except ValueError as e:
        report = ExecutionReport("migrate_package")
        report.mark_failed("验证基础路径", ["迁移方案包"], str(e))
        report.print_report()
        sys.exit(1)

    plan_path = get_plan_path(args.path)
    archive_path = get_archive_path(args.path)

    if args.all:
        # 迁移所有方案包 - 返回汇总报告
        packages = list_packages(plan_path)

        if not packages:
            report = ExecutionReport("migrate_package")
            report.set_context(mode="all", status=args.status)
            report.mark_success("plan/ 目录为空，无方案包需要迁移")
            report.print_report()
            sys.exit(0)

        # 汇总报告
        summary_report = ExecutionReport("migrate_package")
        summary_report.set_context(
            mode="all",
            status=args.status,
            total_packages=len(packages)
        )

        success_count = 0
        failed_packages = []

        for pkg in packages:
            pkg_report = migrate_package(pkg['path'], archive_path, args.status)
            if pkg_report.success:
                success_count += 1
                summary_report.mark_completed(
                    f"迁移 {pkg['name']}",
                    pkg_report.context.get("target_path", ""),
                    "检查目标路径存在"
                )
            else:
                failed_packages.append({
                    "name": pkg['name'],
                    "failed_at": pkg_report.failed_at,
                    "error": pkg_report.error_message
                })

        if failed_packages:
            summary_report.set_context(
                success_count=success_count,
                failed_packages=failed_packages
            )
            pending = [f"迁移 {p['name']}" for p in failed_packages]
            summary_report.mark_failed(
                f"批量迁移（{success_count}/{len(packages)} 成功）",
                pending,
                f"{len(failed_packages)} 个方案包迁移失败"
            )
        else:
            summary_report.set_context(success_count=success_count)
            summary_report.mark_success(f"全部 {success_count} 个方案包迁移完成")

        summary_report.print_report()
        sys.exit(0 if not failed_packages else 1)

    elif args.package:
        # 迁移单个方案包
        package_path = plan_path / args.package

        if not package_path.exists():
            report = ExecutionReport("migrate_package")
            report.mark_failed("查找方案包", ["迁移方案包"], f"方案包不存在: {package_path}")
            report.print_report()
            sys.exit(1)

        report = migrate_package(package_path, archive_path, args.status)
        report.print_report()
        sys.exit(0 if report.success else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

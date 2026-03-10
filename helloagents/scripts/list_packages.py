#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
列出 HelloAGENTS 方案包

Usage:
    python list_packages.py [--path <base-path>] [--archive] [--format <table|json>]

Examples:
    python list_packages.py
    python list_packages.py --archive
    python list_packages.py --format json
"""

import argparse
import json
import sys
from pathlib import Path

# 导入 utils 模块（优先直接导入，回退时添加脚本目录到路径）
try:
    from utils import (
        setup_encoding,
        get_plan_path,
        get_archive_path,
        list_packages,
        get_package_summary,
        script_error_handler,
        validate_base_path,
        _msg,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        setup_encoding,
        get_plan_path,
        get_archive_path,
        list_packages,
        get_package_summary,
        script_error_handler,
        validate_base_path,
        _msg,
    )


def print_table(packages: list, title: str):
    """以表格形式打印方案包列表"""
    if not packages:
        print(_msg(f"{title}: 空（无方案包）", f"{title}: empty (no packages)"))
        return

    print(_msg(f"\n{title} ({len(packages)} 个):",
               f"\n{title} ({len(packages)} item(s)):"))
    print("-" * 80)
    print(_msg(f"{'序号':<4} {'名称':<30} {'任务':<6} {'状态':<8} {'摘要':<30}",
               f"{'No.':<4} {'Name':<30} {'Tasks':<6} {'Status':<8} {'Summary':<30}"))
    print("-" * 80)

    for i, pkg in enumerate(packages, 1):
        status = _msg("✅完整", "✅Complete") if pkg['complete'] else _msg("⚠️不完整", "⚠️Incomplete")
        try:
            summary = get_package_summary(pkg['path'])
        except Exception:
            summary = _msg("(读取失败)", "(read failed)")
        print(f"{i:<4} {pkg['name']:<30} {pkg['task_count']:<6} {status:<8} {summary:<30}")

    print("-" * 80)


def print_json(packages: list):
    """以 JSON 形式打印方案包列表"""
    output = []
    for pkg in packages:
        try:
            summary = get_package_summary(pkg['path'])
        except Exception:
            summary = "(读取失败)"
        output.append({
            'name': pkg['name'],
            'timestamp': pkg['timestamp'],
            'feature': pkg['feature'],
            'complete': pkg['complete'],
            'task_count': pkg['task_count'],
            'path': str(pkg['path']),
            'summary': summary
        })
    print(json.dumps(output, ensure_ascii=False, indent=2))


@script_error_handler
def main():
    setup_encoding()
    parser = argparse.ArgumentParser(
        description="列出 HelloAGENTS 方案包"
    )
    parser.add_argument(
        "--path",
        default=None,
        help="项目根目录 (默认: 当前目录)"
    )
    parser.add_argument(
        "--archive",
        action="store_true",
        help="同时列出 archive/ 中的方案包"
    )
    parser.add_argument(
        "--format",
        choices=["table", "json"],
        default="table",
        help="输出格式: table(表格) 或 json"
    )

    args = parser.parse_args()

    # 验证基础路径
    validate_base_path(args.path)

    # 获取 plan/ 方案包
    plan_path = get_plan_path(args.path)
    plan_packages = list_packages(plan_path)

    if args.format == "json":
        result = {'plan': plan_packages}

        if args.archive:
            archive_path = get_archive_path(args.path)
            # 扫描 archive 下的所有年月子目录
            archive_packages = []
            if archive_path.exists():
                for month_dir in archive_path.iterdir():
                    if month_dir.is_dir() and not month_dir.name.startswith('.'):
                        archive_packages.extend(list_packages(month_dir))
            result['archive'] = archive_packages

        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    else:
        print_table(plan_packages, _msg("📦 plan/ 方案包", "📦 plan/ packages"))

        if args.archive:
            archive_path = get_archive_path(args.path)
            if archive_path.exists():
                for month_dir in sorted(archive_path.iterdir(), reverse=True):
                    if month_dir.is_dir() and not month_dir.name.startswith('.'):
                        month_packages = list_packages(month_dir)
                        if month_packages:
                            print_table(month_packages, f"📁 archive/{month_dir.name}/")


if __name__ == "__main__":
    main()

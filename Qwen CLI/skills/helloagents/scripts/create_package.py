#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建 HelloAGENTS 方案包

Usage:
    python create_package.py <feature-name> [--path <base-path>] [--type <implementation|overview>]

Examples:
    python create_package.py user-login
    python create_package.py api-refactor --type overview
    python create_package.py auth-system --path /path/to/project
"""

import argparse
import re
import sys
from pathlib import Path
from datetime import datetime

# 确保能找到同目录下的 utils 模块
sys.path.insert(0, str(Path(__file__).parent))
from utils import (
    setup_encoding,
    get_plan_path,
    generate_package_name,
    print_error,
    print_success,
    validate_base_path,
    get_template_loader,
    ExecutionReport
)


# 模板路径常量
TEMPLATE_PROPOSAL = "plan/proposal.md"
TEMPLATE_TASKS = "plan/tasks.md"


def create_package(feature: str, base_path: str = None, pkg_type: str = "implementation") -> ExecutionReport:
    """
    创建方案包（并发安全，支持 AI 降级接手）

    Args:
        feature: 功能名称
        base_path: 项目根目录
        pkg_type: 方案包类型 (implementation/overview)

    Returns:
        ExecutionReport: 执行报告，包含完成状态和上下文
    """
    report = ExecutionReport("create_package")
    report.set_context(feature=feature, pkg_type=pkg_type, base_path=base_path or "cwd")

    plan_path = get_plan_path(base_path)
    original_name = generate_package_name(feature)

    # 步骤1: 确保父目录存在
    try:
        plan_path.mkdir(parents=True, exist_ok=True)
        report.mark_completed(
            "创建 plan/ 目录",
            str(plan_path),
            "检查目录是否存在: ls 或 Read 工具"
        )
    except PermissionError as e:
        report.mark_failed(
            "创建 plan/ 目录",
            ["创建 plan/ 目录", "创建方案包目录", "创建 proposal.md", "创建 tasks.md"],
            f"权限不足: {e}"
        )
        return report

    # 步骤2: 并发安全的目录创建（原子操作 + 重试）
    max_retries = 100
    package_path = None
    package_name = None

    for version in range(1, max_retries + 1):
        package_name = original_name if version == 1 else f"{original_name}_v{version}"
        package_path = plan_path / package_name

        try:
            package_path.mkdir(exist_ok=False)
            report.mark_completed(
                "创建方案包目录",
                str(package_path),
                "检查目录是否存在且为空目录"
            )
            report.set_context(package_path=str(package_path), package_name=package_name)
            break
        except FileExistsError:
            continue
        except PermissionError as e:
            report.mark_failed(
                "创建方案包目录",
                ["创建方案包目录", "创建 proposal.md", "创建 tasks.md"],
                f"权限不足: {package_path}"
            )
            return report
    else:
        report.mark_failed(
            "创建方案包目录",
            ["创建方案包目录", "创建 proposal.md", "创建 tasks.md"],
            f"超过最大重试次数 ({max_retries})，存在大量同名方案包"
        )
        return report

    # 步骤3: 加载并填充模板
    current_date = datetime.now().strftime("%Y-%m-%d")
    loader = get_template_loader()

    # 定义占位符替换映射
    replacements = {
        "{feature}": feature,
        "{YYYY-MM-DD}": current_date,
        "{pkg_type}": pkg_type,
        "{package_name}": package_name,
        "{YYYYMMDDHHMM}_{feature}": package_name
    }

    # 步骤4: proposal.md - 检查模板存在性
    proposal_content = loader.fill(TEMPLATE_PROPOSAL, replacements)
    if proposal_content is None:
        report.mark_failed(
            f"加载模板 {TEMPLATE_PROPOSAL}",
            ["创建 proposal.md（需包含：元信息、需求、方案章节）", "创建 tasks.md"],
            f"模板文件不存在: {TEMPLATE_PROPOSAL}"
        )
        return report

    # 步骤5: tasks.md - 检查模板存在性
    tasks_content = loader.fill(TEMPLATE_TASKS, replacements)
    if tasks_content is None:
        report.mark_failed(
            f"加载模板 {TEMPLATE_TASKS}",
            ["创建 tasks.md（需包含：执行状态、任务列表、执行备注章节）"],
            f"模板文件不存在: {TEMPLATE_TASKS}"
        )
        # 仍需标记 proposal 模板加载成功
        report.mark_completed(
            "加载 proposal.md 模板",
            "模板内容已加载",
            "N/A - 模板加载成功但未写入文件"
        )
        return report

    # overview 类型：替换任务列表为"无执行任务"
    if pkg_type == "overview":
        # 替换执行状态中的完成率
        tasks_content = re.sub(r'完成率:\s*\d+%', '完成率: N/A', tasks_content)
        tasks_content = re.sub(r'总任务:\s*\w+', '总任务: 0', tasks_content)
        # 替换任务列表部分
        tasks_content = re.sub(
            r'## 任务列表\s*\n.*?(?=\n---)',
            '## 任务列表\n\n> 无执行任务（概述文档）\n',
            tasks_content,
            flags=re.DOTALL
        )

    # 步骤6: 写入 proposal.md
    proposal_path = package_path / "proposal.md"
    try:
        proposal_path.write_text(proposal_content, encoding='utf-8')
        report.mark_completed(
            "创建 proposal.md",
            str(proposal_path),
            "检查文件存在且包含必需章节（元信息、需求、方案）"
        )
    except Exception as e:
        report.mark_failed(
            "写入 proposal.md",
            ["创建 proposal.md", "创建 tasks.md"],
            str(e)
        )
        return report

    # 步骤7: 写入 tasks.md
    tasks_path = package_path / "tasks.md"
    try:
        tasks_path.write_text(tasks_content, encoding='utf-8')
        report.mark_completed(
            "创建 tasks.md",
            str(tasks_path),
            "检查文件存在且包含必需章节（执行状态、任务列表）"
        )
    except Exception as e:
        report.mark_failed(
            "写入 tasks.md",
            ["创建 tasks.md"],
            str(e)
        )
        return report

    # 全部完成
    report.mark_success(str(package_path))
    return report


def main():
    setup_encoding()
    parser = argparse.ArgumentParser(
        description="创建 HelloAGENTS 方案包"
    )
    parser.add_argument(
        "feature",
        help="功能名称 (如: user-login, api-refactor)"
    )
    parser.add_argument(
        "--path",
        default=None,
        help="项目根目录 (默认: 当前目录)"
    )
    parser.add_argument(
        "--type",
        choices=["implementation", "overview"],
        default="implementation",
        help="方案包类型: implementation(实施计划) 或 overview(概述文档)"
    )

    args = parser.parse_args()

    # 验证基础路径
    try:
        validate_base_path(args.path)
    except ValueError as e:
        report = ExecutionReport("create_package")
        report.mark_failed("验证基础路径", ["验证路径", "创建方案包"], str(e))
        report.print_report()
        sys.exit(1)

    # 验证 feature 名称
    feature = args.feature.strip()
    if not feature:
        report = ExecutionReport("create_package")
        report.mark_failed("验证功能名称", ["创建方案包"], "功能名称不能为空")
        report.print_report()
        sys.exit(1)

    # 预验证 feature 名称有效性（检查规范化后是否为空）
    try:
        generate_package_name(feature)
    except ValueError as e:
        report = ExecutionReport("create_package")
        report.mark_failed("验证功能名称", ["创建方案包"], str(e))
        report.print_report()
        sys.exit(1)

    # 执行创建
    report = create_package(feature, args.path, args.type)

    # 输出执行报告（JSON格式，供 AI 解析）
    report.print_report()

    # 返回状态码
    sys.exit(0 if report.success else 1)


if __name__ == "__main__":
    main()

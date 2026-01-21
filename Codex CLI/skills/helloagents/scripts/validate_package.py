#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
方案包验证脚本
验证方案包完整性、任务状态、可执行性

Usage:
    python validate_package.py [--path <base-path>] [package-name]

Examples:
    python validate_package.py                         # 验证当前目录下所有方案包
    python validate_package.py --path /project         # 验证指定目录下所有方案包
    python validate_package.py 202501_feat             # 验证指定方案包
    python validate_package.py --path /project pkg     # 指定目录和方案包
"""

import argparse
import json
import re
import sys
from pathlib import Path
from datetime import datetime

# 确保能找到同目录下的 utils 模块
sys.path.insert(0, str(Path(__file__).parent))
from utils import setup_encoding, get_plan_path, script_error_handler, validate_base_path, get_template_loader

# 任务状态符号
TASK_STATUS = {
    "[ ]": "pending",
    "[√]": "completed",
    "[X]": "failed",
    "[-]": "skipped",
    "[?]": "uncertain"
}

# 方案包必需文件
REQUIRED_FILES = ["proposal.md", "tasks.md"]
OPTIONAL_FILES = []


def parse_tasks(tasks_content: str) -> dict:
    """解析tasks.md中的任务"""
    tasks = {
        "total": 0,
        "by_status": {
            "pending": 0,
            "completed": 0,
            "failed": 0,
            "skipped": 0,
            "uncertain": 0
        },
        "items": []
    }

    # 匹配任务行: - [ ] 任务描述 或 - [√] 任务描述
    task_pattern = re.compile(r'^[-*]\s*\[([ √X\-?])\]\s*(.+)$', re.MULTILINE)

    for match in task_pattern.finditer(tasks_content):
        status_char = match.group(1)
        description = match.group(2).strip()

        # 映射状态
        status_key = f"[{status_char}]"
        status = TASK_STATUS.get(status_key, "pending")

        tasks["items"].append({
            "status": status,
            "description": description[:100]  # 截断过长描述
        })
        tasks["total"] += 1
        tasks["by_status"][status] += 1

    return tasks


def get_template_sections() -> tuple:
    """
    从模板文件动态提取章节标题（语言无关）

    Returns:
        (sections, template_missing): 章节列表和模板是否缺失的标志
    """
    loader = get_template_loader()

    # 检查模板是否存在
    if not loader.exists("plan/proposal.md"):
        return [], True  # 返回空列表和模板缺失标志

    return loader.get_sections("plan/proposal.md", level=2), False


def parse_proposal(proposal_content: str) -> dict:
    """解析proposal.md中的关键信息"""
    proposal = {
        "sections_found": 0,
        "sections_expected": 0,
        "decisions": [],
        "pkg_type": "implementation",
        "template_missing": False
    }

    # 从模板动态获取期望的章节（语言无关）
    expected_sections, template_missing = get_template_sections()
    proposal["sections_expected"] = len(expected_sections)
    proposal["template_missing"] = template_missing

    # 检测实际存在的章节
    for section in expected_sections:
        # 移除编号前缀（如 "1. "）和可选标记（如 "（可选）"）
        core = re.sub(r'^\d+\.\s*', '', section)
        core = re.sub(r'[（(].*?[）)]', '', core).strip()
        if core and core in proposal_content:
            proposal["sections_found"] += 1

    # 提取决策ID（语言无关：#D001格式）
    proposal["decisions"] = re.findall(r'#D\d{3}', proposal_content)

    # 提取方案类型（语言无关：implementation/overview）
    if re.search(r':\s*overview\b', proposal_content, re.IGNORECASE):
        proposal["pkg_type"] = "overview"

    return proposal


def validate_package(package_path: Path) -> dict:
    """验证单个方案包"""
    result = {
        "name": package_path.name,
        "path": str(package_path),
        "valid": True,
        "executable": True,
        "issues": [],
        "warnings": [],
        "files": {
            "present": [],
            "missing": []
        },
        "tasks": None,
        "proposal": None
    }

    # 检查必需文件
    for file in REQUIRED_FILES:
        file_path = package_path / file
        if file_path.exists():
            result["files"]["present"].append(file)
        else:
            result["files"]["missing"].append(file)
            result["valid"] = False
            result["executable"] = False
            result["issues"].append(f"缺少必需文件: {file}")

    # 检查可选文件
    for file in OPTIONAL_FILES:
        file_path = package_path / file
        if file_path.exists():
            result["files"]["present"].append(file)
        else:
            result["warnings"].append(f"缺少可选文件: {file}")

    # 先解析proposal.md获取方案类型
    proposal_path = package_path / "proposal.md"
    pkg_type = "implementation"  # 默认类型
    if proposal_path.exists():
        try:
            content = proposal_path.read_text(encoding="utf-8")
            result["proposal"] = parse_proposal(content)
            pkg_type = result["proposal"].get("pkg_type", "implementation")

            # 检查模板是否缺失
            if result["proposal"].get("template_missing", False):
                result["warnings"].append("模板文件缺失 (plan/proposal.md)，章节验证已跳过")
        except Exception as e:
            result["warnings"].append(f"解析proposal.md失败: {str(e)}")

    is_overview = (pkg_type == "overview")

    # 解析tasks.md
    tasks_path = package_path / "tasks.md"
    if tasks_path.exists():
        try:
            content = tasks_path.read_text(encoding="utf-8")
            result["tasks"] = parse_tasks(content)

            # 检查任务数量（overview 类型除外）
            if result["tasks"]["total"] == 0 and not is_overview:
                result["issues"].append("tasks.md中没有任务项")
                result["executable"] = False

            # overview 类型标记为不可执行但不报告问题
            if is_overview:
                result["executable"] = False

            # 检查是否有待执行任务
            if result["tasks"]["by_status"]["pending"] == 0 and not is_overview:
                if result["tasks"]["by_status"]["completed"] == result["tasks"]["total"]:
                    result["warnings"].append("所有任务已完成，建议迁移至archive/")
                    result["executable"] = False
                elif result["tasks"]["by_status"]["failed"] > 0:
                    result["warnings"].append(f"存在{result['tasks']['by_status']['failed']}个失败任务")

        except Exception as e:
            result["issues"].append(f"解析tasks.md失败: {str(e)}")
            result["valid"] = False

    return result


def validate_all_packages(plan_path: Path) -> dict:
    """验证所有方案包"""
    results = {
        "timestamp": datetime.now().isoformat(),
        "plan_path": str(plan_path),
        "total": 0,
        "valid": 0,
        "invalid": 0,
        "executable": 0,
        "packages": []
    }

    # plan/ 目录不存在是正常情况（新项目），返回空结果即可
    if not plan_path.is_dir():
        return results

    for item in sorted(plan_path.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            pkg_result = validate_package(item)
            results["packages"].append(pkg_result)
            results["total"] += 1

            if pkg_result["valid"]:
                results["valid"] += 1
            else:
                results["invalid"] += 1

            if pkg_result["executable"]:
                results["executable"] += 1

    return results


@script_error_handler
def main():
    """主函数"""
    setup_encoding()

    parser = argparse.ArgumentParser(
        description="验证 HelloAGENTS 方案包完整性"
    )
    parser.add_argument(
        "package",
        nargs="?",
        help="方案包名称（不指定则验证所有）"
    )
    parser.add_argument(
        "--path",
        default=None,
        help="项目根目录（默认: 当前目录）"
    )

    args = parser.parse_args()

    # 验证基础路径
    try:
        validate_base_path(args.path)
    except ValueError as e:
        print(json.dumps({
            "error": str(e),
            "valid": False
        }, ensure_ascii=False, indent=2))
        sys.exit(1)

    # 获取 plan/ 目录
    plan_path = get_plan_path(args.path)

    # 判断是验证单个包还是所有包
    if args.package:
        # 验证指定的方案包
        package_path = plan_path / args.package

        if not package_path.is_dir():
            # 尝试作为完整路径
            package_path = Path(args.package)

        if package_path.is_dir():
            result = validate_package(package_path)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            sys.exit(0 if result["valid"] else 1)
        else:
            print(json.dumps({
                "error": f"方案包不存在: {args.package}",
                "valid": False
            }, ensure_ascii=False, indent=2))
            sys.exit(1)
    else:
        # 验证所有方案包
        results = validate_all_packages(plan_path)
        print(json.dumps(results, ensure_ascii=False, indent=2))

        # 返回状态码: 0=全部有效, 1=存在无效方案包
        if results["invalid"] > 0:
            sys.exit(1)
        else:
            sys.exit(0)


if __name__ == "__main__":
    main()

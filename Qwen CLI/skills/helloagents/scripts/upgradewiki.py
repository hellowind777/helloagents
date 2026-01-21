#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 知识库工具（纯文件操作）

本脚本仅负责文件系统操作，不做任何内容分析和转换。
内容分析由 AI 通过 ~upgrade 命令执行。

Usage:
    python upgradewiki.py --scan [--path <base-path>]
    python upgradewiki.py --init [--path <base-path>]
    python upgradewiki.py --backup [--path <base-path>]
    python upgradewiki.py --write <json-file> [--path <base-path>]

Examples:
    python upgradewiki.py --scan                    # 扫描知识库目录，返回文件列表
    python upgradewiki.py --init                    # 创建标准目录结构
    python upgradewiki.py --backup                  # 备份现有知识库
    python upgradewiki.py --write plan.json         # 按计划写入文件
"""

import argparse
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# 确保能找到同目录下的 utils 模块
sys.path.insert(0, str(Path(__file__).parent))
from utils import get_workspace_path, setup_encoding, print_error, print_success, validate_base_path


# V3 标准目录结构
V3_DIRECTORIES = ['modules', 'archive', 'plan']
V3_ROOT_FILES = ['INDEX.md', 'context.md', 'CHANGELOG.md']


def scan_workspace(workspace: Path) -> Dict:
    """
    扫描知识库目录，返回文件列表（不做任何内容分析）

    Returns:
        {
            "workspace": str,
            "exists": bool,
            "files": [{"path": str, "type": "file"|"directory", "size": int}],
            "structure": {
                "directories": [str],
                "root_files": [str]
            }
        }
    """
    result = {
        "workspace": str(workspace),
        "exists": workspace.exists(),
        "files": [],
        "structure": {
            "directories": [],
            "root_files": []
        }
    }

    if not workspace.exists():
        return result

    # 扫描所有文件和目录
    for item in sorted(workspace.rglob("*")):
        if item.name.startswith('.'):
            continue

        rel_path = item.relative_to(workspace)
        file_info = {
            "path": str(rel_path).replace("\\", "/"),
            "type": "directory" if item.is_dir() else "file"
        }

        if item.is_file():
            file_info["size"] = item.stat().st_size

        result["files"].append(file_info)

    # 分析顶层结构
    for item in workspace.iterdir():
        if item.name.startswith('.'):
            continue
        if item.is_dir():
            result["structure"]["directories"].append(item.name)
        else:
            result["structure"]["root_files"].append(item.name)

    return result


def init_structure(workspace: Path) -> Dict:
    """
    创建标准目录结构（仅创建目录，不创建文件）

    Returns:
        {"created": [str], "existed": [str]}
    """
    result = {
        "created": [],
        "existed": []
    }

    # 创建 helloagents 根目录
    if not workspace.exists():
        workspace.mkdir(parents=True)
        result["created"].append(str(workspace))
    else:
        result["existed"].append(str(workspace))

    # 创建子目录
    for dir_name in V3_DIRECTORIES:
        dir_path = workspace / dir_name
        if not dir_path.exists():
            dir_path.mkdir(parents=True)
            result["created"].append(dir_name)
        else:
            result["existed"].append(dir_name)

    return result


def create_backup(workspace: Path) -> Dict:
    """
    备份现有知识库

    Returns:
        {"success": bool, "backup_path": str|None, "error": str|None}
    """
    result = {
        "success": False,
        "backup_path": None,
        "error": None
    }

    if not workspace.exists():
        result["error"] = f"知识库目录不存在: {workspace}"
        return result

    # 生成备份目录名
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    base_backup_path = workspace.parent / f"helloagents_backup_{timestamp}"

    # 确保备份目录不存在（添加序号避免冲突）
    backup_path = base_backup_path
    counter = 1
    while backup_path.exists():
        backup_path = workspace.parent / f"helloagents_backup_{timestamp}_{counter}"
        counter += 1

    try:
        shutil.copytree(workspace, backup_path)
        result["success"] = True
        result["backup_path"] = str(backup_path)
    except Exception as e:
        result["error"] = str(e)

    return result


def write_files(workspace: Path, plan_file: Path) -> Dict:
    """
    按计划写入文件（由 AI 生成的写入计划）

    计划文件格式 (JSON):
    {
        "operations": [
            {"action": "write", "path": "context.md", "content": "..."},
            {"action": "rename", "from": "old.md", "to": "new.md"},
            {"action": "delete", "path": "obsolete.md"},
            {"action": "mkdir", "path": "subdir"}
        ]
    }

    Returns:
        {"success": bool, "executed": [str], "errors": [str]}
    """
    result = {
        "success": True,
        "executed": [],
        "errors": []
    }

    if not plan_file.exists():
        result["success"] = False
        result["errors"].append(f"计划文件不存在: {plan_file}")
        return result

    try:
        plan = json.loads(plan_file.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        result["success"] = False
        result["errors"].append(f"JSON解析错误: {e}")
        return result

    operations = plan.get("operations", [])

    for op in operations:
        action = op.get("action")
        try:
            if action == "write":
                file_path = workspace / op["path"]
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(op["content"], encoding='utf-8')
                result["executed"].append(f"write: {op['path']}")

            elif action == "rename":
                from_path = workspace / op["from"]
                to_path = workspace / op["to"]
                if from_path.exists():
                    to_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(from_path), str(to_path))
                    result["executed"].append(f"rename: {op['from']} → {op['to']}")
                else:
                    result["errors"].append(f"源文件不存在: {op['from']}")

            elif action == "delete":
                file_path = workspace / op["path"]
                if file_path.exists():
                    if file_path.is_dir():
                        shutil.rmtree(file_path)
                    else:
                        file_path.unlink()
                    result["executed"].append(f"delete: {op['path']}")

            elif action == "mkdir":
                dir_path = workspace / op["path"]
                dir_path.mkdir(parents=True, exist_ok=True)
                result["executed"].append(f"mkdir: {op['path']}")

            else:
                result["errors"].append(f"未知操作: {action}")

        except Exception as e:
            result["success"] = False
            result["errors"].append(f"{action} {op.get('path', '')}: {e}")

    if result["errors"]:
        result["success"] = False

    return result


def main():
    setup_encoding()
    parser = argparse.ArgumentParser(
        description="HelloAGENTS 知识库工具（纯文件操作）"
    )

    # 互斥的操作模式
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--scan",
        action="store_true",
        help="扫描知识库目录，返回文件列表（JSON）"
    )
    group.add_argument(
        "--init",
        action="store_true",
        help="创建标准目录结构"
    )
    group.add_argument(
        "--backup",
        action="store_true",
        help="备份现有知识库"
    )
    group.add_argument(
        "--write",
        metavar="JSON_FILE",
        help="按计划写入文件（JSON格式的操作计划）"
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
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)

    workspace = get_workspace_path(args.path)

    # 执行操作
    if args.scan:
        result = scan_workspace(workspace)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0)

    elif args.init:
        result = init_structure(workspace)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result["created"]:
            sys.exit(0)
        else:
            sys.exit(0)  # 目录已存在也是成功

    elif args.backup:
        result = create_backup(workspace)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result["success"] else 1)

    elif args.write:
        plan_file = Path(args.write)
        result = write_files(workspace, plan_file)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()

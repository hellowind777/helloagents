#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS Package Operations - create/validate/migrate/list.

Usage: python package_ops.py create|validate|migrate|list [args]
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from datetime import datetime

try:
    from utils import (
        setup_encoding, get_plan_path, get_archive_path,
        generate_package_name, parse_package_name, get_year_month,
        list_packages, get_package_summary,
        print_error, print_success, validate_base_path,
        get_template_loader, ExecutionReport, _msg,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        setup_encoding, get_plan_path, get_archive_path,
        generate_package_name, parse_package_name, get_year_month,
        list_packages, get_package_summary,
        print_error, print_success, validate_base_path,
        get_template_loader, ExecutionReport, _msg,
    )

TASK_STATUS = {"[ ]": "pending", "[√]": "completed", "[X]": "failed",
               "[-]": "skipped", "[?]": "uncertain"}
REQUIRED_FILES = ["proposal.md", "tasks.md"]


# ═══════════════════════════════════════════════════════════════════════════
# CREATE
# ═══════════════════════════════════════════════════════════════════════════

def create_package(feature, base_path=None, pkg_type="implementation"):
    report = ExecutionReport("create_package")
    report.set_context(feature=feature, pkg_type=pkg_type)
    plan_path = get_plan_path(base_path)
    name = generate_package_name(feature)
    try:
        plan_path.mkdir(parents=True, exist_ok=True)
    except PermissionError as e:
        report.mark_failed("创建目录", ["创建方案包"], str(e))
        return report

    pkg_path = None
    for v in range(1, 101):
        n = name if v == 1 else f"{name}_v{v}"
        p = plan_path / n
        try:
            p.mkdir(exist_ok=False)
            pkg_path, name = p, n
            break
        except FileExistsError:
            continue
        except PermissionError:
            report.mark_failed("创建方案包目录", ["创建方案包"], f"权限不足: {p}")
            return report
    else:
        report.mark_failed("创建方案包目录", ["创建方案包"], "超过最大重试次数")
        return report

    report.set_context(package_path=str(pkg_path), package_name=name)
    loader = get_template_loader()
    reps = {"{feature}": feature, "{YYYY-MM-DD}": datetime.now().strftime("%Y-%m-%d"),
            "{pkg_type}": pkg_type, "{package_name}": name, "{YYYYMMDDHHMM}_{feature}": name}

    for fname in REQUIRED_FILES:
        content = loader.fill(f"plan/{fname}", reps)
        if content is None:
            report.mark_failed(f"加载模板 {fname}", [f"创建 {fname}"], "模板不存在")
            return report
        if fname == "tasks.md" and pkg_type == "overview":
            content = re.sub(r'## 任务列表\s*\n.*?(?=\n---)',
                             '## 任务列表\n\n> 无执行任务（概述文档）\n', content, flags=re.DOTALL)
        try:
            (pkg_path / fname).write_text(content, encoding='utf-8')
            report.mark_completed(f"创建 {fname}", str(pkg_path / fname), "")
        except Exception as e:
            report.mark_failed(f"写入 {fname}", [], str(e))
            return report
    report.mark_success(str(pkg_path))
    return report


# ═══════════════════════════════════════════════════════════════════════════
# VALIDATE
# ═══════════════════════════════════════════════════════════════════════════

def parse_tasks(content):
    tasks = {"total": 0, "by_status": {s: 0 for s in TASK_STATUS.values()}, "items": []}
    for m in re.finditer(r'^\s*[-*]\s*\[([ √X\-?])\]\s*(.+)$', content, re.MULTILINE):
        status = TASK_STATUS.get(f"[{m.group(1)}]", "pending")
        tasks["items"].append({"status": status, "description": m.group(2).strip()[:100]})
        tasks["total"] += 1
        tasks["by_status"][status] += 1
    return tasks


def parse_proposal(content):
    info = {"sections_found": 0, "sections_expected": 0, "decisions": [],
            "pkg_type": "implementation", "template_missing": False}
    loader = get_template_loader()
    if not loader.exists("plan/proposal.md"):
        info["template_missing"] = True
        return info
    expected = loader.get_sections("plan/proposal.md", level=2)
    info["sections_expected"] = len(expected)
    for sec in expected:
        core = re.sub(r'^\d+\.\s*', '', sec)
        core = re.sub(r'[（(].*?[）)]', '', core).strip()
        if core and re.search(rf'^##\s+.*{re.escape(core)}', content, re.MULTILINE):
            info["sections_found"] += 1
    info["decisions"] = re.findall(r'#D\d{3}', content)
    if re.search(r':\s*overview\b', content, re.IGNORECASE):
        info["pkg_type"] = "overview"
    return info


def validate_package(pkg_path):
    r = {"name": pkg_path.name, "path": str(pkg_path), "valid": True,
         "executable": True, "issues": [], "warnings": [],
         "files": {"present": [], "missing": []}, "tasks": None, "proposal": None}
    for f in REQUIRED_FILES:
        if (pkg_path / f).exists():
            r["files"]["present"].append(f)
        else:
            r["files"]["missing"].append(f)
            r["valid"] = r["executable"] = False
            r["issues"].append(f"缺少: {f}")

    pkg_type = "implementation"
    proposal = pkg_path / "proposal.md"
    if proposal.exists():
        try:
            r["proposal"] = parse_proposal(proposal.read_text(encoding="utf-8"))
            pkg_type = r["proposal"].get("pkg_type", "implementation")
        except Exception as e:
            r["warnings"].append(f"proposal解析失败: {e}")

    tasks = pkg_path / "tasks.md"
    if tasks.exists():
        try:
            r["tasks"] = parse_tasks(tasks.read_text(encoding="utf-8"))
            is_ov = (pkg_type == "overview")
            if r["tasks"]["total"] == 0 and not is_ov:
                r["issues"].append("tasks.md无任务项")
                r["executable"] = False
            if is_ov:
                r["executable"] = False
        except Exception as e:
            r["issues"].append(f"tasks解析失败: {e}")
            r["valid"] = False
    return r


# ═══════════════════════════════════════════════════════════════════════════
# MIGRATE
# ═══════════════════════════════════════════════════════════════════════════

def migrate_package(pkg_path, archive_base, status="completed"):
    report = ExecutionReport("migrate_package")
    report.set_context(package_name=pkg_path.name, status=status)
    if not pkg_path.exists():
        report.mark_failed("验证", [], f"不存在: {pkg_path}")
        return report
    parsed = parse_package_name(pkg_path.name)
    ym = get_year_month(parsed[0]) if parsed else datetime.now().strftime("%Y-%m")
    target_dir = archive_base / ym
    target = target_dir / pkg_path.name
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        # Update tasks.md status
        tf = pkg_path / "tasks.md"
        if tf.exists():
            c = tf.read_text(encoding='utf-8')
            ts = datetime.now().strftime("%Y-%m-%d %H:%M")
            line = f"> **@status:** {status} | {ts}"
            if re.search(r'^> \*\*(?:@status|Status|状态):\*\*', c, re.MULTILINE):
                c = re.sub(r'^> \*\*(?:@status|Status|状态):\*\*.*$', line, c, count=1, flags=re.MULTILINE)
            else:
                c = line + "\n\n" + c
            tf.write_text(c, encoding='utf-8')
        # Move
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(pkg_path), str(target))
        report.mark_completed("迁移", str(target), "")
        report.mark_success(str(target))
    except Exception as e:
        report.mark_failed("迁移", [], str(e))
    return report


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════

def main():
    setup_encoding()
    parser = argparse.ArgumentParser(description="HelloAGENTS 方案包操作")
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("create")
    p.add_argument("feature")
    p.add_argument("--path", default=None)
    p.add_argument("--type", choices=["implementation", "overview"], default="implementation")

    p = sub.add_parser("validate")
    p.add_argument("package", nargs="?")
    p.add_argument("--path", default=None)

    p = sub.add_parser("migrate")
    p.add_argument("package", nargs="?")
    p.add_argument("--path", default=None)
    p.add_argument("--status", choices=["completed", "skipped"], default="completed")
    p.add_argument("--all", action="store_true")

    p = sub.add_parser("list")
    p.add_argument("--path", default=None)
    p.add_argument("--archive", action="store_true")
    p.add_argument("--format", choices=["table", "json"], default="table")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "create":
        r = create_package(args.feature.strip(), args.path, args.type)
        r.print_report()
        sys.exit(0 if r.success else 1)
    elif args.command == "validate":
        plan = get_plan_path(args.path)
        if args.package:
            pkg = plan / args.package
            if not pkg.is_dir():
                pkg = Path(args.package)
            if pkg.is_dir():
                print(json.dumps(validate_package(pkg), ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"error": f"不存在: {args.package}"}, ensure_ascii=False))
                sys.exit(1)
        else:
            results = {"packages": []}
            if plan.is_dir():
                for d in sorted(plan.iterdir()):
                    if d.is_dir() and not d.name.startswith("."):
                        results["packages"].append(validate_package(d))
            print(json.dumps(results, ensure_ascii=False, indent=2))
    elif args.command == "migrate":
        plan = get_plan_path(args.path)
        archive = get_archive_path(args.path)
        if args.all:
            for pkg in list_packages(plan):
                migrate_package(pkg['path'], archive, args.status).print_report()
        elif args.package:
            migrate_package(plan / args.package, archive, args.status).print_report()
    elif args.command == "list":
        pkgs = list_packages(get_plan_path(args.path))
        if args.format == "json":
            print(json.dumps({"plan": pkgs}, ensure_ascii=False, indent=2, default=str))
        else:
            if not pkgs:
                print(_msg("📦 plan/: 空", "📦 plan/: empty"))
            else:
                print(_msg(f"\n📦 plan/ ({len(pkgs)} 个):", f"\n📦 plan/ ({len(pkgs)}):"))
                for i, p in enumerate(pkgs, 1):
                    st = "✅" if p['complete'] else "⚠️"
                    print(f"  {i}. {p['name']} [{p['task_count']} tasks] {st}")


if __name__ == "__main__":
    main()

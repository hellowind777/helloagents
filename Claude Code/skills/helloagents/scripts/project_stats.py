#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
项目统计脚本
统计项目规模（文件数、代码行数、模块数）用于复杂度判定

Usage:
    python project_stats.py [--path <project-path>]

Examples:
    python project_stats.py                    # 统计当前目录
    python project_stats.py --path /project    # 统计指定目录
"""

import argparse
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# 确保能找到同目录下的 utils 模块
sys.path.insert(0, str(Path(__file__).parent))
from utils import setup_encoding, script_error_handler

# 源代码文件扩展名
SOURCE_EXTENSIONS = {
    # 前端
    ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte",
    # 后端
    ".py", ".java", ".go", ".rs", ".rb", ".php",
    ".cs", ".cpp", ".c", ".h", ".hpp",
    # 移动端
    ".swift", ".kt", ".dart",
    # 其他
    ".scala", ".clj", ".ex", ".exs", ".erl",
    ".lua", ".r", ".jl", ".zig"
}

# 配置文件扩展名
CONFIG_EXTENSIONS = {
    ".json", ".yaml", ".yml", ".toml", ".xml",
    ".ini", ".conf", ".env"
}

# 排除目录
EXCLUDE_DIRS = {
    "node_modules", ".git", ".svn", ".hg",
    "vendor", "__pycache__", ".venv", "venv",
    "dist", "build", "target", "out", "bin",
    ".idea", ".vscode", ".vs",
    "coverage", ".nyc_output", ".pytest_cache",
    "helloagents"  # 排除知识库目录
}

# 大型项目阈值（与 scaling.md 保持一致）
LARGE_PROJECT_THRESHOLDS = {
    "files": 500,
    "lines": 50000,
    "modules": 30
}


def get_project_root(path_arg: str = None) -> Path:
    """获取项目根目录

    优先级：指定路径 > 当前工作目录
    """
    path = Path(path_arg or os.getcwd()).resolve()
    if not path.is_dir():
        raise ValueError(f"指定的路径不存在或不是目录: {path_arg}")
    return path


def should_exclude(path: Path) -> bool:
    """判断是否应该排除该路径"""
    for part in path.parts:
        if part in EXCLUDE_DIRS:
            return True
        if part.startswith("."):
            return True
    return False


def count_lines(file_path: Path) -> int:
    """统计文件行数"""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def detect_tech_stack(project_root: Path) -> dict:
    """检测技术栈"""
    tech_stack = {
        "languages": [],
        "frameworks": [],
        "package_managers": [],
        "build_tools": []
    }

    # 语言和框架检测规则
    detections = [
        # (文件/目录, 语言, 框架, 包管理器, 构建工具)
        ("package.json", "JavaScript/TypeScript", None, "npm/yarn", None),
        ("tsconfig.json", "TypeScript", None, None, None),
        ("pyproject.toml", "Python", None, "pip/poetry", None),
        ("requirements.txt", "Python", None, "pip", None),
        ("Cargo.toml", "Rust", None, "cargo", "cargo"),
        ("go.mod", "Go", None, "go mod", "go"),
        ("pom.xml", "Java", None, "maven", "maven"),
        ("build.gradle", "Java/Kotlin", None, "gradle", "gradle"),
        ("Gemfile", "Ruby", None, "bundler", None),
        ("composer.json", "PHP", None, "composer", None),
        ("pubspec.yaml", "Dart", "Flutter", "pub", None),
        ("Package.swift", "Swift", None, "spm", None),
        # 框架检测
        ("next.config.js", None, "Next.js", None, None),
        ("nuxt.config.js", None, "Nuxt.js", None, None),
        ("vue.config.js", None, "Vue.js", None, None),
        ("angular.json", None, "Angular", None, None),
        ("svelte.config.js", None, "Svelte", None, None),
        ("manage.py", None, "Django", None, None),
        ("app.py", None, "Flask", None, None),
        ("fastapi", None, "FastAPI", None, None),
    ]

    for file_name, lang, framework, pkg_mgr, build_tool in detections:
        if (project_root / file_name).exists():
            if lang and lang not in tech_stack["languages"]:
                tech_stack["languages"].append(lang)
            if framework and framework not in tech_stack["frameworks"]:
                tech_stack["frameworks"].append(framework)
            if pkg_mgr and pkg_mgr not in tech_stack["package_managers"]:
                tech_stack["package_managers"].append(pkg_mgr)
            if build_tool and build_tool not in tech_stack["build_tools"]:
                tech_stack["build_tools"].append(build_tool)

    return tech_stack


def detect_modules(project_root: Path) -> dict:
    """检测模块结构"""
    modules = {
        "count": 0,
        "list": [],
        "by_type": defaultdict(list)
    }

    # 常见模块目录
    module_patterns = [
        ("src", "source"),
        ("lib", "library"),
        ("app", "application"),
        ("packages", "monorepo"),
        ("modules", "modules"),
        ("components", "components"),
        ("services", "services"),
        ("controllers", "controllers"),
        ("models", "models"),
        ("views", "views"),
        ("utils", "utilities"),
        ("helpers", "helpers"),
        ("api", "api"),
        ("core", "core"),
        ("common", "common"),
        ("shared", "shared")
    ]

    for dir_name, module_type in module_patterns:
        dir_path = project_root / dir_name
        if dir_path.is_dir():
            # 统计子目录作为模块
            for item in dir_path.iterdir():
                if item.is_dir() and not item.name.startswith("."):
                    if item.name not in EXCLUDE_DIRS:
                        modules["list"].append(f"{dir_name}/{item.name}")
                        modules["by_type"][module_type].append(item.name)
                        modules["count"] += 1

    return modules


def count_dependencies(project_root: Path) -> dict:
    """统计项目依赖项数量"""
    deps = {
        "total": 0,
        "by_type": {},
        "details": []
    }

    # package.json (npm/yarn)
    pkg_json = project_root / "package.json"
    if pkg_json.exists():
        try:
            import json
            with open(pkg_json, "r", encoding="utf-8") as f:
                data = json.load(f)
            npm_deps = len(data.get("dependencies", {}))
            npm_dev_deps = len(data.get("devDependencies", {}))
            deps["by_type"]["npm"] = npm_deps + npm_dev_deps
            deps["total"] += npm_deps + npm_dev_deps
            deps["details"].append(f"npm: {npm_deps} deps + {npm_dev_deps} devDeps")
        except Exception:
            pass

    # requirements.txt (pip)
    req_txt = project_root / "requirements.txt"
    if req_txt.exists():
        try:
            with open(req_txt, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]
            pip_deps = len(lines)
            deps["by_type"]["pip"] = pip_deps
            deps["total"] += pip_deps
            deps["details"].append(f"pip: {pip_deps} deps")
        except Exception:
            pass

    # pyproject.toml (poetry/pip)
    pyproject = project_root / "pyproject.toml"
    if pyproject.exists():
        try:
            with open(pyproject, "r", encoding="utf-8") as f:
                content = f.read()
            # 简单计数 dependencies 行
            import re
            deps_match = re.findall(r'^\s*[\w-]+\s*=', content, re.MULTILINE)
            if deps_match and "pip" not in deps["by_type"]:
                poetry_deps = len(deps_match) // 2  # 粗略估计
                deps["by_type"]["poetry"] = poetry_deps
                deps["total"] += poetry_deps
        except Exception:
            pass

    # go.mod (go)
    go_mod = project_root / "go.mod"
    if go_mod.exists():
        try:
            with open(go_mod, "r", encoding="utf-8") as f:
                content = f.read()
            import re
            go_deps = len(re.findall(r'^\s+\S+\s+v', content, re.MULTILINE))
            deps["by_type"]["go"] = go_deps
            deps["total"] += go_deps
            deps["details"].append(f"go: {go_deps} deps")
        except Exception:
            pass

    # Cargo.toml (rust)
    cargo = project_root / "Cargo.toml"
    if cargo.exists():
        try:
            with open(cargo, "r", encoding="utf-8") as f:
                content = f.read()
            import re
            cargo_deps = len(re.findall(r'^\s*[\w-]+\s*=\s*["{]', content, re.MULTILINE))
            deps["by_type"]["cargo"] = cargo_deps
            deps["total"] += cargo_deps
            deps["details"].append(f"cargo: {cargo_deps} deps")
        except Exception:
            pass

    return deps


def calculate_dir_depth(project_root: Path) -> dict:
    """计算目录层级深度"""
    depth_info = {
        "max_depth": 0,
        "avg_depth": 0,
        "deepest_path": ""
    }

    depths = []
    for root, dirs, files in os.walk(project_root):
        # 过滤排除目录
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]

        root_path = Path(root)
        try:
            rel_path = root_path.relative_to(project_root)
            depth = len(rel_path.parts)
            depths.append(depth)

            if depth > depth_info["max_depth"]:
                depth_info["max_depth"] = depth
                depth_info["deepest_path"] = str(rel_path)
        except ValueError:
            pass

    if depths:
        depth_info["avg_depth"] = round(sum(depths) / len(depths), 2)

    return depth_info


def scan_files(project_root: Path) -> dict:
    """扫描项目文件"""
    stats = {
        "total_files": 0,
        "source_files": 0,
        "config_files": 0,
        "total_lines": 0,
        "source_lines": 0,
        "by_extension": defaultdict(lambda: {"files": 0, "lines": 0}),
        "largest_files": []
    }

    file_sizes = []

    for root, dirs, files in os.walk(project_root):
        # 过滤排除目录
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]

        root_path = Path(root)
        if should_exclude(root_path.relative_to(project_root)):
            continue

        for file in files:
            file_path = root_path / file
            ext = file_path.suffix.lower()

            if not ext:
                continue

            stats["total_files"] += 1
            lines = count_lines(file_path)
            stats["total_lines"] += lines

            stats["by_extension"][ext]["files"] += 1
            stats["by_extension"][ext]["lines"] += lines

            if ext in SOURCE_EXTENSIONS:
                stats["source_files"] += 1
                stats["source_lines"] += lines
                file_sizes.append((str(file_path.relative_to(project_root)), lines))
            elif ext in CONFIG_EXTENSIONS:
                stats["config_files"] += 1

    # 找出最大的文件
    file_sizes.sort(key=lambda x: x[1], reverse=True)
    stats["largest_files"] = file_sizes[:10]

    # 转换defaultdict为普通dict
    stats["by_extension"] = dict(stats["by_extension"])

    return stats


def determine_project_size(stats: dict, modules: dict, deps: dict, depth: dict) -> dict:
    """判定项目规模"""
    size = {
        "category": "small",
        "is_large": False,
        "reasons": []
    }

    thresholds = LARGE_PROJECT_THRESHOLDS

    if stats["source_files"] > thresholds["files"]:
        size["reasons"].append(f"源文件数 {stats['source_files']} > {thresholds['files']}")
        size["is_large"] = True

    if stats["source_lines"] > thresholds["lines"]:
        size["reasons"].append(f"代码行数 {stats['source_lines']} > {thresholds['lines']}")
        size["is_large"] = True

    if modules["count"] > thresholds["modules"]:
        size["reasons"].append(f"模块数 {modules['count']} > {thresholds['modules']}")
        size["is_large"] = True

    if size["is_large"]:
        size["category"] = "large"
    elif stats["source_files"] > 100 or stats["source_lines"] > 10000:
        size["category"] = "medium"

    return size


@script_error_handler
def main():
    """主函数"""
    setup_encoding()

    parser = argparse.ArgumentParser(
        description="统计项目规模（文件数、代码行数、模块数）"
    )
    parser.add_argument(
        "--path",
        default=None,
        help="项目根目录（默认: 当前目录）"
    )

    args = parser.parse_args()

    # 获取项目根目录
    try:
        project_root = get_project_root(args.path)
    except ValueError as e:
        print(json.dumps({
            "error": str(e)
        }, ensure_ascii=False, indent=2))
        sys.exit(3)

    # 执行统计
    modules = detect_modules(project_root)
    deps = count_dependencies(project_root)
    depth = calculate_dir_depth(project_root)
    files = scan_files(project_root)

    results = {
        "timestamp": datetime.now().isoformat(),
        "project_root": str(project_root),
        "tech_stack": detect_tech_stack(project_root),
        "modules": modules,
        "dependencies": deps,
        "dir_depth": depth,
        "files": files,
        "size": {},
        "thresholds": LARGE_PROJECT_THRESHOLDS
    }

    # 判定项目规模
    results["size"] = determine_project_size(files, modules, deps, depth)

    # 输出JSON结果
    print(json.dumps(results, ensure_ascii=False, indent=2))

    # 返回状态码（0=小型, 1=中型, 2=大型）
    size_codes = {"small": 0, "medium": 1, "large": 2}
    sys.exit(size_codes.get(results["size"]["category"], 0))


if __name__ == "__main__":
    main()

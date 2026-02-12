#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 脚本工具函数
提供路径解析、方案包操作等通用功能
"""

import re
import os
import sys
import io
import functools


def setup_encoding():
    """
    设置 stdout/stderr 编码为 UTF-8
    解决 Windows 命令行中文输出乱码问题
    """
    if sys.platform == 'win32':
        # Windows 环境下强制使用 UTF-8
        if hasattr(sys.stdout, 'buffer'):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        if hasattr(sys.stderr, 'buffer'):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Callable, Any
import json


# === 执行报告机制 ===

class ExecutionReport:
    """
    脚本执行报告 - 用于 AI 降级接手

    当脚本无法完成全部任务时，通过此报告告知 AI：
    - 已完成的步骤（需质量检查）
    - 失败点
    - 待完成的任务
    - 执行上下文

    用法:
        report = ExecutionReport("create_package")
        report.set_context(feature="login", pkg_type="implementation")

        # 完成一个步骤
        report.mark_completed("创建目录", ".helloagents/plan/202501_login", "检查目录是否存在")

        # 遇到错误
        report.mark_failed("加载模板 proposal.md", ["创建 proposal.md", "创建 tasks.md"])

        # 输出报告
        print(report.to_json())
    """

    def __init__(self, script_name: str):
        self.script_name = script_name
        self.success = True
        self.completed: List[Dict[str, str]] = []  # [{"step": "", "result": "", "verify": ""}]
        self.failed_at: Optional[str] = None
        self.error_message: Optional[str] = None
        self.pending: List[str] = []
        self.context: Dict[str, Any] = {}

    def set_context(self, **kwargs):
        """设置执行上下文"""
        self.context.update(kwargs)

    def mark_completed(self, step: str, result: str, verify: str):
        """
        标记步骤完成

        Args:
            step: 步骤描述
            result: 执行结果（如文件路径）
            verify: AI 质量检查方法
        """
        self.completed.append({
            "step": step,
            "result": result,
            "verify": verify
        })

    def mark_failed(self, step: str, pending: List[str], error_message: str = None):
        """
        标记失败并设置待完成任务

        Args:
            step: 失败的步骤
            pending: 待完成的任务列表
            error_message: 错误信息
        """
        self.success = False
        self.failed_at = step
        self.pending = pending
        self.error_message = error_message

    def mark_success(self, final_result: str = None):
        """标记全部完成"""
        self.success = True
        if final_result:
            self.context["final_result"] = final_result

    def to_dict(self) -> Dict:
        """转换为字典"""
        result = {
            "script": self.script_name,
            "success": self.success,
            "completed": self.completed,
            "context": self.context
        }
        if not self.success:
            result["failed_at"] = self.failed_at
            result["error_message"] = self.error_message
            result["pending"] = self.pending
        return result

    def to_json(self) -> str:
        """转换为 JSON 字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def print_report(self):
        """输出执行报告到 stdout"""
        print(self.to_json())


def create_execution_report(script_name: str) -> ExecutionReport:
    """创建执行报告的工厂函数"""
    return ExecutionReport(script_name)


# === 错误处理模板 ===

def script_error_handler(func: Callable) -> Callable:
    """
    统一脚本错误处理装饰器

    用法:
        @script_error_handler
        def main():
            ...
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        try:
            return func(*args, **kwargs)
        except KeyboardInterrupt:
            print("\n操作已取消", file=sys.stderr)
            sys.exit(130)
        except FileNotFoundError as e:
            print(f"错误: 文件未找到 - {e.filename}", file=sys.stderr)
            sys.exit(1)
        except PermissionError as e:
            print(f"错误: 权限不足 - {e.filename}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"错误: {e}", file=sys.stderr)
            sys.exit(1)
    return wrapper


def print_error(message: str) -> None:
    """输出错误信息到 stderr"""
    print(f"❌ {message}", file=sys.stderr)


def print_success(message: str) -> None:
    """输出成功信息"""
    print(f"✅ {message}")


# === 路径工具 ===

# 方案包目录名称正则模式
PACKAGE_NAME_PATTERN = re.compile(r'^(\d{12})_(.+)$')

# HelloAGENTS 工作空间默认路径
DEFAULT_WORKSPACE = ".helloagents"


def validate_base_path(base_path: Optional[str]) -> Path:
    """
    验证并返回基础路径

    Args:
        base_path: 用户指定的路径，None 表示使用当前目录

    Returns:
        验证后的 Path 对象

    Raises:
        ValueError: 路径不存在或不是目录
    """
    if base_path is None:
        return Path.cwd()

    path = Path(base_path)
    if not path.exists():
        raise ValueError(f"指定的路径不存在: {base_path}")
    if not path.is_dir():
        raise ValueError(f"指定的路径不是目录: {base_path}")
    return path


def get_workspace_path(base_path: Optional[str] = None) -> Path:
    """
    获取 HelloAGENTS 工作空间路径

    如果 .helloagents/ 不存在但旧版 helloagents/ 存在，自动迁移目录名。
    确保所有脚本在未经显式 --migrate-root 的情况下也能正确定位工作空间。

    Args:
        base_path: 项目根目录，默认当前目录

    Returns:
        工作空间路径 (.helloagents/)
    """
    base = Path(base_path) if base_path else Path.cwd()
    new_path = base / DEFAULT_WORKSPACE
    legacy_path = base / "helloagents"

    if not new_path.exists() and legacy_path.exists() and legacy_path.is_dir():
        # 检查是否为旧版知识库目录（含 INDEX.md 或 modules/ 等知识库特征文件）
        is_kb = any(
            (legacy_path / marker).exists()
            for marker in ("INDEX.md", "context.md", "modules", "plan", "CHANGELOG.md")
        )
        if is_kb:
            try:
                legacy_path.rename(new_path)
            except OSError:
                pass  # 迁移失败时静默回退，由上层流程处理

    return new_path


def get_plan_path(base_path: Optional[str] = None) -> Path:
    """获取 plan/ 目录路径"""
    return get_workspace_path(base_path) / "plan"


def get_archive_path(base_path: Optional[str] = None) -> Path:
    """获取 archive/ 目录路径"""
    return get_workspace_path(base_path) / "archive"


def parse_package_name(name: str) -> Optional[Tuple[str, str]]:
    """
    解析方案包目录名称

    Args:
        name: 目录名称，如 "202512191430_login"

    Returns:
        (timestamp, feature) 元组，解析失败返回 None
    """
    match = PACKAGE_NAME_PATTERN.match(name)
    if match:
        return match.group(1), match.group(2)
    return None


def generate_package_name(feature: str) -> str:
    """
    生成方案包目录名称

    Args:
        feature: 功能名称

    Returns:
        格式化的目录名称，如 "202512191430_login"

    Raises:
        ValueError: 功能名称无效（规范化后为空）
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    # 规范化 feature 名称：小写、连字符替换空格
    normalized = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff]+', '-', feature.strip().lower())
    normalized = normalized.strip('-')
    if not normalized:
        raise ValueError("功能名称无效：必须包含字母、数字或中文字符")
    return f"{timestamp}_{normalized}"


def get_year_month(timestamp: str) -> str:
    """
    从时间戳提取年月

    Args:
        timestamp: 12位时间戳，如 "202512191430"

    Returns:
        年月格式，如 "2025-12"
    """
    return f"{timestamp[:4]}-{timestamp[4:6]}"


def list_packages(plan_path: Path) -> List[Dict]:
    """
    列出所有方案包

    Args:
        plan_path: plan/ 目录路径

    Returns:
        方案包信息列表
    """
    packages = []
    if not plan_path.exists():
        return packages

    for item in plan_path.iterdir():
        if item.is_dir():
            parsed = parse_package_name(item.name)
            if parsed:
                timestamp, feature = parsed
                pkg_info = {
                    'name': item.name,
                    'path': item,
                    'timestamp': timestamp,
                    'feature': feature,
                    'complete': is_package_complete(item),
                    'task_count': count_tasks(item / "tasks.md")
                }
                packages.append(pkg_info)

    # 按时间戳排序（最新在前）
    packages.sort(key=lambda x: x['timestamp'], reverse=True)
    return packages


def is_package_complete(package_path: Path) -> bool:
    """
    检查方案包是否完整

    Args:
        package_path: 方案包目录路径

    Returns:
        是否包含所有必需文件
    """
    required_files = ['proposal.md', 'tasks.md']
    return all((package_path / f).exists() for f in required_files)


def count_tasks(task_file: Path) -> int:
    """
    统计任务数量

    Args:
        task_file: tasks.md 文件路径

    Returns:
        任务数量
    """
    if not task_file.exists():
        return 0

    content = task_file.read_text(encoding='utf-8')
    # 匹配任务行: - [ ] 或 * [ ] 或 - [x] 或 - [√] 等
    tasks = re.findall(r'^[-*]\s*\[.\]', content, re.MULTILINE)
    return len(tasks)


def get_package_summary(package_path: Path) -> str:
    """
    获取方案包摘要（从 proposal.md 提取）

    Args:
        package_path: 方案包目录路径

    Returns:
        功能摘要
    """
    proposal_file = package_path / "proposal.md"
    if not proposal_file.exists():
        return "(无描述)"

    content = proposal_file.read_text(encoding='utf-8')
    # 尝试提取第一个非标题非空行
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('---'):
            # 截断过长的描述
            return line[:50] + "..." if len(line) > 50 else line

    return "(无描述)"


# === 模板工具（兼容导出，实现已迁移至 template_utils.py） ===

try:
    from .template_utils import (  # noqa: F401
        get_templates_dir,
        load_template,
        fill_template,
        extract_template_sections,
        extract_required_sections,
        get_template_table_headers,
        TemplateLoader,
        get_template_loader,
    )
except ImportError:
    from template_utils import (  # noqa: F401  # type: ignore[no-redef]
        get_templates_dir,
        load_template,
        fill_template,
        extract_template_sections,
        extract_required_sections,
        get_template_table_headers,
        TemplateLoader,
        get_template_loader,
    )

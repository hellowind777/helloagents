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
        report.mark_completed("创建目录", "helloagents/plan/202501_login", "检查目录是否存在")

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
DEFAULT_WORKSPACE = "helloagents"


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

    Args:
        base_path: 项目根目录，默认当前目录

    Returns:
        工作空间路径 (helloagents/)
    """
    base = Path(base_path) if base_path else Path.cwd()
    return base / DEFAULT_WORKSPACE


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


# === 模板加载机制 ===

def get_templates_dir() -> Path:
    """
    获取模板目录路径

    Returns:
        模板目录的绝对路径 (assets/templates/)
    """
    return Path(__file__).parent.parent / "assets" / "templates"


def load_template(template_path: str, required: bool = True) -> Optional[str]:
    """
    加载模板文件内容

    Args:
        template_path: 相对于模板目录的路径，如 "plan/proposal.md"
        required: 是否必须存在，False 时不存在返回 None

    Returns:
        模板内容，或 None（当 required=False 且文件不存在时）

    Raises:
        FileNotFoundError: 当 required=True 且模板不存在时
    """
    full_path = get_templates_dir() / template_path

    if full_path.exists():
        return full_path.read_text(encoding='utf-8')

    if required:
        raise FileNotFoundError(f"模板文件不存在: {template_path}")

    return None


def fill_template(template: str, replacements: Dict[str, str]) -> str:
    """
    填充模板占位符

    Args:
        template: 模板内容
        replacements: 占位符替换映射，如 {"{feature}": "login", "{YYYY-MM-DD}": "2025-01-19"}

    Returns:
        填充后的内容
    """
    content = template
    for placeholder, value in replacements.items():
        content = content.replace(placeholder, value)
    return content


def extract_template_sections(template: str, level: int = 2) -> List[str]:
    """
    从模板中提取章节标题

    Args:
        template: 模板内容
        level: 标题级别（2 表示 ##，3 表示 ###）

    Returns:
        章节标题列表
    """
    pattern = rf'^{"#" * level}\s+(.+)$'
    return re.findall(pattern, template, re.MULTILINE)


def extract_required_sections(template: str) -> List[str]:
    """
    从模板中提取必需章节（不含"可选"标记的章节）

    Args:
        template: 模板内容

    Returns:
        必需章节的核心名称列表（去除编号和可选标记）
    """
    sections = extract_template_sections(template, level=2)
    required = []

    for section in sections:
        # 跳过包含"可选"标记的章节
        if '可选' in section or 'optional' in section.lower():
            continue
        # 提取核心名称：移除编号前缀（如 "1. "）
        core = re.sub(r'^\d+\.\s*', '', section).strip()
        if core:
            required.append(core)

    return required


def get_template_table_headers(template: str) -> List[List[str]]:
    """
    从模板中提取表格表头

    Args:
        template: 模板内容

    Returns:
        表格表头列表，每个表格是一个列名列表
    """
    tables = []
    lines = template.split('\n')

    for i, line in enumerate(lines):
        # 检测表格表头行（下一行是分隔行）
        if line.startswith('|') and i + 1 < len(lines):
            next_line = lines[i + 1]
            if next_line.startswith('|') and '---' in next_line:
                # 提取列名
                headers = [h.strip() for h in line.split('|')[1:-1]]
                tables.append(headers)

    return tables


class TemplateLoader:
    """
    模板加载器 - 提供统一的模板访问接口

    用法:
        loader = TemplateLoader()

        # 加载模板
        proposal = loader.load("plan/proposal.md")

        # 填充占位符
        content = loader.fill("plan/proposal.md", {
            "{feature}": "login",
            "{YYYY-MM-DD}": "2025-01-19"
        })

        # 获取必需章节
        sections = loader.get_required_sections("plan/proposal.md")
    """

    def __init__(self):
        self._cache: Dict[str, str] = {}
        self._templates_dir = get_templates_dir()

    def load(self, template_path: str, use_cache: bool = True) -> Optional[str]:
        """
        加载模板（带缓存）

        Args:
            template_path: 相对路径
            use_cache: 是否使用缓存

        Returns:
            模板内容，不存在时返回 None
        """
        if use_cache and template_path in self._cache:
            return self._cache[template_path]

        content = load_template(template_path, required=False)

        if content is not None and use_cache:
            self._cache[template_path] = content

        return content

    def fill(self, template_path: str, replacements: Dict[str, str]) -> Optional[str]:
        """
        加载并填充模板

        Args:
            template_path: 相对路径
            replacements: 占位符映射

        Returns:
            填充后的内容，模板不存在时返回 None
        """
        template = self.load(template_path)
        if template is None:
            return None
        return fill_template(template, replacements)

    def get_sections(self, template_path: str, level: int = 2) -> List[str]:
        """获取模板章节标题"""
        template = self.load(template_path)
        if template is None:
            return []
        return extract_template_sections(template, level)

    def get_required_sections(self, template_path: str) -> List[str]:
        """获取必需章节"""
        template = self.load(template_path)
        if template is None:
            return []
        return extract_required_sections(template)

    def get_table_headers(self, template_path: str) -> List[List[str]]:
        """获取表格表头"""
        template = self.load(template_path)
        if template is None:
            return []
        return get_template_table_headers(template)

    def exists(self, template_path: str) -> bool:
        """检查模板是否存在"""
        return (self._templates_dir / template_path).exists()

    def clear_cache(self):
        """清除缓存"""
        self._cache.clear()


# 全局模板加载器实例
_template_loader: Optional[TemplateLoader] = None


def get_template_loader() -> TemplateLoader:
    """获取全局模板加载器实例"""
    global _template_loader
    if _template_loader is None:
        _template_loader = TemplateLoader()
    return _template_loader

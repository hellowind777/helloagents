#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 模板工具
提供模板加载、填充、解析等功能
"""

import re
from pathlib import Path
from typing import Optional, List, Dict


# === 模板路径 ===

def get_templates_dir() -> Path:
    """
    获取模板目录路径

    Returns:
        模板目录的绝对路径 (templates/)
    """
    return Path(__file__).parent.parent / "templates"


# === 模板加载与填充 ===

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


# === 模板解析 ===

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


# === TemplateLoader 类 ===

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


# === 全局实例 ===

_template_loader: Optional[TemplateLoader] = None


def get_template_loader() -> TemplateLoader:
    """获取全局模板加载器实例"""
    global _template_loader
    if _template_loader is None:
        _template_loader = TemplateLoader()
    return _template_loader

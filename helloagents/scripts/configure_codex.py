#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS - Codex CLI 配置工具
检测 Codex CLI 环境并设置 project_doc_max_bytes，确保 AGENTS.md 不被截断。
仅在检测到 Codex CLI 时执行，保护已有配置数据。
"""

import sys
import os
import re
import io

# === 编码设置 ===
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from pathlib import Path

# 导入 ExecutionReport
try:
    from utils import ExecutionReport, script_error_handler
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import ExecutionReport, script_error_handler


# === 常量 ===
TARGET_BYTES = 98304  # 96 KiB
PARAM_NAME = "project_doc_max_bytes"


def get_codex_home() -> Path:
    """获取 Codex CLI 主目录路径"""
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home)
    return Path.home() / ".codex"


def detect_codex() -> bool:
    """检测 Codex CLI 是否已安装"""
    return get_codex_home().is_dir()


def read_config(config_path: Path) -> str:
    """读取 config.toml 内容，文件不存在返回空字符串"""
    if config_path.exists():
        return config_path.read_text(encoding='utf-8')
    return ""


def parse_current_value(content: str):
    """
    从 config.toml 文本中提取 project_doc_max_bytes 的当前值。
    返回 (int, line_number) 或 (None, None)。
    """
    for i, line in enumerate(content.splitlines()):
        stripped = line.strip()
        # 跳过注释和空行
        if not stripped or stripped.startswith('#'):
            continue
        match = re.match(rf'^{PARAM_NAME}\s*=\s*(\d+)', stripped)
        if match:
            return int(match.group(1)), i
    return None, None


def find_insert_position(content: str) -> int:
    """
    找到顶层参数区的末尾位置（第一个 [table] 之前）。
    返回应插入的行号。
    """
    lines = content.splitlines()
    last_toplevel = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        # 遇到 [table] 头部，停止
        if stripped.startswith('[') and not stripped.startswith('[['):
            return last_toplevel + 1 if last_toplevel > 0 else i
        # 记录最后一个非空非注释的顶层行
        if stripped and not stripped.startswith('#'):
            last_toplevel = i
    # 没有 [table]，追加到末尾
    return len(lines)


def update_config(content: str) -> tuple:
    """
    更新配置内容。
    返回 (new_content, action) 其中 action 为 'created'|'updated'|'skipped'。
    """
    current_val, line_num = parse_current_value(content)

    if current_val is not None:
        if current_val >= TARGET_BYTES:
            return content, "skipped"
        # 替换现有值
        lines = content.splitlines(keepends=True)
        old_line = lines[line_num]
        lines[line_num] = re.sub(
            rf'{PARAM_NAME}\s*=\s*\d+',
            f'{PARAM_NAME} = {TARGET_BYTES}',
            old_line
        )
        return "".join(lines), "updated"

    # 参数不存在，插入
    if not content.strip():
        # 空文件或不存在
        return f"{PARAM_NAME} = {TARGET_BYTES}\n", "created"

    lines = content.splitlines(keepends=True)
    pos = find_insert_position(content)
    insert_line = f"{PARAM_NAME} = {TARGET_BYTES}\n"
    lines.insert(pos, insert_line)
    return "".join(lines), "created"


@script_error_handler
def main():
    report = ExecutionReport("configure_codex")

    # 步骤1: 检测 Codex CLI
    if not detect_codex():
        report.set_context(codex_detected=False)
        report.mark_success("Codex CLI 未检测到，跳过配置")
        report.print_report()
        return

    report.mark_completed("检测 Codex CLI", "已安装", "检查 ~/.codex/ 目录存在")

    # 步骤2: 读取现有配置
    codex_home = get_codex_home()
    config_path = codex_home / "config.toml"
    content = read_config(config_path)
    file_existed = config_path.exists()

    report.mark_completed(
        "读取 config.toml",
        f"{'已存在' if file_existed else '不存在'}，{len(content)} 字节",
        "确认文件读取完整"
    )

    # 步骤3: 更新配置
    new_content, action = update_config(content)

    if action == "skipped":
        current_val, _ = parse_current_value(content)
        report.set_context(
            action="skipped",
            reason=f"当前值 {current_val} >= 目标值 {TARGET_BYTES}，无需修改"
        )
        report.mark_success(f"{PARAM_NAME} 已满足要求（当前值: {current_val}）")
        report.print_report()
        return

    # 步骤4: 写入文件
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(new_content, encoding='utf-8')

    report.mark_completed(
        "写入 config.toml",
        f"{action}: {PARAM_NAME} = {TARGET_BYTES}",
        "读取文件确认参数值正确"
    )

    # 验证写入
    verify_content = config_path.read_text(encoding='utf-8')
    verify_val, _ = parse_current_value(verify_content)
    if verify_val == TARGET_BYTES:
        report.set_context(
            action=action,
            config_path=str(config_path),
            target_bytes=TARGET_BYTES
        )
        report.mark_success(f"{PARAM_NAME} = {TARGET_BYTES} (96 KiB)")
    else:
        report.mark_failed("验证写入", ["手动检查 config.toml"], "写入后验证失败")

    report.print_report()


if __name__ == "__main__":
    main()

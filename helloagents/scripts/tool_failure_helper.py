#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS PostToolUseFailure Hook — 工具失败错误恢复建议

匹配所有工具的失败事件，根据已知错误模式注入恢复建议到 additionalContext。

输入(stdin): JSON，包含 tool_name, error 等字段
输出(stdout): JSON {hookSpecificOutput: {additionalContext}} 或空
"""

import sys
import io
import json
import re

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')


# ---------------------------------------------------------------------------
# 已知错误模式 → 恢复建议
# ---------------------------------------------------------------------------

ERROR_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'Permission denied|EACCES', re.IGNORECASE),
     "权限错误: 检查文件/目录权限，可能需要 chmod 或以管理员权限运行。"
     "如果是 node_modules/.bin 权限问题，尝试删除 node_modules 重新安装。"),

    (re.compile(r'FileNotFoundError|ENOENT|No such file or directory', re.IGNORECASE),
     "文件未找到: 检查路径是否正确，注意大小写敏感性。"
     "使用 ls 或 Glob 确认文件存在。路径中的空格需要引号包裹。"),

    (re.compile(r'UnicodeDecodeError|UnicodeEncodeError', re.IGNORECASE),
     "编码错误: 文件可能不是 UTF-8 编码。尝试使用 encoding='utf-8' errors='replace' 参数，"
     "或先用 file 命令检测文件编码。"),

    (re.compile(r'ENOSPC|disk quota|No space left on device', re.IGNORECASE),
     "磁盘空间不足: 运行 df -h 检查磁盘使用情况，"
     "清理临时文件、node_modules、__pycache__ 等释放空间。"),

    (re.compile(r'CONFLICT|merge conflict|Merge conflict', re.IGNORECASE),
     "Git 合并冲突: 使用 git status 查看冲突文件列表，"
     "逐个编辑解决冲突标记（<<<< ==== >>>>），然后 git add 标记已解决。"),

    (re.compile(r'ModuleNotFoundError|ImportError|Cannot find module', re.IGNORECASE),
     "模块未找到: 检查依赖是否已安装。"
     "Python: pip install <package> 或检查虚拟环境。"
     "Node.js: npm install 或检查 package.json。"),

    (re.compile(r'SyntaxError|IndentationError', re.IGNORECASE),
     "语法错误: 检查最近修改的代码，注意缩进一致性（空格 vs Tab）、"
     "引号配对、括号配对。可以用 python -m py_compile <file> 定位。"),

    (re.compile(r'ETIMEDOUT|ECONNREFUSED|timeout|timed out', re.IGNORECASE),
     "网络超时/连接拒绝: 检查网络连接、代理设置、目标服务是否运行。"
     "可尝试增加超时时间或使用重试机制。"),
]


def get_suggestion(error_text: str) -> str:
    """匹配错误文本，返回恢复建议。无匹配返回空字符串。"""
    for pattern, suggestion in ERROR_PATTERNS:
        if pattern.search(error_text):
            return suggestion
    return ""


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_name = data.get("tool_name", "") or "Unknown"
    error = data.get("error", "")
    if not error:
        sys.exit(0)

    suggestion = get_suggestion(error)
    if not suggestion:
        sys.exit(0)

    result = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUseFailure",
            "additionalContext": (
                f"[HelloAGENTS] {tool_name} 失败恢复建议:\n{suggestion}"
            ),
        }
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

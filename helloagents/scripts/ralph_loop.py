#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 质量验证循环脚本 (Ralph Loop)

借鉴 Trellis 的 ralph-loop.py，利用 SubagentStop hook 的 decision: "block" 能力。
当代码实现类子代理完成时，自动运行项目验证命令（lint/typecheck/test），
不通过则阻止子代理停止并反馈错误，子代理继续修复，形成自动质量闭环。

输入(stdin): JSON，包含 agent_type, stop_hook_active, cwd 等字段
输出(stdout): JSON，包含 decision 和 reason（验证失败时）
"""

import sys
import json
import subprocess
import io
from pathlib import Path
from typing import List, Optional

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# 验证命令执行超时（秒）
CMD_TIMEOUT = 60


def load_verify_yaml(cwd: str) -> Optional[List[str]]:
    """从 .helloagents/verify.yaml 读取自定义验证命令。"""
    verify_file = Path(cwd) / ".helloagents" / "verify.yaml"
    if not verify_file.is_file():
        return None

    try:
        content = verify_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None

    # 简易 YAML 解析：提取 commands 列表中的非注释行
    commands = []
    in_commands = False
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("commands:"):
            in_commands = True
            continue
        if in_commands:
            if stripped.startswith("- ") and not stripped.startswith("# "):
                cmd = stripped[2:].strip().strip('"').strip("'")
                if cmd and not cmd.startswith("#"):
                    commands.append(cmd)
            elif stripped and not stripped.startswith("#"):
                # 遇到非列表项非注释行，结束 commands 块
                break

    return commands if commands else None


def detect_from_package_json(cwd: str) -> List[str]:
    """从 package.json scripts 中检测 lint/typecheck/test 命令。"""
    pkg_file = Path(cwd) / "package.json"
    if not pkg_file.is_file():
        return []

    try:
        data = json.loads(pkg_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    scripts = data.get("scripts", {})
    commands = []
    for key in ("lint", "typecheck", "type-check", "test"):
        if key in scripts:
            commands.append(f"npm run {key}")
    return commands


def detect_verify_commands(cwd: str) -> List[str]:
    """按优先级检测验证命令: verify.yaml > package.json > pyproject.toml。"""
    # 优先级1: 自定义配置
    custom = load_verify_yaml(cwd)
    if custom:
        return custom

    # 优先级2: package.json
    npm_cmds = detect_from_package_json(cwd)
    if npm_cmds:
        return npm_cmds

    # 优先级3: pyproject.toml
    py_cmds = detect_from_pyproject(cwd)
    if py_cmds:
        return py_cmds

    return []


def run_verification(commands: List[str], cwd: str) -> tuple:
    """
    依次执行验证命令，收集结果。

    Returns:
        (all_passed: bool, failures: list[dict])
    """
    failures = []
    for cmd in commands:
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=cwd,
                capture_output=True,
                timeout=CMD_TIMEOUT,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode != 0:
                stdout = result.stdout or ""
                stderr = result.stderr or ""
                output = (stdout + stderr).strip()
                # 截断过长输出
                if len(output) > 1000:
                    output = output[:1000] + "\n...(已截断)"
                failures.append({"cmd": cmd, "output": output})
        except subprocess.TimeoutExpired:
            failures.append({"cmd": cmd, "output": f"超时（>{CMD_TIMEOUT}s）"})
        except OSError as e:
            failures.append({"cmd": cmd, "output": str(e)})

    return len(failures) == 0, failures


def detect_from_pyproject(cwd: str) -> List[str]:
    """从 pyproject.toml 检测常见验证命令。"""
    pyproject = Path(cwd) / "pyproject.toml"
    if not pyproject.is_file():
        return []

    try:
        content = pyproject.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    commands = []
    # 检测 ruff/flake8/mypy/pytest 配置
    if "[tool.ruff" in content:
        commands.append("ruff check .")
    if "[tool.mypy" in content:
        commands.append("mypy .")
    if "[tool.pytest" in content:
        commands.append("pytest --tb=short -q")
    return commands


def main():
    """主入口: 从 stdin 读取 SubagentStop 事件，执行质量验证循环。"""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # 防无限循环: stop_hook_active=true 说明已在循环中，直接放行
    if data.get("stop_hook_active", False):
        sys.exit(0)

    # 仅对 general-purpose 类型生效（代码实现子代理）
    agent_type = data.get("agent_type", "")
    if agent_type != "general-purpose":
        sys.exit(0)

    cwd = data.get("cwd", ".")

    # 检测验证命令
    commands = detect_verify_commands(cwd)
    if not commands:
        sys.exit(0)

    # 执行验证
    all_passed, failures = run_verification(commands, cwd)

    if all_passed:
        sys.exit(0)

    # 有失败 → 阻止子代理停止，反馈错误
    details = []
    for f in failures:
        details.append(f"❌ {f['cmd']}:\n{f['output']}")
    reason = "验证未通过，请修复:\n" + "\n\n".join(details)

    result = {"decision": "block", "reason": reason}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
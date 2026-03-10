#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS 质量验证循环 (Ralph Loop) — SubagentStop hook

代码实现类子代理完成时自动运行验证命令，不通过则阻止停止并反馈错误。
"""

import sys
import json
import subprocess
import io
from pathlib import Path

if sys.platform == 'win32':
    for stream in ('stdout', 'stderr', 'stdin'):
        s = getattr(sys, stream)
        if hasattr(s, 'buffer'):
            setattr(sys, stream, io.TextIOWrapper(s.buffer, encoding='utf-8', errors='replace'))

CMD_TIMEOUT = 60


def _load_verify_yaml(cwd):
    f = Path(cwd) / ".helloagents" / "verify.yaml"
    if not f.is_file():
        return None
    try:
        content = f.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    cmds, in_cmds = [], False
    for line in content.split("\n"):
        s = line.strip()
        if s.startswith("commands:"):
            in_cmds = True
            continue
        if in_cmds:
            if s.startswith("- ") and not s.startswith("# "):
                cmd = s[2:].strip().strip('"').strip("'")
                if cmd and not cmd.startswith("#"):
                    cmds.append(cmd)
            elif s and not s.startswith("#"):
                break
    return cmds or None


def _detect_from_pkg_json(cwd):
    f = Path(cwd) / "package.json"
    if not f.is_file():
        return []
    try:
        scripts = json.loads(f.read_text(encoding="utf-8")).get("scripts", {})
    except (OSError, json.JSONDecodeError):
        return []
    return [f"npm run {k}" for k in ("lint", "typecheck", "type-check", "test") if k in scripts]


def _detect_from_pyproject(cwd):
    f = Path(cwd) / "pyproject.toml"
    if not f.is_file():
        return []
    try:
        content = f.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    cmds = []
    if "[tool.ruff" in content:
        cmds.append("ruff check .")
    if "[tool.mypy" in content:
        cmds.append("mypy .")
    if "[tool.pytest" in content:
        cmds.append("pytest --tb=short -q")
    return cmds


def _detect_commands(cwd):
    return _load_verify_yaml(cwd) or _detect_from_pkg_json(cwd) or _detect_from_pyproject(cwd)


def _run_verify(commands, cwd):
    failures = []
    for cmd in commands:
        try:
            r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True,
                               timeout=CMD_TIMEOUT, encoding="utf-8", errors="replace")
            if r.returncode != 0:
                out = ((r.stdout or "") + (r.stderr or "")).strip()
                if len(out) > 1000:
                    out = out[:1000] + "\n...(truncated)"
                failures.append({"cmd": cmd, "output": out})
        except subprocess.TimeoutExpired:
            failures.append({"cmd": cmd, "output": f"timeout (>{CMD_TIMEOUT}s)"})
        except OSError as e:
            failures.append({"cmd": cmd, "output": str(e)})
    return failures


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    if data.get("stop_hook_active") or data.get("agent_type") != "general-purpose":
        sys.exit(0)
    cwd = data.get("cwd", ".")
    commands = _detect_commands(cwd)
    if not commands:
        sys.exit(0)
    failures = _run_verify(commands, cwd)
    if not failures:
        sys.exit(0)
    details = "\n\n".join(f"❌ {f['cmd']}:\n{f['output']}" for f in failures)
    print(json.dumps({"decision": "block", "reason": f"验证未通过，请修复:\n{details}"},
                      ensure_ascii=False))


if __name__ == "__main__":
    main()

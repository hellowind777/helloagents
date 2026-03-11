#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HelloAGENTS 脚本工具函数 — 路径解析、方案包操作、模板加载"""

import re
import os
import sys
import io
import json
import locale
import functools
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any


# ---------------------------------------------------------------------------
# Locale & messaging
# ---------------------------------------------------------------------------

def _detect_locale() -> str:
    for var in ("LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"):
        if os.environ.get(var, "").lower().startswith("zh"):
            return "zh"
    try:
        if (locale.getlocale()[0] or "").lower().startswith("zh"):
            return "zh"
    except Exception:
        pass
    if sys.platform == "win32":
        try:
            import ctypes
            if (ctypes.windll.kernel32.GetUserDefaultUILanguage() & 0xFF) == 0x04:
                return "zh"
        except Exception:
            pass
    return "en"

_LANG = _detect_locale()

def _msg(zh: str, en: str) -> str:
    return zh if _LANG == "zh" else en

def setup_encoding():
    if sys.platform == 'win32':
        for stream in ('stdout', 'stderr', 'stdin'):
            s = getattr(sys, stream)
            if hasattr(s, 'buffer'):
                setattr(sys, stream, io.TextIOWrapper(s.buffer, encoding='utf-8', errors='replace'))


# ---------------------------------------------------------------------------
# Execution report (for AI degradation handoff)
# ---------------------------------------------------------------------------

class ExecutionReport:
    def __init__(self, script_name: str):
        self.script_name = script_name
        self.success = True
        self.completed: List[Dict[str, str]] = []
        self.failed_at: Optional[str] = None
        self.error_message: Optional[str] = None
        self.pending: List[str] = []
        self.context: Dict[str, Any] = {}

    def set_context(self, **kwargs):
        self.context.update(kwargs)

    def mark_completed(self, step: str, result: str, verify: str):
        self.completed.append({"step": step, "result": result, "verify": verify})

    def mark_failed(self, step: str, pending: List[str], error_message: str = None):
        self.success = False
        self.failed_at = step
        self.pending = pending
        self.error_message = error_message

    def mark_success(self, final_result: str = None):
        self.success = True
        if final_result:
            self.context["final_result"] = final_result

    def to_dict(self) -> Dict:
        r = {"script": self.script_name, "success": self.success,
             "completed": self.completed, "context": self.context}
        if not self.success:
            r.update(failed_at=self.failed_at, error_message=self.error_message,
                     pending=self.pending)
        return r

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def print_report(self):
        print(self.to_json())


def script_error_handler(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except KeyboardInterrupt:
            print(_msg("\n操作已取消", "\nCancelled"), file=sys.stderr)
            sys.exit(130)
        except Exception as e:
            print(_msg(f"错误: {e}", f"Error: {e}"), file=sys.stderr)
            sys.exit(1)
    return wrapper

def print_error(msg: str):
    print(f"❌ {msg}", file=sys.stderr)

def print_success(msg: str):
    print(f"✅ {msg}")


# ---------------------------------------------------------------------------
# Path utilities
# ---------------------------------------------------------------------------

PACKAGE_NAME_PATTERN = re.compile(r'^(\d{12})_(.+)$')
DEFAULT_WORKSPACE = ".helloagents"

def validate_base_path(base_path: Optional[str]) -> Path:
    if base_path is None:
        return Path.cwd()
    p = Path(base_path)
    if not p.is_dir():
        raise ValueError(f"路径无效: {base_path}")
    return p

def get_workspace_path(base_path: Optional[str] = None) -> Path:
    base = Path(base_path) if base_path else Path.cwd()
    if base.name == DEFAULT_WORKSPACE and base.is_dir():
        return base
    return base / DEFAULT_WORKSPACE

def get_plan_path(base_path=None) -> Path:
    return get_workspace_path(base_path) / "plan"

def get_archive_path(base_path=None) -> Path:
    return get_workspace_path(base_path) / "archive"

def parse_package_name(name: str) -> Optional[Tuple[str, str]]:
    m = PACKAGE_NAME_PATTERN.match(name)
    return (m.group(1), m.group(2)) if m else None

def generate_package_name(feature: str) -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    norm = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff]+', '-', feature.strip().lower()).strip('-')
    if not norm:
        raise ValueError("功能名称无效")
    return f"{ts}_{norm}"

def get_year_month(timestamp: str) -> str:
    return f"{timestamp[:4]}-{timestamp[4:6]}"

def list_packages(plan_path: Path) -> List[Dict]:
    if not plan_path.exists():
        return []
    pkgs = []
    for item in plan_path.iterdir():
        if item.is_dir():
            parsed = parse_package_name(item.name)
            if parsed:
                pkgs.append({'name': item.name, 'path': item, 'timestamp': parsed[0],
                             'feature': parsed[1],
                             'complete': all((item / f).exists() for f in ('proposal.md', 'tasks.md')),
                             'task_count': len(re.findall(r'^\s*[-*]\s*\[.\]',
                                              (item / "tasks.md").read_text(encoding='utf-8'), re.MULTILINE))
                                          if (item / "tasks.md").exists() else 0})
    pkgs.sort(key=lambda x: x['timestamp'], reverse=True)
    return pkgs

def get_package_summary(package_path: Path) -> str:
    f = package_path / "proposal.md"
    if not f.exists():
        return "(无描述)"
    for line in f.read_text(encoding='utf-8').split('\n'):
        line = line.strip()
        if line and not line.startswith('#') and not line.startswith('---'):
            return line[:50] + "..." if len(line) > 50 else line
    return "(无描述)"


# ---------------------------------------------------------------------------
# Template loader (inlined from deleted template_utils.py)
# ---------------------------------------------------------------------------

def _get_templates_dir() -> Path:
    return Path(__file__).parent.parent / "templates"


class TemplateLoader:
    def __init__(self):
        self._cache: Dict[str, str] = {}
        self._dir = _get_templates_dir()

    def load(self, path: str) -> Optional[str]:
        if path in self._cache:
            return self._cache[path]
        fp = self._dir / path
        if not fp.exists():
            return None
        content = fp.read_text(encoding='utf-8')
        self._cache[path] = content
        return content

    def fill(self, path: str, replacements: Dict[str, str]) -> Optional[str]:
        t = self.load(path)
        if t is None:
            return None
        for k, v in replacements.items():
            t = t.replace(k, v)
        return t

    def get_sections(self, path: str, level: int = 2) -> List[str]:
        t = self.load(path)
        if not t:
            return []
        return re.findall(rf'^{"#" * level}\s+(.+)$', t, re.MULTILINE)

    def exists(self, path: str) -> bool:
        return (self._dir / path).exists()


_loader: Optional[TemplateLoader] = None

def get_template_loader() -> TemplateLoader:
    global _loader
    if _loader is None:
        _loader = TemplateLoader()
    return _loader

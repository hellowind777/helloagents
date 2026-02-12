#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Shared Tasks Manager
多终端协作任务管理器 — 默认隔离，协作模式通过 hellotasks 环境变量启用。
"""

import json
import os
import platform
import sys
import time
try:
    import fcntl
except ImportError:  # Windows
    fcntl = None
try:
    import msvcrt
except ImportError:  # Non-Windows
    msvcrt = None
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


# ==================== 跨平台文件锁 ====================

class _FileLock:
    """Cross-platform file lock context manager with retry."""

    _WIN_LOCK_SIZE = 1024 * 1024  # 1MB

    def __init__(self, handle, exclusive: bool):
        self.handle = handle
        self.exclusive = exclusive
        self.locked = False

    def __enter__(self):
        for _ in range(3):
            if self._try_lock():
                self.locked = True
                return self
            time.sleep(0.1)
        return self

    def __exit__(self, *args):
        if not self.locked:
            return
        if platform.system() == "Windows":
            if msvcrt is None:
                return
            try:
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, self._WIN_LOCK_SIZE)
            except OSError:
                pass
        elif fcntl is not None:
            try:
                fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass

    def _try_lock(self) -> bool:
        if platform.system() == "Windows":
            if msvcrt is None:
                return True
            mode = msvcrt.LK_NBLCK if self.exclusive else msvcrt.LK_NBRLCK
            try:
                self.handle.seek(0)
                msvcrt.locking(self.handle.fileno(), mode, self._WIN_LOCK_SIZE)
                return True
            except OSError:
                return False
        if fcntl is None:
            return True
        try:
            lock_type = fcntl.LOCK_EX if self.exclusive else fcntl.LOCK_SH
            fcntl.flock(self.handle.fileno(), lock_type)
            return True
        except OSError:
            return False


class SharedTasksManager:
    """
    多终端协作任务管理器

    隔离模式（默认）: 直接运行 AI CLI
    协作模式: hellotasks=<任务列表ID> <AI CLI 命令>

    任务存储: {项目目录}/.helloagents/tasks/{list_id}.json
    """

    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or Path.cwd()
        self.tasks_dir = self.project_root / ".helloagents" / "tasks"

        self.list_id = os.environ.get("hellotasks")
        self.is_collaborative = bool(self.list_id)

        if self.is_collaborative:
            self.tasks_dir.mkdir(parents=True, exist_ok=True)
            self.tasks_file = self.tasks_dir / f"{self.list_id}.json"
            self._init_task_list()

    def _init_task_list(self):
        """初始化任务列表文件"""
        if not self.tasks_file.exists():
            self._write_tasks({
                "list_id": self.list_id,
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "tasks": [],
            })

    # ==================== 文件读写 ====================

    def _read_tasks(self) -> Dict[str, Any]:
        """读取任务列表（带共享锁）"""
        if not self.is_collaborative:
            return {"tasks": []}
        if not self.tasks_file.exists():
            return {"list_id": self.list_id, "tasks": []}
        try:
            with open(self.tasks_file, 'r', encoding='utf-8') as f:
                with _FileLock(f, exclusive=False) as lock:
                    if not lock.locked:
                        return {"list_id": self.list_id, "tasks": [],
                                "_error": "Failed to acquire lock"}
                    return json.load(f)
        except Exception:
            return {"list_id": self.list_id, "tasks": [],
                    "_error": "Failed to read tasks"}

    def _write_tasks(self, data: Dict[str, Any]) -> bool:
        """写入任务列表（带排他锁）"""
        if not self.is_collaborative:
            return False
        data["last_updated"] = datetime.now().isoformat()
        try:
            with open(self.tasks_file, 'w', encoding='utf-8') as f:
                with _FileLock(f, exclusive=True) as lock:
                    if not lock.locked:
                        return False
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    return True
        except Exception:
            return False

    def _find_task(self, task_id: str) -> tuple:
        """Find task by ID. Returns (data, task) or (data, None)."""
        data = self._read_tasks()
        for task in data.get("tasks", []):
            if task["id"] == task_id:
                return data, task
        return data, None

    # ==================== 任务 CRUD ====================

    def add_task(
        self,
        subject: str,
        description: str = "",
        blocks: Optional[List[str]] = None,
        blocked_by: Optional[List[str]] = None,
    ) -> Optional[str]:
        """添加任务，返回任务 ID，失败返回 None"""
        if not self.is_collaborative:
            return None

        data = self._read_tasks()
        task_id = f"t{len(data['tasks']) + 1}_{datetime.now().strftime('%H%M%S')}"

        task = {
            "id": task_id,
            "subject": subject,
            "description": description,
            "status": "pending",
            "owner": None,
            "blocks": blocks or [],
            "blocked_by": blocked_by or [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        data["tasks"].append(task)
        if self._write_tasks(data):
            return task_id
        return None

    def update_task(
        self,
        task_id: str,
        status: Optional[str] = None,
        owner: Optional[str] = None,
    ) -> bool:
        """更新任务状态 (pending/in_progress/completed)"""
        if not self.is_collaborative:
            return False

        data, task = self._find_task(task_id)
        if not task:
            return False

        if status:
            task["status"] = status
        if owner is not None:
            task["owner"] = owner
        task["updated_at"] = datetime.now().isoformat()

        if status == "completed":
            self._resolve_dependencies(data, task_id)

        return self._write_tasks(data)

    def complete_task(self, task_id: str, owner: str) -> bool:
        """标记任务完成（需负责人一致）"""
        if not self.is_collaborative:
            return False

        data, task = self._find_task(task_id)
        if not task or data.get("_error"):
            return False
        if not task.get("owner") or task.get("owner") != owner:
            return False

        task["status"] = "completed"
        task["updated_at"] = datetime.now().isoformat()
        self._resolve_dependencies(data, task_id)
        return self._write_tasks(data)

    def _resolve_dependencies(self, data: Dict[str, Any], completed_task_id: str):
        """解除依赖：将 completed_task_id 从其他任务的 blocked_by 中移除"""
        for task in data["tasks"]:
            if completed_task_id in task.get("blocked_by", []):
                task["blocked_by"].remove(completed_task_id)
                task["updated_at"] = datetime.now().isoformat()

    def claim_task(self, task_id: str, owner: str) -> bool:
        """认领任务（已被他人认领或被阻塞则失败）"""
        if not self.is_collaborative:
            return False

        data, task = self._find_task(task_id)
        if not task:
            return False
        if task["owner"] and task["owner"] != owner:
            return False  # 已被他人认领
        if task.get("blocked_by"):
            return False  # 还有未完成的依赖

        task["owner"] = owner
        task["status"] = "in_progress"
        task["updated_at"] = datetime.now().isoformat()
        return self._write_tasks(data)

    def get_available_tasks(self) -> List[Dict[str, Any]]:
        """获取可认领的任务（无阻塞、未被认领）"""
        if not self.is_collaborative:
            return []
        data = self._read_tasks()
        return [t for t in data["tasks"]
                if t["status"] == "pending"
                and not t.get("owner")
                and not t.get("blocked_by")]

    def get_task_list(self) -> List[Dict[str, Any]]:
        """获取完整任务列表"""
        if not self.is_collaborative:
            return []
        return self._read_tasks().get("tasks", [])

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取单个任务详情"""
        if not self.is_collaborative:
            return None
        _, task = self._find_task(task_id)
        return task

    # ==================== 状态查询 ====================

    def get_status(self) -> Dict[str, Any]:
        """获取任务列表状态"""
        if not self.is_collaborative:
            return {
                "mode": "isolated",
                "message": "未指定共享任务列表，使用隔离模式",
            }

        data = self._read_tasks()
        tasks = data.get("tasks", [])

        pending = sum(1 for t in tasks if t["status"] == "pending")
        in_progress = sum(1 for t in tasks if t["status"] == "in_progress")
        completed = sum(1 for t in tasks if t["status"] == "completed")
        blocked = sum(1 for t in tasks if t.get("blocked_by"))

        return {
            "mode": "collaborative",
            "list_id": self.list_id,
            "tasks_file": str(self.tasks_file),
            "total": len(tasks),
            "pending": pending,
            "in_progress": in_progress,
            "completed": completed,
            "blocked": blocked,
            "last_updated": data.get("last_updated"),
            "error": data.get("_error"),
        }

    def refresh(self) -> List[Dict[str, Any]]:
        """强制刷新任务列表（从文件重新读取）"""
        return self.get_task_list()


# ==================== 便捷函数 ====================

def get_task_manager(project_root: Optional[str] = None) -> SharedTasksManager:
    """获取任务管理器实例"""
    return SharedTasksManager(
        project_root=Path(project_root) if project_root else None
    )


def is_collaborative_mode() -> bool:
    """检查是否为协作模式"""
    return bool(os.environ.get("hellotasks"))


# ==================== CLI 入口 ====================

def _resolve_owner() -> str:
    """Resolve owner from env or session (for CLI usage)."""
    owner = os.environ.get("HELLOAGENTS_SESSION_ID")
    if owner:
        return owner
    try:
        import importlib
        return importlib.import_module(
            "helloagents.rlm.session").get_current_session().session_id
    except Exception:
        return "cli"


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HelloAGENTS Shared Tasks Manager")
    parser.add_argument("--status", action="store_true", help="显示任务列表状态")
    parser.add_argument("--list", action="store_true", help="列出所有任务")
    parser.add_argument("--available", action="store_true", help="列出可认领的任务")
    parser.add_argument("--add", type=str, help="添加任务 (subject)")
    parser.add_argument("--blocked-by", type=str, help="依赖的任务ID（逗号分隔）")
    parser.add_argument("--complete", type=str, help="标记任务完成 (task_id)")
    parser.add_argument("--claim", type=str, help="认领任务 (task_id)")
    parser.add_argument("--owner", type=str, default=None, help="认领者标识")

    args = parser.parse_args()
    manager = SharedTasksManager()

    if args.owner is None:
        args.owner = _resolve_owner()

    if args.status:
        print(json.dumps(manager.get_status(), ensure_ascii=False, indent=2))
    elif args.list:
        print(json.dumps(manager.get_task_list(), ensure_ascii=False, indent=2))
    elif args.available:
        print(json.dumps(manager.get_available_tasks(), ensure_ascii=False, indent=2))
    elif args.add:
        blocked_by = None
        if args.blocked_by:
            blocked_by = [s.strip() for s in args.blocked_by.split(",") if s.strip()]
        task_id = manager.add_task(subject=args.add, blocked_by=blocked_by)
        if task_id:
            print(json.dumps({"success": True, "task_id": task_id}, ensure_ascii=False))
        else:
            print(json.dumps({"success": False, "error": "添加失败或非协作模式"},
                             ensure_ascii=False))
    elif args.complete:
        success = manager.complete_task(args.complete, owner=args.owner)
        print(json.dumps({"success": success}, ensure_ascii=False))
    elif args.claim:
        success = manager.claim_task(args.claim, owner=args.owner)
        print(json.dumps({"success": success}, ensure_ascii=False))
    else:
        print(json.dumps(manager.get_status(), ensure_ascii=False, indent=2))

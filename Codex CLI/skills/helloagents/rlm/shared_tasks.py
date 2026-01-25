#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Shared Tasks Manager
多终端协作任务管理器

核心设计:
- 默认隔离模式: 每个终端独立任务列表
- 协作模式: 通过环境变量指定共享任务列表 ID
- 支持任务依赖: blocks/blocked_by 自动管理
- 文件锁保护并发写入
"""

import fcntl
import json
import os
import platform
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class SharedTasksManager:
    """
    多终端协作任务管理器

    使用方式:
      隔离模式（默认）: 直接运行 AI CLI
      协作模式: hellotasks=<任务列表ID> <AI CLI 命令>

    支持的 AI CLI:
      - Codex CLI: hellotasks=auth-migration codex
      - Claude Code: hellotasks=auth-migration claude

    任务存储位置:
      协作模式: {项目目录}/helloagents/tasks/{list_id}.json
      隔离模式: 由 session.py 管理
    """

    def __init__(self, project_root: Optional[Path] = None):
        """
        初始化任务管理器

        Args:
            project_root: 项目根目录，默认为当前工作目录
        """
        self.project_root = project_root or Path.cwd()
        self.tasks_dir = self.project_root / "helloagents" / "tasks"

        # 从环境变量获取任务列表 ID
        self.list_id = os.environ.get("hellotasks")
        self.is_collaborative = bool(self.list_id)

        if self.is_collaborative:
            self.tasks_dir.mkdir(parents=True, exist_ok=True)
            self.tasks_file = self.tasks_dir / f"{self.list_id}.json"
            self._init_task_list()

    def _init_task_list(self):
        """初始化任务列表文件"""
        if not self.tasks_file.exists():
            initial_data = {
                "list_id": self.list_id,
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "tasks": [],
            }
            self._write_tasks(initial_data)

    # ==================== 文件锁操作 ====================

    def _read_tasks(self) -> Dict[str, Any]:
        """读取任务列表（带共享锁）"""
        if not self.is_collaborative:
            return {"tasks": []}

        if not self.tasks_file.exists():
            return {"list_id": self.list_id, "tasks": []}

        try:
            with open(self.tasks_file, 'r', encoding='utf-8') as f:
                # Windows 不支持 fcntl，使用替代方案
                if platform.system() != 'Windows':
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    return json.load(f)
                finally:
                    if platform.system() != 'Windows':
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except Exception:
            return {"list_id": self.list_id, "tasks": []}

    def _write_tasks(self, data: Dict[str, Any]) -> bool:
        """写入任务列表（带排他锁）"""
        if not self.is_collaborative:
            return False

        data["last_updated"] = datetime.now().isoformat()

        try:
            with open(self.tasks_file, 'w', encoding='utf-8') as f:
                # Windows 使用简单的文件写入
                if platform.system() != 'Windows':
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    return True
                finally:
                    if platform.system() != 'Windows':
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except Exception:
            return False

    # ==================== 任务 CRUD ====================

    def add_task(
        self,
        subject: str,
        description: str = "",
        blocks: Optional[List[str]] = None,
        blocked_by: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        添加任务

        Args:
            subject: 任务标题
            description: 任务描述
            blocks: 此任务完成后解锁的任务 ID 列表
            blocked_by: 阻塞此任务的任务 ID 列表

        Returns:
            任务 ID，失败返回 None
        """
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
        """
        更新任务状态

        Args:
            task_id: 任务 ID
            status: 新状态 (pending/in_progress/completed)
            owner: 任务负责人（终端标识）

        Returns:
            是否成功
        """
        if not self.is_collaborative:
            return False

        data = self._read_tasks()

        for task in data["tasks"]:
            if task["id"] == task_id:
                if status:
                    task["status"] = status
                if owner is not None:
                    task["owner"] = owner
                task["updated_at"] = datetime.now().isoformat()

                # 如果任务完成，自动更新依赖关系
                if status == "completed":
                    self._resolve_dependencies(data, task_id)

                return self._write_tasks(data)

        return False

    def _resolve_dependencies(self, data: Dict[str, Any], completed_task_id: str):
        """解除依赖：将 completed_task_id 从其他任务的 blocked_by 中移除"""
        for task in data["tasks"]:
            if completed_task_id in task.get("blocked_by", []):
                task["blocked_by"].remove(completed_task_id)
                task["updated_at"] = datetime.now().isoformat()

    def claim_task(self, task_id: str, owner: str) -> bool:
        """
        认领任务

        Args:
            task_id: 任务 ID
            owner: 认领者标识

        Returns:
            是否成功（已被他人认领则失败）
        """
        if not self.is_collaborative:
            return False

        data = self._read_tasks()

        for task in data["tasks"]:
            if task["id"] == task_id:
                # 检查是否已被认领
                if task["owner"] and task["owner"] != owner:
                    return False  # 已被他人认领

                # 检查是否被阻塞
                if task.get("blocked_by"):
                    return False  # 还有未完成的依赖

                task["owner"] = owner
                task["status"] = "in_progress"
                task["updated_at"] = datetime.now().isoformat()
                return self._write_tasks(data)

        return False

    def get_available_tasks(self) -> List[Dict[str, Any]]:
        """获取可认领的任务（无阻塞、未被认领）"""
        if not self.is_collaborative:
            return []

        data = self._read_tasks()
        available = []

        for task in data["tasks"]:
            if (task["status"] == "pending" and
                not task.get("owner") and
                not task.get("blocked_by")):
                available.append(task)

        return available

    def get_task_list(self) -> List[Dict[str, Any]]:
        """获取完整任务列表"""
        if not self.is_collaborative:
            return []

        data = self._read_tasks()
        return data.get("tasks", [])

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取单个任务详情"""
        if not self.is_collaborative:
            return None

        data = self._read_tasks()
        for task in data["tasks"]:
            if task["id"] == task_id:
                return task
        return None

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
        }

    def refresh(self) -> List[Dict[str, Any]]:
        """
        强制刷新任务列表（从文件重新读取）

        用于检查其他终端的更新
        """
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

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HelloAGENTS Shared Tasks Manager")
    parser.add_argument("--status", action="store_true", help="显示任务列表状态")
    parser.add_argument("--list", action="store_true", help="列出所有任务")
    parser.add_argument("--available", action="store_true", help="列出可认领的任务")
    parser.add_argument("--add", type=str, help="添加任务 (subject)")
    parser.add_argument("--complete", type=str, help="标记任务完成 (task_id)")
    parser.add_argument("--claim", type=str, help="认领任务 (task_id)")
    parser.add_argument("--owner", type=str, default="cli", help="认领者标识")

    args = parser.parse_args()
    manager = SharedTasksManager()

    if args.status:
        print(json.dumps(manager.get_status(), ensure_ascii=False, indent=2))

    elif args.list:
        tasks = manager.get_task_list()
        print(json.dumps(tasks, ensure_ascii=False, indent=2))

    elif args.available:
        tasks = manager.get_available_tasks()
        print(json.dumps(tasks, ensure_ascii=False, indent=2))

    elif args.add:
        task_id = manager.add_task(subject=args.add)
        if task_id:
            print(json.dumps({"success": True, "task_id": task_id}, ensure_ascii=False))
        else:
            print(json.dumps({"success": False, "error": "添加失败或非协作模式"}, ensure_ascii=False))

    elif args.complete:
        success = manager.update_task(args.complete, status="completed")
        print(json.dumps({"success": success}, ensure_ascii=False))

    elif args.claim:
        success = manager.claim_task(args.claim, owner=args.owner)
        print(json.dumps({"success": success}, ensure_ascii=False))

    else:
        # 默认显示状态
        print(json.dumps(manager.get_status(), ensure_ascii=False, indent=2))

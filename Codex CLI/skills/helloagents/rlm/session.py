#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Session Manager
Session 隔离管理器 - 解决多 CLI 并发问题

核心设计:
- 每个 AI CLI 实例有唯一的 Session ID
- Session 数据存储在临时目录，不会污染知识库
- 支持 Session 恢复和清理
"""

import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class SessionManager:
    """
    Session 隔离管理器

    解决问题: 多个 AI CLI 并行工作时的上下文污染

    设计原则:
    - Working Context: 在 AI CLI 内存中，不持久化
    - Session Events: 持久化到 session 专属目录
    - Memory: 使用共享知识库
    """

    # Session 根目录
    SESSION_ROOT = Path(tempfile.gettempdir()) / "helloagents_rlm"

    def __init__(self, session_id: Optional[str] = None):
        """
        初始化 Session

        Args:
            session_id: 可选的 Session ID，不提供则生成新的
        """
        # 优先从环境变量获取 (支持 CLI 传递)
        self.session_id = (
            session_id or
            os.environ.get("HELLOAGENTS_SESSION_ID") or
            self._generate_session_id()
        )

        # Session 目录
        self.session_dir = self.SESSION_ROOT / self.session_id
        self.session_dir.mkdir(parents=True, exist_ok=True)

        # Session 文件
        self.events_file = self.session_dir / "events.jsonl"
        self.state_file = self.session_dir / "state.json"
        self.metadata_file = self.session_dir / "metadata.json"

        # 初始化 metadata
        if not self.metadata_file.exists():
            self._init_metadata()

    def _generate_session_id(self) -> str:
        """生成唯一 Session ID"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        short_uuid = str(uuid.uuid4())[:8]
        return f"session_{timestamp}_{short_uuid}"

    def _init_metadata(self):
        """初始化 Session 元数据"""
        metadata = {
            "session_id": self.session_id,
            "created_at": datetime.now().isoformat(),
            "last_active": datetime.now().isoformat(),
            "rlm_version": "1.0.0",
            "agent_history": [],
            "total_events": 0,
        }
        self.metadata_file.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    # ==================== Event 管理 ====================

    def log_event(self, event_type: str, data: Dict[str, Any]) -> bool:
        """
        记录事件到 Session

        Args:
            event_type: 事件类型 (spawn_agent, fold, tool_call, etc.)
            data: 事件数据
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "data": data,
        }

        try:
            with open(self.events_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(event, ensure_ascii=False) + '\n')

            # 更新 metadata
            self._update_metadata("total_events", lambda x: (x or 0) + 1)
            return True
        except Exception:
            return False

    def get_events(
        self,
        event_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """获取事件列表"""
        if not self.events_file.exists():
            return []

        events = []
        try:
            with open(self.events_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        event = json.loads(line)
                        if event_type is None or event.get("type") == event_type:
                            events.append(event)
        except Exception:
            return []

        if limit:
            events = events[-limit:]

        return events

    def get_recent_events_summary(self, count: int = 10) -> str:
        """获取最近事件摘要 (用于折叠后传递)"""
        events = self.get_events(limit=count)
        if not events:
            return "无最近事件"

        lines = []
        for e in events:
            event_type = e.get("type", "unknown")
            timestamp = e.get("timestamp", "")[:19]  # 截断到秒
            data = e.get("data", {})

            if event_type == "spawn_agent":
                lines.append(f"- [{timestamp}] spawn: {data.get('role', '?')} - {data.get('task', '?')[:50]}")
            elif event_type == "fold":
                lines.append(f"- [{timestamp}] fold: {data.get('strategy', '?')}")
            elif event_type == "tool_call":
                lines.append(f"- [{timestamp}] tool: {data.get('tool', '?')}")
            else:
                lines.append(f"- [{timestamp}] {event_type}")

        return '\n'.join(lines)

    # ==================== State 管理 ====================

    def save_state(self, state: Dict[str, Any]) -> bool:
        """保存 RLM 状态"""
        try:
            state["last_updated"] = datetime.now().isoformat()
            self.state_file.write_text(
                json.dumps(state, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
            self._update_metadata("last_active", datetime.now().isoformat())
            return True
        except Exception:
            return False

    def load_state(self) -> Optional[Dict[str, Any]]:
        """加载 RLM 状态"""
        if not self.state_file.exists():
            return None

        try:
            return json.loads(self.state_file.read_text(encoding='utf-8'))
        except Exception:
            return None

    # ==================== Agent 历史 ====================

    def record_agent(
        self,
        agent_id: str,
        role: str,
        task: str,
        status: str,
        depth: int,
    ) -> bool:
        """记录代理执行历史"""
        record = {
            "agent_id": agent_id,
            "role": role,
            "task": task,
            "status": status,
            "depth": depth,
            "timestamp": datetime.now().isoformat(),
        }

        # 记录事件
        self.log_event("spawn_agent", record)

        # 更新 metadata
        try:
            metadata = self._load_metadata()
            if "agent_history" not in metadata:
                metadata["agent_history"] = []
            metadata["agent_history"].append(record)
            # 只保留最近 50 条
            metadata["agent_history"] = metadata["agent_history"][-50:]
            self._save_metadata(metadata)
            return True
        except Exception:
            return False

    def get_agent_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """获取代理执行历史"""
        metadata = self._load_metadata()
        history = metadata.get("agent_history", [])
        return history[-limit:] if limit else history

    # ==================== Metadata 操作 ====================

    def _load_metadata(self) -> Dict[str, Any]:
        """加载 metadata"""
        if not self.metadata_file.exists():
            return {}
        try:
            return json.loads(self.metadata_file.read_text(encoding='utf-8'))
        except Exception:
            return {}

    def _save_metadata(self, metadata: Dict[str, Any]):
        """保存 metadata"""
        self.metadata_file.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    def _update_metadata(self, key: str, value_or_func):
        """更新 metadata 字段"""
        metadata = self._load_metadata()
        if callable(value_or_func):
            metadata[key] = value_or_func(metadata.get(key))
        else:
            metadata[key] = value_or_func
        self._save_metadata(metadata)

    # ==================== Session 管理 ====================

    def get_session_info(self) -> Dict[str, Any]:
        """获取 Session 信息"""
        metadata = self._load_metadata()
        events_count = len(self.get_events())

        return {
            "session_id": self.session_id,
            "session_dir": str(self.session_dir),
            "created_at": metadata.get("created_at"),
            "last_active": metadata.get("last_active"),
            "total_events": events_count,
            "agent_count": len(metadata.get("agent_history", [])),
        }

    def cleanup(self) -> bool:
        """清理当前 Session"""
        import shutil
        try:
            if self.session_dir.exists():
                shutil.rmtree(self.session_dir)
            return True
        except Exception:
            return False

    @classmethod
    def list_sessions(cls) -> List[Dict[str, Any]]:
        """列出所有 Sessions"""
        sessions = []
        if not cls.SESSION_ROOT.exists():
            return sessions

        for session_dir in cls.SESSION_ROOT.iterdir():
            if session_dir.is_dir() and session_dir.name.startswith("session_"):
                metadata_file = session_dir / "metadata.json"
                if metadata_file.exists():
                    try:
                        metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
                        sessions.append({
                            "session_id": session_dir.name,
                            "created_at": metadata.get("created_at"),
                            "last_active": metadata.get("last_active"),
                        })
                    except Exception:
                        continue

        # 按最后活跃时间排序
        sessions.sort(key=lambda x: x.get("last_active", ""), reverse=True)
        return sessions

    @classmethod
    def cleanup_old_sessions(cls, max_age_hours: int = 24) -> int:
        """清理过期 Sessions"""
        import shutil
        from datetime import timedelta

        cleaned = 0
        cutoff = datetime.now() - timedelta(hours=max_age_hours)

        for session_dir in cls.SESSION_ROOT.iterdir():
            if session_dir.is_dir() and session_dir.name.startswith("session_"):
                metadata_file = session_dir / "metadata.json"
                try:
                    if metadata_file.exists():
                        metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
                        last_active = datetime.fromisoformat(metadata.get("last_active", "2000-01-01"))
                        if last_active < cutoff:
                            shutil.rmtree(session_dir)
                            cleaned += 1
                except Exception:
                    continue

        return cleaned


# ==================== 便捷函数 ====================

def get_or_create_session(session_id: Optional[str] = None) -> SessionManager:
    """获取或创建 Session"""
    return SessionManager(session_id)


def get_current_session() -> SessionManager:
    """获取当前 Session (从环境变量)"""
    return SessionManager()


# ==================== CLI 入口 ====================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HelloAGENTS RLM Session Manager")
    parser.add_argument("--new", action="store_true", help="创建新 Session")
    parser.add_argument("--id", type=str, help="指定 Session ID")
    parser.add_argument("--info", action="store_true", help="显示 Session 信息")
    parser.add_argument("--list", action="store_true", help="列出所有 Sessions")
    parser.add_argument("--cleanup", type=int, help="清理超过 N 小时的 Sessions")
    parser.add_argument("--events", type=int, help="显示最近 N 条事件")
    parser.add_argument("--history", type=int, help="显示最近 N 条代理历史")

    args = parser.parse_args()

    if args.list:
        sessions = SessionManager.list_sessions()
        print(json.dumps(sessions, ensure_ascii=False, indent=2))
    elif args.cleanup:
        cleaned = SessionManager.cleanup_old_sessions(args.cleanup)
        print(json.dumps({"cleaned_sessions": cleaned}, ensure_ascii=False))
    else:
        session = SessionManager(args.id if not args.new else None)

        if args.info:
            print(json.dumps(session.get_session_info(), ensure_ascii=False, indent=2))
        elif args.events:
            events = session.get_events(limit=args.events)
            print(json.dumps(events, ensure_ascii=False, indent=2))
        elif args.history:
            history = session.get_agent_history(limit=args.history)
            print(json.dumps(history, ensure_ascii=False, indent=2))
        else:
            # 默认输出 Session ID (方便其他脚本使用)
            print(session.session_id)

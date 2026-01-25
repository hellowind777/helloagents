#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Context Manager
三层上下文架构实现

基于Google ADK设计:
- Layer 1: Working Context (工作上下文) - 当前活跃
- Layer 2: Session Events (会话事件) - 可压缩
- Layer 3: Memory & Artifacts (长期记忆) - 知识库
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
import json


class ContextLayer(Enum):
    """上下文层级"""
    WORKING = 1     # 工作上下文 (活跃，在LLM context window中)
    SESSION = 2     # 会话事件 (可压缩，内存中)
    MEMORY = 3      # 长期记忆 (持久化，知识库)


@dataclass
class ContextEvent:
    """上下文事件"""
    event_type: str
    content: Any
    timestamp: str = ""
    layer: ContextLayer = ContextLayer.SESSION
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "content": self.content,
            "timestamp": self.timestamp,
            "layer": self.layer.name,
            "metadata": self.metadata,
        }


@dataclass
class CompactionConfig:
    """压缩配置 (类似Google ADK EventsCompactionConfig)"""
    compaction_interval: int = 10   # 每N个事件触发压缩
    overlap_size: int = 2           # 压缩时保留的重叠事件数
    max_working_tokens: int = 8000  # 工作上下文最大token数
    summarizer_model: str = "gpt-5.2-codex"


class ContextManager:
    """
    三层上下文管理器

    Layer 1 - Working Context:
        - 当前活跃的工作上下文
        - 包含: 系统指令、当前任务、最近对话、活跃子任务摘要
        - 大小限制: < max_working_tokens

    Layer 2 - Session Events:
        - 可压缩的事件日志
        - 包含: 工具调用、文件操作、子agent交互
        - 压缩策略: 滑动窗口 + LLM摘要

    Layer 3 - Memory & Artifacts:
        - 长期记忆 (helloagents知识库)
        - 包含: context.md, modules/*.md, archive/
        - 访问方式: 按需读取
    """

    def __init__(
        self,
        config: Optional[CompactionConfig] = None,
        knowledge_base_path: Optional[Path] = None,
    ):
        self.config = config or CompactionConfig()
        self.kb_path = knowledge_base_path or Path.cwd() / "helloagents"

        # Layer 1: Working Context
        self.working_context: List[ContextEvent] = []
        self.working_tokens: int = 0

        # Layer 2: Session Events
        self.session_events: List[ContextEvent] = []
        self.compacted_summaries: List[str] = []
        self.events_since_compaction: int = 0

        # Layer 3: Memory refs (按需加载)
        self.memory_cache: Dict[str, str] = {}

    # ==================== Layer 1: Working Context ====================

    def add_to_working(self, event: ContextEvent) -> bool:
        """
        添加事件到工作上下文

        Returns:
            是否成功 (可能因超限而失败，触发压缩)
        """
        estimated_tokens = self._estimate_tokens(event.content)

        # 检查是否超限
        if self.working_tokens + estimated_tokens > self.config.max_working_tokens:
            # 需要压缩
            self._compact_working_context()

        self.working_context.append(event)
        self.working_tokens += estimated_tokens
        return True

    def get_working_context(self) -> List[Dict[str, Any]]:
        """获取当前工作上下文"""
        return [e.to_dict() for e in self.working_context]

    def clear_working_context(self):
        """清空工作上下文 (保留到Session)"""
        for event in self.working_context:
            event.layer = ContextLayer.SESSION
            self.session_events.append(event)

        self.working_context.clear()
        self.working_tokens = 0

    def _compact_working_context(self):
        """压缩工作上下文"""
        if not self.working_context:
            return

        # 生成摘要
        contents = [str(e.content) for e in self.working_context]
        summary = self._generate_summary("\n".join(contents))

        # 移动到Session
        for event in self.working_context:
            event.layer = ContextLayer.SESSION
            self.session_events.append(event)

        # 创建摘要事件
        summary_event = ContextEvent(
            event_type="working_context_summary",
            content=summary,
            layer=ContextLayer.WORKING,
            metadata={"original_count": len(self.working_context)},
        )

        self.working_context.clear()
        self.working_context.append(summary_event)
        self.working_tokens = self._estimate_tokens(summary)

    # ==================== Layer 2: Session Events ====================

    def add_session_event(self, event: ContextEvent):
        """添加会话事件"""
        event.layer = ContextLayer.SESSION
        self.session_events.append(event)
        self.events_since_compaction += 1

        # 检查是否需要压缩
        if self.events_since_compaction >= self.config.compaction_interval:
            self._compact_session_events()

    def get_session_events(
        self,
        limit: Optional[int] = None,
        event_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """获取会话事件"""
        events = self.session_events

        if event_type:
            events = [e for e in events if e.event_type == event_type]

        if limit:
            events = events[-limit:]

        return [e.to_dict() for e in events]

    def _compact_session_events(self):
        """压缩会话事件 (滑动窗口)"""
        if len(self.session_events) < self.config.compaction_interval:
            return

        # 确定压缩范围
        compact_end = len(self.session_events) - self.config.overlap_size
        to_compact = self.session_events[:compact_end]

        if not to_compact:
            return

        # 生成摘要
        contents = [str(e.content) for e in to_compact]
        summary = self._generate_summary("\n".join(contents))
        self.compacted_summaries.append(summary)

        # 保留overlap部分
        self.session_events = self.session_events[compact_end:]
        self.events_since_compaction = 0

    # ==================== Layer 3: Memory & Artifacts ====================

    def load_memory(self, key: str) -> Optional[str]:
        """
        按需加载长期记忆

        Args:
            key: 记忆键名 (如 "context", "modules/auth", "changelog")
        """
        # 检查缓存
        if key in self.memory_cache:
            return self.memory_cache[key]

        # 构建文件路径
        file_path = self._resolve_memory_path(key)
        if not file_path or not file_path.exists():
            return None

        try:
            content = file_path.read_text(encoding='utf-8')
            self.memory_cache[key] = content
            return content
        except Exception:
            return None

    def save_memory(self, key: str, content: str) -> bool:
        """
        保存到长期记忆

        Args:
            key: 记忆键名
            content: 内容
        """
        file_path = self._resolve_memory_path(key)
        if not file_path:
            return False

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding='utf-8')
            self.memory_cache[key] = content
            return True
        except Exception:
            return False

    def _resolve_memory_path(self, key: str) -> Optional[Path]:
        """解析记忆键到文件路径"""
        key_mapping = {
            "context": self.kb_path / "context.md",
            "index": self.kb_path / "INDEX.md",
            "changelog": self.kb_path / "CHANGELOG.md",
        }

        if key in key_mapping:
            return key_mapping[key]

        # modules/xxx -> modules/xxx.md
        if key.startswith("modules/"):
            module_name = key.replace("modules/", "")
            return self.kb_path / "modules" / f"{module_name}.md"

        # 默认作为相对路径
        return self.kb_path / f"{key}.md"

    def invalidate_memory_cache(self, key: Optional[str] = None):
        """使记忆缓存失效"""
        if key:
            self.memory_cache.pop(key, None)
        else:
            self.memory_cache.clear()

    # ==================== 辅助方法 ====================

    def _estimate_tokens(self, content: Any) -> int:
        """估算token数 (简化: 4字符约1token)"""
        if content is None:
            return 0
        return len(str(content)) // 4

    def _generate_summary(self, content: str) -> str:
        """
        生成摘要

        注意: 简化实现，实际应调用LLM
        """
        lines = content.split('\n')
        key_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            # 保留关键行
            if any(marker in line.lower() for marker in
                   ['#', 'error', 'success', 'failed', 'completed', 'created', 'modified']):
                key_lines.append(line)

        if key_lines:
            return '\n'.join(key_lines[:15])

        # 截断
        return content[:300] + "..." if len(content) > 300 else content

    # ==================== 状态管理 ====================

    def get_status(self) -> Dict[str, Any]:
        """获取上下文状态"""
        return {
            "working_context": {
                "events": len(self.working_context),
                "tokens": self.working_tokens,
                "limit": self.config.max_working_tokens,
            },
            "session_events": {
                "events": len(self.session_events),
                "compacted_summaries": len(self.compacted_summaries),
                "since_compaction": self.events_since_compaction,
            },
            "memory": {
                "cached_keys": list(self.memory_cache.keys()),
                "kb_path": str(self.kb_path),
            },
        }

    def export_session(self) -> Dict[str, Any]:
        """导出会话数据"""
        return {
            "working_context": self.get_working_context(),
            "session_events": self.get_session_events(),
            "compacted_summaries": self.compacted_summaries,
            "memory_cache_keys": list(self.memory_cache.keys()),
        }

    def reset(self):
        """重置上下文"""
        self.working_context.clear()
        self.working_tokens = 0
        self.session_events.clear()
        self.compacted_summaries.clear()
        self.events_since_compaction = 0
        self.memory_cache.clear()


# ==================== 便捷函数 ====================

def create_context_manager(
    compaction_interval: int = 10,
    max_working_tokens: int = 8000,
    kb_path: Optional[str] = None,
) -> ContextManager:
    """创建上下文管理器"""
    config = CompactionConfig(
        compaction_interval=compaction_interval,
        max_working_tokens=max_working_tokens,
    )
    return ContextManager(
        config=config,
        knowledge_base_path=Path(kb_path) if kb_path else None,
    )

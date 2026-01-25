#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM: Recursive Language Model Engine

基于以下前沿技术:
- MIT RLM (Recursive Language Models) - Python REPL + 递归自调用
- Context Folding (OpenReview) - 子轨迹分支 + 折叠 + 摘要保留
- Google ADK - 三层上下文架构
- GPT-5.2-Codex - 原生Context Compaction

核心特点:
- 零MCP预加载开销: 利用Codex原生spawn_agent
- 三层上下文分离: Working Context / Session Events / Memory
- 5层递归深度: 分治处理任意规模任务
- 24并行子Agent: 最大化利用Codex能力
- 主动Context Folding: 不被动等待溢出
"""

from .engine import RLMEngine, RLMMode, AgentResult, FoldedTrajectory
from .context_manager import ContextManager, ContextLayer
from .agent_orchestrator import AgentOrchestrator, OrchestrationMode
from .folding import ContextFolder, FoldingStrategy
from .repl import RLMREPL

__version__ = "1.0.0"
__all__ = [
    "RLMEngine",
    "RLMMode",
    "AgentResult",
    "FoldedTrajectory",
    "ContextManager",
    "ContextLayer",
    "AgentOrchestrator",
    "OrchestrationMode",
    "ContextFolder",
    "FoldingStrategy",
    "RLMREPL",
]

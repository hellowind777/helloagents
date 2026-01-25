#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Context Folding
上下文折叠实现

基于OpenReview论文 "Scaling Long-Horizon Agent via Context Folding":
- 子轨迹分支
- 完成后折叠
- 保留摘要
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import re


class FoldingStrategy(Enum):
    """折叠策略"""
    AGGRESSIVE = "aggressive"   # 激进: 仅保留关键结论
    BALANCED = "balanced"       # 平衡: 保留结论和关键步骤 (默认)
    CONSERVATIVE = "conservative"  # 保守: 保留更多细节


@dataclass
class Trajectory:
    """轨迹"""
    trajectory_id: str
    content: str
    trajectory_type: str = "general"  # general | exploration | implementation | review
    created_at: str = ""
    artifacts: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


@dataclass
class FoldedResult:
    """折叠结果"""
    original_id: str
    summary: str
    key_artifacts: List[str]
    compression_ratio: float
    strategy_used: FoldingStrategy
    folded_at: str = ""

    def __post_init__(self):
        if not self.folded_at:
            self.folded_at = datetime.now().isoformat()


class ContextFolder:
    """
    上下文折叠器

    核心功能:
    1. 识别可折叠的子轨迹
    2. 生成高质量摘要
    3. 保留关键产物引用
    4. 支持多种折叠策略
    """

    # 关键标记词
    KEY_MARKERS = [
        # 结构标记
        r'^#{1,3}\s+',  # 标题
        r'^\*\*.*\*\*',  # 粗体
        # 状态标记
        r'✅|❌|⚠️|🔵|🟣|💡',
        r'\[completed\]|\[failed\]|\[success\]|\[error\]',
        # 代码标记
        r'```\w*',
        r'def\s+\w+|class\s+\w+|function\s+\w+',
        # 文件操作
        r'created?|modified?|deleted?|updated?',
        r'file:|path:',
    ]

    # 可省略内容模式
    OMIT_PATTERNS = [
        r'^\s*$',  # 空行
        r'^[-=]{3,}$',  # 分隔线
        r'^\s*#.*$',  # 注释 (某些场景)
        r'^\s*\.\.\.\s*$',  # 省略标记
    ]

    def __init__(
        self,
        default_strategy: FoldingStrategy = FoldingStrategy.BALANCED,
        max_summary_length: int = 500,
        preserve_code_blocks: bool = True,
    ):
        self.default_strategy = default_strategy
        self.max_summary_length = max_summary_length
        self.preserve_code_blocks = preserve_code_blocks

        # 编译正则
        self.key_patterns = [re.compile(p, re.IGNORECASE) for p in self.KEY_MARKERS]
        self.omit_patterns = [re.compile(p) for p in self.OMIT_PATTERNS]

    def fold(
        self,
        trajectory: Trajectory,
        strategy: Optional[FoldingStrategy] = None,
        custom_prompt: Optional[str] = None,
    ) -> FoldedResult:
        """
        折叠轨迹

        Args:
            trajectory: 要折叠的轨迹
            strategy: 折叠策略 (None使用默认)
            custom_prompt: 自定义摘要提示

        Returns:
            折叠结果
        """
        strategy = strategy or self.default_strategy

        # 提取关键内容
        key_lines = self._extract_key_content(trajectory.content, strategy)

        # 提取产物
        artifacts = self._extract_artifacts(trajectory.content)
        artifacts.extend(trajectory.artifacts)
        artifacts = list(dict.fromkeys(artifacts))  # 去重

        # 生成摘要
        summary = self._generate_summary(
            key_lines=key_lines,
            trajectory_type=trajectory.trajectory_type,
            strategy=strategy,
            custom_prompt=custom_prompt,
        )

        # 计算压缩率
        original_len = len(trajectory.content)
        summary_len = len(summary)
        compression_ratio = summary_len / original_len if original_len > 0 else 0

        return FoldedResult(
            original_id=trajectory.trajectory_id,
            summary=summary,
            key_artifacts=artifacts,
            compression_ratio=compression_ratio,
            strategy_used=strategy,
        )

    def fold_multiple(
        self,
        trajectories: List[Trajectory],
        strategy: Optional[FoldingStrategy] = None,
    ) -> FoldedResult:
        """
        折叠多个轨迹为一个摘要

        Args:
            trajectories: 轨迹列表
            strategy: 折叠策略

        Returns:
            合并后的折叠结果
        """
        strategy = strategy or self.default_strategy

        all_key_lines = []
        all_artifacts = []

        for traj in trajectories:
            key_lines = self._extract_key_content(traj.content, strategy)
            all_key_lines.extend(key_lines)

            artifacts = self._extract_artifacts(traj.content)
            all_artifacts.extend(artifacts)

        # 去重
        all_artifacts = list(dict.fromkeys(all_artifacts))

        # 生成合并摘要
        summary = self._generate_summary(
            key_lines=all_key_lines,
            trajectory_type="merged",
            strategy=strategy,
        )

        total_len = sum(len(t.content) for t in trajectories)
        compression_ratio = len(summary) / total_len if total_len > 0 else 0

        return FoldedResult(
            original_id=f"merged_{len(trajectories)}",
            summary=summary,
            key_artifacts=all_artifacts,
            compression_ratio=compression_ratio,
            strategy_used=strategy,
        )

    def should_fold(
        self,
        content: str,
        threshold_tokens: int = 2000,
    ) -> bool:
        """
        判断是否应该折叠

        Args:
            content: 内容
            threshold_tokens: token阈值

        Returns:
            是否应该折叠
        """
        estimated_tokens = len(content) // 4  # 简单估算
        return estimated_tokens > threshold_tokens

    def estimate_savings(
        self,
        content: str,
        strategy: Optional[FoldingStrategy] = None,
    ) -> Dict[str, Any]:
        """
        估算折叠节省

        Returns:
            {original_tokens, estimated_tokens, savings_percent}
        """
        strategy = strategy or self.default_strategy

        original_tokens = len(content) // 4
        key_lines = self._extract_key_content(content, strategy)
        estimated_summary_len = min(
            sum(len(line) for line in key_lines),
            self.max_summary_length,
        )
        estimated_tokens = estimated_summary_len // 4

        savings_percent = (1 - estimated_tokens / original_tokens) * 100 if original_tokens > 0 else 0

        return {
            "original_tokens": original_tokens,
            "estimated_tokens": estimated_tokens,
            "savings_percent": round(savings_percent, 1),
        }

    # ==================== 内部方法 ====================

    def _extract_key_content(
        self,
        content: str,
        strategy: FoldingStrategy,
    ) -> List[str]:
        """提取关键内容行"""
        lines = content.split('\n')
        key_lines = []

        # 根据策略设置保留比例
        retention_limits = {
            FoldingStrategy.AGGRESSIVE: 0.1,    # 保留10%
            FoldingStrategy.BALANCED: 0.25,     # 保留25%
            FoldingStrategy.CONSERVATIVE: 0.5,  # 保留50%
        }
        max_lines = int(len(lines) * retention_limits.get(strategy, 0.25))
        max_lines = max(max_lines, 5)  # 至少保留5行

        in_code_block = False
        code_block_lines = []

        for line in lines:
            # 跟踪代码块
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                if self.preserve_code_blocks:
                    if in_code_block:
                        code_block_lines = [line]
                    else:
                        code_block_lines.append(line)
                        # 只保留短代码块
                        if len(code_block_lines) <= 10:
                            key_lines.extend(code_block_lines)
                        code_block_lines = []
                continue

            if in_code_block:
                if self.preserve_code_blocks:
                    code_block_lines.append(line)
                continue

            # 检查是否应该省略
            if any(p.match(line) for p in self.omit_patterns):
                continue

            # 检查是否是关键行
            is_key = any(p.search(line) for p in self.key_patterns)

            if is_key:
                key_lines.append(line)

        # 限制行数
        if len(key_lines) > max_lines:
            # 优先保留开头和结尾
            head = key_lines[:max_lines // 2]
            tail = key_lines[-(max_lines // 2):]
            key_lines = head + ['...'] + tail

        return key_lines

    def _extract_artifacts(self, content: str) -> List[str]:
        """提取关键产物"""
        artifacts = []

        # 文件路径
        paths = re.findall(r'[\w./\\-]+\.\w{1,10}', content)
        artifacts.extend(paths[:10])

        # 函数/类名
        funcs = re.findall(r'(?:def|class|function)\s+(\w+)', content)
        artifacts.extend(funcs[:5])

        # URL
        urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', content)
        artifacts.extend(urls[:3])

        return artifacts

    def _generate_summary(
        self,
        key_lines: List[str],
        trajectory_type: str,
        strategy: FoldingStrategy,
        custom_prompt: Optional[str] = None,
    ) -> str:
        """
        生成摘要

        注意: 这是简化实现，实际应调用LLM
        """
        if not key_lines:
            return "[无关键内容]"

        # 类型前缀
        type_prefixes = {
            "exploration": "📂 探索",
            "implementation": "💻 实现",
            "review": "🔍 审查",
            "merged": "📋 综合",
            "general": "📝 记录",
        }
        prefix = type_prefixes.get(trajectory_type, "📝")

        # 组装摘要
        summary_parts = [f"{prefix}摘要:"]
        summary_parts.extend(key_lines)

        summary = '\n'.join(summary_parts)

        # 截断
        if len(summary) > self.max_summary_length:
            summary = summary[:self.max_summary_length - 3] + '...'

        return summary


# ==================== 便捷函数 ====================

def quick_fold(
    content: str,
    strategy: str = "balanced",
) -> str:
    """快速折叠内容"""
    strategy_map = {
        "aggressive": FoldingStrategy.AGGRESSIVE,
        "balanced": FoldingStrategy.BALANCED,
        "conservative": FoldingStrategy.CONSERVATIVE,
    }
    folder = ContextFolder(default_strategy=strategy_map.get(strategy, FoldingStrategy.BALANCED))
    trajectory = Trajectory(
        trajectory_id="quick_fold",
        content=content,
    )
    result = folder.fold(trajectory)
    return result.summary


def estimate_fold_savings(content: str) -> Dict[str, Any]:
    """估算折叠节省"""
    folder = ContextFolder()
    return folder.estimate_savings(content)

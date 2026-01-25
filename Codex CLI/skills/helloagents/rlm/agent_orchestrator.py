#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Agent Orchestrator
子Agent编排器实现

支持四种编排模式:
1. Sequential Chain (顺序链)
2. Parallel Fan-out (并行扇出)
3. Divide & Conquer (分治递归)
4. Expert Consultation (专家会诊)
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from .engine import RLMEngine, AgentResult


class OrchestrationMode(Enum):
    """编排模式"""
    SEQUENTIAL = "sequential"       # 顺序链: A → B → C
    PARALLEL = "parallel"           # 并行扇出: → [A, B, C] →
    DIVIDE_CONQUER = "divide"       # 分治递归
    EXPERT_CONSULT = "expert"       # 专家会诊


@dataclass
class TaskNode:
    """任务节点"""
    task_id: str
    role: str
    task: str
    context_hint: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    timeout: int = 120
    result: Optional[AgentResult] = None
    status: str = "pending"  # pending | running | completed | failed


@dataclass
class OrchestrationPlan:
    """编排计划"""
    mode: OrchestrationMode
    nodes: List[TaskNode]
    merge_strategy: str = "synthesize"
    max_parallel: int = 24
    metadata: Dict[str, Any] = field(default_factory=dict)


class AgentOrchestrator:
    """
    子Agent编排器

    负责:
    - 任务分解
    - 依赖管理
    - 并行/顺序执行
    - 结果合并
    """

    def __init__(self, engine: RLMEngine):
        self.engine = engine
        self.task_counter = 0
        self.execution_log: List[Dict[str, Any]] = []

    # ==================== 编排模式实现 ====================

    async def execute_sequential(
        self,
        tasks: List[Dict[str, Any]],
        pass_output: bool = True,
    ) -> List[AgentResult]:
        """
        顺序链执行

        Args:
            tasks: 任务列表 [{role, task, context_hint}]
            pass_output: 是否将前一任务输出传递给下一任务

        Returns:
            按顺序执行的结果列表
        """
        results = []
        previous_output = ""

        for i, task_config in enumerate(tasks):
            task_desc = task_config.get("task", "")

            # 如果需要传递输出，替换模板
            if pass_output and previous_output and "{{previous_output}}" in task_desc:
                task_desc = task_desc.replace("{{previous_output}}", previous_output)
            elif pass_output and previous_output:
                task_desc = f"{task_desc}\n\n前置任务输出:\n{previous_output}"

            result = await self.engine.spawn_agent(
                role=task_config.get("role", "explorer"),
                task=task_desc,
                context_hint=task_config.get("context_hint"),
                timeout=task_config.get("timeout", 120),
            )

            results.append(result)

            # 记录日志
            self._log_execution("sequential", i, task_config, result)

            # 如果失败，根据策略决定是否继续
            if result.status == "failed":
                break

            # 准备传递给下一任务的输出
            previous_output = result.to_summary()

        return results

    async def execute_parallel(
        self,
        tasks: List[Dict[str, Any]],
        merge_strategy: str = "synthesize",
    ) -> tuple[List[AgentResult], str]:
        """
        并行扇出执行

        Args:
            tasks: 任务列表
            merge_strategy: 合并策略 (concat | synthesize | vote)

        Returns:
            (结果列表, 合并后的输出)
        """
        # 使用engine的batch方法并行执行
        results = await self.engine.batch(tasks)

        # 记录日志
        for i, (task_config, result) in enumerate(zip(tasks, results)):
            self._log_execution("parallel", i, task_config, result)

        # 合并结果
        merged = self.engine.merge(results, strategy=merge_strategy)

        return results, merged

    async def execute_divide_conquer(
        self,
        task: str,
        subtasks: List[Dict[str, Any]],
        synthesizer_prompt: str = "综合以下子任务结果",
        max_depth: int = 3,
        current_depth: int = 0,
    ) -> AgentResult:
        """
        分治递归执行

        Args:
            task: 主任务描述
            subtasks: 子任务列表 (可嵌套)
            synthesizer_prompt: 综合提示
            max_depth: 最大递归深度
            current_depth: 当前深度

        Returns:
            综合后的结果
        """
        if current_depth >= max_depth:
            # 达到最大深度，直接执行
            return await self.engine.spawn_agent(
                role="implementer",
                task=task,
            )

        # 并行执行子任务
        sub_results = []
        for subtask in subtasks:
            if "subtasks" in subtask:
                # 递归处理嵌套子任务
                result = await self.execute_divide_conquer(
                    task=subtask.get("task", ""),
                    subtasks=subtask.get("subtasks", []),
                    synthesizer_prompt=synthesizer_prompt,
                    max_depth=max_depth,
                    current_depth=current_depth + 1,
                )
            else:
                # 叶子任务，直接执行
                result = await self.engine.spawn_agent(
                    role=subtask.get("role", "implementer"),
                    task=subtask.get("task", ""),
                    context_hint=subtask.get("context_hint"),
                )
            sub_results.append(result)

        # 综合子任务结果
        merged = self.engine.merge(sub_results, strategy="synthesize")

        # 使用synthesizer生成最终结果
        final_result = await self.engine.spawn_agent(
            role="synthesizer",
            task=f"{synthesizer_prompt}\n\n子任务结果:\n{merged}",
        )

        return final_result

    async def execute_expert_consultation(
        self,
        question: str,
        perspectives: List[str],
        final_decision_prompt: str = "基于以上专家意见，做出最终决策",
    ) -> tuple[List[AgentResult], AgentResult]:
        """
        专家会诊执行

        Args:
            question: 需要决策的问题
            perspectives: 不同视角列表 (如: ["性能", "安全", "可维护性"])
            final_decision_prompt: 最终决策提示

        Returns:
            (各专家意见列表, 最终决策)
        """
        # 构建多视角任务
        expert_tasks = [
            {
                "role": "analyzer",
                "task": f"从{perspective}角度分析: {question}",
            }
            for perspective in perspectives
        ]

        # 并行获取各专家意见
        expert_results, merged_opinions = await self.execute_parallel(
            tasks=expert_tasks,
            merge_strategy="synthesize",
        )

        # 综合决策
        final_decision = await self.engine.spawn_agent(
            role="synthesizer",
            task=f"{final_decision_prompt}\n\n各角度分析:\n{merged_opinions}\n\n原始问题: {question}",
        )

        return expert_results, final_decision

    # ==================== 高级编排 ====================

    async def execute_plan(self, plan: OrchestrationPlan) -> Dict[str, Any]:
        """
        执行编排计划

        Args:
            plan: 编排计划

        Returns:
            执行结果
        """
        start_time = datetime.now()

        if plan.mode == OrchestrationMode.SEQUENTIAL:
            tasks = [
                {
                    "role": node.role,
                    "task": node.task,
                    "context_hint": node.context_hint,
                    "timeout": node.timeout,
                }
                for node in plan.nodes
            ]
            results = await self.execute_sequential(tasks)
            merged = self.engine.merge(results, strategy=plan.merge_strategy)

        elif plan.mode == OrchestrationMode.PARALLEL:
            tasks = [
                {
                    "role": node.role,
                    "task": node.task,
                    "context_hint": node.context_hint,
                    "timeout": node.timeout,
                }
                for node in plan.nodes
            ]
            results, merged = await self.execute_parallel(
                tasks=tasks,
                merge_strategy=plan.merge_strategy,
            )

        elif plan.mode == OrchestrationMode.DIVIDE_CONQUER:
            # 转换为分治结构
            main_task = plan.metadata.get("main_task", "执行任务")
            subtasks = [
                {"role": node.role, "task": node.task, "context_hint": node.context_hint}
                for node in plan.nodes
            ]
            result = await self.execute_divide_conquer(
                task=main_task,
                subtasks=subtasks,
            )
            results = [result]
            merged = result.to_summary()

        elif plan.mode == OrchestrationMode.EXPERT_CONSULT:
            question = plan.metadata.get("question", "")
            perspectives = [node.task for node in plan.nodes]
            results, final = await self.execute_expert_consultation(
                question=question,
                perspectives=perspectives,
            )
            results.append(final)
            merged = final.to_summary()

        else:
            raise ValueError(f"未知编排模式: {plan.mode}")

        execution_time = (datetime.now() - start_time).total_seconds()

        return {
            "mode": plan.mode.value,
            "results": [r.to_dict() for r in results],
            "merged": merged,
            "execution_time": execution_time,
            "node_count": len(plan.nodes),
        }

    # ==================== 便捷方法 ====================

    def create_sequential_plan(
        self,
        tasks: List[Dict[str, Any]],
    ) -> OrchestrationPlan:
        """创建顺序编排计划"""
        nodes = []
        for i, task in enumerate(tasks):
            node = TaskNode(
                task_id=f"seq_{i}",
                role=task.get("role", "explorer"),
                task=task.get("task", ""),
                context_hint=task.get("context_hint", []),
                depends_on=[f"seq_{i-1}"] if i > 0 else [],
            )
            nodes.append(node)

        return OrchestrationPlan(
            mode=OrchestrationMode.SEQUENTIAL,
            nodes=nodes,
        )

    def create_parallel_plan(
        self,
        tasks: List[Dict[str, Any]],
        merge_strategy: str = "synthesize",
    ) -> OrchestrationPlan:
        """创建并行编排计划"""
        nodes = [
            TaskNode(
                task_id=f"par_{i}",
                role=task.get("role", "explorer"),
                task=task.get("task", ""),
                context_hint=task.get("context_hint", []),
            )
            for i, task in enumerate(tasks)
        ]

        return OrchestrationPlan(
            mode=OrchestrationMode.PARALLEL,
            nodes=nodes,
            merge_strategy=merge_strategy,
        )

    def create_expert_plan(
        self,
        question: str,
        perspectives: List[str],
    ) -> OrchestrationPlan:
        """创建专家会诊计划"""
        nodes = [
            TaskNode(
                task_id=f"expert_{i}",
                role="analyzer",
                task=perspective,
            )
            for i, perspective in enumerate(perspectives)
        ]

        return OrchestrationPlan(
            mode=OrchestrationMode.EXPERT_CONSULT,
            nodes=nodes,
            metadata={"question": question},
        )

    # ==================== 内部方法 ====================

    def _generate_task_id(self) -> str:
        """生成任务ID"""
        self.task_counter += 1
        return f"task_{self.task_counter}_{datetime.now().strftime('%H%M%S')}"

    def _log_execution(
        self,
        mode: str,
        index: int,
        task_config: Dict[str, Any],
        result: AgentResult,
    ):
        """记录执行日志"""
        self.execution_log.append({
            "mode": mode,
            "index": index,
            "role": task_config.get("role"),
            "task": task_config.get("task", "")[:100],
            "status": result.status,
            "timestamp": datetime.now().isoformat(),
        })

    def get_execution_log(self) -> List[Dict[str, Any]]:
        """获取执行日志"""
        return self.execution_log

    def clear_execution_log(self):
        """清空执行日志"""
        self.execution_log.clear()

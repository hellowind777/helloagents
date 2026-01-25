#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM REPL Environment
递归语言模型REPL环境

基于MIT RLM设计:
- Python REPL环境
- 递归自调用
- 外部数据存储
- 工具执行
"""

import asyncio
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .engine import RLMEngine, RLMMode, AgentResult
from .context_manager import ContextManager, ContextEvent
from .folding import ContextFolder, Trajectory, FoldingStrategy


@dataclass
class REPLState:
    """REPL状态"""
    turn: int = 0
    answer: Dict[str, Any] = field(default_factory=lambda: {"content": "", "ready": False})
    variables: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict[str, Any]] = field(default_factory=list)


class RLMREPL:
    """
    RLM REPL环境

    提供类似MIT RLM的编程环境:
    - rlm.peek(): 查看外部数据片段
    - rlm.store(): 存储数据
    - rlm.fold(): 折叠子轨迹
    - rlm.spawn_agent(): 递归调用子Agent
    - rlm.batch(): 并行执行
    - rlm.answer: 渐进式输出
    """

    def __init__(
        self,
        mode: RLMMode = RLMMode.ACTIVE,
        working_dir: Optional[Path] = None,
    ):
        self.engine = RLMEngine(mode=mode)
        self.context = ContextManager()
        self.folder = ContextFolder()
        self.state = REPLState()
        self.working_dir = working_dir or Path.cwd()

    # ==================== REPL核心API ====================

    def peek(self, data_key: str, start: int = 0, end: int = 1000) -> str:
        """
        查看外部存储的数据片段

        Args:
            data_key: 数据键名 (文件路径或变量名)
            start: 起始位置
            end: 结束位置

        Returns:
            数据片段
        """
        # 首先检查变量
        if data_key in self.state.variables:
            data = str(self.state.variables[data_key])
            return data[start:end]

        # 尝试作为文件路径
        file_path = self._resolve_path(data_key)
        if file_path and file_path.exists():
            try:
                content = file_path.read_text(encoding='utf-8')
                return content[start:end]
            except Exception as e:
                return f"[ERROR] 读取文件失败: {e}"

        # 使用engine的peek
        return self.engine.peek(data_key, start, end)

    def store(self, key: str, data: Any, persist: bool = False) -> bool:
        """
        存储数据

        Args:
            key: 键名
            data: 数据
            persist: 是否持久化

        Returns:
            是否成功
        """
        # 存储到变量
        self.state.variables[key] = data

        # 持久化
        if persist:
            return self.engine.store(key, str(data), persist=True)

        return True

    def fold(
        self,
        content: str,
        strategy: str = "balanced",
        custom_prompt: Optional[str] = None,
    ) -> str:
        """
        折叠内容生成摘要

        Args:
            content: 要折叠的内容
            strategy: 策略 (aggressive | balanced | conservative)
            custom_prompt: 自定义摘要提示

        Returns:
            摘要
        """
        strategy_map = {
            "aggressive": FoldingStrategy.AGGRESSIVE,
            "balanced": FoldingStrategy.BALANCED,
            "conservative": FoldingStrategy.CONSERVATIVE,
        }

        trajectory = Trajectory(
            trajectory_id=f"repl_fold_{self.state.turn}",
            content=content,
        )

        result = self.folder.fold(
            trajectory=trajectory,
            strategy=strategy_map.get(strategy, FoldingStrategy.BALANCED),
            custom_prompt=custom_prompt,
        )

        return result.summary

    async def spawn_agent(
        self,
        role: str,
        task: str,
        context_hint: Optional[List[str]] = None,
        timeout: int = 120,
    ) -> AgentResult:
        """
        创建子Agent

        Args:
            role: 角色 (explorer | analyzer | implementer | reviewer | tester | synthesizer)
            task: 任务描述
            context_hint: 上下文提示
            timeout: 超时时间

        Returns:
            Agent结果
        """
        # 记录到历史
        self._record_action("spawn_agent", {
            "role": role,
            "task": task[:100],
        })

        result = await self.engine.spawn_agent(
            role=role,
            task=task,
            context_hint=context_hint,
            timeout=timeout,
        )

        # 记录结果
        self._record_action("agent_result", {
            "role": role,
            "status": result.status,
            "findings_count": len(result.key_findings),
        })

        return result

    async def batch(self, tasks: List[Dict[str, Any]]) -> List[AgentResult]:
        """
        并行执行多个Agent

        Args:
            tasks: 任务列表 [{role, task, context_hint}]

        Returns:
            结果列表
        """
        self._record_action("batch", {"count": len(tasks)})

        results = await self.engine.batch(tasks)

        return results

    def merge(self, results: List[AgentResult], strategy: str = "synthesize") -> str:
        """
        合并多个Agent结果

        Args:
            results: 结果列表
            strategy: 合并策略 (concat | synthesize | vote)

        Returns:
            合并后的内容
        """
        return self.engine.merge(results, strategy=strategy)

    # ==================== Answer管理 ====================

    def set_answer(self, content: str, ready: bool = False):
        """
        设置answer (渐进式输出)

        Args:
            content: 内容
            ready: 是否完成
        """
        self.state.answer["content"] = content
        self.state.answer["ready"] = ready

    def append_answer(self, content: str):
        """追加内容到answer"""
        self.state.answer["content"] += content

    def get_answer(self) -> Dict[str, Any]:
        """获取answer"""
        return self.state.answer.copy()

    def finalize_answer(self):
        """标记answer完成"""
        self.state.answer["ready"] = True

    # ==================== 上下文管理 ====================

    def load_context(self, key: str) -> Optional[str]:
        """加载上下文 (从知识库)"""
        return self.context.load_memory(key)

    def save_context(self, key: str, content: str) -> bool:
        """保存上下文 (到知识库)"""
        return self.context.save_memory(key, content)

    def get_working_context(self) -> List[Dict[str, Any]]:
        """获取工作上下文"""
        return self.context.get_working_context()

    def add_to_context(self, event_type: str, content: Any):
        """添加到上下文"""
        event = ContextEvent(event_type=event_type, content=content)
        self.context.add_to_working(event)

    # ==================== 执行控制 ====================

    async def execute(self, instruction: str) -> Dict[str, Any]:
        """
        执行指令

        Args:
            instruction: 指令 (自然语言或特殊命令)

        Returns:
            执行结果
        """
        self.state.turn += 1

        # 记录
        self._record_action("execute", {"instruction": instruction[:200]})

        # 解析指令
        if instruction.startswith("peek:"):
            # peek:key:start:end
            parts = instruction.split(":")
            key = parts[1] if len(parts) > 1 else ""
            start = int(parts[2]) if len(parts) > 2 else 0
            end = int(parts[3]) if len(parts) > 3 else 1000
            result = self.peek(key, start, end)
            return {"type": "peek", "result": result}

        elif instruction.startswith("store:"):
            # store:key:value
            parts = instruction.split(":", 2)
            key = parts[1] if len(parts) > 1 else "temp"
            value = parts[2] if len(parts) > 2 else ""
            success = self.store(key, value)
            return {"type": "store", "success": success}

        elif instruction.startswith("fold:"):
            # fold:content
            content = instruction[5:]
            summary = self.fold(content)
            return {"type": "fold", "summary": summary}

        elif instruction.startswith("spawn:"):
            # spawn:role:task
            parts = instruction.split(":", 2)
            role = parts[1] if len(parts) > 1 else "explorer"
            task = parts[2] if len(parts) > 2 else ""
            result = await self.spawn_agent(role, task)
            return {"type": "spawn", "result": result.to_dict()}

        else:
            # 默认: 分析指令
            result = await self.spawn_agent(
                role="analyzer",
                task=instruction,
            )
            self.set_answer(result.to_summary(), ready=True)
            return {"type": "analyze", "result": result.to_dict()}

    def run_sync(self, instruction: str) -> Dict[str, Any]:
        """同步执行"""
        return asyncio.run(self.execute(instruction))

    # ==================== 状态管理 ====================

    def get_status(self) -> Dict[str, Any]:
        """获取REPL状态"""
        return {
            "turn": self.state.turn,
            "answer_ready": self.state.answer["ready"],
            "variables_count": len(self.state.variables),
            "history_count": len(self.state.history),
            "engine_status": self.engine.get_status(),
            "context_status": self.context.get_status(),
        }

    def get_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """获取历史"""
        return self.state.history[-limit:]

    def reset(self):
        """重置REPL"""
        self.state = REPLState()
        self.engine.reset()
        self.context.reset()

    # ==================== 内部方法 ====================

    def _resolve_path(self, path_str: str) -> Optional[Path]:
        """解析路径"""
        path = Path(path_str)
        if path.is_absolute():
            return path
        return self.working_dir / path

    def _record_action(self, action_type: str, details: Dict[str, Any]):
        """记录动作"""
        self.state.history.append({
            "turn": self.state.turn,
            "action": action_type,
            "details": details,
            "timestamp": datetime.now().isoformat(),
        })


# ==================== 交互式REPL ====================

async def interactive_repl():
    """交互式REPL循环"""
    print("HelloAGENTS-RLM REPL v1.0.0")
    print("输入 'help' 查看帮助, 'exit' 退出")
    print("-" * 40)

    repl = RLMREPL()

    while True:
        try:
            user_input = input(f"\n[{repl.state.turn}] >>> ").strip()

            if not user_input:
                continue

            if user_input.lower() in ('exit', 'quit', 'q'):
                print("再见!")
                break

            if user_input.lower() == 'help':
                print("""
可用命令:
  peek:key:start:end  - 查看数据片段
  store:key:value     - 存储数据
  fold:content        - 折叠内容
  spawn:role:task     - 创建子Agent
  status              - 查看状态
  history             - 查看历史
  reset               - 重置
  exit                - 退出

直接输入其他内容将作为分析任务执行
                """)
                continue

            if user_input.lower() == 'status':
                print(json.dumps(repl.get_status(), ensure_ascii=False, indent=2))
                continue

            if user_input.lower() == 'history':
                for item in repl.get_history():
                    print(f"  [{item['turn']}] {item['action']}: {item['details']}")
                continue

            if user_input.lower() == 'reset':
                repl.reset()
                print("已重置")
                continue

            # 执行
            result = await repl.execute(user_input)
            print(json.dumps(result, ensure_ascii=False, indent=2, default=str))

        except KeyboardInterrupt:
            print("\n按Ctrl+C退出")
        except EOFError:
            break
        except Exception as e:
            print(f"错误: {e}")


# ==================== CLI入口 ====================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HelloAGENTS-RLM REPL")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互式模式")
    parser.add_argument("--execute", "-e", type=str, help="执行指令")
    parser.add_argument("--status", action="store_true", help="显示状态")

    args = parser.parse_args()

    if args.interactive:
        asyncio.run(interactive_repl())
    elif args.execute:
        repl = RLMREPL()
        result = repl.run_sync(args.execute)
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    elif args.status:
        repl = RLMREPL()
        print(json.dumps(repl.get_status(), ensure_ascii=False, indent=2))
    else:
        print("HelloAGENTS-RLM REPL v1.0.0")
        print("使用 --help 查看帮助, -i 进入交互模式")

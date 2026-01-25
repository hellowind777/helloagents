#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM Engine
核心引擎实现

基于:
- MIT RLM: Python REPL + 递归自调用
- Context Folding: 子轨迹分支 + 折叠
- Codex Native: spawn_agent + role preset
"""

import asyncio
import json
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import IntEnum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

# 添加父目录到路径以导入utils
sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.utils import setup_encoding, ExecutionReport

setup_encoding()


class RLMMode(IntEnum):
    """RLM运行模式"""
    DISABLED = 0    # 禁用RLM
    PASSIVE = 1     # 被动模式: 仅在context溢出时启用折叠
    ACTIVE = 2      # 主动模式: 预判性分支和折叠 (默认)
    AGGRESSIVE = 3  # 激进模式: 所有子任务都spawn独立agent


# 多 CLI 后端配置
CLI_BACKENDS = {
    "codex": {
        "exec_cmd": ["codex", "exec"],
        "model_flag": "--model",
        "sandbox_flag": "--sandbox",
        "json_flag": "--json",
        "skip_git_flag": "--skip-git-repo-check",
        "default_model": "gpt-5.2-codex",
    },
    "gemini": {
        "exec_cmd": ["gemini"],  # Gemini CLI 子代理通过内置机制
        "model_flag": "--model",
        "sandbox_flag": None,  # Gemini 使用不同的沙箱机制
        "json_flag": "--json",
        "skip_git_flag": None,
        "default_model": "gemini-3",
    },
    "qwen": {
        "exec_cmd": ["qwen-code"],  # Qwen Code 基于 Gemini CLI fork
        "model_flag": "--model",
        "sandbox_flag": None,
        "json_flag": "--json",
        "skip_git_flag": None,
        "default_model": "qwen3-coder",
    },
    "claude": {
        "exec_cmd": None,  # Claude Code 使用 Task 工具，不使用命令行
        "use_task_tool": True,
        "default_model": "claude-sonnet-4",
    },
    "grok": {
        "exec_cmd": ["grok", "agent"],  # Grok CLI (开发中)
        "model_flag": "--model",
        "sandbox_flag": None,
        "json_flag": "--json",
        "skip_git_flag": None,
        "default_model": "grok-code-fast-1",
    },
}


def detect_cli_backend() -> str:
    """
    检测当前运行的 CLI 环境

    Returns:
        CLI 后端名称: codex, gemini, qwen, claude, grok
    """
    import os
    import shutil

    # 检测环境变量
    if os.environ.get("CODEX_CLI"):
        return "codex"
    if os.environ.get("GEMINI_CLI"):
        return "gemini"
    if os.environ.get("QWEN_CODE"):
        return "qwen"
    if os.environ.get("CLAUDE_CODE"):
        return "claude"
    if os.environ.get("GROK_CLI"):
        return "grok"

    # 检测可用的 CLI 命令
    if shutil.which("codex"):
        return "codex"
    if shutil.which("gemini"):
        return "gemini"
    if shutil.which("qwen-code"):
        return "qwen"
    if shutil.which("grok"):
        return "grok"

    # 默认回退到 codex
    return "codex"


@dataclass
class AgentResult:
    """子Agent执行结果"""
    thread_id: str
    status: str  # completed | failed | partial
    key_findings: List[str] = field(default_factory=list)
    changes_made: List[Dict[str, Any]] = field(default_factory=list)
    issues_found: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    needs_followup: bool = False
    followup_context: str = ""
    raw_output: str = ""
    execution_time: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "thread_id": self.thread_id,
            "status": self.status,
            "key_findings": self.key_findings,
            "changes_made": self.changes_made,
            "issues_found": self.issues_found,
            "recommendations": self.recommendations,
            "needs_followup": self.needs_followup,
            "followup_context": self.followup_context,
            "execution_time": self.execution_time,
        }

    def to_summary(self) -> str:
        """生成简洁摘要"""
        parts = [f"[{self.status.upper()}]"]
        if self.key_findings:
            parts.append(f"发现: {'; '.join(self.key_findings[:3])}")
        if self.changes_made:
            parts.append(f"变更: {len(self.changes_made)}个文件")
        if self.issues_found:
            parts.append(f"问题: {len(self.issues_found)}个")
        return " | ".join(parts)


@dataclass
class FoldedTrajectory:
    """折叠后的轨迹"""
    trajectory_id: str
    original_length: int
    summary: str
    key_artifacts: List[str] = field(default_factory=list)
    timestamp: str = ""
    fold_reason: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%Y%m%d%H%M%S")


class RLMEngine:
    """
    RLM核心引擎

    特点:
    1. 利用Codex原生spawn_agent (零MCP预加载开销)
    2. 实现MIT RLM风格的REPL环境
    3. Context Folding主动管理上下文
    4. 三层上下文架构
    """

    # 角色预设映射
    ROLE_PRESETS = {
        "explorer": {
            "description": "探索代码库，收集上下文",
            "sandbox": "read-only",
            "tools": ["read", "grep", "glob"],
        },
        "analyzer": {
            "description": "深度分析代码/需求/架构",
            "sandbox": "read-only",
            "tools": ["read", "grep", "glob", "test"],
        },
        "implementer": {
            "description": "编写/修改代码",
            "sandbox": "workspace-write",
            "tools": ["read", "write", "edit", "bash"],
        },
        "reviewer": {
            "description": "代码审查，质量检查",
            "sandbox": "read-only",
            "tools": ["read", "grep", "glob", "test"],
        },
        "tester": {
            "description": "编写/运行测试",
            "sandbox": "workspace-write",
            "tools": ["read", "write", "edit", "bash", "test"],
        },
        "synthesizer": {
            "description": "综合多个agent的输出",
            "sandbox": "read-only",
            "tools": ["read"],
        },
    }

    def __init__(
        self,
        mode: RLMMode = RLMMode.ACTIVE,
        max_depth: int = 5,
        max_parallel: int = 24,
        working_context_limit: int = 8000,
        codex_model: str = "gpt-5.2-codex",
        backend: Optional[str] = None,
    ):
        """
        初始化RLM引擎

        Args:
            mode: RLM运行模式
            max_depth: 最大递归深度
            max_parallel: 最大并行子Agent数
            working_context_limit: 工作上下文token限制
            codex_model: Codex模型名称（兼容参数，优先使用后端默认模型）
            backend: CLI 后端名称（codex/gemini/qwen/claude/grok），None 时自动检测
        """
        self.mode = mode
        self.max_depth = max_depth
        self.max_parallel = max_parallel
        self.working_context_limit = working_context_limit

        # 后端检测和配置
        self.backend = backend or detect_cli_backend()
        self.backend_config = CLI_BACKENDS.get(self.backend, CLI_BACKENDS["codex"])
        self.codex_model = codex_model if codex_model != "gpt-5.2-codex" else self.backend_config.get("default_model", codex_model)

        # 状态变量
        self.current_depth = 0
        self.active_agents: Dict[str, asyncio.Task] = {}
        self.folded_summaries: Dict[str, FoldedTrajectory] = {}
        self.trajectory_counter = 0

        # 三层上下文
        self.working_context: List[Dict[str, Any]] = []
        self.session_events: List[Dict[str, Any]] = []
        self.memory_refs: Dict[str, str] = {}  # key -> file path or memory://key

        # 执行报告
        self.report = ExecutionReport("rlm_engine")

    # ==================== REPL核心函数 ====================

    def peek(self, data_key: str, start: int = 0, end: int = 1000) -> str:
        """
        查看外部存储的数据片段
        不将全部数据加载到context

        Args:
            data_key: 数据键名
            start: 起始位置
            end: 结束位置

        Returns:
            数据片段
        """
        if data_key not in self.memory_refs:
            return f"[ERROR] Data key '{data_key}' not found in memory_refs"

        ref = self.memory_refs[data_key]

        if ref.startswith("memory://"):
            # 内存数据 - 实际应用中这里会有内存存储
            return f"[MEMORY] {data_key}[{start}:{end}]"

        # 文件数据
        try:
            file_path = Path(ref)
            if not file_path.exists():
                return f"[ERROR] File not found: {ref}"

            content = file_path.read_text(encoding='utf-8')
            return content[start:end]
        except Exception as e:
            return f"[ERROR] Failed to read '{data_key}': {e}"

    def store(self, key: str, data: str, persist: bool = False) -> bool:
        """
        存储数据到外部存储

        Args:
            key: 数据键名
            data: 数据内容
            persist: 是否持久化到文件系统

        Returns:
            是否成功
        """
        try:
            if persist:
                # 写入helloagents知识库缓存目录
                cache_dir = Path.cwd() / "helloagents" / ".rlm_cache"
                cache_dir.mkdir(parents=True, exist_ok=True)

                file_path = cache_dir / f"{key}.txt"
                file_path.write_text(data, encoding='utf-8')
                self.memory_refs[key] = str(file_path)
            else:
                # 仅存储引用标记
                self.memory_refs[key] = f"memory://{key}"

            self.session_events.append({
                "type": "store",
                "key": key,
                "persist": persist,
                "size": len(data),
                "timestamp": self._get_timestamp(),
            })
            return True
        except Exception as e:
            self.report.mark_failed("store", [f"存储数据 {key}"], str(e))
            return False

    def fold(
        self,
        trajectory: str,
        summary_prompt: str = "保留关键信息，生成简洁摘要",
        fold_reason: str = "manual",
    ) -> FoldedTrajectory:
        """
        折叠子轨迹
        使用LLM生成摘要，替换原内容

        Args:
            trajectory: 要折叠的轨迹内容
            summary_prompt: 摘要生成提示
            fold_reason: 折叠原因

        Returns:
            折叠后的轨迹对象
        """
        self.trajectory_counter += 1
        trajectory_id = f"traj_{self.trajectory_counter}_{self._get_timestamp()}"

        # 生成摘要 (同步方式，利用当前LLM)
        summary = self._generate_summary(trajectory, summary_prompt)

        # 提取关键产物
        artifacts = self._extract_artifacts(trajectory)

        folded = FoldedTrajectory(
            trajectory_id=trajectory_id,
            original_length=len(trajectory),
            summary=summary,
            key_artifacts=artifacts,
            fold_reason=fold_reason,
        )

        # 原内容存入session events (可用于回溯)
        self.session_events.append({
            "type": "folded_trajectory",
            "trajectory_id": trajectory_id,
            "original": trajectory,
            "summary": summary,
            "artifacts": artifacts,
            "timestamp": folded.timestamp,
        })

        # 缓存折叠结果
        self.folded_summaries[trajectory_id] = folded

        return folded

    async def spawn_agent(
        self,
        role: str,
        task: str,
        context_hint: Optional[List[str]] = None,
        timeout: int = 120,
    ) -> AgentResult:
        """
        创建独立context的子agent
        使用Codex原生spawn_agent + role preset

        Args:
            role: 角色名称 (explorer/analyzer/implementer/reviewer/tester/synthesizer)
            task: 任务描述
            context_hint: 相关文件/目录提示
            timeout: 超时时间(秒)

        Returns:
            Agent执行结果
        """
        # 检查递归深度
        if self.current_depth >= self.max_depth:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=[f"达到最大递归深度 {self.max_depth}"],
            )

        # 验证角色
        if role not in self.ROLE_PRESETS:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=[f"未知角色: {role}，可用角色: {list(self.ROLE_PRESETS.keys())}"],
            )

        self.current_depth += 1
        start_time = datetime.now()

        try:
            # 构建子agent提示
            prompt = self._build_agent_prompt(role, task, context_hint or [])

            # 获取角色配置
            role_config = self.ROLE_PRESETS[role]

            # 记录事件
            self.session_events.append({
                "type": "spawn_agent",
                "role": role,
                "task": task,
                "context_hint": context_hint,
                "timestamp": self._get_timestamp(),
            })

            # 执行Codex agent
            result = await self._execute_codex_agent(
                prompt=prompt,
                sandbox=role_config["sandbox"],
                timeout=timeout,
            )

            result.execution_time = (datetime.now() - start_time).total_seconds()
            return result

        except asyncio.TimeoutError:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=[f"执行超时 ({timeout}秒)"],
                execution_time=(datetime.now() - start_time).total_seconds(),
            )
        except Exception as e:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=[f"执行错误: {e}"],
                execution_time=(datetime.now() - start_time).total_seconds(),
            )
        finally:
            self.current_depth -= 1

    async def batch(
        self,
        tasks: List[Dict[str, Any]],
    ) -> List[AgentResult]:
        """
        并行执行多个子agent任务

        Args:
            tasks: 任务列表，每个任务包含 role, task, context_hint

        Returns:
            结果列表
        """
        if not tasks:
            return []

        # 分批处理 (最大24并行)
        results = []
        for i in range(0, len(tasks), self.max_parallel):
            batch = tasks[i:i + self.max_parallel]

            # 并行执行当前批次
            batch_results = await asyncio.gather(*[
                self.spawn_agent(
                    role=t.get("role", "explorer"),
                    task=t.get("task", ""),
                    context_hint=t.get("context_hint"),
                    timeout=t.get("timeout", 120),
                )
                for t in batch
            ], return_exceptions=True)

            # 处理异常
            for j, r in enumerate(batch_results):
                if isinstance(r, Exception):
                    results.append(AgentResult(
                        thread_id="",
                        status="failed",
                        key_findings=[f"批量执行异常: {r}"],
                    ))
                else:
                    results.append(r)

        return results

    async def wait(self, thread_ids: List[str]) -> List[AgentResult]:
        """
        等待多个agent完成

        Args:
            thread_ids: 要等待的thread ID列表

        Returns:
            结果列表
        """
        results = []
        for tid in thread_ids:
            if tid in self.active_agents:
                try:
                    result = await self.active_agents[tid]
                    results.append(result)
                except Exception as e:
                    results.append(AgentResult(
                        thread_id=tid,
                        status="failed",
                        key_findings=[f"等待失败: {e}"],
                    ))
        return results

    def merge(
        self,
        results: List[AgentResult],
        strategy: str = "synthesize",
    ) -> str:
        """
        合并多个agent的输出

        Args:
            results: Agent结果列表
            strategy: 合并策略 (concat | synthesize | vote)

        Returns:
            合并后的输出
        """
        if not results:
            return ""

        if strategy == "concat":
            # 简单拼接
            parts = []
            for i, r in enumerate(results):
                parts.append(f"## Agent {i+1} ({r.status})")
                parts.append(r.raw_output or r.to_summary())
            return "\n\n---\n\n".join(parts)

        elif strategy == "synthesize":
            # 综合所有发现
            all_findings = []
            all_recommendations = []
            all_issues = []

            for r in results:
                all_findings.extend(r.key_findings)
                all_recommendations.extend(r.recommendations)
                all_issues.extend(r.issues_found)

            # 去重
            unique_findings = list(dict.fromkeys(all_findings))
            unique_recommendations = list(dict.fromkeys(all_recommendations))

            synthesis = []
            if unique_findings:
                synthesis.append("### 关键发现")
                synthesis.extend([f"- {f}" for f in unique_findings[:10]])
            if unique_recommendations:
                synthesis.append("\n### 建议")
                synthesis.extend([f"- {r}" for r in unique_recommendations[:10]])
            if all_issues:
                synthesis.append(f"\n### 问题 ({len(all_issues)}个)")
                for issue in all_issues[:5]:
                    synthesis.append(f"- [{issue.get('severity', 'medium')}] {issue.get('description', '')}")

            return "\n".join(synthesis)

        elif strategy == "vote":
            # 投票 (取众数)
            from collections import Counter
            all_recommendations = []
            for r in results:
                all_recommendations.extend(r.recommendations)

            if not all_recommendations:
                return "无共识建议"

            counter = Counter(all_recommendations)
            return "\n".join([f"- {item} ({count}票)" for item, count in counter.most_common(5)])

        return ""

    # ==================== 内部方法 ====================

    def _build_agent_prompt(
        self,
        role: str,
        task: str,
        context_hint: List[str],
    ) -> str:
        """构建子agent提示"""
        role_config = self.ROLE_PRESETS.get(role, {})
        role_desc = role_config.get("description", "执行任务")

        # 加载角色预设文件 (如果存在)
        role_file = Path(__file__).parent / "roles" / f"{role}.md"
        role_instructions = ""
        if role_file.exists():
            role_instructions = role_file.read_text(encoding='utf-8')

        context_str = ""
        if context_hint:
            context_str = f"\n\n## 相关上下文\n文件/目录: {', '.join(context_hint)}"

        return f"""# 角色: {role}
{role_desc}

{role_instructions}

## 任务
{task}
{context_str}

## 输出要求
请以JSON格式返回结果:
```json
{{
  "status": "completed|failed|partial",
  "key_findings": ["发现1", "发现2"],
  "changes_made": [{{"file": "path", "type": "modify|create|delete"}}],
  "issues_found": [{{"severity": "high|medium|low", "description": "..."}}],
  "recommendations": ["建议1", "建议2"],
  "needs_followup": false,
  "followup_context": ""
}}
```
"""

    async def _execute_codex_agent(
        self,
        prompt: str,
        sandbox: str,
        timeout: int,
    ) -> AgentResult:
        """执行子代理（支持多 CLI 后端）"""
        # Claude Code 使用 Task 工具，返回提示信息
        if self.backend_config.get("use_task_tool"):
            return AgentResult(
                thread_id="",
                status="info",
                key_findings=["Claude Code 环境: 请使用 Task 工具启动子代理"],
                recommendations=[f"Task(subagent_type='{sandbox}', prompt='{prompt[:100]}...')"],
            )

        exec_cmd = self.backend_config.get("exec_cmd")
        if not exec_cmd:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=[f"后端 {self.backend} 不支持命令行执行"],
            )

        try:
            # 动态构建命令
            cmd = list(exec_cmd)  # 复制基础命令

            # 添加 JSON 输出标志
            if self.backend_config.get("json_flag"):
                cmd.append(self.backend_config["json_flag"])

            # 添加跳过 Git 检查标志
            if self.backend_config.get("skip_git_flag"):
                cmd.append(self.backend_config["skip_git_flag"])

            # 添加沙箱模式
            if self.backend_config.get("sandbox_flag"):
                cmd.extend([self.backend_config["sandbox_flag"], sandbox])

            # 添加模型参数
            if self.backend_config.get("model_flag"):
                cmd.extend([self.backend_config["model_flag"], self.codex_model])

            # 添加提示词
            cmd.append(prompt)

            # 异步执行
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(Path.cwd()),
            )

            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout,
            )

            output = stdout.decode('utf-8', errors='replace')
            error = stderr.decode('utf-8', errors='replace')

            if proc.returncode != 0 and error:
                return AgentResult(
                    thread_id="",
                    status="failed",
                    key_findings=[f"Codex错误: {error[:500]}"],
                    raw_output=output,
                )

            return self._parse_agent_output(output)

        except FileNotFoundError:
            return AgentResult(
                thread_id="",
                status="failed",
                key_findings=["Codex CLI未安装或不在PATH中"],
            )

    def _parse_agent_output(self, output: str) -> AgentResult:
        """解析agent输出"""
        # 尝试从输出中提取JSON
        thread_id = ""

        try:
            for line in output.split('\n'):
                line = line.strip()
                if not line:
                    continue

                # 尝试解析JSON
                if line.startswith('{'):
                    try:
                        data = json.loads(line)

                        # 检查是否是结果JSON
                        if "status" in data:
                            return AgentResult(
                                thread_id=data.get("threadId", thread_id),
                                status=data.get("status", "completed"),
                                key_findings=data.get("key_findings", []),
                                changes_made=data.get("changes_made", []),
                                issues_found=data.get("issues_found", []),
                                recommendations=data.get("recommendations", []),
                                needs_followup=data.get("needs_followup", False),
                                followup_context=data.get("followup_context", ""),
                                raw_output=output,
                            )

                        # 提取threadId
                        if "threadId" in data:
                            thread_id = data["threadId"]

                    except json.JSONDecodeError:
                        continue

        except Exception:
            pass

        # 无法解析JSON，返回原始输出
        return AgentResult(
            thread_id=thread_id,
            status="completed",
            key_findings=[output[:500] if output else "无输出"],
            raw_output=output,
        )

    def _generate_summary(self, content: str, prompt: str) -> str:
        """
        生成摘要

        注意: 这里是同步实现，实际使用时会利用当前LLM上下文
        """
        # 简化实现: 提取关键行
        lines = content.split('\n')
        key_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue
            # 保留标题、错误、重要标记
            if any(marker in line.lower() for marker in
                   ['#', 'error', 'warning', 'success', 'failed', 'completed', '✅', '❌', '⚠️']):
                key_lines.append(line)
            # 保留JSON结构
            elif line.startswith('{') or line.startswith('['):
                key_lines.append(line[:200])

        if key_lines:
            return '\n'.join(key_lines[:20])

        # 如果没有关键行，返回截断内容
        return content[:500] + "..." if len(content) > 500 else content

    def _extract_artifacts(self, trajectory: str) -> List[str]:
        """提取关键产物 (文件路径、变量名等)"""
        import re
        artifacts = []

        # 提取文件路径
        paths = re.findall(r'[\w./\\-]+\.\w{1,10}', trajectory)
        artifacts.extend(paths[:10])

        # 提取函数/类名
        funcs = re.findall(r'(?:def|class|function)\s+(\w+)', trajectory)
        artifacts.extend(funcs[:5])

        return list(dict.fromkeys(artifacts))  # 去重

    def _get_timestamp(self) -> str:
        """获取时间戳"""
        return datetime.now().strftime("%Y%m%d%H%M%S")

    # ==================== 状态管理 ====================

    def get_status(self) -> Dict[str, Any]:
        """获取当前RLM状态"""
        return {
            "mode": self.mode.name,
            "current_depth": self.current_depth,
            "max_depth": self.max_depth,
            "active_agents": len(self.active_agents),
            "folded_count": len(self.folded_summaries),
            "session_events_count": len(self.session_events),
            "memory_refs_count": len(self.memory_refs),
        }

    def reset(self):
        """重置RLM状态"""
        self.current_depth = 0
        self.active_agents.clear()
        self.folded_summaries.clear()
        self.trajectory_counter = 0
        self.working_context.clear()
        self.session_events.clear()
        self.memory_refs.clear()


# ==================== 便捷函数 ====================

def create_engine(
    mode: Union[RLMMode, int] = RLMMode.ACTIVE,
    **kwargs,
) -> RLMEngine:
    """创建RLM引擎实例"""
    if isinstance(mode, int):
        mode = RLMMode(mode)
    return RLMEngine(mode=mode, **kwargs)


async def quick_analyze(
    target: str,
    engine: Optional[RLMEngine] = None,
) -> AgentResult:
    """快速分析目标"""
    if engine is None:
        engine = create_engine()

    return await engine.spawn_agent(
        role="analyzer",
        task=f"分析以下目标: {target}",
        context_hint=[target] if Path(target).exists() else None,
    )


async def quick_implement(
    spec: str,
    engine: Optional[RLMEngine] = None,
) -> AgentResult:
    """快速实现规格"""
    if engine is None:
        engine = create_engine()

    return await engine.spawn_agent(
        role="implementer",
        task=spec,
    )


# ==================== CLI入口 ====================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="HelloAGENTS RLM Engine")
    parser.add_argument("--mode", type=int, default=2, help="RLM模式 (0-3)")
    parser.add_argument("--status", action="store_true", help="显示状态")
    parser.add_argument("--analyze", type=str, help="分析目标")
    parser.add_argument("--implement", type=str, help="实现规格")

    args = parser.parse_args()

    engine = create_engine(mode=args.mode)

    if args.status:
        print(json.dumps(engine.get_status(), ensure_ascii=False, indent=2))
    elif args.analyze:
        result = asyncio.run(quick_analyze(args.analyze, engine))
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    elif args.implement:
        result = asyncio.run(quick_implement(args.implement, engine))
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        print("HelloAGENTS RLM Engine v1.0.0")
        print("使用 --help 查看帮助")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS 双向上下文注入脚本（阶段感知版）

通过 Claude Code Hooks 实现两个方向的上下文注入:
- UserPromptSubmit: 主代理规则强化（阶段感知 — 检测当前阶段注入对应执行规则）
- SubagentStart: 子代理上下文注入（方案包上下文）

阶段检测逻辑:
- DEVELOP: .helloagents/plan/ 有方案包且含 tasks.md → 注入 develop.md 关键步骤
- DESIGN: 有方案包目录但无 tasks.md → 注入 design.md 关键步骤
- 无阶段: 注入通用 CRITICAL 规则摘要 + 核心流程提醒

输入(stdin): JSON，包含 hookEventName 字段
输出(stdout): JSON，包含 hookSpecificOutput
"""

import sys
import json
import re
import io
from pathlib import Path

# Windows UTF-8 编码设置
if sys.platform == 'win32':
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'buffer'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    if hasattr(sys.stdin, 'buffer'):
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# 限制注入内容大小，避免 token 膨胀
MAX_MAIN_AGENT_CHARS = 20000
MAX_SUBAGENT_CHARS = 15000


# ---------------------------------------------------------------------------
# 阶段检测
# ---------------------------------------------------------------------------

def detect_stage(cwd: str) -> str:
    """检测当前 HelloAGENTS 执行阶段。

    通过 .helloagents/plan/ 目录状态推断:
    - "DEVELOP": 有方案包且 tasks.md 存在（设计已完成，进入开发）
    - "DESIGN": 有方案包目录但无 tasks.md（设计进行中）
    - "": 无方案包（评估阶段或无活跃流程）
    """
    plan_dir = Path(cwd) / ".helloagents" / "plan"
    if not plan_dir.is_dir():
        return ""

    pkg_dirs = sorted(
        [d for d in plan_dir.iterdir() if d.is_dir()],
        key=lambda d: d.name,
    )
    if not pkg_dirs:
        return ""

    latest = pkg_dirs[-1]
    tasks_file = latest / "tasks.md"
    proposal_file = latest / "proposal.md"

    if tasks_file.is_file() and proposal_file.is_file():
        # 检查是否有未完成任务
        try:
            content = tasks_file.read_text(encoding="utf-8")
            if "[ ]" in content or "[?]" in content:
                return "DEVELOP"
            # 全部完成但未归档 → 仍在 DEVELOP 收尾
            if "[√]" in content or "[X]" in content:
                return "DEVELOP"
        except (OSError, UnicodeDecodeError):
            pass
        return "DEVELOP"

    if proposal_file.is_file():
        return "DESIGN"

    return ""


# ---------------------------------------------------------------------------
# 阶段规则摘要（硬编码关键执行步骤，不依赖文件截断）
# ---------------------------------------------------------------------------

DEVELOP_RULES = """[HelloAGENTS DEVELOP 阶段执行提醒]
你当前处于开发实施阶段，必须严格按以下步骤执行:

1. 加载模块: 读取 stages/develop.md + services/package.md（G7 规则，不可跳过）
2. 确定方案包: 读取 CURRENT_PACKAGE 的 tasks.md 和 proposal.md
3. 按任务清单逐项执行: moderate/complex 任务必须编排子代理（G9）
4. 每个任务完成后更新 tasks.md 状态符号（[ ]→[√]/[X]/[-]）+ LIVE_STATUS 区域
5. 安全与质量检查（步骤7）
6. 测试执行与验证（步骤8）
7. 功能验收测试（步骤9）: 模拟最终用户首次使用场景，验证交付物可正常工作。测试通过≠用户可用
8. 知识库同步（步骤10）: KB_SKIPPED=false 时创建 CHANGELOG.md/context.md/INDEX.md/modules/
9. 方案包归档（步骤14）: plan/ → archive/YYYY-MM/，更新 tasks.md 最终状态
10. 输出验收报告

DO NOT: 跳过模块加载直接写代码 | 跳过子代理编排 | 跳过功能验收 | 跳过知识库同步 | 跳过方案包归档"""

DESIGN_RULES = """[HelloAGENTS DESIGN 阶段执行提醒]
你当前处于方案设计阶段，必须按 stages/design.md 执行:

Phase1: 上下文收集 → 项目扫描 → 复杂度评估（TASK_COMPLEXITY）→ KB_SKIPPED 判定
Phase2: 方案构思 → 方案包生成（proposal.md + tasks.md）→ validate_package.py 验收
完成后: 设置 CURRENT_STAGE=DEVELOP → 按 G7 加载 develop.md → 进入开发实施

DO NOT: 跳过 Phase1 直接写方案 | 跳过方案包验收 | 设计完成后直接写代码不加载 develop.md"""

GENERIC_RULES = """[HelloAGENTS 核心流程提醒]
- G4 路由: R0 直接响应 | R1 快速流程 | R2 简化流程（含简单新建项目）| R3 标准流程
- G5 阶段链: 评估→确认→DESIGN→DEVELOP→KB同步→完成（每阶段必须加载对应模块文件 G7）
- G7 模块加载: 进入 DESIGN 读 stages/design.md | 进入 DEVELOP 读 stages/develop.md
- G9 子代理: moderate/complex 任务强制编排子代理
- G11 注意力: tasks.md 状态必须随进度更新"""


def extract_critical_rules(content: str) -> str:
    """从 CLAUDE.md / AGENTS.md 提取 CRITICAL 标记的规则段和核心流程入口。"""
    lines = content.split("\n")
    critical_sections = []
    in_critical = False
    current_block = []

    for line in lines:
        # 检测 CRITICAL 标记
        if "CRITICAL" in line.upper():
            in_critical = True
            current_block = [line]
            continue

        if in_critical:
            # 遇到同级或更高级标题时结束当前块
            if re.match(r"^#{1,3}\s", line) and current_block:
                critical_sections.append("\n".join(current_block))
                current_block = []
                in_critical = False
            else:
                current_block.append(line)

    # 收尾
    if current_block:
        critical_sections.append("\n".join(current_block))

    result = "\n---\n".join(critical_sections)

    # 截断到限制长度
    if len(result) > MAX_MAIN_AGENT_CHARS:
        result = result[:MAX_MAIN_AGENT_CHARS] + "\n...(已截断)"

    return result


def handle_user_prompt_submit(cwd: str) -> dict:
    """
    路径1: UserPromptSubmit — 主代理规则强化（阶段感知）

    检测当前执行阶段，注入阶段相关的执行规则摘要。
    解决 compact 后规则丢失、长对话中 agent 行为漂移的问题。

    注入策略:
    - DEVELOP 阶段: 注入 develop.md 关键步骤摘要（最高优先级）
    - DESIGN 阶段: 注入 design.md 关键步骤摘要
    - 无阶段: 注入通用 CRITICAL 规则摘要（原有逻辑）
    """
    cwd_path = Path(cwd)

    # 1. 阶段检测
    stage = detect_stage(cwd)

    # 2. 阶段规则注入（优先于通用 CRITICAL 提取）
    if stage == "DEVELOP":
        return {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": DEVELOP_RULES,
            },
        }

    if stage == "DESIGN":
        return {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": DESIGN_RULES,
            },
        }

    # 3. 无活跃阶段 → 通用规则提取（原有逻辑）
    rule_file = None
    for name in ("CLAUDE.md", "AGENTS.md"):
        candidate = cwd_path / name
        if candidate.is_file():
            rule_file = candidate
            break

    if not rule_file:
        return {}

    try:
        content = rule_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}

    # 通用规则 + CRITICAL 提取
    summary = GENERIC_RULES + "\n---\n" + extract_critical_rules(content)
    if len(summary) > MAX_MAIN_AGENT_CHARS:
        summary = summary[:MAX_MAIN_AGENT_CHARS] + "\n...(已截断)"

    if not summary.strip():
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                f"[HelloAGENTS] 规则提醒（来自 {rule_file.name}）:\n{summary}"
            ),
        }
    }


def handle_subagent_start(cwd: str) -> dict:
    """
    路径2: SubagentStart — 子代理上下文注入

    读取 .helloagents/ 下的方案包上下文（proposal.md + tasks.md + context.md），
    组装为结构化上下文字符串注入子代理。
    """
    ha_dir = Path(cwd) / ".helloagents"
    if not ha_dir.is_dir():
        return {}

    parts = []

    # 1. 读取 context.md（项目上下文摘要）
    context_file = ha_dir / "context.md"
    if context_file.is_file():
        try:
            ctx = context_file.read_text(encoding="utf-8").strip()
            if ctx:
                parts.append(f"## 项目上下文\n{ctx[:4000]}")
        except (OSError, UnicodeDecodeError):
            pass

    # 1.5 读取 guidelines.md（项目技术指南，开发前注入）
    guidelines_file = ha_dir / "guidelines.md"
    if guidelines_file.is_file():
        try:
            gl = guidelines_file.read_text(encoding="utf-8").strip()
            if gl:
                parts.append(f"## 技术指南\n{gl[:3000]}")
        except (OSError, UnicodeDecodeError):
            pass

    # 2. 读取 plan/ 下当前方案包
    plan_dir = ha_dir / "plan"
    if plan_dir.is_dir():
        # 找最新的方案包目录（按名称排序，最新在后）
        pkg_dirs = sorted(
            [d for d in plan_dir.iterdir() if d.is_dir()],
            key=lambda d: d.name,
        )
        if pkg_dirs:
            latest_pkg = pkg_dirs[-1]
            # 读取 proposal.md
            proposal = latest_pkg / "proposal.md"
            if proposal.is_file():
                try:
                    text = proposal.read_text(encoding="utf-8").strip()
                    if text:
                        parts.append(f"## 当前方案 ({latest_pkg.name})\n{text[:6000]}")
                except (OSError, UnicodeDecodeError):
                    pass

            # 读取 tasks.md
            tasks = latest_pkg / "tasks.md"
            if tasks.is_file():
                try:
                    text = tasks.read_text(encoding="utf-8").strip()
                    if text:
                        parts.append(f"## 任务清单\n{text[:1500]}")
                except (OSError, UnicodeDecodeError):
                    pass

    if not parts:
        return {}

    combined = "\n\n".join(parts)
    if len(combined) > MAX_SUBAGENT_CHARS:
        combined = combined[:MAX_SUBAGENT_CHARS] + "\n...(已截断)"

    return {
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": (
                f"[HelloAGENTS] 方案包上下文（自动注入）:\n{combined}"
            ),
        }
    }


def main():
    """主入口: 从 stdin 读取 hook 事件 JSON，按 hookEventName 分发处理。"""
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    event = data.get("hookEventName", "")
    cwd = data.get("cwd", ".")

    if event == "UserPromptSubmit":
        result = handle_user_prompt_submit(cwd)
    elif event == "SubagentStart":
        result = handle_subagent_start(cwd)
    else:
        sys.exit(0)

    if result:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
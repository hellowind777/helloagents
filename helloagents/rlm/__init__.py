#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HelloAGENTS-RLM: Recursive Language Model

子代理编排与多终端协作模块。

组件:
- session.py: 会话持久化管理（事件日志、代理历史）
- shared_tasks.py: 多终端协作任务列表（文件锁并发安全）
- roles/*.md: 子代理角色预设文件
- schemas/agent_result.json: 子代理结果 JSON Schema
"""

from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("helloagents")
except PackageNotFoundError:
    __version__ = "0.0.0"

---
name: helloagents
description: AI-native sub-agent orchestration framework for multi-CLI environments
metadata:
  short-description: Structured task workflow with RLM sub-agent orchestration
---

HelloAGENTS is a structured task workflow system that orchestrates AI sub-agents
across multiple CLI environments (Claude Code, Codex CLI, OpenCode, Gemini CLI, Qwen CLI, Grok CLI).

Core capabilities:
- Multi-stage workflow: EVALUATE → DESIGN → DEVELOP (验收内嵌于 DEVELOP)
- RLM (Role-based Language Model) sub-agent orchestration with 5 specialized roles + native CLI sub-agents
- Three-tier knowledge base (L0 user / L1 project / L2 session)
- Plan package management for complex feature development
- Multi-terminal collaboration via shared task lists

AGENTS.md is loaded from the CLI configuration directory by default and is already active.

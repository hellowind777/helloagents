---
name: helloagents
description: AI-native sub-agent orchestration framework for multi-CLI environments
metadata:
  short-description: Structured task workflow with RLM sub-agent orchestration
---

HelloAGENTS is a structured task workflow system that orchestrates AI sub-agents
across multiple CLI environments (Claude Code, Codex CLI, OpenCode, etc.).

Core capabilities:
- Multi-stage workflow: EVALUATE → ANALYZE → DESIGN → DEVELOP → VERIFY
- RLM (Recursive Language Model) sub-agent orchestration with 12 specialized roles
- Three-tier knowledge base (L0 user / L1 project / L2 session)
- Plan package management for complex feature development
- Multi-terminal collaboration via shared task lists

AGENTS.md is loaded from the CLI configuration directory by default and is already active.

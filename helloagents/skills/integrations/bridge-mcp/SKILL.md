---
name: bridge-mcp
description: >
  MCP server discovery and integration bridge.
  Enables HelloAGENTS to discover and use MCP-provided tools.
provides: [mcp-discovery, protocol-bridge]
category: integration
trigger:
  auto: false
requires: []
user-invocable: false
metadata:
  author: helloagents
  version: "3.0"
  max-tokens: 800
---

# MCP Bridge

## Overview
Bridges MCP (Model Context Protocol) servers registered in CLI config
into HelloAGENTS's capability discovery system.

## Discovery
```yaml
MCP servers are registered in CLI-native config:
  Claude Code: ~/.claude/settings.json → mcpServers
  Codex CLI: config.toml → [mcp_servers]
  Others: per-CLI MCP configuration

HelloAGENTS discovers MCP tools via:
  1. CLI exposes MCP tools in available tool list
  2. Bootstrap step 2: "Matches active Skill/MCP/plugin → tool path"
  3. Tool path execution: call MCP tool per its protocol
```

## Integration Rules
```yaml
priority: MCP tools match before HelloAGENTS internal routing
execution: follow MCP tool's own protocol and parameters
output: present MCP results naturally, no special formatting required
```

## Constraints
DO: Let MCP tools handle their own execution.
DO NOT: Re-implement MCP tool functionality. Modify MCP tool output content.

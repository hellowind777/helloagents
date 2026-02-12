"""HelloAGENTS - 自主的高级智能伙伴

Multi-CLI compatible agent framework supporting Claude Code, Codex CLI,
OpenCode, Gemini CLI, Qwen CLI, and Grok CLI.
"""

from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("helloagents")
except PackageNotFoundError:
    __version__ = "0.0.0"  # fallback for development
__author__ = "HelloWind"

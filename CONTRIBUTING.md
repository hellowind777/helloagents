# Contributing to HelloAGENTS

Thanks for your interest in contributing! This repo is a **multi-bundle distribution** of HelloAGENTS:

- `Codex CLI/` (for Codex CLI users)
- `Claude Code/` (for Claude Code users)
- `Gemini CLI/` (for Gemini CLI users)
- `Grok CLI/` (for Grok CLI users)
- `Qwen CLI/` (for Qwen CLI users)

Please keep changes consistent across all bundles unless there is a CLI-specific reason not to.

## Documentation

- Project doc (English): `README.md`
- 中文文档: `README_CN.md`
- License: `LICENSE`

## How to Contribute

### Report issues

- 🐛 **Bug reports:** open an issue with reproduction steps and your environment (OS + CLI)
- 💡 **Feature requests:** open an issue or discussion describing the problem and the desired behavior

### Submit changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Verify the basics (see below)
5. Commit with a clear message (Conventional Commits)
6. Push to your fork and open a Pull Request

## What to Verify Before a PR

### Docs changes

- `README.md` and `README_CN.md` stay in sync (same structure and code blocks)
- Links work (especially paths with spaces like `Codex CLI/`)
- `readme_images/` exists and SVGs are small (aim &lt; 10KB each)

### Bundle consistency

If you change any workflow rules:

- Update the entry config files (when applicable):
  - `Codex CLI/AGENTS.md`
  - `Claude Code/CLAUDE.md`
  - `Gemini CLI/GEMINI.md`
  - `Grok CLI/GROK.md`
  - `Qwen CLI/QWEN.md`
- Update the skill packages under each bundle:
  - `{BUNDLE_DIR}/skills/helloagents/`

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `refactor:` refactors
- `test:` tests
- `chore:` maintenance

## License

By contributing, you agree that your contributions will be licensed under the terms described in `LICENSE`.

# Contributing to HelloAGENTS

Thanks for your interest in contributing.

This repository is now package-first (helloagents/) and ships workflow definitions for multiple AI CLIs.

## Documentation

- English README: [README.md](./README.md)
- 中文 README: [README_CN.md](./README_CN.md)
- License: [LICENSE](./LICENSE.md)

## Development Setup

    # Clone and enter repo
    git clone https://github.com/hellowind777/helloagents.git
    cd helloagents

    # Optional: editable install
    pip install -e .

    # Quick check
    python -m helloagents.cli status

## How to Contribute

### 1) Open an issue first (recommended)

- Bug report: include reproduction steps + OS + target CLI
- Feature request: describe current pain and expected behavior

### 2) Submit a Pull Request

1. Fork the repository
2. Create a branch (git checkout -b feature/your-change)
3. Implement changes
4. Validate behavior locally
5. Update documentation when behavior changes
6. Commit and open PR

## Contribution Rules

- Keep README.md and README_CN.md in sync (same structure and code snippets).
- If you update workflow behavior, update the corresponding files in:
  - helloagents/functions/
  - helloagents/stages/
  - helloagents/rules/
  - helloagents/services/
- Avoid hardcoding user-specific paths in templates and docs.
- For safety-sensitive logic, include validation notes in PR description.

## Commit Format

We recommend Conventional Commits: feat, fix, docs, refactor, test, chore.

## Pull Request Checklist

- [ ] Changes are scoped and focused
- [ ] Docs updated (if needed)
- [ ] No accidental secrets or credentials
- [ ] Basic command flow checked (install, status, version)
- [ ] Workflow content still coherent across modules

## License

By contributing, you agree that your contributions will be licensed under the terms described in [LICENSE](./LICENSE.md).

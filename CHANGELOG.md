# Changelog

## [3.1.8] - 2026-07-01

### Security
- Git pre-commit self-check upgraded from passive warning to proactive handling: credentials, PII, and local absolute paths auto-replaced with placeholders; sensitive config files and private documents auto-added to `.gitignore`
- Self-check rule integrated into Security Check Layer 2 (always active); auto-commit mechanics stay in Local Version Checkpoint (gated by `auto_commit_enabled`)

### Changed
- Local Version Checkpoint restored to multi-line format for clearer AI step-by-step execution
- Security Layer 2 split: commit-relevant items (credentials, PII) proactively handled; operational items (production mistakes, permission bypass) remain warn-only

## [3.1.7] - 2026-06-28

### Added
- `~ask` command: interactive requirements clarification via Q&A, merges `~idea` + `~office`
- `~plan` / `~prd` / `~build` now default to interactive clarification mode
- Task completion criteria updated to independently verifiable boolean conditions

### Fixed
- `COMMAND_ALIASES` missing `idea: 'ask'` mapping
- Unified all command SKILL.md voice to second-person "you"
- Stale guard test assertions synced with current behavior

## [3.1.6] - 2026-06-20

### Changed
- Bootstrap core rules refactored for clarity and conciseness
- Sub-agent short-circuit rule promoted to top of bootstrap files
- Standardized selection format across ~ask/~plan/~prd

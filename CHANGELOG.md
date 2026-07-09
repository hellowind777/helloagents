# Changelog

## [3.1.9] - 2026-07-09

### Added
- Grok Build dual-mode integration: standby carrier + hooks, and native marketplace/plugin global mode
- Cursor dual-mode integration: standby hooks + runtime link, and native local-plugin global mode

### Changed
- Cursor global install now materializes a real plugin copy under `~/.cursor/plugins/local/helloagents` instead of relying on an external symlink target
- Lifecycle, doctor, and verification coverage now treat Cursor and Grok as first-class host flows across install, update, cleanup, uninstall, mode switching, and branch switching

### Fixed
- `helloagents` / `helloagents help` no longer crash while rendering the Cursor uninstall path

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

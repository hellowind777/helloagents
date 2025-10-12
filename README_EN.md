<!-- README_EN.md -->
# helloagents

<p align="center"><a href="./README.md">中文</a></p>

**Multi-stage + Project-Wiki–driven rules for AI coding agents.**
Built upon **workflow3.md** (`geekoe/workflow3`), this project extends the three-phase workflow with a complete **Project Wiki operating model** (ADR, Mermaid diagrams, changelog, governance), adding an **Intent Routing** and **Error Handling** stage for full traceability and self-governance of AI programming processes.

## Features
- **Five-phase loop**: Router → Analyze → Plan → Execute → Error Handling (on-demand)
- **Project Wiki first-class**: `PROJECTWIKI.md` as the single source of truth, in strict sync with code
- **Mermaid-first diagrams**: architecture, sequence, ER, class, dependency, and state, all version-controlled
- **Built-in governance**: ADR, Conventional Commits, Keep a Changelog, atomic commits
- **Security boundaries**: no unauthorized execution or production access; unified secret management
- **No-Write-by-Default principle**: only P1/P2 project paths perform repository writes

## Project Layout
```

your-project/
├─ AGENTS.md                 # global rules for agent execution
├─ PROJECTWIKI.md            # synced project wiki
├─ adr/                      # architecture decision records
├─ CHANGELOG.md              # follows Keep a Changelog
├─ docs/                     # other documentation
└─ src/                      # source code

````

## Requirements & Installation
- TBD

## Quick Start
```bash
# copy rules into your project
cp -r helloagents/* your-project/
# rename for agent compatibility
mv your-project/README.md your-project/AGENTS.md
```

## Usage

- **C0 | Advisory (No-Code)**: answers only, no repo I/O.
- **P0 | Planning (No-Exec)**: design proposal, no code change.
- **P1 | Existing project change**: analyze existing repo.
- **P2 | New project**: generate minimal scaffold and base wiki.

## Development

- Follow **Conventional Commits** & **Keep a Changelog**
- Ensure atomic commits across code and docs
- Use **Mermaid** for architecture & dependency visualization

## Compatibility & Known Issues

- Verified for GitHub-based project structures only
- Future updates may add private Wiki / external KB sync support

## Versioning & Upgrade

- Added new “Intent Routing” stage and No-Write-by-Default rule
- Compatible with upstream `workflow3.md` template

## Contributing

- PRs welcome for improved structure, Mermaid templates, or ADR examples

## Security

- Do not commit secrets or credentials
- Use `.env.example` + CI injection approach

## License & Attribution (**Commercial use allowed, attribution required**)

To ensure "commercial use allowed + attribution required", this project adopts a **dual-license** scheme:

1. **Code** — **Apache License 2.0** © 2025 hellowind
   - Commercial use is allowed. You must retain **LICENSE** and **NOTICE** information in your distribution.
   - Include a `NOTICE` in your distribution (example):
     ```
     This product includes "helloagents" (author: hellowind), licensed under the Apache License 2.0.
     ```

2. **Documentation (README/PROJECTWIKI/Diagrams)** — **CC BY 4.0** © 2025 hellowind
   - Commercial use is allowed, but **attribution is required**; provide a license link and indicate whether changes were made.
   - Suggested attribution when reusing documentation:
     ```
     Text/graphics adapted from "helloagents" — © 2025 hellowind, CC BY 4.0.
     ```

**Unified attribution suggestion (for both code and docs):**
```
helloagents — © 2025 hellowind. Code: Apache-2.0; Docs: CC BY 4.0.
```

## Acknowledgments / Upstream
- Upstream: **workflow3.md** (geekoe/workflow3)
- Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki ecosystem
````
<!-- README_EN.md -->
# HelloAGENTS

<p align="center"><a href="./README.md">中文</a>    ENGLISH</p>

**`HelloAGENTS` is a “Smart Routing + Multi-Stage + Project Wiki–Driven” rule set for AI programming agents.**
It extends the upstream [workflow3.md](https://github.com/geekoe/workflow3) three-phase model,
introducing **smart intent routing**, **multi-stage pipelines**, and a **PROJECTWIKI governance lifecycle**
to ensure continuous consistency, traceability, and self-evolving documentation across projects.

---

## Features
- **Five-phase closed loop**: Router → Analyze → Plan → Execute → Error Handling (on demand)
- **Project Wiki as first-class citizen**: `PROJECTWIKI.md` ensures strong code–doc consistency
- **Smart Intent Routing**: Automatically identifies C0/P0/P1/P2 scenarios
- **Mermaid-first visualization**: Architecture, process, dependency, ER, and class diagrams version-controlled
- **Governance built-in**: ADR, Conventional Commits, Keep a Changelog, atomic commits
- **Security boundaries**: No unauthorized execution or external access; unified key management
- **No-Write-by-Default**: Only project-type requests (P1/P2) read or write `PROJECTWIKI.md`
- **Continuous Consistency**: CI hooks ensure PROJECTWIKI freshness and dependency alignment

---

## Project Layout
```
%USERPROFILE%/.codex/AGENTS.md  # Global rules (for model access)
your-project/
├─ PROJECTWIKI.md               # Project Wiki (code–doc consistency)
├─ adr/                         # Architecture Decision Records (ADR)
├─ CHANGELOG.md                 # Follows Keep a Changelog
├─ docs/                        # Other docs
└─ src/                         # Source code
```

---

## Installation & Usage
1. Copy `AGENTS.md` into your home directory under `.codex`.
2. Restart the terminal — the CLI will automatically load the rule set.

---

## Logic Overview
- **C0 | Pure Consultation (No-Code)**: Only advice, no file operations.
- **P0 | Planning (No-Exec)**: Generates design plans without editing code.
- **P1 | Existing Project Update**: Analyzes and updates the PROJECTWIKI.
- **P2 | New Project Creation**: Scaffolds new code and initializes `PROJECTWIKI.md`.
- **Error Handling**: Automatically invokes Phase 5 for replication and fix tracking.

---

## Development
- Follow **Conventional Commits** and **Keep a Changelog**
- Enforce atomic commits for all code–doc updates
- Use **Mermaid** for architecture and dependency diagrams
- Always sync documentation with code updates

---

## Compatibility & Known Issues
- Tested within GitHub repository environments
- Future updates will support private Wikis and external knowledge integration

---

## Version & Upgrade
2025-10-14 Update:
* Synced with new governance model in AGENTS.md
* Improved PROJECTWIKI lifecycle and incremental updates
* Enhanced retrospection and consistency verification

2025-10-13 Update:
* Added Smart Routing (Intent Flow)
* Enhanced error handling and retrospective process
* Optimized PROJECTWIKI lifecycle and governance model

2025-10-12 Update:
* Maintained compatibility with workflow3.md template
* Unified naming and commit conventions

…older updates omitted…

---

## Contributing
- Contributions improving structure, Mermaid templates, or ADR models are welcome
- Follow project conventions and update changelogs when submitting PRs

---

## Security
- Do not commit keys or production credentials
- Use `.env.example` + CI variable injection

---

## License & Attribution (**Commercial use allowed, attribution required**)

To ensure "commercial use allowed + attribution required", this project adopts a **dual-license** scheme:

1. **Code** — **Apache License 2.0** © 2025 Hellowind
   - Commercial use is allowed. You must retain **LICENSE** and **NOTICE** information in your distribution.
   - Include a `NOTICE` in your distribution (example):
     <pre>
     This product includes "HelloAGENTS" (author: <a href="https://github.com/hellowind777/helloagents">Hellowind</a>), licensed under the Apache License 2.0.
     </pre>

2. **Documentation (README/PROJECTWIKI/Diagrams)** — **CC BY 4.0** © 2025 Hellowind
   - Commercial use is allowed, but **attribution is required**; provide a license link and indicate whether changes were made.
   - Suggested attribution when reusing documentation:
     <pre>
     Text/graphics adapted from "HelloAGENTS" — © 2025 <a href="https://github.com/hellowind777/helloagents">Hellowind</a>, CC BY 4.0.
     </pre>

3. **Unified attribution suggestion (for both code and docs):**
     <pre>
     HelloAGENTS — © 2025 <a href="https://github.com/hellowind777/helloagents">Hellowind</a>. Code: Apache-2.0; Docs: CC BY 4.0.
     </pre>

---

## Acknowledgments / Upstream Template
- Upstream: **workflow3.md** ([geekoe/workflow3](https://github.com/geekoe/workflow3))
- Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki community

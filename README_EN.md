<!-- README_EN.md -->
# helloagents

<p align="center"><a href="./README.md">中文</a>    ENGLISH</p>

**`helloagents` is a “Smart Routing + Multi-Stage + Project Wiki–Driven” rule set for AI programming agents.**
It extends the upstream [workflow3.md](https://github.com/geekoe/workflow3) 3-phase model by adding a
complete **Project Wiki–driven mechanism** (ADR, Mermaid diagrams, changelogs, governance standards, etc.),
and introducing **intent routing** and **error-handling retrospection**,
making AI agent workflows self-explanatory, traceable, and consistently maintainable.

---

## Features
- **Five-phase closed loop**: Router → Analyze → Plan → Execute → Error Handling (triggered as needed)
- **Project Wiki as a first-class citizen**: `PROJECTWIKI.md` serves as the single source of truth
- **Smart intent routing**: Automatically classifies C0/P0/P1/P2 paths for minimal cost execution
- **Mermaid-first visualization**: Architecture, process, ER, class, dependency diagrams all version-controllable
- **Governance built-in**: ADR, Conventional Commits, Keep a Changelog, atomic commits
- **Security boundaries**: No unauthorized execution or external production access; unified key management
- **Minimalist principle (No-Write-by-Default)**: `PROJECTWIKI.md` is read/written only for project-type requests (P1/P2)

---

## Project Layout
```

%USERPROFILE%/.codex/AGENTS.md  # Global rules (for all models)
your-project/
├─ PROJECTWIKI.md               # Project Wiki (strong code–doc consistency)
├─ adr/                         # Architecture Decision Records (ADR)
├─ CHANGELOG.md                 # Follows Keep a Changelog
├─ docs/                        # Other documentation
└─ src/                         # Source code

````

---

## Installation & Usage
1. Copy `AGENTS.md` to your user home’s `.codex` directory.
2. Restart the terminal; the CLI will automatically load the rule set.

---

## Logic Overview
- **C0 | Pure Consultation (No-Code)**: Provides answers/advice; does not read/write project files.
- **P0 | Solution Planning (No-Exec)**: Generates practical plans; does not modify code.
- **P1 | Existing Project Modification**: For repositories with code — enters “Analyze Problem.”
- **P2 | New Project Creation**: Scaffolds and generates a `PROJECTWIKI.md`.
- **Error Requests**: May directly enter Phase 5 “Error Handling” for debugging and retrospection.

---

## Development
- Follow **Conventional Commits** and **Keep a Changelog**
- All code and docs must be atomically committed
- Use Mermaid diagrams for architecture and dependency visualization
- Ensure consistent synchronization between documentation and code

---

## Compatibility & Known Issues
- Validated under GitHub project structures
- Future plans: support private Wikis and external knowledge base sync

---

## Version & Upgrade
2025-10-13 Update:
* Added Smart Routing (Intent Classification)
* Enhanced Error Handling & Retrospective Workflow
* Improved PROJECTWIKI governance lifecycle

2025-10-12 Update:
* Maintained compatibility with workflow3.md template
* Unified naming and commit conventions

…older updates omitted…

---

## Contributing
- Contributions improving documentation structure, Mermaid templates, or ADR models are welcome
- Please follow project conventions when submitting PRs

---

## Security
- Never commit keys or production credentials
- Use `.env.example` + CI-based variable injection

---

## License & Attribution (**Commercial use allowed, attribution required**)

To ensure "commercial use allowed + attribution required", this project adopts a **dual-license** scheme:

1. **Code** — **Apache License 2.0** © 2025 hellowind
   - Commercial use is allowed. You must retain **LICENSE** and **NOTICE** information.
   - Include a `NOTICE` in your distribution (example):
     ```
     This product includes "helloagents" (author: hellowind), licensed under the Apache License 2.0.
     ```

2. **Documentation (README/PROJECTWIKI/Diagrams)** — **CC BY 4.0** © 2025 hellowind
   - Commercial use is allowed, but **attribution is required**.
   - Suggested attribution:
     ```
     Text/graphics adapted from "helloagents" — © 2025 hellowind, CC BY 4.0.
     ```

**Unified attribution suggestion (for both code and docs):**
````

helloagents — © 2025 hellowind. Code: Apache-2.0; Docs: CC BY 4.0.

```

---

## Acknowledgments / Upstream Template
- Upstream: **workflow3.md** ([geekoe/workflow3](https://github.com/geekoe/workflow3))
- Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki docs and community
```

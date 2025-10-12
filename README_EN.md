# HelloAGENTS

<p align="center"><a href="./README_EN.md">ENGLISH</a></p>

**A “multi-stage + project Wiki–driven” rule set for AI programming agents.**
This project extends the three-phase process from **workflow3.md** (`geekoe/workflow3`) by introducing a complete **project Wiki–driven mechanism** (ADR, Mermaid diagrams, changelogs, governance rules, etc.), along with **intent routing** and **error-handling retrospection** phases. Together, these enable self-explanatory, traceable, and sustainably consistent AI programming workflows.

---

## Features

* **Five-phase closed loop**: Router → Analyze → Plan → Execute → Error Handling (triggered as needed)
* **Project Wiki as a first-class citizen**: `PROJECTWIKI.md` serves as the single source of truth and stays **strongly consistent** with the codebase
* **Mermaid-first diagram system**: Architecture, sequence, ER, class, dependency, and state diagrams are all version-controlled
* **Built-in governance**: ADR, Conventional Commits, Keep a Changelog, and atomic commits
* **Security boundaries**: Prohibits unauthorized service execution or external production access; unified key management
* **Minimalist principle (No-Write-by-Default)**: Read/write `PROJECTWIKI.md` only for project-type requests (P1/P2)

---

## Directory Structure

```
%USERPROFILE%/.codex/AGENTS.md  # Global rules (accessible to all models)

your-project/
├─ PROJECTWIKI.md               # Project Wiki (code–doc strong consistency)
├─ adr/                         # Architecture Decision Records (ADR)
├─ CHANGELOG.md                 # Follows "Keep a Changelog"
├─ docs/                        # Other documentation
└─ src/                         # Source code
```

---

## Quick Start

1. Copy the `AGENTS.md` file from this repository to your user home directory (e.g., `C:\Users\ZhangSan`).
   In File Explorer, enter:

   ```
   %USERPROFILE%\.codex
   ```
2. Close and reopen your CLI.

---

## Logic Overview

* **C0 | Pure Consultation (No-Code)**: Only provides answers or advice, does not read/write project files.
* **P0 | Solution Planning (No-Exec)**: Produces actionable plans but does not modify code.
* **P1 | Existing Project Changes**: For existing repositories—enter the “Analyze Problem” phase.
* **P2 | New Project**: No existing code—scaffold a new project and generate `PROJECTWIKI.md`.

---

## Development & Build

* Follow **Conventional Commits** and **Keep a Changelog**
* All documentation and code changes must be **atomically committed**
* Use Mermaid diagrams for architecture and dependency visualization

---

## Compatibility & Known Issues

* Currently tested only in GitHub project structures
* Future versions plan to support synchronization with private Wikis and external knowledge bases

---

## Version & Upgrade Notes

* Added Phase 1 **Intent Routing** and **Minimal Write Principle**
* Remains compatible with the upstream `workflow3.md` template

---

## Contribution

* Contributions improving document structure, Mermaid templates, or ADR models are welcome

---

## Security

* Never commit keys or production credentials
* Recommended approach: `.env.example` + CI-based secret injection

---

## License & Attribution (**Commercial use allowed with attribution required**)

To ensure "commercial use allowed + attribution required," this project uses a **dual license** model:

1. **Code** — **Apache License 2.0** © 2025 hellowind

   * Commercial use permitted. Distribution must retain **LICENSE** and **NOTICE** files (copyright and license info).
   * Example `NOTICE` for your distribution:

     ```
     This product includes "HelloAGENTS" (author: hellowind), licensed under Apache License 2.0.
     ```

2. **Documentation (README / PROJECTWIKI / Diagrams)** — **CC BY 4.0** © 2025 hellowind

   * Commercial use allowed **with attribution**; must link to the license and indicate any modifications.
   * Suggested attribution example:

     ```
     Text/diagrams adapted from "HelloAGENTS" — © 2025 hellowind, CC BY 4.0.
     ```

**Unified attribution recommendation (for both code and docs):**

```
HelloAGENTS — © 2025 hellowind. Code: Apache-2.0; Docs: CC BY 4.0.
```

---

## Acknowledgments / Upstream Template

* Upstream: **workflow3.md** (`geekoe/workflow3`)
* Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki docs
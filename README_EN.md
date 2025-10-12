# HelloAGENTS

<p align="center"><a href="./README.md">简体中文</a>    ENGLISH</p>

**`HelloAGENTS` is a “multi-stage + project Wiki–driven” rule set for AI programming agents.**
This project extends the three-phase process of **workflow3.md** (<a href="./README_EN.md" target="_blank">geekoe/workflow3</a>), adding a complete **project Wiki–driven mechanism** (ADR, Mermaid diagrams, changelog, governance standards, etc.), and introducing **intent routing** and **error-handling retrospection** phases — enabling AI programming workflows that are self-explanatory, traceable, and sustainably consistent.

---

## Features

* **Five-phase closed loop**: Router → Analyze → Plan → Execute → Error Handling (triggered as needed)
* **Project Wiki as a first-class citizen**: `PROJECTWIKI.md` serves as the single source of truth, remaining **strongly consistent** with code
* **Mermaid-first diagram system**: Architecture, sequence, ER, class, dependency, and state diagrams are all version-controllable
* **Built-in governance**: ADR, Conventional Commits, Keep a Changelog, atomic commits
* **Security boundaries**: Disallows unauthorized service execution or external production access; unified key management
* **Minimalist principle (No-Write-by-Default)**: `PROJECTWIKI.md` is read/written only for project-type requests (P1/P2)

---

## Directory Structure

```
%USERPROFILE%/.codex/AGENTS.md  # Global rules (readable by all models)

your-project/
├─ PROJECTWIKI.md               # Project Wiki (strong code–doc consistency)
├─ adr/                         # Architecture Decision Records (ADR)
├─ CHANGELOG.md                 # Follows Keep a Changelog
├─ docs/                        # Other documentation
└─ src/                         # Source code
```

---

## Installation & Usage

1. Copy `AGENTS.md` from this repository to your current user’s home directory (enter `%USERPROFILE%\.codex` in the file explorer address bar);
2. Close the terminal and reopen the CLI — the system will be ready to use.

---

## Logic Overview

* **C0 | Pure Consultation (No-Code)**: Provides answers or advice only; does not read/write project files.
* **P0 | Solution Planning (No-Exec)**: Generates practical plans but does not modify code.
* **P1 | Existing Project Modification**: For existing repositories — enter the “Analyze Problem” phase.
* **P2 | New Project Creation**: No existing code — scaffold from scratch and generate `PROJECTWIKI.md`.

---

## Development & Build

* Follow **Conventional Commits** and **Keep a Changelog**
* All documentation and code changes must be atomically committed
* Use Mermaid diagrams for architecture and dependency visualization

---

## Compatibility & Known Issues

* Currently validated only under GitHub project structures
* Future versions plan to support synchronization with private Wikis and external knowledge bases

---

## Version & Upgrade Notes

* Added Phase 1 **Intent Routing** and the **Minimal Write Principle**
* Maintains compatibility with the upstream `workflow3.md` template

---

## Contribution

* Contributions that improve documentation structure, Mermaid templates, or ADR models are welcome

---

## Security

* Never commit keys or production credentials
* Recommended pattern: use `.env.example` + CI-based variable injection

---

## License & Attribution (**Commercial use allowed, attribution required**)

To ensure “commercial use allowed + attribution required,” this project adopts a **dual license**:

1. **Code** — **Apache License 2.0** © 2025 hellowind

   * Commercial use permitted. You must retain **LICENSE** and **NOTICE** files (copyright and license info).
   * Example `NOTICE` for your distribution:

     ```
     This product includes "HelloAGENTS" (author: hellowind), licensed under Apache License 2.0.
     ```

2. **Documentation (README / PROJECTWIKI / Diagrams)** — **CC BY 4.0** © 2025 hellowind

   * Commercial use allowed **with attribution**; you must provide a license link and indicate modifications.
   * Suggested attribution example:

     ```
     Text/diagrams adapted from "HelloAGENTS" — © 2025 hellowind, CC BY 4.0.
     ```

**Unified attribution suggestion (for both code and documentation):**

```
HelloAGENTS — © 2025 hellowind. Code: Apache-2.0; Docs: CC BY 4.0.
```

---

## Acknowledgments / Upstream Template

* Upstream: **workflow3.md** (<a href="./README_EN.md" target="_blank">geekoe/workflow3</a>)
* Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki documentation and community
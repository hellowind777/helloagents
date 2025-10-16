<!-- README_EN.md -->
# HelloAGENTS

<p align="center"><a href="./README.md">简体中文</a>    ENGLISH</p>

**`HelloAGENTS` is a “lightweight Router + multi-stage (P1–P4) + Wiki-driven” rule set for AI programming agents.**
`PROJECTWIKI.md` acts as the single source of truth (SSoT). With **intent routing (Direct Answer / P1 / P2 / P3; P4 on demand)**, a **P3 execution gate** (minimal write + atomic traceability), **Mermaid-first** diagrams, and **Conventional Commits + Keep a Changelog**, it keeps code, docs, and knowledge base continuously consistent and auditable.

For real-world projects, it ships **standard templates for PROJECTWIKI / CHANGELOG** and quality SLOs on Freshness, Traceability, Completeness, and Consistency—maintained incrementally.

## Features
- **Router mechanism**: Direct Answer / P1 (Analyze) / P2 (Plan) / P3 (Execute); **P4 (Error Handling)** on demand
- **Docs as first-class**: `PROJECTWIKI.md` as SSoT with strong code–doc consistency
- **P3 execution gate**: low-risk check + solution completeness (API/Data/Rollback/Tests/Release/Docs) + explicit approval
- **Minimal write & atomic traceability**: code and docs in the same atomic commit, cross-linked with `CHANGELOG.md`
- **Mermaid-first**: architecture/process/dependency/ER/class diagrams
- **Governance built-in**: ADRs, Conventional Commits, Keep a Changelog, incremental updates
- **Security & compliance**: unified secret management; no prod access or plaintext secrets
- **Templates & checks**: `PROJECTWIKI.md` / `CHANGELOG.md` templates and validation checklist

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

## Installation & Usage
1. Copy `AGENTS.md` into your home directory under `.codex`.
2. Restart the terminal — the CLI will automatically load the rule set.

## Usage
- **C0 | Pure Consultation (No-Code)**: guidance only, no file ops
- **P0 | Planning (No-Exec)**: deliver plans without executing changes
- **P1 | Existing Project Update**: analyze repo & impact surface
- **P2 | New Project**: scaffold + initialize `PROJECTWIKI.md`
- **P4 | Error Handling (on demand)**: MRE → fix → retrospective & doc sync

## Development
- Follow **Conventional Commits** and **Keep a Changelog**
- **Atomic commits** for code–doc updates; reference `PROJECTWIKI.md` and `CHANGELOG.md`
- **Mermaid** for all diagrams; use **UTF-8** encoding

## Compatibility & Known Issues
- Verified with GitHub-style repositories
- Future support for private Wikis and external knowledge sources

## Version & Upgrade
2025-10-16 Update:
* Aligned with the new **Router → Phases** rules and display (Direct Answer / P1–P3, P4 on demand)
* Added **P3 execution gate** (low-risk check + solution completeness + explicit approval) and **minimal write/atomic traceability**
* Added standard templates for `PROJECTWIKI.md` and `CHANGELOG.md` with validation checklist

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

## Contributing
- Contributions improving structure, Mermaid templates, or ADR models are welcome
- Follow project conventions and update changelogs when submitting PRs

## Security
- Do not commit keys or production credentials
- Use `.env.example` + CI variable injection

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

## Third-Party Notices (optional)

(none)

## Acknowledgments / Upstream (optional)
- Upstream: **workflow3.md** ([geekoe/workflow3](https://github.com/geekoe/workflow3))
- Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki community

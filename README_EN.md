<!-- README_EN.md -->
# HelloAGENTS

<p align="center"><a href="./README.md">简体中文</a>    ENGLISH</p>

**`HelloAGENTS` is a “lightweight Router + multi-stage (P1–P4) + wiki-driven” rule set for AI programming agents.**
`PROJECTWIKI.md` is the single source of truth (SSoT). With **Direct Answer first**, a **P3 execution gate** (minimal write + atomic traceability), **Mermaid-first** diagrams, and **Conventional Commits + Keep a Changelog**, it keeps code, docs, and knowledge base consistent and auditable. This update adds **RISK-GATE@P2** and **G8 file/directory conventions** (no assumed structure; ADR consolidated into root `adr.md`).

## Features
- **Router**: Direct Answer / P1 (Analyze) / P2 (Plan) / P3 (Execute); **P4 (Error Handling)** on demand, with stage lock & switch hints
- **Docs as first-class**: `PROJECTWIKI.md` as SSoT with strong code–doc consistency
- **P3 execution gate**: low-risk check + solution completeness (API/Data/Rollback/Tests/Release/Docs) + explicit approval + atomic traceability
- **RISK-GATE@P2**: preflight for high-risk changes (dry-run, rollback, compatibility, observability, approval, security)
- **Mermaid-first**: architecture/process/dependency/ER/class diagrams
- **Governance**: ADR (**single file `adr.md` at repo root**), Conventional Commits, Keep a Changelog, incremental updates
- **Security & compliance**: no prod connections; no plaintext secrets
- **G8 conventions**: do not assume/create standard dirs; operate on existing paths
- **Templates & checks**: standard `PROJECTWIKI.md` / `CHANGELOG.md` with validation checklist

## Project Layout
```
%USERPROFILE%/.codex/AGENTS.md  # Global rules (for model access)
your-project/
├─ PROJECTWIKI.md               # Project Wiki (code–doc consistency)
├─ adr.md                       # Architecture Decision Records (ADR)
├─ CHANGELOG.md                 # Follows Keep a Changelog
├─ docs/                        # Other docs
└─ src/                         # Source code
```

## Installation & Usage
1. Copy `AGENTS.md` into your home directory under `.codex`.
2. Restart the terminal — the CLI will automatically load the rule set.

## Usage
- **C0 | Pure Consultation (No-Code)**: guidance only, no file ops
- **P0 | Planning (No-Exec)**: deliver an executable plan without execution
- **P1 | Existing Project Update**: analyze repo & impact surface
- **P2 | Planning**: produce an executable plan, pass **RISK-GATE@P2** if high risk
- **P3 | Execution**: meet the execution gate; atomic commit for code+docs
- **P4 | Error Handling (on demand)**: MRE → fix → retrospective & doc sync

## Development
- Follow **Conventional Commits** and **Keep a Changelog**
- **Atomic commits** for code–doc updates; reference `PROJECTWIKI.md` and `CHANGELOG.md`
- Use **Mermaid** for all diagrams; files in **UTF-8**
- **ADR is stored as a single root file `adr.md` (MADR template)**

## Compatibility & Known Issues
- Verified with GitHub-style repositories
- Planned support for private Wikis and external knowledge sources
- Projects using an `adr/` folder should see Version & Upgrade for migration tips

## Version & Upgrade
2025-10-28 Update:
* Align with **AGENTS_VERSION 2025-10-12.7**: Direct Answer-first routing and stage display; stage lock clarified
* Add **G8 conventions** and **single-file ADR `adr.md`** (migration: merge entries from `adr/` into root `adr.md`, keep link map)
* Strengthen **RISK-GATE@P2** checklist across dry-run/rollback/compatibility/observability/approval/security

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

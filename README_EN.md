<!-- README_EN.md -->
# HelloAGENTS

<p align="center"><a href="./README.md">简体中文</a>    ENGLISH</p>

**`HelloAGENTS` is a “lightweight Router + multi-stage (P1–P4) + wiki-driven” ruleset for AI programming agents.**
`PROJECTWIKI.md` is the single source of truth (SSoT). With **Direct Answer first**, a **P3 execution gate** (minimal write + atomic traceability), **Mermaid-first** diagrams, and **Conventional Commits + Keep a Changelog**, it keeps code, docs, and knowledge base consistent and auditable. Added **RISK-GATE@P2** and **G8 file/directory conventions** (no assumed structure; ADR consolidated into root `adr.md`).

## Features
- **Router**: Direct Answer / P1 (Analyze) / P2 (Plan) / P3 (Execute); **P4 (Error Handling)** on demand
- **Docs as first-class**: `PROJECTWIKI.md` as SSoT with strong code–doc consistency
- **P3 execution gate**: low-risk check + solution completeness (API/Data/Rollback/Tests/Release/Docs) + explicit approval + atomic traceability
- **RISK-GATE@P2**: preflight for high-risk changes (dry-run, rollback, compatibility, observability, approval, security)
- **Mermaid-first** for all diagrams; **UTF-8** files
- **Governance**: ADR (**single file `adr.md` at repo root**), Conventional Commits, Keep a Changelog
- **Security & compliance**: no prod connections; no plaintext secrets
- **G8**: do not assume or auto-create standard dirs; work with existing paths

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
- **Direct Answer (first)**: if the request can be answered directly, **do not** enter any stage.
- **P1 | Analyze**: inspect repo/context for impact surface and uncertainties; analysis only.
- **P2 | Plan**: produce an executable plan; for high-risk changes you **must pass RISK-GATE@P2** (dry-run/rollback/compatibility/observability/approval/security).
- **P3 | Execute**: proceed only after the **execution gate** (low-risk check + plan completeness + explicit approval). Use **atomic commits** for code + docs with backlinks to `PROJECTWIKI.md` and `CHANGELOG.md`.
- **P4 | Error Handling (on demand)**: MRE → fix → retrospective & documentation sync.
- **Encoding & style**: **UTF-8** for text; **Mermaid** for diagrams; **Conventional Commits** for messages.

## Development
- Follow **Conventional Commits** and **Keep a Changelog**; use **atomic commits** for code–doc updates
- Any P3/P4 change must update `PROJECTWIKI.md` and `CHANGELOG.md`
- All diagrams use **Mermaid**; files use **UTF-8**
- **ADR**: single **root `adr.md`** as the canonical registry (MADR)

## Compatibility & Known Issues
- Verified with GitHub-style repositories
- Planned support for private Wikis and external KB sync
- Projects still using an `adr/` folder should see Version & Upgrade for migration tips

## Versioning & Upgrade
2025-10-29 Update:
* Align with **AGENTS_VERSION 2025-10-12.7**: Direct Answer-first routing and stage-lock guidance
* Add **RISK-GATE@P2** and **G8 conventions**; clarify **ADR** as a single root `adr.md`
* Strengthen **P3 execution gate** (low-risk check + plan completeness + explicit approval + atomic traceability)

2025-10-16 Update:
* Improved Router→Phases display/constraints; P3 gate with minimal write/atomic traceability
* Added templates/checklists for `PROJECTWIKI.md` and `CHANGELOG.md`

2025-10-14 Update:
* Synced governance model; refined PROJECTWIKI lifecycle & incremental updates

2025-10-13 Update:
* Added intent-based smart routing; enhanced error handling & retrospectives

2025-10-12 Update:
* Unified naming & commit conventions; workflow3 compatibility

…older updates omitted…

## Contributing
- Contributions to structure, Mermaid templates, or ADR model are welcome
- Please follow project conventions and update changelogs in PRs

## Security
- Do not commit secrets or production credentials
- Prefer `.env.example` + CI variable injection

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
- Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki

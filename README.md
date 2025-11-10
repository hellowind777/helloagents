<!-- README.md -->
# HelloAGENTS

<p align="center"><a href="./README_CN.md">简体中文</a>    ENGLISH</p>

> **⚠️ Important:** Before using, set the language in `AGENTS.md` file header (`bootstrap: lang=en-US`) and configure **"Response Language"** in Global Rules to "English" to ensure the agent outputs in the expected language.

**`HelloAGENTS` is a "lightweight Router + multi-stage (P1–P4) + wiki-driven" ruleset for AI programming agents.**
`HELLOWIKI.md` is the single source of truth (SSoT). With **Direct Answer first**, **FA (Full Authorization) mode**, **silent execution spec**, **Feedback-Delta incremental feedback**, **EHRB (Extreme High-Risk Behavior) identification**, a **P3 execution gate** (minimal write + atomic traceability), **Mermaid-first** diagrams, and **Conventional Commits + Keep a Changelog**, it keeps code, docs, and knowledge base consistent and auditable. Added **G8 large project strategy**, **TASK.md checklist mechanism**, and **history/ archive directory**.

## Features
- **Router**: Direct Answer / P1 (Analyze) / P2 (Plan) / P3 (Execute); **P4 (Error Handling)** on demand
- **FA (Full Authorization) mode**: Trigger via `~auto` / `~helloauto` / `~fa`, auto-execute across phases (P1→P2→P3)
- **Silent execution spec**: Output only file paths and operation types, no file contents, diffs, code snippets, or tool results
- **Feedback-Delta mechanism**: Based on semantic understanding rather than keyword matching, recognize incremental feedback and iterate in current phase, avoiding unnecessary phase switches
- **EHRB identification**: Auto-detect production operations, PII data processing, destructive operations, irreversible operations
- **Docs as first-class**: `HELLOWIKI.md` as SSoT with strong code–doc consistency; added `TASK.md` checklist and `history/` archive
- **P3 execution gate**: low-risk check + solution completeness (API/Data/Rollback/Tests/Release/Docs) + explicit approval + atomic traceability
- **G5 consistency audit**: Code is the sole source of execution truth; default correction direction is to align knowledge base with code
- **G7 product design principles**: For new projects/features, conduct in-depth requirements analysis from product manager perspective, focusing on user research, feasibility assessment, humanistic care design
- **G8 security & compliance**: EHRB identification and auto-mitigation; no prod connections; no plaintext secrets
- **G9 large project strategy**: Progressive knowledge base initialization, task decomposition (50-100 lines per task), tiered testing strategy
- **Mermaid-first** for all diagrams; **UTF-8** files
- **Governance**: ADR (**single file `ADR.md` at repo root**), Conventional Commits, Keep a Changelog

## Project Layout
```
%USERPROFILE%/.codex/AGENTS.md  # Global rules (for model access)
your-project/
├─ helloagents/
│  ├─ HELLOWIKI.md              # Project Wiki (12 mandatory sections)
│  ├─ CHANGELOG.md              # Follows Keep a Changelog
│  ├─ ADR.md                    # Architecture Decision Records
│  ├─ TASK.md                   # Current task checklist (generated in P2, archived in P3)
│  └─ history/                  # Task checklist archive directory
│     └─ TASK_YYYYMMDD.md       # Archived task checklists by date
├─ docs/                        # Other docs
└─ src/                         # Source code
```

## Installation & Usage
1. Copy `AGENTS.md` into your home directory under `.codex`.
2. **Important:** Set `bootstrap: lang=en-US` in the `AGENTS.md` file header and configure **"Response Language"** to "English" in Global Rules.
3. Restart the terminal — the CLI will automatically load the rule set.

## Usage
- **Direct Answer (first)**: if the request can be answered directly, **do not** enter any stage.
- **FA (Full Authorization) mode**: Input `~auto` / `~helloauto` / `~fa` to trigger confirmation flow; once activated, auto-execute P1→P2→P3 without per-phase confirmation.
- **P1 | Analyze**: inspect repo/context for impact surface and uncertainties; analysis only; execute knowledge base quality check (read-only, mark issues).
- **P2 | Plan**: produce an executable plan; generate `TASK.md` checklist; for EHRB high-risk changes, FA mode attempts auto-mitigation, non-FA mode lists risk points.
- **P3 | Execute**: proceed only after the **execution gate** (low-risk check + plan completeness + explicit approval); strictly execute per `TASK.md` item by item; use **atomic commits** for code + docs with backlinks to `HELLOWIKI.md` and `CHANGELOG.md`; archive checklist to `history/TASK_YYYYMMDD.md` after completion.
- **P4 | Error Handling (on demand)**: MRE → fix → retrospective & documentation sync; prioritize suspecting code implementation errors; **dual-layer protection mechanism**: ①For same error consecutive failures ≥2 times warn, ≥3 times mandatory halt; ②For P4 loop (≥4 times or consecutive different errors) proactively ask whether to return to P1/P2 for re-evaluation.
- **Feedback-Delta**: Based on semantic understanding, recognize incremental feedback (directional semantics + incremental modification intent + time continuity + non-cross-phase instructions), iterate in current phase instead of re-routing.
- **Encoding & style**: **UTF-8** for text; **Mermaid** for diagrams; **Conventional Commits** for messages.

## Development
- Follow **Conventional Commits** and **Keep a Changelog**; use **atomic commits** for code–doc updates
- Any P3/P4 change must update `HELLOWIKI.md` and `CHANGELOG.md`
- All diagrams use **Mermaid**; files use **UTF-8**
- **ADR**: single **root `ADR.md`** as the canonical registry (MADR)
- **Task checklist**: P2 generates `TASK.md`, P3 archives to `history/TASK_YYYYMMDD.md` after completion

## Compatibility & Known Issues
- Verified with GitHub-style repositories
- Planned support for private Wikis and external KB sync
- Projects still using `PROJECTWIKI.md` should see Version & Upgrade for migration tips (rename to `HELLOWIKI.md` and adjust references)

## Versioning & Upgrade
2025-11-10.10 Update:
* **Section numbering standardization**: Corrected global rules section numbering (G7 Product Design Principles, G8 Security & Compliance, G9 Large Project Strategy)
* **Added G7 Product Design Principles**: For new projects/features, conduct in-depth requirements analysis from product manager perspective, including user research, feasibility assessment, experience design, inclusive design, ethical considerations
* **Feedback-Delta rule optimization**: Emphasize semantic understanding over keyword matching, using four-dimensional determination criteria (directional semantics, incremental modification intent, time continuity, non-cross-phase instructions)
* **P4 error determination criteria refinement**: Use semantic root cause determination rather than relying solely on literal error message matching
* **P1/P2 phase enhancement**: Added product perspective analysis and product solution design steps (executed when G7 triggered)
* **Knowledge base template improvement**: HELLOWIKI.md added product design section, including core value proposition, user personas, user journey map, humanistic care design, success metrics

2025-11-10.09 Update:
* P4 iteration protection mechanism comprehensive upgrade with dual-layer protection
* Knowledge base management strategy refinement
* Feedback-Delta trigger conditions supplemented

2025-11-10.08 Update:
* **P4 iteration protection rule optimization**: Removed misleading "rebuild knowledge base" phrasing, clarified three specific response strategies:
  1. Comprehensive codebase rescan (may have missed critical modules/configurations/dependencies)
  2. Return to P1 for reanalysis (root cause hypothesis may be incorrect)
  3. Return to P2 for solution redesign (remediation strategy may be fundamentally flawed)
* P4 executed consecutively ≥3 times now triggers mandatory halt requiring user intervention, must explain attempted approaches, potential root causes, and recommended next steps

2025-11-10.01 Update:
* Align with **AGENTS_VERSION 2025-11-10.01**: Knowledge base file system refactoring (PROJECTWIKI.md → HELLOWIKI.md; added history/ directory and TASK.md mechanism)
* Introduce **FA (Full Authorization) mode** and **silent execution spec** (output only paths and operation types)
* Add **Feedback-Delta incremental feedback mechanism** and **EHRB (Extreme High-Risk Behavior) identification** (production/PII/destructive/irreversible operations)
* Strengthen **G5 consistency audit**: Code is the sole source of execution truth; default correction direction is to align knowledge base with code
* Add **G8 large project strategy**: Progressive knowledge base initialization, task decomposition (50-100 lines per task), tiered testing strategy
* Comprehensive routing mechanism upgrade: Phase state lock, post-P3/P4 joint determination, first conversation determination, FA trigger command detection priority
* Add **P4 iteration protection**: Warn if unresolved ≥2 consecutive times, force prompt if ≥3 times

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
- Auto-detect EHRB (Extreme High-Risk Behavior) and attempt mitigation or pause

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

## Third-Party Notices

(none)

## Acknowledgments / Upstream
- Upstream: **workflow3.md** ([geekoe/workflow3](https://github.com/geekoe/workflow3))
- Ecosystem: Mermaid, Conventional Commits, Keep a Changelog, GitHub Wiki

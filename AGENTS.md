# FAB ONE — Agent Collaboration Contract

**Official repository:** `Junebooky/semi_fab`
**Product owner:** Human project owner
**Agents:** A01 Product/Domain Lead · A02 Development · A03 Design · A04 QA · A05 Portfolio

## Authority and source of truth
1. Explicitly approved project-owner decisions
2. Approved PRD and architecture decision records (ADR)
3. Assigned Issue acceptance criteria
4. Versioned API/data/design contracts
5. Existing implementation conventions

When sources conflict, report the conflict; do not silently invent semiconductor rules or broaden scope.

## Work process
1. Read `AGENTS.md`, the assigned Issue, relevant PRD/ADR and dependency Issues.
2. Confirm deliverables and acceptance criteria before implementation.
3. Use a separate issue-specific branch; **never commit directly to `main`**.
4. Commit code/docs/test evidence, create a PR and link the Issue.
5. A04 independently validates functionality, equations, assumptions, reproducibility and permissions when relevant.
6. A01 checks product/domain consistency; human owner authorizes merge.
7. Report actual progress and blockers in the Issue/PR.
8. Do not label a submitted PR DONE until authorized merging and Issue closure.

## Required chat handoff (last line)
`[FAB-ONE][A0N][REVIEW|DONE|BLOCKED|FAILED] repo=Junebooky/semi_fab issue=#N pr=#N | SUMMARY | CHECK | blocker=NONE`

Substitute verified identifiers. When a PR or test does not exist, use `pr=none` or `CHECK=NOT_RUN`. Chat handoff is not proof of GitHub submission.

## Domain and security constraints
- Current milestone is a *synthetic Etch FAB simulation* and educational analysis platform; do not claim real production deployment.
- Keep synthetic, research/public, and live operational data distinct.
- Display measurement units, sampling timestamps, data provenance, assumptions and applicable standard versions.
- SPC control limits are not identical to product specification limits.
- Statistical correlation and wafer map patterns do not prove causation.
- No actual equipment control or unsupervised production Hold/Release.
- No secret API keys, database passwords, access tokens or confidential FAB data in public GitHub.
- Use Toss sites as UX research; no copying proprietary logos, artwork or illustrations.

## Architecture decision pending
MVP Local-first / Supabase selection is under review in Issue #1:
https://github.com/Junebooky/semi_fab/issues/1
No unapproved Supabase schema changes.

## Ownership
- `docs/product/`, `docs/domain/`, `docs/architecture/`: A01 leads
- `apps/web/`, `services/api/`, `services/simulator/`: A02 leads
- `docs/design/`: A03 leads
- `docs/qa/`: A04 leads
- `docs/portfolio/`: A05 leads

All changes are reviewable by A01, and critical changes by A04 as well.

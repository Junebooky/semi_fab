# ADR-001: FAB ONE MVP data persistence (Local-first proposal)

- **Status:** PROPOSED — not yet approved by the project owner
- **Date:** 2026-10-15
- **Owner:** A01 Product/Domain Lead
- **Reviewers:** A02 Development, A04 QA, A03 Design (knowledge UX)
- **Issue:** [#1](https://github.com/Junebooky/semi_fab/issues/1)

## Context
FAB ONE is initially a portfolio-grade *simulation* of semiconductor Etch equipment, process metrology, wafer/lot traceability, SPC/FDC alerts, investigative case workflows, and an Engineering Knowledge Layer (EKL). The MVP **does not** ingest real-time data from a production FAB and should not claim real multi-user workflow functionality without implementation and verification.

A database choice should follow each dataset's lifetime, editability, sync and access-control needs; whether values are "text" or "numbers" is not a sufficient criterion.

## Proposed decision

| Dataset | Initial storage | Reason |
|---|---|---|
| Engineering knowledge definitions, formula descriptions, application caveats, references | Versioned MDX/Markdown + JSON metadata | Reviewed changes, history in Git, searchable static content |
| Executable calculations (e.g., Cpk, Die Yield, Etch Rate) | Tested Python/TypeScript functions | Keep formulas executable, testable and separate from explanatory prose |
| Synthetic scenario definitions & deterministic seed | JSON/YAML in Git | Replay and auditability |
| Synthetic sensor/metrology streams | CSV / Parquet fixtures and deterministic generator | Efficient analysis without long-running cloud database |
| Equipment, chamber, process run, lot/wafer relationships, local cases | SQLite on persistent **local or single-server** storage | Integrity constraints, indexes and SQL queries |
| Optional per-browser notes/preferences | IndexedDB + export/import | Local and offline use; no cross-device sync guarantee |
| Genuine shared user cases, identity, RBAC, audit, multi-device data | PostgreSQL/Supabase **in later phase** | Central authorization, durability and concurrency |

**Mode A:** publicly hosted read-only/static showcase + browser simulation. No server database required.

**Mode B:** locally launched Next.js + FastAPI + SQLite, persistent volume, repeatable simulator. No Supabase required.

**Mode C:** actual concurrent users and shared incident workflows, e.g. Supabase Auth/PostgreSQL with RLS; this is a separate scope requiring reviews.

## Design consequences and caveats
- Do not store the SQLite *write* database on stateless/ephemeral Function storage. A publicly hosted UI can talk to an independently persistent backend or remain a static Mode A demo.
- IndexedDB is per-browser and can be cleared or evicted. It is not a backup or central audit trail.
- Numeric data *can* live in files, but relationships and transactional updates benefit from a relational database.
- A "role switcher" simulator is not equivalent to real authentication and separated duties.
- EKL text includes formula identifiers, units, assumptions, caveats, source URLs and reviewed version; executable calculation code has matching tests and fixtures.
- Outlier alerts suggest potential causality only, not proof of physical root cause.
- Keep any future Supabase schema in migrations; do not apply unreviewed DDL to an unrelated cloud project.
- Avoid embedding secrets/real enterprise production data in the public repository.

## Alternatives considered
1. **Supabase from day one:** good for live shared state, but premature overhead for synthetic standalone demos and static learning content.
2. **Only JSON files:** sufficient for static mode but insufficient for robust relational cases and transactional event tracking.
3. **Local-first hybrid (proposed):** low operating cost and reproducibility; later server DB migration requires designed contracts.

## Migration triggers
Consider PostgreSQL/Supabase when at least one becomes a committed acceptance criterion:
- Two+ independently authenticated users edit the same investigation with persistent synchronization.
- User data must synchronize across devices.
- Authorization, approval separation and immutable centralized audit trail are necessary.
- Users upload shared datasets or the app runs across multiple server instances.

## Acceptance before status becomes ACCEPTED
- [ ] A02 validates storage contract, deployment constraints, migration effort.
- [ ] A03 validates data provenance, hover/focus/tap knowledge UX needs.
- [ ] A04 validates reproducibility, data loss, authorization and numerical test strategy.
- [ ] A01 updates the PRD (v1.3) after owner approval.
- [ ] Owner approves architecture change.

## References
- [SQLite: Appropriate Uses for SQLite](https://sqlite.org/whentouse.html)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [GitHub Issue #1](https://github.com/Junebooky/semi_fab/issues/1)

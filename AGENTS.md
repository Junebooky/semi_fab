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

## Required work report — strict 3-line Korean handoff (v1.0)

**This overrides all older agent prompt formats** such as `[FAB-ONE][A0N]...`. Detailed technical findings, test logs and evidence belong in GitHub Issues, PRs, review comments, and repository files; the final chat handoff has **exactly three plain-text lines**, no Markdown code fence, table, labels of extra lines, or message after them:

```text
보고: A0N 역할 에이전트가 <실제로 수행한 작업 한 가지>를 <완료/제출/등록/요청>했습니다. [REVIEW|DONE|BLOCKED|FAILED]
위치: Junebooky/semi_fab → <Issues|Pull requests> → #N → <Conversation|Files changed> → <댓글 ID 또는 정확한 파일 경로>
링크: <위치의 GitHub 직접 URL>
```

**Rules**
1. State the actor explicitly in the sentence: `A02 개발 에이전트가...`, `A03 디자인 에이전트가...` etc. Use one short Korean declarative sentence without vague omitted subjects.
2. Include the actual *action* and object: created Issue, submitted PR, posted review comment, committed file, requested assignment. Say `검토 의견을 등록`, not `디자인 완료`, for a review-only task.
3. `위치` is an exact navigation path in **Junebooky/semi_fab**, including record type/number and specific Conversation comment ID or Files changed file path where applicable. When the artifact is an Issue, `Issues → #N → 본문` is sufficient.
4. `링크` must be an actually verified, direct GitHub URL for that primary artifact. For a PR comment use the `#issuecomment-ID` anchor; for a file use its verified blob link or PR file URL.
5. When work is blocked or *no* GitHub record was submitted, say `위치: GitHub 미등록` and `링크: 없음 (미등록)`. Never invent a number, URL, file path, GitHub upload or test.
6. Status: `REVIEW` submitted/awaiting review; `DONE` only after approved, merged where applicable and issue completed; `BLOCKED` cannot proceed; `FAILED` work/validation failed.
7. If several deliverables exist, summarize **one primary artifact** in the final three lines. Put all other links and evidence in the referenced GitHub issue/PR; discuss them in the preceding answer if necessary.
8. A01 also follows the same three lines for work reports. Normal exploratory questions do not require pretending to have performed a GitHub operation.

**Verified real examples (as of 2026-10-15)**

A03 review comment:
```text
보고: A03 디자인 에이전트가 PR #2에 EKL UX 검토 댓글을 등록했습니다. [REVIEW]
위치: Junebooky/semi_fab → Pull requests → #2 → Conversation → 댓글 #6183744614
링크: https://github.com/Junebooky/semi_fab/pull/2#issuecomment-6183744614
```

A04 test-plan PR (the plan is submitted; 20 executable tests remain NOT_RUN):
```text
보고: A04 테스트 에이전트가 PR #3에 독립 검증 계획서를 제출했습니다. [REVIEW]
위치: Junebooky/semi_fab → Pull requests → #3 → Files changed → docs/qa/ADR-001-storage-verification-plan.md
링크: https://github.com/Junebooky/semi_fab/pull/3/files
```

Assignment Issues already exist: A03 Issue #4 and A05 Issue #5. Neither assignment alone proves their deliverables are complete.

For details see `docs/product/agent-reporting-standard.md`.

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

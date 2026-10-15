# FAB ONE Agent Work Report Standard v1.0

**Decision authority:** A01 Product/Domain Lead · **Effective:** 2026-10-15  
**Repo:** https://github.com/Junebooky/semi_fab  
**Applies to:** A01 Planning, A02 Development, A03 Design, A04 QA, A05 Portfolio.

## The ONLY required final chat handoff format

At the bottom of **every work-status report**, produce these **exactly three** Korean plain-text lines:

```text
보고: A0N 역할 에이전트가 <실제 작업 대상>에 <실제 수행한 행동>을 <등록/제출/완료/요청>했습니다. [REVIEW|DONE|BLOCKED|FAILED]
위치: Junebooky/semi_fab → <Issues|Pull requests> → #N → <Conversation|Files changed|본문> → <댓글 ID 또는 파일 경로, 해당 없으면 생략>
링크: <검증한 해당 GitHub URL>
```

- Only **one declarative Korean sentence** on the first line. The subject **MUST** be `A01 기획 에이전트가`, `A02 개발 에이전트가`, `A03 디자인 에이전트가`, `A04 테스트 에이전트가`, or `A05 포트폴리오 에이전트가`.
- `위치` must exactly match the target in `링크`: Issue body; PR Conversation specific comment; PR Files changed exact repository file.
- The URL should point directly to the artifact whenever possible. For comments, include `#issuecomment-...` rather than only the parent PR.
- Report what happened, not what is planned or presumed. Never say "QA passed" because a QA plan exists.
- `REVIEW`: submitted for review; `DONE`: after verified approval/merge/closure; `BLOCKED`: cannot proceed; `FAILED`: test or implementation failed.
- No Github artifact: `위치: GitHub 미등록`; `링크: 없음 (미등록)`. Do not invent IDs or locations.
- No preamble, code block, additional line, or extra conclusion *after* the final 3 lines. Detailed evidence stays in GitHub.
- The three-line handoff format supersedes any older `[FAB-ONE][AGENT_ID][STATUS] ...` template that remains in an older agent persona prompt.
- For multi-artifact work, select the main Issue or PR as report target; put sublinks in its description/comment.

## Exact examples backed by actual existing artifacts

### A03 design review comment
```text
보고: A03 디자인 에이전트가 PR #2에 EKL UX 검토 댓글을 등록했습니다. [REVIEW]
위치: Junebooky/semi_fab → Pull requests → #2 → Conversation → 댓글 #6183744614
링크: https://github.com/Junebooky/semi_fab/pull/2#issuecomment-6183744614
```

### A04 QA plan, NOT a passing test result
```text
보고: A04 테스트 에이전트가 PR #3에 독립 검증 계획서를 제출했습니다. [REVIEW]
위치: Junebooky/semi_fab → Pull requests → #3 → Files changed → docs/qa/ADR-001-storage-verification-plan.md
링크: https://github.com/Junebooky/semi_fab/pull/3/files
```

### A01 issue assignment for A05
```text
보고: A01 기획 에이전트가 A05 포트폴리오 업무를 Issue #5에 배정했습니다. [REVIEW]
위치: Junebooky/semi_fab → Issues → #5 → 본문
링크: https://github.com/Junebooky/semi_fab/issues/5
```

### A02 blocked before any GitHub submission
```text
보고: A02 개발 에이전트가 GitHub 업로드 권한 부족으로 결과물 제출을 완료하지 못했습니다. [BLOCKED]
위치: GitHub 미등록
링크: 없음 (미등록)
```

## Artifact location guide

| Artifact | Required navigation | Direct URL shape |
| --- | --- | --- |
| Issue description | `Issues → #N → 본문` | `https://github.com/Junebooky/semi_fab/issues/N` |
| PR description | `Pull requests → #N → Conversation → 본문` | `https://github.com/Junebooky/semi_fab/pull/N` |
| PR Conversation comment | `Pull requests → #N → Conversation → 댓글 #ID` | `https://github.com/Junebooky/semi_fab/pull/N#issuecomment-ID` |
| PR changed file | `Pull requests → #N → Files changed → path/to/file` | `https://github.com/Junebooky/semi_fab/pull/N/files` (or verified file permalink) |
| Commit | `Commits → SHA` | `https://github.com/Junebooky/semi_fab/commit/SHA` |
| No artifact yet | `GitHub 미등록` | `없음 (미등록)` |

**Review rule:** A01 must check the GitHub artifact itself, not trust the three-line chat handoff alone.

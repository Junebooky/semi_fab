# FAB ONE — A01-controlled agent handoff v1.0

- Date: 2026-10-15
- Owner: A01, final approval: human project owner
- Repository: https://github.com/Junebooky/semi_fab
- Status: review document on PR #2; operational guidance immediately applies to active tasks, not yet merged.

## Core rule
Every agent submits its artifact to **A01 first**. No agent sends completed work directly to another role and assumes work begins. A01 checks the evidence, exact PR head SHA and acceptance criteria and deliberately authorizes the next stage.
Agent chats do not automatically see each other's prompts or GitHub updates. The human owner forwards A01's handoff instructions to the next agent. Shared GitHub records are source of truth, not automatic messenger.

## Responsibility and first recipient
| Agent | When assigned | Recipient on submission | Next stage |
| --- | --- | --- | --- |
| A02 Development | A01 Issue | **A01** | After A01 correction check, A04 QA |
| A03 Design | A01 Issue and owner style directions | **A01** | After A01 prototype check, A04 visual QA |
| A04 Independent QA | **A01 explicit QA_READY gate only** | **A01** | A01 decides fixes or owner approval |
| A05 Portfolio/marketing | A01 Issue, verified product state | **A01** | A01 wording review; public claims after independent evidence |
| A01 Product/domain | Owner request/PR evidence | **Human owner** for architecture, merges and final acceptance | A01 dispatches follow-up agent |

## Required state transitions
1. ASSIGNED: Issue exists; no implementation assumed.
2. WORKING: agent edits only its own branch or PR.
3. REVIEW: PR and final three-line report submitted **to A01**. This does not prove QA, approval, or merge.
4. CHANGES_REQUESTED: A01 posts actual defects; original author revises, posts **new head SHA and changes** to PR, requests A01 re-review.
5. QA_READY: **ONLY A01** posts a gate comment with target PR, exact full head SHA, prerequisites checked and scope. Open/mergeable PR, a completed draft, or another agent's review is NOT QA_READY.
6. QA_IN_PROGRESS: A04 confirms the latest PR SHA equals the QA_READY SHA. If the head changes, current result is stale, and A01 must renew the gate.
7. QA_RESULT: A04 submits exact SHA, test/evidence/environment, PASS/FAIL/BLOCKED/NOT_RUN per case **to A01**. Document review is not executable runtime QA.
8. OWNER_APPROVAL_PENDING: A01 assesses product/domain and QA, sends human owner exact links and decision proposal.
9. DONE: only after authorized merge and issue closure for merge-requiring work. Failed tests or new changes return to authors.

Internal gate terms do not change the approved final chat bracket statuses: REVIEW / DONE / BLOCKED / FAILED.

## Current dependency plan — October 15, 2026
**Parallel work now**
- A02: Issue #8, PR #10 fixes. Review instructions: https://github.com/Junebooky/semi_fab/pull/10#issuecomment-6184247949 . Submits updates and new HEAD SHA to **A01**.
- A03: Issues #4/#9, PRs #7/#11 design fixes. Review: https://github.com/Junebooky/semi_fab/pull/11#issuecomment-6184254594 . Sync #FFFFFF and emerald replacement asset slots with PR #7. Submits revised HEAD SHA(s) to **A01**.
- A05: Issue #5, PR #6 evidence/link fixes. Review: https://github.com/Junebooky/semi_fab/pull/6#issuecomment-6184258618 . Submits to **A01**. Do not call planned/demo-only features tested or implemented.

**Must wait for dependency**
- A04: Issue #12 https://github.com/Junebooky/semi_fab/issues/12 . Can review test requirements without running final acceptance. **Do not begin final QA** until A01 explicitly says QA_READY for the target PR and SHA. A01 may release PR #10 document QA and PR #11 browser prototype QA separately; A04 need not wait for both when just one is ready.
- A01 architecture PR #2 is draft; formal ADR approval, main merge and product PRD changes require technical review and project owner decision. A05 README claims can be upgraded only after A02 code exists and A04 validates the claimed functionality.

## A01 QA_READY gate comment template (publish in target PR and/or Issue #12)

    [A01][QA_READY]
    Recipient: A04
    Target: PR #N @ <verified full head SHA>
    Prerequisites: A01 verified exact corrections and testable artifact
    Scope: DOC_REVIEW or browser prototype test (runtime checks NOT_RUN where no code exists)
    Deliver: A04 report in Issue #12 or designated PR with SHA, environment, case-by-case PASS/FAIL/BLOCKED/NOT_RUN, return to A01

## Mandatory exactly three final handoff lines
Put the **recipient in the first line**, NOT a fourth line:

    보고: A02 개발 에이전트가 PR #10에 수정안을 제출하고 A01 기획 에이전트에게 재검토를 요청했습니다. [REVIEW]
    위치: Junebooky/semi_fab → Pull requests → #10 → Conversation → 댓글 #실제ID
    링크: 실제 확인한 GitHub 댓글 URL

    보고: A04 테스트 에이전트가 Issue #12에 지정 커밋의 QA 결과를 등록하고 A01 기획 에이전트에게 판정을 요청했습니다. [REVIEW]
    위치: Junebooky/semi_fab → Issues → #12 → Conversation → 댓글 #실제ID
    링크: 실제 확인한 GitHub 댓글 URL

Never invent an ID, URL, completed action or automatic inter-agent handoff. If nothing exists, say GitHub 미등록 / 링크 없음 (미등록). Final 3 lines are the last lines of the agent response.

## Owner relay instructions
Send A02, A03 and A05 their current A01 PR review URL now; they may revise simultaneously. **Tell A04 to WAIT** (or prepare only a checklist) until A01 issues a PR-specific QA_READY link and SHA. The owner copies submitted three lines to A01; A01 actually inspects Github and sends the next recipient-specific task.
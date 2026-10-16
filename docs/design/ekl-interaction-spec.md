# Engineering Knowledge Layer (EKL) — Interaction Specification v0.1

- **Status:** REVIEW / A03 design proposal, not deployed, not tested. [Issue #4](https://github.com/Junebooky/semi_fab/issues/4); 2026-10-15.
- **Context:** Contextual engineering education inside the *synthetic* Etch investigation. Domain accuracy and scientific methodology are independently owned by A01; functions/tests by A02/A04.
- **Dependency:** Storage proposal [ADR-001 / PR #2](https://github.com/Junebooky/semi_fab/pull/2) is **not yet approved**; IndexedDB note UX is a conditional proposal.
- **Principle:** The base engineering task is always usable without opening EKL. Never automatically open a knowledge layer due to streaming alert updates.

## 1. Three-level user mental model

| Level | User question | Information / entry | Container / focus | Exit |
| --- | --- | --- | --- | --- |
| **L1 — Quick Explanation** | '이 용어가 무엇이지?' | 1–2 concise sentences, unit if relevant; pointer hover or keyboard focus | **Non-interactive** tooltip tied to a `button`; no required links/actions inside | pointer exit with tolerance, blur, Esc; focus stays on trigger |
| **L2 — Engineering Insight** | '이 그래프/계산에서 어떻게 쓰이지?' | definition, approved formula ID, variable table, units, real-current **synthetic sample** example, assumptions/caveats, `L3 자세히` action | Desktop: anchored **nonmodal dialog/card**; Phone: modal bottom sheet. Click/Enter/Space/tap on trigger | Esc, close button; outside click only for desktop if no unsaved state; restore focus to trigger |
| **L3 — Deep Dive** | '전제·근거·다른 개념까지 확인하고 싶다' | full reviewed MDX, equation definitions, references and review version, concept links, browser-only notes | Desktop ≥1200: **nonmodal complementary side panel** that can coexist with charts; Phone/tablet: full-screen modal panel | Esc/back/close returns to originating analytic context; restore focus to the concept trigger or L2 return target |

L1 is entirely optional; touch users go directly to L2. Screen readers can activate the term button and reach L2 and L3 without discovering a hover target. An original 3D clay illustration is permitted at L2/L3 only if it improves concept comprehension; 2D charts remain the quantitative ground truth.

## 2. Detailed states & event matrix

```text
CLOSED
  ├─ pointerenter/focusin → L1_OPEN (desktop input capable of hover; no interactive content)
  └─ click/tap/Enter/Space → L2_OPEN
L1_OPEN
  ├─ pointerleave/focusout/Esc → CLOSED
  └─ click/Enter/Space → L2_OPEN (close L1 first)
L2_OPEN
  ├─ 'Deep dive' → L3_OPEN (remember original trigger and parent L2 context)
  ├─ close/Esc → CLOSED
  └─ concept/reference navigation → L3_OPEN if selected
L3_OPEN
  ├─ related concept → L3_OPEN with history/breadcrumb (do not stack unlimited overlays)
  ├─ back to insight → L2_OPEN (if opened from L2 and parent still valid)
  └─ close/Esc → CLOSED (or parent L2 on an explicit back action)
```

**Priority:** Esc closes only the topmost open layer, then returns focus to the nearest still-valid origin. Never discard unsaved text silently. If the trigger was removed by filtering, focus returns to the nearest visible screen heading/alert item and an announcement explains the context change.

| Interaction | Pointer-capable desktop | Keyboard / screen reader | Touch phone |
| --- | --- | --- | --- |
| Discover term | Dotted underline/help icon plus visible '설명' affordance; hover L1 | `<button aria-label="... 설명 열기">`, Tab then focus reveals L1; `aria-describedby` points to L1 when mounted | tap affordance to L2; no hover assumption |
| Open insight | click term while L1 open or closed | Enter/Space on button; programmatic focus to L2 heading/first actionable element (consistent order) | tap → modal sheet; focus to title/close; body behind inert |
| Explore formula | visible approved equation, variable/units table; optional copy formula | equation has accessible text equivalent; formula notation explained nearby | readable line breaks and horizontal scroll only if essential |
| Deep dive | button '자세한 공학 설명' | Enter/Space activates panel, focus to heading; nonmodal desktop panel not focus-trapped | full-screen panel, trap focus, body inert |
| Close | explicit X + button label, Esc, desktop L2 outside click | Esc closes one layer; `aria-expanded` updates; focus restores to origin | close and device Back if host integrates; keyboard Esc if present |
| Related term | replace L3 topic and keep breadcrumb trail, avoiding nested dialogs | dedicated Back restores previous concept/focus; announce new heading | single screen and back control; no competing bottom sheets |

### L1 pointer/focus requirements

- The tooltip is not interactive; its entire content must also be available within L2. Use `role=tooltip` and `aria-describedby` only while it is visible, without hijacking focus.
- Focus/hover remains visible long enough to read. If pointer leaves the trigger toward the tooltip, avoid flicker; do not demand pointer travel to an interactive link in a tooltip.
- Esc dismisses tooltip while keeping the trigger focused. Don't attach Esc handlers to the entire page when nothing is open.
- Exact dwell delay is a candidate `150–250ms` on hover; focus content should appear promptly (A04 to validate).

### L2 nonmodal desktop versus modal phone

- Desktop: card anchored to trigger, reposition within viewport; `role=dialog aria-modal=false aria-labelledby` with an explicit labelled close. Move focus on explicit open, but **do not trap focus**; tabbing out can close only if no edit is pending and the focus has left the card and trigger. If the panel is implemented as a disclosure region instead, the semantics must match actual focus behavior.
- Tablet/phone: `role=dialog aria-modal=true` bottom sheet, backdrop, inert underlying content, trapped focus, swipe-dismiss **optional** and never the only exit. If a hardware/software keyboard is used, Esc works.
- L2 should provide a `View source` / '근거' link when approved, and an '해당 데이터 사용값' description. Do not present a dynamic computed result when matching code/version inputs are unavailable.

### L3 desktop side panel and mobile full-screen

- Desktop: persistent optional right panel `<aside aria-labelledby>` with close button, section headings, navigable references and an editable notes subsection; allow returning to chart while open and no focus trap. Don't obscure the chart's y-axis, labels or essential CTA—reduce content width or overlay only at explicit user action.
- Mobile: full-screen `role=dialog aria-modal=true` with focus containment; scroll the panel, not the underlying chart. Title, version status, close button remain discoverable.
- If the URL route is used for deep linking (`/knowledge/:conceptId`), the Back button restores the prior investigation; direct entry includes an explicit '분석으로 돌아가기' only when a valid context exists.

## 3. Content tiers and provenance contract

**Proposed static content metadata (A01 approval required):**

```ts
type KnowledgeReview = "draft" | "review_requested" | "approved" | "deprecated";
type DataOrigin = "synthetic" | "public_research" | "live";
interface KnowledgeConcept {
  conceptId: string;                // stable, never silently reuse for another concept
  locale: "ko-KR" | "en-US";
  title: string;
  quickSummary: string;             // L1: 1–2 sentences, no hidden mandatory caveat
  bodyPath: string;                 // reviewed, versioned MDX path
  formulaIds: string[];
  variables: { symbol: string; name: string; unit: string; definition: string }[];
  assumptions: string[];
  cautions: string[];
  references: { title: string; url?: string; version?: string; accessedAt?: string }[];
  relatedConceptIds: string[];
  contentVersion: string;
  reviewStatus: KnowledgeReview;
  reviewedBy?: string; reviewedAt?: string;
}
interface KnowledgeCalculationContext {
  formulaId: string; implementationVersion: string;
  unitSchemaVersion: string;
  input: Record<string, number | null>;
  output: { value: number | null; unit: string; precision: number; status: "ok" | "invalid_input" | "unavailable" };
  scenarioId: string; dataOrigin: DataOrigin;
  measuredAt?: string; timezone?: string;
  assumptionsApplied: string[];
  fixtureHash?: string; generatorVersion?: string;
}
```

This TypeScript is a **handoff proposal**, not an existing application or a guarantee that a particular calculation is correct. Knowledge documents are descriptive; only A02 tested computation functions derive numbers. The client must not evaluate executable script/unsanitized embedded HTML inside MDX. Source/ref URLs require safe link handling and validation.

**Review badge policy:** `approved` → show reviewed version/date; `draft/review_requested` → '공학 검수 전' visible; `deprecated` → prominent deprecation notice with supported replacement. A01 controls who can set `approved`. Absence of review metadata must not be interpreted as approved.

### L2 worked example layout (placeholder fixture, not product output)

```text
Etch Rate — 식각 속도                         [개념 설명 / PROPOSAL]
식: (두께_before - 두께_after) / 시간          [formulaId: REVIEW_REQUIRED]

합성 예시 입력 (설명용, 검증 필요)
  전 두께: 200 nm
  후 두께: 140 nm
  시간: 2 min
표시 계산: 30 nm/min   [이 예시의 산술 결과이며 실제 장비 측정 아님]

필수 전제: 측정 대상·시간 정의, 물질/공정 선택, 두께 측정 방식,
          음수/0 시간/결측 처리 규칙 등은 A01/A04 검수 후 노출.
[현재 시나리오 값으로 보기 — 계산 함수/데이터 계약 제공 시만 활성화]
[더 깊게 이해하기 →]
```

The numerical illustration is a trivial independent arithmetic fixture aligned with A04's **unexecuted** reference plan, not an executed FAB ONE test. If the deployed function is unavailable, label '예시(정적)' and disable live scenario recalculation; never interpolate a derived number into a chart without source metadata.

**SPC caution:** L1 for `UCL` explicitly names '관리상한선(공정 변동 감시용)' and **does not** equate it to product upper spec `USL`. L2/L3 show separate definitions, method, sample size and assumptions. Correlation/pattern evidence is not proof of root cause.

## 4. Component API suggestion to A02

```ts
interface KnowledgeTriggerProps {
  conceptId: string; inlineLabel: string;
  dataContextRef?: string; disabledReason?: string;
}
interface KnowledgeControllerState {
  level: 0 | 1 | 2 | 3;
  activeConceptId: string | null;
  originalTriggerId: string | null;
  previousLevel?: 0 | 1 | 2;
  contextRef?: string;
  relatedHistory: string[];
}
interface KnowledgeViewState {
  load: "idle" | "loading" | "ready" | "missing" | "failed";
  reviewStatus?: KnowledgeReview;
  calculation: "static_example" | "ready" | "invalid" | "unavailable";
  notes: "idle" | "saving" | "saved_local" | "failed" | "blocked";
}
```

- `dataContextRef` stores opaque IDs, not a full data dump in the URL or analytics log.
- Multiple same-concept triggers must have unique element IDs; switching triggering elements repositions the card without losing insight state unexpectedly.
- If a concept is absent: show '해당 공학 설명을 찾지 못했습니다' with a return action; data chart remains usable.
- If formula result and static content versions conflict: **suppress** the worked result, show '계산 설명 버전 불일치', log a QA issue; never show an apparently authoritative number.
- For a trigger removed while panel is open, keep panel until dismissed and return focus to safe fallback.

## 5. Local personal notes / export / import / reset

**Storage proposal pending ADR approval:** User-owned notes live in browser IndexedDB. A note is not a professional shared incident record nor immutable audit. No cloud synchronization, automatic backup or cross-browser portability unless a person explicitly exports/imports.

**Inline storage disclosure before first save:**
> 개인 메모는 **이 브라우저에만 저장**됩니다. 다른 기기와 자동 동기화되지 않으며 브라우저 데이터 삭제 시 사라질 수 있습니다. 중요한 메모는 파일로 내보내세요.

**UI states:**
- `saving`: '이 브라우저에 저장 중…'
- `saved_local`: '이 브라우저에 저장됨 · 동기화 안 됨' with date/time.
- `blocked/quota`: '브라우저 저장이 차단되었거나 공간이 부족합니다' with retry and export-current-text option (only if safely present in memory).
- `failed`: explicit error, preserve unsaved editing buffer; offer export text rather than silently losing it.
- `empty`: invite writing, no fake persisted note.
- `import_validation_error`: explain invalid format/schema/version, no partial silent import.

**Proposed export schema (versioned JSON, not executable):**

```json
{
  "schema": "fab-one-ekl-notes",
  "version": 1,
  "exportedAt": "2026-10-15T01:00:00Z",
  "notes": [
    {
      "noteId": "local-note-001",
      "conceptId": "etch-rate",
      "content": "개인 학습 메모 (예시)",
      "updatedAt": "2026-10-15T00:30:00Z"
    }
  ]
}
```

- Export is user-initiated and visibly names content scope, version and timestamp. Keep text sanitized/escaped; never embed secrets. If CSV export is later offered, neutralize formula-injection cells.
- Import preview lists number of valid notes, unsupported versions, conflict count and destination (**this browser only**); choose skip/replace/duplicate for conflicts, with confirmation. Parse/validate schema and lengths before any writes; use transactional staging to avoid partial import.
- **Deletion:** '이 브라우저의 개인 메모 삭제' is a separate danger action requiring confirmation of destructive scope and no auto recovery. Show relevant warning and export option before deleting.
- **Simulator reset policy: A01 provisional UX direction recorded in PR #7 comment #6184007944.** '시뮬레이션 다시 시작' resets synthetic scenario/run/fixture only and **preserves IndexedDB personal notes**. Separate '이 브라우저의 개인 메모 삭제' must communicate irreversible scope, offer export, and require confirmation. **Architecture/ADR and exact reset semantics still await owner approval**; do not falsely label them shipped product behavior.
- If browser storage is not available in privacy mode, L1/L2/L3 still work read-only; show nonblocking note-disabled message.

## 6. Error, loading, offline, reduced motion and screen reader

| Case | UI requirement | Recovery |
| --- | --- | --- |
| Static MDX loading | skeleton within panel; leave chart interactive | success → content; fail → retry and dismiss |
| Missing concept/formula metadata | show content unavailable or review pending | link to concept index / return |
| Calculated result missing/invalid | '계산할 수 없음' with reason and missing field | return to input evidence, never show `0` |
| Browser storage blocked | notes disabled but read-only knowledge available | manual export / browser settings explanation |
| User goes offline | cached reviewed content only when verified; stale content version label | reconnect/retry without context loss |
| Scroll in nested panel | one primary scroll for mobile; panel scroll only if open | Esc/close always reachable |
| Screen-reader announcements | title + '설명 패널 열림' once; changes scoped | no continuous point-by-point `aria-live` spam |
| Reduced motion | instant panel/tooltip appearance, no 3D spin | same visible state and focus target |
| Unknown/unsupported version | '검수 필요' and prevent contradictory computation | return to analytic evidence |
| A01 review revoked/deprecated | explicit reviewed state downgrade | suppress calculations where mismatch is material |

### Screen reader strings and semantics

- Trigger example: accessible name '식각 속도, 공학 설명 열기' with `aria-expanded` for L2/L3 interactive disclosures (not simply for hover-only L1); `aria-controls` target points to existing controlled region.
- L1 tooltip: '`식각 속도는 단위 시간당 제거된 막 두께입니다. 단위 nm/min.`' (definition requires A01 sign-off).
- L2 heading and formula text must be included in readable DOM; don't render formula only as an image. Equations receive visible nearby variable table.
- L3 references are ordinary meaningful links (source name and version) not '자세히'; open external sources intentionally, show external-link cue.
- Close buttons: '공학 설명 닫기'; if multiple layers stacked, label with current level/concept. Decorative clay art uses empty `alt`; genuinely educational diagram includes text alternative and caption '개념도 · 축척 아님'.
- When returning focus to a list row after filter removal, navigate to stable fallback, avoid hidden/unmounted element reference.

## 7. QA acceptance cases (not run)

| Test ID | Manual/automatable acceptance | Review owner |
| --- | --- | --- |
| EKL-01 | Hover/focus L1 visible; Esc dismisses without moving focus; tooltip is noninteractive | A03/A04 |
| EKL-02 | Enter/Space/tap opens L2; mobile sheet traps focus, closes Esc/close, restores trigger | A02/A04 |
| EKL-03 | L3 desktop side panel leaves analysis operable; mobile panel modal; Back/close returns correct context | A02/A04 |
| EKL-04 | Formula explanation and computed value carry same reviewed formula/version, units and source; mismatch blocks output | A01/A04 |
| EKL-05 | Incomplete/missing static MDX renders recoverable state and no injected active HTML/JS | A02/A04 |
| EKL-06 | IndexedDB blocked/quota/reload/export/import-version/conflicts behave as specified, no false sync | A02/A04 |
| EKL-07 | Sim reset/notes deletion are distinguished and destructive behavior awaits A01 approval | A01/A04 |
| EKL-08 | Reader order, focus restore, keyboard-only, touch, zoom, reduced motion verified on 320px and desktop | A04 |
| EKL-09 | No actual FAB control, central audit, or real production-cause claims in knowledge content | A01/A04 |

**No EKL implementation, screen-reader test, UX testing, or Figma prototype was executed/created by this document.**

## 8. Outstanding decision register

- **EKL-D01 (A01):** Canonical `conceptId`, formulas, estimator/method assumptions, scientific caveats, content review sign-off.
- **EKL-D02 (A01/owner):** Provisional direction is to **preserve** notes on ordinary simulation reset, delete only via separate explicit confirmation/export opportunity; exact implementation/storage policy awaits ADR sign-off.
- **EKL-D03 (A02):** Selected operating mode and persistence adapter, import schema/validation and error handling contract.
- **EKL-D04 (A03/A04):** Focus transition acceptance on target browsers, reader order and preferred card/modal breakpoints after prototype test.
- **EKL-D05 (A01):** Which parts of 'case notes' and 'personal knowledge notes' are separate, to avoid implied shared audit.

**Next review:** A01 sign-off on domain/content and pending decisions; A02 implementation feasibility; A04 independent tests against this document and [A04 QA plan](https://github.com/Junebooky/semi_fab/pull/3).

## 9. Issue #9 prototype EKL content alignment — P1 correction (2026-10-15)

**Design contract** synchronized to [PR #11's editable prototype](https://github.com/Junebooky/semi_fab/blob/a03/issue-9-white-emerald-visual/prototypes/fab-one-issue-9.html) / A01 [review #6184254594](https://github.com/Junebooky/semi_fab/pull/11#issuecomment-6184254594). This is a **visual demo**, not deployed or A01-approved engineering knowledge.

- A stable `conceptId` selects a **single versioned content record** (prototype `KNOWLEDGE_CONCEPTS[conceptId]`) containing `title`, `description`, `insightFormula`, `deepTitle`, `body`, `formula`, `cautions`, `source`. Every L2 and L3 field must update *together* via this key; changing only the panel heading while retaining another topic's paragraphs is forbidden.
- For `etch-rate`, L2/L3 use the **static arithmetic demonstration** `(200−140) nm / 2 min = 30 nm/min`. It is not a reading from the simulated sensor series (which uses `[a.u.]`). Film, step, metrology method and temporal assumptions await A01 review; the prose cannot claim verified process performance.
- For `control-limit`, L2/L3 explain `UCL/LCL` as **SPC process control limits** distinct from `USL/LSL` product specifications, state the estimator/method and accepted numeric values are **not yet defined**, and warn that a limit crossing does not determine physical cause or lot defect. **Do not show Etch Rate arithmetic or an invented UCL/LCL formula.**
- Unknown `conceptId` must never fall back silently to unrelated content; display '이 개념의 공학 설명을 찾지 못했습니다' in product implementation. The current prototype refuses to open an unrecognized key.
- **Structure/roles remain unchanged:** L1 hover/focus (noninteractive tooltip), L2 click/tap card, L3 desktop nonmodal `aside` and mobile full-screen modal. Escape, focus restoration, screen-reader order and 360px/400% zoom are **independent browser QA pending A01's SHA-specific QA_READY**.
- Notes in the visual prototype are **read-only explanatory copy**, not IndexedDB persistence. The A01 provisional policy preserves notes on ordinary simulator reset, but no running storage module is claimed.
- A03's source mock-DOM regression test covers the two concepts' body/formula/cautions/source mapping. The file lives at `prototypes/prototype-contract.test.mjs` on PR #11. **A04 final QA must wait** for A01's `[A01][QA_READY]` with exact PR/head SHA; PR edits invalidate prior verification of earlier SHAs.

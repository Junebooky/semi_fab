# FAB ONE Design System Foundations — A03 v0.1

> **Status:** REVIEW / proposed design contract, not implemented; [Issue #4](https://github.com/Junebooky/semi_fab/issues/4). 2026-10-15.
> Inspiration from [Toss official public UX research](toss-research.md), but **every value below is FAB ONE original and NOT an official Toss rule**. Domain workflow, SPC rules, calculation assumptions, data retention and architecture are subject to A01/A02/A04 review.


> **Owner-approved visual override — Issue #9 (2026-10-15):** Application/canvas and default card surfaces are pure white `#FFFFFF`; restrained lines and ultra-light supplemental zones provide separation. The emerald palette is reserved **only for illustrative wafer/chamber placeholder objects**, never for measurement charts or machine-state badges. Final 3D assets are **owner-supplied later**; A03 delivers slots and fallback. The repository's machine token keys are the authoritative canonical names; `space.*`, `shadow.card`, and `border.focus` now match the JSON values.

## 1. Product design principles

1. **Calm Precision:** warm, minimalist visual layer; high precision engineering measurement, never hiding unit, timestamp, source or uncertainty.
2. **Investigate before acting:** suspected anomaly is a prompt to investigate, not proof of root cause, scrap or a real FAB equipment fault.
3. **Clearly simulated:** global `SIMULATION · SYNTHETIC` label stays visible at all times in Mode A/B; simulated 'role selection' cannot resemble real RBAC or live equipment control.
4. **One task, multiple depths:** novices view explanation progressively; expert users can go directly to raw tables, time windows, evidence export and deep charts.
5. **Access before animation:** keyboard, screen reader and reduced motion are baseline acceptance criteria, not follow-ups.

## 2. Information architecture

```text
FAB ONE
├── FAB Command Center      /command-center
│   └── Alert details       /alerts/:alertId
├── Equipment Intelligence  /equipment
│   └── Chamber evidence    /equipment/:equipmentId/chambers/:chamberId
├── Process Control         /process
├── Yield & PI Analytics    /yield
├── Lot/Wafer Traceability  /traceability/lots/:lotId
│   └── Wafer detail        /traceability/wafers/:waferId
├── Engineering Workspace   /investigations/:caseId (simulated case)
└── Knowledge Layer         /knowledge/:conceptId
```

These are **route proposals**, not committed code/APIs. Every deep page preserves selected scenario, time range, filter context and provenance. Navigation into the EKL should preferentially stay inside the investigation context.

## 3. Foundation tokens (light baseline)

Canonical machine-readable token example: [tokens/fab-one.tokens.json](tokens/fab-one.tokens.json). A02 may map these into CSS variables; avoid importing Toss tokens.

| Group | Token | Value | Guidance |
| --- | --- | --- | --- |
| Surface | `color.surface.canvas` | `#FFFFFF` | pure white app canvas (owner-approved) |
| Surface | `color.surface.card` | `#FFFFFF` | primary content |
| Surface | `color.surface.subtle` | `#EDF2F8` | quiet secondary zones |
| Ink | `color.text.primary` | `#17263B` | main headings/body |
| Ink | `color.text.secondary` | `#48586D` | labels and metadata |
| Border | `color.border.default` | `#DCE3ED` | separators and fields |
| Clay art ONLY | `color.asset.clay.primary` | `#16B88A` | wafer/chamber illustration fill; not chart/normal |
| Clay art ONLY | `color.asset.clay.dark` | `#076F5B` | illustrative shadow; not critical/normal |
| Action | `color.action.primary` | `#155BC1` | primary action (not 'normal') |
| Danger text | `color.severity.critical.text` | `#AD211A` | risk label; pair with icon/text |
| Warning text | `color.severity.warning.text` | `#8B5400` | caution label |
| Success text | `color.severity.normal.text` | `#087254` | normal / successfully sampled (meaning scoped) |
| Unknown text | `color.data.missing.text` | `#505E71` | absence, not zero |
| Focus | `color.focus.ring` | `#155BC1` | 2px visible ring + 2px offset |
| Radius | `radius.sm/md/lg/xl` | `8 / 12 / 16 / 24px` | cards, dialogs; full radius only pills |
| Spacing | `space.1/2/3/4/6/8/10/12` | `4 / 8 / 12 / 16 / 24 / 32 / 40 / 48px` | consistent 4px scale |
| Elevation | `shadow.card` | `0 4px 18px rgba(23,38,59,.06)` | restrained; no shadow as sole delimiter |
| Focus | `border.focus` | `2px` | keyboard focus, visible on every surface |

**Pre-release verification:** A04 must measure WCAG 2.2 AA contrast (normal text ≥4.5:1, large text ≥3:1, significant non-text indicators ≥3:1) on every actual foreground/background combination and at browser zoom. These hex values are proposals, not a completed color audit.

### Surface composition policy

- Canvas, navigation base and normal card backgrounds = `#FFFFFF`; use border `#DCE3ED`, spacing and subtle elevation to establish sections instead of a gray full-page wash.
- `color.surface.subtle=#EDF2F8` may appear **inside auxiliary chips, captions or low-emphasis zones only**. It is **not** the app background.
- Contrast and meaning of chart data remain independent of decorative greens; measurement graphs never inherit `color.asset.clay.*`.

### Typography

- Stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif`; use fonts already permitted by deployment/license, do not bundle proprietary Toss font.
- Desktop heading: display `32/40px 700`, page `28/36px 700`, section `20/28px 650`, card `16/24px 650`.
- Body `16/24px 400`, dense table `14/20px 400`, labels `13/18px 500`, metadata `12/18px 400` (secondary only). Avoid 12px for essential warnings, controls or measurements.
- Tabular numerical values use `font-variant-numeric: tabular-nums`. **No truncation of critical numbers/units**; allow copy and tooltip/full value for noncritical long IDs.
- Content width recommendations: reading pane 640–760px; analysis canvas fluid, avoid long full-width prose lines.
- Content remains operable at 200%/400% zoom with no loss of essential content.

## 4. Status semantics — two independent axes

**Equipment / statistical evidence severity** (from A01-defined business semantics):

| Machine value | Visual label (Korean) | Icon plus treatment | Required note |
| --- | --- | --- | --- |
| `normal` | 정상 | ✓ green-neutral badge | Equipment status, not proof that every die passes |
| `warning` | 경고 · 확인 필요 | ! amber + label | Observed rule/threshold and evaluation time |
| `critical` | 위험 · 우선 조사 | ! red + label | No real device action; suspected anomaly only |
| `unknown` | 상태 미확인 | ? gray + label | No false normal interpretation |

**Measurement pipeline / freshness** (must not be folded into the above):

| Machine value | Visual label | Handling |
| --- | --- | --- |
| `available` | 수집됨 | timestamp + source + unit |
| `missing` | 데이터 없음 | em dash / empty indicator; NEVER substitute zero |
| `delayed` | 수집 지연 | amber clock, last-success timestamp and expected interval (threshold owned by A01) |
| `failed` | 수집 실패 | red connection icon + retriable error code |
| `paused` | 시뮬레이션 일시정지 | pause icon, clock stopped, never show as live |
| `loading` | 불러오는 중 | skeleton preserving region dimensions |

**Provenance** is third, orthogonal axis: `synthetic` → '합성 시뮬레이션', `public_research` → '공개 연구 자료', `live` → '실제 운영 데이터' **only if a future implementation is actually connected and approved**. MVP examples use `synthetic`.

Tokens describe visual semantics and do **not** determine thresholds, production risk, rules or privileged actions. Text labels and icons are always visible alongside color.

## 5. Components contract

The A02 handoff order is **purpose → anatomy → variants → states → data → a11y → acceptance**:

| Component | Anatomy / variants | State & data contract | Keyboard / accessibility |
| --- | --- | --- | --- |
| `AppShell` | brand, module nav, scenario indicator, sim clock, help | explicit mode, `scenarioId`, sim-clock timestamp/zone, data provenance | skip link; `nav`, `main`, unique headings; responsive collapse |
| `AlertSummary` | severity icon, title, equipment, last measured, trigger, '조사하기' | severity + freshness separately; scenario-only controls | accessible button name includes equipment/severity |
| `MetricTile` | name, numeric value, unit, delta/baseline, sample time | `value=null` displays '데이터 없음'; no fake 0 | label/description combined for reader |
| `EvidenceTrend` | plot, axes/units, rule lines, table toggle, legend | raw points, missing segments, LCL/UCL/CL labels; spec limits only separately if approved | data table alternative, accessible legend, keyboard point detail |
| `LotTable` | lot/wafer identifier, exposure status, time, linkage evidence | server/filter-defined pagination, sortable selected column, immutable IDs | `<th scope>`, `aria-sort`, focus retained on update; horizontal scroll affordance |
| `StatusBadge` | icon + word + optional timestamp | two independent badges when severity & freshness co-occur | never convey status by hue alone |
| `KnowledgeTrigger` | term + underlined affordance/help icon | linked `conceptId` + review version | real button; focus outline; touch opens L2 |
| `KnowledgePopover` | term, 1–2 sentences, unit, '자세히' | L1 only; no essential exclusive info | hover/focus readable, dismissible Esc |
| `KnowledgeCard` | statement, formula, variable table, worked example, assumptions | L2; computed value only from tested function, not MDX | click/tap; focus management; Esc |
| `KnowledgePanel` | sections, linked references, related concepts, notes | L3; version, review state, saving/errors | **Desktop nonmodal complementary `<aside>`** (no focus trap); **mobile full-screen modal `role=dialog`** (focus trap); labeled close and focus restore |

All controls need `default / hover / focus-visible / pressed / disabled / loading / error` where applicable. The disabled state must explain why; a disabled real-FAB 'Hold' button should **not exist** in demo UI.

## 6. Charts, tables and engineering rules

- Chart axis titles include **parameter and unit** (e.g. pressure [mTorr]); marks show timestamp and timezone, simulator clock if relevant; missing-data gaps are visible, not interpolated without consent.
- Differentiate **SPC control limits** (`CL/UCL/LCL`, statistical signal) from **specification limits** (`USL/LSL`, product requirements) by literal labels + line style + separate legend groups, not just colors. Never show them as equivalent.
- SPC rule ID, window, threshold version, sample count and sampling interval are part of `EvidenceTrend` context; rule selection/approval belongs to A01.
- Numeric columns align right, labels left, timestamps use consistent ISO-friendly format, e.g. `2026-10-15 10:24:03 KST` with timezone; ISO UTC in export. Units repeat in column headings and may appear in detail when values are standalone.
- Density: `comfortable` table rows min 48px, `compact` min 40px; do not reduce click target below **44×44 CSS px** for primary touch controls. Offer density setting but keep cell readability.
- Pinned columns: only ID + severity if horizontal scroll; show active sort, number of filtered records, selection count, and copyable IDs. Virtualization must keep keyboard/reader order coherent.
- Wafer Map: fixed orientation, clearly labeled X/Y and notch/flat convention (if given); independent legend with min/max bins; excluded/unmeasured dies use distinct hatch/shape; no perspective skew or 'yield loss confirmed' inference.

## 7. Responsive, accessibility and motion

| Viewport proposal | Primary behavior | EKL |
| --- | --- | --- |
| `>=1200px` desktop | 240px left navigation + fluid content + optional 400px knowledge side panel; chart/table can split 7:5 | L1 anchored, L2 anchored card, L3 side panel |
| `768–1199px` tablet | collapsible nav, single-column chart with secondary table below, sticky status row | L2 centered sheet/card, L3 overlay panel |
| `<768px` phone | one column; top-level alerts and critical stats first, tables horizontally scroll with caption; no analytical content hidden without affordance | no hover requirement; L2 bottom sheet; L3 full-screen sheet |

- Primary controls support Tab, Shift+Tab, Enter, Space (button), Esc to dismiss, standard roving tabindex *only* if a true composite widget is designed. Focus is **not** trapped for non-modal L1, and **is** contained for modal L2/L3.
- Dynamic alerts use restrained `aria-live=polite` for noncritical changes. Avoid repeated live announcements from streaming graph points.
- Motion presets: `fast 120ms`, `standard 180ms`, `panel 220ms` with `cubic-bezier(.2,0,.2,1)`; user `prefers-reduced-motion: reduce` eliminates transforms and looping motion, preserves non-motion feedback.
- Preserve readable context at 320px minimum viewport width and 400% zoom; run actual browser tests before claiming compliance.
- `Loading` = no fabricated prior success, `Empty` = explicit no matching records + clear filters, `Error` = what failed + last successful sample/retry, `Success` = affected entity and next step. Distinguish a real absence from failed acquisition.
- RTL not targeted initially; mixed English process abbreviations and Korean labels need spacing and line wrap. Support variable text length and translations.

## 8. Green clay illustrative placeholders (owner-replaceable slots)

**Purpose:** explain concepts / attract users to knowledge content, not present measured geometry.

- **Allowed surfaces:** brand/landing, contextual learning cards, equipment concept page, wafer/die onboarding, meaningful empty states. **Actual slot contract:** [asset-slot-contract.md](asset-slot-contract.md) plus [asset-slots.json](tokens/asset-slots.json). All 3D placeholder greens are `color.asset.clay.*`, NOT statistical/normal severity colors.
- **Disallowed:** quantitative charts, tables, alarm icons, Wafer Map heatmaps, active operator decision controls.
- **Material for future owner asset reference only:** matte clay, understated shading, emerald palette `#076F5B / #0B9F78 / #16B88A / #A4E9C8 / #DDF8EC`. **No 3D source/model/render delivery is expected now.** Placeholder is editable simple geometry/CSS or a static image without scientific meaning.
- **Lighting:** broad soft key upper-left + low-intensity fill; restrained ambient occlusion and contact shadow. No flashing emissive warning accents.
- **Camera:** fixed orthographic or weak-perspective isometric (approx. 30–35° elevated, 30–45° azimuth) *for illustration only*. Not for wafer coordinate measurement.
- **Composition:** center-of-mass stable, comfortable safe area, clear cutaway labels when teaching chamber/wafer; disclose '개념도 · 축척 아님'.
- **Sizing:** use fixed aspect-ratio wrappers and CSS `object-fit:contain` (never stretch/crop) with 12% internal safe padding. Recommended slot-by-slot sizes/breakpoints in [asset-slot-contract.md](asset-slot-contract.md). No asset on dense charts.
- **Rendering budget policy (proposal, requires profiling):** default static WebP/AVIF/SVG fallback, optional progressive canvas only if user explicitly engages; no WebGL requirement for core tasks; lazy-load offscreen asset; reduced motion disables object spin.
- **Safety:** any 3D views must not imply real tool brands, verified physical cross-sections, or quantitative scale without A01-approved sources.

## 9. Review and design acceptance matrix

| ID | A02 builds/proves | A04 checks | Owner |
| --- | --- | --- | --- |
| DS-01 | named token mapping, theme default, no Toss IP | contrast/readability at 100–400% zoom | A03+A04 |
| DS-02 | severity/freshness/provenance channels independent | no 'missing=0', no color-only indicators | A01+A04 |
| DS-03 | deterministic route context and scenario label | deep link/reload preserves valid context | A02+A04 |
| DS-04 | charts expose table/limits/units/version | CL/UCL/LCL vs LSL/USL and keyboard access | A01+A04 |
| DS-05 | EKL trigger/card/panel and reduced motion | touch/keyboard/focus/Esc/reader | A03+A04 |
| DS-06 | static 3D fallback, no loss to core workflow | low-performance/mobile fallback | A02+A04 |
| DS-07 | notes local-only, explicit non-sync/export/import | quota/blocked/private mode, data-loss behavior | A01+A04 |

**Outstanding approvals:** No public PRD v1.3 available in `main` at authoring; ADR-001 [#1 / PR #2](https://github.com/Junebooky/semi_fab/pull/2) remains PROPOSED. A01 decides alert criteria and real business terminology; A02 owns actual tech architecture; A04 reports measured accessibility/visual tests. Figma editable file and final 3D assets **not created in this Issue #4 specification**; owner supplies production 3D images later. A separate high-fidelity editable prototype is tracked under Issue #9.

## 10. Handoff alignment to Issue #9 white/emerald visual source (2026-10-15)

- **Document PR #7:** source of proposed token values, responsive/a11y design guidance and two asset-slot contracts. **Visual PR #11:** editable HTML/CSS/JS prototype demonstrating those contracts. The branches remain **REVIEW**, not accepted production code.
- **Base surface:** `color.surface.canvas=#FFFFFF` and `color.surface.card=#FFFFFF`. Decorative emerald `color.asset.clay.*` belongs to the wafer/chamber illustrations only; it must never override status-warning or chart-series semantics.
- **Asset slots:** `illustration.wafer.v1` is **196×196 desktop / 132×132 phone, 1:1**; `illustration.etch-chamber.v1` is **240×192 desktop / 160×128 phone, 5:4**. Preserve `object-fit:contain`, transparent raster image support, 12% internal safe padding, original SVG fallback, Korean alt equivalent and geometry on failure/slow load. Owner will supply final art later; A03 does not need to create the finished 3D model.
- **Breakpoint distinction:** the foundations' `768/1200px` responsive ranges are *design proposals*. The editable Issue #9 prototype has explicit CSS at `620px`, `800px`, `1180px` (with a related `801–1199` view description). A02 should choose and document final production breakpoints after testing; do not label the two breakpoint sets numerically identical. In the prototype, <=620px opens modal mobile EKL layers.
- **Data correctness is visual correctness:** selected `alertId` matches its equipment/run/fixture or shows no-evidence reason; SVG and accessible table derive from one T0..T7 synthetic array including individual `null` positions; unapproved UCL/LCL graphics carry '도식용 가상 한계선 · 통계적 관리한계 미검증'. **No approved Etch pressure SPC values or causal claims** have been supplied.
- **EKL concept correctness:** L2/L3 update title/body/formula/cautions/source as one `conceptId` record; the UCL/LCL deep dive never reuses Etch Rate thickness/time calculations. Desktop L3 stays nonmodal `aside`; mobile L3 uses an explicitly modal panel.
- **Handoff gate:** A03 submits the latest PR #7 and PR #11 full HEAD SHAs to **A01** for re-review. A04 final browser/accessibility QA may begin **only after** A01 posts a `[A01][QA_READY]` with target PR and exact head SHA. No A03 test finding (even PASS) is a substitute for that independent stage. Reference: [agent handoff v1.0](https://github.com/Junebooky/semi_fab/blob/docs/issue-1-local-first-governance/docs/product/agent-handoff-workflow.md).

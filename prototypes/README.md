# FAB ONE — High-Fidelity White/Emerald Visual Prototype (A03)

- **Issue:** [#9](https://github.com/Junebooky/semi_fab/issues/9)
- **Owner instruction:** [A01 comment on PR #7](https://github.com/Junebooky/semi_fab/pull/7#issuecomment-6184058820)
- **Editable original:** [fab-one-issue-9.html](fab-one-issue-9.html) — one editable HTML/CSS/JS file containing layout, responsive breakpoints, chart SVG, emerald illustrative placeholders, and functional EKL/navigation.
- **Status:** REVIEW (visual design prototype, NOT app deployment or verified engineering calculation).
- **Related source-of-truth:** [PR #7 proposed design contracts](https://github.com/Junebooky/semi_fab/pull/7) and [Issue #4](https://github.com/Junebooky/semi_fab/issues/4).
- **No licensed/unpublished Toss IP imported. No real FAB connectivity. No polished 3D model created.**

## 1. How to view and edit

Clone/download this repository branch, then open `prototypes/fab-one-issue-9.html` directly in a browser. It is dependency-free and has no network/CDN requirements. Edit CSS variables at the top of the file to adjust the layout; modify the three `section#view-*` blocks for screen content, or the JS view manager for interactions. It can be rebuilt into reusable A02 components later; **this prototype is not a production React app**.

Source path: `prototypes/fab-one-issue-9.html`, branch `a03/issue-9-white-emerald-visual`. **Desktop/mobile are two responsive states of one editable original**—not two static screenshots.

### Screen coverage

| Design state | How to access | Design contents |
| --- | --- | --- |
| 01 FAB Command Center desktop | Default view / first nav button | white canvas, alert queue, example summary, linked scenario/time/provenance, original emerald wafer placeholder |
| 02 Equipment Evidence desktop/mobile | 'Etch 시나리오 조사' / Equipment nav | original sample SVG trend, named units `[a.u.]`, UCL/LCL **unapproved placement demonstrators**, explicit missing-data gap, table of corresponding synthetic values, chamber placeholder |
| 03 Lot candidate investigation | '연관 Lot 후보 확인' / Lot nav | separate linked run history / possible exposure (demo) / indeterminate examples; **no defect determination** |
| EKL L1 | Mouse hover or keyboard focus on '식각 속도' or 'UCL / LCL이란?' | short concept tooltip; Esc dismiss without moving focus |
| EKL L2 | Click, tap, Enter/Space on term or '공학 개념 알아보기' | semantic dialog, formula/assumptions/example, close+Esc+focus restore; desktop nonmodal, mobile modal bottom sheet |
| EKL L3 | L2 '자세히' | nonmodal complementary `aside` desktop; full-screen modal pane mobile, Esc/Back, focus restore, limitations and notes copy |

### Desktop/mobile breakpoints

- **>=1200px:** wide white engineering canvas, fixed 224px navigation, evidence chart + context art side by side, 400–450px nonmodal L3 right panel.
- **801–1199px:** compact nav with responsive single-column evidence, chart remains readable.
- **621–800px:** navigation becomes horizontal, overview responsive grid, chart first.
- **<=620px (including 360px):** single-column hero, 132×132 wafer, 160×128 chamber, horizontally scrollable tables, L2 bottom sheet and L3 full-screen modal. No dependency on pointer hover.

The source is responsive, but **manual QA at 360px and 400% zoom has not been executed**. A04 must verify on actual devices/browsers.

## 2. White UI and emerald asset palette

- Canvas/card/background `#FFFFFF` **mandatory**, not a pale gray page.
- Auxiliary zones may be very light gray behind *tooltips/help only* (e.g. `#F7F9FB`); structural separation uses `#DCE3ED` lines and restrained shadow.
- Illustration-only palette: dark `#076F5B`, deep `#0B9F78`, primary `#16B88A`, highlight `#A4E9C8`, pale `#DDF8EC`.
- Colors for normal/warning/critical, data freshness, measurement chart series and provenance **are semantically independent** of decorative emerald material color.

## 3. Asset swap: user-supplied images, no layout refactor

Only update these two JS manifest strings near the end of the HTML:

```js
const ASSET_OVERRIDES = {
  "illustration.wafer.v1": "",
  "illustration.etch-chamber.v1": ""
};
```

Add actual relative file paths to your owner-provided images when they exist (e.g. `assets/wafer-custom.webp`). The file should live where the HTML can resolve it; no source is claimed uploaded until then.

| Slot | CSS reserved dimensions | Aspect ratio | Replacement behavior |
| --- | --- | --- | --- |
| `illustration.wafer.v1` | desktop 196×196; phone 132×132 | 1:1 | transparent WebP/PNG/AVIF, contain centered, 12% safe padding, diagram fallback |
| `illustration.etch-chamber.v1` | desktop 240×192; phone 160×128 | 5:4 | transparent image with 12% internal safe area; no crop, diagram fallback |

Missing/invalid path: CSS reserves dimensions and leaves a **temporary emerald SVG placeholder**, avoiding a broken-image icon or layout shift. The `img` receives accessible alt on successful load, and the SVG placeholder's wrapper provides equivalent meaningful Korean `aria-label`. Illustrations are not used inside graph data surfaces. All fallbacks are simple original abstract vector geometry, *not final 3D clay render deliverables*. See the more detailed machine-readable contracts in [PR #7 asset-slot specification](https://github.com/Junebooky/semi_fab/blob/a03/issue-4-design-foundations/docs/design/asset-slot-contract.md).

## 4. A02 handoff: split prototype from product implementation

- Route mapping proposal: `command` → `/command-center`, `evidence` → `/equipment/:id/chambers/:id`, `trace` → `/traceability/lots`. Replace onclick prototype selection with router while preserving scenario/run/window provenance.
- Replace every `DEMO` content field with **approved synthetic fixtures** only after A01/A02 rule contract. The plot `[a.u.]` explicitly avoids asserting an approved pressure unit; **UCL/LCL are conceptual line placements, not approved calculated limits**. Missing sample T4–T5 is not plotted as zero or connected trend.
- In a real build, chart/table must derive from one source array; prototype values are hand-authored SVG/table duplicates so A02 must not copy that pattern into production code. Handle `null` and last sample timestamp explicitly.
- Separate `alert.severity`, `measurement.freshness`, `dataset.provenance` and `simulator.state`; do not use the decorative `clay` palette as data status.
- L1 tooltips have no required buttons. L2 mobile `role=dialog aria-modal=true` and background inert; L3 desktop `aside` nonmodal (no trap), mobile full-screen modal. A04 must validate focus and screen-reader semantics on target browsers.
- The prototype deep panel contains a **read-only notes explanation**. It **does not** persist IndexedDB notes. Existing PR #7 describes proposed note export/import/reset UX, subject to ADR-001 and A01 approval.
- Prototype has **no real equipment controls, case-save writes, APIs, Supabase or live ingestion**. Do not turn simulated 'investigation' into genuine Hold/Release or shared approval without separate permission model and tests.
- No external JS/CSS/fonts/image CDN is required; production should still test performance and provide 1×/2× owner image variants.

## 5. A04 visual and interaction review checklist

| ID | QA criterion | Current evidence |
| --- | --- | --- |
| VIS-01 | Page/card base computed background `#FFFFFF` for all routes; secondary shade confined to notes/status surfaces | Source CSS declaration / not browser-verified |
| VIS-02 | Both asset IDs have placeholder and replacement file path config; no CLS on success/error | Source layout / not browser-verified |
| VIS-03 | 360px width, 400% zoom, horizontal table scroll and chart readability | NOT_RUN (manual/device required) |
| VIS-04 | All text/controls/non-text indicators contrast on real used combinations | NOT_RUN (run full WCAG audit) |
| VIS-05 | L1 focus and Escape, L2 Enter/Space/tap/Escape, L3 Back/Escape, focus trap mobile only | Code implemented; NOT_RUN in browser/reader |
| VIS-06 | Reduced-motion/no WebGL, static fallback and low CPU behavior | CSS/static implementation; performance NOT_RUN |
| VIS-07 | Missing-data gap ≠ zero; UCL/LCL named separate from USL/LSL; scene marked synthetic | Source markup; scientific numbers/thresholds NOT APPROVED |
| VIS-08 | Distinguish '연결된 이력', '노출 가능성', '판정 불가'; no root cause claim | Source markup; domain acceptance pending |
| VIS-09 | Broken owner-supplied image path and slow image decode preserve component size and alt meaning | Source handlers; browser NOT_RUN |
| VIS-10 | Prototype self-contained and editable; no network, persistence, authenticated systems or real FAB actions | Source readback, no runtime execution claimed |

**Review and signoff:** A01 product/domain and the project owner; A02 implementation feasibility; A04 accessibility and data representation. High-fidelity source **is delivered**; Figma file, completed clay models, genuine API/functional tests and an approved final visual design **are not delivered/claimed**.

## 6. Open limitations and deliberate non-goals

1. Numerical values are **static synthetic example values** for visual demonstration only, not validated real process measurements or production KPI. Approval of SPC rules / Etch units / Lot linking remains with A01 and A04.
2. Only one visually complete cohesive scenario is explored, rather than seven disconnected feature mockups.
3. Interactive prototype uses DOM button/overlay event handlers; actual framework integration, URL deep-links, full a11y, contrast and mobile/browser testing remain A02/A04 work.
4. Final 3D art is **owner-provided later**, not requested from A03 at this stage. Placeholder emerald SVGs and replacement contract are the deliverable.
5. [PR #7](https://github.com/Junebooky/semi_fab/pull/7) remains REVIEW and updated for white canvas and semantic contracts; merge only after project owner authorization.

## 7. A01 PR #11 P1 corrections — regression and asset test procedures

**Feedback source:** [A01 review #6184254594](https://github.com/Junebooky/semi_fab/pull/11#issuecomment-6184254594). Changes are on the same PR #11 branch, **REVIEW** pending real browser QA. White `#FFFFFF` canvas and emerald-only illustrations remain unchanged.

### P1-01: Alert ID and evidence association

- `DEMO_ALERTS["AL-DEMO-001"]`: ETCH-02 / CH-B / RUN-DEMO-044, fixture `SYN-ETCH-02-01`. Click this row's **상세 보기 →** and verify the evidence page heading, selected alert ID, equipment ID and Run ID all match; navigating back and opening via Equipment nav does not unexpectedly select another alarm.
- `DEMO_ALERTS["AL-DEMO-002"]`: ETCH-01 / CH-A **has no associated evidence fixture**. The second row's **맥락 보기 불가** control is disabled, and its Korean reason explains that this alarm has no separate data; clicking/keyboard activation must **not** open ETCH-02/CH-B evidence. This is deliberate rather than fabricating CH-A sensor values.
- A02 must map all production alerts by stable ID, not row index or default equipment. Never fall back to another equipment's evidence if fixture fails to load.
- Future optional feature: provide a separate `alertId`-specific CH-A freshness page, but only when A01/A02-approved data exists.

### P1-02: L1/L2/L3 concept consistency

The single immutable `KNOWLEDGE_CONCEPTS` object stores `title`, `description`, `insightFormula`, `deepTitle`, `body`, `formula`, `cautions` and `source` for each `conceptId`. Each L2→L3 transition populates all elements via `textContent`; no mixed-topic static L3 paragraphs.

| Action | Expected L2 | Expected L3 |
| --- | --- | --- |
| Command Center → 식각 속도 (hover/focus then click) → L3 | static thickness/time example; not live etch data | Etch rate definition, `30 nm/min` **arithmetic example**, film/time/method cautions, A01 source review pending |
| Equipment evidence → UCL/LCL이란? (hover/focus then click) → L3 | SPC control vs product spec limits; numeric calculation **unapproved** | UCL/LCL definition, formula/signal method **unapproved (no numbers)**, separate caveats/source, **no Etch Rate arithmetic** |
| Close / return / reopen other concept | concept title and content update atomically | no content retained from prior topic; focus returns to origin per design |
| Missing `conceptId` | no misleading fallback concept | A02 production build must show explicit unavailable state |

### P1-03: Plot and alternative table from same source

`DEMO_FIXTURES["SYN-ETCH-02-01"]` is the **sole source** for both SVG circles/polyline segments and accessible `tbody#fixture-rows`, including nulls:

| Virtual point | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7 |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| Synthetic relative signal [a.u.] | 42 | 44 | 47 | 46 | missing (`null`) | missing (`null`) | 57 | 80 |

- All **eight separate** time points must be in the data table; T4 and T5 appear individually as `— · 데이터 없음`.
- SVG renders **no point at null** and **no line bridging T3→T6**. Both SVG descriptive text and data table are populated from the same array.
- Chart must retain the warning **'도식용 가상 한계선 · 통계적 관리한계 미검증'** immediately above the SVG. UCL/LCL are unverified illustrations and not values measured in a fab or valid acceptance boundaries.
- A02 must replace the *entire* fixture with a validated synthetic data adapter before shipping app calculations; don't hand-copy alternative table numbers again.

### P1-04: Replacement image test plan for A04

The two empty config entries in `ASSET_OVERRIDES` intentionally render green static SVG fallbacks. Test **both IDs independently** at desktop and 360px.

| Test | Test input / preparation | Expected visual and technical result |
| --- | --- | --- |
| IMG-01 Default | Both src values remain empty | Two fixed-ratio original emerald fallbacks visible; no external image request |
| IMG-02 Not found | Set wafer src to `"assets/nonexistent-wafer.webp"`, reload | Browser `img.onerror` retains wafer fallback and `role=img` + Korean name; no broken-image icon or wrapper collapse |
| IMG-03 Valid transparent image | Put a permitted test PNG or WebP at `prototypes/assets/test-wafer.png` (path relative to the HTML file) and point wafer override to `"assets/test-wafer.png"` | Wafer fallback replaced **inside existing 1:1 slot**, `contain` and visible 12% safe padding, alt remains on loaded `img`. Chamber slot untouched |
| IMG-04 Valid different aspect | Provide 4:3 wafer and tall transparent chamber samples; repeat per slot | Entire asset stays visible, letterboxed if necessary; no `cover` cropping or altered parent geometry |
| IMG-05 Slow asset | Browser devtools Network → Slow 3G/disable cache; load an actual image | Reserved wrapper dimensions before/after decoding are unchanged; no image-triggered layout jump; document any CLS/layout-shift entries |
| IMG-06 Deliberate 404 recovery | Switch an already valid config path to nonexistent, reload | Only its own placeholder returns; no cross-slot art or alt confusion |
| IMG-07 Responsive | 360px phone and 400% browser zoom; repeat success/error | No overlap with graph, alert text or CTA; fallback stays visible and readable |
| IMG-08 Performance | Run actual browser with reduced motion/data and low-power mobile if available | Core controls work without WebGL or animation; record loading time and any layout shifts |

**Measurement procedure:** open Chrome/Edge DevTools → Performance (Layout Shift regions) and Network (disable cache, select slow connection). Compare the `getBoundingClientRect()` of `[data-asset="illustration.wafer.v1"]` / `[data-asset="illustration.etch-chamber.v1"]` before/after load and capture console/network errors. The absence of a shift in source code is **not** a measured CLS pass. For file URLs, use a simple local static server if asset loading is blocked by browser file-origin policies; never upload private owner images to a public repo without approval.

### P1-05: A04 independent QA scenarios (NOT_RUN)

1. Desktop: select the two alert rows; verify only CH-B has enabled evidence and CH-A cannot reach a wrong chamber.
2. Inspect chart SVG circles/segments and all eight data rows; compare each numeric value, gap, unit and fixture name.
3. Keyboard-only: Tab/Shift+Tab through alert, EKL L1; Enter/Space opens L2; Esc and Back navigate; focus restores.
4. Mobile 360px and 400% zoom: L2/L3 modal focus containment, no sideways page overflow hiding controls; tables can scroll horizontally.
5. Screen-reader names: term button, popup/dialog title, deep panel title/reading order and close; L3 UCL/LCL body must not read any Etch Rate formula.
6. Compare artifact loading/404/fallback, timing, bounding rect and CLS for owner replacement; reduced motion.
7. A01 confirms all domain terminology and placeholder policy; A02 assures future sample source and persistence boundaries.

**Status evidence:** source-level corrections are committed to PR #11. **Browser UI tests, assisted technology tests, actual image load measurements and statistical rule validation have not been run or claimed as PASS.** A04 owns independent execution/results and A01/project owner authorizes merge.

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

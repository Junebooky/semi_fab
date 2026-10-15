# Owner-Replaceable Clay Illustration Asset Slots — A03 v0.1

- **Issue:** [#9](https://github.com/Junebooky/semi_fab/issues/9), correcting original docs in [PR #7](https://github.com/Junebooky/semi_fab/pull/7).
- **Status:** REVIEW. Owner directive **supersedes all previous 'A03 creates final 3D models' assumptions**.
- **Machine-readable source:** [tokens/asset-slots.json](tokens/asset-slots.json) — stable `assetId` and dimensions.
- **Baseline surfaces:** `#FFFFFF` pure white app/card canvas. Emerald palette is **illustration-only**: `#076F5B`, `#0B9F78`, `#16B88A`, `#A4E9C8`, `#DDF8EC`. These are not semantic statuses, charts or thresholds.

## Slot contract: fixed layout, independently replaceable art

| Property | `illustration.wafer.v1` | `illustration.etch-chamber.v1` |
| --- | --- | --- |
| Meaning | Wafer/die **concept** (not actual wafer map) | Synthetic Etch chamber **concept** (not device photo) |
| Location | Command Center hero right; optional EKL learning | Equipment evidence context card; optional EKL process description |
| Desktop reserved slot | **196×196px**, aspect `1 / 1` | **240×192px**, aspect `5 / 4` |
| Phone reserved slot | **132×132px**, aspect `1 / 1` | **160×128px**, aspect `5 / 4` |
| Minimum internal safe area | **12%** inset on all sides | **12%** inset on all sides |
| Sizing rule | `object-fit: contain; object-position:center` | same |
| Transparency | transparent WebP/PNG/AVIF preferred | same |
| Missing image | emerald CSS/inline SVG geometric placeholder + alt-equivalent | same |
| Caption | '개념도 · 축척 아님' | same |
| Image alternative | '웨이퍼와 칩 배열을 단순화한 개념도, 축척 아님' | '식각 챔버를 단순화한 개념도, 축척 아님' |

### Replacement workflow — no CSS edit

1. Owner places licensed custom image file in the approved public assets location (e.g. `apps/web/public/assets/illustrations/wafer-owner.webp`; this is a **proposed future path**, not an existing uploaded image). Filenames are case-sensitive.
2. A02 maps this path to the matching `assetId` through image/asset configuration; keep the same wrapper/aspect/padding. This field is `source:null` until image exists — **no fabricated URLs**.
3. Prefer transparent WebP, then PNG/AVIF as supported. Export at 2× CSS image dimensions for HiDPI (wafer 392px, chamber 480×384px) while visually contained in the fixed slot. Do not stretch to fill the box.
4. If the supplied image has a different silhouette/aspect, `contain` preserves entire visible content and whitespace; avoid `cover`, forced width/height without `object-fit` and crop. If artwork has >12% built-in whitespace, adjust the *image only* with owner's consent, not the layout.
5. If file source is missing, 404, corrupt, delayed or blocked, reserve the same dimensions and display a nonflashing emerald fallback with the same textual meaning. No browser broken-image glyph.
6. Decorative contexts use `alt=""`; instructional contexts use the meaningful Korean `alt` above. Never repeat the same long alt in adjacent text; a real drawing that communicates additional technical details requires a matching textual explanation approved by A01.

### Component pseudocode (framework-neutral)

```tsx
type IllustrationSlotProps = {
  assetId: "illustration.wafer.v1" | "illustration.etch-chamber.v1";
  src?: string | null;   // resolved by external manifest, no hardcoding in layout
  alt: string;           // "" when purely decorative
  variant: "hero" | "context" | "knowledge";
};

function IllustrationSlot({ assetId, src, alt, variant }: IllustrationSlotProps) {
  // Always render a wrapper with stable width/height or CSS aspect-ratio.
  // On missing/unavailable src or <img> error: show accessible fallback SVG/CSS.
  // On successful load: swap image visibility without resizing the wrapper.
  // Use CSS object-fit: contain, object-position:center; no data-driven sizing.
}
```

### CSS implementation guidance

```css
.fab-clay-slot {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  max-width: 100%;
  overflow: hidden;
  padding: 12%;
  background: transparent;  /* the overall UI remains pure white */
}
.fab-clay-slot[data-asset="illustration.wafer.v1"] {
  width: 196px; aspect-ratio: 1 / 1;
}
.fab-clay-slot[data-asset="illustration.etch-chamber.v1"] {
  width: 240px; aspect-ratio: 5 / 4;
}
.fab-clay-slot img,
.fab-clay-slot svg {
  display: block;
  width: 100%; height: 100%;
  object-fit: contain; object-position: center;
}
@media (max-width: 767px) {
  .fab-clay-slot[data-asset="illustration.wafer.v1"] { width: 132px; }
  .fab-clay-slot[data-asset="illustration.etch-chamber.v1"] { width: 160px; }
}
```

The `aspect-ratio` plus CSS width reserves layout space **before resource decode**; alt/fallback still applies. Do not combine a fixed pixel height and additional padding in a way that unintentionally enlarges intrinsic boxes: `box-sizing:border-box` is assumed. The fallback SVG's `viewBox` must be stable and geometry intentionally diagrammatic.

### Performance and fallback

- Above-the-fold hero illustration: eagerly load if resolved and prioritize only if actual LCP warrants it; below-the-fold: `loading="lazy"`, always `decoding="async"` when applicable.
- Proposal budgets: typical slot raster target ≤120 KiB wafer, ≤140 KiB chamber; **measured build/device profiling required**. Provide resolution 1×/2×, no blank layout jump while switching asset.
- SVG placeholders should be inline/accessible; sanitize untrusted SVG and avoid injecting arbitrary external owner-provided SVG markup. Raster URL is safer for unknown supplied files.
- Core analysis remains usable if image never loads; it may also render **no decoration** when users prefer reduced-data modes.
- Touch/keyboard behavior is **not** placed on illustrative image. Meaningful detail must be available in nearby textual link/description.

## A02 handoff and A04 acceptance

| ID | Required acceptance (NOT tested yet) |
| --- | --- |
| SLOT-01 | No final 3D file required or claimed. Placeholder and owner image use exactly the same slot geometry without CSS rewrite. |
| SLOT-02 | Test missing image/404 and slow load: no broken-image glyph, core task usable, no significant layout shift (CLS comparison). |
| SLOT-03 | Desktop ≥1200, mobile 360px and 400% zoom: image never covers chart, badges, filters or table. |
| SLOT-04 | 1:1/5:4 assets with transparent backgrounds and internal negative space fit without stretch or crop; 12% safe margin. |
| SLOT-05 | Alt text and non-text contrast appropriate for instructional/decorative meaning; color never encodes equipment state. |
| SLOT-06 | Reduced motion/data and low-performance device have static fallback; no WebGL or animation requirement. |
| SLOT-07 | Replacing `source` at a single manifest field does not change JSX/CSS structure and updates correct slot only. |

**Scope boundary:** this file is a machine/human design contract, not delivery of final art or high-fidelity screen itself. High-fidelity prototype is a separate Issue #9 deliverable.
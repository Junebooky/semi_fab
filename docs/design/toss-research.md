# A03 UX Research — Toss Official Public Materials

- **Product:** FAB ONE / Toss-inspired Semiconductor Engineering Workspace
- **Issue:** [#4](https://github.com/Junebooky/semi_fab/issues/4) · **Date checked:** 2026-10-15
- **Owner:** A03 Design · **Status:** PROPOSAL / A01 review required
- **Method:** Direct inspection of publicly available official website text and published engineering/design articles. Not an inspection of authenticated products or private design files. No interviews, usability tests, device screenshots, app automation, or accessibility audits were performed.
- **Claim vocabulary:** **FACT** = explicitly stated in the listed public source; **OBSERVED (public)** = layout/navigation/wording accessible on the published page; **INFERENCE** = A03 design interpretation; **PROPOSAL** = FAB ONE-specific decision. Website text extraction is not pixel-perfect visual measurement.

## 1. Public services inspected

| Source and inspected page | Public evidence and type | FAB ONE translation (A03 proposal, NOT a Toss official rule) |
| --- | --- | --- |
| [Toss](https://toss.im/) | **OBSERVED:** Web address served an English-language `/en-us` app-download/company/navigation page to the research client. Insufficient to measure Korean in-app desktop layouts. | Do not derive numeric token values or mobile screens from the home page alone. |
| [Toss newsroom: website redesign (2026-08-18)](https://toss.im/newsroom/toss-new-homepage) | **FACT (official press release):** homepage content arranged narratively; scroll experience introduces services; public-site redesign. | The FAB ONE onboarding/portfolio journey may be story-led, whereas operational dashboards must remain fast-scannable. |
| [Toss Bank homepage](https://www.tossbank.com/) and [business account](https://www.tossbank.com/product-service/savings/account-soho) | **OBSERVED:** Product categories separated in primary navigation; short benefit-first headings, progressive product detail, explicit notices/rates/caveats. | Group major modules by user task; show prominent anomaly summary first and exact units/method details one click below. |
| [Toss Payments homepage](https://www.tosspayments.com/) | **OBSERVED:** Services grouped by '사업 시작', '결제 서비스'; stepwise sign-up section; payment widget admin described as editable without a developer. | Investigations should offer a progressive four-step journey and clear configuration vs evidence-reading separation. Never infer protected merchant administration screen layouts. |
| [Toss Payments developer center](https://docs.tosspayments.com/) (redirects to [developers.tosspayments.com](https://developers.tosspayments.com/)) | **OBSERVED:** Guides, API/SDK references, sandbox, status, FAQ, release notes and a search field are distinct entry points. | EKL Quick → Example → Deep Dive mirrors orientation → reference → troubleshooting; place simulated data status visibly. |
| [Toss Payments payment widget overview](https://docs.tosspayments.com/guides/payment-widget/overview) | **FACT:** Documentation describes a configurable payment UI and developer-independent administration. Page explicitly flags version 1 as no longer updated. | Display knowledge version and deprecation/review status, not a timeless unexplained formula. |
| [Toss Tech home](https://toss.tech/) | **OBSERVED:** Top-level Engineering/Design/Product categories; design and accessibility article series are public. | Research source index and versioned UX/design guidance, not assumed access to internal TDS. |
| [TDS components article, 2024-03-05](https://toss.tech/article/toss-design-system) | **FACT:** TDS team discusses component variants, text enlargement, VoiceOver/Screen Reader focus rules and appearance across contexts. | Specify component states and keyboard/focus behavior as first-class implementation requirements. |
| [TDS guide structure, 2024-04-05](https://toss.tech/article/toss-design-system-guide) | **FACT:** Component guidance improved by consistent ordered reading flow and explicitly stated options. | Hand off every component in contract order: purpose → anatomy → variants → states → keyboard → data → acceptance. |
| [TDS color architecture, 2025-12-15](https://toss.tech/article/43385) | **FACT:** TDS describes target/role/variant semantic tokens and product theme overrides, including different semantic mappings by product. | FAB ONE defines independent semantic roles for action, equipment severity, data freshness and data provenance. Our hex values are original proposals. |
| [TDS table complexity, 2024-06-14](https://toss.tech/article/Various-attempts-to-solve-the-problem) | **FACT:** Public article explains why flexible data tables require explicit cell/table composition rules. | Freeze key columns, explicit numeric alignment, table density variants and stable sorting semantics. |
| [Toss interaction design, 2023-09-07](https://toss.tech/article/interaction) | **FACT:** Interaction team explains reusable motion patterns and common easing specification across platforms. | Use a small number of restrained transition presets; never animate a numerical value into a different apparent measurement. |
| [Toss screen-reader ordering, 2025-06-27](https://toss.tech/article/voiceover_usability) | **FACT:** Official article explores label, role and state, and how announced reading order affects usability. | Use semantic labels and coherent focus order for alert and EKL layers. Not a substitute for FAB ONE accessibility testing. |

## 2. Ten-dimension pattern analysis

| Dimension | Official/publicly supported observation | A03 interpretation (not asserted official Toss token) | Proposed FAB ONE usage |
| --- | --- | --- | --- |
| 01. UI patterns | Payments site groups services and describes staged adoption; TDS articles define reusable cases. | Prefer recognizable focused actions over a tool-dense first view. | '이상 확인 → 증거 확인 → 영향 범위 → 조사 기록' sequential disclosure with a fast expert path. |
| 02. Typography & whitespace | Bank product pages use concise headings, short body blocks and expandable policy details; numeric spacing cannot be confirmed via text extraction. | Large primary heading plus short subtitles; consistent 4px rhythm. | 28/24/20/16/14px original type scale; 4/8/12/16/24/32 spacing token; report as FAB ONE-only proposals. |
| 03. Cards & hierarchy | Bank product sections emphasize one benefit then conditions; TDS guide emphasizes readable component documentation order. | Cards are attention organizers, not universal containers. | Attention summary / evidence / context zones, with table and chart sharing aligned grid. |
| 04. Colors & state | TDS article explicitly uses semantic target/role/variant token taxonomy. | Color meaning may vary by domain and cannot alone encode danger. | Separate severity from freshness; icons, text and timestamps accompany colors. |
| 05. 3D objects | Public product pages include illustrations/images, but source text does not verify their exact shader/material/light/camera. | Use soft 3D as an explanatory metaphor, not a scientific rendering. | Original wafer, die, chamber and etch/deposition clay assets in onboarding/EKL; no 3D in quantitative SPC plots. |
| 06. Motion | Official design article describes motion pattern standardization and easing abstraction. | Motion should support continuity with minimal cognitive load. | 120–220ms opacity/translate transitions, no looping danger animations, reduced-motion fallback. |
| 07. Navigation | Public Payments and developer sites separate task-oriented categories, docs and support. | Layer product tasks with context-specific documentation. | Sidebar by module, global scenario/clock status, contextual EKL beside current analysis. |
| 08. Mobile/Desktop | Public product pages are viewable on web; a doc page references mobile widget. No login-only app surface inspected. | Tablet/mobile should preserve critical content while reducing panels and columns. | Desktop 3-pane max, tablet 2/1-pane, mobile single-column and full-screen EKL detail. |
| 09. Forms/Errors | Docs expose named error codes and errors with human descriptions. | Explaining *why* an action failed is part of product quality. | Error surface has code, impact, recovery action and data-last-seen time. |
| 10. Relevance | Toss publicly emphasizes approachable utility and systematic components. | Consumer-product clarity is transferable, but engineering evidence density is not consumer banking. | Calm Precision: visually warm framing + source-aware, traceable, unambiguous engineering values. |

## 3. Research-derived decisions and constraints

1. **FAB ONE owns its IP:** no Toss/TossBank/TossPayments logos, illustrations, 3D objects, animations, source CSS or font files copied. Inspiration is *principle-level*.
2. **Hierarchy order:** operational status → anomaly/time/provenance → next investigation action → evidence graph/table → definition/assumptions. Do not place 3D artwork over data.
3. **Measure instead of assume:** Color contrast, interaction success, mobile legibility and actual 3D performance are acceptance tests, not properties established by the official articles.
4. **Fact boundary:** The reviewed websites do not establish specific FAB ONE pixel tokens, official Toss spacing rules, hidden mobile product behavior, or proprietary design system internals. All numerical values in [design-system-foundations.md](design-system-foundations.md) are A03-origin candidate values.
5. **Graphics policy:** Production analysis uses non-perspective plots and 2D legends. 3D educational illustrations must carry '개념도 · 축척 아님' where applicable.
6. **Context and privacy:** A Toss product example should never be mistaken for a benchmark proving that the chosen FAB ONE interface improves yield, response times, or operator performance.

## 4. Evidence quality and open research

- **Coverage:** Textual inspection of the five required public domains plus selected named article/product paths; no logged-in UI and no independent quantitative usability study.
- **Visual limitations:** Precise letter spacing, shadows, breakpoints, animations and mobile touch targets have **not** been directly measured; proposal defaults require A04 validation.
- **Planned later validation (not done):** Desktop/mobile prototype walkthrough with one novice and one experienced engineering persona, keyboard-only run, screen-reader checks, chart-reading comprehension, performance on low-power hardware.
- **Decision owner:** A01 approves workflow/domain semantics; A03 owns visual proposals; A02 evaluates implementation; A04 independently tests.
- **References:** Each source URL above is an official public source; this document is analysis, not affiliation or endorsement.

**Review gate:** A01 must approve design direction and module priorities before high-fidelity finalization.
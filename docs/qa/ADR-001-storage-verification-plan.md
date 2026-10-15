# A04 QA Strategy — ADR-001 Local-first Persistence

- **Status:** REVIEW (test strategy only; no runnable implementation or test executions)
- **Date:** 2026-10-15
- **Owner:** A04, independent Quality & Engineering Validation
- **Issue:** [#1](https://github.com/Junebooky/semi_fab/issues/1)
- **Architecture PR reviewed:** [#2](https://github.com/Junebooky/semi_fab/pull/2)
- **Architecture source commit:** `f28fc768e7e3654205e76db7e09c30cee90aa4a4`
- **Current code baseline:** `main` at `57b4dd4405fb01a2154c1ad19437c049c6aae38d`
- **Environment/evidence:** GitHub repository contents, Issue #1, PR #2 metadata, `AGENTS.md`, `ADR-001-local-first.md`, README reviewed through GitHub API. No simulator, application, CI workflow run, production DB, or physical FAB connection tested.
- **Result:** DOCUMENT REVIEW only. All executable test cases below are **NOT_RUN** until A02 delivers an identified immutable commit, setup instructions, fixtures, and testable behavior. The future Mode C security checks are **OUT OF MVP SCOPE**, not implicitly PASS.

## 1. Scope, criteria and release gates

A04 verifies proposed Mode A (static showcase + in-browser simulation), Mode B (local persistent FastAPI/SQLite simulator), and future Mode C (authenticated shared cases/PostgreSQL) against accepted Issue #1 criteria and A01-approved PRD/ADR. Until architecture is approved, test specifications are conditional, not product requirements invented by QA.

**Architecture review gate (PR #2):** A01/product owner must select the MVP mode and publish data classification/storage, retention/export/recovery and public visibility policy; A02 specifies API and schema contracts and migration; A03 confirms accessible explanatory UX; A04 signs off a runnable verification plan. The existing draft has **not** met all these gates.

**Implementation release gate:** Critical/High functional, numerical, data-loss, or security defects unresolved = NO-GO. All critical-path cases must PASS on the exact release SHA; partial coverage, inaccessible environment, or absent CI is reported as BLOCKED/NOT_RUN, never PASS. The owner/A01 decide acceptance and merge.

**Evidence required for each future run:** `test_id | release SHA | mode | environment (OS/browser/runtime versions) | fixture hash | deterministic seed | clock/timezone | command or manual steps | expected | actual | PASS/FAIL/BLOCKED/NOT_RUN | log/screenshot link | ticket`. Never record synthetic expected numbers as results of executed application tests.

## 2. Test matrix (not executed)

| ID | Priority | Mode | Test and inputs | Expected acceptance behavior | Status |
|---|---|---|---|---|---|
| P-01 | High | A/B | Same scenario + seed + initial snapshot + fixed clock executed twice after reset | Byte-identical or contract-defined equivalent event order, timestamps, measurement output, and lot impact (allow only explicitly documented platform rounding) | NOT_RUN |
| P-02 | High | A/B | Change seed; repeat test; change generator version | Same seed stable; different seeds produce controlled differences; version/provenance included in dataset metadata | NOT_RUN |
| P-03 | High | B | Crash/kill during multi-row incident + lot update | Atomic rollback or commit, no partial references; SQLite integrity/FK checks pass | NOT_RUN |
| P-04 | High | B | Stop/restart app and remove/restore persistence volume | Documented durability and restore path; unavailable/corrupt database produces explicit error, not silent blank healthy state | NOT_RUN |
| P-05 | High | B | Two competing writes to same investigation; lock contention | Deterministic conflict policy, no lost update; transaction/busy timeout or conflict response documented | NOT_RUN |
| P-06 | High | B | Insert wafer with missing lot; chamber with wrong equipment; disable/reopen connection | Reject orphan/bad association on **every** connection using enforced FK/CHECK/UNIQUE constraints | NOT_RUN |
| P-07 | High | A/B | Duplicate event ID, repeated import, out-of-order timestamp, missing event field | Idempotent handling or explicit validation error; chronological display and event identity are not corrupted | NOT_RUN |
| P-08 | High | A/B | CSV/Parquet malformed schema, wrong units, nulls, duplicate rows, hostile CSV formula strings | Schema/version/unit checks and provenance; errors observable, unsafe export neutralized | NOT_RUN |
| P-09 | Medium | A | IndexedDB note save/reload; storage quota exhaustion; blocked/private storage | Explicit local-only disclosure; clear feedback and export/import/restore checks, never claim auto cloud backup | NOT_RUN |
| P-10 | High | A | Clear site data, browser switch, two devices with different notes | Data loss/sync limitations communicated **before reliance**; no false cross-device sync or audit claims | NOT_RUN |
| P-11 | High | A/B | Reload/reset then compare active simulation run and stored investigations | Reset scope explicit; generated data and user-entered investigation state not unintentionally conflated | NOT_RUN |
| P-12 | High | A/B | Untrusted Markdown/MDX and sensor metadata with script/HTML payloads | No active XSS/injection; safe rendering and escaping by trust boundary | NOT_RUN |
| P-13 | High | A/B | Inspect public bundles/logs, server settings and fixture headers | No production secrets, confidential real FAB data or protected personal data; synthetic/public provenance visible | NOT_RUN |
| P-14 | High | A/B | Demo role switch, direct API calls, write endpoint from untrusted origin | Simulated roles never presented as secure RBAC; if any write API exposed, server-side permissions and CORS/CSRF protections verified | NOT_RUN |
| P-15 | High | C (future) | Two authenticated users, cross-user IDs, direct REST access, RLS bypass attempts | Row-level isolation, server-side authorization and audit; negative cases denied | NOT_RUN |
| P-16 | High | C (future) | Concurrent edits, multi-device sync, migrations and rollback | Version/conflict semantics, persisted audit, restore tests meet future Mode C criteria | NOT_RUN |
| P-17 | High | A/B | SPC rule violation in synthetic sensor stream | Correct rule/limits/time window; warning says *suspected anomaly*, not confirmed defective lot or physical cause | NOT_RUN |
| P-18 | High | A/B | Knowledge card formula id, code function and fixture link | Same version, units, assumptions, source and rounding; content never contradicts computed result | NOT_RUN |
| P-19 | Medium | A/B | Keyboard/touch access to cards and alerts; narrow viewport; reduced motion; color contrast | Focus, meaningful text alternatives, state not conveyed by color alone, readable units/legends and essential controls | NOT_RUN |
| P-20 | Medium | A/B | Offline/reconnect, reload and partially loaded sensor data | Freshness/timezone/source and missing-data states displayed, never quietly rendered as normal/zero | NOT_RUN |

## 3. Independent reference calculations (specification fixtures, not product test results)

All reference fixtures should be stored with unit, source, method, tolerances, and algorithm version. Check actual implementation only after A02 provides one.

| Calculation | Input | Independent expected result | Required invalid/boundary checks |
|---|---|---|---|
| Die Yield | 96 known-good counted dies / 100 eligible counted dies | `0.96 = 96%` | Denominator `0`, negative counts, good > total, missing/untested/excluded dies; define eligible die rule |
| Etch Rate | thickness before `200 nm`, after `140 nm`, time `2 min` | `(200-140)/2 = 30 nm/min` | Zero/negative time, thickness increase, mixed Å/nm/µm; define signed deposition vs invalid input |
| Cp / Cpk reference *only if sample standard deviation is the approved estimator* | values `[9,10,11]`, USL `13`, LSL `7`; mean `10`, sample `s=1` | `Cp=(13-7)/(6*1)=1`; `Cpk=min((13-10)/(3*1),(10-7)/(3*1))=1` | Zero sigma, n < 2, missing spec limit, non-normal data, unstable/uncalibrated process; explicitly choose within-vs-overall sigma and subgroup estimator before product acceptance |
| Availability (*only if A01 approves definition*) | uptime `90 min`, downtime `10 min` | `90/(90+10)=90%` | Zero observation interval; planned-vs-unplanned downtime inclusion; never label this simplified metric OEE |

**Statistical guardrails:** Control limits (SPC) are not specification limits (Cp/Cpk). A control-chart signal alone is neither confirmed wafer scrap nor a root-cause attribution. Statistical assumptions, estimator, sample/subgroup size and rounding must be visible in Engineering Knowledge Layer.

## 4. Storage and determinism contracts A02/A01 must specify

1. **Mode selection and write boundary:** Explicit MVP mode, what is immutable demo data versus editable personal state, and where incident edits are saved in each mode. Mode A `read-only` means read-only *shared dataset*, not necessarily no local UI state; state the distinction.
2. **Scenario replay:** Seed is insufficient alone. Pin PRNG and algorithm version, fixture checksum, unit schema, snapshot/reset semantics, clock/timezone, stable event ordering and rounding/precision contract. Define deterministic external I/O behavior.
3. **SQLite integrity:** Enforce `PRAGMA foreign_keys=ON` on each connection, PK/UNIQUE/CHECK/NOT NULL rules, transactions, WAL/rollback policy, contention policy, file path and persistent-volume backup/restore procedure. Ensure safe deployment (no ephemeral serverless SQLite write DB).
4. **Data loss and privacy:** IndexedDB is not durable backup; specify export/import formats and version validation, storage quota/privacy mode behavior, reset confirmation and public synthetic vs research vs live-data labeling.
5. **Concurrency and history:** Mode B is not Mode C; define local simultaneous edits, conflicts and revision IDs. Never advertise centralized immutable approval/audit or real RBAC until Mode C is implemented and tested.
6. **Untrusted data:** Validate CSV/Parquet shape, timestamp units, metadata and formula/text rendering, sanitize exported CSV cells, avoid storing credentials in fixtures or client bundles.
7. **Migration contract:** If/when Mode C is authorized, define SQLite→PostgreSQL mapping for IDs, timestamps, FK and event history, transactional import, rollback, RLS policies, auth, and reconciliation checks.

## 5. Review findings for PR #2 (document inspection, not runtime bug claims)

- **QA-F01 (High, open / requirements gap):** A deterministic seed is specified, but the reproducibility contract does not pin RNG algorithm/version, source fixture, simulation clock, ordering and reset rules. Specify these before P-01/P-02.
- **QA-F02 (High, open / requirements gap):** SQLite is described as persistent, without explicit backup/restore, crash consistency, constraint enforcement per connection or concurrent-edit policy. Define before P-03 through P-07.
- **QA-F03 (Medium, open / requirements gap):** IndexedDB export/import is mentioned, but data-loss recovery UX and schema/version guarantees are undefined. Define before P-09/P-10.
- **QA-F04 (High, open / release claim risk):** "Role switcher" is documented as non-auth, but mode-specific write privileges and any network API access remain undefined. Disallow genuine audit/permission claims until verified; detail Mode C migration gate.
- **QA-F05 (Medium, open / domain wording):** Replace "Outlier alerts suggest potential causality" with "Outlier alerts justify investigation; they do not establish causality" to avoid suggesting alerts provide causal evidence.
- **QA-F06 (High, open / numerical spec gap):** ADR calls for tested calculations but has no approved estimator/denominator/tolerance/unit contracts. These are necessary to test Cpk, die yield and etch rate without ambiguous PASS decisions.

**Disposition:** The hybrid proposal is testable in principle; **request revisions/acceptance criteria clarification** before architecture approval. This is not a software FAIL: product test execution has not occurred. PR #2 remains draft, Issue #1 open, and only A01/owner can authorize merge.

## 6. Planned execution & defect evidence protocol

After A02 supplies commit SHA, setup commands, representative signed/hashed fixtures and expected schemas:

1. Run automated arithmetic reference tests (Vitest/Pytest) and record raw results.
2. Run SQLite schema/FK/integrity/rollback and repeated import tests in temporary local DB.
3. Run seeded simulation 3+ times with clean resets and compare normalized outputs; include varying seed and platform/environment report.
4. Run Playwright desktop/mobile, keyboard/a11y and IndexedDB loss/export/import cases.
5. Execute security negative tests on a disposable test environment only (never live/unauthorized endpoints).
6. Report failures with minimal reproduction, fixture, SHA, severity, expected vs observed, logs and links; run targeted + full regression after fix.
7. Separate `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN` per test case; do not infer PASS from code review or A02 self-report.

**Current execution counts:** 0 PASS / 0 FAIL / 0 BLOCKED / **20 NOT_RUN**. Six design/requirements findings are open. No CI workflows found for PR head, and no executable implementation inspected. No real data or DB mutated.

# FAB ONE Demo Release Candidate Specification (BUILD-14)

## 1. 개요 (Executive Summary)

**BUILD-14 FAB ONE Demo Release Candidate**는 반도체 식각 공정 이상 감지 및 엔지니어링 분석 플랫폼의 최종 출시 후보(Release Candidate) 버전입니다.
본 릴리즈에서는 이전 빌드(BUILD-13)에서 도입된 조사 사례 보관소(Casebook)와 Mode B 실시간 공정 연동의 조사 격리(Isolation) 결함을 보완하고, 3-Phase 비동기 스냅샷 일치성 검증, 전 화면 맥락 보존(Cross-Screen Lineage), 듀얼 카드 안내 UX, 그리고 종합 CI/E2E 회귀 테스트 슈트를 완비했습니다.

---

## 2. 핵심 작업 스트림 (Workstreams)

### Workstream A: P0 조사 데이터 격리 & 비동기 일치성 (Isolation & Robustness)

1. **과거 조사 기록 읽기 전용 모달 격리 (`#ws-historical-case-modal`)**:
   - 엔지니어링 워크스페이스는 현재 활성 Run (`mode`, `runId`)과 일치하지 않는 과거 Casebook 레코드 로드 시 활성 에디터를 덮어쓰지 않습니다.
   - 격리된 전용 읽기 전용 모달(`#ws-historical-case-modal`)로 띄우며, `#ws-btn-close-historical-case` 및 `#ws-btn-return-active-workspace`를 통해 현재 에디터 내용(작성 중인 가설, 조치사항, 메모)을 원형 그대로 보존합니다.
   - 동일 Run/모드 레코드인 경우에만 활성 에디터로 안전하게 재로드(`"동일 Run 에디터로 불러오기 ↩"`)를 허용합니다.

2. **서버 과거 공정 Run 아카이브 스냅샷 뷰어 (`GET /api/v1/demo/runs/{run_id}`)**:
   - 과거 서버 Run 목록에서 이전 Run 조회 시 URL 변경(`?run_id=OLD`)을 발생시켜 409 Mismatch 에러를 유발하던 문제를 개선했습니다.
   - 전용 읽기 전용 엔드포인트 `GET /api/v1/demo/runs/{run_id}`를 호출하여 패널(`#ws-historical-run-panel`)에서 센서 계측치 스냅샷, FDC 알람 정보, 25매 웨이퍼 노출 분포 현황을 격리 조회합니다.

3. **비동기 3-Phase 스냅샷 재검증 (3-Phase Async Snapshot Recheck)**:
   - Mode B 워크스페이스 진입 시 `GET /api/v1/demo/summary (1차)` -> `GET /api/v1/demo/investigation` -> `GET /api/v1/demo/summary (2차)`의 3단계 검증을 수행합니다.
   - 네트워크 지연 중 백엔드 활성 Run이 변경(`summary1.active_run_id !== summary2.active_run_id`)된 경우, 이전 런의 파편 데이터를 커밋하지 않고 즉시 409 전이 충돌(Transition Conflict) 오류 배너를 띄우며 보드를 잠금(Fail-Closed) 처리합니다.

4. **Casebook v1 엄격 스키마 검증 및 Markdown 탈출**:
   - 모든 Casebook 레코드에 `schemaVersion: 1`을 명시하고, 비정상 또는 오염된 백업 파일 가져오기 시 `validateAndImportCasebookRecords`를 통해 유효한 레코드만 필터링/가져옵니다.
   - 사용자 메모 입력값의 파이프(`|`) 및 줄바꿈(`\n`) 문자가 Markdown 보고서 표를 깨뜨리지 않도록 `escapeMarkdownTableAndNotes` (`\\|`, `<br/>`) 필터링을 적용합니다.

---

### Workstream B: P1 데모 여정 및 진실 계약 조화 (Demo Journey & Truth Contract)

1. **7개 화면 상호 내비게이션 맥락 보존 (`buildCrossNavUrl`)**:
   - 홈, 웨이퍼 추적성, 커맨드 센터, 설비 인텔리전스, FAB 시뮬레이션, 엔지니어링 워크스페이스, 가이드 투어 전 화면에서 탭 전환 시 `mode=B&run_id=...` 또는 `seed=...` 파라미터를 누락 없이 전달합니다.

2. **홈 화면 듀얼 카드 안내 (Dual-Card Demo Chooser)**:
   - 홈 화면 상단에 Mode A 8단계 가이드 투어 카드(`#hero-guided-tour-card`, `#btn-start-guided-tour`)와 Mode B 실시간 연동 조사 카드(`#hero-live-connected-card`, `#btn-start-live-connected-case`)를 병렬 배치하여 사용 목적에 맞는 직관적인 시작 경로를 제공합니다.

3. **센서 일탈값 진실 계약 동적 조화**:
   - Mode A에서는 `getModeAT7ExcursionValues`를 통해 시드별 일탈 센서값(Pressure ~168.5 mTorr, RF Power ~1820 W)을 표시하고, Mode B에서는 백엔드 미관측 센서에 대해 가짜 수치를 날조하지 않고 `미제공 (N/A)`으로 정직하게 표기합니다.

---

### Workstream C: P1 CI/QA & 통합 회귀 테스트 (CI/QA & Regression Suite)

1. **FastAPI 백엔드 단위 테스트**:
   - 16건의 단위 테스트 전체 통과 (`python3 -m unittest services/api/tests/test_api.py`).
   - `test_16_historical_run_snapshot`: 과거 런 스냅샷 조회, 물리 센서 리스트, FDC 알람, 웨이퍼 분포 및 404 Fail-Closed 검증 완료.

2. **웹 단위 및 계약 테스트**:
   - 88건의 단위 및 계약 테스트 전체 통과 (`npm test` in `apps/web`).
   - BUILD-14 계약 테스트 (a)~(g) 신규 추가 및 검증 완료.

3. **Playwright E2E 통합 테스트**:
   - 15건의 브라우저 E2E 테스트 전체 통과 (`npm run test:e2e` in `apps/web`).
   - Mode A Guided Tour, Mode B Connected Investigation, Run Lineage Mismatch, Standby Alert Isolation, Cross-Run Isolation (Test 5), Historical Server Run Snapshot (Test 6) 포함.

4. **Next.js 프로덕션 빌드 검증**:
   - `npm run build`를 통한 10개 정적 페이지 빌드 및 TypeScript 정적 타입 검증 완료.

---

## 3. 도메인 불변식 (Domain Invariants)

1. **인간 엔지니어 최종 판단 원칙**:
   - 시스템은 통계적 이상(Excursion) 및 노출 후보군(Candidate Exposed)을 엔지니어에게 제시할 뿐, 설비 챔버의 자동 제어 또는 결함 확정 판정을 임의로 수행하지 않습니다.
2. **Excursion ≠ Defect**:
   - 설비 센서 일탈 노출이 웨이퍼의 물리적 결함을 단정하지 않으며, 추가 계측 대상 후보군으로 분류됩니다.
3. **MISSING ≠ 0**:
   - 센서 계측 누락 또는 미수신 상태는 정상 0 수치로 대체될 수 없으며, 결측(`null` / `MISSING`)으로 명시 처리됩니다.
4. **In-Memory & Storage 격리**:
   - 백엔드 공정 런 데이터는 인메모리 휘발성 데이터이며, 브라우저 케이스북 저장은 도메인 원천 이벤트 로그를 오염시키지 않는 클라이언트 전용 저장소(`localStorage`)에 격리 보관됩니다.

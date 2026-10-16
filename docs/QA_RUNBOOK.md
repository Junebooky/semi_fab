# FAB ONE QA Runbook & 통합 안정화 가이드 (BUILD-10)

## 1. 개요 (Overview)

본 문서는 FAB ONE 반도체 식각 공정 지능화 데모의 **BUILD-10 통합 안정화(Integration Stabilization), Run 계통성 보존, 그리고 QA 인계를 위한 공식 운영 가이드북**입니다.

- **대상 레포지토리:** `Junebooky/semi_fab`
- **기준 이슈:** Issue #30 (BUILD-10 공식 업무 배정)
- **베이스 커밋:** `b3c7dbb2d50d63c04b7dbccf1a2a675f11b96c87` (PR #29 HEAD)
- **개발 브랜치:** `a02/build-10-integration-stabilization`
- **타겟 베이스 브랜치:** `a02/build-09-guided-demo`
- **듀얼 아키텍처:**
  - **Mode A (독립 합성 시뮬레이션):** 백엔드 없이 브라우저 자체 난수 시드 기반 결정론적 합성 데이터로 100% 동작.
  - **Mode B (실시간 API 연동):** Python FastAPI(`:8000`) 서버와 실시간 통신 동기화.

---

## 2. 개발 및 테스트 실행 명령어

### 2.1 사전 요구사항
- Node.js: `v18.0.0` 이상 (LTS 권장)
- Python: `3.10` 이상

### 2.2 로컬 프론트엔드 실행 (Next.js)
```bash
# apps/web 디렉터리로 이동 후 의존성 설치 및 개발 서버 실행
cd apps/web
npm install
npm run dev
```
- 접속 주소: `http://localhost:3000`

### 2.3 백엔드 API 서버 실행 (선택 사항, Mode B 검증 시)
```bash
# 프로젝트 루트(semi_fab)에서 실행
python3 -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000 --reload
```
- 헬스체크: `http://localhost:8000/api/v1/health`
- Swagger 문서: `http://localhost:8000/docs`

### 2.4 테스트 실행 명령어
```bash
# 1. 프론트엔드 계약 및 컴포넌트 단위/통합 테스트 (Node test runner, 76 tests)
cd apps/web
npm test

# 2. 백엔드 API 단위 테스트 (Python unittest, 14 tests)
cd ../..
python3 -m unittest services/api/tests/test_api.py

# 3. 프론트엔드 프로덕션 정적 빌드 검증 (10개 라우트 정적 생성)
cd apps/web
npm run build

# 4. Playwright 실제 브라우저 E2E 스모크 테스트 (BUILD-11 + BUILD-12, 9 tests)
cd apps/web
npm run test:e2e
```

### 2.5 Playwright 브라우저 E2E 실행 환경 안내
- **설치 및 사전 준비:**
  ```bash
  cd apps/web
  npm install
  npx playwright install chromium
  ```
- **자동 웹서버 기동:** `playwright.config.ts`의 `webServer` 설정에 의해 `npm run dev`(`http://localhost:3000`)가 자동 실행 및 재사용됩니다.
- **테스트 범위:** 8단계 Guided Tour 전체 여정 클릭 검증, 시드 보존 반례(seed 20261016), 미지원 알람 데이터 격리 락 반례(AL-STANDBY-001), 화면 간 T7 센서 계측치 정합성 검증.
- **결과 아티팩트:** 실패 시 `apps/web/test-results/`에 스크린샷, 비디오, 트레이스(`.zip`)가 자동 저장되며, `npx playwright show-trace <trace.zip>`으로 재생 가능합니다.


---

## 3. 시작 시드 및 표준 검증 URL

FAB ONE은 시드(Seed) 기반 결정론적 합성 데이터 계약을 준수합니다. 기본 검증 기준 시드는 **`20261015`** 입니다.

| 화면 구분 | 검증 진입 URL | 주요 파라미터 및 계통성 |
| :--- | :--- | :--- |
| **가이드 투어 (시작점)** | `http://localhost:3000/demo-tour?step=INTRO&seed=20261015` | `step=INTRO`, `seed=20261015` |
| **홈 (FDC 모니터링)** | `http://localhost:3000/?alert=AL-DEMO-015&investigation=true&seed=20261015&tourStep=INTRO` | `alert=AL-DEMO-015`, `tourStep=INTRO` |
| **FAB 시뮬레이션** | `http://localhost:3000/fab-simulation?seed=20261015&tourStep=SIMULATE` | 2.5D 타임라인 레이아웃, `tourStep=SIMULATE` |
| **FDC 커맨드 센터** | `http://localhost:3000/command-center?seed=20261015&alert=AL-DEMO-015&tourStep=ALARM` | 알람 큐 정렬, `tourStep=ALARM` |
| **설비 인텔리전스** | `http://localhost:3000/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=20261015&tourStep=SENSOR` | OES T4/T5 결측선, `tourStep=SENSOR` |
| **웨이퍼 이력 추적성** | `http://localhost:3000/traceability?wafer=W-08&seed=20261015&tourStep=TRACE` | W-08 후보군 격리, `tourStep=TRACE` |
| **엔지니어링 워크스페이스** | `http://localhost:3000/engineering-workspace?alert=AL-DEMO-015&seed=20261015&tourStep=WORKSPACE` | 3단 보드 연동, `tourStep=WORKSPACE` |

---

## 4. 3~5분 표준 Guided Demo 투어 시퀀스

가이드 투어(`http://localhost:3000/demo-tour?step=INTRO&seed=20261015`)에서 시작하여 8단계를 순차적으로 진행합니다:

1. **Step 1: INTRO (전체 여정 개요)**
   - 8단계 안내와 5대 핵심 도메인 원칙(Excursion ≠ Defect, MISSING ≠ 0 등) 확인.
   - `다음 단계 (SIMULATE) ➔` 클릭.
2. **Step 2: SIMULATE (가상 FAB 공정 타임라인 시연 - 2.5D 레이아웃)**
   - FOUP 로드포트 도킹 → 진공 이송 → 식각 공정 스텝(T0~T6) 확인.
   - `FAB 시뮬레이션 화면 열기 ↗` 클릭 → 화면 상단 `#tour-return-banner` 확인 후 `#btn-return-to-tour`로 투어 복귀 (단계 유지 확인).
3. **Step 3: EXCURSION (Step T7 복합 센서 공정 일탈)**
   - T7 스텝에서 OES 상대 신호(80.0 > UCL 65.0), 챔버 압력(168.5 mTorr), RF 전력(1820 W) 급증 확인.
4. **Step 4: ALARM (FDC 커맨드 센터 실시간 경보 감지)**
   - `FDC-RULE-SPC-UCL-01` 규칙 트리거 및 활성 알람 `AL-DEMO-015` (CRITICAL) 확인.
   - `FDC 커맨드 센터 열기 ↗` 클릭 후 상단 복귀 배너 확인.
5. **Step 5: SENSOR (설비 인텔리전스 센서 원본 시계열 검증)**
   - 연속 센서(압력/RF)의 unbroken 연결선과 광학 센서(OES)의 T4/T5 결측(MISSING ≠ 0) 분절선 확인.
6. **Step 6: TRACE (웨이퍼 단위 이력 추적성 및 노출군 분류)**
   - 25매 FOUP 중 W-01~07 정상 공정 완료 확정군(`CONFIRMED_EXPOSED`)과 W-08~12 잠재 영향 후보군(`CANDIDATE_EXPOSED`) 격리 확인.
7. **Step 7: WORKSPACE (엔지니어링 워크스페이스 가설 검증 및 조치 점검)**
   - 4건의 증거 항목, 3대 후보 가설 상태 순환(`UNVERIFIED` → `SUPPORTED_FOR_REVIEW`), 4대 조치 체크리스트 확인.
8. **Step 8: FINISH (가이드 투어 완료 및 엔지니어링 상황 판단 요약)**
   - 데모 내 5대 엔지니어링 상황 판단 카드 확인 및 처음부터 다시 시작 ↺ 버튼 검증.

---

## 5. 투어 복귀 계통성 검증 체크리스트 (Tour Return Lineage)

BUILD-10에서 해결된 핵심 결함인 **투어 단계 리셋 문제**를 검증합니다:

- [ ] **투어 복귀 배너 노출:** `/demo-tour`에서 링크를 타고 진입한 5개 화면(`/?...`, `/fab-simulation?...`, `/command-center?...`, `/equipment-intelligence?...`, `/traceability?...`, `/engineering-workspace?...`) 상단에 `#tour-return-banner`가 표출되는지 확인.
- [ ] **출발 단계 보존 복귀:** `#btn-return-to-tour` 클릭 시 URL에 `step=${tourStep}`이 유지되어 `INTRO`로 초기화되지 않고 직전 단계 카드와 진행 바(Progress Bar)가 유지되는지 확인.
- [ ] **다음 단계 직행:** `#btn-continue-next-tour-step` 클릭 시 다음 단계로 바로 이동하는지 확인 (`FINISH` 단계에서는 버튼 숨김).
- [ ] **상단 네비게이션 탭 연계:** 7개 탭 중 `가이드 투어 (Demo Tour)`를 클릭해도 `tourStep`이 보존되어 투어 진행 흐름이 끊기지 않는지 확인.

---

## 6. Engineering Workspace 미지원 알람 fail-safe 격리 검증

비활성 또는 타 런의 알람이 요청되었을 때 타 런의 데이터를 허위로 매핑하지 않는 데이터 격리 기능입니다:

- [ ] **미지원 알람 진입:** `http://localhost:3000/engineering-workspace?alert=AL-STANDBY-001&seed=20261015` 진입.
- [ ] **경고 배너 노출:** 상단에 `#unsupported-alert-banner`가 표출되는지 확인.
- [ ] **3단 보드 격리 락:** 3-Column 인터랙티브 보드가 완전히 숨겨지고 `#ws-unsupported-lock-panel` 잠금 패널이 노출되는지 확인.
- [ ] **상태 배지 변경:** 상단 배지에 `Alert: AL-STANDBY-001 (지원 안 됨 / 비활성)`으로 표시되는지 확인.
- [ ] **활성 알람 복구:** `#ws-btn-switch-active-alert` 또는 `#ws-btn-switch-active-alert-lock` 클릭 시 활성 알람(`AL-DEMO-015`)으로 정상 전환되어 보드가 잠금 해제되는지 확인.

---

## 7. 기술 부채 및 알려진 한계 (Known Debt, Issue #23 연계)

A01 기획 에이전트의 전체 기능 완성 우선 및 기술 부채 등록 방침(Issue #23)에 따라 다음 사항은 현 단계의 알려진 제약 사항입니다:

1. **상태 휘발성 (In-memory volatile state):** 브라우저 새로고침 시 워크스페이스의 가설 상태, 체크리스트, 메모는 초기화됩니다. (양산 MES/FDC 서버 영속성 미제공)
2. **도메인 한계 명시:**
   - 통계적 관리한계 초과(Excursion)는 센서 이상 관측일 뿐 완제품 불량(Defect) 확정이 아닙니다.
   - CANDIDATE_EXPOSED는 잠재 영향 검토 후보군이며 결함 확정 판정이 아닙니다.
   - OES T4/T5 결측은 광학 셔터 관측 실패일 뿐 0으로 대체되지 않습니다.
   - 실제 반도체 팹의 설비/로봇 제어 명령이나 MES 홀드 명령은 발행되지 않습니다.

---

## 8. QA 판정 및 역할 분담 원칙 (QA Policy)

- **개발자 자체 검증 (Author Verification):**
  - 개발 에이전트(A02)는 단위 테스트(`npm test`, `unittest`), 빌드 검증(`npm run build`), 정적 계약 검증, 그리고 Playwright E2E 스모크 테스트(`npm run test:e2e`)를 자체 실행하고 결과를 PR 코멘트에 상세 보고합니다.
- **독립 QA 판정 (A04 QA Agent Policy):**
  - 독립 브라우저 런타임 QA는 본 PR 단계에서 공식적으로 **`NOT_RUN`** 상태를 유지합니다.
  - 본 `QA_RUNBOOK.md`는 향후 독립 QA 에이전트 또는 엔지니어가 E2E 테스트 및 인수 검사를 수행할 수 있도록 준비된 공식 인계물입니다.

---

## 9. BUILD-11 Playwright 브라우저 E2E 테스트 명세 및 합성 데이터 정합성

### 9.1 테스트 시나리오 구성 (`apps/web/e2e/guided-demo-journey.spec.ts`)
1. **8단계 Guided Tour 전체 사용자 여정 클릭 테스트:**
   - 홈(`/`) 진입 후 `#btn-start-guided-tour` 클릭으로 시작.
   - `INTRO` → `SIMULATE` → 대상 화면 진입 및 `#btn-return-to-tour`로 투어 복귀 (단계 보존).
   - `EXCURSION` (대표값 ~80.0 a.u., ~168.5 mTorr, ~1820 W 대조) → `ALARM` → 커맨드센터 복귀.
   - `SENSOR` → 설비 인텔리전스 복귀 → `TRACE` → W-08 추적성 복귀.
   - `WORKSPACE` → 엔지니어링 보드 가설 순환 클릭 → 복귀.
   - `FINISH` → 5대 핵심 엔지니어링 판단 요약 패널(`#tour-completion-summary-panel`) 검증 및 이전 단계 역방향 이동.
2. **반례 1: 비기본 시드(`seed=20261016`) 맥락 보존:**
   - `/demo-tour?step=TRACE&seed=20261016`에서 W-08 대상 화면 진입 후 투어 복귀 시 URL의 `seed=20261016` 및 `step=TRACE`가 탈락 없이 보존되는지 검증.
3. **반례 2: 미지원 알람 데이터 격리 락 (`#ws-unsupported-lock-panel`):**
   - `/engineering-workspace?alert=AL-STANDBY-001&seed=20261015` 진입 시 3단 보드가 렌더링되지 않고 격리 잠금 패널이 노출되는지 확인.
   - `#ws-btn-switch-active-alert-lock` 클릭 시 활성 알람(`AL-DEMO-015`)으로 정상 전환되어 보드가 복구되는지 검증.
4. **화면 간 센서 계측치 정합성 및 도메인 불변식 검증:**
   - 공통 헬퍼 `getModeAT7ExcursionValues(seed)`를 통해 Fab Simulation의 Step 5(T7_EXCURSION) 계측치와 Engineering Workspace EVI-02 카드의 계측치(167.1 mTorr, 1817.9 W)가 정확히 일치함을 검증.
   - 모든 화면에서 `Excursion ≠ Defect`, `MISSING ≠ 0`, `CANDIDATE_EXPOSED` 도메인 면책 표기 확인.

### 9.2 실패 아티팩트 및 트레이스 분석
- 테스트 실패 시 `apps/web/test-results/`에 다음 아티팩트가 생성됩니다:
  - `test-failed-1.png`: 실패 시점 스크린샷
  - `video.webm`: 전체 인터랙션 브라우저 녹화 영상
  - `trace.zip`: Playwright 상세 DOM 스냅샷 및 네트워크 트레이스
- 트레이스 뷰어 실행:
  ```bash
  npx playwright show-trace apps/web/test-results/<디렉터리>/trace.zip
  ```

---

## 10. BUILD-12 Mode B 통합 조사 및 Engineering Case Report 내보내기

### 10.1 기능 개요
BUILD-12는 화면 간 단절 없는 조사 흐름(Connected Investigation), FastAPI 백엔드 연동(Mode B), 그리고 브라우저 기반 의사결정 기록 내보내기(Engineering Case Report Export)를 제공합니다:

1. **화면 간 조사 맥락 전파 (Connected Investigation Lineage):**
   - 조사 컨텍스트(`mode`, `run_id`, `session_id`, `lot_id`, `alert_id`, `seed`)를 화면 간 상호 전달.
   - 각 화면에 `#*-btn-go-workspace` 딥링크 CTA 제공:
     - 커맨드 센터: `#cc-btn-go-workspace`
     - 설비 인텔리전스: `#ei-btn-go-workspace`
     - 웨이퍼 추적성: `#trace-btn-go-workspace`
     - 홈 조사 패널: `#home-btn-go-workspace`
2. **Mode B 엔지니어링 워크스페이스 실시간 연동 (FastAPI Integration):**
   - `/api/v1/demo/summary` 선행 조회를 통한 `active_run_id` 발견 및 출처 확인.
   - `/api/v1/demo/investigation?alert_id=...` API 응답 데이터를 4대 증거 항목(`EVI-01` ~ `EVI-04`)으로 자동 매핑.
   - 도메인 플래그 보존 (`MISSING ≠ 0`, UCL 65.0, `SUSPECT`, `CRITICAL`).
   - 자동 근본 원인 단정 배제 (인간 엔지니어 가설 검토 지원용 증거 보드로 동작).
   - Fail-Closed 에러 경계: 백엔드 HTTP 4xx/5xx 또는 연결 오류 시 이전 캐시를 즉시 비우고 `#ws-mode-b-error-banner` 오류 패널 표출.
3. **Engineering Case Report 내보내기 (`#ws-btn-export-case-report`):**
   - 외부 PDF/무거운 라이브러리 없이 순수 브라우저 Markdown 파일 다운로드 (`case-report-${runId}-${date}.md`).
   - 보고서 포함 내용:
     - 조사 개요 (Run ID, Alert ID, 장비/챔버, 발생 시각, 조사 모드)
     - 센서 계측치 요약표 (RF Power, Pressure, OES Signal 등)
     - 25매 웨이퍼 노출군 분류 (CONFIRMED_EXPOSED vs CANDIDATE_EXPOSED)
     - 가설 검토 상태 및 연계 증거 요약
     - 조치 체크리스트 이행 현황
     - 엔지니어링 메모 기록
     - 도메인 불변식 및 휘발성 경고 (`Excursion ≠ Defect`, `MISSING ≠ 0`, `In-memory Volatile`)
   - 잠금 가드: 미지원 알람(`AL-STANDBY-001`) 또는 데이터 로드 실패 시 버튼 비활성화(`disabled`, `aria-disabled="true"`).

### 10.2 Playwright E2E 검증 시나리오 (`apps/web/e2e/connected-investigation.spec.ts`)
- **Case Report Export:** 워크스페이스에서 가설 상태 변경, 체크리스트 선택, 메모 작성 후 리포트 다운로드 및 파일 내용(도메인 불변식, 런 ID, 알람 ID 등) 검증.
- **Standby Alert Lock 반례:** `AL-STANDBY-001` 인입 시 리포트 다운로드 버튼 및 조사 보드 잠금 확인.
- **Cross-Screen Deep Links:** 커맨드 센터, 설비 인텔리전스, 웨이퍼 추적성 각 화면의 워크스페이스 바로가기 버튼 클릭 후 워크스페이스 정상 진입 및 컨텍스트 연계 검증.



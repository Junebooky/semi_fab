# FAB ONE Demo Release Candidate Specification & Release Freeze (BUILD-15)

## 1. 개요 (Executive Summary)

**BUILD-15 FAB ONE Demo Release Freeze & Full-Journey Proof**는 반도체 식각 공정 이상 감지 및 엔지니어링 분석 플랫폼의 최종 안정화 및 릴리즈 프리즈(Release Freeze) 버전입니다.
본 단계에서는 신규 기능 개발을 공식 동결(Feature Freeze)하고, Casebook의 완전한 계통성 격리(Full Lineage Isolation), 엄격한 v1 스키마 유효성 검증, 7개 전체 화면 연속 실시간 연동 브라우저 여정(Real 7-Screen Connected Browser Journey), 그리고 안정적인 통합을 위한 스택 PR 플랜을 확립했습니다.

---

## 2. 핵심 작업 스트림 (Workstreams)

### Workstream A: P0 완전 계통성 격리 & 엄격 v1 스키마 무결성 (Lineage Isolation & Schema Invariants)

1. **완전 계통성 일치 검증 (`isExactLineageMatch`)**:
   - 단순 `mode`와 `runId` 비교를 넘어 7개 계통 속성(`mode`, `runId`, `alertId`, `sessionId`, `lotId`, `equipmentId`, `chamberId`)이 100% 일치할 때만 동일 활성 케이스로 인정합니다.
   - 동일 `runId`이더라도 `alertId`나 `sessionId`가 상이한 과거 케이스북 레코드 로드 시, 활성 워크스페이스 에디터 수정을 원천 차단하고 읽기 전용 모달(`#ws-historical-case-modal`)로 격리하여 작성 중인 가설/조치/메모 오염을 방지합니다.
   - 읽기 전용 모달 내 명확한 안내 배너(`"데이터 격리 안전 보호"`, Run/Alert/Session 계통 정보)를 표시하고, `#ws-btn-close-historical-case` 및 `#ws-btn-return-active-workspace`를 통한 안전한 복귀를 보장합니다.

2. **엄격 v1 스키마 유효성 검증 (`isValidCasebookRecord`)**:
   - `schemaVersion === 1` 필수 필드 강제 검증.
   - 중첩 가설(`hypotheses`) 및 조치(`actions`) 배열의 각 항목에 대한 엄격한 필드 및 enum (`status`: `UNVERIFIED`, `SUPPORTED_FOR_REVIEW`, `NEEDS_MORE_DATA`, `RULED_OUT` 등) 유효성 검증.
   - 문자열 길이 상한선(ID ≤ 100자, 제목 ≤ 200자, 메모 ≤ 5,000자, Markdown 내용 ≤ 50,000자) 적용으로 메모리 고갈 및 DoS 방지.

3. **안전한 백업 가져오기 및 저장소 보호 (`validateAndImportCasebookRecords`, `saveCasebookRecordToStorage`)**:
   - JSON 백업 파일 가져오기 시 500KB 크기 제한 및 최대 100개 레코드 제한을 적용하며, 중복 `id` 자동 제외 및 건너뛴 비정상 레코드 통계를 제공합니다.
   - 브라우저 로컬 저장소 용량 초과(`QuotaExceededError`) 시 거짓 성공 배너 표시를 차단하고 명시적인 에러 알림(`QUOTA_EXCEEDED`)을 반환합니다.
   - 마크다운 보고서 표 파손 방지를 위해 파이프(`|`) 이스케이프(`\\|`) 및 줄바꿈 문자의 `<br/>` 치환 적용.

---

### Workstream B: P1 7개 화면 연속 사용자 여정 및 반례 검증 (Real 7-Screen Journey Proof)

1. **연속 7개 화면 실제 브라우저 여정 검증 (E2E Test 1)**:
   - 홈(`/`) `#hero-live-connected-card` -> 커맨드 센터 (`#cc-run-id-badge`) -> 설비 인텔리전스 (T7 챔버 압력/RF 파워 일탈 확인, `#ei-run-id-badge`) -> 웨이퍼 추적성 (`W-08` 노출 후보군 확인) -> 엔지니어링 워크스페이스 (증거 링크, 가설/조치/메모 편집, Markdown 보고서 내보내기, Casebook 저장) -> Casebook 탭 (저장된 레코드 확인) -> 과거 공정 Run 아카이브 스냅샷 뷰어 (`GET /api/v1/demo/runs/{run_id}`)까지 단절 없는 실시간 연속 흐름 완주.

2. **계통성 분리 반례 검증 (E2E Test 7)**:
   - 동일 `runId`를 공유하지만 다른 `alertId`/`sessionId`를 가진 과거 케이스북 레코드를 로드할 때 활성 에디터 오염 없이 `#ws-historical-case-modal`로 격리 표시되고 현재 작성 메모가 보존됨을 검증.

3. **엄격 v1 스키마 손상 백업 거부 반례 검증 (E2E Test 8)**:
   - 손상된 JSON, `schemaVersion` 누락, 가설/조치 필드 결함 데이터 가져오기 시 유효한 레코드만 선별 로드되고 오염 데이터는 차단됨을 검증.

---

### Workstream C: P1 릴리즈 프리즈 & 통합 검증 매트릭스 (Release Freeze)

1. **FastAPI 백엔드 단위 테스트 (16/16 PASS)**:
   - `python3 -m unittest services/api/tests/test_api.py` (전체 16건 무결격 통과)
2. **웹 단위 및 계약 테스트 (93/93 PASS)**:
   - `npm test` in `apps/web` (신규 BUILD-15 (a)~(e) 5건 계약 테스트 추가 및 전체 93건 통과)
     - (a) Strict Lineage Isolation & `isExactLineageMatch` Contract
     - (b) Strict Schema v1 Validation & Invariant Enclosure Contract
     - (c) Payload Limit, Max Records & Backup Import Sanitization Contract
     - (d) LocalStorage Quota Failure & Error Handling Contract
     - (e) Markdown Pipe Escaping & `<br/>` Tag Conversion Contract
3. **Next.js 프로덕션 정적 빌드 검증 (10/10 PASS)**:
   - `npm run build` in `apps/web` (전체 10개 정적 라우트 컴파일 및 린트/타입 통과)
4. **Playwright E2E 통합 테스트 (17/17 PASS)**:
   - `npm run test:e2e` in `apps/web` (17개 테스트 전체 통과)
5. **동결 및 QA 전환 상태 선언**:
   - 본 BUILD-15 이후 모든 신규 기능 개발은 동결(Feature Freeze)되며, 최종 QA 단계로 전환됩니다.
   - A04 독립 QA는 `NOT_RUN` 상태를 유지하며, PR은 검토용 Draft 및 미병합(Open) 상태를 유지합니다.

---

## 3. 데모 시연 가이드 (Walkthrough Script)

### 3.1 2분 Mode A 가이드 투어 (오프라인 합성 시뮬레이션)
- **목적**: 네트워크/백엔드 의존성 없이 프론트엔드 단독으로 확정적 시드 기반 8단계 FAB 이상 탐지 워크플로우 시연.
- **소요 시간**: 약 2분.
- **시나리오 단계**:
  1. **홈 화면 (`/`)**: 상단 `#hero-guided-tour-card`에서 `#btn-start-guided-tour` 클릭하여 가이드 투어 진입.
  2. **1단계 (FAB 개요)**: 팹 라인 배치도 및 공정 단계 확인.
  3. **2단계 (설비 이상 감지)**: ETCH-02 Chamber B의 T7 시간대 압력/RF 파워 일탈 확인.
  4. **3단계 (웨이퍼 추적성)**: 동일 챔버를 통과한 LOT-20261016 중 `W-08` 웨이퍼의 노출 후보군 식별.
  5. **4단계 (상관관계 분석)**: 센서 일탈과 웨이퍼 결함 사이의 통계적 상관도 확인.
  6. **5단계 (엔지니어 가설 수립)**: 압력 헌팅 및 플라즈마 임피던스 불일치 가설 등록.
  7. **6단계 (조치 계획 수립)**: 가스 밸브 캘리브레이션 및 RF 매처 점검 액션 계획.
  8. **7~8단계 (요약 및 워크스페이스 완료)**: 전체 조사 요약 확인 후 엔지니어링 워크스페이스로 복귀하여 완료.

### 3.2 5분 Mode B 실시간 연동 조사 (FastAPI 백엔드 실시간 연결)
- **목적**: FastAPI 백엔드와 양방향 통신하며 실제 FAB 공정 런 모니터링, 이상 트리아지, 웨이퍼 추적, 케이스북 저장 및 과거 런 스냅샷 아카이브 조회 시연.
- **소요 시간**: 약 5분.
- **시나리오 단계**:
  1. **홈 화면 (`/`)**: 상단 `#hero-live-connected-card`에서 `#btn-start-live-connected-case` 클릭.
  2. **커맨드 센터 (`/command-center`)**:
     - 상단 헤더 활성 런 배지(`#cc-run-id-badge`) 확인.
     - 활성 이상(`active`)과 대기 중 이상(`standby`) 트리아지 확인.
     - "설비 인텔리전스로 이동" 버튼 클릭.
  3. **설비 인텔리전스 (`/equipment-intelligence`)**:
     - 상단 헤더 활성 런 배지(`#ei-run-id-badge`) 확인.
     - ETCH-02 CH-B의 센서 텔레메트리 차트에서 T7 구간 챔버 압력(~168.5 mTorr vs UCL 160.0) 및 RF 파워(~1820 W vs UCL 1800) 일탈 확인.
     - "웨이퍼 추적성으로 이동" 클릭.
  4. **웨이퍼 추적성 (`/wafer-traceability`)**:
     - 25매 웨이퍼 로트 맵 확인.
     - T7 시간대에 챔버에 노출된 `W-08` 웨이퍼가 `Candidate Exposed`로 강조 표시됨을 확인.
     - "엔지니어링 워크스페이스로 전송" 클릭.
  5. **엔지니어링 워크스페이스 (`/engineering-workspace`)**:
     - 3-Phase 비동기 스냅샷 검증 통과 후 활성 조사 보드 진입.
     - 증거 링크(`W-08`, `T7 Excursion`) 확인.
     - 엔지니어 가설 수립 및 조치 계획 작성, 메모 입력.
     - "Markdown 조사 보고서 내보내기" 클릭하여 안전하게 이스케이프된 보고서 확인.
     - "Casebook에 케이스 저장" 클릭하여 현재 계통 정보를 포함한 레코드 저장.
  6. **Casebook 탭**:
     - 저장된 케이스북 레코드 리스트 확인.
     - 검색/필터링 및 v1 스키마 유효성 확인.
  7. **과거 공정 Run 아카이브 스냅샷 뷰어**:
     - 케이스북 상단 서버 과거 Run 목록에서 비활성 런 클릭.
     - `GET /api/v1/demo/runs/{run_id}` 엔드포인트를 통해 409 Mismatch 없이 읽기 전용 스냅샷 패널(`#ws-historical-run-panel`)에서 센서 계측치 및 웨이퍼 분포 확인.
     - `#ws-btn-return-active-run` 클릭으로 활성 런으로 안전 복귀.

---

## 4. 로컬 실행 및 재현 가이드 (Local Reproduction Commands)

### 필수 요구사항
- Node.js 20+
- Python 3.10+

### 서비스 실행 명령어

```bash
# 터미널 1: 백엔드 FastAPI 서비스 (포트 8000)
cd services/api
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 터미널 2: 프론트엔드 Next.js 웹 애플리케이션 (포트 3000)
cd apps/web
npm install
npm run dev -- -p 3000
```

### 테스트 실행 명령어

```bash
# 백엔드 단위 테스트
python3 -m unittest services/api/tests/test_api.py

# 프론트엔드 계약 및 단위 테스트 (93 tests)
cd apps/web && npm test

# 프론트엔드 프로덕션 정적 빌드 검증 (10 static pages)
cd apps/web && npm run build

# Playwright E2E 통합 브라우저 테스트 (17 tests)
cd apps/web && npm run test:e2e
```

---

## 5. 합성 데이터 및 도메인 면책 조항 (Synthetic Data Disclaimer)

> **[중요 알림]**
> 본 데모 플랫폼에 표시되는 모든 FAB 라인 정보, 장비 명칭, 센서 텔레메트리 계측 수치, FDC 통계적 알람, 웨이퍼 노출 분포 및 결함 후보 데이터는 **순수 알고리즘에 의해 생성된 가상 시뮬레이션 합성 데이터(Synthetic Data)**입니다.
> 
> 1. **자동 제어 불가 원칙**: 본 시스템은 실제 FAB MES, 공정 제어 시스템(EES/APC), 또는 물리적 식각 장비/챔버 밸브에 대한 어떠한 직접 제어도 수행하지 않습니다.
> 2. **인간 엔지니어 최종 판단 원칙**: 시스템은 통계적 이상(Excursion) 및 노출 후보군(Candidate Exposed)을 엔지니어에게 분석 보조 자료로 제시할 뿐이며, 결함의 최종 판정 및 후속 조치 결정은 전적으로 인간 엔지니어의 전문적 판단에 위임됩니다.
> 3. **Excursion ≠ Defect**: 센서 일탈 노출이 웨이퍼의 물리적 결함을 확정하지 않으며, 추가 계측(Metrology) 대상 후보군으로 분류됩니다.
> 4. **MISSING ≠ 0**: 미수신 또는 결측 센서 데이터는 정상치(0)로 대체되지 않으며, `null` 또는 `MISSING`으로 투명하게 표기됩니다.

---

## 6. 스택 PR 통합 계획 (Stacked PR Integration Plan #15 ~ #42)

### 6.1 PR 계통 체인 구조 (PR Lineage Chain)

| PR 번호 | 브랜치 이름 | 베이스 브랜치 | 주요 빌드 및 핵심 기능 | 상태 |
|---|---|---|---|---|
| #15 | `a02/build-01-core-types` | `main` | BUILD-01: 공통 도메인 타입 및 계약 정의 | MERGED |
| #16 | `a02/build-02-api-skeleton` | `a02/build-01-core-types` | BUILD-02: FastAPI 모의 백엔드 스켈레톤 | MERGED |
| #20 | `a02/build-03-web-scaffold` | `a02/build-02-api-skeleton` | BUILD-03: Next.js 프론트엔드 스캐폴딩 | MERGED |
| #22 | `a02/build-04-command-center` | `a02/build-03-web-scaffold` | BUILD-04: 커맨드 센터 이상 트리아지 화면 | MERGED |
| #24 | `a02/build-05-equipment-intel` | `a02/build-04-command-center` | BUILD-05: 설비 인텔리전스 센서 차트 | MERGED |
| #26 | `a02/build-06-wafer-trace` | `a02/build-05-equipment-intel` | BUILD-06: 웨이퍼 추적성 25매 맵 | MERGED |
| #28 | `a02/build-07-workspace` | `a02/build-06-wafer-trace` | BUILD-07: 엔지니어링 워크스페이스 보드 | MERGED |
| #30 | `a02/build-08-guided-tour` | `a02/build-07-workspace` | BUILD-08: Mode A 8단계 가이드 투어 | MERGED |
| #32 | `a02/build-09-connected-mode-b` | `a02/build-08-guided-tour` | BUILD-09: Mode B 실시간 API 연동 | MERGED |
| #34 | `a02/build-10-cross-nav` | `a02/build-09-connected-mode-b` | BUILD-10: 7개 화면 상호 내비게이션 | MERGED |
| #36 | `a02/build-11-ci-e2e` | `a02/build-10-cross-nav` | BUILD-11: Playwright E2E 통합 테스트 | MERGED |
| #38 | `a02/build-12-polish` | `a02/build-11-ci-e2e` | BUILD-12: 통합 UX 및 접근성 개선 | MERGED |
| #40 | `a02/build-14-demo-release-candidate` | `a02/build-12-polish` | BUILD-14: 데모 릴리즈 캔디데이트 | OPEN (Draft) |
| #42 | `a02/build-15-release-freeze` | `a02/build-14-demo-release-candidate` | BUILD-15: 릴리즈 프리즈 & 7개 화면 여정 검증 | OPEN (Draft, 본 PR) |

### 6.2 병합 순서 및 선행 조건 (Merge Order & Prerequisites)
1. PR #40(`a02/build-14-demo-release-candidate`)이 A01 기획 에이전트 및 팀 검토를 거쳐 선행 병합됩니다.
2. PR #40 병합 직후, 본 PR #42(`a02/build-15-release-freeze`)의 베이스 브랜치가 최신화되며 최종 병합 절차를 진행합니다.
3. 모든 PR은 GitHub Actions CI 3개 작업(FastAPI backend-test, Next.js web-test-and-build, Playwright e2e-smoke-test) 통과가 필수 선행 조건입니다.

### 6.3 A03(PR #11) 및 A06(PR #10)과의 충돌 분석 (Conflict Analysis)
- **A03 PR #11 (머신러닝/데이터 파이프라인 분석)**:
  - 작업 영역: `services/analytics/` 또는 독립된 ML 스크립트 디렉토리.
  - 충돌 가능성: **없음 (Zero Conflict)**. 본 A02 작업은 `apps/web/` 및 `services/api/`에 국한되어 있으며, 공통 인터페이스 변경 없이 완전히 분리된 워크트리에서 작업되었습니다.
- **A06 PR #10 (CI/CD 인프라 및 전역 문서화)**:
  - 작업 영역: 루트 워크플로우 또는 전역 인프라 설정.
  - 충돌 가능성: **최소 (Minimal/Isolated)**. `.github/workflows/ci.yml`의 테스트 카운트 주석 갱신 외에는 파일 충돌 요소가 없으며, 깃 계통상 완벽히 직교(Orthogonal)합니다.

### 6.4 롤백 전략 (Rollback Strategy)
- 통합 또는 스테이징 배포 중 예상치 못한 치명적 결함이 발생할 경우:
  1. 본 브랜치 `a02/build-15-release-freeze`의 변경사항을 즉시 롤백하고, 검증 완료된 직전 안정 베이스 커밋(`b6e44a225f99cfcc54b41efc383a944cbc79ce1a`, PR #40 HEAD)으로 복귀합니다.
  2. Git CLI 롤백 명령어:
     ```bash
     git checkout a02/build-14-demo-release-candidate
     git checkout -b rollback/build-15-hotfix
     ```
  3. Casebook 데이터는 `schemaVersion: 1` 하위 호환성을 유지하므로, 롤백 시에도 사용자의 기존 로컬 저장소 데이터 유실 없이 정상 작동합니다.

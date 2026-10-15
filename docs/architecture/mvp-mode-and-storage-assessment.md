# FAB ONE — MVP 운영 모드 및 데이터 저장소 아키텍처 기술 검토 v0.3

- **문서 ID:** ARCH-DOC-001
- **상태:** PROPOSED (A01 기획자 및 프로젝트 오너 승인 대기)
- **개정 이력:**
  - v0.1 (2026-10-15): 초안 작성
  - v0.2 (2026-10-15): A01 검토의견 반영 (WAL 모드, 청크 트랜잭션, 세션 기반 소프트 리셋)
  - v0.3 (2026-10-15): A04 독립 검증 결과 수용 및 A01 수정 지시 반영
    - [F04] 공장 전체 초기화(Factory Wipe) 삭제 의존성 순서(외래키 CASCADE/RESTRICT 대상 전체 포괄) 및 단일 트랜잭션 롤백, 소프트 리셋과의 명확한 분리, IndexedDB 선택적 삭제 동의 명문화
    - [F05] SQLite 동시성 및 잠금 정책 현실화 (`busy_timeout=5000`의 내부 슬립 루프 동작 해설, 애플리케이션 레벨 지수 백오프/재시도 정책, `BEGIN IMMEDIATE`의 잠금 획득 실패 가능성 명시, 미검증 '100% 보장' 표현을 조건부 설계 표현으로 교정)
    - [F08] A04 QA-F05 지적사항 해결 매핑 경로 정정 (`domain-data-contract-v0.1.md` §3.5 SPC 비인과성 원칙으로 수정)
- **작성자:** A02 (수석 소프트웨어 개발 에이전트)
- **관련 Issue / PR:** Issue [#1](https://github.com/Junebooky/semi_fab/issues/1), Issue [#8](https://github.com/Junebooky/semi_fab/issues/8), Issue [#12](https://github.com/Junebooky/semi_fab/issues/12), Draft PR [#2](https://github.com/Junebooky/semi_fab/pull/2), QA PR [#3](https://github.com/Junebooky/semi_fab/pull/3), Design PR [#7](https://github.com/Junebooky/semi_fab/pull/7), PR [#10](https://github.com/Junebooky/semi_fab/pull/10)
- **일자:** 2026-10-15


---

## 1. 개요 및 목적

본 문서는 FAB ONE의 데이터 영속성 전략(ADR-001)에 대한 기술 아키텍처 검토서이다. 반도체 FAB 시뮬레이션 플랫폼의 특성상 공학 지식(EKL), 정적 시나리오/픽스처, 시계열 센서 스트림, 설비·공정 관계형 데이터, 사용자 메모의 수명 주기와 정합성 요구 수준이 각기 다르다.

A04 QA의 ADR-001 검토 의견(PR #3, QA-F02~QA-F04)과 A03 디자인 명세(PR #7), A01의 초기 제안(Issue #1, PR #2)을 종합하여 **Mode A(정적 브라우저 데모), Mode B(로컬 풀스택 + 영속 SQLite), Mode C(클라우드 Supabase/PostgreSQL 협업)**의 기술적 실현 가능성, 배포 제약, 동시성, 백업/복구 및 마이그레이션 경로를 명확히 정의한다.

> **핵심 원칙:**
> 1. 실제 반도체 FAB 장비 및 운영망과의 실시간 연동은 본 MVP 범위에서 철저히 배제한다.
> 2. Vercel 등 임시(Stateless/Ephemeral) 파일시스템 환경에 SQLite 쓰기 데이터베이스를 영구 DB로 배치하지 않는다.
> 3. 단순 브라우저 역할 전환(Role Switcher)을 엔터프라이즈 RBAC 또는 변경 불가능한 감사 추적으로 포장하지 않는다.

---

## 2. 운영 모드별 심층 비교 분석

| 평가 항목 | Mode A: 정적 브라우저 데모 | Mode B: 로컬 풀스택 (권장 MVP) | Mode C: 클라우드 협업 (미래 확장) |
|---|---|---|---|
| **아키텍처 구성** | Next.js 정적 내보내기 / SPA + 브라우저 내 픽스처 로더 | Next.js 프론트엔드 + Python FastAPI 백엔드 + 로컬 SQLite | Next.js + FastAPI/Node + Supabase (PostgreSQL + RLS + GoTrue Auth) |
| **주요 용도** | 공개 포트폴리오 웹사이트, 무비용 쇼케이스, 브라우저 학습 | 개발자/평가자 로컬 실행, 정밀 통계 계산, 고속 시뮬레이션 | 다중 사용자 실시간 사건 조사, 크로스 디바이스 동기화, 엔터프라이즈 협업 |
| **배포 환경** | GitHub Pages, Vercel 정적 호스팅, Cloudflare Pages | 로컬 머신 (macOS/Linux/Windows), 단일 컨테이너(Docker) | Supabase Cloud + Vercel/AWS ECS/Fly.io |
| **운영 비용** | **무료** (Vercel/GitHub Pages 프리티어 한도 내 $0) | **무료** (사용자 로컬 컴퓨팅 자원 활용) | $25+/월 (Supabase Pro, DB 인스턴스, 백엔드 컨테이너) |
| **데이터 영속성** | 브라우저 IndexedDB (사용자 메모/임시 세션만) | 로컬 영속 볼륨 내 단일 파일 (`.db`) | 클라우드 관리형 PostgreSQL (WAL 백업, PITR 복원) |
| **동시성 모델** | 단일 브라우저 탭 / 독립 격리 | 단일 작성자(Single-Writer), 다중 읽기(Multi-Reader) | 다중 트랜잭션 동시 처리, Row-Level Lock, MVCC |
| **정합성 보장** | 없음 (메모리 및 IndexedDB 비구조적 저장) | ACID 보장 (`PRAGMA foreign_keys=ON`, WAL 트랜잭션) | 완전한 RDBMS ACID, 외래키 무결성, RLS 보안 격리 |
| **보안 및 인증** | 없음 (UI 필터 기반 가상 역할 선택) | 없음 (로컬 단일 사용자 전제, 가상 역할 뷰) | Supabase Auth (JWT), 세분화된 RBAC, Row Level Security |
| **마이그레이션 난이도** | - (정적 픽스처 기반) | **기준점** (리포지토리 패턴으로 추상화) | **보통** (SQLite 스키마 $\to$ PostgreSQL DDL 변환, RLS 정책, 커넥션 풀 튜닝 필요) |

### 2.1 Mode A 상세 분석 및 한계
- **장점:** 호스팅 인프라 유지 비용 전무, 웹 링크 클릭만으로 즉시 시연 가능, 보안 위협 및 서버 장애 리스크 없음.
- **기술적 제약:**
  - Python 기반 고급 공학 라이브러리(SciPy, NumPy)를 브라우저에서 실행하려면 Pyodide(WebAssembly)를 로드해야 하므로 초기 로딩 번들이 20MB 이상 증가할 수 있음. (TypeScript 수식 엔진으로 대체 필요)
  - Vercel Serverless Functions에 SQLite 파일을 번들링하여 읽기 전용으로 서빙할 수는 있으나, 쓰기 트랜잭션은 함수 인스턴스 종료 시 즉시 유실됨.
  - 조사 케이스(Incident Case) 등록 시 브라우저 IndexedDB에만 저장되므로 다른 기기나 다른 브라우저에서는 조회 불가.

### 2.2 Mode B 상세 분석 (A02 권장 개발 표준)
- **장점:**
  - Python 생태계(FastAPI, NumPy, Pandas, SciPy)를 온전히 활용하여 반도체 FDC/SPC 공학 계산의 수치적 엄밀성을 구현할 수 있는 환경 제공 (단위 테스트를 통한 검증 목표).
  - SQLite를 활용한 엄격한 외래키 무결성 및 인덱스 쿼리 성능 확보.
  - 로컬 파일시스템에 시뮬레이션 결과 및 케이스가 영구 보관되어 재현성 검증에 최적화.
- **기술적 제약:**
  - 사용자가 저장소를 클론하고 `docker compose up` 또는 로컬 환경 설정(Python 가상환경, Node.js 패키지)을 직접 실행해야 함.
  - 단일 파일 SQLite 특성상 원격 다중 사용자 동시 쓰기 불가.

### 2.3 Mode C 전환 기준 및 트리거
다음 조건 중 **최소 1개 이상이 공식 요구사항으로 승인**되기 전에는 Supabase 도입을 보류한다:
1. 2인 이상의 실제 사용자가 서로 다른 기기에서 동일한 조사 케이스를 실시간으로 동시 편집하고 코멘트를 동기화해야 할 때.
2. 실질적인 접근 제어(엔지니어/관리자/감사관) 및 조직별 데이터 격리(Multi-tenancy)가 요구될 때.
3. 법적/규제적 감사 로그(Audit Log)의 변경 불가능한 중앙 집중식 영구 저장이 필요할 때.

---

## 3. SQLite 영속성 및 데이터 정합성 설계 (QA-F02 대응)

SQLite를 Mode B의 영속 저장소로 채택할 경우, 기본 설정의 취약점을 방지하기 위해 다음 5가지 엔지니어링 규칙을 시스템적으로 강제한다.

### 3.1 연결 시 외래키 무결성 강제 (`PRAGMA foreign_keys = ON`)
SQLite는 하위 호환성을 이유로 기본적으로 외래키 제약조건 검사를 비활성화(`OFF`)한다.
- **설계 규약:** 백엔드(FastAPI / SQLAlchemy / aiosqlite)의 **모든 데이터베이스 커넥션 생성 시 커넥션 풀 이벤트 리스너에서 즉시 `PRAGMA foreign_keys = ON;`을 실행**한다.
- 검증 쿼리: `PRAGMA foreign_keys;`의 결과값이 반드시 `1`이어야 하며, `0`일 경우 런타임 시작을 차단한다.

### 3.2 저널 모드 및 동시성 제어 (`WAL 모드`, [F05] 보완)
- **저널 모드:** `PRAGMA journal_mode = WAL;` (Write-Ahead Logging)을 적용한다.
- **효과:** 읽기 작업(Readers)과 쓰기 작업(Writer)이 서로를 블로킹하지 않는다. 다수의 Next.js 대시보드 쿼리가 실행되는 도중 시뮬레이터가 센서 데이터를 인서트하더라도 `SQLITE_LOCKED` 오류를 방지한다.
- **경합 타임아웃 (`busy_timeout`):**
  - `PRAGMA busy_timeout = 5000;` (5,000ms)을 설정하여 쓰기 락 경합 시 즉각 실패하지 않고 SQLite 내부 busy handler가 5초 동안 점진적 슬립(Sleep Polling 루프) 방식으로 대기하도록 한다.
  - **애플리케이션 계층 지수 백오프(Exponential Backoff) 및 재시도 정책 ([F05] 해결):**
    `busy_timeout`은 SQLite C 라이브러리 내부의 슬립 핸들러일 뿐, 애플리케이션 수준의 지수 백오프가 아니다. 타임아웃 경과 후에도 락을 획득하지 못하면 SQLite는 `SQLITE_BUSY` (또는 Python `OperationalError: database is locked`)를 반환한다. 애플리케이션 계층(FastAPI/Repository)은 이를 감지하여 무한 대기하지 않고 **최대 3회 재시도, 지수 백오프(기본 50ms, 100ms, 200ms) 및 무작위 지터(Jitter)**를 적용하며, 최종 실패 시 사용자 친화적 에러(`CONCURRENT_WRITE_TIMEOUT`)를 반환하고 트랜잭션을 안전하게 중단(Fail-fast)한다.
- **동기화 레벨:** `PRAGMA synchronous = NORMAL;`을 적용하여 WAL 모드에서 데이터 무결성을 유지하면서 디스크 I/O 병목을 최소화한다.

### 3.3 트랜잭션 격리 및 쓰기 정책 (P0-3 / [F05] 대응)
- **트랜잭션 시작 정책:** 시뮬레이션 배치 쓰기 및 조사 케이스 등록 시 기본 `BEGIN DEFERRED` 대신 **`BEGIN IMMEDIATE`**를 사용하여 트랜잭션 시작 시점에 쓰기 락(RESERVED 락)을 선점함으로써, 공유 락(SHARED)에서 예약 락(RESERVED)으로의 동시 업그레이드 시 발생하는 전형적인 교착 상태(Deadlock)를 방지한다.
  - **동시성 한계 및 주의점 ([F05] 해결):** `BEGIN IMMEDIATE` 또한 다른 연결이 이미 RESERVED 또는 EXCLUSIVE 락을 쥐고 있는 경우 즉시 또는 `busy_timeout` 후 `SQLITE_BUSY`를 반환할 수 있다. 따라서 "모든 교착 및 락 실패를 원천 차단한다"고 단정하지 않으며, 상기 제3.2절의 애플리케이션 재시도 정책 및 동시 쓰기 최소화(Single-Writer 원칙) 설계를 병행한다.
- **배치 쓰기 원자성 보장 규약:** 공정 실행(`process_run`), 센서 계측치(`sensor_measurement`), 알람(`fdc_alert`)의 일괄 삽입 시 메모리 및 SQLite 바인딩 파라미터(999개/32766개) 한도를 준수하기 위해 1,000건 단위의 청크로 나누어 `executemany`를 호출하되, **반드시 단일 트랜잭션(`BEGIN IMMEDIATE ... COMMIT`) 내에서 수행하며, 모든 청크의 실행이 정상 완료된 후에만 최종 `COMMIT`을 실행**한다. 중간에 단 1개의 청크라도 실패하면 즉시 전체 트랜잭션을 `ROLLBACK`하여 부분적으로 저장된 불완전한 공정 이력이 남지 않도록 한다.


### 3.4 데이터베이스 파일 경로 및 백업/복구 절차
- **기본 경로:** `data/fab_one_mvp.db` (Git 추적 제외: `.gitignore` 등록 필수).
- **온라인 백업:** 런타임 중 데이터베이스 손상 없이 백업을 생성하기 위해 SQLite의 `VACUUM INTO 'data/backups/fab_one_backup_YYYYMMDD_HHMMSS.db';` 구문 또는 Python `sqlite3.backup()` API를 호출하는 관리자 명령을 구현한다.
- **초기화 및 복구:** 시뮬레이션 상태를 공장 출하 상태로 되돌리기 위해 원본 시드 픽스처로부터 DB를 재생성하는 `scripts/reset_db.py`를 제공한다.

### 3.5 서버리스/임시 파일시스템 배치 절대 금지 규약
- Vercel Serverless Functions, AWS Lambda 등의 임시 컨테이너 `/tmp` 디렉토리에 SQLite 파일을 생성하고 쓰기 작업을 수행하는 구성을 엄격히 금지한다.
- 공개 호스팅 환경에서 동적 쓰기 API를 제공해야 할 경우, 볼륨 마운트가 지원되는 단일 VM(AWS Lightsail, Fly.io 등)을 사용하거나 정적 Mode A로 전환하여 서비스한다.

---

## 4. 브라우저 IndexedDB 설계 및 데이터 손실 방지 (QA-F03 대응)

IndexedDB는 Mode A 및 Mode B 공통으로 사용자의 개인 학습 메모, UI 레이아웃 선호도, 임시 필터 상태를 저장하는 클라이언트 전용 저장소로 활용된다.

### 4.1 스토리지 스코프 및 한계 고지
- IndexedDB는 시스템의 공식 진실 공급원(System of Record)이 아니며, 개인화된 보조 레이어다.
- 브라우저 시크릿 모드 종료, 브라우저 캐시 삭제, 디스크 용량 부족에 따른 브라우저의 자동 축출(Storage Eviction) 정책으로 인해 데이터가 언제든 유실될 수 있다.
- **UX 요구사항:** 메모 패널 상단에 "로컬 브라우저 전용 데이터이며 기기 간 동기화되지 않습니다"라는 안내 문구를 상시 노출한다.

### 4.2 스키마 버전 관리 및 내보내기/가져오기 (Export/Import) 계약
사용자가 로컬 메모를 안전하게 보관하고 다른 기기로 이전할 수 있도록 표준 JSON 내보내기/가져오기 규약을 정의한다.

```json
{
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-10-15T03:00:00.000Z",
  "appVersion": "0.1.0",
  "payloadKind": "user_notes_and_preferences",
  "integrityHash": "sha256-abc123...",
  "notes": [
    {
      "noteId": "note-550e8400-e29b-41d4-a716-446655440000",
      "conceptId": "EKL-ETCH-RATE",
      "content": "CF4 유량 변화에 따른 폴리 실리콘 식각 속도 민감도 검토 필요",
      "createdAt": "2026-10-15T02:30:00.000Z",
      "updatedAt": "2026-10-15T02:45:00.000Z"
    }
  ],
  "preferences": {
    "theme": "light",
    "chartDensity": "comfortable",
    "defaultTimezone": "Asia/Seoul"
  }
}
```

- **보안 검증:** JSON 파일 가져오기(Import) 시:
  1. `schemaVersion` 호환성 검증 (하위 호환 불가능 시 명확한 에러 메시지 반환).
  2. 메모 콘텐츠 내 악성 스크립트 실행 방지를 위한 XSS 살균(Sanitization) 처리.
  3. CSV 내보내기 시 수식 삽입 공격(Formula Injection, `=`, `+`, `-`, `@`로 시작하는 셀) 방지를 위한 단일 따옴표(`'`) 이스케이프 적용.

### 4.3 시뮬레이터 리셋과 이력 보존 외래키 정합성 (P0-3 / [F04] 대응)
- **외래키 충돌 문제:** 조사 케이스(`INVESTIGATION_CASE`)가 특정 `run_id` 및 `alert_id`를 외래키(`ON DELETE RESTRICT`)로 참조하고, 센서 계측치 및 웨이퍼 매핑이 `process_run`을 참조하고 있을 때, 시뮬레이터 리셋 시 원본 실행/알람 레코드를 삭제하면 외래키 위반 오류로 리셋이 실패한다.
- **세션 ID 기반 불변 이력 보존 (Soft-Reset, 기본 권장):**
  1. 모든 실행과 알람에 `simulation_session_id`를 부여한다.
  2. 시뮬레이터 리셋 시 기존 세션은 `is_active = 0`으로 비활성화하여 아카이빙하고, 새로운 세션을 발급하여 가상 클록 $t=0$부터 시작한다.
  3. 대시보드는 최신 활성 세션(`is_active = 1`) 데이터만 표시하며, 기존 조사 케이스는 과거 세션의 레코드를 안전하게 참조하여 외래키 무결성을 관계형 스키마 제약조건으로 안정적으로 보존한다. (미검증 '100% 보존' 단정 지양).
  4. 사용자의 IndexedDB 개인 학습 메모는 시뮬레이터 세션 리셋과 완전히 격리되어 안전하게 유지된다.
- **공장 전체 초기화 (Factory Wipe, 파괴적 관리자 작업):**
  1. 소프트 리셋과 엄격히 분리된 별도 파괴적 작업으로 정의한다.
  2. 외래키 종속성을 완벽히 반영한 역순 삭제 트랜잭션(`CASE_ACTION_LOG` $\to$ `INVESTIGATION_CASE` $\to$ `FDC_ALERT` $\to$ `SENSOR_MEASUREMENT` $\to$ `PROCESS_RUN_WAFER` $\to$ `WAFER_DEFECT_MAP` $\to$ `PROCESS_RUN` $\to$ `SIMULATION_SESSION`)을 단일 `BEGIN IMMEDIATE ... COMMIT` 내에서 수행하며 오류 시 즉시 `ROLLBACK`한다.
  3. 2단계 확인(경고 모달 + `"FACTORY-WIPE-CONFIRM"` 텍스트 입력)을 강제한다.
  4. IndexedDB 사용자 학습 메모는 기본 보존하되, 사용자가 모달 내 `[선택] 브라우저 내 개인 학습 메모 및 환경설정도 함께 삭제`를 명시 체크한 경우에 한해 클라이언트 측에서 별도 삭제한다.


---

## 5. 가상 역할(Role Switcher)과 실제 권한의 경계 (QA-F04 대응)

- **문제 인식:** 포트폴리오 UI에서 "설비 엔지니어", "공정 엔지니어", "수율 분석가" 탭을 클릭하여 시점을 전환하는 기능이 실제 사용자 인증(Auth)이나 역할 기반 접근 제어(RBAC)로 오인될 위험이 존재함.
- **아키텍처 규약:**
  1. 프론트엔드의 역할 선택 상태는 `viewPreference` 또는 `perspectiveMode`로 명명하며, `currentUserRole`이나 `authRole`이라는 변수명을 사용하지 않는다.
  2. 역할 변경은 대시보드 컴포넌트의 가시성(Visibility) 및 정렬 우선순위만 변경할 뿐, 백엔드 API 호출 권한이나 쓰기 권한을 제어하지 않는다.
  3. 모든 화면 및 API 응답 헤더에 `X-FAB-Security-Context: simulation-unauthenticated`를 명시하여 보안 평가 시 오해를 방지한다.
  4. 실제 다중 사용자 RBAC 및 행 단위 보안(RLS)은 Mode C 마이그레이션 시점에 구현함을 문서화한다.

---

## 6. 향후 Mode C (Supabase / PostgreSQL) 마이그레이션 청사진

### 6.1 리포지토리 패턴(Repository Pattern)을 통한 데이터 계층 격리
UI 및 비즈니스 로직이 특정 DB 벤더에 종속되지 않도록 인터페이스를 정의하고 주입한다.

```text
[UI Components / Next.js Pages]
             │
             ▼
[Domain Services (SimulationService, MetricsCalculator)]
             │
             ▼
[Repository Interfaces (IRepository<T>)]
   ├── EquipmentRepository
   ├── MeasurementRepository
   ├── IncidentCaseRepository
   └── KnowledgeRepository
             │
   ┌─────────┴─────────┐
   ▼                   ▼
[SQLite Impl (Mode B)] [Supabase/PostgreSQL Impl (Mode C)]
```

### 6.2 데이터 타입 매핑 규약

| 도메인 속성 | SQLite (Mode B) | PostgreSQL / Supabase (Mode C) | 비고 |
|---|---|---|---|
| 기본 식별자 (PK) | `TEXT` (UUID v4 문자열) | `UUID` (또는 `TEXT`) | 클라이언트/서버 생성 일관성 유지 |
| 타임스탬프 | `TEXT` (ISO 8601 UTC 문자열) | `TIMESTAMPTZ` (UTC 기준) | 타임존 오프셋 처리 오류 방지 |
| 수치 측정값 | `REAL` (IEEE 754 float64) | `DOUBLE PRECISION` 또는 `NUMERIC(12, 4)` | 공학 계산 정밀도 유지 |
| 불리언 플래그 | `INTEGER` (`0` 또는 `1`) | `BOOLEAN` (`TRUE` 또는 `FALSE`) | 0/1 매핑 어댑터 적용 |
| 메타데이터 / 가변 속성 | `TEXT` (JSON 직렬화 문자열) | `JSONB` | 인덱싱 및 쿼리 가능 |
| 열거형(Enum) | `TEXT` + `CHECK (col IN (...))` | `ENUM` 타입 또는 `CHECK` 제약조건 | 도메인 데이터 계약 준수 |

---

## 7. 아키텍처 권장안 (A02 결론)

1. **MVP 공식 타깃: Mode A 및 Mode B 듀얼 전략 채택**
   - **온라인 배포:** Vercel에 정적 데모(Mode A)를 배포하여 포트폴리오 열람자가 로그인이나 설치 없이 즉시 시나리오를 체험할 수 있도록 구성.
   - **로컬 심화 실행:** 기술 면접관 또는 평가자가 코드를 내려받아 전체 Python 계산 엔진과 영속 SQLite를 검증할 수 있는 로컬 실행 모드(Mode B) 제공.
2. **Supabase(Mode C) 도입 유보:**
   - 현재 단계에서 Supabase를 연동하는 것은 인프라 복잡도와 클라우드 비용만 가중시키므로, 실제 다중 사용자 협업 기능 개발 시점으로 연기.

---

## 8. 제안 개발 디렉터리 구조 및 MVP 단계별 구현 로드맵

### 8.1 모노레포 디렉터리 구조 제안
Next.js 프론트엔드와 Python 백엔드 간의 계약 및 정적 자산을 체계적으로 격리하기 위해 다음과 같은 구조를 제안한다:

```text
semi_fab/
├── apps/
│   └── web/                   # Next.js 14+ (App Router, TypeScript, Tailwind CSS)
│       ├── src/
│       │   ├── app/           # 화면 라우트 (command-center, equipment, process, yield, knowledge)
│       │   ├── components/    # A03 디자인 시스템 컴포넌트 (AppShell, EvidenceTrend, EKL 등)
│       │   ├── hooks/         # 클라이언트 상태, IndexedDB 접근 훅
│       │   └── lib/           # 클라이언트 유틸리티, 픽스처 로더
│       └── tailwind.config.ts # fab-one.tokens.json 연동 스타일 설정
├── packages/
│   ├── contracts/             # 프론트엔드/백엔드 공통 TypeScript 인터페이스 및 JSON Schema
│   └── ekl-content/           # 공학 지식 레이어 정적 MDX 및 메타데이터 JSON
├── services/
│   ├── api/                   # Python FastAPI 백엔드 (Mode B 전용)
│   │   ├── routers/           # /api/v1/sim, /api/v1/equipment, /api/v1/cases
│   │   ├── models/            # SQLAlchemy / Pydantic 도메인 모델
│   │   ├── repositories/      # SQLite 영속 계층 (Repository Pattern)
│   │   └── core/              # DB 커넥션 풀, PRAGMA foreign_keys 설정
│   └── engine/                # 고속 공학 계산 및 시뮬레이션 모듈 (NumPy, SciPy)
│       ├── calculators/       # Die Yield, Etch Rate, Cp/Cpk (단위 테스트 포함)
│       └── simulator/         # PCG64 결정론적 가상 센서 생성기
├── fixtures/                  # Git 버전 관리되는 결정론적 시나리오 및 픽스처
│   ├── scenarios/             # ETH-SYN-01.json 등
│   └── baseline/              # 설비/레시피 기준 마스터 데이터
└── docs/                      # ADR, 아키텍처, QA, 기획 문서
```

### 8.2 단계별 MVP 구현 순서
1. **Phase 1: 데이터 계약 및 픽스처 동결 (현재)**
   - 본 PR의 데이터 계약, 재현성 계약, 픽스처 해시 검증 프로토콜 공식 승인.
2. **Phase 2: 코어 계산 엔진 및 결정론적 시뮬레이터 (Engine First)**
   - Python NumPy 기반 핵심 공학 수식(`die_yield`, `etch_rate`, `cpk_ppk`) 단위 테스트(Pytest) 전수 통과를 목표로 검증.
   - PCG64 기반 3-Run 동일 해시 재현성 테스트 검증.
3. **Phase 3: Mode B 로컬 백엔드 & 영속 SQLite (API Layer)**
   - FastAPI 라우터 및 SQLite WAL 모드, 외래키 제약조건 연동.
4. **Phase 4: Next.js 프론트엔드 및 EKL 연동 (UI Layer)**
   - A03 디자인 토큰 및 흰색 배경(#FFFFFF) 기반 고충실도 UI 구현.
   - EKL L1/L2/L3 인터랙션 및 IndexedDB 메모 저장소 연동.
5. **Phase 5: Mode A 정적 빌드 배포 & A04 종합 검수**
   - Vercel 정적 배포 파이프라인 구축 및 A04 20개 테스트 시나리오 최종 승인.

---

## 9. A03 디자인 명세(PR #7) 및 사용자 최신 지시 연동성 평가

A03의 디자인 시스템 및 EKL 상호작용 명세(PR #7)와 2026-10-15 사용자 최신 지시사항을 엔지니어링 관점에서 검토한 결과:

1. **캔버스 배경색 규약 (#FFFFFF) 적용:**
   - 사용자 최신 지시에 따라 기본 캔버스 배경을 순백색 `#FFFFFF`로 확정한다. A03 토큰의 `color.surface.canvas=#F6F8FC`는 Tailwind 설정에서 `#FFFFFF`로 덮어쓰거나 A03의 후속 디자인 PR에서 수정되도록 조율한다.
2. **반도체 그린/에메랄드 3D 클레이 플레이스홀더 및 레이아웃 시프트 방지:**
   - 3D 완성 에셋을 지금 제작하지 않고, Wafer 및 Etch Chamber를 위한 교체 가능한 2개 이상의 이미지 슬롯(`assetId: "illustration.wafer.v1"`, `assetId: "illustration.etch-chamber.v1"`)을 준비한다.
   - **엔지니어링 조치:** 이미지 로딩 지연에 따른 레이아웃 시프트(CLS, Cumulative Layout Shift)를 방지하기 위해 CSS `aspect-ratio` 및 `object-fit: contain`을 강제하고 스켈레톤 UI를 제공한다.
   - **의미 색상 분리:** 3D 일러스트에 사용되는 에메랄드/그린 색상은 단순 장식용이며, 장비의 '정상(Normal)' 상태를 나타내는 시맨틱 상태 색상(`color.severity.normal.text`)과 명확히 격리한다.
3. **EKL 3단계 인터랙션 (L1/L2/L3) 정적 MDX 파이프라인:**
   - L1(툴팁, 비인터랙티브), L2(앵커 카드, 계산 예시), L3(우측 패널, 상세 MDX 및 메모) 구조는 Next.js App Router의 Server Components 및 정적 MDX 로더(`next-mdx-remote` 또는 `@next/mdx`)와 호환되도록 설계한다.
   - 보안을 위해 허용된 MDX 컴포넌트만 렌더링하는 컴포넌트 Allowlist 방식을 적용한다.

---

## 10. A04 QA 지적사항 (QA-F01 ~ QA-F06) 해결 매핑

| QA 이슈 ID | 심각도 | A04 지적 요약 | A02 아키텍처 해결안 및 문서 매핑 |
|---|---|---|---|
| **QA-F01** | High | 시드만으로는 재현 불가 (RNG 알고리즘, 클록, 순서 미정) | `simulation-reproducibility-contract.md`에 PCG64 알고리즘, 가상 클록(UTC 고정, 1초 틱), 정적 7요소 결정론적 정렬 키, 사이드카 체크섬 파일(`fixtures/checksums.sha256`) 검증 명시. |
| **QA-F02** | High | SQLite 외래키 미강제, 트랜잭션/동시성/복구 정책 부재 | 본 문서 제3절에 `PRAGMA foreign_keys=ON;`, WAL 저널 모드, `BEGIN IMMEDIATE`, `VACUUM INTO` 백업, `busy_timeout` 점진적 슬립 및 앱 계층 지수 백오프/재시도 정책, 서버리스 임시 파일 배치 금지 규약 명시. |
| **QA-F03** | Medium | IndexedDB 데이터 손실 경고, 내보내기/가져오기 규격 부재 | 본 문서 제4절에 로컬 전용 한계 고지 UX, JSON 스키마(v1.0.0), XSS/수식 삽입 방지 살균 및 세션 기반 소프트 리셋 메모 보존, Factory Wipe 시 선택적 삭제 동의 명시. |
| **QA-F04** | High | 역할 전환기(Role Switcher)가 실제 보안 RBAC/감사로 오인될 위험 | 본 문서 제5절에 `viewPreference` 명명, 권한 없는 시뮬레이션 컨텍스트 헤더 명시, Mode C 이전 엔터프라이즈 감사/인가 클레임 전면 차단. |
| **QA-F05** | Medium | 이상 경고가 결함/인과관계를 확정하는 표현 사용 위험 | `domain-data-contract-v0.1.md` 제3.5절에 "SPC 경고는 조사의 근거일 뿐, 인과관계나 결함을 증명하지 않는다"는 비인과성 공학 원칙 신설 및 화면·조사 용어 통제 규약 명시. |
| **QA-F06** | High | 수식 추정량(Cpk sigma), 분모(Die Yield), 단위/부호 규약 공백 | `domain-data-contract-v0.1.md` 제6절에 다이 수율 에지 제외 분모식, 식각률 음수 편차(`SUSPECT_THICKNESS_INCREASE`, 임의 알람 금지), 전체 변동 기반 $P_p/P_{pk}$(표본 표준편차 $s$)와 군내 변동 기반 $C_p/C_{pk}$($\bar{R}/d_2, \bar{s}/c_4$) 추정량 분리 및 단측 규격 처리 명시. |


---

## 11. A01 기획자 결정 필요 항목 종합 (Decisions Pending A01)

다음 사항은 A01 기획자 및 프로젝트 오너의 최종 결재가 필요합니다.

1. **[A01 결정 필요 1-1] MVP 공식 배포 모드 확정:**
   - [ ] 안 1 (A02 권장): Mode A(온라인 Vercel 정적 쇼케이스) + Mode B(로컬 풀스택 시뮬레이터) 병행
   - [ ] 안 2: Mode B 단독 지원 (온라인 배포 제외)
   - [ ] 안 3: Mode A 단독 지원 (완전 클라이언트 전용)
2. **[A01 결정 필요 1-2] 시뮬레이션 리셋 시 로컬 데이터 보존 범위:**
   - [ ] 안 1 (A02 권장): 시뮬레이션 픽스처 상태만 리셋하고, IndexedDB 메모 및 로컬 조사 케이스는 보존 (별도 삭제 액션 제공)
   - [ ] 안 2: 시뮬레이션 리셋 시 로컬 조사 케이스까지 초기화하고 메모만 보존
   - [ ] 안 3: 모든 로컬 데이터 일괄 삭제
3. **[A01 결정 필요 1-3] Mode C (Supabase) 전환 마일스톤 기준 공식 승인:**
   - 실시간 다중 사용자 동시 편집, 엔터프라이즈 RBAC/RLS, 중앙 감사 로그 요구 발생 시점에 한하여 마이그레이션 착수.
4. **[A01 결정 필요 2-1] 공정능력지수(Cp/Cpk) 및 공정성능지수(Pp/Ppk) 추정량 분리 규약 승인:**
   - [ ] 안 1 (A02 제안 / 승인 대기): 전체 변동 기반 Pp/Ppk(표본 표준편차 s)와 군내 변동 기반 Cp/Cpk(R-bar/d2 또는 s-bar/c4)를 분리하고 EKL·API·화면에 추정량을 명시하는 제안안 승인
   - [ ] 안 2: 단일 지표(s 기반 Pp/Ppk)만 산출하고 화면 명칭을 Ppk로 통일
5. **[A01 결정 필요 2-2] 식각률 음수 편차(두께 증가) 발생 시 처리 정책:**
   - [ ] 안 1 (A02 제안 / 승인 대기): SUSPECT_THICKNESS_INCREASE 플래그 및 설명 표시 (음수값 유지, 자동 증착 단정 및 자동 알람 생성 금지) 제안안 승인
   - [ ] 안 2: 계산 에러(ERR_NEGATIVE_ETCH_RATE)로 간주하고 차트에 결측 표시
6. **[A01 결정 필요 3-1] 수치 반올림 표준 규칙 승인:**
   - [ ] 안 1 (A02 제안 / 승인 대기): 사사오입 (`ROUND_HALF_UP`)
   - [ ] 안 2: 은행원 반올림 (`ROUND_HALF_EVEN`)


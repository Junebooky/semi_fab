# FAB ONE — MVP 운영 모드 및 데이터 저장소 아키텍처 기술 검토 v0.7

- **문서 ID:** ARCH-DOC-001
- **상태:** PROPOSED (A01 기획자 및 프로젝트 오너 승인 대기)
- **개정 이력:**
  - v0.1 (2026-10-15): 초안 작성
  - v0.2 (2026-10-15): A01 검토의견 반영 (WAL 모드, 청크 트랜잭션, 세션 기반 소프트 리셋)
  - v0.3 (2026-10-15): A04 독립 검증 결과 수용 및 A01 수정 지시 반영
    - [F04] 공장 전체 초기화(Factory Wipe) 삭제 의존성 순서(외래키 CASCADE/RESTRICT 대상 전체 포괄) 및 단일 트랜잭션 롤백, 소프트 리셋과의 명확한 분리, IndexedDB 선택적 삭제 동의 명문화
    - [F05] SQLite 동시성 및 잠금 정책 현실화 (`busy_timeout=5000`의 내부 슬립 루프 동작 해설, 애플리케이션 레벨 지수 백오프/재시도 정책, `BEGIN IMMEDIATE`의 잠금 획득 실패 가능성 명시, 미검증 '100% 보장' 표현을 조건부 설계 표현으로 교정)
    - [F08] A04 QA-F05 지적사항 해결 매핑 경로 정정 (`domain-data-contract-v0.1.md` §3.5 SPC 비인과성 원칙으로 수정)
  - v0.4 (2026-10-15): A04 2차 독립 검증 결과 수용 및 A01 통합 수정 지시 반영
    - [F04] 공장 초기화(Factory Wipe) 범위 선택지 제시: 마스터 데이터 보존형(옵션 1: 실행/사건 이력 리셋, A02 권고) vs 전체 마스터 삭제형(옵션 2: 완전 공장 와이프), IndexedDB 비동기/비원자적 삭제 오류 복구(Self-healing cleanup) 메커니즘 반영
    - [F05] SQLite 동시성 락 메커니즘 정밀화: 무조건적 "SQLITE_LOCKED 방지" 단정 표현 삭제, 파일/WAL 쓰기 락 경합인 `SQLITE_BUSY`와 동일 연결 내 커서/공유 캐시 충돌인 `SQLITE_LOCKED`의 명확한 구별 및 예방 가이드라인 수립
  - v0.5 (2026-10-15): A04 3차 독립 검증 결과 및 A01 잔여 계약 수정 지시 반영
    - [F02] 센서 계측치 `(measured_value=NULL, quality_flag='GOOD')` 불일치 차단 DDL CHECK 제약조건 보완 매핑
    - [F04] 공장 초기화(Factory Wipe) 단일 표준 사전 의도 기록 계약(`fab_factory_wipe_intent`, `operationId`, `status: INTENT_RECORDED/SERVER_COMMITTED`, `POST /api/v1/admin/factory-wipe`, `GET /status`), 서버 내구적 저널(`system_operation_journal`) 및 멱등 커밋 보장, 네트워크 타임아웃 시 자동 롤백 속단 배제, 커밋 미확인 시 IndexedDB 삭제 절대 금지 가드레일, 13종 장애 복구 매트릭스 수립 (`simulation-reproducibility-contract.md` §7.2와 100% 일치)
    - [F06] 부분군 표본 크기 $k \ge 5$ 및 $N \ge 20$ 경계 분리, 평가 상태 우선순위 계층(`EVALUATION_INVALID` > `ASSUMPTION_WARNING` > `ONE_SIDED_SPEC_EVALUATED` > `OK`) 및 경고 배열(`warnings: []`) 도입 매핑
    - [F07] `event_id` 생성 해시 입력에 `entity_type` 추가, 동일 `event_id` 상이한 페이로드 유입 시 `EVENT_PAYLOAD_CONFLICT` 명시적 거부 및 트랜잭션 롤백 기반 부분 영속화 배제(Zero Partial Persistence) 매핑
    - [F09] `PROCESS_RUN` ERD-TypeScript 필드 완전 일치(`runStatus` 5대 표준 상태, `startTimeUtc` 필수, `endTimeUtc` 선택), `fixtures/manifest.json` 스키마 및 검증 규칙 정립 매핑
  - v0.6 (2026-10-15): A01 공식 업무 지시 반영 및 F04 복구 계약 최종 완결
    - [F04] Stale PENDING 복구: 워커 리스(`lease_expires_at_utc`, 30초 만료) 및 서버 재기동/조회 시 `FAILED (WORKER_CRASH_LEASE_EXPIRED)` 자동 전이 기반 영구 409 락 원천 방지 및 신규 `operationId` 발급 요구 확립
    - [F04] UNKNOWN 취소 안전성: `POST /api/v1/admin/factory-wipe/cancel` 엔드포인트 및 `CANCELLED` 톰스톤 서버 펜싱 도입, 지연 커밋 경합 시 `CANNOT_CANCEL_ALREADY_COMMITTED` 거절 및 `SERVER_COMMITTED` 승격으로 사용자 메모 유실 방지
    - [F04] operationId 재사용 및 범위 검증: 동일 `operationId` 상이한 `wipeOption` 유입 시 `OPERATION_SCOPE_MISMATCH` (HTTP 409) fail-closed 차단, 동일 옵션 시 멱등 200 OK 보장, `purgeIndexedDbRequested=false` 메모 보존 불변식 엄격 유지
    - [F04] 13종 장애 복구 명세 매트릭스 (`WIPE-CRASH-01` ~ `13`) 완결
  - v0.7 (2026-10-15): A01 재검토 의견 반영 및 F04 삭제 트랜잭션 실행 안전성(Pre-Delete Guardrail) 보완
    - [F04] Phase 2 삭제 전 실행권 검증(Pre-Delete Guardrail): `BEGIN IMMEDIATE` 직후 `operationId`, worker 소유권, `PENDING` 상태, 유효 리스(`lease_expires_at_utc >= now`), `wipeOption`을 검증하여 불일치 시 `DELETE` 일체 없이 즉시 `ROLLBACK` 명시
    - [F04] 저널 종결 원자성 및 1행 갱신 강제: `UPDATE ... WHERE status='PENDING'`의 `rowcount == 1` 확인 필수, 미달 시 전체 `DELETE` 강제 `ROLLBACK` 및 0행 삭제 불변식 확립 (지연 워커의 FAILED/CANCELLED 후 무단 삭제 반례 원천 차단)
    - [F04] `POST /cancel` 원자적 CAS(`changes == 1`) 및 트랜잭션 2와의 상호 배타성 명문화, 전역 단일 와이프 가드(`GLOBAL_WIPE_IN_PROGRESS`) 및 MVP 와이프 기본 비활성화 선언
    - [F04] 기존 13종 복구 매트릭스(`WIPE-CRASH-01` ~ `13`) 유지 및 WIPE-CRASH-10/11/13에 지연 워커 반례 기대값(삭제 0행, 원상 보존) 보강, 미검증 단정 표현 교정
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
- **효과 및 상호 배제 특성:**
  - 읽기 작업(Readers)과 쓰기 작업(Writer)이 서로를 블로킹하지 않는다. 다수의 Next.js 대시보드 읽기 쿼리가 실행되는 도중 시뮬레이터가 센서 데이터를 인서트하더라도 읽기-쓰기 간 락 경합에 의한 `SQLITE_BUSY` 발생을 대폭 완화한다.
- **`SQLITE_BUSY` vs `SQLITE_LOCKED` 메커니즘 구별 및 예방 규약 ([F05] 해결):**
  - **`SQLITE_BUSY` (연결 간 파일/WAL 쓰기 락 경합):**
    - 발생 원인: 복수의 서로 다른 커넥션이 동시에 쓰기 트랜잭션(`BEGIN IMMEDIATE` 등)을 시작하거나 체크포인트를 수행할 때 발생.
    - 예방 대책: `busy_timeout` 설정, 애플리케이션 계층 지수 백오프/재시도 정책, 쓰기 전담 단일 커넥션 풀(Single-writer pool) 아키텍처 강제.
  - **`SQLITE_LOCKED` (동일 연결 내 커서/공유 캐시 충돌):**
    - 발생 원인: 동일한 커넥션 내에서 활성 커서(Active Cursor/Select 루프)가 열려 있는 상태에서 테이블 스키마를 변경(DDL)하거나 쓰기 쿼리를 수행할 때, 또는 SQLite 공유 캐시(Shared Cache) 모드에서 충돌할 때 발생.
    - 예방 대책: WAL 모드 설정만으로는 `SQLITE_LOCKED`를 자동 방지할 수 없다. 백엔드 Repository 계층에서 트랜잭션 수명주기를 엄격히 분리하고, 비동기 커서 누수(Cursor Leaks)를 방지하며, 단일 요청 컨텍스트 내에서 읽기 완료 전 쓰기 재진입을 철저히 차단하는 클린 코드 가이드라인을 강제한다.
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
- **공장 전체 초기화 (Factory Wipe, 파괴적 관리자 작업) ([F04] v0.7 선택지 및 복구 상태 계약):**
  1. 소프트 리셋과 엄격히 분리된 별도 파괴적 작업으로 정의한다.
  2. **초기화 범위 선택지 및 상태 규정:**
     - **옵션 1 (실행·사건 이력 초기화 — A02 MVP 공식 권고안):** 설비 마스터(`EQUIPMENT`, `CHAMBER`), 레시피(`RECIPE`), 로트(`LOT`), 웨이퍼(`WAFER`)의 기준 정보는 온전히 보존하고, 동적 실행 데이터만 외래키 역순으로 안전하게 삭제한다 (`CASE_ACTION_LOG` $\to$ `INVESTIGATION_CASE` $\to$ `FDC_ALERT` $\to$ `SENSOR_MEASUREMENT` $\to$ `PROCESS_RUN_WAFER` $\to$ `WAFER_DEFECT_MAP` $\to$ `PROCESS_RUN` $\to$ `SIMULATION_SESSION`). 기준 데이터가 보존되므로 시뮬레이터를 즉시 재가동하여 지속적인 데모 및 테스트가 가능하다.
     - **옵션 2 (완전 공장 및 마스터 데이터 와이프 — 프로젝트 오너 승인 전 미확정 / PENDING OWNER APPROVAL):** 동적 실행 데이터뿐 아니라 전체 설비/레시피/로트 마스터 데이터까지 전체 테이블을 삭제한다. 단, SQLite 파일 자체는 기본 페이지 할당(헤더 및 스키마 메타데이터 구조, 통상 4KB~8KB 이상)을 유지하며 "0바이트 파일"이 아님을 명확히 정의한다. 옵션 2 수행 시에는 외부 JSON 시드 픽스처 재적재가 필수이며, 프로젝트 오너의 명시적 승인 전까지는 UI에서 비활성화된 미확정 상태로 표시한다.
  3. **단일 트랜잭션 원자성:** 역순 삭제는 단일 `BEGIN IMMEDIATE ... COMMIT` 내에서 수행하며 오류 발생 시 즉시 `ROLLBACK`하여 불완전한 삭제 상태를 방지한다.
  4. **2단계 확인:** 파괴적 작업 확인을 위해 경고 모달 표시 및 `"FACTORY-WIPE-CONFIRM"` 텍스트 입력을 강제한다.
  5. **사전 의도 기록 프로토콜 (Pre-Intent Logging Protocol, `simulation-reproducibility-contract.md` §7.2와 100% 일치):**
     클라이언트 브라우저와 백엔드 간 비원자적 네트워크/스토리지 경계를 극복하기 위해 파괴적 작업 수행 전 영속 스토리지(`localStorage`)에 삭제 의도를 선제적으로 기록하고, 서버의 내구적 저널을 확인한 후 안전하게 복구 및 동기화하는 단일 표준 프로토콜을 강제한다:
     - **단계 1 (의도 기록):** 파괴적 서버 요청 전송 직전 클라이언트의 `localStorage`에 표준 키 `fab_factory_wipe_intent`로 작업 식별자(`operationId`), 타임스탬프, 초기화 옵션(`wipeOption`), 메모 삭제 동의 여부(`purgeIndexedDbRequested`), 의도 상태(`status: INTENT_RECORDED`)를 원자적으로 기록한다:
       ```javascript
       localStorage.setItem('fab_factory_wipe_intent', JSON.stringify({
         operationId: 'wipe-' + crypto.randomUUID(),
         timestampUtc: new Date().toISOString(),
         wipeOption: 'OPTION_1',
         purgeIndexedDbRequested: true,
         status: 'INTENT_RECORDED'
       }));
       ```
       - *가드레일:* 브라우저 시크릿 모드나 용량 제한 등으로 `localStorage.setItem` 실패 시, 서버 요청을 일체 전송하지 않고 즉시 **Fail-Closed로 중단**한다.
     - **단계 2 (서버 파괴적 실행, Pre-Delete 실행권 검증 및 종결 원자성 보장):** **
       클라이언트는 표준 API 엔드포인트 `POST /api/v1/admin/factory-wipe`로 삭제를 요청한다:
       ```json
       {
         "operationId": "wipe-550e8400-e29b-41d4-a716-446655440000",
         "wipeOption": "OPTION_1",
         "confirmationPhrase": "FACTORY-WIPE-CONFIRM"
       }
       ```
       백엔드는 삭제 대상 외부에 영구 보존되는 내구적 작업 저널(`system_operation_journal`)을 관리한다:
       ```sql
       CREATE TABLE IF NOT EXISTS system_operation_journal (
           operation_id TEXT PRIMARY KEY,
           operation_type TEXT NOT NULL,         -- 'FACTORY_WIPE'
           wipe_option TEXT NOT NULL,            -- 'OPTION_1' | 'OPTION_2' | 'UNKNOWN'
           status TEXT NOT NULL,                 -- 'PENDING', 'COMMITTED', 'FAILED', 'CANCELLED'
           worker_id TEXT,                       -- 처리 워커 인스턴스 식별자
           lease_expires_at_utc TEXT NOT NULL,   -- 워커 실행 리스 만료 시각 (started_at + 30s)
           heartbeat_at_utc TEXT,                -- 워커 하트비트 시각
           started_at_utc TEXT NOT NULL,
           committed_at_utc TEXT,
           error_message TEXT
       );
       ```

       - **MVP 운영 환경 한계 및 파괴적 공장 초기화 기본 비활성화 선언:**
         - FAB ONE MVP (Mode B)는 **로컬 단일 사용자(Single-User Local Desktop)** 환경으로 한정된다.
         - 파괴적 공장 초기화(Factory Wipe) 기능은 데이터 안전을 위해 **기본 비활성화(Disabled by default)** 상태로 봉인되며, 프로젝트 오너의 명시적 승인 전까지는 UI 및 실행 API 엔드포인트가 비활성화 상태를 유지한다.

       - **F04-P0 단일 UTC 리스 TEXT 계약:** `started_at_utc`, `lease_expires_at_utc`, `heartbeat_at_utc`, `committed_at_utc` 및 모든 비교 파라미터 `:now`는 **`YYYY-MM-DDTHH:MM:SS.sssZ`(UTC 고정 3자리 밀리초)**로 생성·저장한다. `:now`는 각 트랜잭션의 판정 시점마다 단일 SQLite UTC 시계 `strftime('%Y-%m-%dT%H:%M:%fZ','now')`로 새로 생성·바인딩한다(Phase 1 시각을 Phase 2/3에 재사용하지 않음). Phase 1 리스 만료는 같은 `:now`에 `+30 seconds`를 더해 **동일 형식**으로 기록한다. `datetime()` 공백형, 타임존 오프셋, 초 정밀도 시각 등 혼합 포맷 행은 비교 전에 정규화 검증되지 않으면 실행 fail-closed; TEXT 사전식 비교에 혼합 금지. `lease >= :now`이면 아직 유효(동률 포함), `lease < :now`이면 만료로 간주한다. 반례: `'2026-10-15 16:17:30' >= '2026-10-15T16:17:10.000Z'`는 `0`이나, 정규화한 `'2026-10-15T16:17:30.000Z' >= '2026-10-15T16:17:10.000Z'`는 `1`, 이 경우 `<`는 `0`이다. 이 동일 경계를 전역 가드/stale CAS/pre-delete/COMMITTED CAS/취소 경합 모두에 적용한다.

       - **전역 단일 활성 와이프 가드 (Global Active Wipe Guard):**
         - 서로 다른 `operationId`를 가진 파괴 요청이 동시에 유입되어 경합하는 것을 차단하기 위해, 서버는 트랜잭션 1(`BEGIN IMMEDIATE`)에서 현재 유효한 리스를 가진 `PENDING` 작업이 존재하는지 전역 검사한다:
           ```sql
           SELECT operation_id FROM system_operation_journal
           WHERE status = 'PENDING' AND lease_expires_at_utc >= :now;
           ```
           만약 유효한 활성 작업이 이미 존재한다면, 신규 요청을 즉시 **HTTP 409 Conflict (`GLOBAL_WIPE_IN_PROGRESS`)**로 거부하여 복수 와이프의 동시 실행을 원천 차단한다.

       - **동일 `operationId` 범위 검증(Scope Verification) 및 멱등성 규칙:**
         - 저널에 동일 `operation_id`가 이미 존재하는 경우, 백엔드는 즉시 유입된 `wipeOption`과 기존 저널의 `wipe_option`을 비교 검증한다.
         - **범위 불일치(`wipeOption` 불일치):** 동일한 `operationId`에 서로 다른 초기화 범위(예: 저널은 `OPTION_1`인데 신규 요청은 `OPTION_2`)가 요청되면 **HTTP 409 Conflict (`OPERATION_SCOPE_MISMATCH`)로 fail-closed 즉시 거부**하며, 기존 작업의 상태를 일체 변경하지 않는다.
         - **범위 일치(`wipeOption` 일치):**
           - `status == 'COMMITTED'`: 이미 성공적으로 완료된 작업이므로 물리적 재삭제를 수행하지 않고 기존 커밋 메타데이터를 즉시 **HTTP 200 OK로 반환**하여 안전한 멱등성을 보장한다.
           - `status == 'PENDING'`: 아래 워커 리스 만료 여부를 검사한다.
           - `status == 'FAILED'`: 이전 실행이 실패한 작업이므로 **HTTP 400 Bad Request (`OPERATION_ALREADY_FAILED`)**를 반환하고 클라이언트에 신규 `operationId` 발급을 요구한다.
           - `status == 'CANCELLED'`: 이미 취소된 작업이므로 **HTTP 409 Conflict (`OPERATION_ALREADY_CANCELLED`)**를 반환하고 신규 `operationId` 발급을 요구한다.
         - **요청 범위(`wipeOption`)와 클라이언트 메모 삭제 동의(`purgeIndexedDbRequested`)의 스코프 분리:**
           `purgeIndexedDbRequested`는 브라우저 로컬 저장소(IndexedDB)에 대한 클라이언트 단독 처리 플래그이며, 서버 SQLite 파괴 범위(`wipeOption`)와 엄격히 분리된다. 서버는 오직 `wipeOption`(`OPTION_1` vs `OPTION_2`)의 일치 여부만 저널에 기록하고 검증한다.

       - **워커 리스(Worker Lease) 및 Stale PENDING 복구 규칙:**
         - 서버가 트랜잭션 1에서 `PENDING`을 기록한 직후 프로세스가 비정상 종료(SIGKILL, OOM, 전원 장애)되거나 트랜잭션 2 도중 크래시가 발생할 경우, 저널에 `PENDING` 상태가 영구 고착되는 결함(Stale PENDING)을 방지하기 위해 **30초 만료 리스(`lease_expires_at_utc = started_at + 30s`)**를 강제한다.
         - **복구 트리거 및 안전 전이 (No Auto-Resume / No Duplicate Execution):**
           - 서버 재기동 시의 복구 백그라운드 태스크 또는 클라이언트의 상태 조회(`GET /status`) / 재요청(`POST /factory-wipe`) 인입 시, `status == 'PENDING'`이고 `utc_now() > lease_expires_at_utc`인 경우 **워커 크래시로 판정**한다.
           - 서버는 파괴적 삭제 작업을 절대 자동 재개(Auto-Resume)하거나 백그라운드에서 중복 실행하지 않고, 단일 복구 트랜잭션으로 상태를 종결 처리한다:
             ```sql
             BEGIN IMMEDIATE;
             UPDATE system_operation_journal
             SET status = 'FAILED',
                 error_message = 'WORKER_CRASH_LEASE_EXPIRED: Worker lease expired without completion'
             WHERE operation_id = :operation_id
               AND status = 'PENDING'
               AND lease_expires_at_utc < :now;
             COMMIT;
             ```
           - 이를 통해 영구적인 HTTP 409 락(`OPERATION_IN_PROGRESS`) 발생을 원천 차단하며, 클라이언트는 확정된 `FAILED` 상태를 통보받아 비파괴적으로 안전하게 복구하고 신규 `operationId`로 안전하게 재시도할 수 있다.

       - **3단계 원자적 트랜잭션 실행 절차 (Pre-Delete Guardrail 및 종결 1행 검증):**
         1. **트랜잭션 1 (작업 예약 및 리스 할당 원자적 커밋):**
            ```sql
            BEGIN IMMEDIATE;
            -- 전역 단일 작업 검사
            SELECT operation_id FROM system_operation_journal
            WHERE status = 'PENDING' AND lease_expires_at_utc >= :now;
            -- (활성 PENDING 존재 시 ROLLBACK 및 409 GLOBAL_WIPE_IN_PROGRESS 반환)

            INSERT INTO system_operation_journal (
                operation_id, operation_type, wipe_option, status,
                worker_id, lease_expires_at_utc, started_at_utc
            ) VALUES (
                :operation_id, 'FACTORY_WIPE', :wipe_option, 'PENDING',
                :worker_id, strftime('%Y-%m-%dT%H:%M:%fZ', :now, '+30 seconds'), :now
            );
            COMMIT;
            ```
            *(이제 외부 독립 조회 연결에서도 `status: 'PENDING'` 및 리스 만료 시각이 즉시 가시화됨)*
         2. **트랜잭션 2 (실제 파괴적 역순 삭제 및 3단계 원자적 가드레일 실행):**
            ```sql
            BEGIN IMMEDIATE;

            -- [가드레일 2-1: 삭제 전 실행권 및 락 상태 원자적 검증 (Pre-Delete Fencing)]
            -- 어떠한 DELETE도 실행하기 전에 동일 트랜잭션 내에서 현재 저널 레코드를 즉시 조회한다.
            SELECT operation_id, wipe_option, worker_id, lease_expires_at_utc, status
            FROM system_operation_journal
            WHERE operation_id = :operation_id;

            -- [애플리케이션 계층 필수 판정 로직]
            -- 조건: 레코드 존재 AND status == 'PENDING' AND worker_id == :my_worker_id
            --       AND lease_expires_at_utc >= :now AND wipe_option == :expected_wipe_option
            -- 판정 실패 시 (예: 이미 FAILED/CANCELLED 전이됨, 리스 만료됨, 워커 소유권 상실):
            -- -> 즉시 ROLLBACK 실행! (*** 단 1건의 DELETE도 실행하지 않고 롤백하여 데이터 완전 원상 보존 (Zero Rows Deleted) ***)
            -- -> StaleWorkerExecutionError 발생 및 Phase 2 즉각 종료.

            -- [실행 단계 2-2: 역순 의존성 데이터 삭제 (가드레일 통과 시에만 실행)]
            DELETE FROM case_action_log;
            DELETE FROM investigation_case;
            DELETE FROM fdc_alert;
            DELETE FROM sensor_measurement;
            DELETE FROM process_run_wafer;
            DELETE FROM wafer_defect_map;
            DELETE FROM process_run;
            DELETE FROM simulation_session;

            -- [가드레일 2-3: 저널 완료 원자적 전이 및 1행 갱신 강제 검증 (Rowcount Verification)]
            UPDATE system_operation_journal
            SET status = 'COMMITTED', committed_at_utc = :now
            WHERE operation_id = :operation_id
              AND worker_id = :my_worker_id
              AND status = 'PENDING'
              AND lease_expires_at_utc >= :now;

            -- [애플리케이션 계층 영향 행 수 검증 (changes == 1 필수)]
            -- IF (cursor.rowcount != 1 OR sqlite3_changes() != 1) THEN
            --     ROLLBACK; -- *** 핵심: 저널 정상 전이 실패 시 이전 모든 DELETE를 강제 롤백 (0 committed rows) ***
            --     RAISE JournalCommitMismatchError("Rowcount mismatch on journal commit, full rollback enforced");
            -- ELSE
            --     COMMIT;   -- 정확히 1행 갱신 성공이 확인된 경우에만 최종 커밋
            -- END IF;
            ```
         3. **예외/오류 시 처리 (트랜잭션 3):**
            트랜잭션 2의 **실제 실행 오류** 발생 시 먼저 `ROLLBACK`하고, 별도 `BEGIN IMMEDIATE`에서 **현재 워커가 소유한 `PENDING`만** `FAILED`로 전이한다. Pre-Delete 거부, 취소 확정, 리스 상실 및 확정 종결 상태는 Phase 3의 강제 FAILED 대상이 아니다. `COMMITTED/CANCELLED/FAILED` 종결은 단조·불변이다.
            ```sql
            BEGIN IMMEDIATE;
            UPDATE system_operation_journal
            SET status = 'FAILED', error_message = :err
            WHERE operation_id = :operation_id
              AND status = 'PENDING'
              AND worker_id = :my_worker_id;
            -- cursor.rowcount == 1: COMMIT, FAILED 확정
            -- cursor.rowcount == 0: ROLLBACK 후 현재 상태 재조회; 종결 상태 절대 덮어쓰기 금지
            ```
            별도 오류 처리 COMMIT 자체가 실패/불명확하면 서버는 `UNKNOWN`으로 처리하고 재조회·복구한다. 만료 `PENDING`은 오직 기존 stale lease CAS로 회수한다.

     - **단계 3 (서버 커밋 확인 후 클라이언트 상태 승격 및 `UNKNOWN` 취소 안전성):**
       - **핵심 안전 불변식 (Crucial Safety Invariant):**
         **서버의 커밋 결과가 `COMMITTED`로 공식 확인되기 전에는 어떠한 경우에도 클라이언트 IndexedDB 삭제를 진행하지 않는다.**
       - **`UNKNOWN`에 대한 엄격한 해석 및 인텐트 유지 규약:**
         `GET /api/v1/admin/factory-wipe/status?operationId={operationId}` 조회 결과가 `UNKNOWN`인 것은 **"서버 트랜잭션이 실패했거나 롤백되었음"을 의미하지 않는다.** 서버가 트랜잭션 1 커밋 전 락 획득 대기 중이거나 네트워크 요청이 지연 중일 수 있으므로:
         1. 클라이언트는 **로컬 인텐트(`status: INTENT_RECORDED`)를 절대 폐기하지 않고 유지**한다.
         2. 최대 3회 점진적 지수 백오프(500ms, 1s, 2s)로 재조회를 수행한다.
         3. 재조회 후에도 `UNKNOWN`이 지속될 경우, 사용자에게 수동 복구 모달("서버 처리 결과를 확인할 수 없습니다. 메모를 보존한 채 재조회하거나 요청을 공식 취소하세요")을 노출한다.

       - **공식 취소 API 엔드포인트 및 원자적 CAS 펜싱 (`POST /cancel`):**
         사용자가 `UNKNOWN` 또는 진행 중 상태에서 취소를 요청할 경우, 클라이언트는 로컬 인텐트를 일방적으로 삭제하지 않고 **서버에 공식 취소 요청을 전송하여 원자적 비교-전이(CAS) 및 서버 사이드 펜싱**을 확정해야 한다:
         - 엔드포인트: `POST /api/v1/admin/factory-wipe/cancel`
         - 페이로드:
           ```json
           {
             "operationId": "wipe-550e8400-e29b-41d4-a716-446655440000",
             "reason": "USER_CANCELLED"
           }
           ```
         - **서버 취소 처리 및 경합 제어 (CAS & Mutual Exclusion):**
           취소 요청은 `BEGIN IMMEDIATE` 트랜잭션으로 실행되어 Phase 2 트랜잭션과 SQLite 쓰기 락 수준에서 직렬화된다:
           - **케이스 A (저널 미등록 상태 / 사전 펜싱 톰스톤):**
             서버에 아직 해당 `operationId`가 등록되지 않은 경우(요청 지연 중), 저널에 즉시 취소 톰스톤(Tombstone)을 삽입한다:
             ```sql
             INSERT INTO system_operation_journal (
                 operation_id, operation_type, wipe_option, status,
                 worker_id, lease_expires_at_utc, started_at_utc, error_message
             ) VALUES (
                 :operation_id, 'FACTORY_WIPE', 'UNKNOWN', 'CANCELLED',
                 'CLIENT_CANCEL', :now, :now, 'CANCELLED_BEFORE_EXECUTION'
             );
             COMMIT;
             ```
             뒤늦게 지연 도착한 원본 트랜잭션 1은 PK 충돌로 실패하거나, 지연 Phase 2는 Pre-Delete Guardrail(`status == 'CANCELLED'`)에 의해 **DELETE 없이 즉시 롤백**된다. 서버는 HTTP 200 OK (`status: 'CANCELLED'`)를 반환한다.
           - **케이스 B (`PENDING` 진행 중 상태 / 원자적 CAS 전이):**
             ```sql
             BEGIN IMMEDIATE;
             UPDATE system_operation_journal
             SET status = 'CANCELLED', error_message = :reason
             WHERE operation_id = :operation_id AND status = 'PENDING';
             -- changes == 1 확인 시: COMMIT; -> HTTP 200 OK (status: 'CANCELLED')
             ```
             원자적 CAS가 성공(1행 갱신)하면 트랜잭션이 커밋된다. 이후 실행되는 지연 Phase 2는 Pre-Delete Guardrail에서 `status == 'CANCELLED'`를 확인하고 **DELETE를 일체 실행하지 않고 즉시 ROLLBACK**하므로, 취소된 작업의 지연 파괴가 방어된다.
           - **케이스 C (`COMMITTED` 선행 커밋 경합 상태 - 핵심 안전 가드):**
             사용자가 취소를 클릭한 시점에 이미 지연된 원본 요청이 Phase 2를 성공적으로 마치고 `COMMITTED`로 완료된 경우:
             위 CAS `UPDATE ... WHERE status='PENDING'`은 0행(`changes == 0`)을 반환한다. 서버는 현재 상태가 `COMMITTED`임을 확인하고 트랜잭션을 롤백한 뒤 **HTTP 409 Conflict (`{"error": "CANNOT_CANCEL_ALREADY_COMMITTED", "status": "COMMITTED"}`)**를 응답한다.
             - *클라이언트 대응:* 클라이언트는 취소 실패 응답을 수신하면 인텐트를 삭제하지 않고 즉시 **`SERVER_COMMITTED`로 승격**하여 4단계로 진입한다. 이로써 `purgeIndexedDbRequested` 설정(예: 메모 보존 요청 시 IndexedDB 보존)에 따른 동기화가 정상 완결되며, 사용자의 메모가 유실되는 위험을 방어하도록 설계한다.
         - **클라이언트 인텐트 소거 조건:**
           클라이언트는 서버로부터 `CANCELLED` 응답이 공식 확인된 경우에만 `localStorage.removeItem('fab_factory_wipe_intent')`를 안전하게 실행하여 인텐트를 소거한다. 네트워크 장애로 취소 확인이 불가능하면 인텐트를 보존(`cancelRequested: true`)한다.

       - 서버 상태가 `COMMITTED`로 공식 확인된 경우에만 클라이언트 인텐트를 `"SERVER_COMMITTED"`로 승격한다:
         ```javascript
         const intent = JSON.parse(localStorage.getItem('fab_factory_wipe_intent'));
         intent.status = 'SERVER_COMMITTED';
         localStorage.setItem('fab_factory_wipe_intent', JSON.stringify(intent));
         ```

     - **단계 4 (IndexedDB 처리 및 의도 레코드 안전 소거):**
       - `purgeIndexedDbRequested === true`: `indexedDB.deleteDatabase('fab_one_user_notes')`를 비동기 실행하고, 성공 콜백에서 `localStorage.removeItem('fab_factory_wipe_intent')`를 호출하여 인텐트 레코드를 최종 제거한다.
       - `purgeIndexedDbRequested === false`: IndexedDB 삭제 단계를 **완전히 건너뛰고(Bypass)** 즉시 `localStorage.removeItem('fab_factory_wipe_intent')`를 호출하여 개인 메모를 안전하게 보존한다.


  6. **13종 충돌/복구 시퀀스 테스트 매트릭스 (Crash & Recovery Specification Vectors):**
    | 시나리오 ID | 장애 및 비정상 중단 시점 | 서버 상태 (`system_operation_journal`) | 클라이언트 영속 상태 (`fab_factory_wipe_intent`) | 재기동/재시도 시 복구 절차 | 최종 기대 결과 |
    |---|---|---|---|---|---|
    | **WIPE-CRASH-01** (Vector a) | 인텐트 기록 후 서버 호출 전 탭 닫힘 (실제 미실행) | 기록 없음 (`UNKNOWN`) | `status: INTENT_RECORDED` | 재기동 시 `GET /status?operationId` 조회 $\to$ `UNKNOWN` 반환. 3회 재조회 후 미등록 확인 $\to$ `POST /cancel` 호출(서버 톰스톤 등록) $\to$ `localStorage.removeItem`. | 작업 미시작, 서버 데이터 및 IndexedDB 메모 온전 보존 |
    | **WIPE-CRASH-02** (Vector b-1) | 네트워크 타임아웃 중 **서버 실제 COMMIT 성공** | `status: COMMITTED` | `status: INTENT_RECORDED` (타임아웃 에러 수신) | 클라이언트가 `GET /status?operationId` 조회 $\to$ 서버 실제 `COMMITTED` 확인 $\to$ 로컬 인텐트 `SERVER_COMMITTED` 승격 $\to$ `purgeIndexedDbRequested` 값에 따라 후속 처리. | 서버 동적 이력 정상 초기화, IndexedDB 안전 삭제 진행 |
    | **WIPE-CRASH-03** (Vector b-2) | 네트워크 타임아웃 중 **서버 실제 롤백/실패** | `status: FAILED` | `status: INTENT_RECORDED` (타임아웃 에러 수신) | 클라이언트가 `GET /status?operationId` 조회 $\to$ 서버 실패(`FAILED`) 확인 $\to$ **IndexedDB 절대 삭제 금지** $\to$ "서버 초기화 실패: 데이터 보존됨" 안내 노출 및 인텐트 유지 후 새 요청 유도. | 서버 데이터 무결성 보존, IndexedDB 메모 안전 보존 |
    | **WIPE-CRASH-04** (Vector b-3) | 타임아웃 직후 1차 조회 시 일시적 `UNKNOWN`/`PENDING`이나 잠시 후 서버가 COMMIT 완료 | 트랜잭션 1 직후 `PENDING` $\to$ 잠시 후 `COMMITTED` | `status: INTENT_RECORDED` | 1차 조회 시 `UNKNOWN` 또는 `PENDING` 반환 $\to$ 클라이언트는 인텐트를 폐기하지 않고 대기 루프(지수 백오프)로 재조회 $\to$ 서버 트랜잭션 2 커밋 후 후속 조회에서 `COMMITTED` 확인 $\to$ 정상 승격 및 동기화 완료. | 경합 상황에서도 인텐트 유실 및 고아 데이터 없이 최종 정합성 보장 |
    | **WIPE-CRASH-05** (Vector c) | 서버 COMMIT 완료 직후, 클라이언트 응답 수신 전 크래시 | `status: COMMITTED` | `status: INTENT_RECORDED` | 재기동 시 `GET /status?operationId` 조회 $\to$ `COMMITTED` 확인 $\to$ `SERVER_COMMITTED` 승격 $\to$ `purgeIndexedDbRequested`에 따라 후속 처리. | 고아 데이터 방지, 서버-클라이언트 상태 완전 일치 |
    | **WIPE-CRASH-06** (Vector d) | 브라우저 저장소 접근 불가 (Private 모드 / Quota 에러) | 호출 없음 (`UNKNOWN`) | `localStorage.setItem` 실패 예외 발생 | 인텐트 기록 실패 시 서버 파괴 요청을 일체 전송하지 않고 즉시 **Fail-Closed 차단** ("저장소 접근 불가로 초기화 중단"). | 파괴적 작업 미실행, 비가역 데이터 유실 방지 |
    | **WIPE-CRASH-07** (Vector e) | IndexedDB 삭제 도중 브라우저 탭 강제 종료 | `status: COMMITTED` | `status: SERVER_COMMITTED` (잔여 메모 존재 가능) | 재기동 시 `SERVER_COMMITTED` 감지 $\to$ 서버 재호출 없이 `indexedDB.deleteDatabase` 재호출(멱등성) $\to$ 성공 시 `localStorage.removeItem`. | 자가 복구 완료, 클린 초기 상태 환원 |
    | **WIPE-CRASH-08** (Vector f) | **IndexedDB 삭제 미동의 케이스** (`purgeIndexedDbRequested: false`) | `status: COMMITTED` | `status: INTENT_RECORDED` $\to$ `SERVER_COMMITTED` | 서버 `COMMITTED` 확인 후 `SERVER_COMMITTED` 승격 즉시 **IndexedDB 삭제 단계를 완전히 건너뛰고(Bypass)** $\to$ `localStorage.removeItem`. | 서버 이력 초기화 완료, **IndexedDB 메모 안전 보존** |
    | **WIPE-CRASH-09** (Vector g) | 네트워크 영구 단절 / 상태 조회 불능 상태 지속 | 상태 확인 불가 | `status: INTENT_RECORDED` 유지 | 상태 조회가 실패(네트워크 에러)하면 클라이언트는 인텐트를 영구 보존하고 IndexedDB 삭제를 일체 시도하지 않으며 오프라인 경고 모달 표시. | 네트워크 단절 상황에서 데이터 임의 삭제 방지 |
    | **WIPE-CRASH-10** (Vector h) | **Stale PENDING 복구 및 지연 워커 Phase 2 진입 반례 1** (트랜잭션 1 `PENDING` 커밋 후 워커 지연 $\to$ 리스 만료로 저널이 `FAILED` 전이된 후 지연 워커가 뒤늦게 Phase 2 실행 시도) | `status: FAILED (WORKER_CRASH_LEASE_EXPIRED)` | `status: INTENT_RECORDED` | 지연 워커가 Phase 2 진입 시 **Pre-Delete Guardrail**(`SELECT status, worker_id, lease_expires_at_utc`)을 먼저 실행 $\to$ `status != 'PENDING'` 및 리스 만료 감지 $\to$ **모든 DELETE 실행 없이 즉시 `ROLLBACK;` (0건 삭제)**. 설령 실행하더라도 종결 UPDATE `rowcount == 0` 감지 시 강제 `ROLLBACK;`. 클라이언트는 `GET /status`로 `FAILED` 확인 후 IndexedDB 메모 보존 및 신규 `operationId` 안내. | **서버 데이터 삭제 0건 (Zero Rows Deleted, 기존 데이터 완전 보존)**, 무한 409 락 해소, 지연 워커 무단 삭제 원천 차단 |
    | **WIPE-CRASH-11** (Vector i) | **UNKNOWN 취소 경합 - 서버 선행 커밋 케이스** (취소 요청과 지연된 서버 트랜잭션 2의 커밋 경합) | 지연된 원본 트랜잭션 2 선행 완료 (`status: COMMITTED`) | `UNKNOWN` 판정 후 `POST /cancel` 호출 | 서버는 취소 CAS 구문(`UPDATE ... WHERE status='PENDING'`)에서 `rowcount == 0` 및 현재 상태 `COMMITTED` 확인 $\to$ `CANNOT_CANCEL_ALREADY_COMMITTED` (409) 응답 $\to$ 클라이언트는 취소 실패 확인 즉시 로컬 인텐트를 `SERVER_COMMITTED`로 승격 $\to$ `purgeIndexedDbRequested` 설정에 따른 후속 동기화 완결. | 경합 발생 시에도 사용자 취소 의도 및 IndexedDB 메모 보존 규칙 준수, 비정상 부분 커밋 배제 |
    | **WIPE-CRASH-12** (Vector j) | **동일 operationId 범위 불일치 재사용** (동일 ID에 서로 다른 `wipeOption` 유입) | `system_operation_journal`에 기존 옵션(`OPTION_1`) 등록됨 | 동일 `operationId`에 상이한 옵션(`OPTION_2`) 전송 | 서버는 저널의 `wipe_option`과 유입된 `wipeOption`을 비교 검증 $\to$ 불일치 확인 시 **HTTP 409 Conflict (`OPERATION_SCOPE_MISMATCH`)**로 fail-closed 즉시 거부 $\to$ 기존 트랜잭션 상태 및 DB 데이터 무변경. | 잘못된 식별자 재사용 및 파괴 범위 오적용 원천 차단 |
    | **WIPE-CRASH-13** (Vector k) | **UNKNOWN 취소 경합 - 정상 취소 성공 및 지연 워커 차단 반례 2** (클라이언트 취소 요청으로 저널 `CANCELLED` 커밋 후, 지연된 워커가 뒤늦게 Phase 2 실행 시도) | `status: CANCELLED` | `POST /cancel` 200 OK 수신 후 `localStorage.removeItem` | 지연 워커가 Phase 2 진입 시 **Pre-Delete Guardrail**을 실행 $\to$ `status == 'CANCELLED'` 감지 $\to$ **모든 DELETE 실행 없이 즉시 `ROLLBACK;` (0건 삭제)**. 설령 실행하더라도 종결 UPDATE `rowcount == 0` 감지 시 강제 `ROLLBACK;`. 추후 지연 도착한 원본 트랜잭션 1 또한 PK 충돌/톰스톤으로 차단. | **서버 데이터 삭제 0건 (Zero Rows Deleted, 기존 데이터 완전 보존)**, 취소된 작업의 지연 파괴 원천 차단, 클라이언트 인텐트 클린 제거 |



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

## 10. A04 QA 3차 독립 검증 (F01 ~ F09) 해결 및 정합성 매핑 ([F01]~[F09] v0.7 총괄)

| QA 항목 ID | 판정 상태 | A04 지적 요약 (3차 검증) | A02 아키텍처 조치 및 문서 매핑 (v0.7) |
|---|---|---|---|
| **F01** | **PASS (유지)** | 활성 세션 단일성 및 수명주기 불변식 | `domain-data-contract-v0.1.md` §3.1에 단일 활성 세션(`is_active=1`) 불변식 유지 (재작성 배제). |
| **F02** | **PASS (v0.5 보완)** | `(measured_value=NULL, quality_flag='GOOD')` DDL 우회 결함 | `domain-data-contract-v0.1.md` §3.2: `chk_measured_value_quality` 제약조건 추가하여 `quality_flag='MISSING'`일 때만 NULL을 허용하고 `GOOD`/`SUSPECT`/`BAD`는 `measured_value NOT NULL` 강제. 10종 테스트 매트릭스 수립. |
| **F03** | **PASS (유지)** | Canonical CSV 직렬화 및 NaN/Inf 가드레일 | `simulation-reproducibility-contract.md` §6.2, §8.1: RFC 4180 빈 문자열 직렬화 및 NaN/Inf `ValueError` 방어 유지 (재작성 배제). |
| **F04** | **PASS (v0.7 완결)** | Factory Wipe 범위 확정 및 IndexedDB 안전 복구 계약 | 본 문서 §4.3 및 `simulation-reproducibility-contract.md` §7.2: 단일 표준 계약(`fab_factory_wipe_intent`, `POST /factory-wipe`, `POST /cancel`, `GET /status`, `system_operation_journal`), 2단계 저널링, 워커 리스(`lease_expires_at_utc`, 30초) 기반 Stale PENDING 복구(영구 409 락 해소), 취소 펜싱 톰스톤 및 선행 커밋 경합 보호, `OPERATION_SCOPE_MISMATCH` fail-closed 범위 검증, `purgeIndexedDbRequested=false` 메모 보존 불변식, Pre-Delete 실행권 검증 및 종결 1행 강제 롤백 불변식, 13종 장애 복구 매트릭스(`WIPE-CRASH-01`~`13`, 지연 워커 0건 삭제 반례 방어) 완결. |
| **F05** | **PASS (유지)** | SQLite 락 메커니즘 구별 및 재시도 정책 | 본 문서 §3.2, §3.3: `SQLITE_BUSY` vs `SQLITE_LOCKED` 분리 및 애플리케이션 지수 백오프/재시도 유지 (재작성 배제). |
| **F06** | **PASS (v0.5 보완)** | 부분군 $k \ge 5$ 및 $N \ge 20$ 경계 혼재, 평가 상태 우선순위 | `domain-data-contract-v0.1.md` §6.3: $k \ge 5$와 $N \ge 20$ 판정 분리, 상태 우선순위 계층(`EVALUATION_INVALID` > `ASSUMPTION_WARNING` > `ONE_SIDED_SPEC_EVALUATED` > `OK`) 및 경고 배열(`warnings: []`) 도입. |
| **F07** | **PASS (v0.5 보완)** | `event_id` 엔티티 타입 누락 및 동일 ID 상이한 페이로드 처리 | `simulation-reproducibility-contract.md` §4, §5: 해시 생성 입력에 `entity_type` 추가, 동일 `event_id` 상이 페이로드 유입 시 `EVENT_PAYLOAD_CONFLICT` 명시적 거부 및 단일 트랜잭션 전체 롤백 기반 부분 영속화 배제(Zero Partial Persistence) 계약 정립. |
| **F08** | **PASS (유지)** | SPC 알람의 결함/인과관계 비인과성 원칙 | `domain-data-contract-v0.1.md` §3.5: SPC 경고의 비인과성 공학 원칙 유지 (재작성 배제). |
| **F09** | **PASS (v0.5 보완)** | `PROCESS_RUN` ERD-TypeScript 불일치 및 픽스처 검증 규칙 | `domain-data-contract-v0.1.md` §2, §7, §8: ERD와 TypeScript 간 `runStatus` 5대 상태(`READY`, `IN_PROGRESS`, `COMPLETED`, `ABORTED`, `FAILED`), 필수 `startTimeUtc`, 선택 `endTimeUtc` 완전 일치, `fixtures/manifest.json` 스키마 및 검증 에러 규칙 명시. |

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
4. **[A01 결정 필요 1-4] 공장 초기화(Factory Wipe) 삭제 범위 확정 ([F04] 선택지):**
   - [ ] 옵션 1 (A02 MVP 공식 권고안): 실행·사건 이력 초기화 (설비/레시피/로트/웨이퍼 마스터 기준 데이터는 보존하여 데모 연속성 보장)
   - [ ] 옵션 2 (미확정 / 프로젝트 오너 명시적 승인 대기): 완전 공장 및 마스터 데이터 와이프 (마스터 데이터까지 전체 테이블을 삭제하여 초기화, 외부 JSON 시드 재적재 필수)
5. **[A01 결정 필요 2-1] 공정능력지수(Cp/Cpk) 및 공정성능지수(Pp/Ppk) 추정량 분리 규약 승인:**
   - [ ] 안 1 (A02 제안 / 승인 대기): 전체 변동 기반 Pp/Ppk(표본 표준편차 s)와 군내 변동 기반 Cp/Cpk(R-bar/d2 또는 s-bar/c4)를 분리하고 EKL·API·화면에 추정량을 명시하는 제안안 승인
   - [ ] 안 2: 단일 지표(s 기반 Pp/Ppk)만 산출하고 화면 명칭을 Ppk로 통일
6. **[A01 결정 필요 2-2] 식각률 음수 편차(두께 증가) 발생 시 처리 정책:**
   - [ ] 안 1 (A02 제안 / 승인 대기): SUSPECT_THICKNESS_INCREASE 플래그 및 설명 표시 (음수값 유지, 자동 증착 단정 및 자동 알람 생성 금지) 제안안 승인
   - [ ] 안 2: 계산 에러(ERR_NEGATIVE_ETCH_RATE)로 간주하고 차트에 결측 표시
7. **[A01 결정 필요 3-1] 수치 반올림 표준 규칙 승인:**
   - [ ] 안 1 (A02 제안 / 승인 대기): 사사오입 (`ROUND_HALF_UP`)
   - [ ] 안 2: 은행원 반올림 (`ROUND_HALF_EVEN`)



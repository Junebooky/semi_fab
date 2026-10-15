# FAB ONE — 시뮬레이션 재현성 및 결정론적 실행 계약서 v0.8

- **문서 ID:** ARCH-DOC-003
- **상태:** PROPOSED (A01 기획자 및 프로젝트 오너 승인 대기)
- **개정 이력:**
  - v0.1 (2026-10-15): 초안 작성
  - v0.2 (2026-10-15): A01 검토의견 반영 (사이드카 매니페스트, 6요소 정렬 키, 세션 ID 분리)
  - v0.3 (2026-10-15): A04 독립 검증 결과 수용 및 A01 수정 지시 반영
    - [F03] Canonical CSV 직렬화 규격 단일화 (엄격한 `Decimal` 및 `ROUND_HALF_UP` 표준화, `{:.4f}` 대안 제거, RFC 4180 unquoted number / empty string 결측 직렬화, `semi_fab/` CWD 기준 체크섬 검증, 골든 CSV 픽스처 사양 수록)
    - [F04] 전체 공장 초기화(Factory Wipe) 삭제 의존성 순서(외래키 CASCADE/RESTRICT 대상 전체 포괄) 및 단일 트랜잭션 롤백, 2단계 사용자 확인 및 브라우저 IndexedDB 별도 삭제 범위 명시
    - [F07] 7요소 결정론적 정렬 키(`event_id` 추가)를 통한 동률 완벽 차단, 비결정론적 `ingest_time_utc`의 Canonical CSV 해시 대상 엄격 제외 및 미검증 바이트 확정 표현을 조건부 설계 사양(NOT_RUN)으로 교정
  - v0.4 (2026-10-15): A04 2차 독립 검증 결과 수용 및 A01 통합 수정 지시 반영
    - [F03] `quantize_value` 함수에 NaN 및 Infinity 부동소수점 검사 가드레일 추가: 비정상 부동소수점 유입 시 `ValueError` 예외 발생, 결측치(`None`)만 RFC 4180 빈 문자열(`""`)로 직렬화하도록 엄격화 및 입출력 테스트 벡터 명시
    - [F04] 공장 초기화(Factory Wipe) 삭제 범위 선택지 제시: 마스터 데이터 보존형(옵션 1: 실행/사건 이력 리셋, A02 권고) vs 전체 마스터 삭제형(옵션 2: 완전 공장 와이프), IndexedDB 비동기/비원자적 삭제 오류 복구 및 재시도 메커니즘 명시
    - [F07] Canonical CSV 및 스케줄러 시간축을 단일 컬럼 `sim_timestamp_utc`로 통일, 7차 정렬 키용 결정론적 `event_id` 해시 생성 산식 정의 및 멱등 중복 폐기 규약 완결
  - v0.5 (2026-10-15): A04 3차 독립 검증 결과 수용 및 A01 잔여 계약 수정 지시 반영
    - [F04] 공장 초기화(Factory Wipe) 단일 표준 사전 의도 기록 계약(`fab_factory_wipe_intent`, `operationId`, `status: INTENT_RECORDED/SERVER_COMMITTED`, `POST /api/v1/admin/factory-wipe`, `GET /status`), 서버 내구적 저널(`system_operation_journal`) 및 멱등 커밋 보장, 네트워크 타임아웃 시 자동 롤백 속단 배제, 커밋 미확인 시 IndexedDB 삭제 절대 금지 가드레일, 13종 장애 복구 매트릭스 수립 (`mvp-mode-and-storage-assessment.md` §4.3과 100% 일치)
    - [F07] `event_id` 생성 입력에 `entity_type` 추가, 동일 `event_id`에 상이한 페이로드 유입 시 `EVENT_PAYLOAD_CONFLICT`로 즉시 거부(Fail-closed) 및 단일 트랜잭션 전체 롤백 기반 부분 영속화 배제(Zero Partial Persistence) 계약 명문화, 64비트 절단 충돌 가드 및 시간 컬럼 매핑 표 추가
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
  - v0.8 (2026-10-15): A01 공식 수정 지시(#6186862769) 및 A04 독립 QA(#6186816576) 결과 반영 (F04 리스 시간 포맷 P0 및 Phase 3 종결 CAS 최소 보완)
    - [F04-P0-1] SQLite 리스 시각 ISO 8601 UTC(`YYYY-MM-DDTHH:MM:SS.sssZ`) 포맷 정규화(`strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 seconds')`) 및 동일 `:now` 문자열 사전순 비교(`>=` 활성, `<` 만료) 일원화, 시간 형식 반례 검증 표 추가
    - [F04-S1] Phase 3 FAILED 오류 핸들러 단조 종결 CAS(`status = 'PENDING' AND worker_id = :my_worker_id` 및 `rowcount == 1`) 명시, 기 확정된 CANCELLED/COMMITTED 종결 상태 불변성 보장 및 Pre-Delete 거부 예외 우회(Bypass) 격리
    - [F04] 실제 역순 DELETE 실행 전 4대 조건(operationId, status='PENDING', worker_id, 유효 리스) 원자적 선행 검증 가드레일(Pre-Delete Guardrail) 및 종결 1행 강제 롤백 불변식 유지
    - [F04] 13종 장애 복구 매트릭스에 리스 시간 정합성 및 Phase 3 CAS 불변성 기대 결과 반영, 두 F04 문서 간 100% 동기화
- **작성자:** A02 (수석 소프트웨어 개발 에이전트)
- **관련 Issue / PR:** Issue [#1](https://github.com/Junebooky/semi_fab/issues/1), Issue [#8](https://github.com/Junebooky/semi_fab/issues/8), Issue [#12](https://github.com/Junebooky/semi_fab/issues/12), Draft PR [#2](https://github.com/Junebooky/semi_fab/pull/2), QA PR [#3](https://github.com/Junebooky/semi_fab/pull/3), Design PR [#7](https://github.com/Junebooky/semi_fab/pull/7), PR [#10](https://github.com/Junebooky/semi_fab/pull/10)

---

## 1. 배경 및 문제 정의: "시드만으로는 충분하지 않다" (QA-F01 대응)

A04 QA는 PR #3 및 독립 검증(Issue #12)에서 단순 정수형 시드(`seed=42`) 지정만으로는 결정론적 재현성(Deterministic Reproducibility)을 보장할 수 없음을 지적했다.

소프트웨어 런타임 환경에서는 다음 요인들로 인해 동일 시드를 주입하더라도 다른 결과가 도출될 수 있다:
1. **난수 생성기(PRNG) 알고리즘 불일치:** Python 표준 `random`(Mersenne Twister), NumPy의 `PCG64`, 브라우저 JavaScript의 `Math.random()`은 완전히 다른 수열을 생성함.
2. **비동기 이벤트 루프의 비결정적 실행 순서:** Node.js 또는 Python asyncio 환경에서 타이머 및 비동기 I/O 완료 시점이 달라 센서 측정치 기록 순서가 뒤바뀜.
3. **호스트 OS 및 CPU 아키텍처에 따른 부동소수점 오차:** x86_64(Intel/AMD)와 ARM64(Apple Silicon) 간의 미세 연산 오차 및 문자열 직렬화 차이.
4. **외부 입력(호스트 시스템 시간, 시스템 환경변수)의 개입.**

따라서 본 문서는 **"동일한 시나리오 픽스처와 시드를 입력하면, 고정된 실행 툴체인(Python 3.11, pinned NumPy)과 정규화 직렬화 규약 하에서 동일한 바이트의 데이터 스트림과 알람을 재현하기 위한 기계적 정합성 계약"**을 수립한다. (현재 단계는 아키텍처 및 계약 사양 정의 단계이며 실제 엔진 실행 테스트는 NOT_RUN임).

---

## 2. PRNG 알고리즘 및 난수 엔진 고정

### 2.1 공식 PRNG 알고리즘: `PCG64`
- **표준 라이브러리:** Python 3.11+ 환경의 `numpy.random.Generator` 및 **`PCG64`** 비트 제너레이터를 표준으로 고정한다.
- **초기화 구문:**
  ```python
  from numpy.random import Generator, PCG64

  def create_deterministic_rng(seed: int) -> Generator:
      """결정론적 난수 생성기를 생성합니다."""
      return Generator(PCG64(seed))
  ```

### 2.2 프론트엔드-백엔드 난수 생성 일원화 원칙
- **원칙:** 브라우저 프론트엔드(Next.js/React)에서 독자적인 수학적 시뮬레이션 난수를 직접 생성하지 않는다.
- **데이터 흐름:**
  - **Mode B:** Python 백엔드가 `PCG64` 엔진으로 생성한 센서 스트림 및 이벤트를 API 또는 SSE(Server-Sent Events)로 프론트엔드에 전달한다.
  - **Mode A (정적 데모):** 빌드 타임에 Python 시뮬레이터가 미리 생성하여 SHA-256 검증을 마친 정적 픽스처(JSON/Parquet)를 브라우저가 순차적으로 재생(Replay)한다.

---

## 3. 원본 픽스처 거버넌스 및 암호화 체크섬 (P0-2 대응: 순환 참조 제거)

### 3.1 픽스처 디렉터리, 사이드카 매니페스트 및 체크섬 구조 ([F03] 해결)
JSON 파일 내부에 자신의 해시값을 포함시키면 해시 계산 시 입력이 변경되는 **순환 참조(Self-Referential Hash)**가 발생한다. 이를 원천 차단하기 위해 **외부 사이드카 매니페스트(`fixtures/manifest.json`) 및 표준 체크섬 파일(`fixtures/checksums.sha256`)** 방식을 채택한다:

1. **사이드카 매니페스트 (`fixtures/manifest.json`):** 시나리오 메타데이터(시나리오 ID, 버전, 타이틀, 생성기 버전, 시뮬레이션 클록 설정 등 도메인 설정)를 관리한다.
2. **체크섬 파일 (`fixtures/checksums.sha256`):** 각 원본 픽스처 파일의 순수 SHA-256 암호화 체크섬 목록을 관리한다.
3. **검증 기준 작업 디렉터리(Working Directory):** 모든 체크섬 검증은 **저장소 루트(`semi_fab/`)**를 CWD(Current Working Directory)로 삼는다.

```text
semi_fab/ (저장소 루트, CWD)
└── fixtures/
    ├── manifest.json              # 사이드카 시나리오 메타데이터 매니페스트
    ├── scenarios/
    │   ├── ETH-SYN-01-pressure-drift.json
    │   └── ETH-SYN-02-rf-arc-anomaly.json
    ├── baseline/
    │   ├── equipment_master.json
    │   └── recipe_library.json
    └── checksums.sha256           # 표준 sha256sum 호환 체크섬 파일
```

### 3.2 시나리오 파일 및 매니페스트 규약
시나리오 JSON 파일 자체에는 가변 체크섬 필드를 두지 않으며, 고유 파라미터만 선언한다:

```json
{
  "scenarioId": "ETH-SYN-01",
  "version": "1.0.0",
  "title": "식각 챔버 B 압력 상승 및 센서 수집 지연 시나리오",
  "seed": 20261015,
  "generatorVersion": "fab-one-sim-v0.1.0",
  "prngAlgorithm": "PCG64",
  "simTimeConfig": {
    "baseTimestampUtc": "2026-10-15T01:00:00.000Z",
    "tickIntervalMs": 1000,
    "totalDurationSec": 3600
  },
  "injectedEvents": [
    {
      "triggerAtSec": 1440,
      "targetChamber": "ETCH-02-CHB",
      "eventType": "SENSOR_DRIFT",
      "parameter": "CHAMBER_PRESSURE",
      "driftRatePerSec": 0.05
    }
  ]
}
```

### 3.3 체크섬 검증 절차 (`checksums.sha256`)
- `fixtures/checksums.sha256` 파일 예시:
  ```text
  7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069  fixtures/scenarios/ETH-SYN-01-pressure-drift.json
  3a19b88219ecdfa28399e5512b001a1c93a02fae836104bcba129d33a1e289c0  fixtures/scenarios/ETH-SYN-02-rf-arc-anomaly.json
  ```
- **CLI 검증 명령어 (저장소 루트 기준):**
  ```bash
  # 반드시 semi_fab/ 루트 디렉터리에서 실행
  sha256sum -c fixtures/checksums.sha256
  ```
- **런타임 가드레일:** 시뮬레이터 구동 시 파일의 SHA-256을 실시간 계산하여 `checksums.sha256`과 대조한다. 1바이트라도 변조되었을 경우 `FIXTURE_INTEGRITY_VIOLATION` 예외를 발생시키고 실행을 즉시 중단한다.

---

## 4. 가상 시뮬레이션 클록 및 단일 시간축 통일 ([F07] 반영)

- **호스트 클록 완전 배제:** 시뮬레이터는 시스템의 현재 시각(`Date.now()` 또는 `datetime.now()`)에 의존하지 않는다.
- **가상 타임라인:**
  - 시작 시각: 시나리오에 정의된 `baseTimestampUtc` (기본값: `2026-10-15T01:00:00.000Z`).
  - 클록 전진: 고정된 이산 시간 간격($\Delta t = 1000\text{ ms}$) 단위로만 정밀하게 틱(Tick)을 전진시킨다.
- **클록 상태 전이:**
  ```text
  [INITIALIZED] ──(Start)──> [RUNNING] ──(Pause)──> [PAUSED]
        │                       │                     │
        │                       └──(Complete)──> [COMPLETED]
        │                                             │
        └───────────────────(Reset)───────────────────┘
  ```
- **시간 컬럼 매핑 및 해시 스코프 대응표 ([F07] 해결):**
  Canonical CSV 직렬화 컬럼과 도메인 스키마/API 간의 대응 관계는 다음과 같이 명확히 규정된다:

| 컬럼명 | Canonical CSV | 도메인 DDL / ERD | TypeScript / API | 합성 시뮬레이션 (MVP Mode A/B) | 향후 라이브 연동 (Mode C) | 결정론적 해시 대상 |
|---|---|---|---|---|---|---|
| `sim_timestamp_utc` | **기준 헤더** | `sim_time_utc` | `simTimeUtc` | 가상 시뮬레이션 클록 틱 시각 ($t_{\text{sim}}$) | 시뮬레이터 재생 시각 | **포함 (SHA-256 검증)** |
| `event_time_utc` | 매핑 (동일) | `event_time_utc` | `eventTimeUtc` | $t_{\text{event}} = t_{\text{sim}}$ (동기 시뮬레이션 일치) | 물리 장비 센서 챔버 계측 시각 | **포함 (동일값)** |
| `ingest_time_utc` | **제외** | `ingest_time_utc` | `ingestTimeUtc` | 호스트 DB 저장 시점 시각 (비결정론) | 클라우드 수집 게이트웨이 시각 | **엄격 제외 (체크섬 배제)** |

---

## 5. 이벤트 스케줄링 및 절대 순서(Total Ordering) 보장 (P0-3 / [F07] 대응)

비동기 콜백 도착 시점에 증가하는 메모리 카운터는 네트워크 지연이나 비동기 스케줄러의 미세한 타이밍 차이에 따라 순서가 뒤바뀌는 비결정성을 유발한다. 따라서 **이벤트 큐의 정렬 키는 비동기 도착 순서가 아닌, 완전히 정적인 도메인 속성만으로 구성**한다.

### 5.1 7요소 결정론적 정렬 키 (Deterministic 7-Element Sort Key, [F07] 해결)
동일 타임스탬프, 동일 페이즈, 동일 파라미터에서 발생하는 이벤트 동률(Tie)을 완벽하게 해소하기 위해 7차 기준인 `event_id`를 추가한다:

$$\text{SortKey} = (\text{sim\_timestamp\_epoch\_ms}, \text{event\_phase}, \text{entity\_type}, \text{entity\_id}, \text{parameter\_id}, \text{logical\_step\_seq}, \text{event\_id})$$

1. **`sim_timestamp_epoch_ms` (1차 기준):** 가상 시뮬레이션 밀리초 타임스탬프 (오름차순 정수).
2. **`event_phase` (2차 기준):** 공정 물리 상태 갱신(`0`) $\to$ 센서 샘플링(`1`) $\to$ FDC 룰 평가(`2`) $\to$ 알람 발행(`3`) 고정 우선순위.
3. **`entity_type` (3차 기준):** `"EQUIPMENT"` (`1`) $\to$ `"CHAMBER"` (`2`) $\to$ `"SENSOR"` (`3`).
4. **`entity_id` (4차 기준):** 설비 및 챔버 ID의 사전식 순서 (예: `"ETCH-01-CHA"` $<$ `"ETCH-02-CHB"`).
5. **`parameter_id` (5차 기준):** 파라미터명 사전식 순서 (예: `"CHAMBER_PRESSURE"` $<$ `"RF_POWER"`).
6. **`logical_step_seq` (6차 기준):** 시나리오 레시피 스텝에 사전 할당된 정적 시퀀스 번호 (정수).
7. **`event_id` (7차 기준, 최종 Tie-Breaker):** 결정론적 해시 파생 식별자 (아래 산식 준수, 사전식 순서 오름차순).

### 5.2 결정론적 `event_id` 생성 및 페이로드 충돌 방지 규약 ([F07] 해결)
- **`entity_type`을 포함한 `event_id` 결정론적 해시 생성 산식:**
  비결정론적 UUID나 런타임 메모리 주소를 일체 배제하고, 도메인 불변 식별자(정렬 키 1~6차 구성요소 전체)를 `:` 구분자로 결합하여 SHA-256 해시의 앞 16자리를 취한다:
  $$\text{event\_id} = \text{SHA256}\Big(\text{f"{scenario\_id}:{seed}:{sim\_timestamp\_epoch\_ms}:{event\_phase}:{entity\_type}:{entity\_id}:{parameter\_id}:{logical\_step\_seq}"}\Big)[:16]$$
- **페이로드 다이제스트(Payload Digest) 및 충돌 차단 (Fail-Closed 불변식):**
  - 각 이벤트의 정규화된 데이터 페이로드는 `payload_digest = SHA256(canonical_json(payload))`로 계산한다.
  - 이벤트 수신 시 동일한 `event_id`가 이미 등록되어 있는 경우:
    1. **Case 1 (동일 ID + 동일 Payload Digest):** 네트워크 재전송 또는 큐 재진입으로 판정하여 **`DUPLICATE_EVENT_DROPPED`로 안전하게 멱등 무시**한다 (시스템 상태 변경 없음).
    2. **Case 2 (동일 ID + 상이한 Payload Digest / 식별자 불일치):** 최초 도착 값을 임의로 채택하지 않고, **즉시 `EVENT_PAYLOAD_CONFLICT` 치명적 오류를 발생시키며 fail-closed로 거부 및 시스템 중단**한다.
       - **결정론 보장 증명:** 이벤트 도착 순서가 `[A, B]`이든 `[B, A]`이든 상관없이 시스템은 동일한 `EVENT_PAYLOAD_CONFLICT` 예외로 거절되므로, 런타임 비동기 도착 순서에 따라 다른 데이터가 채택되는 비결정론이 원천 차단된다.
- **64비트 절단 충돌(Truncation Collision) 방지 가드:**
  내부 레지스트리는 16자리 `event_id` 외에 원본 256비트 전체 해시를 함께 보관하며, 16자리가 일치하더라도 전체 해시가 다를 경우 `EVENT_ID_COLLISION_DETECTED` 오류로 즉시 거부한다.
- **원자적 롤백 및 부분 영속화 배제 (Zero Partial Persistence 계약):**
  - 센서 계측 및 공정 이벤트 수신/적재는 단일 데이터베이스 트랜잭션(`BEGIN IMMEDIATE ... COMMIT/ROLLBACK`) 단위로 실행된다.
  - 동일 `event_id`에 서로 다른 페이로드가 감지되어 `EVENT_PAYLOAD_CONFLICT`가 발생하면:
    1. 현재 진행 중인 트랜잭션은 즉시 `ROLLBACK`된다.
    2. 충돌이 발생한 이벤트뿐 아니라 연관된 어떠한 계측치(`sensor_measurement`), 공정 실행(`process_run`), 알람(`fdc_alert`)도 데이터베이스나 스테이징 영역에 **부분적으로 저장(Partial Persistence)되거나 고아 레코드로 남지 않는다** (0 rows written).
    3. 이미 이전 트랜잭션에서 영속화 완료된 선행 이벤트가 존재하는 상태에서 동일한 `event_id`에 다른 페이로드를 가진 후행 이벤트가 도착한 경우: 이전 트랜잭션의 커밋 완료 데이터는 RDBMS 특성상 물리적 롤백이 불가능하므로, 후행 이벤트 트랜잭션에서 **새로운 커밋 행을 일체 추가하지 않고(0 new committed rows)** 즉시 거부하며, 해당 시뮬레이션 세션 전체를 `INTEGRITY_COMPROMISED`로 플래그하여 기존 데이터 또한 무효/격리 처리하고 이후의 모든 쓰기 작업을 영구 차단한다. 이로써 이벤트 도착 순서가 뒤바뀌더라도 불완전한 상태 전이가 영속화되는 것을 방지한다.


- **F07-P0 — 이전 커밋 데이터의 내구적 무효화 및 쓰기 펜싱:**
  - `simulation_session`에는 `is_active`(서비스 수명주기와 무관)와 별개의 영속 `integrity_status: VALID | INTEGRITY_COMPROMISED`, `integrity_reason`, `integrity_marked_at_utc`를 사용한다. 도메인 계약 §3.4의 `session_ingest_guard(session_id, guard_state: IDLE | OPEN | QUARANTINED, batch_token)`는 별도의 내구적 예약 테이블이다. 이전 커밋된 측정치·실행·알람 행은 **물리 ROLLBACK 불가**이므로 삭제하지 않고 유효 결과 조회/통계/CSV에서 **격리**한다.
  - **1단계 — 선행 영속 예약:** 신규 세션 INSERT와 해당 세션의 `IDLE` 가드 생성은 같은 COMMIT에서 수행한다. 모든 시뮬레이션 이벤트/실행/계측/알람 쓰기 전 `BEGIN IMMEDIATE`에서 `is_active=1 AND integrity_status='VALID' AND guard_state='IDLE'`을 확인, 가드를 `OPEN, batch_token=:unique_batch_token`으로 CAS UPDATE해 **rowcount=1**인 경우에만 **별도 COMMIT**한다. 예약 COMMIT 전에 이벤트 쓰기 금지. 가드 행 없음·`OPEN`·`QUARANTINED`·무효 상태면 즉시 fail-closed; 마이그레이션 시에도 기존 이벤트 감사 전 `IDLE` 자동 생성 금지.
  - **2단계 — 이벤트 배치 및 정상 완료:** 별도의 `BEGIN IMMEDIATE`에서 같은 토큰 소유 `OPEN` 및 세션 `VALID`·활성 여부를 재확인한다. 충돌 없이 유효한 이벤트 배치를 적재한 경우, **같은 트랜잭션 안에서** 해당 가드 `OPEN → IDLE`, 토큰 `NULL` CAS를 적용한다. 가드 `rowcount=1`이면 이벤트 행 + 해제를 함께 COMMIT하고 0이면 신규 행 전부 ROLLBACK한다. 다른 워커/동시 배치는 예약 불가.
  - **3단계 — 이벤트 충돌:** `EVENT_PAYLOAD_CONFLICT` 또는 `EVENT_ID_COLLISION_DETECTED` 감지 즉시 **현재 이벤트 배치 ROLLBACK(새 커밋 0행)**. 1단계의 `OPEN`은 별도 선행 COMMIT되어 여전히 존재한다. 이어 **별도 `BEGIN IMMEDIATE`**에서 `simulation_session.integrity_status='VALID' → 'INTEGRITY_COMPROMISED'` + 원인/ISO UTC 시각, `session_ingest_guard.guard_state='OPEN' → 'QUARANTINED'` + 토큰 초기화를 각각 조건부 UPDATE한다. 두 CAS 모두 1행일 때만 **함께 COMMIT**하고 아니면 ROLLBACK 후 상태 재조회, 계속 쓰기 거부. 종결 격리 상태는 재검증 없는 자동 `VALID` 복귀 불가.
  - **4단계 — 격리 실패/프로세스 종료/재기동:** 예약 COMMIT 이후 2단계 중 중단되거나 충돌 ROLLBACK 후 격리 COMMIT 전 중단되어도 **`OPEN` 가드는 남는다**. 시작/모든 쓰기/정상 조회 전에 `integrity_status='VALID' AND guard_state='IDLE'`을 필수로 검증해 `OPEN`·가드 누락·`QUARANTINED`·손상 세션은 **후속 쓰기/일반 결과 조회 차단**. 남은 `OPEN`은 배치 완료를 추정하지 않고 별도 복구 트랜잭션에서 `INTEGRITY_COMPROMISED` + 원인 `INTERRUPTED_BATCH_REQUIRES_REVIEW`와 `QUARANTINED`로 내구화한다; 격리 COMMIT 실패 시 `OPEN`을 해제하지 않고 재시도·운영자 확인 대상으로 유지한다. 이전 세션을 비활성 아카이브로 전환해도 격리 상태 보존; 안전한 새 세션의 독립 실행만 허용.
  - **독립 최소 SQLite 기대값(제품 NOT_RUN):** 충돌 이전에 COMMIT된 이벤트 1행은 DB에 남되 유효 결과에서 제외, 충돌 배치 신규 커밋 0행; 격리 전 강제 종료면 `OPEN`이 재기동 후 남아 쓰기 0행; 별도 격리 COMMIT 성공 뒤 재접속해도 `INTEGRITY_COMPROMISED/QUARANTINED`이고 쓰기 0행.

---

## 6. 부동소수점 연산 및 수치 반올림 계약 ([F03] 해결)

### 6.1 연산 정밀도
- 모든 내부 공학 계산은 **IEEE 754 배정밀도(Double Precision, 64비트 부동소수점)**를 유지한다. 내부 계산 중간 단계에서는 반올림을 적용하지 않는다.

### 6.2 엄격한 단일 반올림 규약: `Decimal` + `ROUND_HALF_UP` ([F03] NaN/Inf 검증 가드레일 추가)
Python의 `format(val, ".4f")` 또는 `{:.4f}` 서식 문자열은 2진수 부동소수점 표현 한계 및 파이썬 내장 float 반올림(Round-half-to-even) 규칙으로 인해 동률 입력(Halfway cases, 예: `2.00005`)에서 플랫폼/환경별 바이트 불일치(예: `2.0000` vs `2.0001`)를 유발하므로 **사용을 엄격히 금지**한다.

반드시 Python의 `decimal.Decimal` 모듈과 **`ROUND_HALF_UP` (사사오입)**을 적용하는 단일 표준 정규화 함수만을 사용한다. 또한, 비정상 부동소수점(`NaN`, `Infinity`)이 직렬화 스트림에 유입되어 문자열 `'NaN'`이나 `'Infinity'`로 출력되는 결함을 차단하기 위해 **엄격한 유한수(Finite) 검사 가드레일**을 강제한다:

```python
import math
from decimal import Decimal, ROUND_HALF_UP

def quantize_value(val: float | str | None, precision: int) -> str:
    """엄격한 사사오입(ROUND_HALF_UP) 기반 정규화 직렬화 함수.
    - val is None: 실제 센서 결측치로 판정하여 RFC 4180 unquoted 빈 문자열("") 반환
    - val is NaN 또는 Inf: 비정상 부동소수점으로 판정하여 ValueError 예외 발생 (직렬화 원천 차단)
    - 정상 유한수: Decimal 변환 후 ROUND_HALF_UP 정규화 문자열 반환
    """
    if val is None:
        return ""  # RFC 4180 unquoted empty string for missing values

    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            raise ValueError(f"Non-finite float value '{val}' is strictly forbidden in canonical serialization.")

    d = Decimal(str(val))
    if not d.is_finite():
        raise ValueError(f"Non-finite Decimal value '{val}' is strictly forbidden in canonical serialization.")

    q = Decimal("10") ** -precision
    return str(d.quantize(q, rounding=ROUND_HALF_UP))
```

- **사양 검증 기준 테스트 벡터 (Specification Test Vectors, [F03] 사양 수록):**
  - `quantize_value(2.00005, 4)` $\to$ `'2.0001'` (동률 사사오입 정규화 확인)
  - `quantize_value(120.450, 2)` $\to$ `'120.45'` (정상 부동소수점 반올림)
  - `quantize_value(None, 2)` $\to$ `""` (결측치 빈 문자열 직렬화)
  - `quantize_value(float('nan'), 2)` $\to$ `ValueError` (비정상 NaN 유입 차단)
  - `quantize_value(float('inf'), 2)` $\to$ `ValueError` (비정상 양의 무한대 차단)
  - `quantize_value(float('-inf'), 2)` $\to$ `ValueError` (비정상 음의 무한대 차단)
- **파라미터별 정밀도 표준:**
  - 챔버 압력: 소수점 2자리 (`precision = 2`, 예: `120.45`)
  - 식각률: 소수점 1자리 (`precision = 1`, 예: `145.2`)
  - 다이 수율: 소수점 2자리 (`precision = 2`, 예: `96.40`)
  - 공정능력/성능지수 ($C_p, C_{pk}, P_p, P_{pk}$): 소수점 3자리 (`precision = 3`, 예: `1.333`)
- **가드레일:** 계산 정밀도를 초과하는 가짜 정밀도(Fake Precision, 예: `120.450000000001`)나 지수 표기(`1e-05`)를 절대 출력하지 않는다.

---

## 7. 상태 초기화(Reset) 및 이력 보존 외래키 정합성 (P0-3 / [F04] 해결)

### 7.1 문제 분석
조사 케이스(`INVESTIGATION_CASE`)가 특정 공정 실행(`run_id`) 및 알람(`alert_id`)을 외래키(`ON DELETE RESTRICT`)로 참조하고, 센서 계측치(`SENSOR_MEASUREMENT`)와 웨이퍼 실행 매핑(`PROCESS_RUN_WAFER`)이 `PROCESS_RUN`을 참조하고 있을 때, 불완전한 삭제 순서는 **외래키 충돌(`FOREIGN KEY constraint failed`)로 인해 롤백되거나 시스템 장애를 유발**한다.

### 7.2 두 가지 초기화 모델의 명확한 분리

#### 모델 1: 시뮬레이션 세션 리셋 (Soft-Reset, 기본 운영 모드)
시뮬레이터의 리셋 명령은 물리적 레코드 삭제가 아닌 **세션 분리 및 논리적 아카이빙**으로 동작한다:
1. 기존 세션을 비활성화하고 신규 세션을 단일 트랜잭션으로 발급한다:
   ```sql
   BEGIN IMMEDIATE;
   UPDATE simulation_session SET is_active = 0, completed_at_utc = :now WHERE is_active = 1;
   INSERT INTO simulation_session (session_id, scenario_id, seed, is_active, started_at_utc)
   VALUES (:new_session_id, :scenario_id, :seed, 1, :now);
   COMMIT;
   ```
2. 기존 세션의 모든 공정 실행, 센서 데이터, 조사 케이스, IndexedDB 메모는 DB에 안전하게 보존된다.
3. 활성 대시보드는 `is_active = 1` 데이터만 조회하므로 외래키 충돌이 원천적으로 발생하지 않는다.

#### 모델 2: 공장 전체 초기화 (Factory Wipe, 명시적 파괴적 관리자 작업) ([F04] 선택지 및 복구 명세)
사용자가 모든 시뮬레이션 데이터와 조사 기록을 비우고 공장을 초기 상태로 되돌리고자 할 때 사용한다:

- **초기화 범위 선택지 (A01 기획 결정 및 MVP 권고안):**
  - **옵션 1 (시뮬레이션 및 사건 이력 초기화, A02 MVP 공식 강력 권고안):**
    - 설비 마스터(`EQUIPMENT`, `CHAMBER`), 레시피(`RECIPE`), 기본 로트(`LOT`), 기본 웨이퍼(`WAFER`)의 기준 정보(Baseline Master Data)는 **온전히 보존**한다.
    - 시뮬레이션 동적 실행 데이터 및 조사 케이스만 역순으로 삭제:
      `case_action_log` $\to$ `investigation_case` $\to$ `fdc_alert` $\to$ `sensor_measurement` $\to$ `process_run_wafer` $\to$ `wafer_defect_map` $\to$ `process_run` $\to$ `simulation_session`.
    - **권고 사유 및 UI 표기:** 데모 및 학습 사용자가 설비나 레시피를 매번 재등록할 필요 없이 즉시 새로운 시뮬레이션을 재실행할 수 있도록 최적화함. 사용자 대시보드 모달에는 '공장 전체 삭제'가 아닌 **'시뮬레이션 이력 초기화 (설비·레시피 마스터 보존)'**으로 명확히 표기함.
  - **옵션 2 (완전 데이터베이스 삭제, 프로젝트 오너 미승인 / 미구현 제안):**
    - 동적 데이터뿐 아니라 전체 마스터 테이블(`WAFER` $\to$ `LOT` $\to$ `RECIPE` $\to$ `CHAMBER` $\to$ `EQUIPMENT`)까지 모든 레코드를 삭제하는 방식.
    - **주의 및 정정:** SQL `DELETE` 구문은 테이블 내 데이터 레코드만 삭제할 뿐 SQLite 데이터베이스 파일 자체를 0바이트로 만들지 않으며(유효한 빈 스키마 및 헤더 페이지 4KB/8KB 유지), 실행 후에는 `fixtures/baseline/` JSON 파일로부터 마스터 데이터를 다시 적재(Seed Ingestion)해야 하므로 프로젝트 오너의 명시적 승인 전까지는 비활성 상태로 유지함.

- **외래키 종속성을 반영한 역순 삭제 단일 트랜잭션 (옵션 1 기준):**
  ```sql
  BEGIN IMMEDIATE;
  -- 1. 조사 케이스 조치 로그 (INVESTIGATION_CASE 참조)
  DELETE FROM case_action_log;
  -- 2. 조사 케이스 (FDC_ALERT 참조)
  DELETE FROM investigation_case;
  -- 3. FDC 이상 경고 (PROCESS_RUN, CHAMBER 참조)
  DELETE FROM fdc_alert;
  -- 4. 센서 시계열 측정치 (PROCESS_RUN 참조)
  DELETE FROM sensor_measurement;
  -- 5. 웨이퍼별 공정 노출 이력 (PROCESS_RUN, WAFER 참조)
  DELETE FROM process_run_wafer;
  -- 6. 웨이퍼 결함 맵 (WAFER 참조)
  DELETE FROM wafer_defect_map;
  -- 7. 공정 실행 (SIMULATION_SESSION 참조)
  DELETE FROM process_run;
  -- 8. 시뮬레이션 세션 (최상위)
  DELETE FROM simulation_session;
  COMMIT;
  ```
  - 단 1개의 삭제 구문이라도 실패할 경우 즉시 전체 트랜잭션을 `ROLLBACK`하여 불완전 삭제를 방지한다.

- **2단계 사용자 확인 가드레일:**
  - 1단계: "모든 시뮬레이션 이력과 과거 사건 조사 기록이 영구히 삭제됩니다" 경고 모달 표시.
  - 2단계: 확인 입력 필드에 `"FACTORY-WIPE-CONFIRM"` 문자열을 사용자가 직접 입력해야만 실행 버튼이 활성화됨.

- **브라우저 IndexedDB 사전 의도 기록(Pre-Intent Logging) 및 내구적 복구 프로토콜 ([F04] 표준화 규약, `mvp-mode-and-storage-assessment.md` §4.3과 100% 일치):**
  SQLite 백엔드와 브라우저 IndexedDB는 서로 다른 물리 저장소이므로, **파괴적 서버 요청 전에 신뢰할 수 있는 삭제 의도를 먼저 영속화**하고, 서버의 내구적 저널을 확인한 후 안전하게 복구 및 동기화하는 **표준 복구 프로토콜(Pre-Intent Durable Cleanup Protocol)**을 강제한다:

  1. **1단계 (선행 의도 영속화):**
     파괴적 서버 요청 전송 직전 클라이언트의 `localStorage`에 표준 키 `fab_factory_wipe_intent`로 작업 식별자(`operationId`), 타임스탬프, 초기화 옵션(`wipeOption`), 메모 삭제 동의 여부(`purgeIndexedDbRequested`), 의도 상태(`status: INTENT_RECORDED`)를 원자적으로 기록한다:
     ```json
     {
       "operationId": "wipe-550e8400-e29b-41d4-a716-446655440000",
       "timestampUtc": "2026-10-15T06:00:00.000Z",
       "wipeOption": "OPTION_1",
       "purgeIndexedDbRequested": true,
       "status": "INTENT_RECORDED"
     }
     ```
     - *가드레일:* 브라우저 시크릿 모드나 용량 제한 등으로 `localStorage.setItem` 실패 시, 서버 요청을 일체 전송하지 않고 즉시 **Fail-Closed로 중단**한다.

  2. **2단계 (백엔드 파괴적 실행, Pre-Delete 실행권 검증 및 종결 원자성 보장):**
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
         lease_expires_at_utc TEXT NOT NULL,   -- 워커 실행 리스 만료 시각 (엄격한 ISO 8601 UTC: YYYY-MM-DDTHH:MM:SS.sssZ)
         heartbeat_at_utc TEXT,                -- 워커 하트비트 시각
         started_at_utc TEXT NOT NULL,
         committed_at_utc TEXT,
         updated_at_utc TEXT,
         error_message TEXT
     );
     ```

     - **단일 UTC 리스 시각 형식·사전순 비교 규약 ([F04-P0-1]):**
       - 모든 시각 컬럼(`started_at_utc`, `lease_expires_at_utc`, `committed_at_utc`, `updated_at_utc`, `heartbeat_at_utc`) 및 쿼리 바인딩 파라미터(`:now`)는 `domain-data-contract-v0.1.md` §4.2에 정의된 **엄격한 ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.sssZ`)** 형식(단일 시계 소스 UTC, 밀리초 3자리, `T` 구분자, 후행 `Z`)으로 통일한다.
       - SQLite 기본 `datetime('now', '+30 seconds')`가 생성하는 공백 구분 형식(`YYYY-MM-DD HH:MM:SS`)을 절대 금지하고, 반드시 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 seconds')`를 사용하여 생성한다. (또는 애플리케이션 계층에서 시스템 UTC 시계 기반으로 포맷팅된 문자열 바인딩).
       - **사전식 문자열 비교(Lexicographical Comparison) 불변식:**
         ISO 8601 UTC 문자열은 사전순 비교가 실제 시간 순서와 1:1로 일치하므로, `lease_expires_at_utc >= :now` (활성 상태)와 `lease_expires_at_utc < :now` (만료/stale 상태)가 전체 시간 축에 대해 빈틈(Gap)이나 중복(Overlap)이 없는 완벽한 상호 배타적 분할(Mutually Exclusive Partition)을 이룬다.
       - **시간 형식 불일치 반례 및 교정 기대값 (Specification Counterexample Benchmark):**
         | 시각 저장 형식 | :now 바인딩 (UTC) | 비교식 | 결과 | 동작 영향 및 시스템 평가 |
         |---|---|---|:---:|---|
         | `2026-10-15 16:17:30` (기존 공백 포맷) | `2026-10-15T16:17:10.000Z` (20초 잔여) | `lease >= :now` | `0` (False) | 20초 잔여한 유효 리스를 만료로 오판하여 활성 가드 누락 $\to$ 타 작업 동시 PENDING 허용 결함 (`' '` < `'T'`) |
         | `2026-10-15 16:17:30` (기존 공백 포맷) | `2026-10-15T16:17:10.000Z` (20초 잔여) | `lease < :now` | `1` (True) | 유효한 활성 리스를 stale 만료로 오판하여 무단 FAILED 종결 시도 |
         | **`2026-10-15T16:17:30.000Z` (교정 포맷)** | `2026-10-15T16:17:10.000Z` (20초 잔여) | `lease >= :now` | **`1` (True)** | **정상 활성 리스 판정 $\to$ 전역 가드 정상 작동(HTTP 409 차단), 정당한 워커 Phase 2 진행 허용** |
         | **`2026-10-15T16:17:30.000Z` (교정 포맷)** | `2026-10-15T16:17:10.000Z` (20초 잔여) | `lease < :now` | **`0` (False)** | **stale 복구 대상에서 정확히 제외 $\to$ 실행 중인 작업 보호** |
         | **`2026-10-15T16:17:30.000Z` (교정 포맷)** | `2026-10-15T16:17:30.000Z` (동률 경계) | `lease >= :now` | **`1` (True)** | **동률 경계 시 유효(Active) 인정** |
         | **`2026-10-15T16:17:30.000Z` (교정 포맷)** | `2026-10-15T16:17:30.001Z` (1ms 경과) | `lease < :now` | **`1` (True)** | **만료 즉시 stale 판정 $\to$ 안전한 복구 대상 식별** |

     - **MVP 운영 환경 한계 및 파괴적 공장 초기화 기본 비활성화 선언:**
       - FAB ONE MVP (Mode B)는 **로컬 단일 사용자(Single-User Local Desktop)** 환경으로 한정된다.
       - 파괴적 공장 초기화(Factory Wipe) 기능은 데이터 안전을 위해 **기본 비활성화(Disabled by default)** 상태로 봉인되며, 프로젝트 오너의 명시적 승인 전까지는 UI 및 실행 API 엔드포인트가 비활성화 상태를 유지한다.

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
               error_message = 'WORKER_CRASH_LEASE_EXPIRED: Worker lease expired without completion',
               updated_at_utc = :now
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
          -- 전역 단일 작업 검사 (엄격한 ISO 8601 UTC 사전순 비교)
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
           -- ※ 중요: Pre-Delete Guardrail 거부로 인한 예외는 기 확정된 최종 상태(CANCELLED/FAILED)를 보존해야 하므로,
           --         아래 Phase 3 에러 핸들러(FAILED 갱신)를 일체 호출하지 않고 우회(Bypass)하여 즉시 종료한다.

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
       3. **예외/오류 시 처리 (트랜잭션 3: Phase 3 저널 FAILED 단조 종결 및 CAS 보호, [F04-S1]):**
          트랜잭션 2 본체(데이터 역순 DELETE 도중 DB I/O 장애 등)에서 예기치 못한 오류 발생 시 해당 트랜잭션은 즉시 `ROLLBACK`되며, 에러 핸들러는 별도 트랜잭션에서 조건부 CAS 구문으로 저널을 종결 처리한다:
          ```sql
          -- [Phase 3: 트랜잭션 2 본체 실행 오류 시 저널 FAILED 단조 종결 트랜잭션]
          -- ※ 필수 격리 규칙:
          --    1. Pre-Delete Guardrail(2-1)에서 이미 'CANCELLED' 또는 'FAILED' 또는 리스 만료가 감지되어
          --       ROLLBACK된 경우, 이미 확정된 최종 상태를 유지해야 하므로 Phase 3를 절대 호출하지 않는다 (Bypass).
          --    2. Phase 3는 트랜잭션 2의 데이터 DELETE 도중 예기치 못한 DB 오류(I/O, 디스크 풀 등)로 ROLLBACK된 경우에만 진입한다.

          BEGIN IMMEDIATE;
          UPDATE system_operation_journal
             SET status = 'FAILED',
                 error_message = :err_message,
                 updated_at_utc = :now
           WHERE operation_id = :operation_id
             AND worker_id = :my_worker_id
             AND status = 'PENDING';

          -- [애플리케이션 계층 영향 행 수 검증 (changes == 1 필수)]
          -- IF (cursor.rowcount == 1 AND sqlite3_changes() == 1) THEN
          --     COMMIT;   -- PENDING -> FAILED 단조 종결 성공
          -- ELSE
          --     ROLLBACK; -- 이미 CANCELLED 또는 COMMITTED로 선행 종결되었거나 리스를 상실함. 기존 종결 상태 원천 보존!
          --     -- SELECT status FROM system_operation_journal WHERE operation_id = :operation_id;
          --     -- 조회된 기존 최종 상태(COMMITTED / CANCELLED / FAILED)를 불변 유지하고 임의 변조하지 않는다.
          -- END IF;
          ```
          - **종결 상태 단조성(Terminal State Monotonicity) 불변식:**
            `COMMITTED`, `CANCELLED`, `FAILED` 3대 상태는 비가역적 최종 상태(Terminal States)이다.
            `WHERE status = 'PENDING' AND worker_id = :my_worker_id` CAS 제약을 통해:
            - 사용자가 취소하여 이미 `CANCELLED`된 레코드는 `rowcount == 0`이 되어 `FAILED`로 오염되지 않고 `ROLLBACK;`으로 안전 방어된다.
            - Phase 2가 정상 커밋되어 이미 `COMMITTED`된 레코드는 `FAILED`로 번복되지 않는다.
            - 리스 만료로 백그라운드 복구에 의해 이미 `FAILED` 종결된 레코드 또한 지연 워커에 의해 임의 수정되지 않는다.

  3. **3단계 (서버 커밋 확인 후 클라이언트 상태 승격 및 `UNKNOWN` 취소 안전성):**
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

  4. **4단계 (IndexedDB 처리 및 의도 레코드 안전 소거):**
     - `purgeIndexedDbRequested === true`: `indexedDB.deleteDatabase('fab_one_user_notes')`를 비동기 실행하고, 성공 콜백에서 `localStorage.removeItem('fab_factory_wipe_intent')`를 호출하여 인텐트 레코드를 최종 제거한다.
     - `purgeIndexedDbRequested === false`: IndexedDB 삭제 단계를 **완전히 건너뛰고(Bypass)** 즉시 `localStorage.removeItem('fab_factory_wipe_intent')`를 호출하여 개인 메모를 안전하게 보존한다.

- **13종 장애 시퀀스 및 복구 상태 전이 매트릭스 (Crash & Recovery Specification Vectors):**
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
  | **WIPE-CRASH-10** (Vector h) | **Stale PENDING 복구 및 지연 워커 Phase 2 진입 반례 1** (트랜잭션 1 `PENDING` 커밋 후 워커 지연 $\to$ ISO 8601 UTC 리스 만료로 저널이 `FAILED` 전이된 후 지연 워커가 뒤늦게 Phase 2 실행 시도) | `status: FAILED (WORKER_CRASH_LEASE_EXPIRED)` | `status: INTENT_RECORDED` | `lease_expires_at_utc < :now` (ISO 8601 UTC) 정합 비교로 stale 워커 식별 $\to$ `FAILED` 전이. 지연 워커가 Phase 2 진입 시 Pre-Delete Guardrail(`SELECT status, worker_id, lease_expires_at_utc`)을 먼저 실행 $\to$ `status != 'PENDING'` 및 리스 만료 감지 $\to$ **모든 DELETE 실행 없이 즉시 `ROLLBACK;` (0건 삭제)**. Pre-Delete 거부 예외는 Phase 3 저널 수정을 호출하지 않으므로 기존 `FAILED` 종결 상태 불변 보존. 클라이언트는 `GET /status`로 `FAILED` 확인 후 IndexedDB 메모 보존 및 신규 `operationId` 안내. | **서버 데이터 삭제 0건 (Zero Rows Deleted, 기존 데이터 완전 보존)**, 무한 409 락 해소, 지연 워커 무단 삭제 원천 차단 및 FAILED 종결 상태 불변성 보장 |
  | **WIPE-CRASH-11** (Vector i) | **UNKNOWN 취소 경합 - 서버 선행 커밋 케이스** (취소 요청과 지연된 서버 트랜잭션 2의 커밋 경합) | 지연된 원본 트랜잭션 2 선행 완료 (`status: COMMITTED`) | `UNKNOWN` 판정 후 `POST /cancel` 호출 | 서버는 취소 CAS 구문(`UPDATE ... WHERE status='PENDING'`)에서 `rowcount == 0` 및 현재 상태 `COMMITTED` 확인 $\to$ `CANNOT_CANCEL_ALREADY_COMMITTED` (409) 응답 $\to$ 클라이언트는 취소 실패 확인 즉시 로컬 인텐트를 `SERVER_COMMITTED`로 승격 $\to$ `purgeIndexedDbRequested` 설정에 따른 후속 동기화 완결. Phase 3 CAS 역시 `status='PENDING'` 조건으로 인해 `COMMITTED` 상태를 `FAILED`로 오염시키지 못하고 롤백. | 경합 발생 시에도 사용자 취소 의도 및 IndexedDB 메모 보존 규칙 준수, 비정상 부분 커밋 배제 및 COMMITTED 종결 상태 단조성 보장 |
  | **WIPE-CRASH-12** (Vector j) | **동일 operationId 범위 불일치 재사용** (동일 ID에 서로 다른 `wipeOption` 유입) | `system_operation_journal`에 기존 옵션(`OPTION_1`) 등록됨 | 동일 `operationId`에 상이한 옵션(`OPTION_2`) 전송 | 서버는 저널의 `wipe_option`과 유입된 `wipeOption`을 비교 검증 $\to$ 불일치 확인 시 **HTTP 409 Conflict (`OPERATION_SCOPE_MISMATCH`)**로 fail-closed 즉시 거부 $\to$ 기존 트랜잭션 상태 및 DB 데이터 무변경. | 잘못된 식별자 재사용 및 파괴 범위 오적용 원천 차단 |
  | **WIPE-CRASH-13** (Vector k) | **UNKNOWN 취소 경합 - 정상 취소 성공 및 지연 워커 차단 반례 2** (클라이언트 취소 요청으로 저널 `CANCELLED` 커밋 후, 지연된 워커가 뒤늦게 Phase 2 실행 시도) | `status: CANCELLED` | `POST /cancel` 200 OK 수신 후 `localStorage.removeItem` | 지연 워커가 Phase 2 진입 시 Pre-Delete Guardrail을 실행 $\to$ `status == 'CANCELLED'` 감지 $\to$ **모든 DELETE 실행 없이 즉시 `ROLLBACK;` (0건 삭제)**. Pre-Delete 거절 예외는 Phase 3를 우회(Bypass)하며, 설령 진입하더라도 `WHERE status='PENDING'` CAS에 의해 `rowcount == 0` 감지 $\to$ 즉시 `ROLLBACK;`하여 기존 `CANCELLED` 종결 상태가 `FAILED`로 오염되는 것을 원천 차단. 추후 지연 도착한 원본 트랜잭션 1 또한 PK 충돌/톰스톤으로 차단. | **서버 데이터 삭제 0건 (Zero Rows Deleted, 기존 데이터 완전 보존)**, 취소된 작업의 지연 파괴 원천 차단, CANCELLED 종결 상태 불변성 보장, 클라이언트 인텐트 클린 제거 |

---

## 8. 정규화 CSV 직렬화 및 크로스 OS 동일 해시 검증 규약 ([F03], [F07] 반영)

OS별(macOS vs Linux) 줄바꿈 문자, 부동소수점 직렬화 차이로 인한 해시 불일치를 원천 차단하기 위해 **RFC 4180 기반 정규화 CSV 직렬화 규격(Canonical CSV Serialization Specification)**을 정의한다.

### 8.1 정규화 CSV 직렬화 규격
1. **문자 인코딩:** UTF-8 (BOM 바이트 `0xEF, 0xBB, 0xBF` 제외).
2. **줄바꿈 문자:** Unix 스타일 **LF (`\n`, `0x0A`)**만 허용 (CRLF `\r\n` 절대 금지). 파일의 마지막 행 끝에도 반드시 단일 LF(`\n`)를 포함한다.
3. **컬럼 순서 및 헤더 (7개 컬럼 엄격 고정):**
   `sim_timestamp_utc,equipment_id,chamber_id,sensor_id,measured_value,unit,quality_flag`
   *(주의: 런타임 호스트의 비결정론적 `ingest_time_utc`는 직렬화 및 해시 대상에서 엄격히 제외)*
4. **행 정렬 순서:** 제5.1절 7요소 `SortKey` 기준 오름차순 정렬 순서대로 기록.
5. **따옴표(Quoting) 규칙:**
   - RFC 4180 표준 준수: 숫자는 따옴표 없이 기록 (`unquoted`).
   - 텍스트 필드는 쉼표, 큰따옴표, 줄바꿈 문자를 포함하지 않는 경우 따옴표 없이 기록.
6. **결측치(Missing/Null) 직렬화:**
   - `measured_value`가 null(MISSING)인 경우 **따옴표 없는 빈 문자열 `""`**으로 기록 (`120.45,,mTorr` 형태).
   - `NaN`, `null`, `None` 문자열 절대 출력 금지.
7. **부동소수점 서식화:** 제6.2절의 `quantize_value` 함수를 적용하여 정규화.

### 8.2 소규모 골든 CSV 픽스처 사양 벤치마크 (Specification Fixtures, [F03] 수록)
다음 데이터는 구현 엔진 실행 결과가 아니며, 단위 테스트 작성 시 기대값으로 활용하기 위한 **사양 기준 벤치마크(Specification Reference Value)**이다:

- **Canonical CSV 예시 (`fixtures/golden/ETH-SYN-01-sample.canonical.csv`):**
  ```csv
  sim_timestamp_utc,equipment_id,chamber_id,sensor_id,measured_value,unit,quality_flag
  2026-10-15T01:00:01.000Z,ETCH-02,ETCH-02-CHB,CHAMBER_PRESSURE,120.45,mTorr,GOOD
  2026-10-15T01:00:01.000Z,ETCH-02,ETCH-02-CHB,RF_POWER,1500,W,GOOD
  2026-10-15T01:00:02.000Z,ETCH-02,ETCH-02-CHB,CHAMBER_PRESSURE,,mTorr,MISSING
  ```
  *(마지막 행 뒤에 단일 `\n` 포함)*

### 8.3 A04 QA 3-Run 동일 해시 수용 프로토콜
```text
[테스트 실행 1 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_1 ──> SHA-256 (Hash_1)
[테스트 실행 2 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_2 ──> SHA-256 (Hash_2)
[테스트 실행 3 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_3 ──> SHA-256 (Hash_3)

수용 판정 조건: Hash_1 == Hash_2 == Hash_3 (완전 일치, Diff 0 byte)
```

- **툴체인 핀닝:** Python 3.11+ 및 `requirements.txt`에 명시된 NumPy 릴리즈 버전 사용.
- **수치 비교 보조:** 크로스 플랫폼 환경에서 원시 float 배열 검증 시에는 허용 오차 $\epsilon = 10^{-7}$ 기반의 `numpy.testing.assert_allclose`를 단위 테스트로 병행한다.
- **설계와 실행의 분리:** 본 프로토콜은 차후 시뮬레이션 계산 엔진 및 CLI 구현 PR의 수용 조건(Acceptance Criteria)으로 채택하며, 현재 아키텍처 문서 검토 단계에서는 설계 정합성만을 검토한다(NOT_RUN).

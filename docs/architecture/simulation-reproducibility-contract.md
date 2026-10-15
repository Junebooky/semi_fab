# FAB ONE — 시뮬레이션 재현성 및 결정론적 실행 계약서 v0.4

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
- **단일 시간축 통일 및 해시 대상 스코프 ([F07] 해결):**
  - **시뮬레이션 시간 컬럼 단일화 (`sim_timestamp_utc`):** 동기식 가상 시뮬레이션 엔진에서 물리 사건 발생 시점은 가상 틱과 완전히 일치하므로, Canonical CSV 및 이벤트 스케줄러의 기준 시각은 **`sim_timestamp_utc` 단일 컬럼으로 완전 통일**한다. (기존 본문의 `event_time_utc` 분리 표기로 인한 충돌 해소).
  - **결정론적 해시 대상:** `sim_timestamp_utc`는 **Canonical CSV 직렬화 및 SHA-256 해시 검증 대상에 포함**된다.
  - **비결정론적 호스트 영속화 시각 (`ingest_time_utc`):** 실제 호스트 DB에 레코드가 기록되는 시스템 시각은 머신 부하 및 I/O 스케줄링에 따라 달라지는 비결정론적 텔레메트리이므로, **Canonical CSV 및 SHA-256 체크섬 대상에서 엄격히 제외**된다.

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

### 5.2 결정론적 `event_id` 해시 생성 산식 및 멱등 중복 폐기 규칙 ([F07] 산식 명세)
- **결정론적 `event_id` 생성 산식:**
  비결정론적 UUID(예: `uuid4()`)나 런타임 메모리 주소를 절대 배제하고, 도메인 불변값들의 정규화 문자열을 SHA-256 해시하여 앞 16자리를 취한다:
  $$\text{event\_id} = \text{SHA256}\Big(\text{f"{scenario\_id}:{seed}:{sim\_timestamp\_epoch\_ms}:{event\_phase}:{entity\_id}:{parameter\_id}:{logical\_step\_seq}"}\Big)[:16]$$
- **중복 이벤트 충돌(Duplicate Collision) 및 멱등 폐기 규칙:**
  - 동일한 `event_id`를 갖는 이벤트는 물리적으로 완벽히 동일한 사건을 의미한다.
  - 네트워크 재시도나 큐 재진입으로 인해 동일한 `event_id`를 가진 이벤트가 중복 유입되는 경우, **멱등성(Idempotency)** 원칙에 따라 최초 수신 이벤트만 처리하고 후속 중복 이벤트는 DB나 큐 상태를 전혀 변경하지 않고 `DUPLICATE_EVENT_DROPPED`로 안전하게 폐기(Drop)한다.

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

- **초기화 범위 선택지 (A01 기획 결정 필요):**
  - **옵션 1 (실행·사건 이력 초기화, A02 강력 권고안):**
    - 설비 마스터(`EQUIPMENT`, `CHAMBER`), 레시피(`RECIPE`), 기본 로트(`LOT`), 기본 웨이퍼(`WAFER`)의 기준 정보(Baseline Master Data)는 **온전히 보존**한다.
    - 시뮬레이션 동적 실행 데이터 및 조사 케이스만 역순으로 삭제:
      `case_action_log` $\to$ `investigation_case` $\to$ `fdc_alert` $\to$ `sensor_measurement` $\to$ `process_run_wafer` $\to$ `wafer_defect_map` $\to$ `process_run` $\to$ `simulation_session`.
    - **권고 사유:** 데모 및 학습 사용자가 매번 번거롭게 설비나 레시피를 재등록할 필요 없이 즉시 새로운 시뮬레이션을 재실행할 수 있어 UX 관점에서 가장 자연스럽고 안전함.
  - **옵션 2 (완전 공장 및 마스터 데이터 와이프):**
    - 동적 데이터뿐 아니라 `WAFER` $\to$ `LOT` $\to$ `RECIPE` $\to$ `CHAMBER` $\to$ `EQUIPMENT`까지 전체 데이터베이스를 0바이트 빈 DB로 초기화.
    - 초기화 완료 후 `fixtures/baseline/` JSON 파일로부터 마스터 데이터를 다시 적재(Master Seed Ingestion)하는 절차가 필수적임.

- **외래키 종속성을 완벽히 반영한 역순 삭제 단일 트랜잭션 (옵션 1 기준):**
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

- **브라우저 IndexedDB 비동기 삭제 및 비원자적 오류 복구 메커니즘 ([F04] 보완):**
  - 브라우저 IndexedDB는 SQLite 트랜잭션의 ACID 범위에 포함될 수 없으므로(분리 저장소), **2단계 분리 정리 프로토콜(Two-phase Cleanup Protocol)**을 준수한다:
    1. 백엔드 SQLite의 `BEGIN IMMEDIATE ... COMMIT` 삭제 트랜잭션이 성공적으로 완료된 후 클라이언트에 응답을 반환한다.
    2. 사용자가 `[선택] 브라우저 내 개인 학습 메모 및 환경설정도 함께 삭제`를 체크한 경우, 프론트엔드가 비동기로 `indexedDB.deleteDatabase()` 또는 오브젝트 스토어 `clear()`를 수행한다.
    3. **장애 복구 가드레일:** 브라우저 탭 강제 종료, 쿼터 잠금 등으로 IndexedDB 삭제가 실패할 경우, 프론트엔드는 `localStorage.setItem('fab_idb_cleanup_pending', 'true')` 플래그를 영속화하고, 다음 애플리케이션 기동 시 해당 플래그를 감지하여 IndexedDB를 즉시 재정리(Self-healing cleanup)함으로써 데이터 불일치 잔여물을 완전 소거한다.

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

# FAB ONE — 시뮬레이션 재현성 및 결정론적 실행 계약서

- **문서 ID:** ARCH-DOC-003
- **상태:** PROPOSED (A01 기획자 및 프로젝트 오너 승인 대기)
- **작성자:** A02 (수석 소프트웨어 개발 에이전트)
- **관련 Issue / PR:** Issue [#1](https://github.com/Junebooky/semi_fab/issues/1), Issue [#8](https://github.com/Junebooky/semi_fab/issues/8), Draft PR [#2](https://github.com/Junebooky/semi_fab/pull/2), QA PR [#3](https://github.com/Junebooky/semi_fab/pull/3), Design PR [#7](https://github.com/Junebooky/semi_fab/pull/7)
- **일자:** 2026-10-15

---

## 1. 배경 및 문제 정의: "시드만으로는 충분하지 않다" (QA-F01 대응)

A04 QA는 PR #3 및 리뷰 의견에서 단순 정수형 시드(`seed=42`) 지정만으로는 결정론적 재현성(Deterministic Reproducibility)을 보장할 수 없음을 지적했다.

실제 소프트웨어 환경에서는 다음 요인들로 인해 동일한 시드를 주입하더라도 다른 결과가 도출될 수 있다:
1. **난수 생성기(PRNG) 알고리즘 불일치:** Python 표준 `random`(Mersenne Twister), NumPy의 `PCG64`, 브라우저 JavaScript의 `Math.random()`은 서로 다른 수열을 생성함.
2. **비동기 이벤트 루프의 비결정적 실행 순서:** Node.js 또는 Python asyncio 환경에서 타이머 및 비동기 I/O 완료 시점이 달라 센서 측정치 기록 순서가 뒤바뀜.
3. **호스트 OS 및 CPU 아키텍처에 따른 부동소수점 오차:** x86_64(Intel/AMD)와 ARM64(Apple Silicon) 간의 부동소수점 연산 미세 오차.
4. **외부 입력(호스트 시스템 시간, 시스템 환경변수)의 개입.**

따라서 본 문서는 **"동일한 시나리오와 시드를 입력하면, 어떤 OS와 환경에서 언제 실행하더라도 항상 1비트의 오차도 없이 동일한 데이터 스트림과 알람을 생성한다"**는 결정론적 계약을 수립한다.

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

## 3. 원본 픽스처 거버넌스 및 암호화 체크섬 (SHA-256)

시뮬레이션의 모든 입력 조건(챔버 파라미터, 레시피 스텝, 이상 주입 시나리오)은 Git에 버전 관리되는 정적 파일에 정의된다.

### 3.1 픽스처 디렉터리 구조
```text
fixtures/
├── scenarios/
│   ├── ETH-SYN-01-pressure-drift.json
│   └── ETH-SYN-02-rf-arc-anomaly.json
└── baseline/
    ├── equipment_master.json
    └── recipe_library.json
```

### 3.2 픽스처 메타데이터 및 무결성 검증
시나리오 JSON 파일은 자체 SHA-256 체크섬 필드를 포함한다.

```json
{
  "scenarioId": "ETH-SYN-01",
  "version": "1.0.0",
  "title": "식각 챔버 B 압력 상승 및 센서 수집 지연 시나리오",
  "seed": 20261015,
  "generatorVersion": "fab-one-sim-v0.1.0",
  "prngAlgorithm": "PCG64",
  "fixtureHash": "sha256-7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
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

- **런타임 가드레일:** 시뮬레이터 구동 시 파일 내용의 SHA-256을 실시간 계산하여 `fixtureHash`와 대조한다. 1바이트라도 변조되었을 경우 `FIXTURE_INTEGRITY_VIOLATION` 예외를 발생시키고 실행을 즉시 중단한다.

---

## 4. 가상 시뮬레이션 클록 (Simulation Clock)

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

---

## 5. 이벤트 스케줄링 및 절대 순서(Total Ordering) 보장

동일한 시각($t$)에 여러 센서 측정이나 알람 평가가 동시에 발생하는 경우, 비동기 큐의 비결정적 선점을 방지하기 위해 엄격한 정렬 키를 강제한다.

### 5.1 결정론적 정렬 키 (Deterministic Sort Key)
$$\text{SortKey} = (\text{sim\_timestamp\_epoch\_ms}, \text{event\_priority}, \text{sequence\_counter}, \text{entity\_id})$$

1. **`sim_timestamp_epoch_ms` (1차 기준):** 가상 시뮬레이션 밀리초 타임스탬프 (오름차순).
2. **`event_priority` (2차 기준):** 공정 물리 상태 갱신(`0`) $\to$ 센서 샘플링(`1`) $\to$ FDC 룰 평가(`2`) $\to$ 알람 발행(`3`) 순서.
3. **`sequence_counter` (3차 기준):** 시뮬레이터 초기화 후 1씩 단조 증가(Monotonically Increasing)하는 64비트 정수.
4. **`entity_id` (4차 기준):** 설비 및 챔버 ID의 사전식 순서 (예: `CH-A` $\to$ `CH-B`).

---

## 6. 부동소수점 연산 및 수치 반올림 계약

### 6.1 연산 정밀도
- 모든 내부 공학 계산은 **IEEE 754 배정밀도(Double Precision, 64비트 부동소수점)**를 사용한다.

### 6.2 직렬화 및 UI 표기 반올림 규칙 (A01 결정 필요)
- **표준 규칙:** **사사오입 (`ROUND_HALF_UP`)**을 기본 채택한다.
  - 근거: 반도체 현장 엔지니어 및 품질 규격 검사에서 통상적으로 사용되는 직관적 반올림 방식 준수.
- **도메인 파라미터별 고정 소수점 자릿수:**
  - 챔버 압력: 소수점 둘째 자리 (예: `120.45 mTorr`)
  - 식각률: 소수점 첫째 자리 (예: `145.2 nm/min`)
  - 다이 수율: 소수점 둘째 자리 (예: `96.40%`)
  - $C_p$, $C_{pk}$: 소수점 셋째 자리 (예: `1.333`)
- **UI 가드레일:** 툴팁이나 상세 패널에서 계산 정밀도를 초과하는 가짜 정밀도(Fake Precision, 예: `120.4500000012`)를 절대 렌더링하지 않는다.

---

## 7. 상태 초기화(Reset) 및 스냅샷 명세

### 7.1 시뮬레이터 리셋(Reset)의 동작 범위
사용자 또는 테스트 러너가 `Reset` 명령을 실행했을 때:
1. **메모리 큐 및 버퍼:** 즉시 비워지며 $t = 0$ 시점으로 되돌아감.
2. **PRNG 상태:** 최초 시드값으로 완전 재초기화.
3. **SQLite 시뮬레이션 테이블 (`process_run`, `measurement`, `alarm`):**
   - 시나리오 기준 초기 픽스처 데이터 상태로 트랜잭션 롤백 또는 재생성.
4. **보존 영역 (격리 경계):**
   - 사용자가 작성한 **조사 케이스(Case 기록)**와 브라우저 IndexedDB의 **학습 메모**는 리셋 시 삭제되지 않고 보존된다. (단, 사용자가 명시적으로 '전체 데이터 초기화'를 실행한 경우 제외).

---

## 8. 재현성 수용 검증 프로토콜 (QA P-01, P-02 실행 기준)

A04 QA가 본 재현성 계약을 검증하기 위한 3단계 독립 실행 프로토콜을 제시한다:

```text
[테스트 실행 1 (Seed S)] ──> 출력 CSV_1 ──> SHA-256 (Hash_1)
[테스트 실행 2 (Seed S)] ──> 출력 CSV_2 ──> SHA-256 (Hash_2)
[테스트 실행 3 (Seed S)] ──> 출력 CSV_3 ──> SHA-256 (Hash_3)

검증 조건: Hash_1 == Hash_2 == Hash_3 (완전 일치, Diff 0 byte)
```

1. 동일한 시나리오 픽스처와 시드 $S$를 주입하여 3회 연속 독립 실행한다.
2. 각 실행 결과로 출력된 타임스탬프, 센서 계측치, 발생 알람 레코드를 CSV로 직렬화한다.
3. 3개 결과 파일의 SHA-256 해시를 비교하여 1비트의 차이도 없이 완전 일치해야 한다 (`PASS` 판정).
4. 서로 다른 OS 환경(macOS ARM64 vs Linux x86_64)에서도 동일한 해시가 생성되는지 교차 검증한다.

---

## 9. A01 기획자 결정 필요 항목 (Decisions Pending A01)

1. **[A01 결정 필요 3-1] 수치 반올림 표준 규칙 승인:**
   - [ ] 안 1 (권장): 사사오입 (`ROUND_HALF_UP`)
   - [ ] 안 2: 오사오입/은행원 반올림 (`ROUND_HALF_EVEN`)
2. **[A01 결정 필요 3-2] 기본 시나리오 틱 간격 (Tick Frequency):**
   - [ ] 안 1 (권장): 1초 (1,000ms, 웹 데모 및 가독성에 최적화)
   - [ ] 안 2: 100ms (실제 고속 FDC 센서 데이터 유사, 브라우저 렌더링 부하 증가 고려 필요)
3. **[A01 결정 필요 3-3] 시뮬레이션 기준 일시 (Base Date):**
   - [ ] 안 1 (권장): 고정 시각 `2026-10-15T01:00:00.000Z` (KST 오전 10시)로 고정하여 모든 데모에서 일관된 화면 제공

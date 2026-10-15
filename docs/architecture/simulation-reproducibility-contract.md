# FAB ONE — 시뮬레이션 재현성 및 결정론적 실행 계약서 v0.2

- **문서 ID:** ARCH-DOC-003
- **상태:** PROPOSED (A01 기획자 및 프로젝트 오너 승인 대기)
- **개정 이력:** v0.2 (2026-10-15, A01 리뷰 #6184247949 및 Codex P0/P1 의견 반영 — 순환 참조 해시 제거 및 사이드카 매니페스트 도입, 비동기 도착 순서에 독립적인 정렬 키 재설계, 시뮬레이션 세션 ID 기반 불변 이력 보존으로 외래키 충돌 방지, 정규화 CSV 직렬화 규격 명시)
- **작성자:** A02 (수석 소프트웨어 개발 에이전트)
- **관련 Issue / PR:** Issue [#1](https://github.com/Junebooky/semi_fab/issues/1), Issue [#8](https://github.com/Junebooky/semi_fab/issues/8), Draft PR [#2](https://github.com/Junebooky/semi_fab/pull/2), QA PR [#3](https://github.com/Junebooky/semi_fab/pull/3), Design PR [#7](https://github.com/Junebooky/semi_fab/pull/7), PR [#10](https://github.com/Junebooky/semi_fab/pull/10)

---

## 1. 배경 및 문제 정의: "시드만으로는 충분하지 않다" (QA-F01 대응)

A04 QA는 PR #3 및 리뷰 의견에서 단순 정수형 시드(`seed=42`) 지정만으로는 결정론적 재현성(Deterministic Reproducibility)을 보장할 수 없음을 지적했다.

소프트웨어 런타임 환경에서는 다음 요인들로 인해 동일 시드를 주입하더라도 다른 결과가 도출될 수 있다:
1. **난수 생성기(PRNG) 알고리즘 불일치:** Python 표준 `random`(Mersenne Twister), NumPy의 `PCG64`, 브라우저 JavaScript의 `Math.random()`은 완전히 다른 수열을 생성함.
2. **비동기 이벤트 루프의 비결정적 실행 순서:** Node.js 또는 Python asyncio 환경에서 타이머 및 비동기 I/O 완료 시점이 달라 센서 측정치 기록 순서가 뒤바뀜.
3. **호스트 OS 및 CPU 아키텍처에 따른 부동소수점 오차:** x86_64(Intel/AMD)와 ARM64(Apple Silicon) 간의 미세 연산 오차 및 문자열 직렬화 차이.
4. **외부 입력(호스트 시스템 시간, 시스템 환경변수)의 개입.**

따라서 본 문서는 **"동일한 시나리오 픽스처와 시드를 입력하면, 고정된 실행 툴체인(Python 3.11, pinned NumPy)과 정규화 직렬화 규약 하에서 동일한 바이트의 데이터 스트림과 알람을 재현한다"**는 결정론적 계약을 수립한다.

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

### 3.1 픽스처 디렉터리 및 사이드카 매니페스트 구조
JSON 파일 내부에 자신의 해시값을 포함시키면 해시 계산 시 입력이 변경되는 **순환 참조(Self-Referential Hash)**가 발생한다. 이를 원천 차단하기 위해 **외부 사이드카 매니페스트(`manifest.json`) 및 표준 체크섬 파일(`checksums.sha256`)** 방식을 채택한다.

```text
fixtures/
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
  7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069  scenarios/ETH-SYN-01-pressure-drift.json
  3a19b88219ecdfa28399e5512b001a1c93a02fae836104bcba129d33a1e289c0  scenarios/ETH-SYN-02-rf-arc-anomaly.json
  ```
- **런타임 가드레일:** 시뮬레이터 구동 시 파일의 SHA-256을 실시간 계산하여 `checksums.sha256`과 대조한다. 1바이트라도 변조되었을 경우 `FIXTURE_INTEGRITY_VIOLATION` 예외를 발생시키고 실행을 즉시 중단한다.
- **CLI 검증 지원:** `sha256sum -c fixtures/checksums.sha256` 명령어로 CI 및 로컬 환경에서 외부 도구 없이 즉시 검증 가능.

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

## 5. 이벤트 스케줄링 및 절대 순서(Total Ordering) 보장 (P0-3 대응)

비동기 콜백 도착 시점에 증가하는 메모리 카운터는 네트워크 지연이나 비동기 스케줄러의 미세한 타이밍 차이에 따라 순서가 뒤바뀌는 비결정성을 유발한다. 따라서 **이벤트 큐의 정렬 키는 비동기 도착 순서가 아닌, 완전히 정적인 도메인 속성만으로 구성**한다.

### 5.1 결정론적 정렬 키 (Deterministic Sort Key)
$$\text{SortKey} = (\text{sim\_timestamp\_epoch\_ms}, \text{event\_phase}, \text{entity\_type}, \text{entity\_id}, \text{parameter\_id}, \text{logical\_step\_seq})$$

1. **`sim_timestamp_epoch_ms` (1차 기준):** 가상 시뮬레이션 밀리초 타임스탬프 (오름차순 정수).
2. **`event_phase` (2차 기준):** 공정 물리 상태 갱신(`0`) $\to$ 센서 샘플링(`1`) $\to$ FDC 룰 평가(`2`) $\to$ 알람 발행(`3`) 고정 우선순위.
3. **`entity_type` (3차 기준):** `"EQUIPMENT"` (`1`) $\to$ `"CHAMBER"` (`2`) $\to$ `"SENSOR"` (`3`).
4. **`entity_id` (4차 기준):** 설비 및 챔버 ID의 사전식 순서 (예: `"ETCH-01-CHA"` $<$ `"ETCH-02-CHB"`).
5. **`parameter_id` (5차 기준):** 파라미터명 사전식 순서 (예: `"CHAMBER_PRESSURE"` $<$ `"RF_POWER"`).
6. **`logical_step_seq` (6차 기준):** 시나리오 레시피 스텝에 사전 할당된 정적 시퀀스 번호 (정수).

> **결과:** 어떤 비동기 큐나 스레드 풀에서 콜백이 먼저 리턴되더라도, 정렬 키에 의해 항상 동일한 정적 순서로 직렬화된다.

---

## 6. 부동소수점 연산 및 수치 반올림 계약

### 6.1 연산 정밀도
- 모든 내부 공학 계산은 **IEEE 754 배정밀도(Double Precision, 64비트 부동소수점)**를 유지한다. 내부 계산 중간 단계에서는 반올림을 적용하지 않는다.

### 6.2 직렬화 및 UI 표기 반올림 규약
출력 단계(JSON 직렬화, CSV 내보내기, UI 화면 표시)에서만 Python의 `decimal.Decimal` 모듈과 **`ROUND_HALF_UP` (사사오입)**을 적용하여 소수점 자릿수를 고정한다:

- 챔버 압력: 소수점 둘째 자리 (예: `120.45 mTorr`)
- 식각률: 소수점 첫째 자리 (예: `145.2 nm/min`)
- 다이 수율: 소수점 둘째 자리 (예: `96.40%`)
- $C_p, C_{pk}, P_p, P_{pk}$: 소수점 셋째 자리 (예: `1.333`)
- **가드레일:** 계산 정밀도를 초과하는 가짜 정밀도(Fake Precision, 예: `120.450000000001`)를 차트 툴팁이나 API로 노출하지 않는다.

---

## 7. 상태 초기화(Reset) 및 이력 보존 외래키 정합성 (P0-3 대응)

### 7.1 문제 분석
조사 케이스(`INVESTIGATION_CASE`)가 특정 공정 실행(`run_id`) 및 알람(`alert_id`)을 외래키(`ON DELETE RESTRICT`)로 참조하고 있을 때, 시뮬레이터 리셋 명령으로 원본 실행/알람 테이블을 삭제(`DELETE FROM process_run`)하면 **외래키 충돌(`FOREIGN KEY constraint failed`)로 인해 리셋이 실패**한다.

### 7.2 해결책: 시뮬레이션 세션 ID 기반 불변 이력 보존 (Soft-Reset)
시뮬레이터의 리셋 동작을 물리적 레코드 삭제가 아닌 **세션 분리 및 논리적 아카이빙**으로 정의한다:

1. **세션 식별자 (`simulation_session_id`):** 모든 공정 실행, 계측치, 알람 레코드는 세션 ID를 갖는다.
2. **리셋 동작:**
   - 기존 세션의 활성 플래그를 비활성화한다: `UPDATE simulation_session SET is_active = 0 WHERE session_id = :current_id;`.
   - 새로운 세션(`new_session_id`)을 생성하고 가상 클록을 $t = 0$으로 초기화한다.
   - 활성 대시보드는 `is_active = 1`인 최신 세션 데이터만 필터링하여 조회한다.
3. **이력 보존 및 무결성 보장:**
   - 기존 세션에서 생성된 조사 케이스(`case_id`)는 과거의 `run_id` 및 `alert_id`를 그대로 안전하게 참조하며, 외래키 무결성을 안정적으로 보존한다.
4. **전체 공장 초기화 (Factory Wipe):** 사용자가 명시적으로 '전체 데이터 초기화'를 확인한 경우에 한하여, 단일 트랜잭션 내에서 자식 테이블(`CASE_ACTION_LOG` $\to$ `INVESTIGATION_CASE` $\to$ `FDC_ALERT` $\to$ `PROCESS_RUN`) 순서로 삭제한다.

---

## 8. 정규화 CSV 직렬화 및 크로스 OS 동일 해시 검증 규약 (P0-3 대응)

OS별(macOS vs Linux) 줄바꿈 문자, 부동소수점 직렬화 차이로 인한 해시 불일치를 원천 차단하기 위해 **정규화 CSV 직렬화 규격(Canonical CSV Serialization Specification)**을 정의한다.

### 8.1 정규화 CSV 직렬화 규격
1. **문자 인코딩:** UTF-8 (BOM 바이트 `0xEF, 0xBB, 0xBF` 제외).
2. **줄바꿈 문자:** Unix 스타일 **LF (`\n`, `0x0A`)**만 허용 (CRLF `\r\n` 절대 금지).
3. **컬럼 순서 및 헤더:** 스키마 정의 순서로 고정:
   `sim_timestamp_utc,equipment_id,chamber_id,sensor_id,measured_value,unit,quality_flag`
4. **행 정렬 순서:** 제5.1절의 `SortKey` 기준으로 정렬된 순서대로 기록.
5. **부동소수점 서식화:** Python 표준 서식(`{:.4f}`) 또는 `decimal.Decimal`을 통해 소수점 자릿수를 고정하고 지수 표기(`1e-05`)나 미세 오차 문자열이 발생하지 않도록 정규화.

### 8.2 A04 QA 3-Run 동일 해시 수용 프로토콜
```text
[테스트 실행 1 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_1 ──> SHA-256 (Hash_1)
[테스트 실행 2 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_2 ──> SHA-256 (Hash_2)
[테스트 실행 3 (Seed S)] ──> 정규화 직렬화 ──> Canonical CSV_3 ──> SHA-256 (Hash_3)

수용 판정: Hash_1 == Hash_2 == Hash_3 (완전 일치, Diff 0 byte)
```

- **툴체인 핀닝:** Python 3.11+ 및 `requirements.txt`에 명시된 NumPy 릴리즈 버전 사용.
- **수치 비교 보조:** 크로스 플랫폼 환경에서 원시 float 배열 검증 시에는 허용 오차 $\epsilon = 10^{-7}$ 기반의 `numpy.testing.assert_allclose`를 단위 테스트로 병행한다.

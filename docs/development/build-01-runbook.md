# FAB ONE Etch Live Interactive Demo Runbook (BUILD-01)

## 1. 개요
본 문서는 FAB ONE의 첫 번째 동작 가능한 브라우저 기반 데모인 **식각(Etch) 챔버 센서 모니터링 & 이상 탐지 데모**의 실행 및 검증 가이드입니다.

- **브랜치:** `a02/build-01-live-etch-demo`
- **대상 장비/챔버:** `ETCH-02 / CH-B`
- **시나리오:** `ETH-SYN-01` (8단계 T0~T7 시계열, T4/T5 결측 단절, T7 이상 스파이크)
- **듀얼 모드 지원:**
  - **Mode A (합성 픽스처 모드):** 백엔드가 실행되지 않은 환경에서도 브라우저 자체 합성 픽스처로 100% 조작 가능.
  - **Mode B (실시간 API 연동 모드):** Python FastAPI + SQLite 백엔드 실행 시 실시간 API와 동기화 (`http://localhost:8000`).

---

## 2. 요구사항 및 설치

### 필수 런타임
- Node.js v18+ (검증 환경: Node v24.3.0, npm 11.4.2)
- Python 3.10+ (검증 환경: Python 3.12.9)

### 의존성 설치
```bash
# 1. 프론트엔드 의존성 설치
cd apps/web
npm install
cd ../..

# 2. 백엔드 의존성 설치 (가상환경 권장)
pip install fastapi uvicorn pydantic
```

---

## 3. 실행 방법 (Localhost)

터미널 2개를 열어 각각 백엔드와 프론트엔드를 실행합니다.

### 터미널 1: 백엔드 API 서버 실행 (포트 8000)
```bash
# 프로젝트 루트(semi_fab)에서 실행
python3 -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API Health:** `http://localhost:8000/api/v1/health`
- **Swagger UI:** `http://localhost:8000/docs`

### 터미널 2: 프론트엔드 웹 앱 실행 (포트 3000)
```bash
cd apps/web
npm run dev
# 또는 프로덕션 빌드 실행:
# npm run build && npm run start
```
- **웹 앱 접속:** `http://localhost:3000`

---

## 4. 브라우저 조작 가이드 (주요 기능)

`http://localhost:3000` 접속 후 상단 제어판의 버튼을 통해 다음 인터랙션을 검증할 수 있습니다:

1. **데모 시작 (`데모 시작 (Start)`):**
   - 타임라인을 T0으로 리셋하고 1.2초 간격으로 T0부터 T7까지 자동 재생을 시작합니다.
   - 우측 챔버 계측 수치와 차트의 커서가 실시간으로 전진합니다.
2. **일시정지 / 재생 (`일시정지 (Pause) / 재생 (Resume)`):**
   - 진행 중인 자동 재생을 일시정지하거나 멈춘 지점부터 다시 진행합니다.
3. **다음 스텝 (`다음 스텝 (+1)`):**
   - 1스텝씩 수동으로 전진합니다 (T0 -> T1 -> ... -> T7).
4. **이상 구간 탐색 (`이상 구간 탐색 (Seek T7 Anomaly)`):**
   - 즉시 T7 이상 발생 시점으로 점프합니다.
   - `AL-DEMO-001` 알람 카드가 강조 표시됩니다.
   - 25매 웨이퍼 중 잠재 노출 후보군 5매(`W-08`~`W-12`)가 붉은색 펄스 테두리로 시각화됩니다.
   - 상단 상태 뱃지가 `이상 감지 (AL-DEMO-001)`로 전환됩니다.
5. **시드 변경 (`시드 변경 (Seed)`):**
   - 난수 시드(20261015, 9999, 42 등)를 변경하여 동일 시나리오를 재합성 및 리셋합니다.
6. **웨이퍼 슬롯 클릭:**
   - 5x5 FOUP 카세트 그리드에서 특정 웨이퍼(예: #8 `W-08`, #1 `W-01`)를 클릭하면 하단에 상세 추적 카드(노출 상태, 시퀀스, 판정 근거)가 표시됩니다.
7. **센서 메트릭 전환:**
   - 차트 상단의 `상대 신호 [a.u.]` / `챔버 압력 [mTorr]` 탭을 클릭하여 메트릭을 교체할 수 있습니다.
   - T4, T5 구간은 결측(`null`)으로 처리되어 0으로 떨어지는 직선이 아닌 **단절된 분절선(Broken Segment)**으로 안전하게 표현됩니다.

---

## 5. 자동화 테스트 방법

### 1) 백엔드 단위 테스트
FastAPI 엔드포인트 7종(Health, Summary, Samples, Alerts, Wafers, Seek Anomaly, Start Run)을 격리된 SQLite 테스트 환경에서 검증합니다:
```bash
python3 -m unittest services/api/tests/test_api.py
```
*결과: 7 passed in ~0.03s*

### 2) 프론트엔드 계약 및 분절 테스트
Mode A 합성 픽스처 무결성과 결측 SVG 단절선 계산 로직을 테스트합니다:
```bash
cd apps/web
npm test
cd ../..
```
*결과: 3 passed in ~30ms*

### 3) 라이브 통합 검증 (서버 가동 중)
서버가 띄워진 상태에서 HTTP 통신 및 렌더링 무결성을 일괄 검증합니다:
```bash
python3 services/api/tests/verify_live.py
```

---

## 6. 개발 범위 및 안전 경계
- **포함 사항:** 단일 식각 챔버(`ETCH-02 / CH-B`), 8단계 시계열 합성 센서, 25매 웨이퍼 FOUP 매트릭스, 조작 버튼 5종, FDC 알람 및 잠재 영향군 연계.
- **제외 사항 (설계 제한):** Factory Wipe, 관리자 전체 삭제, 파괴적 DROP TABLE, Supabase 운영 연동, 미승인 고급 통계(Cpk 등)는 철저히 배제되었습니다.

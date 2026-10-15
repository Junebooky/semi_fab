# FAB ONE — Semiconductor Engineering Workspace

반도체 제조 현장의 **공정·장비·PI·품질·제조·수율 분석** 업무를 연결하는 시뮬레이션 기반 엔지니어링 협업·분석 플랫폼 프로젝트입니다.

> **상태: Phase 1 프로토타입 개발 (BUILD-01 완료)** · 실제 FAB나 장비에 연결되지 않은 합성 시뮬레이션 환경입니다.

---

## 🚀 빠른 시작 (Quick Start)

본 프로젝트는 **Next.js 14 프론트엔드**와 **FastAPI + SQLite 백엔드**로 구성되어 있으며, 백엔드 미실행 상태에서도 브라우저 독립 합성 픽스처(Mode A)로 100% 조작 가능합니다.

### 1. 프론트엔드 웹 앱 실행
```bash
cd apps/web
npm install
npm run dev
```
- 브라우저 접속: **`http://localhost:3000`**

### 2. 백엔드 시뮬레이션 API 서버 실행 (선택 사항)
```bash
# 프로젝트 루트에서 실행
python3 -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Health: **`http://localhost:8000/api/v1/health`**
- Swagger API Docs: **`http://localhost:8000/docs`**

상세 실행 및 브라우저 조작 방법은 [BUILD-01 Runbook](docs/development/build-01-runbook.md)을 참조하세요.

---

## 🧪 브라우저 데모 주요 기능 (Etch Chamber)

1. **식각 챔버 단일 시나리오 (`ETCH-02 / CH-B`):**
   - A03의 화이트 UI & 에메랄드 일러스트 에셋을 계승한 고밀도 엔지니어링 대시보드.
2. **합성 센서 시계열 차트 (T0~T7):**
   - 상대 신호(`RELATIVE_SIGNAL`) 및 챔버 압력(`CHAMBER_PRESSURE`) 시계열.
   - **결측 안전 처리:** T4, T5 결측치(`null`)는 0으로 이어지지 않고 안전하게 단절된 분절선으로 렌더링.
3. **사용자 조작 인터랙션:**
   - **데모 시작 (Start):** T0부터 T7까지 1.2초 간격 자동 순차 재생.
   - **일시정지 / 재생 (Pause/Resume):** 타임라인 제어.
   - **다음 스텝 (+1):** 단일 스텝 수동 전진.
   - **이상 구간 탐색 (Seek T7 Anomaly):** T7 이상 시점으로 즉시 이동, `AL-DEMO-001` 알람 및 영향 가능 Lot/Wafer 5매(`W-08`~`W-12`) 집중 강조.
   - **시드 변경 (Seed Reset):** 다른 난수 시드로 시나리오 재합성.
4. **25매 웨이퍼 FOUP 매트릭스:**
   - 5x5 카세트 그리드에서 노출 완료(1~7번), 잠재 영향(8~12번), 미노출(13~25번) 상태 시각화 및 개별 슬롯 클릭 상세 조회.

---

## 🛠️ 테스트 수행 방법

```bash
# 1. 백엔드 단위 테스트 (FastAPI + SQLite)
python3 -m unittest services/api/tests/test_api.py

# 2. 프론트엔드 계약 및 SVG 분절 테스트
cd apps/web && npm test && cd ../..

# 3. 실시간 통합 검증 (서버 가동 중)
python3 services/api/tests/verify_live.py
```

---

## 🏛️ 제품 방향 & 에이전트 협업
- **A01:** 제품 기획·반도체 도메인·검수 (ChatGPT)
- **A02:** 개발 (프론트엔드·API·데이터·시뮬레이터)
- **A03:** UX/UI 디자인 (Toss-inspired / 3D Clay / 공학 지식 UX)
- **A04:** QA 및 공학 데이터 검증
- **A05:** 포트폴리오·기술 커뮤니케이션
- **A06:** 아키텍처 문서 및 계약 유지보수

## ⚠️ 시연 데이터 및 안전 주의사항
- 본 저장소의 모든 데이터는 `ETH-SYN-01` 시나리오 기반 합성 데이터(Synthetic Data)이며, 실제 반도체 제조사의 영업비밀이나 생산 데이터는 일체 포함되지 않습니다.
- 본 브랜치에는 Factory Wipe, 관리자 전체 삭제, Supabase 프로덕션 연동 등 파괴적 기능이 포함되어 있지 않습니다.

# FAB ONE — Semiconductor Engineering Workspace

반도체 제조 현장의 **공정·장비·PI·품질·제조·수율 분석** 업무를 연결하는 시뮬레이션 기반 엔지니어링 협업·분석 플랫폼 프로젝트입니다.

> **상태: 기획 / 초기 구축** · 실제 FAB나 장비에 연결되지 않았으며, 현장 검증된 생산 시스템이 아닙니다.

## 제품 방향
- 가상 Etch 장비 이상 → 공정 계측/설비 데이터 분석 → 영향 Lot/Wafer 추적 → 조사/조치 워크플로
- SPC/FDC/수율 데이터 시각화와 출처가 연결된 공학 지식 설명(Engineering Knowledge Layer)
- 토스의 공개 UX 원칙을 참고하되 고유 에셋과 자체 디자인 시스템 사용

## 개발 아키텍처 결정
MVP의 **Local-first vs Supabase** 전략은 현재 검토 중입니다. 확정 전 가정은 [Issue #1](https://github.com/Junebooky/semi_fab/issues/1)에 기록되어 있습니다. 데이터 저장소를 무단으로 확정하거나 실제 DB에 변경을 적용하지 마세요.

## 에이전트
- **A01:** 제품 기획·반도체 도메인·검수 (ChatGPT)
- **A02:** 개발 (프론트엔드·API·데이터·시뮬레이터)
- **A03:** UX/UI 디자인 (Toss-inspired / 3D Clay / 공학 지식 UX)
- **A04:** QA 및 공학 데이터 검증
- **A05:** 포트폴리오·기술 커뮤니케이션

## 협업 원칙
GitHub Issue → 에이전트 작업 브랜치 → Pull Request → QA·A01 검토 → 사용자 승인·병합. 초기 README 커밋을 제외하고 `main` 직접 변경은 금지합니다.

## 시연 데이터 주의
공개 저장소에는 실제 반도체 기업의 영업비밀·생산 데이터, API Secret, DB 비밀번호 등을 커밋하지 않습니다. 합성 시뮬레이션 데이터와 공개 연구 데이터는 엄격하게 구분합니다.

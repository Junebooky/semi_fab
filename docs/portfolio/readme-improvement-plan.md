# FAB ONE — GitHub README 개선 계획 (A05 / Issue #5)

> **문서 상태:** REVIEW · 2026-10-15 · **이번 PR은 계획 문서만 추가한다. `main`의 `README.md`는 수정하지 않는다.**  
> **현재 제품:** 기획·초기 구축 / 합성 Etch 시나리오 기반 시뮬레이션 목표 / 실제 FAB·장비 미연동.  
> **실행 조건:** README 변경은 A01의 검토 및 프로젝트 소유자 승인 후 **별도 브랜치/PR**로 시행.

## 1. 현행 README 점검

점검 기준: [`README.md` @ main / `57b4dd4`](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md).

| 확인한 장점 | 개선이 필요한 부분 | 현 단계 처리 |
| --- | --- | --- |
| 상태를 “기획 / 초기 구축”으로 명시 | 목표 기능을 현재 기능으로 오해할 가능성 | 목적/계획/검증 상태를 각각 라벨링 |
| 실제 FAB 미연동과 합성 데이터 주의 | 시나리오·fixture·버전·계보·출처 목록 부재 | 실제 데이터 자산 생성 후 증거 연결 |
| Etch 이상 → Lot/Wafer 스토리 존재 | 사용자 질문·연관성 검증·인과 오해 방지 설명 부족 | [포지셔닝 초안](./product-positioning.md) 참고 |
| 에이전트 협업 및 Issue→PR 프로세스 기재 | 기능 SHA, 재현 환경, QA, 소유자 기여 증거 부재 | [주장·근거 매트릭스](./claims-evidence-matrix.md) 적용 |
| 저장소 선택 미확정 상태 표시 | Mode A/B/C 제안이 확정 아키텍처처럼 보일 위험 | [Issue #1](https://github.com/Junebooky/semi_fab/issues/1) 최종 결론 이후 갱신 |

**원칙:** 아직 완성 제품형 README로 대체하지 않는다. 실제 증거가 생길 때마다 단계별로 승격하고, Hero부터 **무엇을 목표로 하는가 / 무엇이 실제 구현됐는가 / 검증 수준은 무엇인가**를 구분한다.

## 2. 제안 README 정보 구조

| 순서 | 섹션 | 표시 내용 | 선행 조건 |
| --- | --- | --- | --- |
| 01 | Hero · Status | 현재 기획 단계, 합성 시뮬레이션, 실제 FAB 미연동 | A01 메시지 검수 |
| 02 | Problem & Audience | 데이터 기반 공정 이상 조사라는 **문제 가설**, 대상 직무와 한계 | A01 도메인 검수 |
| 03 | Etch Investigation Story | 경고 관찰 → 설비/공정 맥락 → 영향 **후보** → 가설 → 조사 이력 | 초기에는 콘셉트만 |
| 04 | Features & Implementation Status | 기능별 PLANNED/IN_PROGRESS/VERIFIED, 구현 SHA, QA 상태 | A02/A04 증거 |
| 05 | Actual Demo & Screenshots | 진짜 앱의 캡처·실행 가이드·버전·합성 데이터 표시 | A02 실제 동작, A03 에셋 검증 |
| 06 | Engineering Knowledge Layer | 개념·수식·단위·가정·출처·관련 경고 UX | A01/A02/A03/A04 검수 |
| 07 | Architecture & Data Provenance | 승인 아키텍처, 합성·공개 데이터 구분, seed·단위·버전 | A01 승인 ADR·A02 계약 |
| 08 | Tech Stack & Run Locally | 정확한 런타임·종속성·시드·재현 명령 | A02 실행 가능 커밋 |
| 09 | Tests & Validation | 코드 SHA, testcase, seed/fixture, PASS/FAIL/NOT_RUN, 로그 | A04 실제 실행 증거 |
| 10 | Decisions & Tradeoffs | 채택/기각된 설계 선택과 근거 | 승인된 ADR/PR |
| 11 | Roadmap & Limitations | 구현 단계별 미완료 기능, 미검증·실 FAB 미연동 | 매 단계 갱신 |
| 12 | Collaboration & Authorship | 소유자 의사결정·AI 에이전트 실제 기여 구분 | GitHub PR/Issue 추적 |
| 13 | References · Security · License | 데이터 출처·권리·라이선스·기밀 주의 | 확인된 근거만 |

**UX 목표:** GitHub 첫 화면에서 방문자가 빠르게 현재 상태와 증거 유무를 파악하도록 한다. 이미지 중심 소개를 하더라도 숫자·단위·출처·불확실성 텍스트는 제거하지 않는다.

## 3. Hero 문안 제안 (아직 미적용)

> # FAB ONE — Semiconductor Engineering Workspace  
> **기획·초기 구축 · 합성 데이터 기반 시뮬레이션 목표 · 실제 FAB/장비 미연동**  
>
> FAB ONE은 **가상 Etch 설비 이상**을 시작으로, 데이터 관찰·영향 Lot/Wafer 후보 조사·문제 해결 이력의 엔지니어링 흐름을 소프트웨어로 재현하려는 프로젝트입니다.
>
> **현재 공개된 증거:** 초기 README, 아키텍처 제안, QA 테스트 계획. **검증된 실행 애플리케이션/시뮬레이터는 아직 없음.**
>
> [제품 기획](docs/portfolio/product-positioning.md) · [근거 매트릭스](docs/portfolio/claims-evidence-matrix.md) · [Issues](https://github.com/Junebooky/semi_fab/issues)

이 문구 역시 최종 승인이 아니라 **A01 검토 대상**이다.

## 4. 구현 현황 표 (README 공개 템플릿)

| 기능 | 현 단계 | 구현 SHA | 데모 | A04 검증 |
| --- | --- | --- | --- | --- |
| Etch 합성 이상 시나리오 | PLANNED | 없음 | 없음 | NOT_RUN |
| SPC/FDC 시계열·경고 | PLANNED | 없음 | 없음 | NOT_RUN |
| 장비/챔버/Run 관계 | PLANNED | 없음 | 없음 | NOT_RUN |
| Lot/Wafer 후보 추적 | PLANNED | 없음 | 없음 | NOT_RUN |
| Investigation 이력 | PLANNED | 없음 | 없음 | NOT_RUN |
| EKL 공학 지식 패널 | PLANNED | 없음 | 없음 | NOT_RUN |
| Local-first 아키텍처 | PROPOSED (미승인) | 없음 | 없음 | 실행 검증 없음 |

`PLANNED`는 구현 증빙이 아닌 제품 방향만을 뜻한다. “Code available”과 “QA verified”를 구분하고, 구현 결과 없는 사용자 인터페이스 그림은 `CONCEPT / 미구현`으로만 표시한다.

## 5. 필요 증빙·데모 에셋 목록

| 에셋 | 반드시 필요한 정보 | 담당 | 공개 조건 |
| --- | --- | --- | --- |
| 실동작 UI 캡처·영상 | 기능명, 실행 SHA·환경, 화면 내 `SYNTHETIC`/`SIMULATION` 표기 | A02/A03 | 실제 화면 확인 |
| 3분 핵심 시연 | 정해진 seed·장비/챔버, 경고 기준, 영향 **후보**와 반례, 조사 기록 | A01/A02/A03/A04/A05 | 실제 실행·증거 공유 |
| 아키텍처 다이어그램 | 승인 버전, 데이터 흐름, 저장/연동 경계, Mode A/B/C 범위 | A01/A02 | ADR 승인 후 |
| 데이터 카드 | 생성기·seed·fixture hash·라이선스/출처·단위·시각·정제 범위 | A02/A04 | 비밀정보 없음·재현 가능 |
| 수식·통계 카드 | 계산식, 분모/표본/추정량, 단위·조건, 참고문헌, 검증 ID | A01/A02/A04 | 동작 및 공학 검수 |
| CI/QA 로그 | 실제 실행일, SHA, OS/런타임, 테스트 ID, PASS/FAIL/NOT_RUN, 로그 URL | A04 | 재현 가능한 실행 결과 |
| 기여·의사결정 로그 | 소유자 결정 및 AI 에이전트 기여를 PR/Issue로 분리 | 소유자/A01/A05 | 확인된 활동만 |

**없는 에셋은 만들어낸 링크나 수치로 대체하지 않는다.** AI 생성 목업을 실제 작동 화면처럼 제시하지 않는다.

## 6. 단계별 README 갱신 및 게이트

### Phase 0 — 지금: 근거 기반 기획 소개

- 본 [Issue #5](https://github.com/Junebooky/semi_fab/issues/5)의 3개 문서를 별도 PR로 제출한다.
- README 본문 변경 보류. A01·사용자에게 핵심 문구 및 변경 범위를 승인 요청.
- [Draft PR #2](https://github.com/Junebooky/semi_fab/pull/2)의 ADR-001은 여전히 `PROPOSED`, [PR #3](https://github.com/Junebooky/semi_fab/pull/3)의 20개 예정 테스트는 **0 PASS / 20 NOT_RUN**으로 유지.

### Phase 1 — A02 실행 가능한 합성 MVP

**착수 조건:** A01/소유자의 MVP 범위·모드 승인, A02 코드 및 실행/seed/fixture 증빙.

- 구현된 기능만 `IN_PROGRESS` 및 “동작 예시”로 표현한다. 실행 가능한 URL 또는 로컬 실행법, 데이터 출처, 커밋 SHA 추가.
- 데모 영상은 실제 실행 캡처와 mockup을 명확히 구분한다.
- A04가 PASS를 내기 전에는 `VERIFIED`나 “QA 통과” 금지.

### Phase 2 — A04 독립 QA·A01 도메인 승인

**착수 조건:** A04 실제 테스트 실행, A01 시나리오/공학 해석 검토 증빙.

- 특정 SHA/환경/데이터 조건에서 검증된 항목만 `VERIFIED (SIMULATION)`으로 승격한다.
- 실패, 미실행, 한계/오류 허용범위를 검증 항목과 함께 공개한다.
- 중앙 권한/로그·실 FAB 운영을 시뮬레이션 테스트의 결론으로 확대하지 않는다.

### Phase 3 — 채용용 세부 기술 스토리

**착수 조건:** 동작+검증 가능한 릴리스, 실제 다이어그램, 에셋·개발의사결정 로그.

- 30초/3분/5분/10분 발표 구성, 직무별(공정/장비/PI/제조 IT 등) 설명과 기술 면접 예상 질문을 준비한다.
- 소유자 기여와 AI 코드 작성 기여를 문서 링크로 정직하게 구분한다.
- 실제 기업 현장 적용·양산 성능·인증·파트너십은 별도의 적법한 증명 전 금지한다.

## 7. 역할별 입력·리뷰와 보류 조건

| 담당 | README 적용 전에 제출할 내용 | 보류 조건 |
| --- | --- | --- |
| **A01** | 도메인 검수된 카피, 영향 후보/경고 기준, 승인 PRD·ADR, README 수정 승인 | 인과·역할·아키텍처 단정 금지 |
| **A02** | 소스/fixture/실행 명령/SHA, 실제 스택·데이터 계약·배포 정보 | 무근거 구현/속도/안정성 주장 금지 |
| **A03** | 실제 디자인 시스템/시연 화면과 콘셉트의 명확한 분리, 접근성 | 미구현 화면을 완성 UI처럼 표기 금지 |
| **A04** | 코드 SHA 기준 독립 PASS/FAIL/NOT_RUN 결과·환경·로그/도메인 수치 확인 | QA 계획서만으로 성공 수치 주장 금지 |
| **프로젝트 소유자** | 공개 범위·제품 핵심 메시지·README PR 승인 | `main` 직접 변경/무승인 병합 금지 |

## 8. 추후 README PR 수용 체크리스트

- [ ] A01과 프로젝트 소유자가 README 수정 범위를 사전 승인.
- [ ] 각 현재형 기능·성능 문장에 [근거 매트릭스](./claims-evidence-matrix.md) ID 및 검증된 URL이 있음.
- [ ] 초기/합성/실 FAB 미연동, 가설/인과 불확실성 명시.
- [ ] README 데모 링크가 실제 동작 버전과 정확한 커밋을 가리킴.
- [ ] 원본·합성·공개 연구 데이터를 구분하며 단위·seed·라이선스 명시.
- [ ] `PROPOSED` ADR을 확정 아키텍처라고 표현하지 않음.
- [ ] 테스트 PASS·FAIL·NOT_RUN과 실행 환경·fixture/로그를 투명하게 공개.
- [ ] 소유자와 AI 에이전트의 의사결정/코드 기여가 과장 없이 기록됨.
- [ ] A01 리뷰 및 소유자 승인으로 별도 README PR 병합.

**Issue #5 종료 조건:** 본 계획과 나머지 2개 문서가 리뷰 PR에 제출되고 A01·소유자가 수용하여 병합/Issue 종료했을 때만 A05가 `DONE`이라고 보고한다. **이번 단계에서 README 자체는 변경하지 않는다.**

## 9. 근거 및 관련 문서

- [제품 포지셔닝](./product-positioning.md) · [주장·증거 매트릭스](./claims-evidence-matrix.md)
- [Issue #5](https://github.com/Junebooky/semi_fab/issues/5) · [현행 README@main](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md)
- [Issue #1](https://github.com/Junebooky/semi_fab/issues/1) · [Draft PR #2](https://github.com/Junebooky/semi_fab/pull/2) · [QA PR #3](https://github.com/Junebooky/semi_fab/pull/3) · [UX Issue #4](https://github.com/Junebooky/semi_fab/issues/4)

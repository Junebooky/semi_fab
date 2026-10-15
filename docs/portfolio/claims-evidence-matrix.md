# FAB ONE — 기술 주장 ↔ 근거 추적 매트릭스 (A05)

> **상태:** REVIEW · 2026-10-15 · 담당 A05 · [Issue #5](https://github.com/Junebooky/semi_fab/issues/5)  
> **Baseline:** `main` commit [`57b4dd4405fb01a2154c1ad19437c049c6aae38d`](https://github.com/Junebooky/semi_fab/commit/57b4dd4405fb01a2154c1ad19437c049c6aae38d) / 별도 **미병합** PR #2(설계), PR #3(QA 계획).  
> **현재 판정:** 앱 구현/실행·성능·실제 FAB 결과에 대한 검증 가능한 증거 **없음**. 이는 소스 검토 범위의 증거 부족 판정이지 미래 구현 불가능 판정이 아님.
> **외부 링크 확인 기준일:** 2026-10-15 (KST). SK하이닉스의 기존 인터뷰 `/9`는 이번 웹 조회에서 오류 페이지로 이동했으며, 내용을 확인한 공식 인터뷰 [`/53`](https://talent.skhynix.com/hub/en/job/interview/53)으로 교체했다. 공식 [직무 소개 `id=902`](https://talent.skhynix.com/hub/en/job/introduce?id=902)도 조회했다. 이 확인은 직무 참고 **링크와 출처 접근성** 점검이지 채용 성과·기술 기능 검증이 아니다.

## 1. 읽는 법과 주장 상태 규칙

- **기획:** PRD/Issue/README에 **목표·제안·예정**으로 기술되었지만 구현+동작 증거가 없다. 공개할 때 “목표로 한다/기획 중”으로만 말한다.
- **구현 중:** A02의 실제 코드·커밋과 구체적 동작 범위가 확인되지만 A04 수용 테스트가 아직 완료되지 않은 경우에만 사용한다. **현재 해당 항목 없음.**
- **검증됨:** 대상 **제품 동작**에 대해 특정 코드 SHA/환경/fixture/명령/실행 증거와 독립적 A04 결과가 있고 A01이 도메인 문구를 검토한 경우에만 사용한다. **현재 제품 동작에 해당 항목 없음.**
- **문서 존재 확인:** 브랜치·PR·Issue/README 등의 *존재*는 증거로 확인했지만 그 내용에 적힌 기능 자체를 검증한 것은 아니다. 아래 상태 필드에서는 `문서 확인(기능 미검증)`으로 별도 구분한다.
- **실제 환경 검증:** 검증됨(시뮬레이션)과 다른 수준이며 실 FAB 고객/운영 승인·평가 환경·측정 범위가 별도 확인되어야 한다. 현재 **0건**.
- **증거 없음:** 구현/승인/효과를 단정할 수 없다. 기능에 관해 입증할 수 없는 추측으로 ‘구현 중’이라고 쓰지 않는다.

### 증빙 등급 (기능 상태와 혼동 금지)

| 등급 | 의미 | 허용하는 표현 |
| --- | --- | --- |
| E0 | Issue, 브랜치 내 초안, README 등의 의도/요구사항 | “기획한다”, “제안한다” |
| E1 | A02 코드·시나리오 fixture·DB 계약·커밋(실행 증명 없이) | “코드가 제출되었다/검토 중” |
| E2 | 버전 고정 로컬/호스팅 실행·데모 캡처·반복 가능한 재현 가이드 | “해당 시나리오가 데모에서 작동한다” |
| E3 | A04 독립 실행 PASS, 로그/테스트 ID, A01 도메인 검수 | “특정 조건에서 검증했다” |
| E4 | 적법한 실제 FAB 승인·운영 데이터·현장 평가·평가 방법 | “명시된 실제 환경에서만 검증됐다” |

E0 문서가 여러 건 존재해도 E1~E4로 자동 승격하지 않는다. 계획 테스트는 PASS가 아니다.

## 2. 현 시점 '주장 ↔ 증거' 표

| ID | 주장 또는 공개 문구 후보 | 현 상태 · 최고 근거 | 직접 근거 | 아직 필요한 증거/검토 | 금지하거나 제한할 표현 |
| --- | --- | --- | --- | --- | --- |
| CL-01 | “FAB ONE은 반도체 엔지니어링 시뮬레이션을 기획 중인 프로젝트” | **문서 확인(기획 상태)** · E0 | [main README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md) | A01 최종 한 줄 메시지 승인 | “이미 양산에 쓰이는 플랫폼” |
| CL-02 | “Etch 장비 이상을 출발점으로 분석→Lot/Wafer 후보 조사→이력 정리를 기획” | **기획** · E0 | [main README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md), [Issue #5](https://github.com/Junebooky/semi_fab/issues/5) | A01 승인 시나리오, A02 런타임, A04 인과·lineage 테스트 | “원인 자동 규명/실제 불량 Lot 확정” |
| CL-03 | “실시간 Etch 센서 스트림 수집” | **기획 범위는 합성 스트림만**, 실제 실시간 연동 증거 없음 · E0 | [ADR 제안 PR #2](https://github.com/Junebooky/semi_fab/pull/2) | 시뮬레이터 데이터 계약·구현·테스트 | “실제 FAB에서 실시간 데이터 수집” |
| CL-04 | “SPC/FDC 이상 경고와 시계열 분석 기능” | **기획** · E0 | [README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md), [QA PR #3](https://github.com/Junebooky/semi_fab/pull/3) | 관리 한계/경고 규칙 버전, 단위·시간, QA P-17 PASS | “공정 이상 원인을 확정적으로 진단한다” |
| CL-05 | “Lot/Wafer 영향 범위 추적” | **기획** · E0 | [README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md) | 계보/챔버/시간 관계 스키마, 음성·양성 fixture, A04 시험 | “불량 웨이퍼를 100% 정확히 찾아낸다” |
| CL-06 | “Wafer Map·수율 시각화” | **기획 방향**, 실제 UI·계산·Map 증빙 없음 · E0 | [README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md) | wafer 좌표/eligible die 기준, 계산 함수, 스크린샷, QA | “실제 수율 개선/분석 정확도 향상” |
| CL-07 | “Cp/Cpk, Die Yield, Etch Rate 계산 제공” | **제안/테스트 명세** · E0 | [A04 PR #3](https://github.com/Junebooky/semi_fab/pull/3) 예시 입력·독립 기대값 | A01 분모·추정량·허용오차 승인, A02 함수, A04 P-18 PASS | “Cpk 엔진 검증 완료” |
| CL-08 | “Engineering Knowledge Layer(EKL)로 공학 설명 제공” | **기획** · E0 | [README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md), [A03 리뷰](https://github.com/Junebooky/semi_fab/pull/2#issuecomment-6183744614) | 검수된 개념/수식 출처, UI/코드, 접근성·정합성 테스트 | “전문가 수준 AI가 공정 결정을 대신한다” |
| CL-09 | “사건 조사/조치 이력 기록” | **기획** · E0 | [Issue #1](https://github.com/Junebooky/semi_fab/issues/1), [ADR PR #2](https://github.com/Junebooky/semi_fab/pull/2) | 저장 대상·권한·초기화/복구/동시성 규정 및 동작 | “규제 수준의 공식 감사·결재 체계 완비” |
| CL-10 | “SQLite 기반 로컬 시뮬레이터” | **아키텍처 제안(미승인)** · E0 | [Issue #1](https://github.com/Junebooky/semi_fab/issues/1), [Draft PR #2](https://github.com/Junebooky/semi_fab/pull/2) | owner·A01 승인, A02 코드/볼륨, A04 P-03~P-07 | “선정 완료/배포 완료” |
| CL-11 | “Mode A 웹 데모/Mode B FastAPI+SQLite/Mode C 다중 사용자” | **제안 모드 분리, 승인·구현 없음** · E0 | [Draft ADR PR #2](https://github.com/Junebooky/semi_fab/pull/2) | PRD 모드 결정, 별도 모드별 QA | “3가지 모드 모두 동작” |
| CL-12 | “Supabase 인증·중앙 DB·RLS 협업 지원” | **미승인 미래 범위** · E0 | [Issue #1](https://github.com/Junebooky/semi_fab/issues/1) | A01/owner 아키텍처 결정, A02 코드, A04 Mode C 보안 PASS | “실제 조직/기업 다중 사용자 권한 검증 완료” |
| CL-13 | “동일 seed로 시뮬레이션 재현” | **요구사항 제안**, 실행 결과 없음 · E0 | [Draft ADR PR #2](https://github.com/Junebooky/semi_fab/pull/2), [A04 PR #3](https://github.com/Junebooky/semi_fab/pull/3) | RNG·버전·시각·fixture hash 고정, A04 P-01/P-02 | “완벽한 재현성 입증” |
| CL-14 | “Toss-inspired 독자적 UX, 3D 클레이” | **디자인 방향** · E0 | [README](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md), [Issue #4](https://github.com/Junebooky/semi_fab/issues/4) | A03 독자 에셋/디자인 시스템, 실제 UI 구현·사용성 실험 | “토스와 제휴/공식 디자인 사용”, “사용성 향상 입증” |
| CL-15 | “20개 QA 시나리오를 명세했다” | **문서 확인(테스트 수행 아님)** · E0 | [A04 PR #3](https://github.com/Junebooky/semi_fab/pull/3), [파일](https://github.com/Junebooky/semi_fab/blob/a04/issue-1-storage-qa-plan/docs/qa/ADR-001-storage-verification-plan.md) | A01 수용 후 기준 확정; 앱이 생기면 실행 | “20개 테스트 PASS / 제품 QA 완료” |
| CL-16 | “A04가 요구사항·검증 공백 QA-F01~F06을 제기했다” | **문서 확인(리뷰 사실만)** · E0 | [PR #3](https://github.com/Junebooky/semi_fab/pull/3), [A04 리뷰 댓글](https://github.com/Junebooky/semi_fab/pull/2#issuecomment-6183753727) | A01·A02 수정·답변 기록 | “버그 6건 해결 / 품질 승인” |
| CL-17 | “AI 에이전트 역할을 분리해 GitHub 협업 계획을 수립했다” | **규칙 문서 제출 확인** · E0 | [AGENTS.md, PR #2](https://github.com/Junebooky/semi_fab/blob/docs/issue-1-local-first-governance/AGENTS.md), [Issue #5](https://github.com/Junebooky/semi_fab/issues/5) | 각 개인 기여의 Issue/PR/commit, 사용자 리뷰 결정 | “소유자가 코드를 100% 단독 작성했다” |
| CL-18 | “실제 생산 장비 제어, 실 FAB 연동, 수율·가동률 향상” | **증거 없음 / 현재 범위 밖** | [README 명시적 제한](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md) | 합법적인 현장 데이터·검증 계약·측정 방법 등 별도 필수 | 모든 “현장 적용”, “수율 X%↑”, “다운타임 Y%↓” 주장 |
| CL-19 | “삼성전자·SK하이닉스 기술/공정 직무와 연관된 학습 주제” | **직무 관련성 비교(취업 성과 아님)** · E0 | [SK하이닉스 양산기술 직무](https://talent.skhynix.com/hub/en/job/interview/53), [직무소개](https://talent.skhynix.com/hub/en/job/introduce?id=902) | 지원 시점 실제 공고와 A01 검수, 본인 기여 증빙 | “해당 회사 요구역량 완전 충족/채용 검증됨/공식 협업” |
| CL-20 | “README가 프로젝트를 기획·초기 구축이라 표시한다” | **문서 확인** · E0 | [README@main SHA](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md) | 이후 커밋 기준일 갱신 | “main README에 완제품 증거 있음” |

**정리:** CL-01·15·16·17·20의 **문서 존재**는 확인되지만 **제품 동작 검증됨(E3 이상) 항목은 0개**다. 수치 성능·실 FAB 적용·공식 제휴는 확인된 근거가 없다.

### 2026-10-15 보충: 신규 제출된 PR #10·#11 (승인/QA와 구분)

- [PR #10 — A02 Local-first 아키텍처·데이터/재현성 계약 문서](https://github.com/Junebooky/semi_fab/pull/10): **열린 미병합 PR에 설계 문서가 제출됨**을 확인했다. 아키텍처·수식 계약의 제안은 실제 제품 코드 실행, 구현 완료, QA PASS 또는 A01·소유자의 최종 승인과 **다르다**.
- [PR #11 — A03 화이트·에메랄드 hi-fi HTML 프로토타입](https://github.com/Junebooky/semi_fab/pull/11): **열린 미병합 PR에 편집 가능한 프로토타입 소스가 제출됨**을 확인했다. 이는 기획·시각 시안 수준의 결과물이며 제품 애플리케이션 동작, 실제 3D 자산 완성, A04 브라우저·접근성 검증 PASS가 **아니다**.
- **증거 갱신 원칙:** 이 매트릭스의 `main` SHA와 E0 상태는 위에 적힌 **검토 기준 스냅샷**이다. 새 PR 존재만으로 CL-04~CL-14를 ‘검증됨’으로 승격하지 않는다. A02 실제 기능 SHA·실행 가이드와 A04 독립 PASS·A01 도메인 검수가 확보되면 해당 CL 행과 README 상태를 함께 재검토한다. **현재 확인된 A04 제품 QA PASS는 0건**이다.

## 3. A04 QA 결과 표기 (계획과 실행 분리)

- [PR #3](https://github.com/Junebooky/semi_fab/pull/3)의 20개 `P-01 ~ P-20`은 **0 PASS / 0 FAIL / 0 BLOCKED / 20 NOT_RUN**으로 문서에 명시된 **계획 테스트**다. 실행 검사 결과라고 표현하지 않는다.
- `QA-F01~QA-F06`은 아키텍처 문서/요구사항의 **검토 공백**이며 실행 중 발견한 런타임 결함 6건이 아니다.
- 별도 테스트가 실제로 실행되면 `test ID | code SHA | 데이터 버전/seed/hash | 환경·실행법 | 기대/실제 | PASS/FAIL | 로그·화면·PR`을 기록한다.
- 테스트 결과가 `NOT_RUN`인 경우 README/채용 발표의 성능·정확성·신뢰도 주장 금지.

## 4. 데이터 출처·통계·안전성의 필수 표현

| 구분 | 시연 화면/README가 명시할 요소 | 검증 전 금지 |
| --- | --- | --- |
| **합성 데이터** | `SYNTHETIC / SIMULATION`, 시드·생성기 버전·시간·단위·설정 | 실측 공장 데이터로 표기 |
| **공개 연구 데이터** | 라이선스·발행자·출처 URL·원본/가공 범위·버전 | 검증 없는 실제 생산 대표성 주장 |
| **실제 기업 생산 데이터** | 현재 **사용하지 않음**. 적법한 승인이 선행돼야 함 | 비밀정보 커밋·승인 없는 공개 |
| **SPC** | 관리한계·규칙·측정 단위 및 `이상 조사 필요` 문구 | 관리한계=규격한계, 경고=원인 증명 |
| **수율/Map** | 검사·제외·양품 정의, 좌표/맵 규칙, 누락치 | 표본/가상 값을 실제 수율로 주장 |
| **Cp/Cpk** | LSL/USL, 표본·추정량·정규성/안정성 가정·소수점 | 지표 하나만으로 공정 합격 단정 |
| **이력/권한** | 단일 브라우저·로컬 상태는 그 한계를 표시 | 역할 선택기를 실제 RBAC·중앙 감사로 표기 |

## 5. 근거 승격 체크리스트 (각 주장 ID별로 수행)

1. A02가 **구체적인 커밋 SHA, 코드 경로, 재현 명령**을 제공하고 해당 기능이 실제 존재하는지 확인한다 → `구현 중` 후보.
2. **합성/공개/실제** 데이터 분류, fixture checksum·시드·시간·단위/원인 불확실성을 연결한다.
3. A04가 동일 SHA에서 테스트를 독립 실행하고 결과·환경·실패·증빙 링크를 남긴다 → `검증됨` 후보(E3).
4. A01이 공정·통계·Lot lineage의 도메인 주장을 검토하고 소유자가 핵심 제품 메시지 변경을 승인한다.
5. 외부 공개 README/영상/면접 주장과 매트릭스 문구를 **같은 버전**으로 동기화한다.
6. 실 FAB 주장은 별도 계약·현장 승인이 없으면 절대 승격하지 않는다.

## 6. 검토 대상과 열린 질문

- **A01:** 시나리오별 인과 표현, 직무 포지셔닝, “영향 후보”의 개념 정의; [Issue #1](https://github.com/Junebooky/semi_fab/issues/1) 아키텍처 승인 여부.
- **A02:** 앱 실행·테스트able SHA, 실제 구조·fixture·스키마·계산 단위 계약.
- **A03:** UI의 합성 라벨·추정 경고·출처 표시, 디자인 에셋 진위.
- **A04:** 20개 계획 테스트의 실행 결과, 특히 P-01/02/17/18과 데이터·권한 관련 검사.
- **소유자:** 최종 공개/제품 표현·README 변경 승인.

## 7. 감사 기준 링크

- [Issue #5 — A05 배정](https://github.com/Junebooky/semi_fab/issues/5)
- [README — `main` 첫 커밋](https://github.com/Junebooky/semi_fab/blob/57b4dd4405fb01a2154c1ad19437c049c6aae38d/README.md)
- [Issue #1 — 저장 전략 미확정](https://github.com/Junebooky/semi_fab/issues/1)
- [Draft PR #2 — 협업 규약·ADR-001 제안](https://github.com/Junebooky/semi_fab/pull/2)
- [PR #3 — A04 테스트 계획(실행 0건)](https://github.com/Junebooky/semi_fab/pull/3)
- [Issue #4 — A03 UX/브랜딩 작업](https://github.com/Junebooky/semi_fab/issues/4)

[제품 포지셔닝](./product-positioning.md) · [README 개선 계획](./readme-improvement-plan.md)

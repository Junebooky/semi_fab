/**
 * Issue #46 source-only UX regression checks.
 * Run: cd apps/web && node --test tests/ux-refresh-contract.test.mjs
 * Deliberately does not replace browser, domain or API integration tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = [
  ['Home', 'page.tsx', [
    '어디부터 시작하면 좋을까요?', '처음이라면, 여기서 시작해 보세요.',
    '3분 둘러보기', '이상 신호를 직접 조사해 볼까요?',
    '데이터로 조사 시작하기', '지금 확인할 이상 신호',
    '센서 값이 어떻게 달라졌을까요?', '이 신호와 연결된 근거 살펴보기',
    '웨이퍼 25장의 상태', '브라우저 예시 데이터 · Mode A'
  ], ['hero-guided-tour-card','hero-live-connected-card','btn-start-guided-tour','btn-start-live-connected-case']],
  ['Command Center', 'command-center/page.tsx', [
    '확인할 알람을 골라 주세요', '지금 확인할 이상 신호가 있어요',
    '어떤 설비에서 신호가 달라졌는지 확인해요', '센서 근거 살펴보기',
    '살펴보는 설비', '전체 알람', '위험 · CRITICAL', '주의 · WARNING',
    '정보 · INFO', '알람 다시 확인하기'
  ], ['cc-run-id-badge','cc-btn-go-workspace','cc-btn-go-equipment']],
  ['Equipment', 'equipment-intelligence/page.tsx', [
    '센서 값이 어디서 달라졌을까요?', '광학 신호·챔버 압력·RF 전력을 비교해 보세요',
    '관련 웨이퍼 확인하기', '데이터를 해석할 때 기억해 주세요',
    '센서 데이터를 가져오지 못했어요', '알람 화면으로 돌아가기',
    '시간을 선택해 변화를 살펴보세요', '중간에 수집되지 않은 값이 있어요',
    '전 구간 수집된 값이에요', '시간별 센서 원본값'
  ], ['ei-run-id-badge','ei-btn-go-investigation','ei-btn-go-workspace']],
  ['Traceability', 'traceability/page.tsx', [
    '추가 확인이 필요한 웨이퍼', '25개 슬롯에서 웨이퍼를 고르면',
    '조사 노트로 이어가기', '웨이퍼 25장을 살펴봐요',
    '추가 확인 (', '공정 이력 확인 (', '노출 이력 없음 (',
    '현재 이력:', '웨이퍼 목록을 다시 확인해야 해요', '영향 가능'
  ], ['trace-btn-go-workspace']],
  ['Workspace', 'engineering-workspace/page.tsx', [
    '이번 조사 살펴보기', '이상 신호의 원인을 차근차근 살펴봐요',
    '먼저 센서 근거를 확인하고', '1. 근거 확인', '2. 가설 검토',
    '3. 다음 조치', '4. 저장·내려받기', '5. 이전 조사 보기',
    '이번 조사 저장하기', '이전 조사 보기'
  ], ['ws-investigation-board','ws-tab-casebook','ws-btn-save-casebook','ws-casebook-records-list','ws-unsupported-lock-panel']],
  ['Simulation', 'fab-simulation/page.tsx', [
    '웨이퍼가 공정을 지나는 과정을 따라가 볼까요?',
    '첫 단계부터 마지막 T7까지 하나씩 넘겨 보세요',
    '공정 단계 살펴보기', '지금 살펴볼 공정',
    '웨이퍼 이동과 식각, T7의 이상 신호까지',
    '연습용 시뮬레이션 · Mode A', '다른 연습 데이터로 바꾸기',
    '잠시 멈추기', '자동으로 다음 단계 보기',
    '이상 신호 감지 · 추가 확인 필요'
  ], ['sim-step-badge','sim-step-heading','sim-btn-prev','sim-btn-next','sim-telemetry-oes']],
  ['Tour', 'demo-tour/page.tsx', [
    '8단계로 FAB ONE을 익혀 볼까요?',
    '가상 공정에서 시작해 알람·센서·웨이퍼·조사 노트까지',
    '단계 조작으로 이동', '함께 둘러보며 익혀 봐요',
    '약 3분 · 단계별 안내', '단계 ·',
    '연습용 안내 · Mode A', '새 연습 데이터 만들기',
    '이전으로', '다음으로'
  ], ['tour-btn-prev','tour-btn-next','tour-btn-reset','tour-progress-bar']]
];
const app = (path) => readFileSync(new URL('../src/app/' + path, import.meta.url), 'utf8');
const shared = readFileSync(new URL('../src/components/ux/FriendlyPageIntro.tsx', import.meta.url), 'utf8');
const css = app('globals.css');
const guide = readFileSync(new URL('../../../docs/design/fab-one-ux-writing-and-journey-v2.md', import.meta.url), 'utf8');

test('All 7 Next.js routes mount their shared human-first introduction', () => {
  assert.equal(routes.length, 7);
  for (const [name, path] of routes) {
    const source = app(path);
    assert.ok(source.includes("import { FriendlyPageIntro } from '@/components/ux/FriendlyPageIntro';"), name + ' imports shared intro');
    assert.ok(source.includes('<FriendlyPageIntro'), name + ' mounts intro');
    assert.ok(source.includes('buildCrossNavUrl'), name + ' preserves query-based navigation');
    assert.ok(source.includes('처음 둘러보기'), name + ' exposes tour navigation');
  }
  assert.match(shared, /연습용 합성 데이터 · 실제 FAB 연결 아님/);
  assert.match(shared, /<details className="ux-intro__details">/);
  assert.match(shared, /Link className="ux-btn ux-btn--primary"/);
});

test('At least 70 actually rendered Korean UX strings and key Playwright IDs stay present', () => {
  let total=0;
  for (const [name,path,copies,ids] of routes) {
    const source=app(path);
    assert.ok(copies.length>=10,name + ' must have >=10 user-facing strings');
    for (const text of copies) {
      assert.ok(source.includes(text),name + ' missing copy ' + text);
      total++;
    }
    for(const id of ids) assert.ok(source.includes('id="' + id + '"'),name + ' missing selector #' + id);
  }
  assert.ok(total>=70);
  assert.match(guide,/Before → After 카피 84개/);
});

test('Design does not erase provenance, critical state or route URLs', () => {
  assert.match(css,/--ux-surface: #FFFFFF/);
  assert.match(css,/--ux-emerald: #0B795F/);
  assert.match(css,/@media \(max-width: 480px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(shared,/Mode B/);
  const home=app('page.tsx');
  assert.ok(home.includes('generateModeAFixture('));
  assert.ok(home.includes('fetch("http://localhost:8000/api/v1/demo/'));
  const cc=app('command-center/page.tsx');
  assert.ok(cc.includes('isInvestigationSupported'));
  const ei=app('equipment-intelligence/page.tsx');
  assert.ok(ei.includes('calculateDynamicSegments'));
  const trace=app('traceability/page.tsx');
  assert.ok(trace.includes('data_origin') && trace.includes('run_id'));
  const ws=app('engineering-workspace/page.tsx');
  assert.ok(ws.includes('saveCasebookRecordToStorage') && ws.includes('validateAndImportCasebookRecords'));
  const sim=app('fab-simulation/page.tsx');
  assert.ok(sim.includes('getTelemetrySnapshotForStep') && sim.includes('SIMULATION_STEPS'));
  const tour=app('demo-tour/page.tsx');
  assert.ok(tour.includes('TOUR_STEPS') && tour.includes('tour-btn-next'));
});

test('No screen silently hides the separate synthetic caution or retrofits real-FAB claims',()=>{
  assert.ok(css.includes('.ux-intro__provenance'));
  for (const [,path] of routes) {
    const source=app(path);
    assert.ok(source.includes('FriendlyPageIntro'));
    assert.ok(!source.includes('실제 FAB 데이터 수집 중'));
  }
});

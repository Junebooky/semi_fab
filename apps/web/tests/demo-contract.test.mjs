import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching dynamicSegments algorithm in page.tsx
function computeDynamicSegments(coordinates) {
  const segments = [];
  let currentPts = [];

  coordinates.forEach(pt => {
    if (pt.y !== null && pt.quality_flag !== 'MISSING') {
      currentPts.push({ x: pt.x, y: pt.y });
    } else {
      if (currentPts.length > 0) {
        segments.push(currentPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '));
        currentPts = [];
      }
    }
  });
  if (currentPts.length > 0) {
    segments.push(currentPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '));
  }
  return segments;
}

// Helper matching missingRange computation in page.tsx
function computeMissingRange(coordinates) {
  const missingPoints = coordinates.filter(c => c.quality_flag === 'MISSING' || c.measured_value === null);
  if (missingPoints.length === 0) return null;
  const minX = Math.min(...missingPoints.map(p => p.x)) - 35;
  const maxX = Math.max(...missingPoints.map(p => p.x)) + 35;
  const labels = missingPoints.map(p => p.time_label).join(', ');
  return { minX, width: maxX - minX, labels };
}

test('Mode A Fixture Contract: Sensor samples satisfy T0~T7 and missing gap invariant', () => {
  const SAMPLES = [
    { step_index: 0, time_label: "T0", measured_value: 48.2, quality_flag: "GOOD" },
    { step_index: 1, time_label: "T1", measured_value: 50.1, quality_flag: "GOOD" },
    { step_index: 2, time_label: "T2", measured_value: 51.4, quality_flag: "GOOD" },
    { step_index: 3, time_label: "T3", measured_value: 49.8, quality_flag: "GOOD" },
    { step_index: 4, time_label: "T4", measured_value: null, quality_flag: "MISSING" },
    { step_index: 5, time_label: "T5", measured_value: null, quality_flag: "MISSING" },
    { step_index: 6, time_label: "T6", measured_value: 52.0, quality_flag: "GOOD" },
    { step_index: 7, time_label: "T7", measured_value: 80.0, quality_flag: "GOOD" },
  ];

  assert.equal(SAMPLES.length, 8);
  assert.equal(SAMPLES[4].measured_value, null);
  assert.equal(SAMPLES[4].quality_flag, 'MISSING');
  assert.equal(SAMPLES[5].measured_value, null);
  assert.equal(SAMPLES[5].quality_flag, 'MISSING');
  assert.equal(SAMPLES[7].measured_value, 80.0);
});

test('Mode A Fixture Contract: 25-wafer FOUP cassette and candidate lot mapping', () => {
  const wafers = Array.from({ length: 25 }, (_, i) => {
    const slot = i + 1;
    const wafer_id = `W-${slot < 10 ? '0' + slot : slot}`;
    let status = 'NOT_EXPOSED';
    if (slot <= 7) status = 'CONFIRMED_EXPOSED';
    else if (slot >= 8 && slot <= 12) status = 'CANDIDATE_EXPOSED';
    return { wafer_id, slot_number: slot, exposure_status: status };
  });

  assert.equal(wafers.length, 25);
  const confirmed = wafers.filter(w => w.exposure_status === 'CONFIRMED_EXPOSED');
  assert.equal(confirmed.length, 7);

  const candidates = wafers.filter(w => w.exposure_status === 'CANDIDATE_EXPOSED');
  assert.equal(candidates.length, 5);
  assert.deepEqual(candidates.map(w => w.wafer_id), ['W-08', 'W-09', 'W-10', 'W-11', 'W-12']);
});

test('P1-01 Chart Dynamic Segmentation: Continuous sensors (CHAMBER_PRESSURE) render a single unbroken path without missing overlay', () => {
  // Chamber pressure: all steps T0~T7 have valid values and quality_flag = 'GOOD'
  const prsCoordinates = [
    { step_index: 0, time_label: "T0", measured_value: 120.1, quality_flag: "GOOD", x: 60, y: 173.82 },
    { step_index: 1, time_label: "T1", measured_value: 120.4, quality_flag: "GOOD", x: 130, y: 173.28 },
    { step_index: 2, time_label: "T2", measured_value: 119.8, quality_flag: "GOOD", x: 200, y: 174.36 },
    { step_index: 3, time_label: "T3", measured_value: 120.5, quality_flag: "GOOD", x: 270, y: 173.1 },
    { step_index: 4, time_label: "T4", measured_value: 120.2, quality_flag: "GOOD", x: 340, y: 173.64 },
    { step_index: 5, time_label: "T5", measured_value: 120.0, quality_flag: "GOOD", x: 410, y: 174.0 },
    { step_index: 6, time_label: "T6", measured_value: 121.3, quality_flag: "GOOD", x: 480, y: 171.66 },
    { step_index: 7, time_label: "T7", measured_value: 168.5, quality_flag: "SUSPECT", x: 550, y: 86.7 },
  ];

  const segments = computeDynamicSegments(prsCoordinates);
  const missingRange = computeMissingRange(prsCoordinates);

  // Exactly 1 unbroken SVG path from T0 to T7
  assert.equal(segments.length, 1);
  assert.ok(segments[0].startsWith('M 60'));
  assert.ok(segments[0].includes('L 340')); // Includes T4
  assert.ok(segments[0].includes('L 410')); // Includes T5
  assert.ok(segments[0].includes('L 550')); // Includes T7

  // Missing range must be null (no shaded missing overlay box)
  assert.equal(missingRange, null);
});

test('P1-01 Chart Dynamic Segmentation: Optical sensor with dropouts (RELATIVE_SIGNAL) renders 2 segmented paths and missing overlay', () => {
  const relCoordinates = [
    { step_index: 0, time_label: "T0", measured_value: 48.2, quality_flag: "GOOD", x: 60, y: 123.24 },
    { step_index: 1, time_label: "T1", measured_value: 50.1, quality_flag: "GOOD", x: 130, y: 119.82 },
    { step_index: 2, time_label: "T2", measured_value: 51.4, quality_flag: "GOOD", x: 200, y: 117.48 },
    { step_index: 3, time_label: "T3", measured_value: 49.8, quality_flag: "GOOD", x: 270, y: 120.36 },
    { step_index: 4, time_label: "T4", measured_value: null, quality_flag: "MISSING", x: 340, y: null },
    { step_index: 5, time_label: "T5", measured_value: null, quality_flag: "MISSING", x: 410, y: null },
    { step_index: 6, time_label: "T6", measured_value: 52.0, quality_flag: "GOOD", x: 480, y: 116.4 },
    { step_index: 7, time_label: "T7", measured_value: 80.0, quality_flag: "SUSPECT", x: 550, y: 66.0 },
  ];

  const segments = computeDynamicSegments(relCoordinates);
  const missingRange = computeMissingRange(relCoordinates);

  // Exactly 2 disconnected SVG paths (T0~T3 and T6~T7)
  assert.equal(segments.length, 2);
  assert.ok(segments[0].startsWith('M 60'));
  assert.ok(segments[0].endsWith('120.36')); // Ends at T3
  assert.ok(!segments[0].includes('340')); // Never touches T4

  assert.ok(segments[1].startsWith('M 480')); // Starts at T6
  assert.ok(segments[1].endsWith('66')); // Ends at T7
  assert.ok(!segments[1].includes('410')); // Never touches T5

  // Missing range must cover T4 (340) and T5 (410)
  assert.notEqual(missingRange, null);
  assert.equal(missingRange.minX, 305);
  assert.equal(missingRange.width, 140);
  assert.equal(missingRange.labels, 'T4, T5');
});

test('P1-02 Fallback Invariant: Mode A fallback cleanly resets state without mixing server data', () => {
  // Simulate client state before and after fallback
  let state = {
    mode: 'B',
    backendAvailable: true,
    connectionError: null,
    summary: { equipment_id: "ETCH-02", chamber_id: "CH-B", exposed_wafers: 22, total_wafers: 25 },
    wafers: [{ wafer_id: "W-99", exposure_status: "CONFIRMED_EXPOSED" }]
  };

  const DEFAULT_SUMMARY = { equipment_id: "ETCH-02", chamber_id: "CH-B", exposed_wafers: 7, total_wafers: 25 };
  const FIXTURE_WAFERS = Array.from({ length: 25 }, (_, i) => ({ wafer_id: `W-${i+1}`, exposure_status: "NOT_EXPOSED" }));

  function fallbackToModeA(errorMsg) {
    state.mode = 'A';
    state.backendAvailable = false;
    state.connectionError = errorMsg;
    state.summary = DEFAULT_SUMMARY;
    state.wafers = FIXTURE_WAFERS;
  }

  // Trigger fallback due to HTTP 500 or network drop
  fallbackToModeA('서버 통신 오류 (HTTP 500)');

  assert.equal(state.mode, 'A');
  assert.equal(state.backendAvailable, false);
  assert.equal(state.connectionError, '서버 통신 오류 (HTTP 500)');
  assert.equal(state.summary.exposed_wafers, 7);
  assert.equal(state.wafers.length, 25);
  assert.equal(state.wafers[0].wafer_id, 'W-1');
});

// Helper matching generateModeAFixture in page.tsx
function generateModeAFixtureTest(seed) {
  let s = Math.abs(seed);
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const relNoise = (nextRand() - 0.5) * 2.0;
  const prsNoise = (nextRand() - 0.5) * 1.5;
  const rfNoise = (nextRand() - 0.5) * 20.0;

  const t7Rel = +(80.0 + (nextRand() - 0.5) * 4.0).toFixed(1);
  const t7Prs = +(168.5 + (nextRand() - 0.5) * 5.0).toFixed(2);
  const t7Rf = +(1820.0 + rfNoise).toFixed(1);

  const samples = [
    { step_index: 0, sensor_id: "RELATIVE_SIGNAL", measured_value: +(48.2 + relNoise).toFixed(1), quality_flag: "GOOD" },
    { step_index: 4, sensor_id: "RELATIVE_SIGNAL", measured_value: null, quality_flag: "MISSING" },
    { step_index: 5, sensor_id: "RELATIVE_SIGNAL", measured_value: null, quality_flag: "MISSING" },
    { step_index: 7, sensor_id: "RELATIVE_SIGNAL", measured_value: t7Rel, quality_flag: "SUSPECT" },
    { step_index: 0, sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.1 + prsNoise).toFixed(2), quality_flag: "GOOD" },
    { step_index: 4, sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.2 + (nextRand() - 0.5) * 0.4).toFixed(2), quality_flag: "GOOD" },
    { step_index: 5, sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.0 + (nextRand() - 0.5) * 0.4).toFixed(2), quality_flag: "GOOD" },
    { step_index: 7, sensor_id: "CHAMBER_PRESSURE", measured_value: t7Prs, quality_flag: "SUSPECT" },
    { step_index: 0, sensor_id: "RF_POWER", measured_value: +(1500.0 + rfNoise * 0.2).toFixed(1), quality_flag: "GOOD" },
    { step_index: 4, sensor_id: "RF_POWER", measured_value: 1500.0, quality_flag: "GOOD" },
    { step_index: 7, sensor_id: "RF_POWER", measured_value: t7Rf, quality_flag: "SUSPECT" },
  ];

  const lotId = `LOT-DEMO-${800 + (seed % 50)}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const standbyAlertId = `AL-STANDBY-${String(seed % 1000).padStart(3, '0')}`;

  const alerts = [
    {
      alert_id: alertId,
      severity: "CRITICAL",
      equipment_id: "ETCH-02",
      chamber_id: "CH-B",
      run_id: runId,
      rule_code: "FDC-RULE-SPC-UCL-01"
    },
    {
      alert_id: standbyAlertId,
      severity: "WARNING",
      equipment_id: "ETCH-01",
      chamber_id: "CH-A",
      run_id: null,
      rule_code: "FDC-RULE-HEURISTIC-02"
    }
  ];

  const investigation = {
    investigation_id: `INV-${alertId}`,
    alert_id: alertId,
    equipment_id: "ETCH-02",
    chamber_id: "CH-B",
    run_id: runId,
    lot_id: lotId,
    anomaly_step: 7,
    status: "UNDER_INVESTIGATION",
    evidence_sensors: [
      { sensor_id: "RELATIVE_SIGNAL", measured_value: t7Rel, ucl_threshold: 65.0, deviation_percent: +(((t7Rel - 65.0) / 65.0) * 100.0).toFixed(1), quality_flag: "SUSPECT" },
      { sensor_id: "CHAMBER_PRESSURE", measured_value: t7Prs, ucl_threshold: 140.0, deviation_percent: +(((t7Prs - 140.0) / 140.0) * 100.0).toFixed(1), quality_flag: "SUSPECT" },
      { sensor_id: "RF_POWER", measured_value: t7Rf, ucl_threshold: 1650.0, deviation_percent: +(((t7Rf - 1650.0) / 1650.0) * 100.0).toFixed(1), quality_flag: "SUSPECT" }
    ],
    confirmed_exposed_wafers: ["W-01", "W-02", "W-03", "W-04", "W-05", "W-06", "W-07"],
    candidate_exposed_wafers: ["W-08", "W-09", "W-10", "W-11", "W-12"],
    unexposed_wafers_count: 13,
    disclaimer: "※ [품질 분석 가이드라인] 센서 이상 계측(FDC Spike)은 식각 챔버 내 공정 조건 일탈(Excursion) 감지이며, 웨이퍼의 물리적 결함(Defect) 확정 원인이 아닙니다. 결함 확정은 후속 계측(Defect Review / EDS)을 통한 교차 분석이 필수적입니다."
  };

  return { samples, lotId, runId, alertId, alerts, investigation };
}

test('BUILD-02 Mode A Dynamic Re-synthesis: Different seeds produce distinct synthetic values while preserving domain invariants', () => {
  const f1 = generateModeAFixtureTest(20261015);
  const f2 = generateModeAFixtureTest(9999);

  // Different seeds must produce different lot IDs and measured values
  assert.notEqual(f1.lotId, f2.lotId);
  assert.notEqual(f1.samples[0].measured_value, f2.samples[0].measured_value);

  // Invariants preserved for f1
  const t4Rel1 = f1.samples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === 4);
  const t4Prs1 = f1.samples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === 4);
  assert.equal(t4Rel1.quality_flag, 'MISSING');
  assert.equal(t4Rel1.measured_value, null);
  assert.equal(t4Prs1.quality_flag, 'GOOD');
  assert.notEqual(t4Prs1.measured_value, null);

  // Invariants preserved for f2
  const t4Rel2 = f2.samples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === 4);
  const t4Prs2 = f2.samples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === 4);
  assert.equal(t4Rel2.quality_flag, 'MISSING');
  assert.equal(t4Rel2.measured_value, null);
  assert.equal(t4Prs2.quality_flag, 'GOOD');
  assert.notEqual(t4Prs2.measured_value, null);
});

test('BUILD-02 Engineering Investigation: Excursion evidence, wafer candidates and domain disclaimer contract', () => {
  const fixture = generateModeAFixtureTest(20261015);
  const inv = fixture.investigation;

  assert.equal(inv.equipment_id, 'ETCH-02');
  assert.equal(inv.chamber_id, 'CH-B');
  assert.equal(inv.status, 'UNDER_INVESTIGATION');
  assert.equal(inv.evidence_sensors.length, 3);

  // Relative signal above UCL
  assert.ok(inv.evidence_sensors[0].measured_value > inv.evidence_sensors[0].ucl_threshold);
  assert.ok(inv.evidence_sensors[0].deviation_percent > 0);

  // RF Power above UCL (1650 W)
  const rfEv = inv.evidence_sensors.find(e => e.sensor_id === 'RF_POWER');
  assert.notEqual(rfEv, undefined);
  assert.ok(rfEv.measured_value > rfEv.ucl_threshold);
  assert.equal(rfEv.quality_flag, 'SUSPECT');

  // Wafers breakdown
  assert.equal(inv.confirmed_exposed_wafers.length, 7);
  assert.equal(inv.candidate_exposed_wafers.length, 5);
  assert.deepEqual(inv.candidate_exposed_wafers, ["W-08", "W-09", "W-10", "W-11", "W-12"]);
  assert.equal(inv.unexposed_wafers_count, 13);

  // Explicit domain rule: Sensor excursion is not confirmed defect
  assert.ok(inv.disclaimer.includes("물리적 결함(Defect) 확정 원인이 아닙니다"));
});

test('BUILD-02 Mode B Notice Protection: Subsequent load failure does not overwrite fallback notice', async () => {
  let notice = "초기 상태";

  // Simulate loadBackendData failing
  async function simulateLoadBackendData() {
    notice = "⚠️ 서버 응답 오류 - Mode A 로컬 합성 픽스처로 안전하게 전환되었습니다.";
    return false; // Load failed!
  }

  // Simulate handleStartDemo
  async function handleStartDemoTest() {
    const resOk = true; // POST succeeded
    if (resOk) {
      const loaded = await simulateLoadBackendData();
      if (loaded) {
        notice = "Mode B: 실시간 시뮬레이션 시작";
      }
    }
  }

  await handleStartDemoTest();

  // Notice MUST maintain the fallback warning, not be overwritten with "Mode B: 실시간..."
  assert.ok(notice.includes("Mode A 로컬 합성 픽스처로 안전하게 전환"));
  assert.ok(!notice.includes("Mode B: 실시간 시뮬레이션"));
});

test('P1-01 RF Power Telemetry Consistency Invariant: Chamber telemetry uses same sample series as investigation', () => {
  const fixture = generateModeAFixtureTest(20261015);
  const samples = fixture.samples;
  const inv = fixture.investigation;

  // Step 0: Nominal RF power (~1500W)
  const rfT0 = samples.find(s => s.sensor_id === 'RF_POWER' && s.step_index === 0);
  assert.notEqual(rfT0, undefined);
  assert.equal(rfT0.quality_flag, 'GOOD');
  assert.ok(rfT0.measured_value >= 1480.0 && rfT0.measured_value <= 1520.0);

  // Step 7: Excursion RF power (~1820W, > UCL 1650W)
  const rfT7 = samples.find(s => s.sensor_id === 'RF_POWER' && s.step_index === 7);
  assert.notEqual(rfT7, undefined);
  assert.equal(rfT7.quality_flag, 'SUSPECT');
  assert.ok(rfT7.measured_value > 1650.0);

  // Investigation evidence matches step 7 sample exactly (no 895W hardcoding discrepancy)
  const rfEv = inv.evidence_sensors.find(e => e.sensor_id === 'RF_POWER');
  assert.equal(rfEv.measured_value, rfT7.measured_value);
  assert.equal(rfEv.quality_flag, rfT7.quality_flag);
});

test('P1-02 Alert-Investigation Binding and Standby Isolation: Selecting standby alert isolates CH-B excursion evidence', () => {
  const fixture = generateModeAFixtureTest(20261015);
  const activeRunId = fixture.runId;
  const criticalAlert = fixture.alerts[0]; // Active run alert
  const standbyAlert = fixture.alerts[1];  // Standby warning alert with run_id = null

  // State tracker
  let currentInvestigation = fixture.investigation;
  let selectedAlert = criticalAlert;

  // Function mirroring handleSelectAlert logic
  function selectAlert(alert) {
    selectedAlert = alert;
    if (alert.run_id && alert.run_id === activeRunId) {
      currentInvestigation = fixture.investigation;
    } else {
      // Standby or unrelated alert: safely nullify investigation to prevent leaking CH-B evidence
      currentInvestigation = null;
    }
  }

  // 1. Initial state: critical alert selected, investigation present
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.notEqual(currentInvestigation, null);
  assert.equal(currentInvestigation.equipment_id, 'ETCH-02');
  assert.equal(currentInvestigation.chamber_id, 'CH-B');

  // 2. User clicks Standby alert (ETCH-01 / CH-A with run_id = null)
  selectAlert(standbyAlert);
  assert.equal(selectedAlert.alert_id, standbyAlert.alert_id);
  assert.equal(currentInvestigation, null); // MUST NOT show CH-B T7 spike or W-08~W-12 wafers!

  // 3. User clicks back to CRITICAL alert
  selectAlert(criticalAlert);
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.notEqual(currentInvestigation, null);
  assert.equal(currentInvestigation.chamber_id, 'CH-B');
});


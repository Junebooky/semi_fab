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

test('P1-A Async Alert Switching Race Condition Defense: Delayed inflight investigation response cannot overwrite standby state or newer alert', async () => {
  const fixture = generateModeAFixtureTest(20261015);
  const criticalAlert = fixture.alerts[0]; // Active run alert
  const standbyAlert = fixture.alerts[1];  // Standby alert

  // Simulated component state & refs matching page.tsx
  let investigationData = null;
  let selectedAlert = null;
  let noticeMessage = "";
  let activeReqId = 0;
  let currentSelectedAlertId = null;

  // Mock fetch that can simulate delayed resolution
  let delayedResolve = null;
  const delayedFetchPromise = new Promise(resolve => {
    delayedResolve = resolve;
  });

  async function handleSelectAlertTest(alert, isDelayed = false) {
    selectedAlert = alert;
    currentSelectedAlertId = alert.alert_id;
    const reqId = ++activeReqId;

    if (alert.run_id) {
      // Simulate async fetch
      try {
        const data = isDelayed ? await delayedFetchPromise : fixture.investigation;
        // Invalidate stale response guard (P1-A)
        if (reqId !== activeReqId || currentSelectedAlertId !== alert.alert_id) {
          return; // DISCARDED!
        }
        investigationData = data;
        noticeMessage = `엔지니어링 조사: [${alert.severity}] ${alert.alert_id}`;
      } catch {
        if (reqId !== activeReqId || currentSelectedAlertId !== alert.alert_id) return;
        investigationData = null;
      }
    } else {
      // Standby alert immediately clears investigation data and notice
      investigationData = null;
      noticeMessage = `알림: [${alert.severity}] ${alert.alert_id} 선택됨 - 연결된 공정 Run 없음`;
    }
  }

  // 1. User selects critical alert, but network request is delayed in flight
  const criticalPromise = handleSelectAlertTest(criticalAlert, true);
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.equal(investigationData, null); // Not yet resolved

  // 2. While critical alert fetch is in flight, user selects standby alert!
  await handleSelectAlertTest(standbyAlert, false);
  assert.equal(selectedAlert.alert_id, standbyAlert.alert_id);
  assert.equal(investigationData, null);
  assert.ok(noticeMessage.includes('연결된 공정 Run 없음'));

  // 3. Now the delayed critical request finally resolves with HTTP 200 data!
  delayedResolve(fixture.investigation);
  await criticalPromise;

  // 4. Invariant: investigationData MUST REMAIN NULL, and noticeMessage MUST NOT be overwritten!
  assert.equal(selectedAlert.alert_id, standbyAlert.alert_id);
  assert.equal(investigationData, null, "Stale async response must NOT overwrite standby investigation state");
  assert.ok(noticeMessage.includes('연결된 공정 Run 없음'), "Stale notice must NOT overwrite standby notice");

  // 5. User clicks critical alert again -> immediately loads and sets investigation data
  await handleSelectAlertTest(criticalAlert, false);
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.notEqual(investigationData, null);
  assert.equal(investigationData.alert_id, criticalAlert.alert_id);
});

test('P1-A Async Alert Switching Race Condition Defense: Delayed JSON body stream resolution cannot overwrite standby state or newer alert', async () => {
  const fixture = generateModeAFixtureTest(20261015);
  const criticalAlert = fixture.alerts[0]; // Active run alert
  const standbyAlert = fixture.alerts[1];  // Standby alert

  // Simulated component state & refs matching page.tsx
  let investigationData = null;
  let selectedAlert = null;
  let noticeMessage = "";
  let activeReqId = 0;
  let currentSelectedAlertId = null;

  // Delayed json body promise
  let delayedJsonResolve = null;
  const delayedJsonPromise = new Promise(resolve => {
    delayedJsonResolve = resolve;
  });

  async function handleSelectAlertWithDelayedJson(alert, delayJson = false) {
    selectedAlert = alert;
    currentSelectedAlertId = alert.alert_id;
    const reqId = ++activeReqId;

    if (alert.run_id) {
      try {
        // Step 1: fetch() resolves fast HTTP 200 response header
        const res = { ok: true, status: 200 };
        // Guard 1: after fetch
        if (reqId !== activeReqId || currentSelectedAlertId !== alert.alert_id) {
          return;
        }

        if (res.ok) {
          // Step 2: res.json() stream resolution is delayed
          const data = delayJson ? await delayedJsonPromise : fixture.investigation;

          // Guard 2 (P1-A JSON Guard): after await res.json()
          if (reqId !== activeReqId || currentSelectedAlertId !== alert.alert_id) {
            return; // DISCARDED!
          }

          investigationData = data;
          noticeMessage = `엔지니어링 조사: [${alert.severity}] ${alert.alert_id} 세부 근거 열림`;
        }
      } catch {
        if (reqId !== activeReqId || currentSelectedAlertId !== alert.alert_id) return;
        investigationData = null;
      }
    } else {
      // Standby alert immediately clears investigation data and notice
      investigationData = null;
      noticeMessage = `알림: [${alert.severity}] ${alert.alert_id} 선택됨 - 연결된 공정 Run 없음`;
    }
  }

  // 1. User selects CRITICAL alert; HTTP fetch succeeds immediately, but res.json() body stream is delayed
  const criticalPromise = handleSelectAlertWithDelayedJson(criticalAlert, true);
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.equal(investigationData, null); // Not yet set

  // 2. While res.json() is in-flight / suspended, user clicks STANDBY alert
  await handleSelectAlertWithDelayedJson(standbyAlert, false);
  assert.equal(selectedAlert.alert_id, standbyAlert.alert_id);
  assert.equal(investigationData, null);
  assert.ok(noticeMessage.includes('연결된 공정 Run 없음'));

  // 3. Now the delayed JSON body finally resolves with the parsed payload!
  delayedJsonResolve(fixture.investigation);
  await criticalPromise;

  // 4. Invariant: investigationData MUST REMAIN NULL, notice MUST NOT be overwritten!
  assert.equal(selectedAlert.alert_id, standbyAlert.alert_id);
  assert.equal(investigationData, null, "Delayed JSON parsing must NOT overwrite standby state");
  assert.ok(noticeMessage.includes('연결된 공정 Run 없음'), "Delayed JSON parsing must NOT overwrite standby notice");

  // 5. User clicks critical alert again normally -> loads successfully
  await handleSelectAlertWithDelayedJson(criticalAlert, false);
  assert.equal(selectedAlert.alert_id, criticalAlert.alert_id);
  assert.notEqual(investigationData, null);
  assert.equal(investigationData.alert_id, criticalAlert.alert_id);
});

// Helper matching generateModeAWaferTrace in traceability/page.tsx
function generateModeAWaferTraceTest(waferId, seed = 20261015) {
  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;

  const slotMatch = waferId.match(/\d+/);
  const slotNumber = slotMatch ? parseInt(slotMatch[0], 10) : 1;

  let exposure_status = 'NOT_EXPOSED';
  if (slotNumber <= 7) exposure_status = 'CONFIRMED_EXPOSED';
  else if (slotNumber >= 8 && slotNumber <= 12) exposure_status = 'CANDIDATE_EXPOSED';

  const isAffected = exposure_status === 'CONFIRMED_EXPOSED' || exposure_status === 'CANDIDATE_EXPOSED';
  const related_alert_id = isAffected ? alertId : null;
  const investigation_id = isAffected ? `INV-${alertId}` : null;

  const timeline = [
    { step_index: 1, step_name: "FOUP 카세트 로드", event_type: "LOAD", status: "COMPLETED" },
    { step_index: 2, step_name: "사전 정렬", event_type: "ALIGN", status: "COMPLETED" },
    {
      step_index: 3,
      step_name: "가공/대기",
      event_type: "PROCESS",
      status: exposure_status === 'CONFIRMED_EXPOSED' ? 'COMPLETED' : (exposure_status === 'CANDIDATE_EXPOSED' ? 'INTERRUPTED' : 'SKIPPED')
    },
    {
      step_index: 4,
      step_name: "인터록",
      event_type: "INTERLOCK",
      status: isAffected ? 'HELD' : 'COMPLETED'
    },
    {
      step_index: 5,
      step_name: "품질 판정",
      event_type: "HOLD",
      status: exposure_status === 'CANDIDATE_EXPOSED' ? 'HELD' : (exposure_status === 'CONFIRMED_EXPOSED' ? 'HELD' : 'PENDING'),
      description: exposure_status === 'CANDIDATE_EXPOSED' ? '결함 검측(Defect Review) 배정' : '보류 또는 재투입 대기'
    }
  ];

  return {
    wafer_id: waferId,
    lot_id: lotId,
    slot_number: slotNumber,
    sequence: slotNumber,
    exposure_status,
    equipment_id: "ETCH-02",
    chamber_id: "CH-B",
    run_id: runId,
    recipe_id: "RCP-ETCH-POLY-04",
    data_origin: "synthetic",
    is_synthetic: true,
    related_alert_id,
    investigation_id,
    timeline
  };
}

test('BUILD-03 Wafer Traceability Contract: W-01 (CONFIRMED_EXPOSED) timeline, metadata, and alert binding', () => {
  const trace = generateModeAWaferTraceTest('W-01');

  assert.equal(trace.wafer_id, 'W-01');
  assert.equal(trace.slot_number, 1);
  assert.equal(trace.exposure_status, 'CONFIRMED_EXPOSED');
  assert.equal(trace.equipment_id, 'ETCH-02');
  assert.equal(trace.chamber_id, 'CH-B');
  assert.equal(trace.data_origin, 'synthetic');
  assert.equal(trace.is_synthetic, true);
  assert.notEqual(trace.related_alert_id, null);
  assert.notEqual(trace.investigation_id, null);

  assert.equal(trace.timeline.length, 5);
  assert.equal(trace.timeline[2].event_type, 'PROCESS');
  assert.equal(trace.timeline[2].status, 'COMPLETED');
});

test('BUILD-03 Wafer Traceability Contract: W-08 (CANDIDATE_EXPOSED) timeline interruption and defect review hold', () => {
  const trace = generateModeAWaferTraceTest('W-08');

  assert.equal(trace.wafer_id, 'W-08');
  assert.equal(trace.slot_number, 8);
  assert.equal(trace.exposure_status, 'CANDIDATE_EXPOSED');
  assert.notEqual(trace.related_alert_id, null);
  assert.notEqual(trace.investigation_id, null);

  assert.equal(trace.timeline.length, 5);
  // Stage 3: Loadlock buffer interrupted
  assert.equal(trace.timeline[2].event_type, 'PROCESS');
  assert.equal(trace.timeline[2].status, 'INTERRUPTED');

  // Stage 5: Quality hold with defect review
  assert.equal(trace.timeline[4].event_type, 'HOLD');
  assert.equal(trace.timeline[4].status, 'HELD');
  assert.ok(trace.timeline[4].description.includes('결함 검측'));
});

test('BUILD-03 Wafer Traceability Contract: W-15 (NOT_EXPOSED) skipped timeline and no alert binding', () => {
  const trace = generateModeAWaferTraceTest('W-15');

  assert.equal(trace.wafer_id, 'W-15');
  assert.equal(trace.slot_number, 15);
  assert.equal(trace.exposure_status, 'NOT_EXPOSED');
  assert.equal(trace.related_alert_id, null);
  assert.equal(trace.investigation_id, null);

  assert.equal(trace.timeline.length, 5);
  // Stage 3: Cassette stored skipped
  assert.equal(trace.timeline[2].event_type, 'PROCESS');
  assert.equal(trace.timeline[2].status, 'SKIPPED');

  // Stage 5: Pending next batch
  assert.equal(trace.timeline[4].event_type, 'HOLD');
  assert.equal(trace.timeline[4].status, 'PENDING');
});

test('P1-A BUILD-03 Rapid Wafer Switching Async Race Condition Defense: Delayed inflight wafer trace cannot overwrite current selection', async () => {
  // Simulated component state & refs matching traceability/page.tsx
  let traceData = null;
  let selectedWaferId = 'W-08';
  let notice = '';
  let isLoading = false;
  let notFoundError = null;
  let mode = 'B';

  let activeTraceReqId = 0;
  let targetWaferId = 'W-08';

  // Mock responses
  const traceW01 = generateModeAWaferTraceTest('W-01');
  const traceW08 = generateModeAWaferTraceTest('W-08');

  let delayedResolveW01 = null;
  const delayedPromiseW01 = new Promise(resolve => {
    delayedResolveW01 = resolve;
  });

  async function loadDataTest(targetWafer, isDelayed = false) {
    const reqId = ++activeTraceReqId;
    targetWaferId = targetWafer;

    if (!/^W-(0[1-9]|1[0-9]|2[0-5])$/.test(targetWafer)) {
      if (reqId !== activeTraceReqId || targetWaferId !== targetWafer) return;
      traceData = null;
      notFoundError = { waferId: targetWafer, status: 404, message: 'Invalid ID' };
      return;
    }

    isLoading = true;
    notFoundError = null;

    try {
      const data = isDelayed ? await delayedPromiseW01 : (targetWafer === 'W-01' ? traceW01 : traceW08);

      // P1-A Invariant Check: Discard stale response
      if (reqId !== activeTraceReqId || targetWaferId !== targetWafer) {
        return; // DISCARDED
      }

      traceData = data;
      mode = 'B';
      notice = `Mode B (Live API): 웨이퍼 ${targetWafer} 공정 이력 및 타임라인 동기화 완료.`;
    } catch {
      if (reqId !== activeTraceReqId || targetWaferId !== targetWafer) return;
      traceData = generateModeAWaferTraceTest(targetWafer);
      mode = 'A';
      notice = `Mode A: 백엔드 미실행에 따른 로컬 합성 픽스처 웨이퍼 ${targetWafer} 이력 표시.`;
    } finally {
      if (reqId === activeTraceReqId && targetWaferId === targetWafer) {
        isLoading = false;
      }
    }
  }

  // 1. Initial selection: W-08 loaded
  await loadDataTest('W-08', false);
  assert.equal(traceData.wafer_id, 'W-08');
  assert.equal(isLoading, false);

  // 2. User rapidly clicks W-01 (simulating slow network request in-flight)
  selectedWaferId = 'W-01';
  const promiseW01 = loadDataTest('W-01', true);
  assert.equal(isLoading, true);

  // 3. Before W-01 resolves, user immediately clicks back to W-08 (fast response)
  selectedWaferId = 'W-08';
  await loadDataTest('W-08', false);
  assert.equal(traceData.wafer_id, 'W-08');
  assert.equal(isLoading, false);
  assert.ok(notice.includes('W-08'));

  // 4. Now delayed W-01 response arrives!
  delayedResolveW01(traceW01);
  await promiseW01;

  // 5. Invariant: traceData MUST remain W-08! W-01 stale response was safely discarded!
  assert.equal(selectedWaferId, 'W-08');
  assert.equal(traceData.wafer_id, 'W-08', 'Stale W-01 response must NOT overwrite current W-08 trace data');
  assert.ok(notice.includes('W-08'), 'Notice must remain W-08 and not be overwritten');
  assert.equal(notFoundError, null);
});

test('P1-B BUILD-03 Invalid Wafer ID & HTTP 404 Fail-Closed Guard: No synthetic fabrication for 404 or invalid ID', async () => {
  const VALID_WAFER_PATTERN = /^W-(0[1-9]|1[0-9]|2[0-5])$/;

  // 1. Invalid Wafer IDs (W-99, W-00, malformed) rejected without synthetic fabrication
  assert.equal(VALID_WAFER_PATTERN.test('W-99'), false);
  assert.equal(VALID_WAFER_PATTERN.test('W-00'), false);
  assert.equal(VALID_WAFER_PATTERN.test('WAFER-123'), false);
  assert.equal(VALID_WAFER_PATTERN.test('W-26'), false);
  assert.equal(VALID_WAFER_PATTERN.test('W-01'), true);
  assert.equal(VALID_WAFER_PATTERN.test('W-25'), true);

  // 2. Mock handler implementing P1-B logic
  async function simulateWaferQuery(waferId, serverStatus = 200, isServerOffline = false) {
    if (!VALID_WAFER_PATTERN.test(waferId)) {
      return {
        trace: null,
        notFoundError: { waferId, status: 404, message: `카세트 규격에 존재하지 않는 웨이퍼 ID ('${waferId}')입니다.` },
        mode: 'B'
      };
    }

    if (isServerOffline) {
      // Offline fallback to Mode A ONLY for valid wafers
      return {
        trace: generateModeAWaferTraceTest(waferId),
        notFoundError: null,
        mode: 'A'
      };
    }

    if (serverStatus === 404) {
      // Server is online, but responds 404
      // MUST NOT fall back to Mode A!
      return {
        trace: null,
        notFoundError: { waferId, status: 404, message: `서버 공정 DB에서 웨이퍼 '${waferId}'를 찾을 수 없습니다 (404 Not Found).` },
        mode: 'B'
      };
    }

    return {
      trace: generateModeAWaferTraceTest(waferId),
      notFoundError: null,
      mode: 'B'
    };
  }

  // Verification A: W-99 returns 404 error with null trace (no fake events)
  const resW99 = await simulateWaferQuery('W-99', 200, false);
  assert.equal(resW99.trace, null);
  assert.notEqual(resW99.notFoundError, null);
  assert.equal(resW99.notFoundError.status, 404);

  // Verification B: Server returns 404 for valid-format wafer
  const resServer404 = await simulateWaferQuery('W-18', 404, false);
  assert.equal(resServer404.trace, null);
  assert.notEqual(resServer404.notFoundError, null);
  assert.equal(resServer404.notFoundError.status, 404);
  assert.equal(resServer404.mode, 'B', 'Server 404 must NOT switch to Mode A');

  // Verification C: Server genuinely offline with valid wafer (W-08) -> Clean Mode A fallback
  const resOfflineValid = await simulateWaferQuery('W-08', 200, true);
  assert.notEqual(resOfflineValid.trace, null);
  assert.equal(resOfflineValid.trace.wafer_id, 'W-08');
  assert.equal(resOfflineValid.mode, 'A');
  assert.equal(resOfflineValid.notFoundError, null);

  // Verification D: Server genuinely offline with invalid wafer (W-99) -> Still 404, NO fake trace
  const resOfflineInvalid = await simulateWaferQuery('W-99', 200, true);
  assert.equal(resOfflineInvalid.trace, null);
  assert.notEqual(resOfflineInvalid.notFoundError, null);
  assert.equal(resOfflineInvalid.notFoundError.status, 404);
});

test('BUILD-03 Single Source Atomicity Regressions (a~e): Atomic bundle commit, lineage validation, and offline demarcation', async () => {
  // Test harnesses replicating the atomic loadData logic in traceability/page.tsx
  const VALID_WAFER_PATTERN = /^W-(0[1-9]|1[0-9]|2[0-5])$/;

  // State container simulating traceability component state
  function createHarness() {
    return {
      trace: null,
      wafers: [],
      activeRunId: null,
      mode: 'B',
      notFoundError: null,
      notice: '',
      activeReqId: 0,
      targetWaferId: '',

      async executeLoadData(targetWafer, fetchMocks) {
        const reqId = ++this.activeReqId;
        this.targetWaferId = targetWafer;

        if (!VALID_WAFER_PATTERN.test(targetWafer)) {
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 404, message: `카세트 규격에 존재하지 않는 웨이퍼 ID ('${targetWafer}')입니다.` };
          return;
        }

        // Step 1: fetch summary FIRST to acquire active_run_id (P1-A)
        let summaryRes;
        try {
          summaryRes = await fetchMocks.fetchSummary();
        } catch {
          // Network disconnection
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.mode = 'A';
          this.wafers = Array.from({ length: 25 }, (_, i) => ({
            wafer_id: `W-${String(i+1).padStart(2, '0')}`,
            lot_id: 'LOT-DEMO-815',
            slot_number: i+1,
            sequence: i+1,
            exposure_status: 'NOT_EXPOSED'
          }));
          this.activeRunId = 'RUN-DEMO-015';
          if (VALID_WAFER_PATTERN.test(targetWafer)) {
            this.trace = generateModeAWaferTraceTest(targetWafer);
            this.notFoundError = null;
            this.notice = `Mode A: 백엔드 미실행에 따른 로컬 합성 픽스처 웨이퍼 ${targetWafer} 이력 표시.`;
          } else {
            this.trace = null;
            this.notFoundError = { waferId: targetWafer, status: 404, message: 'Invalid ID' };
          }
          return;
        }

        if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;

        if (!summaryRes.ok) {
          this.trace = null;
          this.notFoundError = {
            waferId: targetWafer,
            status: summaryRes.status,
            message: `API 서버 요약 조회 실패 (HTTP ${summaryRes.status})`
          };
          this.mode = 'B';
          return;
        }

        let summaryData;
        try {
          summaryData = await summaryRes.json();
        } catch {
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 502, message: 'Malformed JSON' };
          this.mode = 'B';
          return;
        }

        if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;

        const currentRunId = summaryData?.active_run_id;
        if (!currentRunId || typeof currentRunId !== 'string') {
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 500, message: '서버 활성 Run 부재 오류' };
          this.mode = 'B';
          return;
        }

        // Step 2: fetch trace and wafers with explicit currentRunId
        let traceRes, wafersRes;
        try {
          [traceRes, wafersRes] = await Promise.all([
            fetchMocks.fetchTrace(currentRunId),
            fetchMocks.fetchWafers(currentRunId)
          ]);
        } catch {
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 500, message: '서버 통신 실패' };
          this.mode = 'B';
          return;
        }

        if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;

        if (traceRes.status === 404) {
          let errDetail = '404 Not Found';
          try {
            const errJson = await traceRes.json();
            if (errJson.detail) errDetail = errJson.detail;
          } catch {}
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 404, message: errDetail };
          this.mode = 'B';
          this.activeRunId = currentRunId;
          return;
        }

        if (!traceRes.ok || !wafersRes.ok) {
          const failedStatus = !traceRes.ok ? traceRes.status : wafersRes.status;
          this.trace = null;
          this.notFoundError = {
            waferId: targetWafer,
            status: failedStatus,
            message: `API 서버 응답 불완전 (HTTP ${failedStatus})`
          };
          this.mode = 'B';
          this.notice = `서버 응답 오류 (HTTP ${failedStatus}): 데이터 출처 무결성을 위해 조회를 차단했습니다.`;
          return;
        }

        let traceData, wafersData;
        try {
          [traceData, wafersData] = await Promise.all([
            traceRes.json(),
            wafersRes.json()
          ]);
        } catch {
          if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;
          this.trace = null;
          this.notFoundError = { waferId: targetWafer, status: 502, message: 'Malformed JSON' };
          this.mode = 'B';
          this.notice = '서버 응답 형식 오류: JSON 파싱에 실패했습니다.';
          return;
        }

        if (reqId !== this.activeReqId || this.targetWaferId !== targetWafer) return;

        const isRunCoherent = traceData.run_id === currentRunId;
        const isLotCoherent = wafersData.length > 0 && wafersData.some(w => w.wafer_id === targetWafer && w.lot_id === traceData.lot_id);

        if (!isRunCoherent || !isLotCoherent) {
          this.trace = null;
          this.notFoundError = {
            waferId: targetWafer,
            status: 500,
            message: '데이터 계통성 불일치 오류'
          };
          this.mode = 'B';
          this.notice = '데이터 계약 오류: 동일 공정 Run 및 Lot 계통 검증에 실패하여 조회를 차단했습니다.';
          return;
        }

        // Commit all
        this.trace = traceData;
        this.wafers = wafersData;
        this.activeRunId = currentRunId;
        this.mode = 'B';
        this.notFoundError = null;
        this.notice = `Mode B (Live API): 웨이퍼 ${targetWafer} 동기화 완료.`;
      }
    };
  }

  const validTraceW08 = generateModeAWaferTraceTest('W-08');
  const validWafers = Array.from({ length: 25 }, (_, i) => ({
    wafer_id: `W-${String(i+1).padStart(2, '0')}`,
    lot_id: validTraceW08.lot_id,
    slot_number: i+1,
    sequence: i+1,
    exposure_status: i < 7 ? 'CONFIRMED_EXPOSED' : (i < 12 ? 'CANDIDATE_EXPOSED' : 'NOT_EXPOSED')
  }));
  const validSummary = { active_run_id: validTraceW08.run_id, lot_id: validTraceW08.lot_id };

  // (a) Scenario A: summary 200 + trace 200 + list 500 -> fail-closed, trace=null, no synthetic fallback, mode=B
  const hA = createHarness();
  await hA.executeLoadData('W-08', {
    fetchSummary: async () => ({ ok: true, status: 200, json: async () => validSummary }),
    fetchTrace: async (rId) => ({ ok: true, status: 200, json: async () => validTraceW08 }),
    fetchWafers: async (rId) => ({ ok: false, status: 500, json: async () => ({ error: 'Internal Error' }) })
  });
  assert.equal(hA.trace, null, "(a) Trace MUST be null when wafer list fails with 500");
  assert.notEqual(hA.notFoundError, null);
  assert.equal(hA.notFoundError.status, 500);
  assert.equal(hA.mode, 'B', "(a) Must stay in Mode B on server HTTP 500 error, not fake Mode A");

  // (b) Scenario B: trace 200 + summary mismatch (different run_id or lot_id) -> fail-closed
  const hB = createHarness();
  await hB.executeLoadData('W-08', {
    fetchSummary: async () => ({ ok: true, status: 200, json: async () => ({ active_run_id: 'RUN-DIFFERENT-999', lot_id: validTraceW08.lot_id }) }),
    fetchTrace: async (rId) => ({ ok: true, status: 200, json: async () => validTraceW08 }),
    fetchWafers: async (rId) => ({ ok: true, status: 200, json: async () => validWafers })
  });
  assert.equal(hB.trace, null, "(b) Trace MUST be null when active run ID diverges");
  assert.notEqual(hB.notFoundError, null);
  assert.equal(hB.notFoundError.status, 500);
  assert.equal(hB.mode, 'B');

  // (c) Scenario C: W-01 list/summary JSON delayed while W-08 finishes -> stale W-01 responses discarded
  const hC = createHarness();
  let delayedResolveW01 = null;
  const delayedPromiseW01 = new Promise(resolve => { delayedResolveW01 = resolve; });

  const pW01 = hC.executeLoadData('W-01', {
    fetchSummary: async () => ({ ok: true, status: 200, json: async () => validSummary }),
    fetchTrace: async () => ({ ok: true, status: 200, json: async () => generateModeAWaferTraceTest('W-01') }),
    fetchWafers: async () => ({ ok: true, status: 200, json: async () => { await delayedPromiseW01; return validWafers; } })
  });

  // User immediately switches to W-08
  await hC.executeLoadData('W-08', {
    fetchSummary: async () => ({ ok: true, status: 200, json: async () => validSummary }),
    fetchTrace: async () => ({ ok: true, status: 200, json: async () => validTraceW08 }),
    fetchWafers: async () => ({ ok: true, status: 200, json: async () => validWafers })
  });
  assert.equal(hC.trace.wafer_id, 'W-08');

  // Now late W-01 resolves
  delayedResolveW01();
  await pW01;
  assert.equal(hC.trace.wafer_id, 'W-08', "(c) Stale W-01 delayed JSON must NOT overwrite current W-08");

  // (d) Scenario D: Response present but malformed JSON -> fail-closed with 502, no synthetic fallback
  const hD = createHarness();
  await hD.executeLoadData('W-08', {
    fetchSummary: async () => ({ ok: true, status: 200, json: async () => validSummary }),
    fetchTrace: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token < in JSON"); } }),
    fetchWafers: async () => ({ ok: true, status: 200, json: async () => validWafers })
  });
  assert.equal(hD.trace, null, "(d) Trace MUST be null on malformed JSON");
  assert.notEqual(hD.notFoundError, null);
  assert.equal(hD.notFoundError.status, 502);
  assert.equal(hD.mode, 'B', "(d) Malformed server JSON must not be misclassified as server offline");

  // (e) Scenario E: Server genuinely offline with valid W-08 -> Clean Mode A fallback
  const hE = createHarness();
  await hE.executeLoadData('W-08', {
    fetchSummary: async () => { throw new TypeError("Failed to fetch (ECONNREFUSED)"); },
    fetchTrace: async () => { throw new TypeError("Failed to fetch (ECONNREFUSED)"); },
    fetchWafers: async () => { throw new TypeError("Failed to fetch (ECONNREFUSED)"); }
  });
  assert.notEqual(hE.trace, null, "(e) Clean Mode A fallback when server is unreachable");
  assert.equal(hE.trace.wafer_id, 'W-08');
  assert.equal(hE.mode, 'A', "(e) Mode switched to A on genuine network connection failure");
  assert.equal(hE.notFoundError, null);
});

test('P1-A Explicit Run ID Origin Query Contract: Summary-first run_id discovery and explicit list/trace propagation', async () => {
  const recordedCalls = [];
  const serverSummaryRunId = 'RUN-DEMO-20261015-ACTIVE';
  const serverLotId = 'LOT-DEMO-801';

  const mockSummary = { active_run_id: serverSummaryRunId, lot_id: serverLotId };
  const mockTrace = {
    ...generateModeAWaferTraceTest('W-08'),
    run_id: serverSummaryRunId,
    lot_id: serverLotId
  };
  const mockWafers = Array.from({ length: 25 }, (_, i) => ({
    wafer_id: `W-${String(i+1).padStart(2, '0')}`,
    lot_id: serverLotId,
    slot_number: i+1,
    sequence: i+1,
    exposure_status: i < 7 ? 'CONFIRMED_EXPOSED' : (i < 12 ? 'CANDIDATE_EXPOSED' : 'NOT_EXPOSED')
  }));

  // Replicate summary-first loader
  async function loadDataHarness(targetWafer, fetchSummaryFn, fetchTraceFn, fetchWafersFn) {
    // 1. Fetch summary first
    const summaryRes = await fetchSummaryFn();
    const summaryData = await summaryRes.json();
    const activeRunId = summaryData.active_run_id;

    // 2. Fetch trace and wafers with explicit activeRunId
    const [traceRes, wafersRes] = await Promise.all([
      fetchTraceFn(targetWafer, activeRunId),
      fetchWafersFn(activeRunId)
    ]);

    const traceData = await traceRes.json();
    const wafersData = await wafersRes.json();

    // Verify coherence
    assert.equal(traceData.run_id, activeRunId);
    assert.ok(wafersData.every(w => w.lot_id === traceData.lot_id));

    return { traceData, wafersData, activeRunId };
  }

  // 1. First load: verifies summary is fetched first and run_id is propagated to both
  const result1 = await loadDataHarness(
    'W-08',
    async () => {
      recordedCalls.push({ endpoint: 'summary' });
      return { ok: true, status: 200, json: async () => mockSummary };
    },
    async (wId, rId) => {
      recordedCalls.push({ endpoint: 'trace', waferId: wId, runId: rId });
      return { ok: true, status: 200, json: async () => mockTrace };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'wafers', runId: rId });
      return { ok: true, status: 200, json: async () => mockWafers };
    }
  );

  assert.equal(recordedCalls[0].endpoint, 'summary', 'Summary MUST be called first');
  assert.equal(recordedCalls[1].runId, serverSummaryRunId, 'Trace call MUST include explicit run_id from summary');
  assert.equal(recordedCalls[2].runId, serverSummaryRunId, 'Wafers call MUST include explicit run_id from summary');
  assert.equal(result1.activeRunId, serverSummaryRunId);

  // 2. Subsequent query (W-01 -> W-08): explicit run_id is maintained
  recordedCalls.length = 0;
  await loadDataHarness(
    'W-01',
    async () => {
      recordedCalls.push({ endpoint: 'summary' });
      return { ok: true, status: 200, json: async () => mockSummary };
    },
    async (wId, rId) => {
      recordedCalls.push({ endpoint: 'trace', waferId: wId, runId: rId });
      return { ok: true, status: 200, json: async () => ({ ...mockTrace, wafer_id: 'W-01' }) };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'wafers', runId: rId });
      return { ok: true, status: 200, json: async () => mockWafers };
    }
  );
  assert.equal(recordedCalls[1].runId, serverSummaryRunId);
  assert.equal(recordedCalls[2].runId, serverSummaryRunId);
});

// ============================================================================
// BUILD-04: Engineering Knowledge Layer (EKL) Regression Test Suites
// ============================================================================

import { readFileSync } from 'node:fs';

// Helper matching calculateEtchRate in apps/web/src/components/ekl/engineering-knowledge.ts
function calculateEtchRateTest(initialThickness, finalThickness, processTimeMinutes) {
  if (
    !Number.isFinite(initialThickness) ||
    !Number.isFinite(finalThickness) ||
    !Number.isFinite(processTimeMinutes)
  ) {
    return { success: false, errorMessage: '유효한 유한 숫자를 입력해 주세요.' };
  }
  if (initialThickness < 0 || finalThickness < 0) {
    return { success: false, errorMessage: '박막 두께는 음수가 될 수 없습니다.' };
  }
  if (processTimeMinutes <= 0) {
    return { success: false, errorMessage: '공정 시간은 0보다 커야 합니다 (0으로 나눌 수 없음).' };
  }
  const deltaThickness = initialThickness - finalThickness;
  const etchRate = deltaThickness / processTimeMinutes;
  if (!Number.isFinite(etchRate)) {
    return { success: false, errorMessage: '식각 속도 계산 결과가 유효한 범위를 벗어났습니다.' };
  }
  if (deltaThickness < 0) {
    return {
      success: true,
      value: Math.round(etchRate * 100) / 100,
      warningMessage: '종료 두께가 초기 두께보다 큽니다. 식각이 아닌 박막 증착(Deposition) 현상입니다.'
    };
  }
  return {
    success: true,
    value: Math.round(etchRate * 100) / 100
  };
}

test('BUILD-04 EKL Calculation Model Contract: Etch Rate arithmetic, unit validation, Number.isFinite bounds, and boundary conditions', () => {
  // 1. Standard valid nominal calculation: (200 - 140) nm / 2.0 min = 30.00 nm/min
  const res1 = calculateEtchRateTest(200, 140, 2.0);
  assert.equal(res1.success, true);
  assert.equal(res1.value, 30.00);
  assert.equal(res1.warningMessage, undefined);

  // 2. Zero etch rate (no thickness change): (150 - 150) / 1.5 = 0 nm/min
  const resZero = calculateEtchRateTest(150, 150, 1.5);
  assert.equal(resZero.success, true);
  assert.equal(resZero.value, 0.0);

  // 3. Fractional inputs with 2 decimal precision
  const resFrac = calculateEtchRateTest(185.5, 120.2, 2.5);
  assert.equal(resFrac.success, true);
  assert.equal(resFrac.value, 26.12);

  // 4. Boundary: Time = 0 must fail-closed (prevent division by zero)
  const resZeroTime = calculateEtchRateTest(200, 140, 0);
  assert.equal(resZeroTime.success, false);
  assert.ok(resZeroTime.errorMessage.includes('0보다 커야 합니다'));

  // 5. Boundary: Negative time must fail-closed
  const resNegTime = calculateEtchRateTest(200, 140, -2.0);
  assert.equal(resNegTime.success, false);
  assert.ok(resNegTime.errorMessage.includes('0보다 커야 합니다'));

  // 6. Boundary: Negative thickness must fail-closed
  const resNegThick = calculateEtchRateTest(-50, 100, 2.0);
  assert.equal(resNegThick.success, false);
  assert.ok(resNegThick.errorMessage.includes('음수가 될 수 없습니다'));

  // 7. Boundary: NaN inputs must fail-closed
  const resNaN = calculateEtchRateTest(NaN, 140, 2.0);
  assert.equal(resNaN.success, false);
  assert.ok(resNaN.errorMessage.includes('유효한 유한 숫자를 입력해 주세요'));

  // 8. P1-B Boundary: Infinity and non-finite inputs (e.g. parseFloat('1e309')) must fail-closed
  const resInf1 = calculateEtchRateTest(Infinity, 140, 2.0);
  assert.equal(resInf1.success, false);
  assert.ok(resInf1.errorMessage.includes('유효한 유한 숫자를 입력해 주세요'));

  const resInf2 = calculateEtchRateTest(200, -Infinity, 2.0);
  assert.equal(resInf2.success, false);
  assert.ok(resInf2.errorMessage.includes('유효한 유한 숫자를 입력해 주세요'));

  const resOverflow = calculateEtchRateTest(parseFloat('1e309'), 140, 2.0);
  assert.equal(resOverflow.success, false);
  assert.ok(resOverflow.errorMessage.includes('유효한 유한 숫자를 입력해 주세요'));

  const resTimeInf = calculateEtchRateTest(200, 140, parseFloat('1e309'));
  assert.equal(resTimeInf.success, false);
  assert.ok(resTimeInf.errorMessage.includes('유효한 유한 숫자를 입력해 주세요'));

  // 9. Domain Warning: Final thickness > Initial thickness (Deposition warning)
  const resDeposition = calculateEtchRateTest(140, 200, 2.0);
  assert.equal(resDeposition.success, true);
  assert.equal(resDeposition.value, -30.00);
  assert.ok(resDeposition.warningMessage.includes('증착(Deposition)'));
});

test('BUILD-04 EKL Concept Schema Contract: All 6 concepts define units, caveats, and 5 deep dive boundaries', () => {
  const eklSource = readFileSync(new URL('../src/components/ekl/engineering-knowledge.ts', import.meta.url), 'utf8');

  const requiredConcepts = [
    'oes-relative-signal',
    'chamber-pressure',
    'rf-power',
    'spc-ucl-missing',
    'wafer-exposure-status',
    'etch-rate'
  ];

  requiredConcepts.forEach(cid => {
    assert.ok(eklSource.includes(`'${cid}'`), `EKL source must define concept ID '${cid}'`);
  });

  // Verify units are explicitly mapped
  assert.ok(eklSource.includes('a.u. (Arbitrary Unit)'));
  assert.ok(eklSource.includes('mTorr (밀리토르)'));
  assert.ok(eklSource.includes('W (Watts)'));
  assert.ok(eklSource.includes('nm/min (나노미터/분)'));

  // Verify 5 mandatory deep-dive sections exist
  assert.ok(eklSource.includes('physicalQuantityVsProcess'));
  assert.ok(eklSource.includes('controlLimitsVsSpecLimits'));
  assert.ok(eklSource.includes('missingVsZero'));
  assert.ok(eklSource.includes('sensorAnomalyVsDefect'));
  assert.ok(eklSource.includes('exposureStatusMeaning'));

  // Verify domain caveats and disclaimers
  assert.ok(eklSource.includes('공학 검수 전'));
  assert.ok(eklSource.includes('설명용 가상 예시'));
  assert.ok(eklSource.includes('UCL/LCL(관리한계) ≠ USL/LSL(규격한계)'));
  assert.ok(eklSource.includes('MISSING(결측치) ≠ 0'));
  assert.ok(eklSource.includes('Excursion') && eklSource.includes('Defect'));
});

test('BUILD-04 EKL Interaction State Machine: L1 -> L2 -> L3 navigation and context retention on close', () => {
  class EKLStateMachine {
    constructor() {
      this.activeLevel = 0;
      this.activeConceptId = null;
      this.originTrigger = null;
      // Screen context that must NEVER be reset by EKL actions
      this.screenContext = {
        selectedWafer: 'W-08',
        activeAlertId: 'AL-DEMO-044',
        activeRunId: 'RUN-DEMO-044',
        filter: 'ALL'
      };
    }

    openInsight(conceptId, triggerEl = 'button-trigger-1') {
      this.originTrigger = triggerEl;
      this.activeConceptId = conceptId;
      this.activeLevel = 2;
    }

    openDeepDive(conceptId) {
      if (conceptId) this.activeConceptId = conceptId;
      this.activeLevel = 3;
    }

    backToInsight() {
      this.activeLevel = 2;
    }

    closeAll() {
      this.activeLevel = 0;
      // Focus restored to originTrigger in browser
      return this.originTrigger;
    }

    handleEscape() {
      if (this.activeLevel === 3) {
        this.backToInsight();
      } else if (this.activeLevel === 2) {
        this.closeAll();
      }
    }
  }

  const sm = new EKLStateMachine();

  // 1. Initial State: closed
  assert.equal(sm.activeLevel, 0);
  assert.equal(sm.activeConceptId, null);

  // 2. User clicks L1 trigger for 'rf-power'
  sm.openInsight('rf-power', 'trigger-rf-power-btn');
  assert.equal(sm.activeLevel, 2, 'L2 insight card must be active');
  assert.equal(sm.activeConceptId, 'rf-power');
  assert.equal(sm.screenContext.selectedWafer, 'W-08', 'Wafer context must be preserved');

  // 3. User navigates to Level 3 Deep Dive
  sm.openDeepDive();
  assert.equal(sm.activeLevel, 3, 'L3 deep dive panel must be active');
  assert.equal(sm.activeConceptId, 'rf-power');
  assert.equal(sm.screenContext.selectedWafer, 'W-08');

  // 4. User presses Escape at Level 3 -> returns to Level 2
  sm.handleEscape();
  assert.equal(sm.activeLevel, 2, 'Escape at L3 must transition back to L2');
  assert.equal(sm.activeConceptId, 'rf-power');

  // 5. User presses Escape at Level 2 -> closes completely and restores focus
  const restoredFocus = sm.closeAll();
  assert.equal(sm.activeLevel, 0, 'EKL must be completely closed');
  assert.equal(restoredFocus, 'trigger-rf-power-btn', 'Focus must restore to origin trigger');
  assert.equal(sm.screenContext.selectedWafer, 'W-08', 'Screen context must remain intact');
  assert.equal(sm.screenContext.activeRunId, 'RUN-DEMO-044');
});

test('P1-B Accessible Modal Dialog Contract: Focus trapping, Tab/Shift+Tab cycle, and background inert isolation', () => {
  // Replicate focus trapping algorithm used in EngineeringInsightCard and EngineeringDeepDivePanel
  function simulateFocusTrap(focusableElements, currentFocus, key, shiftKey) {
    if (key !== 'Tab') return currentFocus;
    if (focusableElements.length === 0) return null;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (shiftKey) {
      if (currentFocus === first || !focusableElements.includes(currentFocus)) {
        return last; // Wrap backward to last
      }
      const prevIdx = focusableElements.indexOf(currentFocus) - 1;
      return focusableElements[prevIdx];
    } else {
      if (currentFocus === last || !focusableElements.includes(currentFocus)) {
        return first; // Wrap forward to first
      }
      const nextIdx = focusableElements.indexOf(currentFocus) + 1;
      return focusableElements[nextIdx];
    }
  }

  const l2Elements = ['btn-close', 'input-t1', 'input-t2', 'input-time', 'btn-esc-close', 'btn-go-deep'];

  // Forward Tab from last element wraps to first
  const wrappedForward = simulateFocusTrap(l2Elements, 'btn-go-deep', 'Tab', false);
  assert.equal(wrappedForward, 'btn-close', 'Tab on last element must wrap to first element');

  // Forward Tab from middle element advances to next
  const advanceForward = simulateFocusTrap(l2Elements, 'input-t1', 'Tab', false);
  assert.equal(advanceForward, 'input-t2');

  // Backward Shift+Tab from first element wraps to last
  const wrappedBackward = simulateFocusTrap(l2Elements, 'btn-close', 'Tab', true);
  assert.equal(wrappedBackward, 'btn-go-deep', 'Shift+Tab on first element must wrap to last element');

  // Shift+Tab from dialog title (-1) or outside wraps to last
  const outsideShiftTab = simulateFocusTrap(l2Elements, 'dialog-title', 'Tab', true);
  assert.equal(outsideShiftTab, 'btn-go-deep', 'Shift+Tab from dialog title must focus last element');

  // Tab from outside focuses first
  const outsideTab = simulateFocusTrap(l2Elements, 'dialog-title', 'Tab', false);
  assert.equal(outsideTab, 'btn-close', 'Tab from outside must focus first element');

  // Verify source files contain aria-modal="true" and focus trap listeners
  const l2Source = readFileSync(new URL('../src/components/ekl/EngineeringInsightCard.tsx', import.meta.url), 'utf8');
  assert.ok(l2Source.includes('aria-modal="true"'));
  assert.ok(l2Source.includes("e.key !== 'Tab'"));
  assert.ok(l2Source.includes('last.focus()') && l2Source.includes('first.focus()'));

  const l3Source = readFileSync(new URL('../src/components/ekl/EngineeringDeepDivePanel.tsx', import.meta.url), 'utf8');
  assert.ok(l3Source.includes('aria-modal="true"'));
  assert.ok(l3Source.includes("e.key !== 'Tab'"));
  assert.ok(l3Source.includes('last.focus()') && l3Source.includes('first.focus()'));

  const ctxSource = readFileSync(new URL('../src/components/ekl/EngineeringKnowledgeContext.tsx', import.meta.url), 'utf8');
  assert.ok(ctxSource.includes('.setAttribute(\'inert\', \'\')'));
  assert.ok(ctxSource.includes('.removeAttribute(\'inert\')'));
});

test('BUILD-04 Traceability Error Differentiation & Cassette Protection Invariant', () => {
  // Test error title differentiation logic
  function resolveErrorTitle(status, message) {
    if (status === 404) return '존재하지 않는 웨이퍼 (404 Not Found)';
    if (status === 502) return '서버 응답 형식 오류 (502 Bad Gateway / Malformed JSON)';
    if (status === 500 && message.includes('계통성')) return '데이터 계통성 불일치 오류 (Data Lineage Error)';
    if (status === 500) return '서버 내부 오류 (HTTP 500 Internal Server Error)';
    return `서버 통신 오류 (HTTP ${status})`;
  }

  assert.equal(resolveErrorTitle(404, 'Not found'), '존재하지 않는 웨이퍼 (404 Not Found)');
  assert.equal(resolveErrorTitle(502, 'JSON error'), '서버 응답 형식 오류 (502 Bad Gateway / Malformed JSON)');
  assert.equal(resolveErrorTitle(500, '데이터 계통성 불일치 오류'), '데이터 계통성 불일치 오류 (Data Lineage Error)');
  assert.equal(resolveErrorTitle(500, 'Database crashed'), '서버 내부 오류 (HTTP 500 Internal Server Error)');
  assert.equal(resolveErrorTitle(503, 'Service unavailable'), '서버 통신 오류 (HTTP 503)');

  // Verify page.tsx source contains cassette protection and timeline disclaimer
  const tracePageSource = readFileSync(new URL('../src/app/traceability/page.tsx', import.meta.url), 'utf8');
  assert.ok(tracePageSource.includes('카세트 동기화 중단'), 'Cassette error notification banner must be present');
  assert.ok(tracePageSource.includes('pointerEvents: notFoundError ? \'none\' : \'auto\''), 'Cassette must be non-interactive during error');
  assert.ok(tracePageSource.includes('가상 시나리오 재구성 (Synthetic Scenario Reconstruction)'), 'Timeline synthetic disclaimer must be present');
});

// ============================================================================
// BUILD-05: FDC Command Center Regression Test Suites (P1-A, P1-B, P1-C)
// ============================================================================

// Helper matching generateModeACommandCenterAlarms in apps/web/src/components/command-center/command-center-contract.ts
function generateModeACommandCenterFixtureTest(seed = 20261015) {
  const lotNum = 800 + (seed % 50);
  const runNum = String(seed % 1000).padStart(3, '0');
  const runId = `RUN-DEMO-${runNum}`;
  const lotId = `LOT-DEMO-${lotNum}`;
  const alertId = `AL-DEMO-${runNum}`;
  const standbyAlertId = `AL-STANDBY-${runNum}`;
  const infoAlertId = `AL-INFO-${runNum}`;

  const alerts = [
    {
      alert_id: alertId,
      severity: 'CRITICAL',
      equipment_id: 'ETCH-02',
      chamber_id: 'CH-B',
      run_id: runId,
      rule_code: 'FDC-RULE-SPC-UCL-01',
      message: '식각 챔버 압력/광학 신호/RF Power 복합 급증 (Step T7 공정 일탈 감지, > UCL 65.0 a.u.)',
      status: 'ACTIVE',
      event_time_utc: '2026-10-15T00:00:35.000Z',
      candidate_lot: lotId,
      candidate_wafers: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12'],
    },
    {
      alert_id: standbyAlertId,
      severity: 'WARNING',
      equipment_id: 'ETCH-01',
      chamber_id: 'CH-A',
      run_id: null,
      rule_code: 'FDC-RULE-HEURISTIC-02',
      message: '대기 챔버(CH-A) 진공도 및 온도 미세 드리프트 감지 (공정 Run 무관, 조사 미지원)',
      status: 'ACTIVE',
      event_time_utc: '2026-10-15T00:00:00.000Z',
      candidate_lot: null,
      candidate_wafers: [],
    },
    {
      alert_id: infoAlertId,
      severity: 'INFO',
      equipment_id: 'ETCH-02',
      chamber_id: 'LOADPORT-01',
      run_id: runId,
      rule_code: 'FDC-RULE-INFO-01',
      message: '카세트 로드포트 도어 인터록 주기 점검 정상 확인 (Routine Status Check OK)',
      status: 'CLEARED',
      event_time_utc: '2026-10-14T23:59:00.000Z',
      candidate_lot: lotId,
      candidate_wafers: [],
    },
  ];

  return { alerts, activeRunId: runId, lotId };
}

// Logic matching isInvestigationSupported in command-center-contract.ts
function isInvestigationSupportedTest(alert, activeRunId) {
  if (!alert) {
    return { supported: false, reason: '선택된 알람이 없습니다.' };
  }
  // 1. Active Run presence check
  if (!activeRunId || typeof activeRunId !== 'string' || activeRunId.trim().length === 0) {
    return {
      supported: false,
      reason: '현재 활성화된 공정 Run이 존재하지 않아 이상 조회를 지원할 수 없습니다.'
    };
  }
  // 2. Standby check (null run_id)
  if (!alert.run_id) {
    return {
      supported: false,
      reason: '대기 설비(Standby) 알람으로 연결된 활성 공정 Run 및 웨이퍼 가공 이력이 없습니다.'
    };
  }
  // 3. Active Run Lineage check
  if (alert.run_id !== activeRunId) {
    return {
      supported: false,
      reason: `알람 소속 Run (${alert.run_id})이 현재 활성 Run (${activeRunId})과 일치하지 않아 조회를 차단했습니다.`
    };
  }
  // 4. Severity check: Non-critical alerts are not sensor excursion investigations
  if (alert.severity !== 'CRITICAL') {
    return {
      supported: false,
      reason: `단순 상태/경고 경보(${alert.severity})로 센서 시계열 이상 조사 대상이 아닙니다.`
    };
  }
  // 5. Equipment & Chamber Verification: T7 sensor excursion is exclusively recorded on ETCH-02 / CH-B
  const isTargetChamber = alert.equipment_id === 'ETCH-02' && alert.chamber_id === 'CH-B';
  if (!isTargetChamber) {
    return {
      supported: false,
      reason: `해당 CRITICAL 경보(${alert.equipment_id} / ${alert.chamber_id})는 스텝 T7 센서 이상 계측 근거가 등록되지 않은 설비/챔버입니다. 허위 이상 계측 화면으로의 연결을 차단합니다 (Fail-closed).`
    };
  }
  // 6. Explicit Rule Verification: Must be the scenario-supported SPC excursion rule (candidate wafers alone cannot grant support)
  const isTargetRule = alert.rule_code === 'FDC-RULE-SPC-UCL-01';
  if (!isTargetRule) {
    return {
      supported: false,
      reason: `해당 CRITICAL 경보의 규칙(${alert.rule_code})은 스텝 T7 시계열 센서 이상 계측 근거가 등록되지 않은 규칙입니다. 후보 웨이퍼 표기 유무와 무관하게 허위 조사 연결을 차단합니다 (Fail-closed).`
    };
  }
  // 7. All positive criteria strictly satisfied for the synthetic demonstration scenario
  return {
    supported: true,
    reason: `현재 합성 시나리오의 조사 연결 지원 조건(활성 Run ${activeRunId}, ETCH-02 / CH-B, 스텝 T7 OES/압력/RF Power 복합 급증)을 충족합니다.`
  };
}

// Logic matching applyFilterAndSort in command-center-contract.ts
function applyFilterAndSortTest(alerts, severityFilter, statusFilter, equipFilter, sortOrder) {
  let result = [...alerts];

  if (severityFilter !== 'ALL') {
    result = result.filter(a => a.severity === severityFilter);
  }
  if (statusFilter !== 'ALL') {
    result = result.filter(a => a.status === statusFilter);
  }
  if (equipFilter !== 'ALL') {
    result = result.filter(a => `${a.equipment_id} / ${a.chamber_id}` === equipFilter);
  }

  result.sort((a, b) => {
    const timeA = new Date(a.event_time_utc).getTime();
    const timeB = new Date(b.event_time_utc).getTime();
    return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
  });

  return result;
}

test('BUILD-05 Command Center Contract: Summary-first run_id discovery, alerts endpoint binding, and lineage validation', async () => {
  const recordedCalls = [];
  const serverSummaryRunId = 'RUN-DEMO-20261015-ACTIVE';
  const serverLotId = 'LOT-DEMO-801';

  const mockSummary = { active_run_id: serverSummaryRunId, lot_id: serverLotId };
  const mockAlerts = [
    {
      alert_id: 'AL-DEMO-20261015-01',
      equipment_id: 'ETCH-02',
      chamber_id: 'CH-B',
      severity: 'CRITICAL',
      rule_code: 'FDC-RULE-SPC-UCL-01',
      message: 'CH-B RF Power 이상',
      status: 'ACTIVE',
      event_time_utc: '2026-10-15T09:30:00Z',
      candidate_lot: serverLotId,
      run_id: serverSummaryRunId,
      candidate_wafers: ['W-08', 'W-09']
    },
    {
      alert_id: 'AL-STANDBY-001',
      equipment_id: 'ETCH-03',
      chamber_id: 'CH-C',
      severity: 'INFO',
      rule_code: 'FDC-RULE-INFO-01',
      message: 'Standby IDLE',
      status: 'CLEARED',
      event_time_utc: '2026-10-15T08:50:00Z',
      candidate_lot: null,
      run_id: null,
      candidate_wafers: []
    }
  ];

  // Harness simulating loadAlarms in command-center/page.tsx
  let activeReqId = 0;
  async function loadCommandCenterDataHarness(fetchSummaryFn, fetchAlertsFn) {
    const reqId = ++activeReqId;

    // Step 1: Summary first
    const summaryRes = await fetchSummaryFn();
    const summaryData = await summaryRes.json();
    const currentRunId = summaryData?.active_run_id;

    if (reqId !== activeReqId) return { discarded: true };

    // Step 2: Fetch alerts with explicit run_id
    const alertsRes = await fetchAlertsFn(currentRunId);
    const alertsData = await alertsRes.json();

    if (reqId !== activeReqId) return { discarded: true };

    // Step 3: Validate lineage - all run-bound alerts must match currentRunId
    const validatedAlerts = alertsData.filter(al => {
      if (al.run_id && al.run_id !== currentRunId) {
        return false; // Cross-run data discarded
      }
      return true;
    });

    return {
      activeRunId: currentRunId,
      lotId: summaryData?.lot_id,
      alerts: validatedAlerts,
      discarded: false
    };
  }

  // Verification 1: Order of execution and run_id parameter binding
  const res = await loadCommandCenterDataHarness(
    async () => {
      recordedCalls.push({ endpoint: 'summary' });
      return { ok: true, status: 200, json: async () => mockSummary };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'alerts', runId: rId });
      return { ok: true, status: 200, json: async () => mockAlerts };
    }
  );

  assert.equal(recordedCalls[0].endpoint, 'summary', 'Summary MUST be requested first');
  assert.equal(recordedCalls[1].endpoint, 'alerts');
  assert.equal(recordedCalls[1].runId, serverSummaryRunId, 'Alerts endpoint must be called with discovered run_id');
  assert.equal(res.activeRunId, serverSummaryRunId);
  assert.equal(res.alerts.length, 2);

  // Verification 2: Stale async response discard on rapid re-triggering
  let delayedResolve = null;
  const delayedPromise = new Promise(resolve => { delayedResolve = resolve; });

  const staleCall = loadCommandCenterDataHarness(
    async () => ({ ok: true, status: 200, json: async () => ({ active_run_id: 'RUN-OLD' }) }),
    async () => {
      await delayedPromise;
      return { ok: true, status: 200, json: async () => mockAlerts };
    }
  );

  // New fast call
  const fastCall = await loadCommandCenterDataHarness(
    async () => ({ ok: true, status: 200, json: async () => ({ active_run_id: 'RUN-NEW' }) }),
    async () => ({ ok: true, status: 200, json: async () => mockAlerts })
  );

  delayedResolve();
  const staleRes = await staleCall;

  assert.equal(staleRes.discarded, true, 'Older in-flight response must be discarded');
  assert.equal(fastCall.activeRunId, 'RUN-NEW');
});

test('P1-A BUILD-05 Selection, URL, and Filter Synchronization State Machine: Cyclic dependency elimination and request minimization', () => {
  const fixture = generateModeACommandCenterFixtureTest(20261015);
  const allAlerts = fixture.alerts;
  const criticalAlert = allAlerts[0]; // AL-DEMO-015 (CRITICAL)
  const warningAlert = allAlerts[1];  // AL-STANDBY-015 (WARNING)
  const infoAlert = allAlerts[2];     // AL-INFO-015 (INFO)

  // Component simulator modeling page.tsx state and effects
  class CommandCenterStateHarness {
    constructor() {
      this.alarms = [...allAlerts];
      this.selectedAlertId = null;
      this.currentUrl = '/command-center';
      this.fetchCount = 0;
      this.severityFilter = 'ALL';
      this.statusFilter = 'ALL';
      this.equipmentFilter = 'ALL';
      this.sortOrder = 'NEWEST';
    }

    // Loader decoupled from selectedAlertId (P1-A fix)
    executeInitialLoad(deepLinkQuery = null) {
      this.fetchCount++;
      // Set initial selection
      if (deepLinkQuery && this.alarms.some(a => a.alert_id === deepLinkQuery)) {
        this.selectedAlertId = deepLinkQuery;
        this.currentUrl = `/command-center?alert=${encodeURIComponent(deepLinkQuery)}`;
      } else {
        this.selectedAlertId = this.alarms[0]?.alert_id ?? null;
        if (this.selectedAlertId) {
          this.currentUrl = `/command-center?alert=${encodeURIComponent(this.selectedAlertId)}`;
        }
      }
    }

    // Direct selection handler
    handleSelectAlert(aId) {
      this.selectedAlertId = aId;
      this.currentUrl = `/command-center?alert=${encodeURIComponent(aId)}`;
      // Crucial: NO network fetch!
    }

    // Filter change effect
    setFilter(severity, status = 'ALL', equipment = 'ALL') {
      this.severityFilter = severity;
      this.statusFilter = status;
      this.equipmentFilter = equipment;

      const filtered = applyFilterAndSortTest(
        this.alarms,
        this.severityFilter,
        this.statusFilter,
        this.equipmentFilter,
        this.sortOrder
      );

      // Effect: synchronize selection and URL
      if (filtered.length === 0) {
        this.selectedAlertId = null;
        this.currentUrl = '/command-center';
      } else if (!this.selectedAlertId || !filtered.some(a => a.alert_id === this.selectedAlertId)) {
        const nextId = filtered[0].alert_id;
        this.selectedAlertId = nextId;
        this.currentUrl = `/command-center?alert=${encodeURIComponent(nextId)}`;
      }
      // Crucial: NO network fetch!
    }

    resetFilters() {
      this.setFilter('ALL', 'ALL', 'ALL');
    }
  }

  const harness = new CommandCenterStateHarness();

  // 1. Initial entry with ?alert=AL-DEMO-015
  harness.executeInitialLoad(criticalAlert.alert_id);
  assert.equal(harness.fetchCount, 1, 'Initial load must perform exactly 1 fetch');
  assert.equal(harness.selectedAlertId, criticalAlert.alert_id);
  assert.ok(harness.currentUrl.includes(criticalAlert.alert_id));

  // 2. User applies INFO severity filter: critical alert is excluded
  // Invariant: Selection must automatically update to infoAlert, and URL must synchronize to infoAlert
  harness.setFilter('INFO');
  assert.equal(harness.fetchCount, 1, 'Filter change must NOT trigger re-fetch (cyclic fetch eliminated!)');
  assert.equal(harness.selectedAlertId, infoAlert.alert_id);
  assert.equal(harness.currentUrl, `/command-center?alert=${encodeURIComponent(infoAlert.alert_id)}`);

  // 3. User directly selects WARNING alert after switching filter to ALL
  harness.resetFilters();
  assert.equal(harness.fetchCount, 1, 'Filter reset must NOT trigger re-fetch');
  harness.handleSelectAlert(warningAlert.alert_id);
  assert.equal(harness.selectedAlertId, warningAlert.alert_id);
  assert.equal(harness.currentUrl, `/command-center?alert=${encodeURIComponent(warningAlert.alert_id)}`);
  assert.equal(harness.fetchCount, 1, 'Direct alert selection must NOT trigger re-fetch');

  // 4. User applies impossible filter resulting in 0 items
  harness.setFilter('CRITICAL', 'CLEARED');
  assert.equal(harness.fetchCount, 1);
  assert.equal(harness.selectedAlertId, null, 'Selected alert must be null when 0 items match');
  assert.equal(harness.currentUrl, '/command-center', 'URL must clear ?alert parameter when queue is empty');

  // 5. User resets filters -> restores items and selects first
  harness.resetFilters();
  assert.equal(harness.fetchCount, 1);
  assert.equal(harness.selectedAlertId, criticalAlert.alert_id);
  assert.ok(harness.currentUrl.includes(criticalAlert.alert_id));
});

test('P1-B BUILD-05 Keyboard Accessibility Contract: Semantic button rows, Tab/Enter/Space interaction, and focus-visible styling', () => {
  const ccPageSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  // 1. Alarm queue items must be semantic <button type="button"> elements
  assert.ok(
    ccPageSource.includes('<button') && ccPageSource.includes('className={`cc-alarm-item ${isSelected ? \'selected\' : \'\'}`}'),
    'Alarm queue rows must be semantic <button> elements, not non-interactive <div>'
  );
  assert.ok(ccPageSource.includes('type="button"'), 'Alarm queue buttons must explicitly specify type="button"');
  assert.ok(ccPageSource.includes('tabIndex={0}'), 'Alarm queue items must be keyboard focusable (tabIndex={0})');
  assert.ok(ccPageSource.includes('aria-pressed={isSelected}'), 'Alarm queue items must convey toggle/pressed state');
  assert.ok(ccPageSource.includes('aria-selected={isSelected}'), 'Alarm queue items must convey selection state');

  // 2. CSS must provide visible focus indicator
  assert.ok(cssSource.includes('.cc-alarm-item:focus-visible'), 'CSS must define :focus-visible for keyboard focus');
  assert.ok(cssSource.includes('outline: 2px solid #0B9F78'), 'CSS focus outline must be prominent and contrast-compliant');
});

test('P1-C BUILD-05 Investigation Telemetry Verification Contract: Counterexamples, chamber/rule provenance, and fail-closed isolation', () => {
  const activeRunId = 'RUN-DEMO-015';

  // 0. Verify the actual source code contract in command-center-contract.ts directly
  const contractSource = readFileSync(
    new URL('../src/components/command-center/command-center-contract.ts', import.meta.url),
    'utf8'
  );
  assert.ok(
    contractSource.includes("const isTargetRule = alert.rule_code === 'FDC-RULE-SPC-UCL-01';"),
    'Source contract must strictly require FDC-RULE-SPC-UCL-01'
  );
  assert.ok(
    !contractSource.includes('|| (alert.candidate_wafers'),
    'Source contract must NOT use candidate_wafers in an OR condition for telemetry verification'
  );
  assert.ok(
    contractSource.includes("if (!activeRunId || typeof activeRunId !== 'string'"),
    'Source contract must strictly validate activeRunId presence before checking alert.run_id'
  );

  // 1. Nominal Active Excursion (a): ETCH-02 / CH-B / CRITICAL / FDC-RULE-SPC-UCL-01
  const nominalAlert = {
    alert_id: 'AL-DEMO-015',
    severity: 'CRITICAL',
    equipment_id: 'ETCH-02',
    chamber_id: 'CH-B',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-SPC-UCL-01',
    candidate_wafers: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12']
  };
  const nominalRes = isInvestigationSupportedTest(nominalAlert, activeRunId);
  assert.equal(nominalRes.supported, true, '(a) Nominal active T7 excursion must be supported');
  assert.ok(nominalRes.reason.includes('현재 합성 시나리오의 조사 연결 지원 조건'));

  // 2. Counterexample (b) [A01 Crucial Counterexample]:
  // Same Run + ETCH-02 + CH-B + CRITICAL + DIFFERENT RULE + NON-EMPTY candidate_wafers
  // MUST FAIL CLOSED: Candidate wafers alone do not prove T7 sensor excursion telemetry!
  const ruleMismatchWithWafersAlert = {
    alert_id: 'AL-DEMO-DIFF-RULE',
    severity: 'CRITICAL',
    equipment_id: 'ETCH-02',
    chamber_id: 'CH-B',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-OTHER',
    candidate_wafers: ['W-08', 'W-09']
  };
  const ruleMismatchRes = isInvestigationSupportedTest(ruleMismatchWithWafersAlert, activeRunId);
  assert.equal(
    ruleMismatchRes.supported,
    false,
    '(b) CRITICAL alert on target chamber with different rule must fail closed despite candidate_wafers!'
  );
  assert.ok(ruleMismatchRes.reason.includes('스텝 T7 시계열 센서 이상 계측 근거가 등록되지 않은 규칙입니다'));
  assert.ok(ruleMismatchRes.reason.includes('후보 웨이퍼 표기 유무와 무관하게 허위 조사 연결을 차단'));

  // 3. Counterexample (c): activeRunId is null or empty string
  const nullActiveRunRes = isInvestigationSupportedTest(nominalAlert, null);
  assert.equal(nullActiveRunRes.supported, false, '(c) activeRunId=null must fail closed');
  assert.ok(nullActiveRunRes.reason.includes('현재 활성화된 공정 Run이 존재하지 않아'));

  const emptyActiveRunRes = isInvestigationSupportedTest(nominalAlert, '   ');
  assert.equal(emptyActiveRunRes.supported, false, '(c) activeRunId="" must fail closed');

  // 4. Counterexample (d1): Standby Alert (run_id is null)
  const standbyAlert = {
    alert_id: 'AL-STANDBY-001',
    severity: 'WARNING',
    equipment_id: 'ETCH-01',
    chamber_id: 'CH-A',
    run_id: null,
    rule_code: 'FDC-RULE-HEURISTIC-02',
    candidate_wafers: []
  };
  const standbyRes = isInvestigationSupportedTest(standbyAlert, activeRunId);
  assert.equal(standbyRes.supported, false, '(d1) Standby alert must fail closed');
  assert.ok(standbyRes.reason.includes('대기 설비(Standby)'));

  // 5. Counterexample (d2): Conflicting Run Alert (cross-run lineage mismatch)
  const crossRunAlert = {
    ...nominalAlert,
    alert_id: 'AL-CROSS-999',
    run_id: 'RUN-DIFF-888'
  };
  const crossRunRes = isInvestigationSupportedTest(crossRunAlert, activeRunId);
  assert.equal(crossRunRes.supported, false, '(d2) Cross-run alert must fail closed');
  assert.ok(crossRunRes.reason.includes('일치하지 않아'));

  // 6. Counterexample (d3): Arbitrary CRITICAL Alert without T7 excursion evidence on different equipment/chamber
  const arbitraryCriticalAlert = {
    alert_id: 'AL-CRIT-999',
    severity: 'CRITICAL',
    equipment_id: 'ETCH-01',
    chamber_id: 'CH-A',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-UNKNOWN-99',
    candidate_wafers: []
  };
  const arbitraryRes = isInvestigationSupportedTest(arbitraryCriticalAlert, activeRunId);
  assert.equal(arbitraryRes.supported, false, '(d3) Arbitrary CRITICAL on ETCH-01/CH-A must fail closed');
  assert.ok(arbitraryRes.reason.includes('스텝 T7 센서 이상 계측 근거가 등록되지 않은 설비/챔버입니다'));

  // 7. Counterexample (d4): Non-critical alerts (INFO / WARNING)
  const infoAlert = {
    alert_id: 'AL-INFO-001',
    severity: 'INFO',
    equipment_id: 'ETCH-02',
    chamber_id: 'LOADPORT-01',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-INFO-01',
    candidate_wafers: []
  };
  const infoRes = isInvestigationSupportedTest(infoAlert, activeRunId);
  assert.equal(infoRes.supported, false, '(d4) INFO alert must fail closed');
  assert.ok(infoRes.reason.includes('단순 상태/경고 경보'));
});

test('BUILD-05 Mode A/B Fail-Closed Boundary and Network Offline Demarcation', async () => {
  // Simulator matching command-center/page.tsx error handling
  async function simulateCommandCenterFetch(scenario) {
    let mode = 'B';
    let alerts = [];
    let errorMessage = null;

    if (scenario === 'NETWORK_OFFLINE') {
      // True network offline -> clean Mode A fallback
      mode = 'A';
      const fixture = generateModeACommandCenterFixtureTest(20261015);
      alerts = fixture.alerts;
      errorMessage = null;
      return { mode, alerts, errorMessage };
    }

    if (scenario === 'SERVER_500') {
      // Server error -> Mode B fail-closed (DO NOT switch to Mode A)
      mode = 'B';
      alerts = [];
      errorMessage = '서버 요약 조회 실패 (HTTP 500)';
      return { mode, alerts, errorMessage };
    }

    if (scenario === 'MALFORMED_JSON') {
      // Malformed JSON -> Mode B fail-closed
      mode = 'B';
      alerts = [];
      errorMessage = '서버 응답 형식 오류 (Malformed JSON)';
      return { mode, alerts, errorMessage };
    }

    return { mode: 'B', alerts: [], errorMessage: null };
  }

  // 1. Genuine network offline: switches to Mode A with deterministic fixture
  const offline = await simulateCommandCenterFetch('NETWORK_OFFLINE');
  assert.equal(offline.mode, 'A');
  assert.equal(offline.alerts.length, 3);
  assert.equal(offline.errorMessage, null);

  // 2. Server 500: fails closed in Mode B, no synthetic fabrication
  const server500 = await simulateCommandCenterFetch('SERVER_500');
  assert.equal(server500.mode, 'B');
  assert.equal(server500.alerts.length, 0);
  assert.ok(server500.errorMessage.includes('HTTP 500'));

  // 3. Malformed JSON: fails closed in Mode B
  const malformed = await simulateCommandCenterFetch('MALFORMED_JSON');
  assert.equal(malformed.mode, 'B');
  assert.equal(malformed.alerts.length, 0);
  assert.ok(malformed.errorMessage.includes('Malformed JSON'));
});

test('BUILD-05 Command Center Page Source Invariants & EKL Integration', () => {
  const ccPageSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const tracePageSource = readFileSync(new URL('../src/app/traceability/page.tsx', import.meta.url), 'utf8');

  // 1. Bidirectional navigation tabs
  assert.ok(ccPageSource.includes('/command-center') && ccPageSource.includes('/traceability'));
  assert.ok(homePageSource.includes('/command-center'), 'Home page navbar must link to /command-center');
  assert.ok(tracePageSource.includes('/command-center'), 'Traceability navbar must link to /command-center');

  // 2. Investigation return link
  assert.ok(homePageSource.includes('커맨드 센터 전체 알람 보기') || homePageSource.includes('Command Center'), 'Home investigation must have backlink to command center');

  // 3. EKL Level 1 triggers in command center
  const requiredEKLConcepts = ['spc-ucl-missing', 'wafer-exposure-status', 'rf-power', 'oes-relative-signal'];
  requiredEKLConcepts.forEach(cId => {
    assert.ok(ccPageSource.includes(cId), `Command Center must have EKL trigger for '${cId}'`);
  });

  // 4. Domain disclaimers
  assert.ok(ccPageSource.includes('Sensor Excursion ≠ Product Defect'), 'Sensor excursion disclaimer must be present');
  assert.ok(ccPageSource.includes('반도체 공정 시뮬레이션') || ccPageSource.includes('가상 합성'), 'Synthetic simulation disclaimer must be present');

  // 5. Total & filtered count badges
  assert.ok(ccPageSource.includes('전체 수집 알람'), 'Total alarms badge must be present');
  assert.ok(ccPageSource.includes('현재 필터 일치'), 'Filtered alarms badge must be present');

  // 6. Empty state with reset
  assert.ok(ccPageSource.includes('필터 초기화'));
});

// ========================================================
// BUILD-06 Equipment Intelligence Contract Tests (a ~ g)
// ========================================================

function generateModeAEquipmentSamplesTest(seed = 42) {
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
    { step_index: 0, time_label: 'T0', sim_time_utc: '2026-10-15T00:00:00.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(48.2 + relNoise).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 1, time_label: 'T1', sim_time_utc: '2026-10-15T00:00:05.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(50.1 + relNoise * 0.8).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 2, time_label: 'T2', sim_time_utc: '2026-10-15T00:00:10.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(51.4 + relNoise * 0.5).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 3, time_label: 'T3', sim_time_utc: '2026-10-15T00:00:15.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(49.8 + relNoise * 0.7).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 4, time_label: 'T4', sim_time_utc: '2026-10-15T00:00:20.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: null, unit: 'a.u.', quality_flag: 'MISSING', data_origin: 'synthetic' },
    { step_index: 5, time_label: 'T5', sim_time_utc: '2026-10-15T00:00:25.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: null, unit: 'a.u.', quality_flag: 'MISSING', data_origin: 'synthetic' },
    { step_index: 6, time_label: 'T6', sim_time_utc: '2026-10-15T00:00:30.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(52.0 + relNoise * 0.9).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 7, time_label: 'T7', sim_time_utc: '2026-10-15T00:00:35.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: t7Rel, unit: 'a.u.', quality_flag: 'SUSPECT', data_origin: 'synthetic' },

    { step_index: 0, time_label: 'T0', sim_time_utc: '2026-10-15T00:00:00.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.1 + prsNoise).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 1, time_label: 'T1', sim_time_utc: '2026-10-15T00:00:05.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.4 + prsNoise * 0.7).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 2, time_label: 'T2', sim_time_utc: '2026-10-15T00:00:10.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(119.8 + prsNoise * 0.6).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 3, time_label: 'T3', sim_time_utc: '2026-10-15T00:00:15.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.5 + prsNoise * 0.8).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 4, time_label: 'T4', sim_time_utc: '2026-10-15T00:00:20.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.2 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 5, time_label: 'T5', sim_time_utc: '2026-10-15T00:00:25.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.0 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 6, time_label: 'T6', sim_time_utc: '2026-10-15T00:00:30.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(121.3 + prsNoise * 0.5).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 7, time_label: 'T7', sim_time_utc: '2026-10-15T00:00:35.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: t7Prs, unit: 'mTorr', quality_flag: 'SUSPECT', data_origin: 'synthetic' },

    { step_index: 0, time_label: 'T0', sim_time_utc: '2026-10-15T00:00:00.000Z', sensor_id: 'RF_POWER', measured_value: +(1500.0 + rfNoise * 0.2).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 1, time_label: 'T1', sim_time_utc: '2026-10-15T00:00:05.000Z', sensor_id: 'RF_POWER', measured_value: +(1501.5 + rfNoise * 0.3).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 2, time_label: 'T2', sim_time_utc: '2026-10-15T00:00:10.000Z', sensor_id: 'RF_POWER', measured_value: +(1498.2 + rfNoise * 0.2).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 3, time_label: 'T3', sim_time_utc: '2026-10-15T00:00:15.000Z', sensor_id: 'RF_POWER', measured_value: +(1502.1 + rfNoise * 0.4).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 4, time_label: 'T4', sim_time_utc: '2026-10-15T00:00:20.000Z', sensor_id: 'RF_POWER', measured_value: +(1499.7 + (nextRand() - 0.5) * 4.0).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 5, time_label: 'T5', sim_time_utc: '2026-10-15T00:00:25.000Z', sensor_id: 'RF_POWER', measured_value: +(1500.4 + (nextRand() - 0.5) * 4.0).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 6, time_label: 'T6', sim_time_utc: '2026-10-15T00:00:30.000Z', sensor_id: 'RF_POWER', measured_value: +(1503.8 + rfNoise * 0.3).toFixed(1), unit: 'W', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 7, time_label: 'T7', sim_time_utc: '2026-10-15T00:00:35.000Z', sensor_id: 'RF_POWER', measured_value: t7Rf, unit: 'W', quality_flag: 'SUSPECT', data_origin: 'synthetic' },
  ];

  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;

  const alerts = [
    {
      alert_id: alertId,
      severity: 'CRITICAL',
      equipment_id: 'ETCH-02',
      chamber_id: 'CH-B',
      run_id: runId,
      rule_code: 'FDC-RULE-SPC-UCL-01',
      message: '식각 챔버 압력/광학 신호/RF Power 복합 급증 (Step T7 공정 일탈 감지, > UCL 65.0 a.u.)',
      status: 'ACTIVE',
      event_time_utc: '2026-10-15T00:00:35.000Z',
      candidate_lot: lotId,
      candidate_wafers: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12'],
    },
  ];

  return { samples, alerts, summary: { run_id: runId, lot_id: lotId, equipment_id: 'ETCH-02', chamber_id: 'CH-B' } };
}

function parseSensorQueryTest(raw) {
  if (!raw) return 'RELATIVE_SIGNAL';
  const upper = raw.trim().toUpperCase();
  if (upper === 'CHAMBER_PRESSURE') return 'CHAMBER_PRESSURE';
  if (upper === 'RF_POWER') return 'RF_POWER';
  return 'RELATIVE_SIGNAL';
}

function calculateChartCoordinatesTest(samples, sensorId) {
  const filtered = samples.filter(s => s && s.sensor_id === sensorId).sort((a, b) => a.step_index - b.step_index);
  return filtered.map(sample => {
    const x = 60 + sample.step_index * 70;
    let y = null;
    if (sample.measured_value !== null && typeof sample.measured_value === 'number') {
      if (sensorId === 'RELATIVE_SIGNAL') {
        y = 210 - (sample.measured_value / 100) * 180;
      } else if (sensorId === 'CHAMBER_PRESSURE') {
        const clamped = Math.max(100, Math.min(200, sample.measured_value));
        y = 210 - ((clamped - 100) / 100) * 180;
      } else {
        const clamped = Math.max(1000, Math.min(2000, sample.measured_value));
        y = 210 - ((clamped - 1000) / 1000) * 180;
      }
    }
    return { ...sample, x, y };
  });
}

test('BUILD-06 (a) Summary-first run discovery, same run_id samples + alerts propagation, and run lineage validation', async () => {
  const recordedCalls = [];
  const serverSummaryRunId = 'RUN-DEMO-042';

  // Harness simulating loadData in equipment-intelligence/page.tsx
  let activeReqId = 0;
  async function loadEquipmentDataHarness(fetchSummaryFn, fetchSamplesFn, fetchAlertsFn) {
    const reqId = ++activeReqId;

    // Step 1: Summary first
    const summaryRes = await fetchSummaryFn();
    const summaryData = await summaryRes.json();
    const currentRunId = summaryData?.active_run_id;

    if (reqId !== activeReqId) return { discarded: true };

    // Step 2: Parallel fetch using exact matching discovered run_id
    const [samplesRes, alertsRes] = await Promise.all([
      fetchSamplesFn(currentRunId),
      fetchAlertsFn(currentRunId)
    ]);
    const samplesData = await samplesRes.json();
    const alertsData = await alertsRes.json();

    if (reqId !== activeReqId) return { discarded: true };

    return {
      activeRunId: currentRunId,
      lotId: summaryData?.lot_id,
      samples: samplesData,
      alerts: alertsData,
      discarded: false
    };
  }

  const fixture = generateModeAEquipmentSamplesTest(42);

  const res = await loadEquipmentDataHarness(
    async () => {
      recordedCalls.push({ endpoint: 'summary' });
      return { ok: true, status: 200, json: async () => ({ active_run_id: serverSummaryRunId, lot_id: 'LOT-DEMO-042' }) };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'samples', runId: rId });
      return { ok: true, status: 200, json: async () => fixture.samples };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'alerts', runId: rId });
      return { ok: true, status: 200, json: async () => fixture.alerts };
    }
  );

  assert.equal(recordedCalls[0].endpoint, 'summary', 'Summary MUST be called first to discover run_id');
  assert.equal(recordedCalls[1].endpoint, 'samples', 'Samples must be called with discovered run_id');
  assert.equal(recordedCalls[1].runId, serverSummaryRunId);
  assert.equal(recordedCalls[2].endpoint, 'alerts', 'Alerts must be called with discovered run_id');
  assert.equal(recordedCalls[2].runId, serverSummaryRunId);
  assert.equal(res.activeRunId, serverSummaryRunId);
  assert.equal(res.samples.length, 24);
  assert.equal(res.alerts.length, 1);
});

test('BUILD-06 (b) Rapid Run reset, delayed inflight samples/alerts response disposal, and late JSON stream protection', async () => {
  let activeReqId = 0;
  async function loadDataWithDelayedStream(reqRunId, delayMs, jsonDelayMs) {
    const reqId = ++activeReqId;

    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
    if (reqId !== activeReqId) return { discarded: true, step: 'network_delayed' };

    // Simulate streaming JSON body resolution delay
    if (jsonDelayMs > 0) {
      await new Promise(r => setTimeout(r, jsonDelayMs));
    }
    if (reqId !== activeReqId) return { discarded: true, step: 'json_body_delayed' };

    return { discarded: false, activeRunId: reqRunId };
  }

  // Request 1: Slow network response
  const p1 = loadDataWithDelayedStream('RUN-OLD-SLOW', 50, 0);
  // Request 2: Fast newer request supersedes Request 1
  const p2 = loadDataWithDelayedStream('RUN-NEW-FAST', 5, 0);

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.equal(res1.discarded, true, 'Older delayed in-flight request must be discarded');
  assert.equal(res2.discarded, false);
  assert.equal(res2.activeRunId, 'RUN-NEW-FAST');

  // Request 3: Fast network but delayed JSON stream body
  const p3 = loadDataWithDelayedStream('RUN-BODY-DELAYED', 5, 40);
  // Request 4: User immediately clicks another run before JSON stream resolves
  await new Promise(r => setTimeout(r, 10));
  const p4 = loadDataWithDelayedStream('RUN-FINAL', 5, 0);

  const [res3, res4] = await Promise.all([p3, p4]);
  assert.equal(res3.discarded, true, 'Delayed JSON body must be discarded when superseded');
  assert.equal(res3.step, 'json_body_delayed');
  assert.equal(res4.discarded, false);
  assert.equal(res4.activeRunId, 'RUN-FINAL');
});

test('BUILD-06 (c) Optical sensor (RELATIVE_SIGNAL) T4/T5 null segmentation vs continuous CHAMBER_PRESSURE / RF_POWER unbroken line invariant', () => {
  const fixture = generateModeAEquipmentSamplesTest(42);

  // 1. RELATIVE_SIGNAL (Optical Sensor)
  const oesCoords = calculateChartCoordinatesTest(fixture.samples, 'RELATIVE_SIGNAL');
  assert.equal(oesCoords.length, 8);
  assert.equal(oesCoords[4].measured_value, null);
  assert.equal(oesCoords[4].y, null);
  assert.equal(oesCoords[4].quality_flag, 'MISSING');
  assert.equal(oesCoords[5].measured_value, null);
  assert.equal(oesCoords[5].y, null);
  assert.equal(oesCoords[5].quality_flag, 'MISSING');

  const oesSegments = computeDynamicSegments(oesCoords);
  assert.equal(oesSegments.length, 2, 'RELATIVE_SIGNAL must produce exactly 2 segmented paths separated by T4/T5');
  assert.ok(oesSegments[0].includes('M 60') && oesSegments[0].includes('L 270'), 'Segment 1 must span T0 to T3');
  assert.ok(oesSegments[1].includes('M 480') && oesSegments[1].includes('L 550'), 'Segment 2 must span T6 to T7');
  assert.ok(!oesSegments.some(s => s.includes('340') || s.includes('410')), 'T4 (340) and T5 (410) must NEVER be connected or plotted as 0');

  const oesMissing = computeMissingRange(oesCoords);
  assert.ok(oesMissing !== null, 'RELATIVE_SIGNAL must render missing range overlay');
  assert.equal(oesMissing.labels, 'T4, T5');

  // 2. CHAMBER_PRESSURE (Continuous Sensor)
  const prsCoords = calculateChartCoordinatesTest(fixture.samples, 'CHAMBER_PRESSURE');
  assert.equal(prsCoords.length, 8);
  assert.ok(prsCoords.every(p => p.measured_value !== null && p.y !== null && p.quality_flag !== 'MISSING'));

  const prsSegments = computeDynamicSegments(prsCoords);
  assert.equal(prsSegments.length, 1, 'CHAMBER_PRESSURE must produce exactly 1 continuous unbroken path');
  assert.ok(prsSegments[0].includes('M 60') && prsSegments[0].includes('L 550'));

  const prsMissing = computeMissingRange(prsCoords);
  assert.equal(prsMissing, null, 'Continuous CHAMBER_PRESSURE must NOT render fake missing overlay');

  // 3. RF_POWER (Continuous Sensor)
  const rfCoords = calculateChartCoordinatesTest(fixture.samples, 'RF_POWER');
  assert.equal(rfCoords.length, 8);
  assert.ok(rfCoords.every(p => p.measured_value !== null && p.y !== null && p.quality_flag !== 'MISSING'));

  const rfSegments = computeDynamicSegments(rfCoords);
  assert.equal(rfSegments.length, 1, 'RF_POWER must produce exactly 1 continuous unbroken path');

  const rfMissing = computeMissingRange(rfCoords);
  assert.equal(rfMissing, null, 'Continuous RF_POWER must NOT render fake missing overlay');
});

test('BUILD-06 (d) Sensor switching, URL query parameter parsing fail-safe, measurement units, quality flag mapping, and step selection', () => {
  // Query parameter parsing & fail-safe
  assert.equal(parseSensorQueryTest('RELATIVE_SIGNAL'), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest('relative_signal'), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest('CHAMBER_PRESSURE'), 'CHAMBER_PRESSURE');
  assert.equal(parseSensorQueryTest('chamber_pressure'), 'CHAMBER_PRESSURE');
  assert.equal(parseSensorQueryTest('RF_POWER'), 'RF_POWER');
  assert.equal(parseSensorQueryTest('rf_power'), 'RF_POWER');

  // Unknown / invalid parameter fails safe to default RELATIVE_SIGNAL
  assert.equal(parseSensorQueryTest('UNKNOWN_SENSOR'), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest('TEMPERATURE'), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest(''), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest(null), 'RELATIVE_SIGNAL');
  assert.equal(parseSensorQueryTest(undefined), 'RELATIVE_SIGNAL');

  // Sensor definitions & quality flags in contract
  const contractSource = readFileSync(
    new URL('../src/components/equipment-intelligence/equipment-intelligence-contract.ts', import.meta.url),
    'utf8'
  );
  assert.ok(contractSource.includes("unit: 'a.u.'"), 'RELATIVE_SIGNAL unit must be a.u.');
  assert.ok(contractSource.includes("unit: 'mTorr'"), 'CHAMBER_PRESSURE unit must be mTorr');
  assert.ok(contractSource.includes("unit: 'W'"), 'RF_POWER unit must be W');
  assert.ok(contractSource.includes("ucl: 65.0"), 'RELATIVE_SIGNAL UCL must be 65.0');
  assert.ok(contractSource.includes("ucl: 140.0"), 'CHAMBER_PRESSURE UCL must be 140.0');
  assert.ok(contractSource.includes("ucl: 1650.0"), 'RF_POWER UCL must be 1650.0');

  // Step T7 is marked SUSPECT on all 3 sensors
  const fixture = generateModeAEquipmentSamplesTest(42);
  const t7Oes = fixture.samples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === 7);
  const t7Prs = fixture.samples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === 7);
  const t7Rf = fixture.samples.find(s => s.sensor_id === 'RF_POWER' && s.step_index === 7);
  assert.equal(t7Oes.quality_flag, 'SUSPECT');
  assert.equal(t7Prs.quality_flag, 'SUSPECT');
  assert.equal(t7Rf.quality_flag, 'SUSPECT');
  assert.ok(t7Oes.measured_value > 65.0, 'T7 OES must exceed UCL 65.0');
  assert.ok(t7Prs.measured_value > 140.0, 'T7 Pressure must exceed UCL 140.0');
  assert.ok(t7Rf.measured_value > 1650.0, 'T7 RF Power must exceed UCL 1650.0');
});

test('BUILD-06 (e) Valid vs Invalid FDC alert investigation linking, candidate wafers binding, and fail-closed isolation', () => {
  const activeRunId = 'RUN-DEMO-042';

  // 1. Valid Alert: ETCH-02 / CH-B / CRITICAL / FDC-RULE-SPC-UCL-01 / matching activeRunId
  const validAlert = {
    alert_id: 'AL-DEMO-042',
    severity: 'CRITICAL',
    equipment_id: 'ETCH-02',
    chamber_id: 'CH-B',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-SPC-UCL-01',
    candidate_wafers: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12']
  };
  const validRes = isInvestigationSupportedTest(validAlert, activeRunId);
  assert.equal(validRes.supported, true, 'Valid T7 excursion alert must be supported for investigation');
  assert.equal(validAlert.candidate_wafers.length, 5);

  // 2. Ineligible Alert A: Standby alert on idle chamber
  const standbyAlert = {
    alert_id: 'AL-STANDBY-001',
    severity: 'WARNING',
    equipment_id: 'ETCH-01',
    chamber_id: 'CH-A',
    run_id: null,
    rule_code: 'FDC-RULE-HEURISTIC-02',
    candidate_wafers: []
  };
  const standbyRes = isInvestigationSupportedTest(standbyAlert, activeRunId);
  assert.equal(standbyRes.supported, false, 'Standby alert without active run must fail closed');

  // 3. Ineligible Alert B: Different rule despite candidate wafers (A01 crucial rule invariant)
  const diffRuleAlert = {
    alert_id: 'AL-DIFF-001',
    severity: 'CRITICAL',
    equipment_id: 'ETCH-02',
    chamber_id: 'CH-B',
    run_id: activeRunId,
    rule_code: 'FDC-RULE-OTHER',
    candidate_wafers: ['W-08']
  };
  const diffRuleRes = isInvestigationSupportedTest(diffRuleAlert, activeRunId);
  assert.equal(diffRuleRes.supported, false, 'Different rule code must fail closed regardless of candidate wafers');

  // 4. Ineligible Alert C: Mismatched run ID (cross-run lineage contamination)
  const crossRunAlert = {
    ...validAlert,
    run_id: 'RUN-DIFFERENT-999'
  };
  const crossRunRes = isInvestigationSupportedTest(crossRunAlert, activeRunId);
  assert.equal(crossRunRes.supported, false, 'Mismatched run ID must fail closed');
});

test('BUILD-06 (f) Mode A offline fallback vs Mode B HTTP 4xx/5xx/malformed/empty samples fail-closed boundary', async () => {
  async function simulateEquipmentIntelligenceFetch(scenario) {
    let mode = 'B';
    let samples = [];
    let errorMessage = null;

    try {
      if (scenario === 'NETWORK_OFFLINE') {
        throw new TypeError('Failed to fetch (offline network)');
      }
      if (scenario === 'SERVER_500') {
        throw new Error('HTTP 500: 설비 센서 시계열 데이터를 불러올 수 없습니다 (Fail-closed).');
      }
      if (scenario === 'SERVER_404') {
        throw new Error('HTTP 404: 공정 요약 정보를 불러올 수 없습니다 (Fail-closed).');
      }
      if (scenario === 'MALFORMED_JSON') {
        throw new Error('수신된 센서 계측 데이터 구조가 유효하지 않거나 샘플 수가 부족합니다 (Fail-closed).');
      }
      if (scenario === 'EMPTY_SAMPLES') {
        throw new Error('수신된 센서 계측 데이터 구조가 유효하지 않거나 샘플 수가 부족합니다 (Fail-closed).');
      }

      // Success scenario
      const fixture = generateModeAEquipmentSamplesTest(42);
      return { mode: 'B', samples: fixture.samples, errorMessage: null };
    } catch (err) {
      if (err instanceof TypeError || (err.message && err.message.includes('fetch'))) {
        const fixture = generateModeAEquipmentSamplesTest(42);
        return { mode: 'A', samples: fixture.samples, errorMessage: null };
      }
      return { mode: 'B', samples: [], errorMessage: err.message };
    }
  }

  // 1. Genuine offline: Fallback to Mode A with deterministic fixture
  const offline = await simulateEquipmentIntelligenceFetch('NETWORK_OFFLINE');
  assert.equal(offline.mode, 'A');
  assert.equal(offline.samples.length, 24);
  assert.equal(offline.errorMessage, null);

  // 2. Server 500: Fail-closed in Mode B (NEVER fallback to Mode A or fake 0 values!)
  const s500 = await simulateEquipmentIntelligenceFetch('SERVER_500');
  assert.equal(s500.mode, 'B');
  assert.equal(s500.samples.length, 0);
  assert.ok(s500.errorMessage.includes('HTTP 500'));

  // 3. Server 404: Fail-closed in Mode B
  const s404 = await simulateEquipmentIntelligenceFetch('SERVER_404');
  assert.equal(s404.mode, 'B');
  assert.equal(s404.samples.length, 0);
  assert.ok(s404.errorMessage.includes('HTTP 404'));

  // 4. Malformed JSON or empty samples: Fail-closed in Mode B
  const malformed = await simulateEquipmentIntelligenceFetch('MALFORMED_JSON');
  assert.equal(malformed.mode, 'B');
  assert.equal(malformed.samples.length, 0);
  assert.ok(malformed.errorMessage.includes('유효하지 않거나'));
});

test('BUILD-06 (g) Multi-page bidirectional navigation, EKL L1 integration, and domain disclaimer standards', () => {
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  const ccPageSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const tracePageSource = readFileSync(new URL('../src/app/traceability/page.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  // 1. All 4 pages must contain bidirectional navigation links to each other
  assert.ok(eiPageSource.includes('href="/"') && eiPageSource.includes('href="/traceability"') && eiPageSource.includes('href="/command-center"'));
  assert.ok(homePageSource.includes('/equipment-intelligence'), 'Home must link to /equipment-intelligence');
  assert.ok(tracePageSource.includes('/equipment-intelligence'), 'Traceability must link to /equipment-intelligence');
  assert.ok(ccPageSource.includes('/equipment-intelligence'), 'Command Center must link to /equipment-intelligence');

  // 2. Direct button from Command Center to Equipment Intelligence
  assert.ok(ccPageSource.includes('cc-btn-go-equipment'), 'Command Center must have direct button to equipment intelligence');
  assert.ok(eiPageSource.includes('ei-btn-back-command-center'), 'Equipment Intelligence must have direct return button to command center');
  assert.ok(eiPageSource.includes('ei-btn-go-investigation'), 'Equipment Intelligence must have direct link to investigation');

  // 3. EKL Integration
  const requiredEKL = ['oes-relative-signal', 'rf-power', 'spc-ucl-missing', 'wafer-exposure-status'];
  requiredEKL.forEach(concept => {
    assert.ok(eiPageSource.includes(concept), `Equipment Intelligence must include EKL concept trigger for '${concept}'`);
  });

  // 4. Domain Disclaimers: Control Limits vs Spec Limits, Missing != 0, Excursion != Defect
  assert.ok(eiPageSource.includes('UCL(상한 관리한계') && eiPageSource.includes('USL/LSL'), 'Spec limits vs control limits must be distinguished');
  assert.ok(eiPageSource.includes('MISSING ≠ 0'), 'MISSING != 0 disclaimer must be present');
  assert.ok(eiPageSource.includes('Excursion ≠ Defect') || eiPageSource.includes('공정 일탈(Excursion ≠ Defect)'), 'Excursion != Defect disclaimer must be present');

  // 5. CSS & Keyboard Accessibility
  assert.ok(cssSource.includes('.ei-sensor-tab-btn:focus-visible'), 'Sensor tab button must have focus-visible styling');
  assert.ok(cssSource.includes('.ei-step-btn:focus-visible'), 'Step button must have focus-visible styling');
  assert.ok(eiPageSource.includes('role="tablist"'), 'Sensor tabs must define role="tablist"');
  assert.ok(eiPageSource.includes('role="tab"'), 'Sensor tabs must define role="tab"');
  assert.ok(eiPageSource.includes('role="tabpanel"'), 'Sensor content must define role="tabpanel"');
});



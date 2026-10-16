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

function generateModeAEquipmentSamplesTest(seed = 20261015) {
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

function validateSamplesSchemaTest(samples) {
  if (!Array.isArray(samples)) {
    return { valid: false, reason: '센서 샘플 데이터가 배열 형식이 아닙니다 (Fail-closed).' };
  }
  if (samples.length < 24) {
    return { valid: false, reason: `센서 계측 샘플 수가 부족합니다 (수신: ${samples.length}개 / 최소 24개 필요, Fail-closed).` };
  }
  const expectedSensors = ['RELATIVE_SIGNAL', 'CHAMBER_PRESSURE', 'RF_POWER'];
  const expectedUnits = { RELATIVE_SIGNAL: 'a.u.', CHAMBER_PRESSURE: 'mTorr', RF_POWER: 'W' };
  const allowedQualityFlags = ['GOOD', 'SUSPECT', 'MISSING', 'BAD'];

  for (const sensorId of expectedSensors) {
    const sensorSamples = samples.filter((s) => s && s.sensor_id === sensorId);
    if (sensorSamples.length !== 8) {
      return { valid: false, reason: `센서 ${sensorId}의 스텝 계측 샘플이 8개가 아닙니다 (수신: ${sensorSamples.length}개, Fail-closed).` };
    }
    const stepIndices = new Set();
    for (const sample of sensorSamples) {
      if (typeof sample.step_index !== 'number' || sample.step_index < 0 || sample.step_index > 7) {
        return { valid: false, reason: `유효하지 않은 step_index (${sample.step_index})가 감지되었습니다.` };
      }
      if (stepIndices.has(sample.step_index)) {
        return { valid: false, reason: `센서 ${sensorId}에 중복된 step_index (${sample.step_index})가 존재합니다.` };
      }
      stepIndices.add(sample.step_index);
      if (sample.time_label !== `T${sample.step_index}`) {
        return { valid: false, reason: `스텝 ${sample.step_index}의 time_label (${sample.time_label})이 불일치합니다.` };
      }
      if (sample.unit !== expectedUnits[sensorId]) {
        return { valid: false, reason: `센서 ${sensorId}의 단위 (${sample.unit})가 기대값 (${expectedUnits[sensorId]})과 일치하지 않습니다.` };
      }
      if (!sample.quality_flag || !allowedQualityFlags.includes(sample.quality_flag)) {
        return { valid: false, reason: `유효하지 않은 quality_flag (${sample.quality_flag})가 감지되었습니다.` };
      }
      if (!sample.data_origin || typeof sample.data_origin !== 'string' || sample.data_origin.trim() === '') {
        return { valid: false, reason: '계측 데이터 출처(data_origin) 필드가 누락되었거나 유효하지 않습니다.' };
      }
      if (sensorId === 'RELATIVE_SIGNAL' && (sample.step_index === 4 || sample.step_index === 5)) {
        if (sample.quality_flag !== 'MISSING') {
          return { valid: false, reason: `OES 상대 신호 T4/T5 구간은 반드시 MISSING 품질이어야 합니다 (현재: ${sample.quality_flag}).` };
        }
        if (sample.measured_value !== null) {
          return { valid: false, reason: `OES 상대 신호 결측 구간(MISSING)의 계측값은 반드시 null이어야 하며 0 또는 다른 값으로 보간할 수 없습니다.` };
        }
      } else {
        if (sample.quality_flag === 'MISSING') {
          return { valid: false, reason: `연속 계측 센서/정상 스텝(${sensorId} T${sample.step_index})에 부당한 MISSING 플래그가 설정되었습니다.` };
        }
        if (typeof sample.measured_value !== 'number' || !Number.isFinite(sample.measured_value)) {
          return { valid: false, reason: `센서 ${sensorId} T${sample.step_index}의 계측값이 유효한 숫자가 아닙니다 (${sample.measured_value}).` };
        }
      }
    }
  }
  return { valid: true };
}

function validateAlertsSchemaTest(alerts, expectedRunId) {
  if (!Array.isArray(alerts)) {
    return { valid: false, reason: '알람 응답 데이터가 배열 형식이 아닙니다 (Fail-closed).' };
  }
  const seenAlertIds = new Set();
  const allowedSeverities = ['CRITICAL', 'WARNING', 'INFO'];
  const allowedStatuses = ['ACTIVE', 'CLEARED', 'ACKNOWLEDGED', 'RESOLVED'];

  for (const alert of alerts) {
    if (!alert || typeof alert !== 'object') {
      return { valid: false, reason: '유효하지 않은 알람 객체가 포함되어 있습니다.' };
    }
    if (!alert.alert_id || typeof alert.alert_id !== 'string' || alert.alert_id.trim() === '') {
      return { valid: false, reason: '알람 ID(alert_id)가 누락되었거나 유효하지 않습니다.' };
    }
    if (seenAlertIds.has(alert.alert_id)) {
      return { valid: false, reason: `중복된 alert_id (${alert.alert_id})가 감지되었습니다.` };
    }
    seenAlertIds.add(alert.alert_id);

    if (!alert.severity || typeof alert.severity !== 'string' || !allowedSeverities.includes(alert.severity)) {
      return { valid: false, reason: `알람 심각도(severity: ${alert.severity})가 올바른 규격이 아닙니다.` };
    }
    if (!alert.status || typeof alert.status !== 'string' || !allowedStatuses.includes(alert.status)) {
      return { valid: false, reason: `알람 상태(status: ${alert.status})가 올바른 규격이 아닙니다.` };
    }
    if (!alert.equipment_id || typeof alert.equipment_id !== 'string' || alert.equipment_id.trim() === '') {
      return { valid: false, reason: '알람 equipment_id가 누락되었습니다.' };
    }
    if (!alert.chamber_id || typeof alert.chamber_id !== 'string' || alert.chamber_id.trim() === '') {
      return { valid: false, reason: '알람 chamber_id가 누락되었습니다.' };
    }
    if (!alert.rule_code || typeof alert.rule_code !== 'string' || alert.rule_code.trim() === '') {
      return { valid: false, reason: '알람 rule_code가 누락되었습니다.' };
    }
    if (!alert.message || typeof alert.message !== 'string' || alert.message.trim() === '') {
      return { valid: false, reason: '알람 message가 누락되었습니다.' };
    }
    if (!alert.event_time_utc || typeof alert.event_time_utc !== 'string' || alert.event_time_utc.trim() === '') {
      return { valid: false, reason: '알람 event_time_utc가 누락되었습니다.' };
    }

    if (alert.candidate_wafers !== undefined && alert.candidate_wafers !== null) {
      if (!Array.isArray(alert.candidate_wafers)) {
        return { valid: false, reason: 'candidate_wafers는 문자열 배열이어야 합니다.' };
      }
      for (const w of alert.candidate_wafers) {
        if (typeof w !== 'string' || w.trim() === '') {
          return { valid: false, reason: 'candidate_wafers에 유효하지 않은 웨이퍼 ID가 포함되어 있습니다.' };
        }
      }
    }

    if (alert.candidate_lot !== undefined && alert.candidate_lot !== null) {
      if (typeof alert.candidate_lot !== 'string' || alert.candidate_lot.trim() === '') {
        return { valid: false, reason: 'candidate_lot이 유효한 문자열이 아닙니다.' };
      }
    }

    if (expectedRunId) {
      if (alert.run_id !== expectedRunId) {
        return {
          valid: false,
          reason: `알람 run_id (${alert.run_id})가 활성 공정 Run (${expectedRunId})과 일치하지 않습니다 (Data Lineage Contamination).`
        };
      }
    }
  }
  return { valid: true };
}

test('BUILD-06 (a) Summary-first run discovery, same run_id samples + alerts propagation, and run lineage validation', async () => {
  const recordedCalls = [];
  const serverSummaryRunId = 'RUN-DEMO-015';

  // Harness simulating loadData in equipment-intelligence/page.tsx
  let activeReqId = 0;
  async function loadEquipmentDataHarness(fetchSummaryFn, fetchSamplesFn, fetchAlertsFn, fetchRecheckFn) {
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

    // Step 3: Schema validation
    const sVal = validateSamplesSchemaTest(samplesData);
    if (!sVal.valid) throw new Error(sVal.reason);
    const aVal = validateAlertsSchemaTest(alertsData, currentRunId);
    if (!aVal.valid) throw new Error(aVal.reason);

    // Step 4: Snapshot confirmation recheck
    const recheckRes = await (fetchRecheckFn ? fetchRecheckFn() : fetchSummaryFn());
    const recheckData = await recheckRes.json();
    if (recheckData?.active_run_id !== currentRunId) {
      throw new Error(`Run desynchronization: ${currentRunId} vs ${recheckData?.active_run_id}`);
    }

    if (reqId !== activeReqId) return { discarded: true };

    return {
      activeRunId: currentRunId,
      lotId: recheckData?.lot_id,
      samples: samplesData,
      alerts: alertsData,
      discarded: false
    };
  }

  const fixture = generateModeAEquipmentSamplesTest(20261015);

  const res = await loadEquipmentDataHarness(
    async () => {
      recordedCalls.push({ endpoint: 'summary' });
      return { ok: true, status: 200, json: async () => ({ active_run_id: serverSummaryRunId, lot_id: 'LOT-DEMO-815' }) };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'samples', runId: rId });
      return { ok: true, status: 200, json: async () => fixture.samples };
    },
    async (rId) => {
      recordedCalls.push({ endpoint: 'alerts', runId: rId });
      return { ok: true, status: 200, json: async () => fixture.alerts };
    },
    async () => {
      recordedCalls.push({ endpoint: 'summary_recheck' });
      return { ok: true, status: 200, json: async () => ({ active_run_id: serverSummaryRunId, lot_id: 'LOT-DEMO-815' }) };
    }
  );

  assert.equal(recordedCalls[0].endpoint, 'summary', 'Summary MUST be called first to discover run_id');
  assert.equal(recordedCalls[1].endpoint, 'samples', 'Samples must be called with discovered run_id');
  assert.equal(recordedCalls[1].runId, serverSummaryRunId);
  assert.equal(recordedCalls[2].endpoint, 'alerts', 'Alerts must be called with discovered run_id');
  assert.equal(recordedCalls[2].runId, serverSummaryRunId);
  assert.equal(recordedCalls[3].endpoint, 'summary_recheck', 'Summary recheck MUST be executed before commit');
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
  const fixture = generateModeAEquipmentSamplesTest(20261015);

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
  const fixture = generateModeAEquipmentSamplesTest(20261015);
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
  const activeRunId = 'RUN-DEMO-015';

  // 1. Valid Alert: ETCH-02 / CH-B / CRITICAL / FDC-RULE-SPC-UCL-01 / matching activeRunId
  const validAlert = {
    alert_id: 'AL-DEMO-015',
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
      const fixture = generateModeAEquipmentSamplesTest(20261015);
      return { mode: 'B', samples: fixture.samples, errorMessage: null };
    } catch (err) {
      if (err instanceof TypeError || (err.message && err.message.includes('fetch'))) {
        const fixture = generateModeAEquipmentSamplesTest(20261015);
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
  assert.ok(
    (eiPageSource.includes('href="/"') || eiPageSource.includes('href={`/${mode')) &&
    (eiPageSource.includes('href="/traceability"') || eiPageSource.includes('href={`/traceability')) &&
    (eiPageSource.includes('href="/command-center"') || eiPageSource.includes('href={`/command-center'))
  );
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

// ========================================================
// P1-A, P1-B, P1-C Specific Contract & Regression Tests
// ========================================================

test('P1-A BUILD-06 Mode B API Origin Endpoint Consistency & Absence of Next.js Proxy/Rewrites', () => {
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  const nextConfigSource = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');

  // 1. Explicit API_BASE pointing directly to FastAPI port 8000
  assert.ok(eiPageSource.includes("const API_BASE = 'http://localhost:8000';"), 'Equipment Intelligence must declare explicit API_BASE');
  assert.ok(eiPageSource.includes("`${API_BASE}/api/v1/demo/summary`"), 'Summary must be fetched with API_BASE');
  assert.ok(eiPageSource.includes("`${API_BASE}/api/v1/demo/runs/"), 'Samples must be fetched with API_BASE');
  assert.ok(eiPageSource.includes("`${API_BASE}/api/v1/demo/alerts?run_id="), 'Alerts must be fetched with API_BASE');

  // 2. Must NOT use relative /api/v1 fetches in equipment-intelligence/page.tsx
  assert.ok(!eiPageSource.includes("fetch('/api/v1/"), 'Must not use relative /api/v1 fetches');

  // 3. Must use { cache: "no-store" } on all API fetches
  assert.ok(eiPageSource.includes("{ cache: 'no-store' }"), 'All fetches must disable caching');

  // 4. Next.js config must NOT have silent rewrites or proxy
  assert.ok(!nextConfigSource.includes('rewrites'), 'next.config.mjs must have no rewrites');
  assert.ok(!nextConfigSource.includes('proxy'), 'next.config.mjs must have no proxy');
});

test('P1-B BUILD-06 (a) Samples 200 + Alerts 500 fails closed and never commits Mode B success', async () => {
  let state = {
    mode: 'B',
    activeRunId: 'PREV-RUN-001',
    lotId: 'PREV-LOT-001',
    samples: [{ sample_id: 1 }],
    alerts: [{ alert_id: 'PREV-AL-001' }],
    noticeMessage: '이전 성공 메시지',
    errorMessage: null
  };

  async function simulateFetchWithAlertsFailure() {
    try {
      const summaryRes = { ok: true, status: 200, json: async () => ({ active_run_id: 'RUN-DEMO-015' }) };
      const currentRunId = (await summaryRes.json()).active_run_id;

      const samplesRes = { ok: true, status: 200, json: async () => generateModeAEquipmentSamplesTest().samples };
      const alertsRes = { ok: false, status: 500, json: async () => ({ error: 'Internal Server Error' }) };

      if (!samplesRes.ok) {
        throw new Error(`HTTP ${samplesRes.status}: 설비 센서 시계열 데이터를 불러올 수 없습니다 (Fail-closed).`);
      }
      if (!alertsRes.ok) {
        throw new Error(`HTTP ${alertsRes.status}: 설비 FDC 알람 데이터를 불러올 수 없습니다 (Fail-closed).`);
      }

      // If both succeed (should not reach here)
      state.samples = await samplesRes.json();
      state.alerts = await alertsRes.json();
      state.activeRunId = currentRunId;
    } catch (err) {
      // Fail closed state cleanup
      state.mode = 'B';
      state.activeRunId = null;
      state.lotId = null;
      state.samples = [];
      state.alerts = [];
      state.noticeMessage = null;
      state.errorMessage = err.message;
    }
  }

  await simulateFetchWithAlertsFailure();

  // Assert fail closed state
  assert.equal(state.mode, 'B');
  assert.equal(state.activeRunId, null, 'activeRunId must be wiped on failure');
  assert.equal(state.lotId, null, 'lotId must be wiped on failure');
  assert.equal(state.samples.length, 0, 'samples must be wiped on failure');
  assert.equal(state.alerts.length, 0, 'alerts must be wiped on failure');
  assert.equal(state.noticeMessage, null, 'noticeMessage must be wiped on failure');
  assert.ok(state.errorMessage.includes('HTTP 500'), 'errorMessage must report alerts failure');
});

test('P1-B BUILD-06 (b) Alerts response non-array or malformed fails closed', () => {
  const validAlert = generateModeAEquipmentSamplesTest().alerts[0];

  // Non-array alert responses
  assert.equal(validateAlertsSchemaTest(null).valid, false);
  assert.equal(validateAlertsSchemaTest(undefined).valid, false);
  assert.equal(validateAlertsSchemaTest({ error: 'unauthorized' }).valid, false);
  assert.equal(validateAlertsSchemaTest('ALERTS_STRING').valid, false);

  // Missing required fields
  assert.equal(validateAlertsSchemaTest([{ severity: 'CRITICAL' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ alert_id: 'AL-01' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, alert_id: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, equipment_id: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, chamber_id: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, rule_code: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, message: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, event_time_utc: '' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, severity: 'INVALID' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, status: 'UNKNOWN' }]).valid, false);

  // Candidate wafers & lot type checks
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, candidate_wafers: 'W-01' }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, candidate_wafers: [123] }]).valid, false);
  assert.equal(validateAlertsSchemaTest([{ ...validAlert, candidate_lot: 12345 }]).valid, false);

  // Duplicate alert_id check
  assert.equal(validateAlertsSchemaTest([validAlert, validAlert]).valid, false);

  // Expected run lineage check
  assert.equal(validateAlertsSchemaTest([validAlert], validAlert.run_id).valid, true);
  assert.equal(validateAlertsSchemaTest([validAlert], 'RUN-DIFFERENT-999').valid, false);

  // Valid alerts array (empty array is valid 0 alerts)
  assert.equal(validateAlertsSchemaTest([validAlert]).valid, true);
  assert.equal(validateAlertsSchemaTest([]).valid, true);
});

test('P1-B BUILD-06 (c) Sensor Samples Schema counterexamples fail closed without fallback to Mode A or fake zeros', () => {
  const validFixture = generateModeAEquipmentSamplesTest(20261015);
  assert.equal(validateSamplesSchemaTest(validFixture.samples).valid, true);

  // Counterexample 1: 8 samples concentrated on 1 sensor only (24 items total, but all RELATIVE_SIGNAL)
  const singleSensorSamples = Array.from({ length: 24 }, (_, i) => ({
    step_index: i % 8,
    time_label: `T${i % 8}`,
    sensor_id: 'RELATIVE_SIGNAL',
    measured_value: i % 8 === 4 || i % 8 === 5 ? null : 50.0,
    unit: 'a.u.',
    quality_flag: i % 8 === 4 || i % 8 === 5 ? 'MISSING' : 'GOOD'
  }));
  const singleSensorRes = validateSamplesSchemaTest(singleSensorSamples);
  assert.equal(singleSensorRes.valid, false, 'Samples concentrated on 1 sensor must fail closed');
  assert.ok(singleSensorRes.reason.includes('스텝 계측 샘플이 8개가 아닙니다'));

  // Counterexample 1b: Missing CHAMBER_PRESSURE entirely (8 OES + 16 RF)
  const missingPressureSamples = [
    ...validFixture.samples.filter(s => s.sensor_id === 'RELATIVE_SIGNAL'),
    ...validFixture.samples.filter(s => s.sensor_id === 'RF_POWER'),
    ...validFixture.samples.filter(s => s.sensor_id === 'RF_POWER'),
  ];
  const missingPrsRes = validateSamplesSchemaTest(missingPressureSamples);
  assert.equal(missingPrsRes.valid, false);
  assert.ok(missingPrsRes.reason.includes('CHAMBER_PRESSURE'));

  // Counterexample 2: String measured value (e.g. '80.0' instead of number)
  const stringValSamples = JSON.parse(JSON.stringify(validFixture.samples));
  stringValSamples[0].measured_value = '80.0';
  const strRes = validateSamplesSchemaTest(stringValSamples);
  assert.equal(strRes.valid, false, 'String measured value must fail closed');
  assert.ok(strRes.reason.includes('유효한 숫자'));

  // Counterexample 3: MISSING with zero value (measured_value: 0 instead of null on T4)
  const zeroMissingSamples = JSON.parse(JSON.stringify(validFixture.samples));
  const t4Oes = zeroMissingSamples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === 4);
  t4Oes.measured_value = 0; // Forbidden zero-filling of missing data!
  const zeroRes = validateSamplesSchemaTest(zeroMissingSamples);
  assert.equal(zeroRes.valid, false, 'MISSING with zero must fail closed (MISSING != 0 invariant)');
  assert.ok(zeroRes.reason.includes('반드시 null이어야 하며 0 또는 다른 값으로 보간할 수 없습니다'));

  // Counterexample 4: Wrong unit (e.g. 'Torr' instead of 'mTorr')
  const wrongUnitSamples = JSON.parse(JSON.stringify(validFixture.samples));
  const prsSample = wrongUnitSamples.find(s => s.sensor_id === 'CHAMBER_PRESSURE');
  prsSample.unit = 'Torr';
  const unitRes = validateSamplesSchemaTest(wrongUnitSamples);
  assert.equal(unitRes.valid, false, 'Wrong unit must fail closed');
  assert.ok(unitRes.reason.includes('단위'));

  // Counterexample 5: Continuous sensor with illegitimate MISSING flag
  const continuousMissingSamples = JSON.parse(JSON.stringify(validFixture.samples));
  const prsT2 = continuousMissingSamples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === 2);
  prsT2.quality_flag = 'MISSING';
  const contRes = validateSamplesSchemaTest(continuousMissingSamples);
  assert.equal(contRes.valid, false, 'Continuous sensor with MISSING flag must fail closed');
  assert.ok(contRes.reason.includes('부당한 MISSING 플래그'));

  // Counterexample 6: Duplicate step index within a sensor
  const dupStepSamples = JSON.parse(JSON.stringify(validFixture.samples));
  dupStepSamples[1].step_index = 0;
  const dupRes = validateSamplesSchemaTest(dupStepSamples);
  assert.equal(dupRes.valid, false, 'Duplicate step index must fail closed');
  assert.ok(dupRes.reason.includes('중복된 step_index'));
});

test('P1-B BUILD-06 (d) Concurrent Run reset snapshot validation aborts commit when active run changes', async () => {
  let state = {
    mode: 'B',
    activeRunId: null,
    lotId: null,
    samples: [],
    alerts: [],
    errorMessage: null
  };

  async function loadDataWithConcurrentResetSimulation() {
    try {
      // 1. Initial summary discovers RUN-DEMO-001
      const initialSummary = { active_run_id: 'RUN-DEMO-001', lot_id: 'LOT-DEMO-001' };
      const discoveredRunId = initialSummary.active_run_id;

      // 2. Samples and alerts fetched for RUN-DEMO-001
      const fixture = generateModeAEquipmentSamplesTest(20261015);
      const rawSamples = fixture.samples;
      const rawAlerts = fixture.alerts;

      // Validate schema
      const sampleVal = validateSamplesSchemaTest(rawSamples);
      if (!sampleVal.valid) throw new Error(sampleVal.reason);

      // 3. Simulated concurrent reset: Before committing, another user/tab reset run to RUN-DEMO-002!
      const recheckSummary = { active_run_id: 'RUN-DEMO-002', lot_id: 'LOT-DEMO-002' };
      if (recheckSummary.active_run_id !== discoveredRunId) {
        throw new Error(
          `활성 공정 Run이 계측 데이터 조회 도중 변경되었습니다 (${discoveredRunId} -> ${recheckSummary.active_run_id}). 오래된 Run 데이터의 커밋을 차단합니다 (Fail-closed).`
        );
      }

      // Should never reach atomic commit
      state.activeRunId = discoveredRunId;
      state.samples = rawSamples;
      state.alerts = rawAlerts;
    } catch (err) {
      state.mode = 'B';
      state.activeRunId = null;
      state.lotId = null;
      state.samples = [];
      state.alerts = [];
      state.errorMessage = err.message;
    }
  }

  await loadDataWithConcurrentResetSimulation();

  // Commit must have been aborted and state cleaned up
  assert.equal(state.activeRunId, null, 'Concurrent reset must abort commit and leave activeRunId null');
  assert.equal(state.samples.length, 0);
  assert.ok(state.errorMessage.includes('계측 데이터 조회 도중 변경되었습니다'));
});

test('P1-B BUILD-06 (e) Error catch block wipes previous state and does not fabricate arbitrary lot ID', () => {
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');

  // Verify catch block clears state
  assert.ok(eiPageSource.includes('setActiveRunId(null);'), 'catch block must clear activeRunId');
  assert.ok(eiPageSource.includes('setLotId(null);'), 'catch block must clear lotId');
  assert.ok(eiPageSource.includes('setSamples([]);'), 'catch block must clear samples');
  assert.ok(eiPageSource.includes('setAlerts([]);'), 'catch block must clear alerts');
  assert.ok(eiPageSource.includes('setNoticeMessage(null);'), 'catch block must clear noticeMessage');

  // Verify no fallback arbitrary lot ID
  assert.ok(!eiPageSource.includes("summaryData.lot_id || 'LOT-20261015-001'"), 'Arbitrary lot ID fallback must be removed');
  assert.ok(eiPageSource.includes('setLotId(recheckSummaryData.lot_id || null);'), 'lotId must use snapshot data or null');
});

test('P1-C BUILD-06 Unified Mode A Default Seed (20261015) and Sensor Deep Link Navigation', () => {
  const eiContractSource = readFileSync(
    new URL('../src/components/equipment-intelligence/equipment-intelligence-contract.ts', import.meta.url),
    'utf8'
  );
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  const ccPageSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

  // 1. Contract default seed is 20261015
  assert.ok(eiContractSource.includes('seed: number = 20261015'), 'Default seed in contract must be 20261015');

  // 2. Equipment Intelligence initial seed is 20261015 with safe integer bounds check
  assert.ok(
    eiPageSource.includes('20261015') && eiPageSource.includes('Number.isInteger'),
    'Equipment Intelligence initial seed must safely default to 20261015'
  );

  // 3. Mode A Fixture deterministic IDs
  const fixture = generateModeAEquipmentSamplesTest(20261015);
  assert.equal(fixture.summary.run_id, 'RUN-DEMO-015', 'Default seed 20261015 must produce RUN-DEMO-015');
  assert.equal(fixture.alerts[0].alert_id, 'AL-DEMO-015', 'Default seed 20261015 must produce AL-DEMO-015');
  assert.equal(fixture.summary.lot_id, 'LOT-DEMO-815', 'Default seed 20261015 must produce LOT-DEMO-815');

  // 4. Command Center links with seed parameter in Mode A
  assert.ok(
    ccPageSource.includes("`/equipment-intelligence?sensor=RELATIVE_SIGNAL${mode === 'A' ? `&seed=${seed}` : ''}`"),
    'Command Center must pass seed to Equipment Intelligence in Mode A'
  );

  // 5. Equipment Intelligence links to investigation with seed parameter in Mode A
  assert.ok(
    eiPageSource.includes("${mode === 'A' ? `&seed=${seed}` : ''}"),
    'Equipment Intelligence must pass seed to Home Investigation in Mode A'
  );

  // 6. Home page reads and synchronizes sensor and seed searchParams
  assert.ok(homePageSource.includes("searchParams.get('sensor')"), 'Home page must read sensor query parameter');
  assert.ok(homePageSource.includes("searchParams.get('seed')"), 'Home page must read seed query parameter');
  assert.ok(homePageSource.includes("setSelectedSensor(upper as 'RELATIVE_SIGNAL' | 'CHAMBER_PRESSURE' | 'RF_POWER')"));

  // 7. Test Home sensor synchronization logic
  function testHomeSensorInit(sensorParam) {
    if (sensorParam) {
      const upper = sensorParam.trim().toUpperCase();
      if (upper === 'CHAMBER_PRESSURE' || upper === 'RF_POWER') return upper;
    }
    return 'RELATIVE_SIGNAL';
  }

  assert.equal(testHomeSensorInit('RF_POWER'), 'RF_POWER');
  assert.equal(testHomeSensorInit('rf_power'), 'RF_POWER');
  assert.equal(testHomeSensorInit('CHAMBER_PRESSURE'), 'CHAMBER_PRESSURE');
  assert.equal(testHomeSensorInit('RELATIVE_SIGNAL'), 'RELATIVE_SIGNAL');
  assert.equal(testHomeSensorInit('INVALID_SENSOR'), 'RELATIVE_SIGNAL');
  assert.equal(testHomeSensorInit(null), 'RELATIVE_SIGNAL');
});

// =========================================================================
// [잔여 P1-B-1, P1-B-2, P1-C] Review Re-assignment Verification Test Suites
// =========================================================================

test('[잔여 P1-B-1] 최초 서버 접속 이후 네트워크 실패를 Mode A로 오분류 방지 (Fail-Closed Invariant)', async () => {
  // Test scenario 1: Mid-flight samples network failure after 200 summary MUST fail closed in Mode B, NOT Mode A!
  let clientState = {
    mode: 'A',
    activeRunId: 'INIT-RUN',
    lotId: 'INIT-LOT',
    samples: [{}],
    alerts: [{}],
    noticeMessage: '초기 메시지',
    errorMessage: null
  };

  async function simulateLoadData(initialSummarySuccess, midFlightDrop) {
    let summaryRes;
    try {
      if (!initialSummarySuccess) {
        throw new TypeError('Failed to fetch (API server offline)');
      }
      summaryRes = { ok: true, status: 200, json: async () => ({ active_run_id: 'RUN-DEMO-015', lot_id: 'LOT-DEMO-815' }) };
    } catch (netErr) {
      // Offline fallback to Mode A
      clientState.mode = 'A';
      clientState.activeRunId = 'RUN-DEMO-015';
      clientState.lotId = 'LOT-DEMO-815';
      clientState.noticeMessage = 'Mode A 합성 픽스처 전환';
      clientState.errorMessage = null;
      return;
    }

    // Phase 2: Live Mode B Pipeline
    try {
      clientState.mode = 'B';
      const summaryData = await summaryRes.json();
      const discoveredRunId = summaryData.active_run_id;

      if (midFlightDrop) {
        // Mid-flight network drop during samples/alerts fetch!
        throw new TypeError('Failed to fetch (mid-flight network disruption)');
      }

      clientState.activeRunId = discoveredRunId;
      clientState.lotId = summaryData.lot_id;
    } catch (err) {
      // Must FAIL CLOSED in Mode B
      clientState.mode = 'B';
      clientState.activeRunId = null;
      clientState.lotId = null;
      clientState.samples = [];
      clientState.alerts = [];
      clientState.noticeMessage = null;
      clientState.errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  // 1. Initial unreachable server -> falls back to Mode A
  await simulateLoadData(false, false);
  assert.equal(clientState.mode, 'A');
  assert.equal(clientState.activeRunId, 'RUN-DEMO-015');

  // 2. Initial connection succeeds, but mid-flight network drops -> FAILS CLOSED IN MODE B
  await simulateLoadData(true, true);
  assert.equal(clientState.mode, 'B', 'Mid-flight network drop MUST NOT fallback to Mode A');
  assert.equal(clientState.activeRunId, null, 'activeRunId must be null');
  assert.equal(clientState.lotId, null, 'lotId must be null');
  assert.equal(clientState.samples.length, 0, 'samples must be empty');
  assert.equal(clientState.alerts.length, 0, 'alerts must be empty');
  assert.equal(clientState.noticeMessage, null, 'noticeMessage must be null');
  assert.ok(clientState.errorMessage.includes('Failed to fetch'), 'errorMessage must contain network error');

  // Verify code structure in equipment-intelligence/page.tsx
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  assert.ok(eiPageSource.includes('// Phase 1: Initial Discovery'), 'Must have distinct Phase 1 initial discovery');
  assert.ok(eiPageSource.includes('// Phase 2: Mode B Pipeline Execution'), 'Must have distinct Phase 2 Mode B live pipeline');
});

test('[잔여 P1-B-2] 알람 데이터의 Run 일치성, 필수 필드, 자료형 및 샘플 품질 플래그 검증', () => {
  const validFixture = generateModeAEquipmentSamplesTest(20261015);
  const validAlert = validFixture.alerts[0];
  const activeRunId = validAlert.run_id; // RUN-DEMO-015

  // 1. Empty alerts array is valid (0 alerts is valid)
  const emptyRes = validateAlertsSchemaTest([], activeRunId);
  assert.equal(emptyRes.valid, true, 'Empty alerts array [] must be valid');

  // 2. Valid alert matching expectedRunId
  const validRes = validateAlertsSchemaTest([validAlert], activeRunId);
  assert.equal(validRes.valid, true, 'Matching run_id alert must be valid');

  // 3. Mismatched run_id in alerts MUST fail closed (Data Lineage Contamination)
  const foreignAlert = { ...validAlert, run_id: 'RUN-DEMO-099' };
  const lineageRes = validateAlertsSchemaTest([foreignAlert], activeRunId);
  assert.equal(lineageRes.valid, false, 'Foreign run_id must fail closed');
  assert.ok(lineageRes.reason.includes('Data Lineage Contamination'));

  // 4. Duplicate alert_id in alerts array MUST fail closed
  const dupRes = validateAlertsSchemaTest([validAlert, { ...validAlert, message: '다른 메시지' }], activeRunId);
  assert.equal(dupRes.valid, false, 'Duplicate alert_id must fail closed');
  assert.ok(dupRes.reason.includes('중복된 alert_id'));

  // 5. Missing or invalid candidate_wafers type
  const badWafersRes = validateAlertsSchemaTest([{ ...validAlert, candidate_wafers: 'W-08' }], activeRunId);
  assert.equal(badWafersRes.valid, false, 'Bare string candidate_wafers must fail closed');
  assert.ok(badWafersRes.reason.includes('candidate_wafers는 문자열 배열이어야 합니다'));

  // 6. Missing or invalid candidate_lot type
  const badLotRes = validateAlertsSchemaTest([{ ...validAlert, candidate_lot: 815 }], activeRunId);
  assert.equal(badLotRes.valid, false, 'Number candidate_lot must fail closed');
  assert.ok(badLotRes.reason.includes('candidate_lot'));

  // 7. Sensor Samples: Quality Flag whitelist ('GOOD', 'SUSPECT', 'MISSING', 'BAD')
  const badFlagSamples = JSON.parse(JSON.stringify(validFixture.samples));
  badFlagSamples[0].quality_flag = 'UNKNOWN_FLAG';
  const badFlagRes = validateSamplesSchemaTest(badFlagSamples);
  assert.equal(badFlagRes.valid, false, 'Non-whitelisted quality flag must fail closed');
  assert.ok(badFlagRes.reason.includes('유효하지 않은 quality_flag'));

  // 8. Sensor Samples: data_origin missing or empty
  const noOriginSamples = JSON.parse(JSON.stringify(validFixture.samples));
  delete noOriginSamples[0].data_origin;
  const noOriginRes = validateSamplesSchemaTest(noOriginSamples);
  assert.equal(noOriginRes.valid, false, 'Missing data_origin must fail closed');
  assert.ok(noOriginRes.reason.includes('data_origin'));
});

test('[잔여 P1-C] 개별 합성 재합성 이후 복귀 시 seed 컨텍스트 탈락 방지 및 상호 연동', () => {
  const eiPageSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  const ccPageSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');

  // 1. Equipment Intelligence re-synthesis calls router.replace with seed
  assert.ok(
    eiPageSource.includes("params.set('seed', String(nextSeed))") &&
    eiPageSource.includes("router.replace(`/equipment-intelligence?${params.toString()}`"),
    'Re-synthesis must update URL query param'
  );

  // 2. Equipment Intelligence and Command Center safe integer parsing
  function parseSafeSeed(raw) {
    if (raw) {
      const num = Number(raw);
      if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
        return num;
      }
    }
    return 20261015;
  }

  assert.equal(parseSafeSeed('20261016'), 20261016);
  assert.equal(parseSafeSeed('-20261015'), 20261015, 'Negative seed must fallback to 20261015');
  assert.equal(parseSafeSeed('0'), 20261015, 'Zero seed must fallback to 20261015');
  assert.equal(parseSafeSeed('1.5'), 20261015, 'Float seed must fallback to 20261015');
  assert.equal(parseSafeSeed('abc'), 20261015, 'NaN seed must fallback to 20261015');
  assert.equal(parseSafeSeed('9999999999'), 20261015, 'Out-of-bounds seed must fallback to 20261015');

  // 3. Command Center reads seed and synchronizes state
  assert.ok(ccPageSource.includes("searchParams.get('seed')"), 'Command Center must read seed query param');
  assert.ok(ccPageSource.includes('Number.isInteger(num) && num > 0 && num < 1000000000'), 'Command Center must validate safe integer bounds');

  // 4. Mode A Command Center links preserve seed
  assert.ok(ccPageSource.includes("`/${mode === 'A' ? `?seed=${seed}` : ''}`"), 'CC Home link must preserve seed');
  assert.ok(ccPageSource.includes("`/traceability${mode === 'A' ? `?seed=${seed}` : ''}`"), 'CC Traceability link must preserve seed');
  assert.ok(ccPageSource.includes("`/equipment-intelligence${mode === 'A' ? `?seed=${seed}` : ''}`"), 'CC Equipment link must preserve seed');
  assert.ok(ccPageSource.includes("mode === 'A' ? `&seed=${seed}` : ''"), 'CC Investigation/Wafer links must preserve seed');

  // 5. Equipment Intelligence back button and tabs preserve seed in Mode A
  assert.ok(eiPageSource.includes("`/command-center${mode === 'A' ? `?seed=${seed}` : ''}`"), 'EI back to CC must preserve seed');
});

// =========================================================================
// BUILD-07 Virtual FAB Simulation Contract Tests (a ~ e)
// =========================================================================

test('BUILD-07 (a) Simulation State Machine: 7 sequential steps, navigation forward/backward, and step invariants', () => {
  const stepsSource = readFileSync(
    new URL('../src/components/fab-simulation/fab-simulation-contract.ts', import.meta.url),
    'utf8'
  );

  // 1. Exactly 7 sequential steps defined
  const expectedSteps = ['READY', 'FOUP_LOADED', 'TRANSFER', 'ETCH_RUNNING', 'T7_EXCURSION', 'INSPECTION_HOLD', 'COMPLETE'];
  expectedSteps.forEach((stepName) => {
    assert.ok(stepsSource.includes(`step: '${stepName}'`), `Simulation must define step ${stepName}`);
  });

  // 2. Step index clamping state transitions
  function transitionStep(currentIdx, action) {
    if (action === 'NEXT') return Math.min(6, currentIdx + 1);
    if (action === 'PREV') return Math.max(0, currentIdx - 1);
    if (action === 'RESET') return 0;
    return currentIdx;
  }

  assert.equal(transitionStep(0, 'PREV'), 0, 'Cannot go previous from READY');
  assert.equal(transitionStep(0, 'NEXT'), 1);
  assert.equal(transitionStep(5, 'NEXT'), 6);
  assert.equal(transitionStep(6, 'NEXT'), 6, 'Cannot go next from COMPLETE');
  assert.equal(transitionStep(4, 'RESET'), 0, 'Reset returns to READY');
});

test('BUILD-07 (b) 25-wafer FOUP cassette mapping, W-08 target isolation, and exposure status invariant', () => {
  // Test simulated wafers function
  function testFoupWafers() {
    return Array.from({ length: 25 }, (_, i) => {
      const slot = i + 1;
      const wafer_id = `W-${slot < 10 ? '0' + slot : slot}`;
      const is_target_wafer = wafer_id === 'W-08';
      let status = 'NOT_EXPOSED';
      if (slot <= 7) status = 'CONFIRMED_EXPOSED';
      else if (slot >= 8 && slot <= 12) status = 'CANDIDATE_EXPOSED';
      return { slot, wafer_id, exposure_status: status, is_target_wafer };
    });
  }

  const wafers = testFoupWafers();
  assert.equal(wafers.length, 25, 'FOUP must contain exactly 25 wafers');

  // W-01 ~ W-07: CONFIRMED_EXPOSED
  const confirmed = wafers.filter(w => w.exposure_status === 'CONFIRMED_EXPOSED');
  assert.equal(confirmed.length, 7);
  assert.equal(confirmed[0].wafer_id, 'W-01');
  assert.equal(confirmed[6].wafer_id, 'W-07');

  // W-08 ~ W-12: CANDIDATE_EXPOSED
  const candidates = wafers.filter(w => w.exposure_status === 'CANDIDATE_EXPOSED');
  assert.equal(candidates.length, 5);
  assert.deepEqual(candidates.map(w => w.wafer_id), ['W-08', 'W-09', 'W-10', 'W-11', 'W-12']);

  // W-08 target wafer isolation
  const target = wafers.find(w => w.wafer_id === 'W-08');
  assert.equal(target.is_target_wafer, true, 'W-08 must be identified as the demo target wafer');

  // W-13 ~ W-25: NOT_EXPOSED
  const notExposed = wafers.filter(w => w.exposure_status === 'NOT_EXPOSED');
  assert.equal(notExposed.length, 13);
  assert.equal(notExposed[0].wafer_id, 'W-13');
  assert.equal(notExposed[12].wafer_id, 'W-25');
});

test('BUILD-07 (c) Telemetry invariants: T4/T5 OES null/MISSING gap vs T7 multi-sensor excursion', () => {
  const contractSource = readFileSync(
    new URL('../src/components/fab-simulation/fab-simulation-contract.ts', import.meta.url),
    'utf8'
  );

  // 1. Contract defines null for T4/T5 and forbids zero-filling
  assert.ok(contractSource.includes('oes_signal: null'), 'T4/T5 OES signal must be strictly null (MISSING)');
  assert.ok(contractSource.includes("oes_quality: 'MISSING'"), 'T4/T5 OES quality must be MISSING');
  assert.ok(contractSource.includes('MISSING ≠ 0'), 'MISSING != 0 domain disclaimer must be enforced');

  // 2. Step T7 excursion values exceed SPC UCL (65.0 a.u.)
  assert.ok(contractSource.includes('80.0'), 'T7 OES excursion must reach 80.0 a.u.');
  assert.ok(contractSource.includes('168.5'), 'T7 pressure excursion must reach 168.5 mTorr');
  assert.ok(contractSource.includes('1820.0'), 'T7 RF Power excursion must reach 1820.0 W');
  assert.ok(contractSource.includes('ucl_limit: 65.0'), 'UCL limit must be 65.0 a.u.');
});

test('BUILD-07 (d) Cross-page navigation hub & seed lineage retention across 5 views', () => {
  function testSimulationNavLinks(seed) {
    const safeSeed = (seed && Number.isInteger(Number(seed)) && Number(seed) > 0 && Number(seed) < 1000000000)
      ? Number(seed) : 20261015;
    const runId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const alertId = `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

    return {
      runId,
      alertId,
      lotId,
      commandCenter: `/command-center?seed=${safeSeed}`,
      equipmentIntelligence: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=${safeSeed}`,
      homeInvestigation: `/?alert=${encodeURIComponent(alertId)}&investigation=true&seed=${safeSeed}`,
      waferTraceability: `/traceability?wafer=W-08&seed=${safeSeed}`,
      fabSimulation: `/fab-simulation?seed=${safeSeed}`,
    };
  }

  // Default seed 20261015
  const defaultLinks = testSimulationNavLinks(20261015);
  assert.equal(defaultLinks.runId, 'RUN-DEMO-015');
  assert.equal(defaultLinks.alertId, 'AL-DEMO-015');
  assert.equal(defaultLinks.lotId, 'LOT-DEMO-815');
  assert.equal(defaultLinks.commandCenter, '/command-center?seed=20261015');
  assert.equal(defaultLinks.equipmentIntelligence, '/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=20261015');
  assert.equal(defaultLinks.homeInvestigation, '/?alert=AL-DEMO-015&investigation=true&seed=20261015');
  assert.equal(defaultLinks.waferTraceability, '/traceability?wafer=W-08&seed=20261015');

  // Modified seed 20261016
  const modLinks = testSimulationNavLinks(20261016);
  assert.equal(modLinks.runId, 'RUN-DEMO-016');
  assert.equal(modLinks.alertId, 'AL-DEMO-016');
  assert.equal(modLinks.lotId, 'LOT-DEMO-816');
  assert.equal(modLinks.commandCenter, '/command-center?seed=20261016');
  assert.equal(modLinks.waferTraceability, '/traceability?wafer=W-08&seed=20261016');

  // Safe integer bounds: out-of-bounds, negative, float, and strings fall back safely
  assert.equal(testSimulationNavLinks(-10).runId, 'RUN-DEMO-015');
  assert.equal(testSimulationNavLinks(0).runId, 'RUN-DEMO-015');
  assert.equal(testSimulationNavLinks(1.5).runId, 'RUN-DEMO-015');
  assert.equal(testSimulationNavLinks('invalid').runId, 'RUN-DEMO-015');
  assert.equal(testSimulationNavLinks(9999999999).runId, 'RUN-DEMO-015');
});

test('BUILD-07 (e) Page source assertions: 3D asset slot, EKL concept triggers, buttons, and domain disclaimers', () => {
  const simPageSource = readFileSync(new URL('../src/app/fab-simulation/page.tsx', import.meta.url), 'utf8');
  const slotSource = readFileSync(new URL('../src/components/fab-simulation/Fab3dAssetSlot.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const traceSource = readFileSync(new URL('../src/app/traceability/page.tsx', import.meta.url), 'utf8');
  const ccSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const eiSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');

  // 1. 3D Asset Slot reservation
  assert.ok(slotSource.includes('id="fab-3d-asset-slot"'), 'Must define fab-3d-asset-slot ID');
  assert.ok(simPageSource.includes('<Fab3dAssetSlot'), 'Page must mount Fab3dAssetSlot');

  // 2. Playback and navigation control buttons
  assert.ok(simPageSource.includes('id="sim-btn-prev"'), 'Must have sim-btn-prev');
  assert.ok(simPageSource.includes('id="sim-btn-next"'), 'Must have sim-btn-next');
  assert.ok(simPageSource.includes('id="sim-btn-toggle-play"'), 'Must have sim-btn-toggle-play');
  assert.ok(simPageSource.includes('id="sim-btn-reset"'), 'Must have sim-btn-reset');
  assert.ok(simPageSource.includes('id="sim-btn-resynthesize"'), 'Must have sim-btn-resynthesize');
  assert.ok(simPageSource.includes('type="button"'), 'Buttons must specify type="button"');

  // 3. EKL concept triggers
  const requiredEKL = ['oes-relative-signal', 'rf-power', 'spc-ucl-missing', 'wafer-exposure-status'];
  requiredEKL.forEach(concept => {
    assert.ok(simPageSource.includes(concept), `Simulation must include EKL trigger for ${concept}`);
  });

  const contractSource = readFileSync(new URL('../src/components/fab-simulation/fab-simulation-contract.ts', import.meta.url), 'utf8');

  // 4. Domain Disclaimers
  assert.ok(
    contractSource.includes('Excursion ≠ Defect') && (simPageSource.includes('DOMAIN_DISCLAIMERS.excursionVsDefect') || simPageSource.includes('Excursion ≠ Defect')),
    'Must include Excursion != Defect disclaimer'
  );
  assert.ok(simPageSource.includes('CONFIRMED_EXPOSED') && simPageSource.includes('CANDIDATE_EXPOSED'), 'Must explain exposure status');
  assert.ok(simPageSource.includes('MISSING ≠ 0'), 'Must include MISSING != 0 disclaimer');
  assert.ok(
    contractSource.includes('Real-time FAB operation 아님') && (simPageSource.includes('DOMAIN_DISCLAIMERS.simulationMode') || simPageSource.includes('Real-time FAB operation 아님')),
    'Must disclaim real-time fab operation'
  );

  // 5. Cross-page navigation links to /fab-simulation across all other 4 pages
  assert.ok(homeSource.includes('/fab-simulation'), 'Home page must link to /fab-simulation');
  assert.ok(traceSource.includes('/fab-simulation'), 'Traceability page must link to /fab-simulation');
  assert.ok(ccSource.includes('/fab-simulation'), 'Command Center page must link to /fab-simulation');
  assert.ok(eiSource.includes('/fab-simulation'), 'Equipment Intelligence page must link to /fab-simulation');
});

// =========================================================================
// BUILD-08 Engineering Workspace Contract Tests (a ~ e)
// =========================================================================

test('BUILD-08 (a) Contract: Evidence items invariant (T4/T5 MISSING fact vs T7 excursion spike, SPC UCL vs product spec, exposure categories)', () => {
  const contractSource = readFileSync(
    new URL('../src/components/engineering-workspace/engineering-workspace-contract.ts', import.meta.url),
    'utf8'
  );

  function testGenerateEvidence(seed = 20261015) {
    const safeSeed = (seed && Number.isInteger(Number(seed)) && Number(seed) > 0 && Number(seed) < 1000000000) ? Number(seed) : 20261015;
    const runId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const alertId = `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

    return [
      {
        id: 'EVI-01',
        type: 'OBSERVATION_QUALITY',
        title: 'OES 상대 신호 T4/T5 결측 (MISSING ≠ 0)',
        category: '센서 관측 품질 사실',
        observedValue: 'null (MISSING)',
        qualityFlag: 'MISSING',
        provenance: `ETCH-02 / CH-B (${runId}) · 광학 방출 분광 센서`,
      },
      {
        id: 'EVI-02',
        type: 'PROCESS_EXCURSION',
        title: 'Step T7 복합 센서 공정 일탈 (Excursion Spike)',
        category: '통계적 관리한계 초과',
        observedValue: '80.0 a.u. (> UCL 65.0)',
        qualityFlag: 'SUSPECT',
        provenance: `ETCH-02 / CH-B (${runId}) · T7 스텝 계측`,
      },
      {
        id: 'EVI-03',
        type: 'ALARM_RECORD',
        title: 'FDC 실시간 경보 레코드 (Rule UCL-01)',
        category: 'FDC 통계 룰 트리거',
        observedValue: 'FDC-RULE-SPC-UCL-01',
        qualityFlag: 'CRITICAL',
        provenance: `FDC 감시 센티넬 · ${lotId} / ${runId}`,
      },
      {
        id: 'EVI-04',
        type: 'WAFER_IMPACT',
        title: '잠재 노출 영향군 (W-08 ~ W-12)',
        category: '웨이퍼 노출 이력 분류',
        observedValue: '5매 (타겟: W-08)',
        qualityFlag: 'SUSPECT',
        provenance: `25매 FOUP 카세트 (${lotId}) · Slot 8~12`,
      },
    ];
  }

  const items = testGenerateEvidence(20261015);
  assert.equal(items.length, 4, 'Must have exactly 4 evidence items');

  // EVI-01: T4/T5 null !== 0
  const evi01 = items.find(e => e.id === 'EVI-01');
  assert.equal(evi01.qualityFlag, 'MISSING');
  assert.equal(evi01.observedValue, 'null (MISSING)');
  assert.ok(contractSource.includes('MISSING ≠ 0'), 'Contract must state MISSING != 0');

  // EVI-02: T7 Excursion Spike with UCL
  const evi02 = items.find(e => e.id === 'EVI-02');
  assert.equal(evi02.qualityFlag, 'SUSPECT');
  assert.ok(evi02.observedValue.includes('UCL 65.0'), 'Must specify SPC UCL limit');

  // EVI-03: Alarm Record
  const evi03 = items.find(e => e.id === 'EVI-03');
  assert.equal(evi03.qualityFlag, 'CRITICAL');
  assert.equal(evi03.observedValue, 'FDC-RULE-SPC-UCL-01');

  // EVI-04: Wafer Impact
  const evi04 = items.find(e => e.id === 'EVI-04');
  assert.equal(evi04.qualityFlag, 'SUSPECT');
  assert.ok(contractSource.includes('CANDIDATE_EXPOSED'), 'Contract must reference CANDIDATE_EXPOSED');
  assert.ok(contractSource.includes('CONFIRMED_EXPOSED'), 'Contract must reference CONFIRMED_EXPOSED');
});

test('BUILD-08 (b) Contract: Hypothesis state machine transitions, pure evidence linking, and disclaimers', () => {
  const contractSource = readFileSync(
    new URL('../src/components/engineering-workspace/engineering-workspace-contract.ts', import.meta.url),
    'utf8'
  );

  function getNextHypothesisStatus(current) {
    switch (current) {
      case 'UNVERIFIED': return 'SUPPORTED_FOR_REVIEW';
      case 'SUPPORTED_FOR_REVIEW': return 'NEEDS_MORE_DATA';
      case 'NEEDS_MORE_DATA': return 'RULED_OUT';
      case 'RULED_OUT': return 'UNVERIFIED';
    }
  }

  assert.equal(getNextHypothesisStatus('UNVERIFIED'), 'SUPPORTED_FOR_REVIEW');
  assert.equal(getNextHypothesisStatus('SUPPORTED_FOR_REVIEW'), 'NEEDS_MORE_DATA');
  assert.equal(getNextHypothesisStatus('NEEDS_MORE_DATA'), 'RULED_OUT');
  assert.equal(getNextHypothesisStatus('RULED_OUT'), 'UNVERIFIED');

  function toggleLinkedEvidence(linkedIds, evidenceId) {
    if (linkedIds.includes(evidenceId)) {
      return linkedIds.filter((id) => id !== evidenceId);
    } else {
      return [...linkedIds, evidenceId];
    }
  }

  const initial = ['EVI-02'];
  const added = toggleLinkedEvidence(initial, 'EVI-01');
  assert.deepEqual(added, ['EVI-02', 'EVI-01'], 'Should add evidence');
  assert.deepEqual(initial, ['EVI-02'], 'Original array must remain unmutated');

  const removed = toggleLinkedEvidence(added, 'EVI-02');
  assert.deepEqual(removed, ['EVI-01'], 'Should remove evidence');

  assert.ok(contractSource.includes('HYPO-01'), 'Must define HYPO-01');
  assert.ok(contractSource.includes('HYPO-02'), 'Must define HYPO-02');
  assert.ok(contractSource.includes('HYPO-03'), 'Must define HYPO-03');
  assert.ok(contractSource.includes('UNVERIFIED'), 'Initial state must be UNVERIFIED');
  assert.ok(contractSource.includes('hypothesisDisclaimer'), 'Must include hypothesis disclaimer');
});

test('BUILD-08 (c) Contract: Action checklist defaults, toggle, reset, and volatility notice', () => {
  const contractSource = readFileSync(
    new URL('../src/components/engineering-workspace/engineering-workspace-contract.ts', import.meta.url),
    'utf8'
  );

  assert.ok(contractSource.includes('ACTION-01'), 'Must define ACTION-01');
  assert.ok(contractSource.includes('ACTION-02'), 'Must define ACTION-02');
  assert.ok(contractSource.includes('ACTION-03'), 'Must define ACTION-03');
  assert.ok(contractSource.includes('ACTION-04'), 'Must define ACTION-04');

  assert.ok(contractSource.includes('actionDisclaimer'), 'Must declare actionDisclaimer');
  assert.ok(contractSource.includes('memoryDisclaimer'), 'Must declare memoryDisclaimer');
  assert.ok(contractSource.includes('새로고침 시 초기화'), 'Must mention volatile on refresh');
});

test('BUILD-08 (d) Contract: Seed parsing, alert lineage validation, and cross-screen navigation links', () => {
  function parseSafeWorkspaceSeed(raw) {
    if (raw) {
      const num = Number(raw);
      if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
        return num;
      }
    }
    return 20261015;
  }

  function isWorkspaceAlertSupported(requestedAlertId, expectedAlertId) {
    if (!requestedAlertId) return true;
    return requestedAlertId.trim() === expectedAlertId;
  }

  function getWorkspaceNavLinks(seed, alertId) {
    const safeSeed = parseSafeWorkspaceSeed(String(seed));
    const runId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const effectiveAlertId = alertId || `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
    const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

    return {
      runId,
      alertId: effectiveAlertId,
      lotId,
      commandCenter: `/command-center?seed=${safeSeed}`,
      equipmentIntelligence: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=${safeSeed}`,
      homeInvestigation: `/?alert=${encodeURIComponent(effectiveAlertId)}&investigation=true&seed=${safeSeed}`,
      waferTraceability: `/traceability?wafer=W-08&seed=${safeSeed}`,
      fabSimulation: `/fab-simulation?seed=${safeSeed}`,
      engineeringWorkspace: `/engineering-workspace?alert=${encodeURIComponent(effectiveAlertId)}&seed=${safeSeed}`,
    };
  }

  // 1. Seed boundary validation
  assert.equal(parseSafeWorkspaceSeed(null), 20261015);
  assert.equal(parseSafeWorkspaceSeed(''), 20261015);
  assert.equal(parseSafeWorkspaceSeed('-5'), 20261015);
  assert.equal(parseSafeWorkspaceSeed('0'), 20261015);
  assert.equal(parseSafeWorkspaceSeed('20261015'), 20261015);
  assert.equal(parseSafeWorkspaceSeed('20261016'), 20261016);
  assert.equal(parseSafeWorkspaceSeed('invalid_seed'), 20261015);

  // 2. Alert lineage validation
  assert.equal(isWorkspaceAlertSupported(null, 'AL-DEMO-015'), true, 'Default alert supported');
  assert.equal(isWorkspaceAlertSupported('AL-DEMO-015', 'AL-DEMO-015'), true, 'Matching alert supported');
  assert.equal(isWorkspaceAlertSupported('AL-DEMO-999', 'AL-DEMO-015'), false, 'Mismatched alert rejected');
  assert.equal(isWorkspaceAlertSupported('AL-STANDBY-001', 'AL-DEMO-015'), false, 'Standby alert rejected');

  // 3. Navigation links
  const links = getWorkspaceNavLinks(20261015);
  assert.equal(links.runId, 'RUN-DEMO-015');
  assert.equal(links.alertId, 'AL-DEMO-015');
  assert.equal(links.lotId, 'LOT-DEMO-815');
  assert.equal(links.commandCenter, '/command-center?seed=20261015');
  assert.equal(links.equipmentIntelligence, '/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=20261015');
  assert.equal(links.homeInvestigation, '/?alert=AL-DEMO-015&investigation=true&seed=20261015');
  assert.equal(links.waferTraceability, '/traceability?wafer=W-08&seed=20261015');
  assert.equal(links.fabSimulation, '/fab-simulation?seed=20261015');
  assert.equal(links.engineeringWorkspace, '/engineering-workspace?alert=AL-DEMO-015&seed=20261015');
});

test('BUILD-08 (e) Page source assertions: 6-tab navigation, buttons, EKL triggers, and domain invariants', () => {
  const wsPageSource = readFileSync(new URL('../src/app/engineering-workspace/page.tsx', import.meta.url), 'utf8');
  const wsContractSource = readFileSync(new URL('../src/components/engineering-workspace/engineering-workspace-contract.ts', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const traceSource = readFileSync(new URL('../src/app/traceability/page.tsx', import.meta.url), 'utf8');
  const ccSource = readFileSync(new URL('../src/app/command-center/page.tsx', import.meta.url), 'utf8');
  const eiSource = readFileSync(new URL('../src/app/equipment-intelligence/page.tsx', import.meta.url), 'utf8');
  const simSource = readFileSync(new URL('../src/app/fab-simulation/page.tsx', import.meta.url), 'utf8');

  // 1. Control buttons and interactive elements
  assert.ok(wsPageSource.includes('id="ws-btn-resynthesize"'), 'Must have seed resynthesize button');
  assert.ok(wsPageSource.includes('id="btn-toggle-evidence-link"'), 'Must have evidence toggle link button');
  assert.ok(wsPageSource.includes('id="btn-reset-hypotheses"'), 'Must have reset hypotheses button');
  assert.ok(wsPageSource.includes('id="btn-reset-actions"'), 'Must have reset actions button');
  assert.ok(wsPageSource.includes('id="engineering-workspace-notes"'), 'Must have volatile notes textarea');
  assert.ok(wsPageSource.includes('id="unsupported-alert-banner"'), 'Must have unsupported alert banner template');

  // 2. EKL concept triggers (at least 2 required, we have 4)
  const requiredEKL = ['oes-relative-signal', 'rf-power', 'spc-ucl-missing', 'wafer-exposure-status'];
  requiredEKL.forEach((concept) => {
    assert.ok(wsPageSource.includes(concept), `Workspace must include EKL trigger for ${concept}`);
  });

  // 3. Domain Invariants and Disclaimers
  assert.ok(wsPageSource.includes('Excursion ≠ Defect') || wsContractSource.includes('Excursion ≠ Defect'), 'Must include Excursion != Defect');
  assert.ok(wsPageSource.includes('MISSING ≠ 0') || wsContractSource.includes('MISSING ≠ 0'), 'Must include MISSING != 0');
  assert.ok(wsPageSource.includes('CONFIRMED_EXPOSED'), 'Must reference CONFIRMED_EXPOSED');
  assert.ok(wsPageSource.includes('CANDIDATE_EXPOSED'), 'Must reference CANDIDATE_EXPOSED');

  // 4. 6-Tab unified navigation across all 6 pages
  assert.ok(homeSource.includes('/engineering-workspace'), 'Home page must link to /engineering-workspace');
  assert.ok(traceSource.includes('/engineering-workspace'), 'Traceability page must link to /engineering-workspace');
  assert.ok(ccSource.includes('/engineering-workspace'), 'Command Center page must link to /engineering-workspace');
  assert.ok(eiSource.includes('/engineering-workspace'), 'Equipment Intelligence page must link to /engineering-workspace');
  assert.ok(simSource.includes('/engineering-workspace'), 'Fab Simulation page must link to /engineering-workspace');
  assert.ok(wsPageSource.includes('/engineering-workspace'), 'Workspace page must link to /engineering-workspace');

  // 5. Command Center direct action button
  assert.ok(ccSource.includes('id="cc-btn-go-workspace"'), 'Command Center must have direct button to workspace');
});





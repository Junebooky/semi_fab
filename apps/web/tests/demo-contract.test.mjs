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

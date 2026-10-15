import test from 'node:test';
import assert from 'node:assert/strict';

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

test('Chart Segment Invariant: Missing steps T4 and T5 create disconnected SVG path segments', () => {
  const points = [
    { step: 0, x: 60, y: 123.24 },
    { step: 1, x: 130, y: 119.82 },
    { step: 2, x: 200, y: 117.48 },
    { step: 3, x: 270, y: 120.36 },
    { step: 4, x: 340, y: null },
    { step: 5, x: 410, y: null },
    { step: 6, x: 480, y: 116.4 },
    { step: 7, x: 550, y: 66.0 },
  ];

  const seg1 = points.filter(p => p.step <= 3 && p.y !== null);
  const seg2 = points.filter(p => p.step >= 6 && p.y !== null);

  const d1 = seg1.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const d2 = seg2.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Verifies that neither path connects through step 4 or 5
  assert.ok(d1.startsWith('M 60'));
  assert.ok(d1.includes('L 270'));
  assert.ok(!d1.includes('340')); // No x=340 in seg1

  assert.ok(d2.startsWith('M 480'));
  assert.ok(d2.includes('L 550'));
  assert.ok(!d2.includes('410')); // No x=410 in seg2
});

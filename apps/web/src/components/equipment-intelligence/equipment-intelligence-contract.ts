/**
 * Equipment Intelligence Contract Module (BUILD-06)
 *
 * Defines shared data types, sensor definitions, dynamic SVG chart segmentation math,
 * deterministic Mode A synthetic fixture generators, and fail-closed lineage validation.
 */

import { FdcAlert, isInvestigationSupported } from '../command-center/command-center-contract';

export type SensorId = 'RELATIVE_SIGNAL' | 'CHAMBER_PRESSURE' | 'RF_POWER';

export const VALID_SENSORS: readonly SensorId[] = [
  'RELATIVE_SIGNAL',
  'CHAMBER_PRESSURE',
  'RF_POWER',
] as const;

export interface SensorMetadata {
  id: SensorId;
  name: string;
  unit: string;
  target: number;
  ucl: number;
  lcl: number | null;
  measurementType: 'DISCONTINUOUS' | 'CONTINUOUS';
  description: string;
  controlLimitNotice: string;
  specLimitNotice: string;
}

export const SENSOR_METADATA: Record<SensorId, SensorMetadata> = {
  RELATIVE_SIGNAL: {
    id: 'RELATIVE_SIGNAL',
    name: 'OES 플라즈마 광학 상대 신호 (Optical Emission Spectroscopy)',
    unit: 'a.u.',
    target: 50.0,
    ucl: 65.0,
    lcl: 35.0,
    measurementType: 'DISCONTINUOUS',
    description: '식각 챔버 내 플라즈마 발광 주파수 상대 강도 계측. 스텝 T4~T5 구간은 광학 셔터 물리적 차단으로 인해 결측(MISSING) 처리됩니다.',
    controlLimitNotice: '통계적 관리한계(SPC UCL 65.0 a.u.)는 과거 3-Sigma 공정 산포 기반 기준값입니다 (설명용 합성 기준).',
    specLimitNotice: '통계적 관리한계(UCL/LCL)는 제품 규격한계(USL/LSL)와 구별됩니다. MISSING≠0이며, 광학 셔터 닫힘에 따른 정밀 결측 구간입니다.',
  },
  CHAMBER_PRESSURE: {
    id: 'CHAMBER_PRESSURE',
    name: '식각 챔버 진공 압력 (Capacitance Manometer)',
    unit: 'mTorr',
    target: 120.0,
    ucl: 140.0,
    lcl: 100.0,
    measurementType: 'CONTINUOUS',
    description: '정전용량식 격막 게이지를 통한 공정 챔버 진공 압력 전구간 연속 계측. T4~T5를 포함한 전 스텝에서 결측 없이 연속 수집됩니다.',
    controlLimitNotice: '통계적 관리한계(SPC UCL 140.0 mTorr)는 스로틀 밸브 제어 안정 범위 기준값입니다 (설명용 합성 기준).',
    specLimitNotice: '관리한계(UCL) 초과(Excursion)는 즉각적인 웨이퍼 불량 확정(Defect)을 의미하지 않으며 공학 조사 대상입니다.',
  },
  RF_POWER: {
    id: 'RF_POWER',
    name: 'RF 플라즈마 전방 전력 (Forward Power)',
    unit: 'W',
    target: 1500.0,
    ucl: 1650.0,
    lcl: 1350.0,
    measurementType: 'CONTINUOUS',
    description: '13.56 MHz RF 발생기 전방 출력 전력 연속 계측. T0~T6 정상 1500W 유지 후 T7 스텝에서 복합 급증 일탈이 감지됩니다.',
    controlLimitNotice: '통계적 관리한계(SPC UCL 1650.0 W)는 매처(Matcher) 정합 및 플라즈마 안정 제어 한계입니다 (설명용 합성 기준).',
    specLimitNotice: 'USL/LSL(제품 물리 규격)과 구별되며, 설명용 가상 기준값입니다. CANDIDATE_EXPOSED는 불량 확정이 아닌 검토 대상군입니다.',
  },
};

export interface SensorSample {
  step_index: number;
  time_label: string;
  sim_time_utc: string;
  sensor_id: string;
  measured_value: number | null;
  unit: string;
  quality_flag: 'GOOD' | 'SUSPECT' | 'BAD' | 'MISSING';
  data_origin: string;
}

export interface ChartPoint extends SensorSample {
  x: number;
  y: number | null;
}

/**
 * Parses query parameter string safely, returning a valid SensorId or defaulting to 'RELATIVE_SIGNAL'.
 */
export function parseSensorQuery(raw: string | null | undefined): SensorId {
  if (!raw) return 'RELATIVE_SIGNAL';
  const upper = raw.trim().toUpperCase();
  if (upper === 'CHAMBER_PRESSURE') return 'CHAMBER_PRESSURE';
  if (upper === 'RF_POWER') return 'RF_POWER';
  return 'RELATIVE_SIGNAL';
}

/**
 * Returns metadata definition for a given sensor.
 */
export function getSensorMetadata(sensorId: SensorId): SensorMetadata {
  return SENSOR_METADATA[sensorId] || SENSOR_METADATA.RELATIVE_SIGNAL;
}

/**
 * Filters samples by sensor_id and step_index.
 */
export function filterSamplesBySensor(samples: SensorSample[], sensorId: SensorId): SensorSample[] {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter((s) => s && s.sensor_id === sensorId)
    .sort((a, b) => a.step_index - b.step_index);
}

/**
 * Finds a specific sample by sensor_id and step_index.
 */
export function findSampleForStep(
  samples: SensorSample[],
  sensorId: SensorId,
  stepIndex: number
): SensorSample | null {
  if (!Array.isArray(samples)) return null;
  return samples.find((s) => s.sensor_id === sensorId && s.step_index === stepIndex) || null;
}

/**
 * Calculates SVG coordinates for charting (ViewBox 0 0 600 240).
 * X coordinates: 60 + step_index * 70 (T0: 60, T1: 130, ..., T7: 550)
 * Y coordinates: Scaled linearly across [30, 210] based on sensor scale.
 */
export function calculateChartCoordinates(
  samples: SensorSample[],
  sensorId: SensorId
): ChartPoint[] {
  const filtered = filterSamplesBySensor(samples, sensorId);

  return filtered.map((sample) => {
    const x = 60 + sample.step_index * 70;
    let y: number | null = null;

    if (sample.measured_value !== null && typeof sample.measured_value === 'number') {
      if (sensorId === 'RELATIVE_SIGNAL') {
        // 0 to 100 a.u. => Y from 210 to 30
        y = 210 - (sample.measured_value / 100) * 180;
      } else if (sensorId === 'CHAMBER_PRESSURE') {
        // 100 to 200 mTorr => Y from 210 to 30
        const clamped = Math.max(100, Math.min(200, sample.measured_value));
        y = 210 - ((clamped - 100) / 100) * 180;
      } else {
        // 1000 to 2000 W => Y from 210 to 30
        const clamped = Math.max(1000, Math.min(2000, sample.measured_value));
        y = 210 - ((clamped - 1000) / 1000) * 180;
      }
    }

    return {
      ...sample,
      x,
      y,
    };
  });
}

/**
 * Dynamic path segmentation invariant:
 * Points with null y or quality_flag === 'MISSING' split the line path so that missing intervals
 * are never plotted as 0 and never connected across.
 * Continuous sensors without missing points return exactly 1 unbroken path.
 */
export function calculateDynamicSegments(points: ChartPoint[]): string[] {
  const segments: string[] = [];
  let currentGroup: { x: number; y: number }[] = [];

  points.forEach((pt) => {
    if (pt.y !== null && pt.quality_flag !== 'MISSING') {
      currentGroup.push({ x: pt.x, y: pt.y });
    } else {
      if (currentGroup.length > 0) {
        segments.push(
          currentGroup.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        );
        currentGroup = [];
      }
    }
  });

  if (currentGroup.length > 0) {
    segments.push(
      currentGroup.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    );
  }

  return segments;
}

/**
 * Dynamic missing range detection:
 * Calculates shaded overlay boundaries if any missing points exist.
 * Returns null for continuous sensors (CHAMBER_PRESSURE, RF_POWER).
 */
export function calculateMissingRange(
  points: ChartPoint[]
): { minX: number; width: number; labels: string } | null {
  const missingPoints = points.filter(
    (p) => p.quality_flag === 'MISSING' || p.measured_value === null
  );
  if (missingPoints.length === 0) return null;

  const minX = Math.min(...missingPoints.map((p) => p.x)) - 35;
  const maxX = Math.max(...missingPoints.map((p) => p.x)) + 35;
  const labels = missingPoints.map((p) => p.time_label).join(', ');

  return { minX, width: maxX - minX, labels };
}

/**
 * Returns Y pixel coordinates for UCL, Target, and LCL reference lines.
 */
export function getThresholdPositions(sensorId: SensorId): {
  uclY: number;
  targetY: number;
  lclY: number | null;
} {
  if (sensorId === 'RELATIVE_SIGNAL') {
    return {
      uclY: 210 - (65.0 / 100) * 180,
      targetY: 210 - (50.0 / 100) * 180,
      lclY: 210 - (35.0 / 100) * 180,
    };
  } else if (sensorId === 'CHAMBER_PRESSURE') {
    return {
      uclY: 210 - ((140.0 - 100) / 100) * 180,
      targetY: 210 - ((120.0 - 100) / 100) * 180,
      lclY: 210 - ((100.0 - 100) / 100) * 180,
    };
  } else {
    return {
      uclY: 210 - ((1650.0 - 1000) / 1000) * 180,
      targetY: 210 - ((1500.0 - 1000) / 1000) * 180,
      lclY: 210 - ((1350.0 - 1000) / 1000) * 180,
    };
  }
}

/**
 * Validates that an active run ID exists and is identical between summary and requests.
 */
export function validateRunLineage(
  summaryRunId: string | null | undefined,
  activeRunId: string | null | undefined
): boolean {
  if (!summaryRunId || typeof summaryRunId !== 'string' || summaryRunId.trim().length === 0) {
    return false;
  }
  if (!activeRunId || typeof activeRunId !== 'string' || activeRunId.trim().length === 0) {
    return false;
  }
  return summaryRunId === activeRunId;
}

/**
 * Deterministic Mode A synthetic fixture generator matching the exact simulation
 * formula of FAB ONE Home (page.tsx). Guarantees a single unified synthetic reality!
 */
export function generateModeAEquipmentSamples(seed: number = 42): {
  samples: SensorSample[];
  alerts: FdcAlert[];
  summary: {
    run_id: string;
    lot_id: string;
    equipment_id: string;
    chamber_id: string;
  };
} {
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

  const samples: SensorSample[] = [
    // RELATIVE_SIGNAL (Optical sensor: T4 and T5 missing due to optical shutter)
    { step_index: 0, time_label: 'T0', sim_time_utc: '2026-10-15T00:00:00.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(48.2 + relNoise).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 1, time_label: 'T1', sim_time_utc: '2026-10-15T00:00:05.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(50.1 + relNoise * 0.8).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 2, time_label: 'T2', sim_time_utc: '2026-10-15T00:00:10.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(51.4 + relNoise * 0.5).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 3, time_label: 'T3', sim_time_utc: '2026-10-15T00:00:15.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(49.8 + relNoise * 0.7).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 4, time_label: 'T4', sim_time_utc: '2026-10-15T00:00:20.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: null, unit: 'a.u.', quality_flag: 'MISSING', data_origin: 'synthetic' },
    { step_index: 5, time_label: 'T5', sim_time_utc: '2026-10-15T00:00:25.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: null, unit: 'a.u.', quality_flag: 'MISSING', data_origin: 'synthetic' },
    { step_index: 6, time_label: 'T6', sim_time_utc: '2026-10-15T00:00:30.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: +(52.0 + relNoise * 0.9).toFixed(1), unit: 'a.u.', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 7, time_label: 'T7', sim_time_utc: '2026-10-15T00:00:35.000Z', sensor_id: 'RELATIVE_SIGNAL', measured_value: t7Rel, unit: 'a.u.', quality_flag: 'SUSPECT', data_origin: 'synthetic' },

    // CHAMBER_PRESSURE (Continuous measurement, strictly valid & GOOD at T4/T5)
    { step_index: 0, time_label: 'T0', sim_time_utc: '2026-10-15T00:00:00.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.1 + prsNoise).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 1, time_label: 'T1', sim_time_utc: '2026-10-15T00:00:05.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.4 + prsNoise * 0.7).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 2, time_label: 'T2', sim_time_utc: '2026-10-15T00:00:10.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(119.8 + prsNoise * 0.6).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 3, time_label: 'T3', sim_time_utc: '2026-10-15T00:00:15.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.5 + prsNoise * 0.8).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 4, time_label: 'T4', sim_time_utc: '2026-10-15T00:00:20.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.2 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 5, time_label: 'T5', sim_time_utc: '2026-10-15T00:00:25.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(120.0 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 6, time_label: 'T6', sim_time_utc: '2026-10-15T00:00:30.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: +(121.3 + prsNoise * 0.5).toFixed(2), unit: 'mTorr', quality_flag: 'GOOD', data_origin: 'synthetic' },
    { step_index: 7, time_label: 'T7', sim_time_utc: '2026-10-15T00:00:35.000Z', sensor_id: 'CHAMBER_PRESSURE', measured_value: t7Prs, unit: 'mTorr', quality_flag: 'SUSPECT', data_origin: 'synthetic' },

    // RF_POWER (Continuous measurement, nominal 1500W at T0~T6, excursion at T7)
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
  const standbyAlertId = `AL-STANDBY-${String(seed % 1000).padStart(3, '0')}`;

  const alerts: FdcAlert[] = [
    {
      alert_id: alertId,
      severity: 'CRITICAL',
      equipment_id: 'ETCH-02',
      chamber_id: 'CH-B',
      run_id: runId,
      rule_code: 'FDC-RULE-SPC-UCL-01',
      message: `식각 챔버 압력/광학 신호/RF Power 복합 급증 (Step T7 공정 일탈 감지, > UCL 65.0 a.u.)`,
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
  ];

  return {
    samples,
    alerts,
    summary: {
      run_id: runId,
      lot_id: lotId,
      equipment_id: 'ETCH-02',
      chamber_id: 'CH-B',
    },
  };
}

export { isInvestigationSupported };

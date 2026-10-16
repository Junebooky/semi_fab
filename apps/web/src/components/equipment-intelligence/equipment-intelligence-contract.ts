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
 * Strict schema and domain invariant validator for sensor samples.
 * Prevents incomplete, malformed, or contaminated datasets from committing as Mode B success.
 */
export function validateSamplesSchema(samples: unknown): { valid: boolean; reason?: string } {
  if (!Array.isArray(samples)) {
    return { valid: false, reason: '센서 샘플 데이터가 배열 형식이 아닙니다 (Fail-closed).' };
  }

  // Must have at least 24 samples (3 sensors x 8 steps T0~T7)
  if (samples.length < 24) {
    return {
      valid: false,
      reason: `센서 계측 샘플 수가 부족합니다 (수신: ${samples.length}개 / 최소 24개 필요, Fail-closed).`,
    };
  }

  const expectedSensors: SensorId[] = ['RELATIVE_SIGNAL', 'CHAMBER_PRESSURE', 'RF_POWER'];
  const allowedQualityFlags = new Set(['GOOD', 'SUSPECT', 'MISSING', 'BAD']);

  for (const sensorId of expectedSensors) {
    const sensorSamples = samples.filter((s) => s && s.sensor_id === sensorId);
    if (sensorSamples.length !== 8) {
      return {
        valid: false,
        reason: `센서 ${sensorId}의 스텝 계측 샘플이 8개가 아닙니다 (수신: ${sensorSamples.length}개, Fail-closed).`,
      };
    }

    const stepIndices = new Set<number>();
    for (const sample of sensorSamples) {
      if (typeof sample.step_index !== 'number' || sample.step_index < 0 || sample.step_index > 7) {
        return {
          valid: false,
          reason: `유효하지 않은 step_index (${sample.step_index})가 감지되었습니다.`,
        };
      }
      if (stepIndices.has(sample.step_index)) {
        return {
          valid: false,
          reason: `센서 ${sensorId}에 중복된 step_index (${sample.step_index})가 존재합니다.`,
        };
      }
      stepIndices.add(sample.step_index);

      // Verify time label
      if (sample.time_label !== `T${sample.step_index}`) {
        return {
          valid: false,
          reason: `스텝 ${sample.step_index}의 time_label (${sample.time_label})이 불일치합니다.`,
        };
      }

      // Verify unit
      const expectedUnit = SENSOR_METADATA[sensorId].unit;
      if (sample.unit !== expectedUnit) {
        return {
          valid: false,
          reason: `센서 ${sensorId}의 단위 (${sample.unit})가 기대값 (${expectedUnit})과 일치하지 않습니다.`,
        };
      }

      // Verify quality flag valid enum
      if (!sample.quality_flag || typeof sample.quality_flag !== 'string' || !allowedQualityFlags.has(sample.quality_flag)) {
        return {
          valid: false,
          reason: `센서 ${sensorId} T${sample.step_index}에 비정형 품질 플래그 (${sample.quality_flag})가 포함되어 있습니다.`,
        };
      }

      // Verify data_origin presence and type
      if (!sample.data_origin || typeof sample.data_origin !== 'string' || sample.data_origin.trim().length === 0) {
        return {
          valid: false,
          reason: `센서 ${sensorId} T${sample.step_index}의 데이터 출처(data_origin) 규약이 유효하지 않습니다.`,
        };
      }

      // Verify measured value and quality flag invariants
      if (sensorId === 'RELATIVE_SIGNAL' && (sample.step_index === 4 || sample.step_index === 5)) {
        // T4 and T5 MUST be MISSING and measured_value MUST be strictly null (not 0, not string)
        if (sample.quality_flag !== 'MISSING') {
          return {
            valid: false,
            reason: `OES 상대 신호 T4/T5 구간은 반드시 MISSING 품질이어야 합니다 (현재: ${sample.quality_flag}).`,
          };
        }
        if (sample.measured_value !== null) {
          return {
            valid: false,
            reason: `OES 상대 신호 결측 구간(MISSING)의 계측값은 반드시 null이어야 하며 0 또는 다른 값으로 보간할 수 없습니다.`,
          };
        }
      } else {
        // All other points MUST have finite numeric values and quality_flag !== 'MISSING'
        if (sample.quality_flag === 'MISSING') {
          return {
            valid: false,
            reason: `연속 계측 센서/정상 스텝(${sensorId} T${sample.step_index})에 부당한 MISSING 플래그가 설정되었습니다.`,
          };
        }
        if (
          typeof sample.measured_value !== 'number' ||
          !Number.isFinite(sample.measured_value)
        ) {
          return {
            valid: false,
            reason: `센서 ${sensorId} T${sample.step_index}의 계측값이 유효한 숫자가 아닙니다 (${sample.measured_value}).`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Validates alerts response structure and verifies run lineage.
 * Supports expectedRunId scoping to ensure alarms strictly belong to the current active Run.
 */
export function validateAlertsSchema(
  alerts: unknown,
  expectedRunId?: string | null
): { valid: boolean; reason?: string } {
  if (!Array.isArray(alerts)) {
    return { valid: false, reason: '알람 응답 데이터가 배열 형식이 아닙니다 (Fail-closed).' };
  }

  // An empty array is a valid response (0 active alerts for this run)
  if (alerts.length === 0) {
    return { valid: true };
  }

  const allowedSeverities = new Set(['CRITICAL', 'WARNING', 'INFO']);
  const allowedStatuses = new Set(['ACTIVE', 'CLEARED', 'ACKNOWLEDGED', 'RESOLVED']);
  const seenAlertIds = new Set<string>();

  for (const alert of alerts) {
    if (!alert || typeof alert !== 'object') {
      return { valid: false, reason: '유효하지 않은 알람 객체가 포함되어 있습니다 (Fail-closed).' };
    }

    // Required identifier: alert_id
    if (!alert.alert_id || typeof alert.alert_id !== 'string' || alert.alert_id.trim().length === 0) {
      return { valid: false, reason: '알람 ID(alert_id)가 누락되었거나 유효하지 않습니다.' };
    }
    if (seenAlertIds.has(alert.alert_id)) {
      return { valid: false, reason: `중복된 알람 ID (${alert.alert_id})가 감지되었습니다.` };
    }
    seenAlertIds.add(alert.alert_id);

    // Required severity enum
    if (!alert.severity || typeof alert.severity !== 'string' || !allowedSeverities.has(alert.severity)) {
      return { valid: false, reason: `알람 ${alert.alert_id}의 심각도(severity: ${alert.severity})가 규격에 맞지 않습니다.` };
    }

    // Required status enum
    if (alert.status && (typeof alert.status !== 'string' || !allowedStatuses.has(alert.status))) {
      return { valid: false, reason: `알람 ${alert.alert_id}의 상태(status: ${alert.status})가 규격에 맞지 않습니다.` };
    }

    // Required equipment & chamber
    if (!alert.equipment_id || typeof alert.equipment_id !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 equipment_id가 누락되었습니다.` };
    }
    if (!alert.chamber_id || typeof alert.chamber_id !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 chamber_id가 누락되었습니다.` };
    }

    // Required rule_code & message
    if (!alert.rule_code || typeof alert.rule_code !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 rule_code가 누락되었습니다.` };
    }
    if (!alert.message || typeof alert.message !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 message가 누락되었습니다.` };
    }

    // Required event_time_utc
    if (!alert.event_time_utc || typeof alert.event_time_utc !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 event_time_utc가 누락되었습니다.` };
    }

    // Candidate wafers must be an array of strings
    if (alert.candidate_wafers !== undefined && alert.candidate_wafers !== null) {
      if (!Array.isArray(alert.candidate_wafers)) {
        return { valid: false, reason: `알람 ${alert.alert_id}의 candidate_wafers가 배열 형식이 아닙니다.` };
      }
      for (const w of alert.candidate_wafers) {
        if (typeof w !== 'string' || w.trim().length === 0) {
          return { valid: false, reason: `알람 ${alert.alert_id}의 candidate_wafers에 비정형 웨이퍼 ID가 포함되어 있습니다.` };
        }
      }
    }

    // Candidate lot type validation
    if (alert.candidate_lot !== undefined && alert.candidate_lot !== null && typeof alert.candidate_lot !== 'string') {
      return { valid: false, reason: `알람 ${alert.alert_id}의 candidate_lot 형식이 올바르지 않습니다.` };
    }

    // Run Lineage Check: When querying alerts for a specific run, all alerts must match expectedRunId
    if (expectedRunId) {
      if (!alert.run_id || alert.run_id !== expectedRunId) {
        return {
          valid: false,
          reason: `알람 ${alert.alert_id}의 Run ID (${alert.run_id})가 현재 활성 Run (${expectedRunId})과 일치하지 않습니다 (계통성 불일치, Fail-closed).`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Deterministic Mode A synthetic fixture generator matching the exact simulation
 * formula of FAB ONE Home (page.tsx). Guarantees a single unified synthetic reality!
 */
export function generateModeAEquipmentSamples(seed: number = 20261015): {
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

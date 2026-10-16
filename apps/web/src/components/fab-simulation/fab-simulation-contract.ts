/**
 * BUILD-07 FAB Simulation Contract & Invariants
 *
 * Implements deterministic simulation state machine, 25-wafer FOUP mapping,
 * T0~T7 sensor excursions, seed synchronization, and cross-page navigation links.
 */

export type SimulationStep =
  | 'READY'
  | 'FOUP_LOADED'
  | 'TRANSFER'
  | 'ETCH_RUNNING'
  | 'T7_EXCURSION'
  | 'INSPECTION_HOLD'
  | 'COMPLETE';

export type EquipmentStatus =
  | 'IDLE'
  | 'DOCKING'
  | 'TRANSFERRING'
  | 'PROCESSING'
  | 'ALARM_EXCURSION'
  | 'HOLD_SUSPENDED'
  | 'MAINTENANCE_STANDBY';

export type PlasmaStatus =
  | 'OFF'
  | 'IGNITING'
  | 'STABLE_PLASMA'
  | 'UNSTABLE_SPIKE'
  | 'PURGING';

export type ActiveWaferLocation =
  | 'FOUP'
  | 'LOADPORT'
  | 'ROBOT_ARM'
  | 'CHAMBER'
  | 'INSPECTION_BUFFER';

export type WaferExposureStatus =
  | 'CONFIRMED_EXPOSED'
  | 'CANDIDATE_EXPOSED'
  | 'NOT_EXPOSED';

export interface SimulatedWafer {
  slot: number;
  wafer_id: string;
  exposure_status: WaferExposureStatus;
  is_target_wafer: boolean;
  status_label: string;
  note: string;
}

export interface SimulationStepMeta {
  step: SimulationStep;
  order: number;
  name: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  equipmentStatus: EquipmentStatus;
  equipmentStatusLabel: string;
  chamberPlasma: PlasmaStatus;
  plasmaLabel: string;
  activeWaferLocation: ActiveWaferLocation;
  locationLabel: string;
  excursionDetected: boolean;
  alarmTriggered: boolean;
  progressPercent: number;
}

export const SIMULATION_STEPS: readonly SimulationStepMeta[] = [
  {
    step: 'READY',
    order: 0,
    name: '준비 대기',
    badge: 'Step 1/7',
    title: 'FOUP 카세트 로드포트 진입 준비',
    subtitle: 'Lot 입고 및 25매 웨이퍼 초기화 상태',
    description: '가상 FAB 로드포트에 25매 웨이퍼 FOUP 카세트가 대기 중입니다. 시연 대상 웨이퍼(W-08)가 지정 슬롯에 위치합니다.',
    equipmentStatus: 'IDLE',
    equipmentStatusLabel: '설비 대기 (IDLE)',
    chamberPlasma: 'OFF',
    plasmaLabel: '플라즈마 꺼짐 (OFF)',
    activeWaferLocation: 'FOUP',
    locationLabel: 'FOUP 카세트 내부',
    excursionDetected: false,
    alarmTriggered: false,
    progressPercent: 5,
  },
  {
    step: 'FOUP_LOADED',
    order: 1,
    name: 'FOUP 도킹',
    badge: 'Step 2/7',
    title: '로드포트 도킹 및 클램프 고정',
    subtitle: 'FEMP 도어 개방 및 매핑 센서 확인',
    description: '로드포트 진공 인터페이스가 체결되고 FOUP 도어가 개방되어 25매 웨이퍼 매핑이 완료되었습니다.',
    equipmentStatus: 'DOCKING',
    equipmentStatusLabel: '도킹 완료 (DOCKING)',
    chamberPlasma: 'OFF',
    plasmaLabel: '플라즈마 꺼짐 (OFF)',
    activeWaferLocation: 'LOADPORT',
    locationLabel: '로드포트 도크',
    excursionDetected: false,
    alarmTriggered: false,
    progressPercent: 20,
  },
  {
    step: 'TRANSFER',
    order: 2,
    name: '진공 이송',
    badge: 'Step 3/7',
    title: '이송 로봇 암의 시연 웨이퍼 파지 및 챔버 반입',
    subtitle: 'ETCH-02 / CH-B 슬릿 밸브 통과',
    description: '진공 이송 로봇(VTR)이 타겟 웨이퍼(W-08)를 파지하여 식각 챔버(CH-B) 정전척(ESC) 위로 로딩합니다.',
    equipmentStatus: 'TRANSFERRING',
    equipmentStatusLabel: '웨이퍼 이송 중 (TRANSFERRING)',
    chamberPlasma: 'IGNITING',
    plasmaLabel: '가스 도입 / 점화 준비 (IGNITING)',
    activeWaferLocation: 'ROBOT_ARM',
    locationLabel: '진공 이송 로봇 암',
    excursionDetected: false,
    alarmTriggered: false,
    progressPercent: 40,
  },
  {
    step: 'ETCH_RUNNING',
    order: 3,
    name: '식각 공정 진행',
    badge: 'Step 4/7',
    title: '건식 식각 공정 시계열 계측 (T0~T6)',
    subtitle: 'T4/T5 구간 OES 광학 센서 신호 결측 발생',
    description: '정전척에 척킹된 상태에서 플라즈마 식각이 진행됩니다. T4/T5 구간 광학 상대 신호(OES)가 결측(MISSING ≠ 0)되었으나 압력/RF는 정상 계측됩니다.',
    equipmentStatus: 'PROCESSING',
    equipmentStatusLabel: '공정 진행 중 (PROCESSING)',
    chamberPlasma: 'STABLE_PLASMA',
    plasmaLabel: '안정 플라즈마 (STABLE)',
    activeWaferLocation: 'CHAMBER',
    locationLabel: 'ETCH-02 / CH-B 챔버 정전척',
    excursionDetected: false,
    alarmTriggered: false,
    progressPercent: 60,
  },
  {
    step: 'T7_EXCURSION',
    order: 4,
    name: 'T7 공정 일탈',
    badge: 'Step 5/7',
    title: 'Step T7 센서 파라미터 복합 급증 (SPC UCL 초과)',
    subtitle: 'OES 상대 신호 80.0 a.u. (> UCL 65.0) 및 압력·RF 급증',
    description: '식각 종점 직전 T7 스텝에서 OES 광학 상대 신호가 관리한계(UCL 65.0 a.u.)를 크게 초과하고 챔버 압력/RF 출력이 동반 급증했습니다.',
    equipmentStatus: 'ALARM_EXCURSION',
    equipmentStatusLabel: '통계적 공정 일탈 (EXCURSION)',
    chamberPlasma: 'UNSTABLE_SPIKE',
    plasmaLabel: '불안정 서지 플라즈마 (SPIKE)',
    activeWaferLocation: 'CHAMBER',
    locationLabel: 'ETCH-02 / CH-B 챔버 내부',
    excursionDetected: true,
    alarmTriggered: true,
    progressPercent: 80,
  },
  {
    step: 'INSPECTION_HOLD',
    order: 5,
    name: 'FDC 경보 & Hold',
    badge: 'Step 6/7',
    title: 'FDC 실시간 알람 트리거 및 결함 검토 보류 (Hold)',
    subtitle: '후보 노출군 5매(W-08~W-12) 품질 검토 격리',
    description: 'FDC 규칙 UCL-01에 의해 긴급 알람(AL-DEMO-015)이 발행되고, W-08 및 인접 잠재 노출 후보군 웨이퍼가 품질 보류(Hold) 처리되었습니다.',
    equipmentStatus: 'HOLD_SUSPENDED',
    equipmentStatusLabel: '공정 보류 / 알람 정지 (HOLD)',
    chamberPlasma: 'PURGING',
    plasmaLabel: '챔버 퍼지 / 배기 (PURGING)',
    activeWaferLocation: 'INSPECTION_BUFFER',
    locationLabel: '품질 검사 버퍼 스테이션',
    excursionDetected: true,
    alarmTriggered: true,
    progressPercent: 95,
  },
  {
    step: 'COMPLETE',
    order: 6,
    name: '시뮬레이션 완료',
    badge: 'Step 7/7',
    title: '가상 공정 완료 및 엔지니어링 정밀 분석 전환',
    subtitle: 'Command Center · Equipment · Investigation · Traceability 연계',
    description: '단일 사이클 가상 FAB 시뮬레이션이 완료되었습니다. 엔지니어링 조사 상세 화면 및 이력 추적성 화면으로 이동하여 원인을 분석할 수 있습니다.',
    equipmentStatus: 'MAINTENANCE_STANDBY',
    equipmentStatusLabel: '점검 대기 (STANDBY)',
    chamberPlasma: 'OFF',
    plasmaLabel: '플라즈마 꺼짐 (OFF)',
    activeWaferLocation: 'INSPECTION_BUFFER',
    locationLabel: '대기 스테이션',
    excursionDetected: true,
    alarmTriggered: true,
    progressPercent: 100,
  },
];

/**
 * 25-wafer FOUP cassette deterministic fixture.
 * W-01 ~ W-07: CONFIRMED_EXPOSED (웨이퍼 노출 이력 확정, 결함 확정 아님)
 * W-08 ~ W-12: CANDIDATE_EXPOSED (잠재 영향 후보, 결함 확정 아님)
 * W-13 ~ W-25: NOT_EXPOSED (미가공 정상 대기)
 * Target demo wafer: W-08
 */
export function generateSimulatedFoupWafers(): SimulatedWafer[] {
  return Array.from({ length: 25 }, (_, i) => {
    const slot = i + 1;
    const wafer_id = `W-${slot < 10 ? '0' + slot : slot}`;
    const is_target_wafer = wafer_id === 'W-08';

    if (slot <= 7) {
      return {
        slot,
        wafer_id,
        exposure_status: 'CONFIRMED_EXPOSED',
        is_target_wafer: false,
        status_label: '노출 이력 확정',
        note: '챔버 노출 이력이 확정된 정상 처리 웨이퍼 (결함 확정 아님)',
      };
    } else if (slot >= 8 && slot <= 12) {
      return {
        slot,
        wafer_id,
        exposure_status: 'CANDIDATE_EXPOSED',
        is_target_wafer,
        status_label: is_target_wafer ? '시연 대상 (잠재 후보)' : '잠재 영향 후보',
        note: 'T7 구간 공정 일탈 발생 시 챔버 내/인접 슬롯에 위치하여 품질 검토 보류된 후보군 (결함 확정 아님)',
      };
    } else {
      return {
        slot,
        wafer_id,
        exposure_status: 'NOT_EXPOSED',
        is_target_wafer: false,
        status_label: '미노출 대기',
        note: '공정 미진입 정상 대기 웨이퍼',
      };
    }
  });
}

/**
 * Sensor telemetry snapshot for a given step.
 * Preserves T4/T5 null/MISSING and T7 excursion invariants.
 */
export interface StepTelemetrySnapshot {
  oes_signal: number | null;
  oes_quality: 'GOOD' | 'MISSING' | 'SUSPECT';
  chamber_pressure: number;
  pressure_quality: 'GOOD' | 'SUSPECT';
  rf_power: number;
  rf_quality: 'GOOD' | 'SUSPECT';
  ucl_limit: number;
  is_excursion: boolean;
  step_label: string;
}

export function getTelemetrySnapshotForStep(step: SimulationStep, seed: number = 20261015): StepTelemetrySnapshot {
  let s = Math.abs(seed);
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const noise = (nextRand() - 0.5) * 1.0;

  switch (step) {
    case 'READY':
    case 'FOUP_LOADED':
      return {
        oes_signal: 0,
        oes_quality: 'GOOD',
        chamber_pressure: +(10.0 + noise * 0.2).toFixed(1),
        pressure_quality: 'GOOD',
        rf_power: 0,
        rf_quality: 'GOOD',
        ucl_limit: 65.0,
        is_excursion: false,
        step_label: 'IDLE',
      };
    case 'TRANSFER':
      return {
        oes_signal: 0,
        oes_quality: 'GOOD',
        chamber_pressure: +(15.0 + noise * 0.3).toFixed(1),
        pressure_quality: 'GOOD',
        rf_power: 0,
        rf_quality: 'GOOD',
        ucl_limit: 65.0,
        is_excursion: false,
        step_label: 'VACUUM',
      };
    case 'ETCH_RUNNING':
      // T4/T5 missing demonstration
      return {
        oes_signal: null, // Strictly null for T4/T5 missing
        oes_quality: 'MISSING',
        chamber_pressure: +(120.2 + noise * 0.4).toFixed(1),
        pressure_quality: 'GOOD',
        rf_power: +(1500.2 + noise * 3.0).toFixed(1),
        rf_quality: 'GOOD',
        ucl_limit: 65.0,
        is_excursion: false,
        step_label: 'T4/T5 (MISSING)',
      };
    case 'T7_EXCURSION':
    case 'INSPECTION_HOLD':
    case 'COMPLETE':
      return {
        oes_signal: +(80.0 + (nextRand() - 0.5) * 4.0).toFixed(1),
        oes_quality: 'SUSPECT',
        chamber_pressure: +(168.5 + (nextRand() - 0.5) * 5.0).toFixed(1),
        pressure_quality: 'SUSPECT',
        rf_power: +(1820.0 + (nextRand() - 0.5) * 20.0).toFixed(1),
        rf_quality: 'SUSPECT',
        ucl_limit: 65.0,
        is_excursion: true,
        step_label: 'T7 (EXCURSION)',
      };
  }
}

/**
 * Domain disclaimers for Fab Simulation.
 */
export const DOMAIN_DISCLAIMERS = {
  excursionVsDefect: '통계적 UCL 초과 공정 일탈(Excursion ≠ Defect)은 장비 파라미터의 관리한계 일탈 신호이며 제품 불량 확정이 아닙니다.',
  exposureStatus: 'CONFIRMED_EXPOSED는 챔버 노출 이력 확정이며 결함 확정이 아닙니다. CANDIDATE_EXPOSED는 잠재 영향 후보일 뿐 결함이 아닙니다.',
  missingNotZero: 'OES 상대 신호 T4/T5 결측(MISSING ≠ 0)은 광학 센서 일시 드롭아웃이며 0으로 변조하지 않고 null로 처리됩니다.',
  simulationMode: '본 화면은 가상 반도체 FAB 공정 시연을 위한 합성 픽스처 시뮬레이션입니다 (Real-time FAB operation 아님).',
};

/**
 * Valid seed parser with safe integer bounds.
 */
export function parseSafeSimulationSeed(raw: string | null | undefined): number {
  if (raw) {
    const num = Number(raw);
    if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
      return num;
    }
  }
  return 20261015;
}

/**
 * Generate cross-page navigation links maintaining seed and Run context.
 */
export function getSimulationNavLinks(seed: number) {
  const safeSeed = parseSafeSimulationSeed(String(seed));
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
    engineeringWorkspace: `/engineering-workspace?alert=${encodeURIComponent(alertId)}&seed=${safeSeed}`,
  };
}

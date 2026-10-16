/**
 * BUILD-09 FAB ONE Integrated Guided Demo Contract & Invariants
 *
 * Implements the 3-5 minute guided user journey state machine,
 * cross-screen context preservation, story steps navigation, and domain safeguards.
 */

export type TourStepId =
  | 'INTRO'
  | 'SIMULATE'
  | 'EXCURSION'
  | 'ALARM'
  | 'SENSOR'
  | 'TRACE'
  | 'WORKSPACE'
  | 'FINISH';

export interface TourStep {
  id: TourStepId;
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  keyCheckpoints: string[];
  targetRoute: string;
  actionLabel: string;
  badgeText: string;
  domainNotes: string;
}

export const TOUR_DOMAIN_DISCLAIMERS = {
  excursionVsDefect: '통계적 UCL 초과 공정 일탈(Excursion ≠ Defect)은 장비 센서의 관리한계 일탈 신호이며 제품 불량 확정이 아닙니다.',
  exposureStatus: 'CONFIRMED_EXPOSED는 챔버 노출 이력 확정이며 결함 확정이 아닙니다. CANDIDATE_EXPOSED는 잠재 영향 검토 후보군입니다.',
  missingNotZero: 'OES 상대 신호 T4/T5 결측(MISSING ≠ 0)은 광학 센서 일시 드롭아웃이며 0으로 변조하지 않고 null로 처리됩니다.',
  spcVsSpec: 'UCL/LCL은 센서 시계열의 통계적 공정 관리한계(SPC)이며 제품 규격(USL/LSL)과 다릅니다.',
  syntheticDisclaimer: '모든 데이터는 Mode A 결정론적 합성 시나리오이며 실제 반도체 팹(MES/FDC) 제어 명령을 발행하지 않습니다.',
  hypothesisDisclaimer: '엔지니어링 워크스페이스의 가설 및 체크리스트는 엔지니어의 로컬 검토 의견일 뿐 자동 원인 규명(RCA)이나 품질 판정이 아닙니다.',
  noRealFactoryControl: '실제 FAB 운영, 자동화 로봇 제어, MES 홀드 등록 및 양산 수율 예측 주장이 포함되지 않은 프로토타입 시연입니다.',
};

export const TOUR_COMPLETION_SUMMARY = [
  {
    title: '1. FDC 실시간 경보 감지 (Command Center)',
    description: '통계적 관리한계(SPC Rule UCL-01) 초과를 FDC Sentinel이 즉시 탐지하여 공정 라인 격리 및 알람 큐에 등록.',
  },
  {
    title: '2. 센서 계측 근거 및 관측 품질 검증 (Equipment Intelligence)',
    description: 'OES, 압력, RF 전력의 복합 일탈과 T4/T5 광학 결측(MISSING ≠ 0) 분절을 과학적으로 분리하여 관측 사실성 확보.',
  },
  {
    title: '3. 웨이퍼 단위 이력 추적성 격리 (Wafer Traceability)',
    description: '25매 FOUP 카세트 중 선행 정상 노출군(W-01~07)을 보호하고, 일탈 노출 후보군(W-08~12)을 잠재 영향군으로 타겟 격리.',
  },
  {
    title: '4. 엔지니어링 백보드 기반 가설 검증 (Engineering Workspace)',
    description: 'RF Matcher 서지, Throttle 밸브 지연, 광학 셔터 결측 등 후보 가설을 계측 증거와 실시간 맵핑하여 체계적 검토.',
  },
  {
    title: '5. 반도체 공학 도메인 지식 연계 (Engineering Knowledge Links)',
    description: '플라즈마 방전 물리, 식각 속도 계산 모델, 통계적 관리한계 원리 등 EKL 사전과 연동된 전문 지식 습득.',
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'INTRO',
    stepNumber: 1,
    title: 'FAB ONE 가상 반도체 제조 라인 개요',
    subtitle: '스마트 FAB FDC 엔드투엔드 통합 시연 안내 (3~5분 코스)',
    description:
      'FAB ONE은 300mm 웨이퍼 식각(Etch) 공정에서 발생하는 센서 결측, 공정 일탈, FDC 실시간 경보, 웨이퍼 이력 추적성, 엔지니어링 가설 검증을 하나의 완결된 사용자 여정으로 제공합니다.',
    keyCheckpoints: [
      '결정론적 합성 시나리오 (기본 seed: 20261015 · Run: RUN-DEMO-015 · Alert: AL-DEMO-015)',
      '도메인 불변식 (Excursion ≠ Defect, MISSING ≠ 0, CANDIDATE_EXPOSED ≠ 결함 확정)',
    ],
    targetRoute: '/',
    actionLabel: '식각 챔버 시뮬레이터(Home) 확인 ↗',
    badgeText: '시작 안내 (Overview)',
    domainNotes: '오프라인 합성(Mode A) 기반 시연으로 실제 생산 설비 제어 명령을 발행하지 않습니다.',
  },
  {
    id: 'SIMULATE',
    stepNumber: 2,
    title: '가상 FAB 공정 타임라인 시연 (2.5D 가상 레이아웃)',
    subtitle: 'FOUP 입고 → 로드포트 도킹 → 진공 이송 → ETCH-02 식각 챔버 진행',
    description:
      '25매 웨이퍼를 담은 FOUP 카세트가 로드포트에 도킹되어 챔버 진공 배기 후 플라즈마 식각 스텝(T0~T6)을 순차적으로 진행합니다. T4/T5 구간에서 광학 상대 신호(OES) 결측(MISSING)이 발생합니다.',
    keyCheckpoints: [
      '로드포트 도킹 및 챔버 진공 배기 상태 전이 시연',
      'T4/T5 스텝 광학 방출 분광 센서(OES) 일시 드롭아웃 (MISSING ≠ 0 관측 사실)',
    ],
    targetRoute: '/fab-simulation',
    actionLabel: 'FAB 시뮬레이션 화면 열기 ↗',
    badgeText: '공정 시뮬레이션 (Simulation)',
    domainNotes: 'T4/T5 구간 결측은 센서 관측 사실일 뿐 공정 일탈의 직접 원인이 아닙니다.',
  },
  {
    id: 'EXCURSION',
    stepNumber: 3,
    title: 'Step T7 복합 센서 공정 일탈 (Excursion Spike)',
    subtitle: '식각 종점 구간 OES 신호 급증 (> UCL 65.0) 및 압력·RF 전력 서지 (기준 시나리오: OES ~80.0 a.u., 168.5 mTorr, 1820 W)',
    description:
      '식각 종점 T7 스텝에서 OES 상대 신호가 관리한계(UCL 65.0 a.u.)를 초과하며, 챔버 압력(기준 120 mTorr)과 RF Power(기준 1500 W)가 동반 급증하는 통계적 공정 일탈이 발생합니다 (기준 시나리오 대표값: OES ~80.0 a.u., 168.5 mTorr, 1820 W; Seed에 따른 합성 계측값 정합 연동).',
    keyCheckpoints: [
      'OES 상대 신호 통계적 관리한계 초과 (UCL 65.0 a.u. 상한 이탈)',
      '챔버 압력(120 → ~168.5 mTorr) 및 RF Power(1500 → ~1820 W) 동반 서지',
    ],
    targetRoute: '/fab-simulation',
    actionLabel: 'T7 일탈 타임라인 확인 ↗',
    badgeText: '공정 일탈 (Excursion)',
    domainNotes: '수치는 시드별 합성 계측값이며, 개념 설명 카드에는 기준 시나리오 대표값(~80.0 a.u. / ~168.5 mTorr / ~1820 W)이 안내됩니다. 통계적 관리한계 일탈(Excursion)은 센서 이상 관측일 뿐 완제품 불량 확정이 아닙니다.',
  },
  {
    id: 'ALARM',
    stepNumber: 4,
    title: 'FDC 커맨드 센터 실시간 경보 감지',
    subtitle: 'Rule FDC-RULE-SPC-UCL-01 발령 및 실시간 알람 큐 등록',
    description:
      'FDC 감시 센티넬이 Step T7 복합 일탈을 즉시 포착하여 CRITICAL 등급 경보(AL-DEMO-015)를 발행하고 장비 인터락 및 품질 Hold 검토를 권고합니다.',
    keyCheckpoints: [
      '활성 알람 큐 (Alert ID: AL-DEMO-015 · 심각도: CRITICAL · 상태: ACTIVE)',
      '통계 룰 트리거 (FDC-RULE-SPC-UCL-01: OES/압력/RF 복합 상한 초과)',
    ],
    targetRoute: '/command-center',
    actionLabel: 'FDC 커맨드 센터 열기 ↗',
    badgeText: '경보 감지 (Alarm Sentinel)',
    domainNotes: '알람 큐 조작은 시뮬레이션 인터페이스이며 실제 생산 라인 FDC 서버에 영향을 주지 않습니다.',
  },
  {
    id: 'SENSOR',
    stepNumber: 5,
    title: '설비 인텔리전스 센서 원본 시계열 검증',
    subtitle: 'ETCH-02 / CH-B OES 상대 신호, 챔버 압력, RF 전력 시계열 분석',
    description:
      '연속 센서(압력, RF)의 unbroken 연결선과 광학 센서(OES)의 T4/T5 결측 분절선을 대조하여 관측 품질 결함과 공정 일탈의 시점을 정밀 분리 검증합니다.',
    keyCheckpoints: [
      '광학 센서(RELATIVE_SIGNAL) T4/T5 결측 분절선 및 UCL 65.0 관리한계선 확인',
      '연속 센서(CHAMBER_PRESSURE, RF_POWER) T0~T7 단절 없는 시계열 대조',
    ],
    targetRoute: '/equipment-intelligence?sensor=RELATIVE_SIGNAL',
    actionLabel: '설비 인텔리전스 차트 열기 ↗',
    badgeText: '계측 분석 (Sensor Intelligence)',
    domainNotes: 'T4/T5 null 값은 0으로 왜곡하지 않고 결측 구간으로 엄격히 처리됩니다.',
  },
  {
    id: 'TRACE',
    stepNumber: 6,
    title: '웨이퍼 단위 이력 추적성 및 노출군 분류',
    subtitle: '25매 FOUP 카세트 내 CONFIRMED_EXPOSED vs CANDIDATE_EXPOSED 분리',
    description:
      'FOUP 내 25매 웨이퍼 중 선행 완료된 W-01~07은 정상 노출군(CONFIRMED_EXPOSED, 결함 아님)으로 확정하고, 일탈 발생 시점에 챔버에 노출된 W-08~12(타겟: W-08)를 잠재 영향 후보군(CANDIDATE_EXPOSED)으로 격리합니다.',
    keyCheckpoints: [
      'W-01~W-07 (7매): 정상 공정 완료 확정군 (CONFIRMED_EXPOSED ≠ 불량)',
      'W-08~W-12 (5매): T7 일탈 잠재 영향 후보군 (타겟 W-08 검토 대상)',
    ],
    targetRoute: '/traceability?wafer=W-08',
    actionLabel: 'W-08 웨이퍼 추적성 열기 ↗',
    badgeText: '추적성 격리 (Traceability)',
    domainNotes: 'CANDIDATE_EXPOSED는 잠재 영향 검토 후보군이며 결함 확정 판정이 아닙니다.',
  },
  {
    id: 'WORKSPACE',
    stepNumber: 7,
    title: '엔지니어링 워크스페이스 가설 검증 및 조치 점검',
    subtitle: '증거 보드 4건 정리, 3대 후보 가설 비교, 4대 조치 체크리스트',
    description:
      '관측 사실(Evidence)과 엔지니어링 가설(Hypothesis)을 엄격히 구분하고, 가설 상태 순환(UNVERIFIED → SUPPORTED_FOR_REVIEW) 및 증거 맵핑 토글을 통해 체계적 원인 검토를 시연합니다.',
    keyCheckpoints: [
      '증거 보드 4건 (T4/T5 MISSING, T7 Excursion, UCL-01 알람, W-08 후보군)',
      '가설 3종 상태 순환 및 증거 연결, 4대 조치 체크리스트 및 메모',
    ],
    targetRoute: '/engineering-workspace',
    actionLabel: '엔지니어링 워크스페이스 열기 ↗',
    badgeText: '가설·조치 검토 (Engineering Workspace)',
    domainNotes: '가설 검토는 엔지니어의 로컬 시연 의견이며 자동 원인 규명(RCA)이나 품질 판정이 아닙니다.',
  },
  {
    id: 'FINISH',
    stepNumber: 8,
    title: 'FAB ONE 가이드 투어 완료 및 엔지니어링 판단 요약',
    subtitle: '스마트 FAB 5대 핵심 엔지니어링 판단 경험 완료',
    description:
      'FAB 시뮬레이션부터 FDC 경보, 설비 인텔리전스, 웨이퍼 추적성, 엔지니어링 워크스페이스까지 반도체 공정 일탈 대응의 전 여정을 완주했습니다. 각 화면으로 자유롭게 이동하여 심층 탐색을 계속할 수 있습니다.',
    keyCheckpoints: [
      '5대 엔지니어링 판단 요약 (경보 감지, 센서 계측 근거, 추적성 격리, 가설 검증, EKL 사전)',
      '전체 6개 화면 간 자유로운 상호 이동 및 시드(Seed) 맥락 보존',
    ],
    targetRoute: '/demo-tour',
    actionLabel: '가이드 투어 처음부터 다시 시작 ↺',
    badgeText: '투어 완료 (Tour Completed)',
    domainNotes: '실제 불량/원인 확정/양산 지표 예측/실제 설비 검사 실행 주장 없음.',
  },
];

/**
 * Valid seed parser with safe integer bounds.
 */
export function parseSafeTourSeed(raw: string | null | undefined): number {
  if (raw) {
    const num = Number(raw);
    if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
      return num;
    }
  }
  return 20261015;
}

/**
 * Valid step parser with safe fallback.
 */
export function parseSafeTourStep(raw: string | null | undefined): TourStepId {
  if (!raw) return 'INTRO';
  const upper = raw.trim().toUpperCase();
  const match = TOUR_STEPS.find((s) => s.id === upper);
  return match ? match.id : 'INTRO';
}

/**
 * Calculate progress percentage (12.5% to 100%).
 */
export function calculateTourProgress(step: TourStepId): number {
  const index = TOUR_STEPS.findIndex((s) => s.id === step);
  if (index === -1) return 12.5;
  return Math.round(((index + 1) / TOUR_STEPS.length) * 100);
}

/**
 * Get next sequential tour step.
 */
export function getNextTourStep(current: TourStepId): TourStepId {
  const index = TOUR_STEPS.findIndex((s) => s.id === current);
  if (index === -1 || index >= TOUR_STEPS.length - 1) {
    return 'FINISH';
  }
  return TOUR_STEPS[index + 1].id;
}

/**
 * Get previous sequential tour step.
 */
export function getPrevTourStep(current: TourStepId): TourStepId {
  const index = TOUR_STEPS.findIndex((s) => s.id === current);
  if (index <= 0) {
    return 'INTRO';
  }
  return TOUR_STEPS[index - 1].id;
}

/**
 * Get tour step details by ID.
 */
export function getTourStepDetails(stepId: TourStepId): TourStep {
  return TOUR_STEPS.find((s) => s.id === stepId) || TOUR_STEPS[0];
}

/**
 * Cross-screen navigation links maintaining seed and Run context.
 */
export function getTourNavLinks(step: TourStepId, seed: number) {
  const safeSeed = parseSafeTourSeed(String(seed));
  const runId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

  const currentStep = getTourStepDetails(step);

  let targetUrl = `${currentStep.targetRoute}${currentStep.targetRoute.includes('?') ? '&' : '?'}seed=${safeSeed}`;
  if (step === 'ALARM' || step === 'WORKSPACE') {
    targetUrl += `&alert=${encodeURIComponent(alertId)}`;
  } else if (step === 'INTRO') {
    targetUrl = `/?alert=${encodeURIComponent(alertId)}&investigation=true&seed=${safeSeed}`;
  } else if (step === 'FINISH') {
    targetUrl = `/demo-tour?step=INTRO&seed=${safeSeed}`;
  }

  if (step !== 'FINISH') {
    targetUrl += `&tourStep=${step}`;
  }

  return {
    runId,
    alertId,
    lotId,
    targetUrl,
    home: `/?alert=${encodeURIComponent(alertId)}&investigation=true&seed=${safeSeed}&tourStep=${step}`,
    fabSimulation: `/fab-simulation?seed=${safeSeed}&tourStep=${step}`,
    commandCenter: `/command-center?seed=${safeSeed}&alert=${encodeURIComponent(alertId)}&tourStep=${step}`,
    equipmentIntelligence: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=${safeSeed}&tourStep=${step}`,
    traceability: `/traceability?wafer=W-08&seed=${safeSeed}&tourStep=${step}`,
    engineeringWorkspace: `/engineering-workspace?alert=${encodeURIComponent(alertId)}&seed=${safeSeed}&tourStep=${step}`,
    demoTour: (targetStep: TourStepId = step) => `/demo-tour?step=${targetStep}&seed=${safeSeed}`,
  };
}

/**
 * Unified Mode A T7 excursion telemetry values.
 * Harmonizes deterministic sensor measurements across Fab Simulation, Home,
 * Equipment Intelligence, and Engineering Workspace.
 */
export interface ModeAT7ExcursionValues {
  oesSignal: number;
  chamberPressure: number;
  rfPower: number;
  baselineOes: number;
  baselinePressure: number;
  baselineRf: number;
  uclLimit: number;
  benchmarkSummary: string;
}

export function getModeAT7ExcursionValues(seed: number = 20261015): ModeAT7ExcursionValues {
  const safeSeed =
    seed && Number.isInteger(Number(seed)) && Number(seed) > 0 && Number(seed) < 1000000000
      ? Number(seed)
      : 20261015;

  let s = Math.abs(safeSeed);
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const relNoise = (nextRand() - 0.5) * 2.0;
  const prsNoise = (nextRand() - 0.5) * 1.5;
  const rfNoise = (nextRand() - 0.5) * 20.0;

  const oesSignal = +(80.0 + (nextRand() - 0.5) * 4.0).toFixed(1);
  const chamberPressure = +(168.5 + (nextRand() - 0.5) * 5.0).toFixed(1);
  const rfPower = +(1820.0 + rfNoise).toFixed(1);

  return {
    oesSignal,
    chamberPressure,
    rfPower,
    baselineOes: 50.0,
    baselinePressure: 120.0,
    baselineRf: 1500.0,
    uclLimit: 65.0,
    benchmarkSummary: '기준 시나리오 대표값: OES ~80.0 a.u., 압력 ~168.5 mTorr, RF ~1820 W',
  };
}

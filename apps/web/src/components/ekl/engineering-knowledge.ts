/**
 * FAB ONE - Engineering Knowledge Layer (EKL) Data Definitions
 * 
 * Manages typed engineering domain concepts, definitions, units,
 * virtual calculation models, and deep-dive engineering boundaries.
 * 
 * Strict Domain Invariant:
 * All calculations and limits are for educational/simulation illustration only.
 * They are clearly tagged with illustrative/synthetic disclaimer and never
 * claimed as verified production FAB equipment thresholds.
 */

export type ConceptId =
  | 'oes-relative-signal'
  | 'chamber-pressure'
  | 'rf-power'
  | 'spc-ucl-missing'
  | 'wafer-exposure-status'
  | 'etch-rate';

export interface DeepDiveSection {
  physicalQuantityVsProcess: string;
  controlLimitsVsSpecLimits: string;
  missingVsZero: string;
  sensorAnomalyVsDefect: string;
  exposureStatusMeaning: string;
}

export interface VirtualCalculationModel {
  formulaDisplay: string;
  interactive: boolean;
  variableName: string;
  defaultInputs: {
    initialThickness: number;
    finalThickness: number;
    processTimeMinutes: number;
  };
  unit: string;
  description: string;
}

export interface KnowledgeConcept {
  conceptId: ConceptId;
  term: string;
  koreanName: string;
  unit: string;
  category: 'SENSOR' | 'STATISTICS' | 'QUALITY' | 'PHYSICS';
  summary: string;
  definition: string;
  assumption: string;
  calculationModel?: VirtualCalculationModel;
  interpretationCaveats: string[];
  reviewStatus: string;
  deepDive: {
    title: string;
    subtitle: string;
    sections: DeepDiveSection;
  };
}

export const KNOWLEDGE_CONCEPTS: Record<ConceptId, KnowledgeConcept> = {
  'oes-relative-signal': {
    conceptId: 'oes-relative-signal',
    term: 'OES RELATIVE_SIGNAL',
    koreanName: 'OES 광학 발광 상대 신호',
    unit: 'a.u. (Arbitrary Unit)',
    category: 'SENSOR',
    summary: '플라즈마 방전 중 특정 화학종의 광학 방출 강도를 상대적 크기로 나타낸 지표.',
    definition: 'Optical Emission Spectroscopy(OES) 센서는 플라즈마 내에서 활성화된 라디칼과 이온이 기저 상태로 전이하면서 방출하는 고유 파장의 빛 강도를 측정합니다. 특정 반응 생성물(by-product)의 고갈 시점을 감지하여 종말점(Endpoint Detection, EPD)을 결정하는 핵심 센서입니다.',
    assumption: '광학 검출기(Spectrometer) 광경로 뷰포트의 오염이 없으며, 플라즈마 시스(Sheath) 밀도가 일정하다는 가상 조건.',
    interpretationCaveats: [
      '임의 단위(a.u.)는 상대적 강도 비교용이며, 절대적인 막 두께나 식각 깊이(nm)로 직접 변환할 수 없습니다.',
      '챔버 뷰포트 오염, 윈도우 증착, 센서 감도 저하로 인해 신호 기준선(Baseline)이 점진적으로 드리프트될 수 있습니다.',
      'T7 구간의 급격한 신호 스파이크는 플라즈마 아킹(Arcing) 또는 가스 유량 불균형 가능성을 시사하지만, 웨이퍼 단면 결함 여부는 검측 전까지 확정할 수 없습니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 예시 (A01/A04 검수 전)',
    deepDive: {
      title: 'OES 광학 신호와 플라즈마 공정 해석',
      subtitle: '물리적 발광 메커니즘과 통계적 감시의 한계',
      sections: {
        physicalQuantityVsProcess: 'OES가 측정하는 물리량은 광자 검출기(CCD/PMT)에 도달한 특정 파장의 광학 광자 수(Photon Flux)입니다. 공정적 의미로는 플라즈마 내 반응성 화학종(예: F*, Cl*, CF2*)의 농도 변화 및 식각 부산물(SiF4 등)의 생성 추이를 반영합니다.',
        controlLimitsVsSpecLimits: 'OES 신호의 UCL(Upper Control Limit)은 정상 공정 상태에서 수집된 시계열 통계(3-Sigma)를 기반으로 설정한 공정 관리한계입니다. 이는 웨이퍼 박막의 물리적 규격 한계(USL/LSL)와 완전히 다르며, UCL을 초과했다고 해서 웨이퍼가 즉시 규격 미달 폐기품이 되는 것은 아닙니다.',
        missingVsZero: 'OES 신호의 결측(MISSING)은 고속 샘플링 통신 패킷 유실 또는 광학 셔터 인터록에 의해 데이터 수집이 누락된 상태입니다. 신호 강도가 0인 것은 플라즈마 방전이 완전히 꺼진 상태(Plasma Extinction)를 의미하므로, 결측치와 0은 엄격히 분리되어야 합니다.',
        sensorAnomalyVsDefect: 'T7 시점의 OES 신호 급상승(Excursion)은 플라즈마 상태 이상 징후입니다. 그러나 실제 패턴 손상이나 잔여막(Under-etch) 발생 여부는 공정 완료 후 결함 검측(In-line Defect Inspection)을 통해서만 최종 확정됩니다.',
        exposureStatusMeaning: '이상 발생 시점(T7)에 챔버 내에서 메인 식각 중이던 웨이퍼는 CONFIRMED_EXPOSED(노출 확정)로 분류되며, 진공 로드락에서 대기 중이던 후속 웨이퍼는 CANDIDATE_EXPOSED(잠재 영향군)로 분류되어 우선 검측 큐에 배정됩니다.'
      }
    }
  },

  'chamber-pressure': {
    conceptId: 'chamber-pressure',
    term: 'CHAMBER_PRESSURE',
    koreanName: '챔버 공정 압력',
    unit: 'mTorr (밀리토르)',
    category: 'PHYSICS',
    summary: '진공 반응 챔버 내부의 절대 압력으로, 분자 간 충돌 빈도와 플라즈마 이온 방향성을 결정.',
    definition: '챔버 압력은 공정 가스(Ar, CF4, O2 등)의 질량 유량 제어기(MFC) 투입량과 터보 분자 펌프(TMP) 전단의 스로틀 밸브(Throttle Valve / Pendulum Valve) 개폐율의 균형에 의해 제어되는 챔버 내부 진공도입니다.',
    assumption: '커패시턴스 마노미터(Capacitance Manometer) 압력 게이지의 영점 보정(Zero Drift Calibration)이 정상 수행되었다는 가정.',
    interpretationCaveats: [
      '압력이 낮아지면(저압) 평균 자유 행정(Mean Free Path)이 길어져 이온의 직진성이 강화되나 플라즈마 밀도가 낮아질 수 있습니다.',
      '압력이 높아지면(고압) 라디칼 농도가 증가하여 등방성 화학 식각 비율이 높아질 수 있습니다.',
      '과도 응답(Transients) 구간의 일시적 압력 요동(Hunting)은 밸브 PID 제어 응답일 수 있으며 공정 불량을 의미하지 않습니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 예시 (A01/A04 검수 전)',
    deepDive: {
      title: '챔버 진공 압력과 식각 이온 거동',
      subtitle: '가스 동역학과 스로틀 밸브 제어 특성',
      sections: {
        physicalQuantityVsProcess: '측정하는 물리량은 진공 챔버 격벽에 가해지는 기체 분자의 충돌 압력(mTorr)입니다. 공정적 의미로는 플라즈마 내 이온 충돌 에너지 분포 및 화학적 중성종(Neutral Radicals)의 확산 속도를 조절하는 기본 환경 변수입니다.',
        controlLimitsVsSpecLimits: '압력 관리한계(UCL/LCL, 예: ±3 mTorr)는 압력 제어 시스템(APC)의 정상 작동 범위를 감시합니다. 제품 규격한계(예: 트렌치 선폭 CD 규격 ±2nm)와 직접 등가 비교할 수 없습니다.',
        missingVsZero: '압력 센서 결측(MISSING)은 인터페이스 통신 지연입니다. 압력 0 mTorr는 초고진공(Ultra-High Vacuum)을 뜻하므로, 통신 유실을 압력 0으로 기록하면 평균 진공도 계산이 심각하게 왜곡됩니다.',
        sensorAnomalyVsDefect: '압력 일탈(Pressure Excursion)이 발생하면 식각 프로파일(Profile)의 비등방성 변형 가능성이 존재하지만, 웨이퍼 불량 확정은 CD-SEM 측정 데이터와의 상관 분석을 거쳐야 합니다.',
        exposureStatusMeaning: '공정 도중 압력 일탈이 발생한 챔버에서 가공 완료된 웨이퍼는 CONFIRMED_EXPOSED로 기록되며, 설비 인터록으로 진입이 차단된 웨이퍼는 CANDIDATE 또는 NOT_EXPOSED 상태를 유지합니다.'
      }
    }
  },

  'rf-power': {
    conceptId: 'rf-power',
    term: 'RF_POWER',
    koreanName: '고주파 전력 (RF Source & Bias Power)',
    unit: 'W (Watts)',
    category: 'PHYSICS',
    summary: '플라즈마 방전 생성 및 이온 가속 에너지를 유도하기 위해 인가되는 고주파 전기 전력.',
    definition: '고주파 발생기(RF Generator, 통상 13.56 MHz / 2 MHz)에서 출력되어 임피던스 정합기(Auto Matcher)를 거쳐 챔버 전극 및 웨이퍼 정전척(ESC)에 인가되는 전기 전력입니다. 플라즈마 이온 밀도와 웨이퍼 표면 충격 에너지를 직접 지배합니다.',
    assumption: '임피던스 매처의 반사 전력(Reflected Power)이 유효 전력의 2% 미만으로 튜닝되어 플라즈마로 효율적으로 전달된다는 전제.',
    interpretationCaveats: [
      '인가 전력(Forward Power)과 실제 플라즈마에 흡수된 전달 전력(Delivered Power) 간에는 전송선로 손실이 존재합니다.',
      'RF 전력 급증은 챔버 아킹(Arcing)이나 이상 방전을 유발하여 웨이퍼 표면 파티클 오염을 초래할 수 있습니다.',
      '전력 수치가 UCL을 일시 초과하더라도 반사파가 즉시 복구되었다면 웨이퍼 손상이 경미할 수 있습니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 예시 (A01/A04 검수 전)',
    deepDive: {
      title: 'RF 전력 전달과 플라즈마 시스(Sheath) 전위',
      subtitle: '발생기 출력, 매칭 네트워크 손실, 웨이퍼 바이어스 전압',
      sections: {
        physicalQuantityVsProcess: '측정되는 물리량은 RF 센서에서 계측된 순방향 고주파 유효 전력(W)입니다. 공정적으로는 플라즈마 내 전자 온도 및 이온 시스를 가로지르는 셀프 바이어스 전압(V_dc)을 결정합니다.',
        controlLimitsVsSpecLimits: 'RF UCL(예: 1,650W)은 제너레이터 출력의 통계적 관리 한계선입니다. 제품 파괴 전압이나 게이트 산화막 항복 전압(Breakdown Voltage)과 같은 물리적 소자 한계(Spec Limit)와 구분됩니다.',
        missingVsZero: 'RF 전력 결측(MISSING)은 RF 간섭(EMI/EMC)으로 인한 계측 버스 타임아웃일 수 있습니다. RF 전력 0W는 플라즈마 소등 상태를 나타내므로 혼동해서는 안 됩니다.',
        sensorAnomalyVsDefect: 'RF Power 스파이크가 발생했더라도 정전척 헬륨 백사이드 냉각(ESC He Cooling)이 정상 유지되었다면 열적 손상이 발생하지 않았을 가능성이 있으며, 전기적 특성(ET) 시험 전까지는 잠재 불량으로 취급됩니다.',
        exposureStatusMeaning: 'RF 이상 시점에 척 위에 고정되어 있던 웨이퍼는 CONFIRMED_EXPOSED로 기록되며, 로드락에 대기 중이던 웨이퍼는 CANDIDATE_EXPOSED로 분류되어 챔버 투입이 정지됩니다.'
      }
    }
  },

  'spc-ucl-missing': {
    conceptId: 'spc-ucl-missing',
    term: 'UCL & MISSING DATA',
    koreanName: '통계적 관리한계(UCL) 및 결측 데이터',
    unit: '통계 기준선 / NULL 결측 플래그',
    category: 'STATISTICS',
    summary: '통계적 공정 관리(SPC)의 관리 상한선과 센서 데이터 수집 공백의 공학적 차이.',
    definition: 'UCL(Upper Control Limit)은 정상 상태 데이터의 평균(μ)과 표준편차(σ)를 기준으로 통상 μ + 3σ로 산출되는 통계적 경계입니다. 결측(MISSING)은 센서 폴링 주기 내에 데이터가 수신되지 않아 레코드가 비어 있는 상태입니다.',
    assumption: '정상 공정 표본이 정규분포를 따른다는 가정 하에 도식용 관리 한계선이 가상으로 적용됨 (실제 승인된 SPC 룰 미연결).',
    interpretationCaveats: [
      'UCL/LCL(관리한계) ≠ USL/LSL(규격한계): 관리한계는 공정 변동 감시용이며, 제품 합격/불합격을 결정하는 규격이 아닙니다.',
      'MISSING(결측치) ≠ 0: 결측 구간을 0으로 채우거나(Zero Imputation) 선형 보간하면 통계적 분산과 관리도가 왜곡됩니다.',
      '본 화면의 UCL 점선은 시연을 위한 도식용 가상 한계선이며, 통계적으로 공인된 수학적 검증을 거치지 않았습니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 예시 (A01/A04 검수 전)',
    deepDive: {
      title: 'SPC 관리한계와 데이터 무결성 원칙',
      subtitle: '관리한계 vs 규격한계, 결측치 대체 위험성',
      sections: {
        physicalQuantityVsProcess: '관리한계는 물리량이 아닌 통계량(μ ± 3σ)이며, MISSING은 물리적 상태가 아닌 데이터 수집 파이프라인의 수신 실패 상태입니다.',
        controlLimitsVsSpecLimits: '가장 흔한 오해는 UCL 이탈을 제품 불량으로 단정하는 것입니다. 공정이 통계적 관리 상태를 벗어났더라도(Out of Control), 제품 치수가 규격(USL/LSL) 내에 있으면 양품일 수 있습니다. 반대로 공정이 관리 상태여도 규격을 벗어날 수 있습니다.',
        missingVsZero: '센서 결측치를 0으로 처리하면 평균이 급격히 낮아지고 표준편차가 왜곡되어 잘못된 LCL 경보가 울립니다. FAB ONE은 결측 구간을 명시적 NULL로 보존하고 시계열 차트에서 불연속 갭으로 표시합니다.',
        sensorAnomalyVsDefect: '단일 센서의 UCL 1점 초과는 공정 원인 조사의 단초(Trigger)일 뿐이며, 다중 센서 상관관계와 후속 계측 결과를 종합해야 불량 인과관계를 입증할 수 있습니다.',
        exposureStatusMeaning: 'UCL 초과 시점에 가공 중이던 웨이퍼를 격리 추적(Traceability)하여 불필요한 전체 Lot 폐기를 방지하고, 영향받은 웨이퍼만을 선별 검측합니다.'
      }
    }
  },

  'wafer-exposure-status': {
    conceptId: 'wafer-exposure-status',
    term: 'WAFER_EXPOSURE_STATUS',
    koreanName: '웨이퍼 공정 노출 상태 분류',
    unit: '상태 열거형 (Enum)',
    category: 'QUALITY',
    summary: '설비 이상 발생 시점의 물리적 위치와 공정 진행 단계에 따른 웨이퍼 3단계 분류.',
    definition: '반도체 단일 웨이퍼 가공(Single-wafer processing) 설비에서 이상(Excursion)이 감지되었을 때, 25매 카세트 내 개별 웨이퍼를 물리적 영향도에 따라 CONFIRMED_EXPOSED, CANDIDATE_EXPOSED, NOT_EXPOSED로 체계적으로 분류하는 품질 규약입니다.',
    assumption: '설비 반송 로봇(EFEM & Vacuum Transfer Robot)의 실시간 웨이퍼 트래킹 로그가 동기화되어 있다는 가정.',
    interpretationCaveats: [
      'CONFIRMED_EXPOSED(노출 확정): 이상 발생 당시 또는 직전 챔버에서 식각 플라즈마 처리를 직접 받은 웨이퍼입니다. (즉시 검측 및 보류 조치)',
      'CANDIDATE_EXPOSED(잠재 영향군): 챔버 진입 대기 로드락 버퍼나 이송 암에 위치했던 웨이퍼로, 이상 챔버의 전구체 가스 잔류나 오염에 노출되었을 가능성이 있는 후보군입니다.',
      'NOT_EXPOSED(미노출): 로드포트 FOUP 카세트 내에 머무른 웨이퍼로, 이상 챔버에 물리적으로 접촉하지 않았으므로 타 설비 전환 가공이 가능합니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 예시 (A01/A04 검수 전)',
    deepDive: {
      title: '웨이퍼 노출 상태와 품질 보류(Hold) 의사결정',
      subtitle: '전체 Lot 폐기 방지를 위한 선택적 웨이퍼 추적 규약',
      sections: {
        physicalQuantityVsProcess: '노출 상태는 웨이퍼의 물리적 위치와 진공 밸브 개폐 상태의 이산적 결합입니다. 공정적으로는 교차 오염(Cross-contamination) 위험 수준을 나타냅니다.',
        controlLimitsVsSpecLimits: '노출 상태 분류는 통계적 한계선이 아닌 설비 인터록 규칙(Interlock Rule)에 의해 결정됩니다.',
        missingVsZero: '상태 데이터가 누락될 경우 안전을 위해 최상위 위험 등급(CONFIRMED 또는 CANDIDATE)으로 보수적 격리(Fail-Safe)를 적용해야 합니다.',
        sensorAnomalyVsDefect: 'CANDIDATE_EXPOSED 웨이퍼는 잠재 불량 의심군일 뿐 확정된 불량이 아닙니다. 비파괴 결함 검측(Defect Review)을 거쳐 정상 판정 시 다음 공정으로 재투입(Release)될 수 있습니다.',
        exposureStatusMeaning: '25매 전체를 무조건 폐기하는 과거 방식 대신, W-01~W-07(노출), W-08~W-12(후보), W-13~W-25(미노출)로 정밀 분할하여 수율 손실과 제조 비용을 최소화합니다.'
      }
    }
  },

  'etch-rate': {
    conceptId: 'etch-rate',
    term: 'ETCH_RATE',
    koreanName: '식각 속도 (Etch Rate)',
    unit: 'nm/min (나노미터/분)',
    category: 'PHYSICS',
    summary: '단위 시간당 제거되는 박막의 두께를 나타내는 공정 효율 및 제어의 기본 지표.',
    definition: '식각 속도는 공정 전 박막 두께(Initial Thickness)에서 공정 후 잔여 박막 두께(Final Thickness)의 차이를 순수 공정 시간(Process Time)으로 나눈 값입니다. 웨이퍼 균일도(Uniformity) 및 선택비(Selectivity) 평가의 기초가 됩니다.',
    assumption: '박막 두께가 웨이퍼 전면에서 균일하게 제거되며, 플라즈마 점화 및 소등 시의 과도기(Transients) 영향이 배제된 이상적 정상상태(Steady State) 가정.',
    calculationModel: {
      formulaDisplay: 'Etch Rate = (초기 두께 − 종료 두께) / 공정 시간',
      interactive: true,
      variableName: 'Etch Rate (ER)',
      defaultInputs: {
        initialThickness: 200,
        finalThickness: 140,
        processTimeMinutes: 2.0
      },
      unit: 'nm/min',
      description: '아래 입력창에 수치를 입력하여 식각 속도 산술 원리를 가상으로 체험할 수 있습니다.'
    },
    interpretationCaveats: [
      '본 계산기는 공학 원리 학습을 위한 가상 산술 예제이며, 실제 설비의 OES 센서 [a.u.]에서 직접 산출된 계측값이 아닙니다.',
      '실제 FAB에서는 엘립소미터(Spectroscopic Ellipsometer)나 X-ray 계측기로 사전/사후 측정하여 산출합니다.',
      '공정 시간이 0이거나 음수인 경우 연산이 불가능하며, 종료 두께가 초기 두께보다 크면 증착(Deposition) 상태로 식각 속도가 음수가 됩니다.'
    ],
    reviewStatus: '검토 상태: 공학 검수 전 · 설명용 가상 산술 예제 (A01/A04 검수 전)',
    deepDive: {
      title: '식각 속도와 박막 두께 제어 메커니즘',
      subtitle: '화학적 식각과 물리적 스퍼터링의 복합 동역학',
      sections: {
        physicalQuantityVsProcess: '식각 속도는 시간당 물질 제거율(Material Removal Rate)입니다. 공정적으로는 생산성(Throughput)과 패턴 종횡비(Aspect Ratio)를 결정하는 핵심 파라미터입니다.',
        controlLimitsVsSpecLimits: '식각 속도 관리한계(예: 목표치 30 nm/min ± 2 nm/min)는 챔버 에이징이나 폴리머 축적 상태를 모니터링하기 위한 지표입니다.',
        missingVsZero: '식각 속도 0 nm/min은 반응이 전혀 일어나지 않은 정지 상태를 의미합니다. 두께 계측 실패(MISSING)와는 물리적으로 다릅니다.',
        sensorAnomalyVsDefect: 'OES 신호의 이상이 식각 속도의 급격한 저하를 유발할 수 있으나, 신호 크기와 식각 속도 사이의 비례 계수는 화학종별 반응 단면적에 따라 비선형적입니다.',
        exposureStatusMeaning: '이상 종료된 웨이퍼(CANDIDATE_EXPOSED)는 식각 시간이 중단(INTERRUPTED)되었으므로 목표 식각량에 미달한 상태(Under-etched)일 가능성이 높습니다.'
      }
    }
  }
};

/**
 * Validates inputs for the virtual Etch Rate calculator
 */
export function calculateEtchRate(initialThickness: number, finalThickness: number, processTimeMinutes: number): {
  success: boolean;
  value?: number;
  errorMessage?: string;
  warningMessage?: string;
} {
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

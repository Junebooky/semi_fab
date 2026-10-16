/**
 * BUILD-08 Engineering Workspace Contract & Invariants
 *
 * Implements deterministic evidence board, candidate hypothesis comparison,
 * action checklist state machine, and cross-screen navigation links.
 */

import { getModeAT7ExcursionValues } from '../guided-demo/guided-demo-contract';

export type EvidenceType =
  | 'OBSERVATION_QUALITY'
  | 'PROCESS_EXCURSION'
  | 'ALARM_RECORD'
  | 'WAFER_IMPACT';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  category: string;
  summary: string;
  observedValue: string;
  unit: string;
  qualityFlag: 'GOOD' | 'MISSING' | 'SUSPECT' | 'CRITICAL';
  provenance: string;
  details: string;
  linkUrl: string;
  linkLabel: string;
}

export type HypothesisStatus =
  | 'UNVERIFIED'
  | 'SUPPORTED_FOR_REVIEW'
  | 'NEEDS_MORE_DATA'
  | 'RULED_OUT';

export interface HypothesisItem {
  id: string;
  title: string;
  domain: string;
  description: string;
  status: HypothesisStatus;
  statusLabel: string;
  linkedEvidenceIds: string[];
  engineeringRationale: string;
}

export interface ActionItem {
  id: string;
  title: string;
  assigneeRole: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  targetSystem: string;
  detail: string;
}

export const WORKSPACE_DOMAIN_DISCLAIMERS = {
  excursionVsDefect: '통계적 UCL 초과 공정 일탈(Excursion ≠ Defect)은 장비 센서의 관리한계 일탈 신호이며 제품 불량 확정이 아닙니다.',
  exposureStatus: 'CONFIRMED_EXPOSED는 챔버 노출 이력 확정이며 결함 확정이 아닙니다. CANDIDATE_EXPOSED는 잠재 영향 검토 후보군입니다.',
  missingNotZero: 'OES 상대 신호 T4/T5 결측(MISSING ≠ 0)은 광학 센서 일시 드롭아웃이며 0으로 변조하지 않고 null로 처리됩니다.',
  hypothesisDisclaimer: '가설 상태 변경 및 증거 연결은 엔지니어의 로컬 시연 검토 의견일 뿐이며 자동 원인 규명(RCA)이나 품질 판정이 아닙니다.',
  actionDisclaimer: '체크리스트 조치는 시뮬레이션 검토 항목이며 실제 생산 장비(MES/FDC)에 제어 명령을 발행하지 않습니다.',
  memoryDisclaimer: '입력된 엔지니어링 메모는 브라우저 새로고침 시 초기화되는 메모리 내 시연용 상태입니다 (영속 저장소 없음).',
};

/**
 * Valid seed parser with safe integer bounds.
 */
export function parseSafeWorkspaceSeed(raw: string | null | undefined): number {
  if (raw) {
    const num = Number(raw);
    if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
      return num;
    }
  }
  return 20261015;
}

/**
 * Check if the requested alert is supported in the current simulation context.
 */
export function isWorkspaceAlertSupported(
  requestedAlertId: string | null | undefined,
  expectedAlertId: string
): boolean {
  if (!requestedAlertId) return true; // Default to active scenario
  const trimmed = requestedAlertId.trim();
  // Supported if it matches active synthetic alert ID (e.g. AL-DEMO-015)
  return trimmed === expectedAlertId;
}

/**
 * Generate deterministic Evidence Items for the active run context.
 */
export function generateDefaultEvidenceItems(seed: number = 20261015): EvidenceItem[] {
  const safeSeed = parseSafeWorkspaceSeed(String(seed));
  const runId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

  const t7 = getModeAT7ExcursionValues(safeSeed);

  return [
    {
      id: 'EVI-01',
      type: 'OBSERVATION_QUALITY',
      title: 'OES 상대 신호 T4/T5 결측 (MISSING ≠ 0)',
      category: '센서 관측 품질 사실',
      summary: '식각 진행 중 스텝 T4/T5 구간 광학 상대 신호(OES) 일시 드롭아웃 발생.',
      observedValue: 'null (MISSING)',
      unit: 'a.u.',
      qualityFlag: 'MISSING',
      provenance: `ETCH-02 / CH-B (${runId}) · 광학 방출 분광 센서`,
      details: '광학 검출기 셔터 또는 수광부 일시 결측 사실이며 0으로 변조하지 않고 엄격한 null로 처리됩니다. 이는 센서 관측 사실일 뿐 공정 일탈의 직접 원인이 아닙니다.',
      linkUrl: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=${safeSeed}`,
      linkLabel: '설비 센서 차트 확인 ↗',
    },
    {
      id: 'EVI-02',
      type: 'PROCESS_EXCURSION',
      title: 'Step T7 복합 센서 공정 일탈 (Excursion Spike)',
      category: '통계적 관리한계 초과',
      summary: `식각 종점 T7 구간에서 OES(${t7.oesSignal} a.u.), 챔버 압력(${t7.chamberPressure} mTorr), RF 전력(${t7.rfPower} W) 복합 급증 (UCL 65.0 초과).`,
      observedValue: `${t7.oesSignal} a.u. (> UCL 65.0)`,
      unit: 'a.u. / mTorr / W',
      qualityFlag: 'SUSPECT',
      provenance: `ETCH-02 / CH-B (${runId}) · T7 스텝 계측 (Seed: ${safeSeed})`,
      details: `OES 광학 상대 신호가 관리한계(UCL 65.0 a.u.)를 초과(${t7.oesSignal} a.u.)하고 챔버 압력(기준 120 → ${t7.chamberPressure} mTorr) 및 RF Power(기준 1500 → ${t7.rfPower} W)가 동반 서지했습니다 (시드 ${safeSeed} 기반 결정론적 합성 계측값; 기준 시나리오 대표값: OES ~80.0 a.u., 압력 ~168.5 mTorr, RF ~1820 W).`,
      linkUrl: `/?alert=${encodeURIComponent(alertId)}&investigation=true&seed=${safeSeed}`,
      linkLabel: '엔지니어링 조사 상세 보기 ↗',
    },
    {
      id: 'EVI-03',
      type: 'ALARM_RECORD',
      title: 'FDC 실시간 경보 레코드 (Rule UCL-01)',
      category: 'FDC 통계 룰 트리거',
      summary: `알람 ID ${alertId} (심각도 CRITICAL / 상태 ACTIVE) 발행.`,
      observedValue: 'FDC-RULE-SPC-UCL-01',
      unit: 'Rule ID',
      qualityFlag: 'CRITICAL',
      provenance: `FDC 감시 센티넬 · ${lotId} / ${runId}`,
      details: '식각 챔버 압력/광학 신호/RF Power 복합 급증에 의해 통계적 관리한계 상한 초과 규칙이 발령되었습니다.',
      linkUrl: `/command-center?seed=${safeSeed}`,
      linkLabel: '커맨드 센터 알람 큐 보기 ↗',
    },
    {
      id: 'EVI-04',
      type: 'WAFER_IMPACT',
      title: '잠재 노출 영향군 (W-08 ~ W-12)',
      category: '웨이퍼 노출 이력 분류',
      summary: 'W-01~07 정상 노출 확정군(결함 아님), W-08~12 잠재 영향 후보군(보류 검토 대상).',
      observedValue: '5매 (타겟: W-08)',
      unit: 'Wafers',
      qualityFlag: 'SUSPECT',
      provenance: `25매 FOUP 카세트 (${lotId}) · Slot 8~12`,
      details: 'W-08은 챔버 내에서 T7 일탈에 직접 노출된 잠재 영향 후보군(CANDIDATE_EXPOSED)이며 결함 확정이 아닙니다. W-01~07은 선행 완료된 정상 노출군(CONFIRMED_EXPOSED)입니다.',
      linkUrl: `/traceability?wafer=W-08&seed=${safeSeed}`,
      linkLabel: 'W-08 웨이퍼 추적성 보기 ↗',
    },
  ];
}

/**
 * Generate default hypothesis candidates for comparison.
 */
export function generateDefaultHypotheses(): HypothesisItem[] {
  return [
    {
      id: 'HYPO-01',
      title: 'RF 전력 정합망(Matcher) 튜닝 변동에 따른 플라즈마 서지',
      domain: 'RF 전력 / 정합 회로',
      description: 'RF Power가 1500W에서 1820W로 급증하면서 반사파(Reflected Power) 및 플라즈마 전자 밀도가 비정상 상승했을 가능성 검토.',
      status: 'UNVERIFIED',
      statusLabel: '미검증 (UNVERIFIED)',
      linkedEvidenceIds: ['EVI-02'],
      engineeringRationale: 'T7 스텝 RF Power 서지 데이터와 직접적으로 일치하나 매처 반사파 로그의 추가 교차가 필요합니다.',
    },
    {
      id: 'HYPO-02',
      title: '배기 밸브(Throttle Valve) 응답 지연에 따른 챔버 압력 과도 상승',
      domain: '진공 / 배기 계통',
      description: '압력이 120mTorr에서 168.5mTorr로 급증함에 따라 챔버 배기 제어 밸브의 순간 응답 지연 및 가스 체류 시간 변화 검토.',
      status: 'UNVERIFIED',
      statusLabel: '미검증 (UNVERIFIED)',
      linkedEvidenceIds: ['EVI-02'],
      engineeringRationale: '압력 급증 현상과 부합하며 Throttle 밸브 개도율 이력 확인이 필요합니다.',
    },
    {
      id: 'HYPO-03',
      title: 'OES 광학 윈도우 오염 및 T4/T5 결측에 기인한 신호 해석 한계',
      domain: '광학 계측 센서',
      description: 'T4/T5 구간 결측(MISSING) 및 뷰포트 오염으로 인해 OES 신호가 왜곡 측정되었을 가능성 검토.',
      status: 'UNVERIFIED',
      statusLabel: '미검증 (UNVERIFIED)',
      linkedEvidenceIds: ['EVI-01'],
      engineeringRationale: 'T4/T5 결측은 관측 사실이지만 T7 스텝에서 압력과 RF도 동반 상승했으므로 단독 광학 센서 오작동으로 단정하기 어렵습니다.',
    },
  ];
}

/**
 * Generate default engineering action checklist.
 */
export function generateDefaultActions(): ActionItem[] {
  return [
    {
      id: 'ACTION-01',
      title: 'ETCH-02 / CH-B 센서 원본 시계열 로그 재확인 (Equipment Intelligence)',
      assigneeRole: '장비 엔지니어',
      priority: 'HIGH',
      completed: false,
      targetSystem: 'Equipment Intelligence (/equipment-intelligence)',
      detail: 'T0~T7 스텝 구간 OES, 압력, RF Power의 시계열 추이 및 T4/T5 결측 구간 분절선을 정밀 재확인합니다.',
    },
    {
      id: 'ACTION-02',
      title: 'RF 제너레이터 및 매처(Matcher) 반사파 이력 점검',
      assigneeRole: '공정 엔지니어',
      priority: 'HIGH',
      completed: false,
      targetSystem: 'RF Generator Controller',
      detail: 'Step T7 구간 RF 출력 급증 시점의 Forward/Reflected Power 비와 임피던스 정합 튜닝 로그를 점검합니다.',
    },
    {
      id: 'ACTION-03',
      title: '챔버 압력 제어 Throttle 밸브 및 압력계 교정 이력 확인',
      assigneeRole: '설비 엔지니어',
      priority: 'MEDIUM',
      completed: false,
      targetSystem: 'Vacuum Gauge & Throttle Valve',
      detail: 'Baratron 압력 센서 영점 및 APC(Adaptive Pressure Control) 밸브 모터 응답 지연 이력을 점검합니다.',
    },
    {
      id: 'ACTION-04',
      title: '잠재 노출군(W-08~W-12) 결함 검토(Defect Review) 의뢰 (시뮬레이션)',
      assigneeRole: '품질 분석 엔지니어',
      priority: 'HIGH',
      completed: false,
      targetSystem: 'Wafer Traceability (/traceability)',
      detail: 'W-08을 포함한 잠재 영향군 5매에 대해 광학 결함 검사(AOI) 및 CD-SEM 정밀 측정을 가상 요청합니다.',
    },
  ];
}

/**
 * Cycle hypothesis status deterministically.
 */
export function getNextHypothesisStatus(current: HypothesisStatus): HypothesisStatus {
  switch (current) {
    case 'UNVERIFIED':
      return 'SUPPORTED_FOR_REVIEW';
    case 'SUPPORTED_FOR_REVIEW':
      return 'NEEDS_MORE_DATA';
    case 'NEEDS_MORE_DATA':
      return 'RULED_OUT';
    case 'RULED_OUT':
      return 'UNVERIFIED';
  }
}

/**
 * Toggle linked evidence for a hypothesis.
 */
export function toggleLinkedEvidence(linkedIds: string[], evidenceId: string): string[] {
  if (linkedIds.includes(evidenceId)) {
    return linkedIds.filter((id) => id !== evidenceId);
  } else {
    return [...linkedIds, evidenceId];
  }
}

/**
 * Cross-page navigation links maintaining seed and Run context.
 */
export function getWorkspaceNavLinks(seed: number, alertId?: string, mode: 'A' | 'B' = 'A', activeRunId?: string) {
  const safeSeed = parseSafeWorkspaceSeed(String(seed));
  const runId = mode === 'B' && activeRunId ? activeRunId : `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const effectiveAlertId = alertId || `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
  const lotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

  const modeParams = mode === 'B'
    ? `mode=B&run_id=${encodeURIComponent(runId)}`
    : `seed=${safeSeed}`;

  return {
    runId,
    alertId: effectiveAlertId,
    lotId,
    commandCenter: `/command-center?${modeParams}`,
    equipmentIntelligence: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&${modeParams}`,
    homeInvestigation: `/?alert=${encodeURIComponent(effectiveAlertId)}&investigation=true&${modeParams}`,
    waferTraceability: `/traceability?wafer=W-08&${modeParams}`,
    fabSimulation: `/fab-simulation?${modeParams}`,
    engineeringWorkspace: `/engineering-workspace?alert=${encodeURIComponent(effectiveAlertId)}&${modeParams}`,
  };
}

// Re-export shared investigation context utilities and types
export * from '@/lib/investigation-context';

/**
 * Maps FastAPI InvestigationDetail into Workspace EvidenceItem[]
 */
export function mapInvestigationDetailToEvidence(
  detail: {
    investigation_id: string;
    alert_id: string;
    equipment_id: string;
    chamber_id: string;
    run_id: string;
    lot_id: string;
    recipe_id: string;
    evidence_sensors: Array<{
      sensor_id: string;
      sensor_name: string;
      measured_value: number;
      unit: string;
      quality_flag: string;
      ucl_threshold: number;
      target_value: number;
      deviation_percent: number;
    }>;
    total_wafers: number;
    confirmed_exposed_wafers: string[];
    candidate_exposed_wafers: string[];
    unexposed_wafers_count: number;
    disclaimer: string;
  },
  seed: number = 20261015
): EvidenceItem[] {
  const safeSeed = parseSafeWorkspaceSeed(String(seed));
  const oesSample = detail.evidence_sensors.find((s) => s.sensor_id === 'RELATIVE_SIGNAL');
  const prsSample = detail.evidence_sensors.find((s) => s.sensor_id === 'CHAMBER_PRESSURE');
  const rfSample = detail.evidence_sensors.find((s) => s.sensor_id === 'RF_POWER');

  const oesVal = oesSample ? oesSample.measured_value : 80.0;
  const prsVal = prsSample ? prsSample.measured_value : 168.5;
  const rfVal = rfSample ? rfSample.measured_value : 1820.0;

  return [
    {
      id: 'EVI-01',
      type: 'OBSERVATION_QUALITY',
      title: 'OES 상대 신호 T4/T5 결측 (MISSING ≠ 0)',
      category: '센서 관측 품질 사실',
      summary: '식각 진행 중 스텝 T4/T5 구간 광학 상대 신호(OES) 일시 드롭아웃 발생.',
      observedValue: 'null (MISSING)',
      unit: 'a.u.',
      qualityFlag: 'MISSING',
      provenance: `${detail.equipment_id} / ${detail.chamber_id} (${detail.run_id}) · 광학 방출 분광 센서`,
      details: '광학 검출기 셔터 또는 수광부 일시 결측 사실이며 0으로 변조하지 않고 엄격한 null로 처리됩니다. 이는 센서 관측 사실일 뿐 공정 일탈의 직접 원인이 아닙니다.',
      linkUrl: `/equipment-intelligence?sensor=RELATIVE_SIGNAL&mode=B&run_id=${encodeURIComponent(detail.run_id)}`,
      linkLabel: '설비 센서 차트 확인 ↗',
    },
    {
      id: 'EVI-02',
      type: 'PROCESS_EXCURSION',
      title: 'Step T7 복합 센서 공정 일탈 (Excursion Spike)',
      category: '통계적 관리한계 초과',
      summary: `식각 종점 T7 구간에서 OES(${oesVal} a.u.), 챔버 압력(${prsVal} mTorr), RF 전력(${rfVal} W) 복합 급증 (UCL 65.0 초과).`,
      observedValue: `${oesVal} a.u. (> UCL 65.0)`,
      unit: 'a.u. / mTorr / W',
      qualityFlag: 'SUSPECT',
      provenance: `${detail.equipment_id} / ${detail.chamber_id} (${detail.run_id}) · T7 스텝 계측 (Live API)`,
      details: `OES 광학 상대 신호가 관리한계(UCL 65.0 a.u.)를 초과(${oesVal} a.u.)하고 챔버 압력(기준 120 → ${prsVal} mTorr) 및 RF Power(기준 1500 → ${rfVal} W)가 동반 서지했습니다 (FastAPI SQLite 실시간 공정 계측값).`,
      linkUrl: `/?alert=${encodeURIComponent(detail.alert_id)}&investigation=true&mode=B&run_id=${encodeURIComponent(detail.run_id)}`,
      linkLabel: '엔지니어링 조사 상세 보기 ↗',
    },
    {
      id: 'EVI-03',
      type: 'ALARM_RECORD',
      title: 'FDC 실시간 경보 레코드 (Rule UCL-01)',
      category: 'FDC 통계 룰 트리거',
      summary: `알람 ID ${detail.alert_id} (심각도 CRITICAL / 상태 ACTIVE) 발행.`,
      observedValue: 'FDC-RULE-SPC-UCL-01',
      unit: 'Rule ID',
      qualityFlag: 'CRITICAL',
      provenance: `FDC 감시 센티넬 · ${detail.lot_id} / ${detail.run_id}`,
      details: '식각 챔버 압력/광학 신호/RF Power 복합 급증에 의해 통계적 관리한계 상한 초과 규칙이 발령되었습니다.',
      linkUrl: `/command-center?mode=B&run_id=${encodeURIComponent(detail.run_id)}`,
      linkLabel: '커맨드 센터 알람 큐 보기 ↗',
    },
    {
      id: 'EVI-04',
      type: 'WAFER_IMPACT',
      title: `잠재 노출 영향군 (${detail.candidate_exposed_wafers[0] || 'W-08'} ~ ${detail.candidate_exposed_wafers[detail.candidate_exposed_wafers.length - 1] || 'W-12'})`,
      category: '웨이퍼 노출 이력 분류',
      summary: `선행 ${detail.confirmed_exposed_wafers.length}매 정상 노출 완료군(결함 아님), ${detail.candidate_exposed_wafers.length}매 잠재 영향 후보군(보류 검토 대상).`,
      observedValue: `${detail.candidate_exposed_wafers.length}매 (타겟: ${detail.candidate_exposed_wafers[0] || 'W-08'})`,
      unit: 'Wafers',
      qualityFlag: 'SUSPECT',
      provenance: `${detail.total_wafers}매 FOUP 카세트 (${detail.lot_id}) · Slot ${detail.candidate_exposed_wafers.map((w) => w.replace('W-', '')).join(', ')}`,
      details: `${detail.candidate_exposed_wafers[0] || 'W-08'}은 챔버 내에서 T7 일탈에 직접 노출된 잠재 영향 후보군(CANDIDATE_EXPOSED)이며 결함 확정이 아닙니다. 선행 ${detail.confirmed_exposed_wafers.length}매는 선행 완료된 정상 노출군(CONFIRMED_EXPOSED)입니다.`,
      linkUrl: `/traceability?wafer=${detail.candidate_exposed_wafers[0] || 'W-08'}&mode=B&run_id=${encodeURIComponent(detail.run_id)}`,
      linkLabel: `${detail.candidate_exposed_wafers[0] || 'W-08'} 웨이퍼 추적성 보기 ↗`,
    },
  ];
}


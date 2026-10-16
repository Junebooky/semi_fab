// Domain Interfaces for FDC Command Center (BUILD-05)

export interface FdcAlert {
  alert_id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  equipment_id: string;
  chamber_id: string;
  run_id: string | null;
  rule_code: string;
  message: string;
  status: 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED';
  event_time_utc: string;
  candidate_lot: string | null;
  candidate_wafers: string[];
}

export interface DemoSummary {
  equipment_id: string;
  chamber_id: string;
  active_session_id: string;
  active_run_id: string;
  lot_id: string;
  recipe_id: string;
  total_wafers: number;
  exposed_wafers: number;
  active_alerts_count: number;
  latest_pressure_mtorr?: number | null;
  latest_rf_power_w?: number | null;
  latest_relative_signal?: number | null;
  mode: 'A' | 'B';
  data_origin: string;
}

export interface ErrorState {
  status: number;
  title: string;
  message: string;
}

export interface InvestigationSupportResult {
  supported: boolean;
  reason: string;
}

// Built-in Mode A Deterministic Synthetic Alarm Fixture Generator
export function generateModeACommandCenterAlarms(seed: number): FdcAlert[] {
  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const standbyAlertId = `AL-STANDBY-${String(seed % 1000).padStart(3, '0')}`;
  const infoAlertId = `AL-INFO-${String(seed % 1000).padStart(3, '0')}`;

  return [
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
}

/**
 * Evaluates whether an alert possesses verified engineering investigation telemetry (P1-C compliant).
 * Guarantees strict provenance: only active run CRITICAL alerts on equipment ETCH-02 / chamber CH-B
 * with rule 'FDC-RULE-SPC-UCL-01' and a verified activeRunId are eligible.
 * All others fail-closed with explicit reasons (candidate_wafers count alone cannot grant support).
 */
export function isInvestigationSupported(
  alert: FdcAlert | null,
  activeRunId: string | null
): InvestigationSupportResult {
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

/**
 * Pure filter and sort function for Command Center alarm queue.
 */
export function applyFilterAndSort(
  alerts: FdcAlert[],
  severityFilter: 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO',
  statusFilter: 'ALL' | 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED',
  equipmentFilter: string,
  sortOrder: 'NEWEST' | 'OLDEST'
): FdcAlert[] {
  let result = [...alerts];

  if (severityFilter !== 'ALL') {
    result = result.filter(a => a.severity === severityFilter);
  }

  if (statusFilter !== 'ALL') {
    result = result.filter(a => a.status === statusFilter);
  }

  if (equipmentFilter !== 'ALL') {
    result = result.filter(a => `${a.equipment_id} / ${a.chamber_id}` === equipmentFilter);
  }

  result.sort((a, b) => {
    const timeA = new Date(a.event_time_utc).getTime();
    const timeB = new Date(b.event_time_utc).getTime();
    return sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
  });

  return result;
}

/**
 * Determines the next coherent selected alert ID after filter or queue updates.
 */
export function resolveNextSelection(
  filteredAlarms: FdcAlert[],
  currentSelectedId: string | null
): string | null {
  if (filteredAlarms.length === 0) {
    return null;
  }
  if (currentSelectedId && filteredAlarms.some(a => a.alert_id === currentSelectedId)) {
    return currentSelectedId;
  }
  return filteredAlarms[0].alert_id;
}

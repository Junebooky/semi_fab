/**
 * BUILD-12 & BUILD-13 Investigation Context & Shared Utilities
 *
 * Provides cross-screen context propagation, URL parameter serializers,
 * lineage validation, Truth Contract Case Report generation, and Casebook persistence.
 */

export type SimulationMode = 'A' | 'B';

export interface InvestigationContext {
  mode: SimulationMode;
  dataOrigin: string; // 'synthetic'
  runId: string;
  sessionId?: string;
  lotId: string;
  alertId: string;
  equipmentId: string;
  chamberId: string;
  recipeId?: string;
  seed: number;
  tourStep?: string;
}

export interface CaseReportSensorEvidence {
  sensorId: string;
  sensorName: string;
  observedValue: string | number | null;
  unit: string;
  qualityFlag: 'GOOD' | 'MISSING' | 'SUSPECT' | 'CRITICAL';
  uclThreshold?: number;
  targetValue?: number;
  deviationPercent?: number;
  details?: string;
}

export interface CaseReportWaferSummary {
  total: number;
  confirmedWafers: string[];
  candidateWafers: string[];
  unexposedCount: number;
}

export interface CaseReportHypothesis {
  id: string;
  title: string;
  domain: string;
  status: string;
  statusLabel: string;
  linkedEvidenceIds: string[];
  engineeringRationale: string;
}

export interface CaseReportAction {
  id: string;
  title: string;
  assigneeRole: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  targetSystem: string;
  detail: string;
}

export interface CaseReportPayload {
  reportId: string;
  generatedAtUtc: string;
  mode: SimulationMode;
  dataOrigin: string;
  runId: string;
  sessionId?: string;
  lotId: string;
  alertId: string;
  severity?: string;
  ruleCode?: string;
  equipmentId: string;
  chamberId: string;
  recipeId?: string;
  sensors: CaseReportSensorEvidence[];
  wafers: CaseReportWaferSummary;
  hypotheses: CaseReportHypothesis[];
  actions: CaseReportAction[];
  userNotes: string;
  isUnsupported?: boolean;
}

export interface CasebookRecord {
  id: string; // CASE-${runId}-${timestamp}
  runId: string;
  sessionId?: string;
  alertId: string;
  seed: number;
  mode: SimulationMode;
  dataOrigin: string; // 'synthetic'
  equipmentId: string;
  chamberId: string;
  lotId: string;
  savedAtUtc: string;
  status: 'DRAFT' | 'REVIEWED' | 'DISPOSITIONED';
  hypotheses: CaseReportHypothesis[];
  actions: CaseReportAction[];
  userNotes: string;
  reportExported: boolean;
}

export const FAB_ONE_CASEBOOK_STORAGE_KEY = 'fab_one_casebook_records_v1';

/**
 * Validates that two run IDs match, guarding against cross-run contamination.
 */
export function validateRunLineage(expectedRunId: string | null | undefined, actualRunId: string | null | undefined): boolean {
  if (!expectedRunId || !actualRunId) return false;
  return expectedRunId.trim() === actualRunId.trim();
}

/**
 * Generates a sanitized, safe filename for the Case Report download.
 * Pattern: case-report-${runId}-${dateStr}.md
 */
export function generateCaseReportFilename(runId: string, timestamp?: Date): string {
  const dt = timestamp || new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const safeRunId = (runId || 'UNKNOWN-RUN').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `case-report-${safeRunId}-${dateStr}.md`;
}

/**
 * Evaluates whether Case Report export should be enabled or locked.
 */
export function isCaseReportExportable(
  isSupportedAlert: boolean,
  hasError: boolean,
  isLoading: boolean,
  runId?: string | null
): boolean {
  if (!isSupportedAlert) return false;
  if (hasError) return false;
  if (isLoading) return false;
  if (!runId || runId.trim().length === 0) return false;
  return true;
}

/**
 * Known physical sensors allowed in the Sensor Measurements table.
 * Non-sensor items (FDC Alert, Wafer impact) must never be presented as physical sensors.
 */
export const KNOWN_PHYSICAL_SENSORS = new Set(['RELATIVE_SIGNAL', 'CHAMBER_PRESSURE', 'RF_POWER']);

/**
 * Formats a comprehensive Markdown Case Report adhering to domain truth invariants.
 * Strictly separates physical sensors from alert/wafer evidence.
 */
export function generateCaseReportMarkdown(payload: CaseReportPayload): string {
  const {
    reportId,
    generatedAtUtc,
    mode,
    dataOrigin,
    runId,
    sessionId = 'N/A',
    lotId,
    alertId,
    severity = 'CRITICAL',
    ruleCode = 'FDC-RULE-SPC-UCL-01',
    equipmentId,
    chamberId,
    recipeId = 'RCP-ETCH-POLY-04',
    sensors,
    wafers,
    hypotheses,
    actions,
    userNotes,
  } = payload;

  const modeLabel = mode === 'B' ? 'Mode B (FastAPI Live API)' : 'Mode A (오프라인 결정론적 합성)';

  // Filter strictly physical sensors
  const physicalSensors = sensors.filter(
    (s) => KNOWN_PHYSICAL_SENSORS.has(s.sensorId) || s.sensorId.startsWith('SENSOR-')
  );

  return `# FAB ONE Engineering Case Report (공학적 사건 조사 보고서)

> [!NOTE]
> **데이터 출처 고지 및 도메인 불변식 (Data Provenance & Domain Invariants)**
> - **데이터 성격**: 합성 반도체 공정 시뮬레이터 기반 시연 보고서 (비공식 / Synthetic Demonstration, mode: ${modeLabel}, origin: ${dataOrigin}).
> - **공정 일탈 정의 (Excursion ≠ Defect)**: 통계적 UCL 초과 공정 일탈은 센서의 관리한계 일탈 신호이며 제품 결함(Defect) 확정이 아닙니다.
> - **결측치 처리 (MISSING ≠ 0)**: OES 광학 상대 신호 T4/T5 구간 결측은 광학 수광부 일시 드롭아웃 관측 사실이며 0으로 변조하지 않고 엄격한 null로 보존됩니다.
> - **가설 검토 성격 (Hypothesis Review)**: 본 보고서의 가설 상태 및 증거 연결은 엔지니어의 시연 검토 의견일 뿐이며 자동 원인 규명(RCA)이나 품질 불량 판정이 아닙니다.
> - **장비 제어 경계 (No MES Control)**: 조치 체크리스트는 엔지니어링 가상 검토 항목이며 실제 생산 장비(MES/FDC)에 제어 명령을 발행하거나 실 홀드를 집행하지 않습니다.
> - **인메모리 휘발성 (In-memory Volatile)**: 작성 중인 가설 상태, 체크리스트, 엔지니어링 메모는 Casebook에 저장하기 전까지 브라우저 새로고침(Refresh) 시 휘발됩니다.

---

## 1. 조사 사건 개요 (Investigation Summary)
- **보고서 발행 일시**: ${generatedAtUtc}
- **조사 ID**: ${reportId}
- **공정 Run ID**: ${runId}
- **시뮬레이션 세션 ID**: ${sessionId}
- **로트 ID**: ${lotId}
- **FDC 경보 ID**: ${alertId} (심각도: ${severity} / 규칙 코드: ${ruleCode})
- **대상 설비 / 챔버**: ${equipmentId} / ${chamberId}
- **적용 레시피**: ${recipeId}
- **동작 모드 / 데이터 출처**: ${modeLabel} / ${dataOrigin}

---

## 2. 공정 이상 감지 및 센서 계측 증거 (Sensor Measurements & Quality Flags)
- **이상 감지 시점**: Step T7 (식각 종점 구간)
- **통계적 관리한계 (SPC UCL)**: 65.0 a.u. (OES 광학 상대 신호 기준)
- **FDC 실시간 경보 레코드 (FDC Alert Record)**: ${alertId} (심각도: ${severity} / 규칙 코드: ${ruleCode})
- **OES 광학 센서 T4/T5 결측 사실 고지 (OES T4/T5 MISSING Fact)**: 스텝 T4/T5 광학 상대 신호 null (MISSING ≠ 0). 동일 Run samples API (\`/api/v1/demo/runs/${runId}/samples?sensor_id=RELATIVE_SIGNAL\`) 또는 기준 합성 시나리오로 입증된 센서 관측 사실이며 0으로 대체되지 않습니다.

### 실제 공정 센서 계측치 분석표 (Physical Sensor Measurements Only)
| 센서 ID | 센서 명칭 | 관측 계측치 | 단위 | 품질 플래그 | 관리한계 (UCL) | 비고 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${
  physicalSensors.length > 0
    ? physicalSensors
        .map((s) => {
          const uclStr = s.uclThreshold !== undefined ? `${s.uclThreshold} ${s.unit}` : 'N/A';
          const valStr = s.observedValue !== null && s.observedValue !== undefined ? `${s.observedValue}` : '미제공 (N/A)';
          return `| ${s.sensorId} | ${s.sensorName} | ${valStr} | ${s.unit} | ${s.qualityFlag} | ${uclStr} | ${s.details || '-'} |`;
        })
        .join('\n')
    : '| N/A | 등록된 물리 센서 계측치가 없습니다 | - | - | - | - | - |'
}

---

## 3. 웨이퍼 25매 카세트 노출 영향 분류 (Wafer Cassette Exposure Status)
- **총 웨이퍼 수량**: ${wafers.total}매 (FOUP 카세트 ${lotId})
- **정상 노출 완료군 (CONFIRMED_EXPOSED)**: ${wafers.confirmedWafers.length}매 (${
    wafers.confirmedWafers.length > 0 ? wafers.confirmedWafers.join(', ') : '없음'
  })
  - *정의: 이상 발생 전 식각 챔버 가공이 완료된 웨이퍼군 (결함 확정 아님, 박막 두께 일치성 검증 대기)*
- **잠재 영향 후보군 (CANDIDATE_EXPOSED)**: ${wafers.candidateWafers.length}매 (${
    wafers.candidateWafers.length > 0 ? wafers.candidateWafers.join(', ') : '없음'
  })
  - *정의: T7 일탈 발생 시점에 챔버 노출 또는 진입 대기 상태였던 잠재 영향 후보군 (결함 검측 Defect Review 우선 배정 대상)*
- **미노출 안전 대기군 (NOT_EXPOSED)**: ${wafers.unexposedCount}매
  - *정의: 설비 안전 인터록으로 공정 미착수 상태로 FOUP 카세트 내 안전 보관된 웨이퍼군*

---

## 4. 엔지니어링 가설 검토 현황 (Candidate Hypotheses & Evidence Mapping)
${hypotheses
  .map(
    (h) => `### [${h.id}] ${h.title}
- **도메인 분류**: ${h.domain}
- **검토 판정 상태**: **${h.statusLabel}**
- **연결된 증거 사실**: ${h.linkedEvidenceIds.length > 0 ? h.linkedEvidenceIds.join(', ') : '연결된 증거 없음'}
- **공학적 근거 / 검토 의견**: ${h.engineeringRationale}
`
  )
  .join('\n')}

---

## 5. 엔지니어링 조치 체크리스트 및 사용자 메모 (Action Items & Notes)
${actions
  .map(
    (a) =>
      `- [${a.completed ? 'x' : ' '}] **${a.id}**: ${a.title} (담당: ${a.assigneeRole} | 우선순위: ${
        a.priority
      } | 대상 시스템: ${a.targetSystem})\n  - *세부사항*: ${a.detail}`
  )
  .join('\n')}

### 엔지니어링 메모 (In-memory Engineering Notes):
> ${userNotes.trim().length > 0 ? userNotes.replace(/\n/g, '\n> ') : '작성된 엔지니어링 메모가 없습니다.'}

---
*Generated by FAB ONE Semiconductor Engineering Platform (BUILD-13)*
`;
}

/**
 * Loads saved casebook records from localStorage safely (SSR guarded).
 */
export function loadSavedCasebookRecords(): CasebookRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAB_ONE_CASEBOOK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((r) => r && typeof r.id === 'string' && typeof r.runId === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Saves a new or updated casebook record to localStorage.
 */
export function saveCasebookRecordToStorage(record: CasebookRecord): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const existing = loadSavedCasebookRecords();
    const index = existing.findIndex((r) => r.id === record.id || (r.runId === record.runId && r.alertId === record.alertId));
    if (index >= 0) {
      existing[index] = record;
    } else {
      existing.unshift(record);
    }
    localStorage.setItem(FAB_ONE_CASEBOOK_STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a casebook record by ID from localStorage.
 */
export function deleteCasebookRecordFromStorage(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const existing = loadSavedCasebookRecords();
    const filtered = existing.filter((r) => r.id !== id);
    localStorage.setItem(FAB_ONE_CASEBOOK_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

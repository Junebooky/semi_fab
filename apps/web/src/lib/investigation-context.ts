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
  schemaVersion: number; // strictly 1
  runId: string;
  sessionId: string;
  alertId: string;
  seed: number;
  mode: SimulationMode;
  dataOrigin: string; // 'synthetic' | 'live_api'
  equipmentId: string;
  chamberId: string;
  lotId: string;
  savedAtUtc: string;
  status: 'DRAFT' | 'REVIEWED' | 'DISPOSITIONED';
  hypotheses: CaseReportHypothesis[];
  actions: CaseReportAction[];
  userNotes: string;
  reportExported: boolean;
  physicalSensorSnapshot?: CaseReportSensorEvidence[];
}

export const FAB_ONE_CASEBOOK_STORAGE_KEY = 'fab_one_casebook_records_v1';

/**
 * Escapes characters that could break Markdown tables or blockquotes.
 * Replaces pipe '|' with '\|' and newlines with '<br/>' to prevent table structure injection.
 */
export function escapeMarkdownTableAndNotes(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\|/g, '\\|')
    .replace(/\r\n/g, '<br/>')
    .replace(/\n/g, '<br/>')
    .replace(/\r/g, '<br/>');
}

/**
 * Validates that an object strictly conforms to the CasebookRecord schema v1 (BUILD-15).
 * Enforces schemaVersion === 1, nested hypotheses/actions integrity, string bounds, and enum checks.
 */
export function isValidCasebookRecord(item: any): item is CasebookRecord {
  if (!item || typeof item !== 'object') return false;

  // 1. Strictly enforce schemaVersion === 1 (missing or other versions rejected)
  if (item.schemaVersion !== 1) return false;

  // 2. Core identifiers and string boundaries (all mandatory non-empty strings in v1)
  if (typeof item.id !== 'string' || item.id.trim().length === 0 || item.id.length > 128) return false;
  if (typeof item.runId !== 'string' || item.runId.trim().length === 0 || item.runId.length > 64) return false;
  if (typeof item.alertId !== 'string' || item.alertId.trim().length === 0 || item.alertId.length > 64) return false;
  if (typeof item.sessionId !== 'string' || item.sessionId.trim().length === 0 || item.sessionId.length > 128) return false;
  if (typeof item.lotId !== 'string' || item.lotId.trim().length === 0 || item.lotId.length > 64) return false;
  if (typeof item.equipmentId !== 'string' || item.equipmentId.trim().length === 0 || item.equipmentId.length > 64) return false;
  if (typeof item.chamberId !== 'string' || item.chamberId.trim().length === 0 || item.chamberId.length > 64) return false;
  if (item.mode !== 'A' && item.mode !== 'B') return false;
  if (typeof item.savedAtUtc !== 'string' || isNaN(Date.parse(item.savedAtUtc))) return false;

  // 3. Mandatory synthetic origin, integer seed, and status enum
  if (typeof item.dataOrigin !== 'string' || !['synthetic', 'live_api'].includes(item.dataOrigin)) return false;
  if (item.seed === undefined || item.seed === null || !Number.isInteger(Number(item.seed)) || Number(item.seed) < 0 || Number(item.seed) > 2147483647) return false;
  if (typeof item.status !== 'string' || !['DRAFT', 'REVIEWED', 'DISPOSITIONED'].includes(item.status)) return false;

  // 4. Nested Hypotheses validation (array bounds, item schema, status enum)
  if (!Array.isArray(item.hypotheses) || item.hypotheses.length > 50) return false;
  for (const h of item.hypotheses) {
    if (!h || typeof h !== 'object') return false;
    if (typeof h.id !== 'string' || h.id.trim().length === 0 || h.id.length > 64) return false;
    if (typeof h.title !== 'string' || h.title.trim().length === 0 || h.title.length > 256) return false;
    if (typeof h.domain !== 'string' || h.domain.length > 64) return false;
    if (
      typeof h.status !== 'string' ||
      !['UNVERIFIED', 'UNVALIDATED', 'SUPPORTED_FOR_REVIEW', 'NEEDS_MORE_DATA', 'RULED_OUT', 'TESTING', 'REJECTED'].includes(h.status)
    ) return false;
    if (typeof h.statusLabel !== 'string' || h.statusLabel.length > 64) return false;
    if (typeof h.engineeringRationale !== 'string' || h.engineeringRationale.length > 2000) return false;
    if (!Array.isArray(h.linkedEvidenceIds) || h.linkedEvidenceIds.length > 20) return false;
    for (const eid of h.linkedEvidenceIds) {
      if (typeof eid !== 'string' || eid.length > 64) return false;
    }
  }

  // 5. Nested Actions validation (array bounds, item schema, priority enum, boolean)
  if (!Array.isArray(item.actions) || item.actions.length > 50) return false;
  for (const a of item.actions) {
    if (!a || typeof a !== 'object') return false;
    if (typeof a.id !== 'string' || a.id.trim().length === 0 || a.id.length > 64) return false;
    if (typeof a.title !== 'string' || a.title.trim().length === 0 || a.title.length > 256) return false;
    if (typeof a.assigneeRole !== 'string' || a.assigneeRole.length > 64) return false;
    if (typeof a.priority !== 'string' || !['HIGH', 'MEDIUM', 'LOW'].includes(a.priority)) return false;
    if (typeof a.completed !== 'boolean') return false;
    if (typeof a.targetSystem !== 'string' || a.targetSystem.length > 64) return false;
    if (typeof a.detail !== 'string' || a.detail.length > 2000) return false;
  }

  // 6. User notes bounds
  if (typeof item.userNotes !== 'string' || item.userNotes.length > 5000) return false;

  // 7. Optional physicalSensorSnapshot bounds
  if (item.physicalSensorSnapshot !== undefined && item.physicalSensorSnapshot !== null) {
    if (!Array.isArray(item.physicalSensorSnapshot) || item.physicalSensorSnapshot.length > 20) return false;
    for (const s of item.physicalSensorSnapshot) {
      if (!s || typeof s !== 'object') return false;
      if (typeof s.sensorId !== 'string' || s.sensorId.length > 64) return false;
      if (typeof s.sensorName !== 'string' || s.sensorName.length > 128) return false;
      if (typeof s.unit !== 'string' || s.unit.length > 32) return false;
      if (typeof s.qualityFlag !== 'string' || s.qualityFlag.length > 32) return false;
      if (typeof s.isExcursion !== 'boolean') return false;
    }
  }

  return true;
}

/**
 * Evaluates whether a CasebookRecord perfectly matches the active investigation lineage.
 * Mode B active editor restore requires all 8 lineage attributes to be non-empty and 100% identical:
 * mode, runId, alertId, sessionId, lotId, equipmentId, chamberId, dataOrigin.
 * If ANY field is missing, empty, enum-mismatched, or divergent, returns false so that the record
 * is strictly isolated in the read-only modal and never commits to active editor notes/hypotheses/actions.
 */
export function isExactLineageMatch(
  record: CasebookRecord | null | undefined,
  currentContext: {
    mode: SimulationMode;
    runId?: string | null;
    alertId?: string | null;
    sessionId?: string | null;
    lotId?: string | null;
    equipmentId?: string | null;
    chamberId?: string | null;
    dataOrigin?: string | null;
  }
): boolean {
  if (!record || typeof record !== 'object') return false;
  if (record.mode !== currentContext.mode) return false;

  const expectedDataOrigin = currentContext.dataOrigin || (currentContext.mode === 'B' ? 'live_api' : 'synthetic');

  // Helper: must be non-empty string on both sides and match exactly after trimming
  const isStrictMatch = (a?: string | null, b?: string | null): boolean => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const trimmedA = a.trim();
    const trimmedB = b.trim();
    if (trimmedA.length === 0 || trimmedB.length === 0) return false;
    return trimmedA === trimmedB;
  };

  if (!isStrictMatch(record.runId, currentContext.runId)) return false;
  if (!isStrictMatch(record.alertId, currentContext.alertId)) return false;
  if (!isStrictMatch(record.sessionId, currentContext.sessionId)) return false;
  if (!isStrictMatch(record.lotId, currentContext.lotId)) return false;
  if (!isStrictMatch(record.equipmentId, currentContext.equipmentId)) return false;
  if (!isStrictMatch(record.chamberId, currentContext.chamberId)) return false;
  if (!isStrictMatch(record.dataOrigin, expectedDataOrigin)) return false;

  return true;
}

/**
 * Builds a consistent cross-screen navigation URL preserving mode, run_id, and seed.
 */
export function buildCrossNavUrl(
  path: string,
  context: {
    mode: 'A' | 'B';
    seed?: number;
    runId?: string | null;
    alertId?: string | null;
    waferId?: string | null;
    sensorId?: string | null;
    tourStep?: string | number | null;
  }
): string {
  const params = new URLSearchParams();
  if (context.mode === 'B') {
    params.set('mode', 'B');
    if (context.runId) params.set('run_id', context.runId);
  } else {
    const s = context.seed && Number.isInteger(Number(context.seed)) ? Number(context.seed) : 20261015;
    params.set('seed', String(s));
  }

  if (context.alertId) params.set('alert', context.alertId);
  if (context.waferId) params.set('wafer', context.waferId);
  if (context.sensorId) params.set('sensor', context.sensorId);
  if (context.tourStep !== undefined && context.tourStep !== null) params.set('tourStep', String(context.tourStep));

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

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

### 엔지니어링 검토 기록 (Engineering Notes):
> ${escapeMarkdownTableAndNotes(userNotes).trim().length > 0 ? escapeMarkdownTableAndNotes(userNotes).replace(/\n/g, '\n> ') : '작성된 엔지니어링 메모가 없습니다.'}

---
*Generated by FAB ONE Semiconductor Engineering Platform (BUILD-15 Release Freeze)*
*안내: 본 보고서의 가설, 조치 및 메모는 담당 엔지니어의 로컬 검토 기록이며 공정 품질 판정 또는 자동 원인 규명(RCA) 결과가 아닙니다.*
`;
}

/**
 * Loads saved casebook records from localStorage safely with schema validation.
 */
export function loadSavedCasebookRecords(): CasebookRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAB_ONE_CASEBOOK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        if (typeof item.id !== 'string' || item.id.trim().length === 0) return false;
        if (typeof item.runId !== 'string' || item.runId.trim().length === 0) return false;
        if (typeof item.alertId !== 'string' || item.alertId.trim().length === 0) return false;
        return true;
      });
    }
    return [];
  } catch {
    return [];
  }
}

export interface StorageSaveResult {
  success: boolean;
  error?: 'QUOTA_EXCEEDED' | 'DISABLED' | 'INVALID_RECORD' | 'SSR_ENVIRONMENT';
  message: string;
}

/**
 * Saves a new or updated casebook record to localStorage with quota protection.
 */
export function saveCasebookRecordToStorage(record: CasebookRecord): StorageSaveResult {
  if (typeof window === 'undefined') {
    return { success: false, error: 'SSR_ENVIRONMENT', message: 'SSR 환경에서는 저장할 수 없습니다.' };
  }
  if (!isValidCasebookRecord(record)) {
    return { success: false, error: 'INVALID_RECORD', message: '유효하지 않은 케이스북 레코드 규격입니다 (schemaVersion === 1 필수).' };
  }
  try {
    const existing = loadSavedCasebookRecords();
    const index = existing.findIndex((r) => r.id === record.id || (r.runId === record.runId && r.alertId === record.alertId));
    const normalizedRecord: CasebookRecord = {
      ...record,
      schemaVersion: 1,
    };
    if (index >= 0) {
      existing[index] = normalizedRecord;
    } else {
      existing.unshift(normalizedRecord);
    }
    localStorage.setItem(FAB_ONE_CASEBOOK_STORAGE_KEY, JSON.stringify(existing));
    return { success: true, message: '사건 조사 상태가 Casebook에 성공적으로 저장되었습니다.' };
  } catch (err: any) {
    const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
    return {
      success: false,
      error: isQuota ? 'QUOTA_EXCEEDED' : 'DISABLED',
      message: isQuota
        ? '로컬 스토리지 용량이 초과되어 케이스북을 저장하지 못했습니다.'
        : '로컬 스토리지를 사용할 수 없거나 브라우저 권한에 의해 차단되었습니다.',
    };
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

export interface CasebookImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  totalParsed: number;
  records: CasebookRecord[];
  error?: 'SYNTAX_ERROR' | 'NOT_AN_ARRAY' | 'NO_VALID_RECORDS' | 'STORAGE_ERROR' | 'PAYLOAD_TOO_LARGE' | 'TOO_MANY_RECORDS';
}

/**
 * Validates and imports Casebook backup JSON records safely.
 * Includes payload size limits (<500KB), record count limits (<=100), and strict schema v1 validation.
 */
export function validateAndImportCasebookRecords(rawJson: string): CasebookImportResult {
  if (!rawJson || typeof rawJson !== 'string' || rawJson.trim().length === 0) {
    return {
      success: false,
      message: '빈 내용의 파일입니다. JSON 형식을 확인해 주십시오.',
      importedCount: 0,
      totalParsed: 0,
      records: loadSavedCasebookRecords(),
      error: 'SYNTAX_ERROR',
    };
  }

  // Security & memory guard: 500KB payload limit
  if (rawJson.length > 500000) {
    return {
      success: false,
      message: '파일 용량 초과: 케이스북 백업 파일은 최대 500KB까지 지원됩니다.',
      importedCount: 0,
      totalParsed: 0,
      records: loadSavedCasebookRecords(),
      error: 'PAYLOAD_TOO_LARGE',
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      success: false,
      message: 'JSON 파싱 오류: 올바른 JSON 파일이 아닙니다.',
      importedCount: 0,
      totalParsed: 0,
      records: loadSavedCasebookRecords(),
      error: 'SYNTAX_ERROR',
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      success: false,
      message: '형식 오류: 케이스북 백업은 레코드 배열(Array) 형식이어야 합니다.',
      importedCount: 0,
      totalParsed: 0,
      records: loadSavedCasebookRecords(),
      error: 'NOT_AN_ARRAY',
    };
  }

  // Array length limit: max 100 records
  if (parsed.length > 100) {
    return {
      success: false,
      message: '레코드 수 초과: 한 번에 최대 100건까지의 레코드만 가져올 수 있습니다.',
      importedCount: 0,
      totalParsed: parsed.length,
      records: loadSavedCasebookRecords(),
      error: 'TOO_MANY_RECORDS',
    };
  }

  const validRecords: CasebookRecord[] = [];
  const seenIds = new Set<string>();

  for (const item of parsed) {
    if (isValidCasebookRecord(item)) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        validRecords.push({
          ...item,
          schemaVersion: 1,
        });
      }
    }
  }

  if (validRecords.length === 0) {
    return {
      success: false,
      message: '유효한 Casebook v1 레코드가 없거나 스키마가 호환되지 않습니다 (schemaVersion === 1 필수).',
      importedCount: 0,
      totalParsed: parsed.length,
      records: loadSavedCasebookRecords(),
      error: 'NO_VALID_RECORDS',
    };
  }

  const existing = loadSavedCasebookRecords();
  let count = 0;
  for (const rec of validRecords) {
    const idx = existing.findIndex((e) => e.id === rec.id || (e.runId === rec.runId && e.alertId === rec.alertId));
    if (idx >= 0) {
      existing[idx] = rec;
    } else {
      existing.unshift(rec);
    }
    count++;
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAB_ONE_CASEBOOK_STORAGE_KEY, JSON.stringify(existing));
    }
    const skipped = parsed.length - validRecords.length;
    const msg = skipped > 0
      ? `${count}건의 유효 Casebook v1 사례를 복원했습니다 (비호환/손상된 ${skipped}건 제외).`
      : `${count}건의 Casebook v1 사례를 성공적으로 복원했습니다.`;
    return {
      success: true,
      message: msg,
      importedCount: count,
      totalParsed: parsed.length,
      records: existing,
    };
  } catch (err: any) {
    return {
      success: false,
      message: '로컬 스토리지 저장 용량이 초과되었거나 스토리지가 비활성화되어 있습니다.',
      importedCount: 0,
      totalParsed: parsed.length,
      records: loadSavedCasebookRecords(),
      error: 'STORAGE_ERROR',
    };
  }
}

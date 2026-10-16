'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';
import {
  EvidenceItem,
  HypothesisItem,
  ActionItem,
  HypothesisStatus,
  WORKSPACE_DOMAIN_DISCLAIMERS,
  parseSafeWorkspaceSeed,
  isWorkspaceAlertSupported,
  generateDefaultEvidenceItems,
  generateDefaultHypotheses,
  generateDefaultActions,
  getNextHypothesisStatus,
  toggleLinkedEvidence,
  getWorkspaceNavLinks,
  mapInvestigationDetailToEvidence,
  generateCaseReportMarkdown,
  generateCaseReportFilename,
  isCaseReportExportable,
  CaseReportPayload,
  CaseReportSensorEvidence,
  CasebookRecord,
  loadSavedCasebookRecords,
  saveCasebookRecordToStorage,
  deleteCasebookRecordFromStorage,
  FAB_ONE_CASEBOOK_STORAGE_KEY,
} from '@/components/engineering-workspace/engineering-workspace-contract';
import { TourReturnBanner } from '@/components/guided-demo';

interface WaferCassetteSummary {
  total: number;
  confirmed: string[];
  candidate: string[];
  unexposedCount: number;
}

interface WorkspaceErrorState {
  status: number;
  title: string;
  message: string;
}

function getHypothesisStatusLabel(status: HypothesisStatus): string {
  switch (status) {
    case 'SUPPORTED_FOR_REVIEW':
      return '검토 지지 (SUPPORTED_FOR_REVIEW)';
    case 'NEEDS_MORE_DATA':
      return '추가 데이터 필요 (NEEDS_MORE_DATA)';
    case 'RULED_OUT':
      return '배제 (RULED_OUT)';
    case 'UNVERIFIED':
    default:
      return '미검증 (UNVERIFIED)';
  }
}

function EngineeringWorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse query parameters
  const querySeed = searchParams.get('seed');
  const queryAlert = searchParams.get('alert');
  const queryTourStep = searchParams.get('tourStep');
  const queryMode = searchParams.get('mode');
  const queryRunId = searchParams.get('run_id');
  const queryTab = searchParams.get('tab');

  const seed = useMemo(() => parseSafeWorkspaceSeed(querySeed), [querySeed]);
  const expectedAlertId = useMemo(() => `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`, [seed]);

  const isExplicitModeB = queryMode === 'B' || !!queryRunId;

  // Active Tab: Investigation vs Casebook
  const [activeTab, setActiveTab] = useState<'INVESTIGATION' | 'CASEBOOK'>(() => {
    return queryTab === 'casebook' ? 'CASEBOOK' : 'INVESTIGATION';
  });

  // Mode and Data States
  const [mode, setMode] = useState<'A' | 'B'>(isExplicitModeB ? 'B' : 'A');
  const [runId, setRunId] = useState<string>(() => queryRunId || `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`);
  const [sessionId, setSessionId] = useState<string>('SES-SYN-01');
  const [lotId, setLotId] = useState<string>(() => `LOT-DEMO-${800 + (seed % 50)}`);
  const [alertId, setAlertId] = useState<string>(() => queryAlert || expectedAlertId);
  const [serverActiveAlertId, setServerActiveAlertId] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState<string>('ETCH-02');
  const [chamberId, setChamberId] = useState<string>('CH-B');
  const [recipeId, setRecipeId] = useState<string>('RCP-ETCH-POLY-04');
  const [severity, setSeverity] = useState<string>('CRITICAL');
  const [ruleCode, setRuleCode] = useState<string>('FDC-RULE-SPC-UCL-01');

  // Evidence list: if explicit Mode B, initial evidence is empty to prevent flash of Mode A
  const [evidence, setEvidence] = useState<EvidenceItem[]>(() =>
    isExplicitModeB ? [] : generateDefaultEvidenceItems(seed)
  );
  const [isSupportedAlert, setIsSupportedAlert] = useState<boolean>(() =>
    isExplicitModeB ? false : isWorkspaceAlertSupported(queryAlert, expectedAlertId)
  );
  const [rawInvestigationDetail, setRawInvestigationDetail] = useState<any>(null);

  const [wafersSummary, setWafersSummary] = useState<WaferCassetteSummary>({
    total: 25,
    confirmed: ['W-01', 'W-02', 'W-03', 'W-04', 'W-05', 'W-06', 'W-07'],
    candidate: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12'],
    unexposedCount: 13,
  });

  const [isLoading, setIsLoading] = useState<boolean>(isExplicitModeB);
  const [errorState, setErrorState] = useState<WorkspaceErrorState | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [casebookNotice, setCasebookNotice] = useState<string | null>(null);

  // In-memory UI states (volatile until saved in Casebook)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('EVI-02');
  const [hypotheses, setHypotheses] = useState<HypothesisItem[]>(() => generateDefaultHypotheses());
  const [actions, setActions] = useState<ActionItem[]>(() => generateDefaultActions());
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>('HYPO-01');
  const [notes, setNotes] = useState<string>('');

  // Casebook state
  const [savedCaseRecords, setSavedCaseRecords] = useState<CasebookRecord[]>([]);
  const [serverRuns, setServerRuns] = useState<Array<any>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nav links preserving active context
  const navLinks = useMemo(
    () => getWorkspaceNavLinks(seed, alertId, mode, runId),
    [seed, alertId, mode, runId]
  );

  // Load saved Casebook records from localStorage
  useEffect(() => {
    setSavedCaseRecords(loadSavedCasebookRecords());
  }, []);

  // Fetch recent server runs for Casebook history in Mode B
  useEffect(() => {
    async function fetchServerRuns() {
      try {
        const res = await fetch('http://localhost:8000/api/v1/demo/runs', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setServerRuns(data);
          }
        }
      } catch {
        // Backend not reachable, ignore
      }
    }
    fetchServerRuns();
  }, [mode]);

  // Request counter to guard against race conditions
  const activeReqIdRef = useRef<number>(0);

  // Data Loading Routine (Summary-first with Mode B fail-closed boundary)
  const loadWorkspaceData = useCallback(async () => {
    const reqId = ++activeReqIdRef.current;
    setIsLoading(true);
    setErrorState(null);
    setExportNotice(null);

    // Mode A branch: When not explicitly Mode B
    if (!isExplicitModeB) {
      setMode('A');
      const safeSeed = parseSafeWorkspaceSeed(querySeed);
      const modeARunId = `RUN-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
      const modeAAlertId = `AL-DEMO-${String(safeSeed % 1000).padStart(3, '0')}`;
      const modeALotId = `LOT-DEMO-${800 + (safeSeed % 50)}`;

      const isSupp = isWorkspaceAlertSupported(queryAlert, modeAAlertId);
      setIsSupportedAlert(isSupp);
      setRunId(modeARunId);
      setSessionId('SES-SYN-01');
      setLotId(modeALotId);
      setAlertId(queryAlert || modeAAlertId);

      if (isSupp) {
        const fixtureEvidence = generateDefaultEvidenceItems(safeSeed);
        setEvidence(fixtureEvidence);
        setSelectedEvidenceId('EVI-02');
        setWafersSummary({
          total: 25,
          confirmed: ['W-01', 'W-02', 'W-03', 'W-04', 'W-05', 'W-06', 'W-07'],
          candidate: ['W-08', 'W-09', 'W-10', 'W-11', 'W-12'],
          unexposedCount: 13,
        });
      } else {
        setEvidence([]);
      }
      setIsLoading(false);
      return;
    }

    // Mode B branch: Real backend API communication
    // Step 1: Initial Discovery Fetch
    let summaryRes: Response;
    try {
      summaryRes = await fetch('http://localhost:8000/api/v1/demo/summary', { cache: 'no-store' });
    } catch {
      // Genuine network disconnect to API server fails closed in Mode B
      if (reqId !== activeReqIdRef.current) return;
      setMode('B');
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 503,
        title: 'Mode B API 서버 연결 실패 (Backend Disconnected)',
        message: 'FastAPI 서버(http://localhost:8000)와 통신할 수 없습니다. 요청된 모드가 Mode B이므로 합성 데이터로 자동 대체하지 않고 조회를 차단합니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    // Step 2: Mode B Pipeline (Server is reachable, any subsequent failure fails closed in Mode B)
    setMode('B');

    if (!summaryRes.ok) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: summaryRes.status,
        title: `서버 요약 조회 실패 (HTTP ${summaryRes.status})`,
        message: 'API 서버 요약 정보를 가져오지 못해 데이터 무결성을 위해 워크스페이스 조회를 차단했습니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    let summaryData: any;
    try {
      summaryData = await summaryRes.json();
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 502,
        title: '서버 응답 형식 오류 (HTTP 502 / Malformed JSON)',
        message: '서버가 반환한 요약 데이터 형식이 올바른 JSON이 아닙니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    const currentRunId = summaryData?.active_run_id;
    if (!currentRunId || typeof currentRunId !== 'string') {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 500,
        title: '활성 공정 Run 부재 오류',
        message: '서버에 활성화된 공정 Run ID가 존재하지 않아 조회를 차단했습니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    // Lineage check: If query specifies run_id, verify it matches active_run_id!
    if (queryRunId && queryRunId.trim() !== currentRunId.trim()) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 409,
        title: '공정 Run 불일치 (Run Lineage Mismatch)',
        message: `요청된 Run ID (${queryRunId})가 서버의 현재 활성 Run ID (${currentRunId})와 일치하지 않습니다. 데이터 교차 오염을 방지하기 위해 조회를 차단했습니다 (Fail-closed).`,
      });
      setIsLoading(false);
      return;
    }

    const trimmedQueryAlert = queryAlert ? queryAlert.trim() : null;

    // Check if requested alert is an unsupported standby alert
    if (trimmedQueryAlert && (trimmedQueryAlert.startsWith('AL-STANDBY') || trimmedQueryAlert === 'AL-STANDBY-001')) {
      setRunId(currentRunId);
      setLotId(summaryData.lot_id || 'LOT-DEMO-801');
      setAlertId(trimmedQueryAlert);
      setIsSupportedAlert(false);
      setEvidence([]);

      try {
        const activeInvRes = await fetch('http://localhost:8000/api/v1/demo/investigation', { cache: 'no-store' });
        if (activeInvRes.ok) {
          const activeInvData = await activeInvRes.json();
          if (activeInvData.alert_id) {
            setServerActiveAlertId(activeInvData.alert_id);
          }
        }
      } catch {
        // ignore background discovery error
      }

      setIsLoading(false);
      return;
    }

    // Step 3: Fetch Investigation Detail
    const invUrl = trimmedQueryAlert
      ? `http://localhost:8000/api/v1/demo/investigation?alert_id=${encodeURIComponent(trimmedQueryAlert)}`
      : 'http://localhost:8000/api/v1/demo/investigation';

    let invRes: Response;
    try {
      invRes = await fetch(invUrl, { cache: 'no-store' });
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 500,
        title: '서버 통신 실패 (Network Disrupted)',
        message: '조사 상세 데이터 수신 중 네트워크 연결이 끊어졌습니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    if (!invRes.ok) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: invRes.status,
        title:
          invRes.status === 404
            ? '조사 대상 알람 미지원 또는 불일치 (HTTP 404)'
            : `조사 상세 조회 실패 (HTTP ${invRes.status})`,
        message:
          invRes.status === 404
            ? `요청된 알람(${trimmedQueryAlert || '미지정'})은 활성 공정 Run(${currentRunId})과 일치하지 않거나 대기 상태 알람입니다.`
            : `서버가 HTTP ${invRes.status} 상태를 반환했습니다.`,
      });
      setIsLoading(false);
      return;
    }

    let invData: any;
    try {
      invData = await invRes.json();
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 502,
        title: '조사 데이터 파싱 오류 (HTTP 502)',
        message: '수신된 조사 상세 데이터가 올바른 JSON 형식이 아닙니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    // Lineage validation: Ensure returned investigation belongs to active run
    if (invData.run_id !== currentRunId) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 500,
        title: '데이터 계통성 불일치 오류 (Lineage Mismatch)',
        message: `조사 데이터의 Run ID(${invData.run_id})가 활성 공정 Run(${currentRunId})과 일치하지 않아 조회를 차단했습니다.`,
      });
      setIsLoading(false);
      return;
    }

    // Atomic state commit in Mode B
    setRunId(invData.run_id);
    setSessionId(summaryData.active_session_id || 'SES-SYN-01');
    setLotId(invData.lot_id);
    setAlertId(invData.alert_id);
    setServerActiveAlertId(invData.alert_id);
    setEquipmentId(invData.equipment_id);
    setChamberId(invData.chamber_id);
    setRecipeId(invData.recipe_id);
    setSeverity(invData.severity);
    setRuleCode(invData.rule_code);
    setIsSupportedAlert(true);
    setErrorState(null);
    setRawInvestigationDetail(invData);

    const mappedEvidence = mapInvestigationDetailToEvidence(invData, seed);
    setEvidence(mappedEvidence);
    setSelectedEvidenceId(mappedEvidence[1]?.id || mappedEvidence[0]?.id || 'EVI-02');

    setWafersSummary({
      total: invData.total_wafers || 25,
      confirmed: invData.confirmed_exposed_wafers || [],
      candidate: invData.candidate_exposed_wafers || [],
      unexposedCount: invData.unexposed_wafers_count || 0,
    });

    setIsLoading(false);
  }, [querySeed, queryAlert, queryMode, queryRunId, isExplicitModeB, seed]);

  // Initial load on mount or parameter changes
  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Re-synchronize hypothesis and actions defaults if seed changes in Mode A
  useEffect(() => {
    if (mode === 'A') {
      setHypotheses(generateDefaultHypotheses());
      setActions(generateDefaultActions());
    }
  }, [seed, mode]);

  // Selected Evidence Item
  const selectedEvidence = useMemo(() => {
    if (evidence.length === 0) return null;
    return evidence.find((e) => e.id === selectedEvidenceId) || evidence[0];
  }, [evidence, selectedEvidenceId]);

  // Status cycling for a hypothesis
  const handleCycleStatus = useCallback((hypoId: string) => {
    setHypotheses((prev) =>
      prev.map((hyp) => {
        if (hyp.id !== hypoId) return hyp;
        const nextStatus = getNextHypothesisStatus(hyp.status);
        let nextLabel = '미검증 (UNVERIFIED)';
        if (nextStatus === 'SUPPORTED_FOR_REVIEW') nextLabel = '검토 지지 (SUPPORTED_FOR_REVIEW)';
        else if (nextStatus === 'NEEDS_MORE_DATA') nextLabel = '추가 데이터 필요 (NEEDS_MORE_DATA)';
        else if (nextStatus === 'RULED_OUT') nextLabel = '배제 (RULED_OUT)';
        return {
          ...hyp,
          status: nextStatus,
          statusLabel: nextLabel,
        };
      })
    );
  }, []);

  // Toggle evidence attachment for a hypothesis
  const handleToggleEvidenceLink = useCallback((hypoId: string, evidenceId: string) => {
    setHypotheses((prev) =>
      prev.map((hyp) => {
        if (hyp.id !== hypoId) return hyp;
        return {
          ...hyp,
          linkedEvidenceIds: toggleLinkedEvidence(hyp.linkedEvidenceIds, evidenceId),
        };
      })
    );
  }, []);

  // Toggle action completion
  const handleToggleAction = useCallback((actionId: string) => {
    setActions((prev) =>
      prev.map((act) => {
        if (act.id !== actionId) return act;
        return { ...act, completed: !act.completed };
      })
    );
  }, []);

  // Reset actions
  const handleResetActions = useCallback(() => {
    setActions(generateDefaultActions());
    setNotes('');
  }, []);

  // Reset hypotheses
  const handleResetHypotheses = useCallback(() => {
    setHypotheses(generateDefaultHypotheses());
  }, []);

  // Switch to supported active alert
  const handleSwitchToActiveAlert = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const targetAlert = mode === 'B' && serverActiveAlertId ? serverActiveAlertId : expectedAlertId;
    params.set('alert', targetAlert);
    if (mode === 'B') {
      params.set('mode', 'B');
      if (runId) params.set('run_id', runId);
    }
    router.replace(`/engineering-workspace?${params.toString()}`);
  }, [searchParams, mode, serverActiveAlertId, expectedAlertId, runId, router]);

  // Re-synthesis (advance seed)
  const handleResynthesize = useCallback(() => {
    const nextSeed = seed + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set('seed', String(nextSeed));
    params.delete('alert');
    router.replace(`/engineering-workspace?${params.toString()}`);
  }, [seed, searchParams, router]);

  // Exportable Evaluation Guard
  const isExportable = useMemo(() => {
    return isCaseReportExportable(isSupportedAlert, errorState !== null, isLoading, runId);
  }, [isSupportedAlert, errorState, isLoading, runId]);

  // Handle Case Report Export (Markdown Download adhering to Truth Contract)
  const handleExportCaseReport = useCallback(() => {
    if (!isExportable) return;

    // Filter strictly physical sensors (No FDC alert or wafer items in sensors table)
    const physicalSensorList: CaseReportSensorEvidence[] = [];

    if (rawInvestigationDetail?.evidence_sensors && Array.isArray(rawInvestigationDetail.evidence_sensors)) {
      for (const s of rawInvestigationDetail.evidence_sensors) {
        physicalSensorList.push({
          sensorId: s.sensor_id,
          sensorName: s.sensor_name,
          observedValue: s.measured_value,
          unit: s.unit,
          qualityFlag: s.quality_flag as any,
          uclThreshold: s.ucl_threshold,
          targetValue: s.target_value,
          deviationPercent: s.deviation_percent,
        });
      }
    } else {
      // In Mode A or fallback, map ONLY physical sensors from default baseline
      physicalSensorList.push(
        {
          sensorId: 'RELATIVE_SIGNAL',
          sensorName: '광학 발광 상대 신호 (OES Relative Signal)',
          observedValue: 80.0,
          unit: 'a.u.',
          qualityFlag: 'SUSPECT',
          uclThreshold: 65.0,
          targetValue: 50.0,
          deviationPercent: 23.1,
          details: 'Step T7 관리한계(UCL 65.0) 초과 계측',
        },
        {
          sensorId: 'CHAMBER_PRESSURE',
          sensorName: '챔버 공정 진공 압력 (Capacitance Manometer)',
          observedValue: 168.5,
          unit: 'mTorr',
          qualityFlag: 'SUSPECT',
          uclThreshold: 140.0,
          targetValue: 120.0,
          deviationPercent: 20.4,
          details: 'Step T7 진공 압력 일탈',
        },
        {
          sensorId: 'RF_POWER',
          sensorName: 'RF 플라즈마 전원 출력 (RF Generator Forward Power)',
          observedValue: 1820.0,
          unit: 'W',
          qualityFlag: 'SUSPECT',
          uclThreshold: 1650.0,
          targetValue: 1500.0,
          deviationPercent: 10.3,
          details: 'Step T7 RF 전원 서지',
        }
      );
    }

    const payload: CaseReportPayload = {
      reportId: `INV-${alertId}`,
      generatedAtUtc: new Date().toISOString(),
      mode,
      dataOrigin: 'synthetic',
      runId,
      sessionId,
      lotId,
      alertId,
      severity,
      ruleCode,
      equipmentId,
      chamberId,
      recipeId,
      sensors: physicalSensorList,
      wafers: {
        total: wafersSummary.total,
        confirmedWafers: wafersSummary.confirmed,
        candidateWafers: wafersSummary.candidate,
        unexposedCount: wafersSummary.unexposedCount,
      },
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        title: h.title,
        domain: h.domain,
        status: h.status,
        statusLabel: getHypothesisStatusLabel(h.status),
        linkedEvidenceIds: h.linkedEvidenceIds,
        engineeringRationale: h.engineeringRationale,
      })),
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        assigneeRole: a.assigneeRole,
        priority: a.priority,
        completed: a.completed,
        targetSystem: a.targetSystem,
        detail: a.detail,
      })),
      userNotes: notes,
    };

    const markdown = generateCaseReportMarkdown(payload);
    const filename = generateCaseReportFilename(runId);

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotice(`사건 조사 보고서(${filename})가 성공적으로 다운로드되었습니다.`);
  }, [
    isExportable,
    rawInvestigationDetail,
    alertId,
    mode,
    runId,
    sessionId,
    lotId,
    severity,
    ruleCode,
    equipmentId,
    chamberId,
    recipeId,
    wafersSummary,
    hypotheses,
    actions,
    notes,
  ]);

  // Save current active investigation to Casebook
  const handleSaveCurrentToCasebook = useCallback(() => {
    if (!isExportable) return;

    const recordId = `CASE-${runId}-${Date.now()}`;
    const record: CasebookRecord = {
      id: recordId,
      runId,
      sessionId,
      alertId,
      seed,
      mode,
      dataOrigin: 'synthetic',
      equipmentId,
      chamberId,
      lotId,
      savedAtUtc: new Date().toISOString(),
      status: 'REVIEWED',
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        title: h.title,
        domain: h.domain,
        status: h.status,
        statusLabel: getHypothesisStatusLabel(h.status),
        linkedEvidenceIds: h.linkedEvidenceIds,
        engineeringRationale: h.engineeringRationale,
      })),
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        assigneeRole: a.assigneeRole,
        priority: a.priority,
        completed: a.completed,
        targetSystem: a.targetSystem,
        detail: a.detail,
      })),
      userNotes: notes,
      reportExported: false,
    };

    saveCasebookRecordToStorage(record);
    setSavedCaseRecords(loadSavedCasebookRecords());
    setCasebookNotice(`현재 사건(${runId} / ${alertId})이 Casebook에 성공적으로 저장되었습니다.`);
  }, [isExportable, runId, sessionId, alertId, seed, mode, equipmentId, chamberId, lotId, hypotheses, actions, notes]);

  // Load a saved Casebook record into Workspace
  const handleLoadCasebookRecord = useCallback((record: CasebookRecord) => {
    // Restore human decisions
    setNotes(record.userNotes || '');
    if (Array.isArray(record.hypotheses)) {
      setHypotheses((prev) =>
        prev.map((orig) => {
          const matched = record.hypotheses.find((h) => h.id === orig.id);
          if (matched) {
            return {
              ...orig,
              status: matched.status as HypothesisStatus,
              statusLabel: matched.statusLabel,
              linkedEvidenceIds: matched.linkedEvidenceIds || [],
            };
          }
          return orig;
        })
      );
    }
    if (Array.isArray(record.actions)) {
      setActions((prev) =>
        prev.map((orig) => {
          const matched = record.actions.find((a) => a.id === orig.id);
          if (matched) {
            return { ...orig, completed: matched.completed };
          }
          return orig;
        })
      );
    }
    setActiveTab('INVESTIGATION');
    setCasebookNotice(`Casebook 기록(${record.id})의 가설/조치/메모를 워크스페이스에 불러왔습니다.`);
  }, []);

  // Delete a saved Casebook record
  const handleDeleteCasebookRecord = useCallback((id: string) => {
    deleteCasebookRecordFromStorage(id);
    setSavedCaseRecords(loadSavedCasebookRecords());
    setCasebookNotice(`Casebook 사례(${id})가 삭제되었습니다.`);
  }, []);

  // Export Casebook backup as JSON
  const handleExportCasebookJson = useCallback(() => {
    const records = loadSavedCasebookRecords();
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Import Casebook backup from JSON
  const handleImportFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          let count = 0;
          for (const item of parsed) {
            if (item && item.id && item.runId) {
              saveCasebookRecordToStorage(item);
              count++;
            }
          }
          setSavedCaseRecords(loadSavedCasebookRecords());
          setCasebookNotice(`${count}건의 Casebook 사례를 성공적으로 가져왔습니다.`);
        }
      } catch {
        setCasebookNotice('Casebook JSON 파일 파싱에 실패했습니다.');
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#1E293B', fontFamily: 'sans-serif' }}>
      {/* Top Header */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="logo-badge"
            aria-hidden="true"
            style={{
              background: '#0B9F78',
              color: '#FFFFFF',
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            F1
          </div>
          <div>
            <span className="brand-title" style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
              FAB ONE
            </span>
            <span className="brand-subtitle" style={{ fontSize: '13px', color: '#64748B', marginLeft: '6px' }}>
              · Engineering Workspace & Casebook (BUILD-13)
            </span>
          </div>
        </div>

        {/* Unified 6-Tab Navigation Bar */}
        <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="화면 탭">
          <Link href={`/?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            홈 (FDC 모니터링)
          </Link>
          <Link href={`/traceability?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            웨이퍼 이력 추적성 (Traceability)
          </Link>
          <Link href={`/command-center?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            FDC 커맨드 센터 (Command Center)
          </Link>
          <Link href={`/equipment-intelligence?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            설비 인텔리전스 (Equipment)
          </Link>
          <Link href={`/fab-simulation?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            FAB 시뮬레이션 (Simulation)
          </Link>
          <Link href={`/engineering-workspace?seed=${seed}`} className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            엔지니어링 워크스페이스 (Workspace)
          </Link>
          <Link
            href={queryTourStep ? `/demo-tour?seed=${seed}&step=${queryTourStep}` : `/demo-tour?seed=${seed}`}
            className="nav-tab-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            가이드 투어 (Demo Tour)
          </Link>
        </nav>

        {/* Status Pills & Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            id={mode === 'B' ? 'ws-mode-b-badge' : 'ws-mode-a-badge'}
            className="pill"
            style={{
              background: mode === 'B' ? '#EFF6FF' : '#ECFDF5',
              color: mode === 'B' ? '#1D4ED8' : '#047857',
              border: `1px solid ${mode === 'B' ? '#BFDBFE' : '#A7F3D0'}`,
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {mode === 'B' ? 'Mode B (Live API)' : 'Mode A (합성 분석)'}
          </span>
          <span
            className="pill"
            style={{
              background: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Run: {runId}
          </span>
          <span
            className="pill"
            style={{
              background: isSupportedAlert ? '#F1F5F9' : '#FEF2F2',
              color: isSupportedAlert ? '#475569' : '#991B1B',
              border: `1px solid ${isSupportedAlert ? '#CBD5E1' : '#FECACA'}`,
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Alert: {isSupportedAlert ? navLinks.alertId : `${queryAlert} (지원 안 됨 / 비활성)`}
          </span>

          {/* BUILD-12 Case Report Export Button */}
          <button
            type="button"
            id="ws-btn-export-case-report"
            onClick={handleExportCaseReport}
            disabled={!isExportable}
            aria-disabled={!isExportable}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              background: isExportable ? '#0B9F78' : '#E2E8F0',
              color: isExportable ? '#FFFFFF' : '#94A3B8',
              border: isExportable ? '1px solid #059669' : '1px solid #CBD5E1',
              borderRadius: '6px',
              cursor: isExportable ? 'pointer' : 'not-allowed',
              opacity: isExportable ? 1 : 0.6,
              transition: 'all 0.15s ease',
            }}
            title={
              isExportable
                ? '조사 결정 기록을 Markdown 파일로 내보냅니다 (Export Case Report)'
                : '지원되지 않는 알람이거나 데이터 로드에 실패하여 케이스 보고서를 내보낼 수 없습니다 (Data Isolation Lock)'
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>조사 케이스 요약 / Export Case Report 📥</span>
          </button>

          <button
            type="button"
            id="ws-btn-resynthesize"
            className="btn-secondary"
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={handleResynthesize}
            title="난수 시드를 변경하여 새로운 합성 시나리오를 생성합니다"
          >
            시드 변경 (Seed: {seed}) ⟳
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px' }}>
        {/* BUILD-10 Tour Return Banner */}
        <TourReturnBanner tourStep={queryTourStep} seed={seed} />

        {/* Workspace vs Casebook Tab Selector & Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '2px solid #E2E8F0',
            paddingBottom: '8px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
          role="tablist"
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              role="tab"
              id="ws-tab-active-investigation"
              aria-selected={activeTab === 'INVESTIGATION'}
              onClick={() => setActiveTab('INVESTIGATION')}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'INVESTIGATION' ? '#0B9F78' : '#F1F5F9',
                color: activeTab === 'INVESTIGATION' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              실시간 사건 분석 (Live Run Investigation)
            </button>
            <button
              type="button"
              role="tab"
              id="ws-tab-casebook"
              aria-selected={activeTab === 'CASEBOOK'}
              onClick={() => setActiveTab('CASEBOOK')}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 800,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'CASEBOOK' ? '#0B9F78' : '#F1F5F9',
                color: activeTab === 'CASEBOOK' ? '#FFFFFF' : '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              사건 기록 보관소 (Investigation Casebook 📚)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              id="ws-btn-save-casebook"
              onClick={handleSaveCurrentToCasebook}
              disabled={!isExportable}
              aria-disabled={!isExportable}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                background: isExportable ? '#3B82F6' : '#E2E8F0',
                color: isExportable ? '#FFFFFF' : '#94A3B8',
                border: isExportable ? '1px solid #2563EB' : '1px solid #CBD5E1',
                borderRadius: '6px',
                cursor: isExportable ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="현재 조사 중인 가설 판정, 조치 체크, 엔지니어링 메모를 Casebook에 저장합니다"
            >
              Casebook에 현재 사례 저장 💾
            </button>
          </div>
        </div>

        {/* Casebook Notice Banner */}
        {casebookNotice && (
          <div
            id="ws-casebook-notice-banner"
            style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#1D4ED8',
            }}
          >
            <span>ℹ️ {casebookNotice}</span>
            <button
              type="button"
              onClick={() => setCasebookNotice(null)}
              style={{ background: 'none', border: 'none', color: '#1E40AF', cursor: 'pointer', fontWeight: 700 }}
            >
              닫기 ✕
            </button>
          </div>
        )}

        {/* Export Success Notice Banner */}
        {exportNotice && (
          <div
            id="ws-export-notice-banner"
            style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#065F46',
            }}
          >
            <span>✓ {exportNotice}</span>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontWeight: 700 }}
            >
              닫기 ✕
            </button>
          </div>
        )}

        {/* Mode B Fail-Closed Error Banner */}
        {errorState && (
          <div
            id="ws-mode-b-error-banner"
            data-status={errorState.status}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#991B1B',
            }}
          >
            {errorState.status === 409 && <div id="ws-run-mismatch-banner" style={{ display: 'none' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800 }}>
              <span>⚠️</span>
              <span>{errorState.title}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#B91C1C' }}>{errorState.message}</div>
          </div>
        )}

        {/* Unsupported Alert Notice if applicable */}
        {!isSupportedAlert && (
          <div
            id="unsupported-alert-banner"
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#991B1B' }}>
              <span style={{ fontWeight: 800, fontSize: '16px' }}>⚠️</span>
              <div>
                <strong>지원되지 않거나 대기 상태(Standby)인 알람입니다:</strong> {alertId}
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  요청된 알람은 활성 공정 일탈 런({runId})과 일치하지 않습니다. 허위 데이터로 조용히 대체하지 않고
                  데이터를 격리 잠금(Data Isolation Lock) 처리합니다.
                </div>
              </div>
            </div>
            <button
              type="button"
              id="ws-btn-switch-active-alert"
              onClick={handleSwitchToActiveAlert}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              활성 알람({mode === 'B' && serverActiveAlertId ? serverActiveAlertId : expectedAlertId})으로 전환 ↗
            </button>
          </div>
        )}

        {/* Tab View 1: Active Live Investigation */}
        {activeTab === 'INVESTIGATION' && (
          <div>
            {/* Workflow Callout Banner */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '12px 18px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#166534' }}>
                  <span style={{ fontWeight: 800 }}>📌 엔지니어링 분석 워크스페이스 (증거·가설·조치 보드):</span>
                  <span>
                    8단계 흐름: FAB 시뮬레이션(T7) → FDC 커맨드 센터(경보) → 워크스페이스(가설/증거) → 설비 인텔리전스 →
                    웨이퍼 추적성(W-08) → EKL 용어 확인
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#15803D' }}>
                  {WORKSPACE_DOMAIN_DISCLAIMERS.excursionVsDefect}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span
                  style={{
                    background: '#DCFCE7',
                    color: '#166534',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #86EFAC',
                  }}
                >
                  Excursion ≠ Defect
                </span>
                <span
                  style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #FCD34D',
                  }}
                >
                  MISSING ≠ 0
                </span>
                <span
                  style={{
                    background: '#F1F5F9',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                  }}
                >
                  합성 시연 보고서
                </span>
              </div>
            </div>

            {/* 3-Column Interactive Layout / Unsupported Alert Lock Panel */}
            {isSupportedAlert ? (
              <div id="ws-investigation-board" className="ws-boards-grid">
                {/* Section 1: Evidence Board */}
                <section
                  aria-labelledby="section-evidence-board"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2
                        id="section-evidence-board"
                        style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}
                      >
                        1. 증거 보드 (Evidence Board)
                      </h2>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        센서 관측 사실, FDC 경보, 웨이퍼 노출 이력
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0B9F78',
                        background: '#ECFDF5',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}
                    >
                      {evidence.length}개 사실
                    </span>
                  </div>

                  {/* Invariant Note */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '11px',
                      color: '#475569',
                      lineHeight: 1.4,
                    }}
                  >
                    💡 <strong>과학적 사실 분리:</strong> 증거는 관측된 통계 사실이며, 가설 및 원인 판정과 명확히
                    구분됩니다. (T4/T5 광학 결측은 원인이 아닌 센서 관측 사실)
                  </div>

                  {/* Evidence Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {evidence.map((evi) => {
                      const isSelected = evi.id === selectedEvidenceId;
                      let flagColor = '#059669';
                      let flagBg = '#ECFDF5';
                      if (evi.qualityFlag === 'MISSING') {
                        flagColor = '#D97706';
                        flagBg = '#FEF3C7';
                      } else if (evi.qualityFlag === 'CRITICAL') {
                        flagColor = '#DC2626';
                        flagBg = '#FEF2F2';
                      } else if (evi.qualityFlag === 'SUSPECT') {
                        flagColor = '#EA580C';
                        flagBg = '#FFF7ED';
                      }

                      return (
                        <div
                          key={evi.id}
                          id={`evidence-card-${evi.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedEvidenceId(evi.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedEvidenceId(evi.id);
                            }
                          }}
                          style={{
                            border: isSelected ? '2px solid #0B9F78' : '1px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            background: isSelected ? '#F0FDF4' : '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            outline: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B' }}>
                              [{evi.id}] {evi.category}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color: flagColor,
                                background: flagBg,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: `1px solid ${flagColor}33`,
                              }}
                            >
                              {evi.qualityFlag}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>{evi.title}</div>
                          <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.35 }}>{evi.summary}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0B9F78' }}>
                              계측: {evi.observedValue}
                            </span>
                            {evi.linkUrl && (
                              <Link
                                href={evi.linkUrl}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: '11px', color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {evi.linkLabel || '상세 보기 ↗'}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Evidence Detail */}
                  {selectedEvidence && (
                    <div
                      style={{
                        marginTop: 'auto',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                          증거 상세 계측치: {selectedEvidence.id}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0B9F78',
                            background: '#DCFCE7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {selectedEvidence.observedValue}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', marginTop: '6px', lineHeight: 1.4 }}>
                        {selectedEvidence.details}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                        <strong>출처:</strong> {selectedEvidence.provenance}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '10px', color: '#94A3B8' }}>
                        ※ UCL(상한 관리한계)은 센서 SPC 통계 관리치이며 제품 규격(USL/LSL)과 다릅니다.
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <Link
                          id="btn-evidence-jump-link"
                          href={selectedEvidence.linkUrl}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            background: '#FFFFFF',
                            color: '#0B9F78',
                            border: '1px solid #0B9F78',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          {selectedEvidence.linkLabel}
                        </Link>
                        <button
                          type="button"
                          id="btn-toggle-evidence-link"
                          onClick={() => handleToggleEvidenceLink(selectedHypothesisId, selectedEvidence.id)}
                          style={{
                            background: '#0B9F78',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="선택된 가설에 이 증거를 연결하거나 연결을 해제합니다"
                        >
                          가설 연결 토글 ⇄
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Section 2: Hypothesis Evaluation Board */}
                <section
                  aria-labelledby="section-hypothesis-board"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2
                        id="section-hypothesis-board"
                        style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}
                      >
                        2. 가설 검증 보드 (Hypothesis Board)
                      </h2>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        순환 판정 및 증거 사실 연결
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-reset-hypotheses"
                      onClick={handleResetHypotheses}
                      style={{
                        fontSize: '11px',
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: '#64748B',
                        cursor: 'pointer',
                      }}
                    >
                      초기화 ↺
                    </button>
                  </div>

                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '11px',
                      color: '#475569',
                      lineHeight: 1.4,
                    }}
                  >
                    🔍 <strong>판정 순환:</strong> 버튼을 클릭하여 가설 검토 상태(미검증 → 검토 지지 → 추가 데이터 필요 → 배제)를 순환 변경합니다.
                  </div>

                  {/* Hypothesis List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {hypotheses.map((hyp) => {
                      const isSelected = hyp.id === selectedHypothesisId;
                      let badgeBg = '#F1F5F9';
                      let badgeColor = '#475569';
                      let badgeBorder = '#CBD5E1';
                      if (hyp.status === 'SUPPORTED_FOR_REVIEW') {
                        badgeBg = '#ECFDF5';
                        badgeColor = '#065F46';
                        badgeBorder = '#A7F3D0';
                      } else if (hyp.status === 'NEEDS_MORE_DATA') {
                        badgeBg = '#FEF3C7';
                        badgeColor = '#92400E';
                        badgeBorder = '#FDE68A';
                      } else if (hyp.status === 'RULED_OUT') {
                        badgeBg = '#F3F4F6';
                        badgeColor = '#6B7280';
                        badgeBorder = '#E5E7EB';
                      }

                      return (
                        <div
                          key={hyp.id}
                          id={`hypothesis-card-${hyp.id}`}
                          style={{
                            border: isSelected ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                            borderRadius: '8px',
                            padding: '12px',
                            background: '#FFFFFF',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#3B82F6' }}>
                                [{hyp.id}] {hyp.domain}
                              </span>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                                {hyp.title}
                              </div>
                            </div>
                            <span
                              id={`status-badge-${hyp.id}`}
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBorder}`,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {hyp.statusLabel}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                            {hyp.engineeringRationale}
                          </div>

                          {/* Linked Evidence Chips */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>연결 증거:</span>
                            {evidence.map((evi) => {
                              const isLinked = hyp.linkedEvidenceIds.includes(evi.id);
                              return (
                                <button
                                  type="button"
                                  key={evi.id}
                                  id={hyp.id === 'HYPO-01' && evi.id === 'EVI-01' ? 'btn-toggle-evidence-link' : `btn-link-evidence-${hyp.id}-${evi.id}`}
                                  onClick={() => handleToggleEvidenceLink(hyp.id, evi.id)}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: isLinked ? '1px solid #0B9F78' : '1px solid #CBD5E1',
                                    background: isLinked ? '#ECFDF5' : '#F8FAFC',
                                    color: isLinked ? '#065F46' : '#64748B',
                                    cursor: 'pointer',
                                  }}
                                  title={`${evi.title} 사실을 가설에 연결하거나 해제합니다`}
                                >
                                  {isLinked ? '✓ ' : '+ '}
                                  {evi.id}
                                </button>
                              );
                            })}
                          </div>

                          {/* Action Button to cycle status */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                            <button
                              type="button"
                              id={`btn-cycle-status-${hyp.id}`}
                              onClick={() => handleCycleStatus(hyp.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: '#F1F5F9',
                                color: '#1E293B',
                                border: '1px solid #CBD5E1',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              판정 변경 순환 ↻
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Section 3: Action Checklist & Notes */}
                <section
                  aria-labelledby="section-actions-notes"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2
                        id="section-actions-notes"
                        style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}
                      >
                        3. 조치 점검표 및 메모 (Actions & Notes)
                      </h2>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        가상 점검 항목 이행 및 엔지니어링 기록
                      </div>
                    </div>
                    <button
                      type="button"
                      id="btn-reset-actions"
                      onClick={handleResetActions}
                      style={{
                        fontSize: '11px',
                        background: 'none',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: '#64748B',
                        cursor: 'pointer',
                      }}
                    >
                      초기화 ↺
                    </button>
                  </div>

                  {/* Actions Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {actions.map((act) => (
                      <div
                        key={act.id}
                        id={`action-item-${act.id}`}
                        style={{
                          border: act.completed ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          background: act.completed ? '#F0FDF4' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                        }}
                      >
                        <input
                          type="checkbox"
                          id={`chk-${act.id}`}
                          checked={act.completed}
                          onChange={() => handleToggleAction(act.id)}
                          style={{ marginTop: '3px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label
                              htmlFor={`chk-${act.id}`}
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: act.completed ? '#166534' : '#0F172A',
                                cursor: 'pointer',
                                textDecoration: act.completed ? 'line-through' : 'none',
                              }}
                            >
                              {act.title}
                            </label>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: act.priority === 'HIGH' ? '#FEF2F2' : '#FFF7ED',
                                color: act.priority === 'HIGH' ? '#DC2626' : '#EA580C',
                              }}
                            >
                              {act.priority}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            담당: <strong>{act.assigneeRole}</strong> · 대상: {act.targetSystem}
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.35 }}>
                            {act.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* In-memory Volatile Engineering Notes */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label
                        htmlFor="engineering-workspace-notes"
                        style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}
                      >
                        엔지니어링 메모 (In-memory Volatile)
                      </label>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>새로고침 시 휘발 (단, Casebook 저장 시 보존)</span>
                    </div>
                    <textarea
                      id="engineering-workspace-notes"
                      data-testid="ws-input-user-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="조사 검토 의견, 잠재 리스크, 후속 액션 아이템을 메모하세요... 'Casebook에 저장' 버튼으로 보관할 수 있습니다."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#1E293B',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: '10px', color: '#94A3B8', lineHeight: 1.3 }}>
                      인메모리 휘발성 고지: {WORKSPACE_DOMAIN_DISCLAIMERS.memoryDisclaimer}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div
                id="ws-unsupported-lock-panel"
                style={{
                  background: '#FEF2F2',
                  border: '2px dashed #F87171',
                  borderRadius: '12px',
                  padding: '40px 24px',
                  marginBottom: '24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div style={{ fontSize: '36px' }}>🔒</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#991B1B' }}>
                  엔지니어링 보드 비활성화 및 데이터 격리 (Data Isolation Lock)
                </div>
                <div style={{ maxWidth: '680px', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.6 }}>
                  {errorState ? (
                    <span>
                      <strong>{errorState.title}:</strong> {errorState.message}
                    </span>
                  ) : (
                    <span>
                      요청된 알람(<strong>{alertId}</strong>)은 지원되지 않거나 대기 상태(Standby)인 알람입니다.<br />
                      FAB ONE의 합성 Run 계통성을 보호하기 위해 타 런의 증거/가설/조치 보드를 허위로 표기하지 않고 격리 잠금 처리했습니다.<br />
                      현재 활성 공정 일탈 런(<strong>{runId}</strong>)의 분석 데이터를 로드하려면 활성 알람(
                      <strong>{mode === 'B' && serverActiveAlertId ? serverActiveAlertId : expectedAlertId}</strong>)으로 전환하십시오.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  id="ws-btn-switch-active-alert-lock"
                  onClick={handleSwitchToActiveAlert}
                  style={{
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  }}
                >
                  활성 알람({mode === 'B' && serverActiveAlertId ? serverActiveAlertId : expectedAlertId})으로 전환 ↗
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab View 2: Investigation Casebook */}
        {activeTab === 'CASEBOOK' && (
          <div id="ws-casebook-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Casebook Header & Action Bar */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  사건 기록 보관소 (Investigation Casebook 📚)
                </h2>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  저장된 과거 조사 사례와 최근 합성 Run 이력을 조회·비교하고 워크스페이스로 다시 불러옵니다.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="ws-btn-export-casebook-json"
                  onClick={handleExportCasebookJson}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Casebook JSON 백업 다운로드 📥
                </button>

                <input
                  type="file"
                  id="ws-input-import-casebook-json"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleImportFileInputChange}
                />
                <button
                  type="button"
                  id="ws-btn-import-casebook-json"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Casebook JSON 복원 📤
                </button>
              </div>
            </div>

            {/* Section A: User Saved Case Records */}
            <section
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  저장된 조사 케이스 ({savedCaseRecords.length}건)
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>브라우저 로컬 저장소 (Local Storage)</span>
              </div>

              <div id="ws-casebook-records-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {savedCaseRecords.length === 0 ? (
                  <div
                    id="ws-casebook-empty-state"
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      borderRadius: '8px',
                      color: '#64748B',
                      fontSize: '13px',
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    저장된 조사 케이스가 없습니다. 상단의 <strong>&apos;현재 사례 Casebook에 저장 💾&apos;</strong> 버튼을 눌러
                    현재 작성 중인 가설/체크리스트/메모를 보관하세요.
                  </div>
                ) : (
                  savedCaseRecords.map((rec) => {
                    const isCurrentLive = rec.runId === runId;
                    return (
                      <div
                        key={rec.id}
                        id={`casebook-item-${rec.id}`}
                        style={{
                          border: isCurrentLive ? '2px solid #0B9F78' : '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '14px',
                          background: isCurrentLive ? '#F0FDF4' : '#FFFFFF',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: isCurrentLive ? '#ECFDF5' : '#F1F5F9',
                                color: isCurrentLive ? '#065F46' : '#475569',
                                border: isCurrentLive ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                              }}
                            >
                              {isCurrentLive ? 'CURRENT LIVE ACTIVE' : 'HISTORICAL SNAPSHOT'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                              Run: {rec.runId} · Alert: {rec.alertId}
                            </span>
                          </div>

                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            저장 일시: {new Date(rec.savedAtUtc).toLocaleString('ko-KR')}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <span>로트: <strong>{rec.lotId}</strong></span>
                          <span>설비: <strong>{rec.equipmentId} / {rec.chamberId}</strong></span>
                          <span>모드: <strong>{rec.mode === 'B' ? 'Mode B' : 'Mode A'}</strong></span>
                          <span>가설: <strong>{rec.hypotheses?.length || 0}개</strong></span>
                          <span>조치 완료: <strong>{rec.actions?.filter((a) => a.completed).length || 0} / {rec.actions?.length || 0}</strong></span>
                        </div>

                        {rec.userNotes && (
                          <div style={{ fontSize: '11px', color: '#334155', background: '#F8FAFC', padding: '6px 10px', borderRadius: '4px' }}>
                            메모: {rec.userNotes.slice(0, 100)}{rec.userNotes.length > 100 ? '...' : ''}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                          <button
                            type="button"
                            id={`casebook-btn-load-${rec.id}`}
                            onClick={() => handleLoadCasebookRecord(rec)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#0B9F78',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            워크스페이스로 불러오기 ↩
                          </button>
                          <button
                            type="button"
                            id={`casebook-btn-delete-${rec.id}`}
                            onClick={() => handleDeleteCasebookRecord(rec.id)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#F1F5F9',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            삭제 🗑
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Section B: Server Process Runs from SQLite */}
            <section
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  서버 공정 Run 이력 (FastAPI SQLite process_run)
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  {serverRuns.length > 0 ? `${serverRuns.length}개 Run 검색됨` : '서버 미연결 (Mode A 오프라인)'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '14px' }}>
                ※ 이전 Run은 <strong>&apos;HISTORICAL SNAPSHOT (Read-Only)&apos;</strong>으로 제공되며, 현재 설비 실시간 제어나 양산 MES 기록이 아닌 synthetic 시뮬레이션 데이터입니다.
              </div>

              <div id="ws-casebook-server-runs-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {serverRuns.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                    서버 Run 목록이 없거나 API 서버에 연결되지 않았습니다.
                  </div>
                ) : (
                  serverRuns.map((r) => {
                    const isLive = r.is_active;
                    return (
                      <div
                        key={r.run_id}
                        id={`casebook-run-${r.run_id}`}
                        style={{
                          border: isLive ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          background: isLive ? '#EFF6FF' : '#FFFFFF',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isLive ? '#DBEAFE' : '#F1F5F9',
                              color: isLive ? '#1D4ED8' : '#64748B',
                            }}
                          >
                            {isLive ? 'LIVE ACTIVE' : 'HISTORICAL SNAPSHOT'}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                            {r.run_id}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            시드: {r.seed} · 로트: {r.lot_id} · 설비: {r.equipment_id}/{r.chamber_id}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {r.alert_id && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: r.alert_severity === 'CRITICAL' ? '#FEF2F2' : '#FFF7ED',
                                color: r.alert_severity === 'CRITICAL' ? '#DC2626' : '#EA580C',
                              }}
                            >
                              {r.alert_id} ({r.alert_severity || 'ALERT'})
                            </span>
                          )}

                          <button
                            type="button"
                            id={`casebook-btn-view-run-${r.run_id}`}
                            onClick={() => {
                              router.replace(
                                `/engineering-workspace?mode=B&run_id=${encodeURIComponent(r.run_id)}${
                                  r.alert_id ? `&alert=${encodeURIComponent(r.alert_id)}` : ''
                                }`
                              );
                              setActiveTab('INVESTIGATION');
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#FFFFFF',
                              color: '#2563EB',
                              border: '1px solid #BFDBFE',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            해당 Run 열기 ↗
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* Section 4: Cross-Screen Quick Navigation Links */}
        <section
          aria-labelledby="section-quick-nav"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '16px 20px',
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 id="section-quick-nav" style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              연계 화면 빠른 이동 (Cross-Screen Navigation)
            </h3>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Run: <strong>{runId}</strong> · Alert: <strong>{alertId}</strong> 맥락 유지
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <Link
              id="ws-nav-command-center"
              href={navLinks.commandCenter}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>FDC 커맨드 센터 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>공정 일탈 알람 큐 정렬 및 심각도 분류</div>
            </Link>

            <Link
              id="ws-nav-equipment-intelligence"
              href={navLinks.equipmentIntelligence}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>설비 인텔리전스 차트 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>OES, 압력, RF 전력 시계열 차트 및 T4/T5 결측 분절</div>
            </Link>

            <Link
              id="ws-nav-traceability"
              href={navLinks.waferTraceability}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>W-08 웨이퍼 추적성 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>FOUP 카세트 25매 중 W-08 잠재 영향 후보군 검토</div>
            </Link>

            <Link
              id="ws-nav-home-investigation"
              href={navLinks.homeInvestigation}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>식각 챔버 시뮬레이터 조사 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>FDC 모니터링 홈 화면 조사 패널 연계</div>
            </Link>
          </div>
        </section>

        {/* Section 5: Engineering Knowledge Links (EKL) */}
        <section
          aria-labelledby="section-ekl"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 id="section-ekl" style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              반도체 공학 용어 사전 (Engineering Knowledge Links)
            </h3>
            <span style={{ fontSize: '11px', color: '#64748B' }}>핵심 반도체 물리 개념 해설</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 원리" showBadge />
            <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 제어" showBadge />
            <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 및 결측치" showBadge />
            <EngineeringTermTrigger conceptId="wafer-exposure-status" label="노출 확정 vs 잠재 후보" showBadge />
          </div>
        </section>

        {/* Domain Disclaimers Footer */}
        <footer
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '14px 18px',
            fontSize: '11px',
            color: '#64748B',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
            도메인 안전 불변식 및 시뮬레이션 고지 사항 (Domain Invariants)
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li>
              <strong>통계적 일탈과 품질:</strong> {WORKSPACE_DOMAIN_DISCLAIMERS.excursionVsDefect}
            </li>
            <li>
              <strong>웨이퍼 노출 이력 정의 (CONFIRMED_EXPOSED / CANDIDATE_EXPOSED):</strong>{' '}
              {WORKSPACE_DOMAIN_DISCLAIMERS.exposureStatus}
            </li>
            <li>
              <strong>센서 결측치 처리:</strong> {WORKSPACE_DOMAIN_DISCLAIMERS.missingNotZero}
            </li>
            <li>
              <strong>가설 검토 성격:</strong> {WORKSPACE_DOMAIN_DISCLAIMERS.hypothesisDisclaimer}
            </li>
            <li>
              <strong>장비 제어 경계:</strong> {WORKSPACE_DOMAIN_DISCLAIMERS.actionDisclaimer}
            </li>
            <li>
              <strong>인메모리 상태 주의:</strong> {WORKSPACE_DOMAIN_DISCLAIMERS.memoryDisclaimer}
            </li>
          </ul>
        </footer>
      </main>
    </div>
  );
}

export default function EngineeringWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC' }}>
          <div style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>
            엔지니어링 워크스페이스 로딩 중...
          </div>
        </div>
      }
    >
      <EngineeringWorkspaceContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { FriendlyPageIntro } from '@/components/ux/FriendlyPageIntro';
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
  validateAndImportCasebookRecords,
  buildCrossNavUrl,
  FAB_ONE_CASEBOOK_STORAGE_KEY,
  isExactLineageMatch,
} from '@/components/engineering-workspace/engineering-workspace-contract';
import { TourReturnBanner, getModeAT7ExcursionValues } from '@/components/guided-demo';

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

  // Historical Record & Run Snapshot Viewers (Read-only isolation)
  const [historicalCaseRecord, setHistoricalCaseRecord] = useState<CasebookRecord | null>(null);
  const [historicalRunSnapshot, setHistoricalRunSnapshot] = useState<any | null>(null);
  const [isLoadingHistoricalRun, setIsLoadingHistoricalRun] = useState<boolean>(false);

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

    // Step 4: Snapshot Recheck (P0 Invariant: Verify server active run did not transition during inflight fetch)
    let summary2Res: Response;
    try {
      summary2Res = await fetch('http://localhost:8000/api/v1/demo/summary', { cache: 'no-store' });
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 503,
        title: '비동기 스냅샷 재확인 실패 (Snapshot Recheck Disrupted)',
        message: '조사 데이터 확정 전 활성 공정 상태 재확인 중 네트워크 연결이 끊어졌습니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    if (!summary2Res.ok) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: summary2Res.status,
        title: `활성 공정 재확인 실패 (HTTP ${summary2Res.status})`,
        message: '조사 확정 단계에서 서버 최신 요약 상태를 검증하지 못했습니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    let summary2Data: any;
    try {
      summary2Data = await summary2Res.json();
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 502,
        title: '스냅샷 재확인 응답 형식 오류 (HTTP 502)',
        message: '서버 최신 요약 데이터가 올바른 JSON 형식이 아닙니다 (Fail-closed).',
      });
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    const currentRunId2 = summary2Data?.active_run_id;
    const currentSessionId2 = summary2Data?.active_session_id;

    // Snapshot Coherence Invariants (P0):
    const isSnapshotCoherent =
      currentRunId === invData.run_id &&
      invData.run_id === currentRunId2 &&
      summaryData.active_session_id === currentSessionId2 &&
      summary2Data.lot_id === invData.lot_id &&
      summary2Data.equipment_id === invData.equipment_id &&
      summary2Data.chamber_id === invData.chamber_id;

    if (!isSnapshotCoherent) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 409,
        title: '활성 공정 상태 전이 충돌 (Concurrent Run Transition Conflict)',
        message: `조사 데이터 수신 중 서버의 활성 공정 Run이 변경되었거나 세션/장비/로트 계통성이 불일치합니다. (초기 Run: ${currentRunId}, 조사 Run: ${invData.run_id}, 최신 Run: ${currentRunId2}) 데이터 무결성을 위해 조회를 차단하고 최신 상태로 재동기화가 필요합니다.`,
      });
      setIsLoading(false);
      return;
    }

    if (
      !invData.lot_id ||
      !invData.alert_id ||
      !Array.isArray(invData.evidence_sensors) ||
      invData.evidence_sensors.length === 0 ||
      !Array.isArray(invData.candidate_exposed_wafers)
    ) {
      setEvidence([]);
      setIsSupportedAlert(false);
      setErrorState({
        status: 500,
        title: '조사 상세 데이터 규격 결함 (Malformed Investigation Detail)',
        message: '서버가 반환한 조사 상세 데이터에 필수 센서 증거 또는 웨이퍼 정보가 누락되었습니다 (Fail-closed).',
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
      // In Mode A or fallback, map ONLY physical sensors dynamically from seed via getModeAT7ExcursionValues
      const modeAVals = getModeAT7ExcursionValues(seed);
      physicalSensorList.push(
        {
          sensorId: 'RELATIVE_SIGNAL',
          sensorName: '광학 발광 상대 신호 (OES Relative Signal)',
          observedValue: modeAVals.oesSignal,
          unit: 'a.u.',
          qualityFlag: 'SUSPECT',
          uclThreshold: modeAVals.uclLimit,
          targetValue: modeAVals.baselineOes,
          deviationPercent: +(((modeAVals.oesSignal - modeAVals.baselineOes) / modeAVals.baselineOes) * 100).toFixed(1),
          details: `Step T7 관리한계(UCL ${modeAVals.uclLimit}) 초과 계측`,
        },
        {
          sensorId: 'CHAMBER_PRESSURE',
          sensorName: '챔버 공정 진공 압력 (Capacitance Manometer)',
          observedValue: modeAVals.chamberPressure,
          unit: 'mTorr',
          qualityFlag: 'SUSPECT',
          uclThreshold: 140.0,
          targetValue: modeAVals.baselinePressure,
          deviationPercent: +(((modeAVals.chamberPressure - modeAVals.baselinePressure) / modeAVals.baselinePressure) * 100).toFixed(1),
          details: 'Step T7 진공 압력 일탈',
        },
        {
          sensorId: 'RF_POWER',
          sensorName: 'RF 플라즈마 전원 출력 (RF Generator Forward Power)',
          observedValue: modeAVals.rfPower,
          unit: 'W',
          qualityFlag: 'SUSPECT',
          uclThreshold: 1650.0,
          targetValue: modeAVals.baselineRf,
          deviationPercent: +(((modeAVals.rfPower - modeAVals.baselineRf) / modeAVals.baselineRf) * 100).toFixed(1),
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
      schemaVersion: 1,
      runId,
      sessionId,
      alertId,
      seed,
      mode,
      dataOrigin: mode === 'B' ? 'live_api' : 'synthetic',
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

    const saveRes = saveCasebookRecordToStorage(record);
    if (saveRes.success) {
      setSavedCaseRecords(loadSavedCasebookRecords());
      setCasebookNotice(`현재 사건(${runId} / ${alertId})이 Casebook에 성공적으로 저장되었습니다.`);
    } else {
      setCasebookNotice(`저장 실패 (${saveRes.error}): ${saveRes.message}`);
    }
  }, [isExportable, runId, sessionId, alertId, seed, mode, equipmentId, chamberId, lotId, hypotheses, actions, notes]);

  // Load a saved Casebook record into Workspace with Cross-Run / Cross-Alert Isolation (P0)
  const handleLoadCasebookRecord = useCallback(
    (record: CasebookRecord) => {
      const isExactMatch = isExactLineageMatch(record, {
        mode,
        runId,
        alertId,
        sessionId,
        lotId,
        equipmentId,
        chamberId,
        dataOrigin: mode === 'B' ? 'live_api' : 'synthetic',
      });

      if (isExactMatch) {
        // Safe to load into active editor (same exact investigation lineage)
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
        setCasebookNotice(`동일 활성 조사 (${record.runId} / ${record.alertId})의 케이스북 기록을 에디터에 동기화했습니다.`);
      } else {
        // Cross-Run / Cross-Alert Read-Only Isolation: Open historical case detail modal
        setHistoricalCaseRecord(record);
        const reason = record.runId !== runId
          ? `공정 Run 불일치 (${record.runId} ≠ ${runId})`
          : record.alertId !== alertId
          ? `FDC 알람 불일치 (${record.alertId} ≠ ${alertId})`
          : `조사 세션 계통성 불일치`;
        setCasebookNotice(
          `[조사 맥락 격리 보호 - ${reason}]: 저장 기록을 읽기 전용으로 열었습니다. 활성 Run (${runId}) 편집기는 100% 보존됩니다.`
        );
      }
    },
    [runId, mode, alertId, sessionId, lotId, equipmentId, chamberId]
  );

  // View Server Process Run from SQLite (Historical Read-Only Snapshot vs Active Live Run)
  const handleViewServerRun = useCallback(
    async (r: any) => {
      if (r.is_active && r.run_id === runId) {
        setActiveTab('INVESTIGATION');
        return;
      }

      setIsLoadingHistoricalRun(true);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/demo/runs/${encodeURIComponent(r.run_id)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const snap = await res.json();
          setHistoricalRunSnapshot(snap);
          setCasebookNotice(`과거 공정 Run (${r.run_id}) 아카이브 스냅샷을 열었습니다.`);
        } else {
          setCasebookNotice(`과거 공정 Run (${r.run_id}) 조회 실패 (HTTP ${res.status})`);
        }
      } catch {
        setCasebookNotice(`과거 공정 Run (${r.run_id}) 조회 중 네트워크 연결에 실패했습니다.`);
      } finally {
        setIsLoadingHistoricalRun(false);
      }
    },
    [runId]
  );

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

  // Import Casebook backup from JSON with schema validation
  const handleImportFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawContent = event.target?.result as string;
      const result = validateAndImportCasebookRecords(rawContent);
      if (result.success) {
        setSavedCaseRecords(result.records);
        setCasebookNotice(result.message);
      } else {
        setCasebookNotice(`가져오기 실패 (${result.error}): ${result.message}`);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
              · 조사 내용을 정리하는 공간
            </span>
          </div>
        </div>

        {/* Unified 6-Tab Navigation Bar */}
        <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="화면 탭">
          <Link href={buildCrossNavUrl('/', { mode, seed, runId, alertId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            홈
          </Link>
          <Link href={buildCrossNavUrl('/traceability', { mode, seed, runId, alertId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            웨이퍼 확인
          </Link>
          <Link href={buildCrossNavUrl('/command-center', { mode, seed, runId, alertId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            알람 확인
          </Link>
          <Link href={buildCrossNavUrl('/equipment-intelligence', { mode, seed, runId, alertId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            설비 살펴보기
          </Link>
          <Link href={buildCrossNavUrl('/fab-simulation', { mode, seed, runId, alertId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            공정 체험
          </Link>
          <Link href={buildCrossNavUrl('/engineering-workspace', { mode, seed, runId, alertId })} className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            조사 노트
          </Link>
          <Link
            href={buildCrossNavUrl('/demo-tour', { mode: 'A', seed, tourStep: queryTourStep || undefined })}
            className="nav-tab-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            처음 둘러보기
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
        <FriendlyPageIntro
  eyebrow="조사 노트"
  title="이상 신호의 원인을 차근차근 살펴봐요"
  description="먼저 센서 근거를 확인하고, 원인 가설과 다음 조치를 정리해 보세요. 이 화면의 판단은 연습용이며 실제 설비를 제어하지 않아요."
  primaryLabel={isSupportedAlert ? '이번 조사 살펴보기' : undefined}
  primaryHref={isSupportedAlert ? '#ws-investigation-board' : undefined}
  detail={<p>현재 Run: {runId} · 알람: {alertId}. 다른 Run/알람의 기록은 섞지 않아요. 이전 조사는 읽기 전용으로 열리고, 현재 조사는 지원되는 알람에서만 저장할 수 있어요.</p>}
/>
<ol className="ux-journey-steps" aria-label="조사 진행 순서">
  <li>1. 근거 확인</li><li>2. 가설 검토</li><li>3. 다음 조치</li><li>4. 저장·내려받기</li><li>5. 이전 조사 보기</li>
</ol>

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
              이번 조사 살펴보기
            </button>
            <button
              type="button"
              role="tab"
              id="ws-tab-casebook"
              aria-selected={activeTab === 'CASEBOOK'}
              onClick={() => {
                setActiveTab('CASEBOOK');
                setSavedCaseRecords(loadSavedCasebookRecords());
              }}
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
              이전 조사 보기
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
              title="현재 조사 중인 가설 판정, 조치 체크, 엔지니어링 메모를 조사 저장하기합니다"
            >
              이번 조사 저장하기
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
                  <span style={{ fontWeight: 800 }}>📌 증거부터 다음 조치까지 정리해 봐요:</span>
                  <span>
                    살펴보는 순서: 가상 공정에서 신호를 찾고, 근거와 가설을 정리한 뒤 설비 인텔리전스 →
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
                      placeholder="조사 검토 의견, 잠재 리스크, 후속 액션 아이템을 메모하세요... '조사 저장하기' 버튼으로 보관할 수 있습니다."
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
                  이전 조사 보기
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
                  조사 기록 백업 내려받기
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
                  백업한 조사 기록 가져오기
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
                    아직 저장한 조사가 없어요. 상단의 <strong>&apos;현재 사례 조사 저장하기 💾&apos;</strong> 버튼을 눌러
                    현재 작성 중인 가설/체크리스트/메모를 보관하세요.
                  </div>
                ) : (
                  savedCaseRecords.map((rec) => {
                    const isCurrentLive = isExactLineageMatch(rec, {
                      mode,
                      runId,
                      alertId,
                      sessionId,
                      lotId,
                      equipmentId,
                      chamberId,
                      dataOrigin: mode === 'B' ? 'live_api' : 'synthetic',
                    });
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

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                          <button
                            type="button"
                            id={`casebook-btn-load-${rec.id}`}
                            onClick={() => handleLoadCasebookRecord(rec)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: isCurrentLive ? "#0B9F78" : "#475569",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            {isCurrentLive ? "동일 Run 에디터로 불러오기 ↩" : "상세 열람 (Read-Only) 👁"}
                          </button>
                          <button
                            type="button"
                            id={`casebook-btn-delete-${rec.id}`}
                            onClick={() => handleDeleteCasebookRecord(rec.id)}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#F1F5F9",
                              color: "#DC2626",
                              border: "1px solid #FECACA",
                              borderRadius: "4px",
                              cursor: "pointer",
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
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "18px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  서버 공정 Run 이력 (FastAPI SQLite process_run)
                </h3>
                <span style={{ fontSize: "11px", color: "#64748B" }}>
                  {serverRuns.length > 0 ? `${serverRuns.length}개 Run 검색됨` : "서버 미연결 (Mode A 오프라인)"}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748B", marginBottom: "14px" }}>
                ※ 이전 시뮬레이션은 <strong>&apos;이전 조사 · 읽기 전용&apos;</strong>으로 제공되며, 현재 설비 실시간 제어나 양산 MES 기록이 아닌 synthetic 시뮬레이션 데이터입니다.
              </div>

              <div id="ws-casebook-server-runs-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {serverRuns.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
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
                          border: isLive ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                          borderRadius: "6px",
                          padding: "10px 14px",
                          background: isLive ? "#EFF6FF" : "#FFFFFF",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isLive ? "#DBEAFE" : "#F1F5F9",
                              color: isLive ? "#1D4ED8" : "#64748B",
                            }}
                          >
                            {isLive ? "LIVE ACTIVE" : "HISTORICAL SNAPSHOT"}
                          </span>
                          <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>
                            {r.run_id}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>
                            시드: {r.seed} · 로트: {r.lot_id} · 설비: {r.equipment_id}/{r.chamber_id}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {r.alert_id && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: r.alert_severity === "CRITICAL" ? "#FEF2F2" : "#FFF7ED",
                                color: r.alert_severity === "CRITICAL" ? "#DC2626" : "#EA580C",
                              }}
                            >
                              {r.alert_id} ({r.alert_severity || "ALERT"})
                            </span>
                          )}

                          <button
                            type="button"
                            id={`casebook-btn-view-run-${r.run_id}`}
                            onClick={() => handleViewServerRun(r)}
                            disabled={isLoadingHistoricalRun}
                            style={{
                              padding: "4px 10px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#FFFFFF",
                              color: isLive ? "#059669" : "#2563EB",
                              border: isLive ? "1px solid #A7F3D0" : "1px solid #BFDBFE",
                              borderRadius: "4px",
                              cursor: isLoadingHistoricalRun ? "wait" : "pointer",
                            }}
                          >
                            {isLive ? "활성 조사로 이동 ↗" : "스냅샷 열람 (Read-Only) 👁"}
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

        {/* Modal 1: Historical Casebook Record Modal (Read-Only Cross-Run Isolation) */}
        {historicalCaseRecord && (
          <div
            id="ws-historical-case-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historical-case-title"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "780px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                border: "1px solid #CBD5E1",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#F8FAFC",
                  borderTopLeftRadius: "12px",
                  borderTopRightRadius: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "#F1F5F9",
                        color: "#475569",
                        border: "1px solid #CBD5E1",
                      }}
                    >
                      HISTORICAL CASEBOOK RECORD · READ-ONLY
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      Schema v{historicalCaseRecord.schemaVersion || 1}
                    </span>
                  </div>
                  <h3 id="historical-case-title" style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: "4px 0 0 0" }}>
                    과거 조사 사례 열람 (Run: {historicalCaseRecord.runId})
                  </h3>
                </div>
                <button
                  type="button"
                  id="ws-btn-close-historical-case"
                  onClick={() => setHistoricalCaseRecord(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    lineHeight: 1,
                    color: "#64748B",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {/* Isolation Notice Banner */}
              <div
                style={{
                  margin: "16px 20px 0 20px",
                  padding: "10px 14px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#991B1B",
                  lineHeight: 1.5,
                }}
              >
                🔒 <strong>데이터 격리 안전 보호:</strong> 본 기록은 과거 조사 컨텍스트 (
                Run: <strong>{historicalCaseRecord.runId}</strong>, Alert: <strong>{historicalCaseRecord.alertId}</strong>, Session: <strong>{historicalCaseRecord.sessionId || '미지정'}</strong>, Origin: <strong>{historicalCaseRecord.dataOrigin || '미지정'}</strong>) 저장본입니다. 현재 활성 조사 (
                Run: <strong>{runId}</strong>, Alert: <strong>{alertId}</strong>, Session: <strong>{sessionId}</strong>)와 8개 계통 속성이 100% 일치하지 않으므로 활성 워크스페이스 편집기를 덮어쓰지 않고 독립된 읽기 전용 모달로 안전하게 열람 중입니다. (출처 고지: {historicalCaseRecord.dataOrigin === 'live_api' ? 'FastAPI 합성 연동 경로 (합성 데이터)' : '합성 시뮬레이션 카탈로그'} · 실제 생산 FAB MES 제어가 아님)
              </div>

              {/* Modal Body */}
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Meta Attributes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                    background: "#F8FAFC",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748B" }}>Run ID:</span> <strong>{historicalCaseRecord.runId}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Alert ID:</span> <strong>{historicalCaseRecord.alertId}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Session ID:</span> <strong>{historicalCaseRecord.sessionId || '미지정 (과거 레코드)'}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>데이터 출처:</span> <strong>{historicalCaseRecord.dataOrigin === 'live_api' ? 'FastAPI 합성 연동 (Live API)' : '합성 카탈로그 (Synthetic)'}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Mode:</span> <strong>{historicalCaseRecord.mode === "B" ? "Mode B (Connected)" : "Mode A (Guided)"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Lot / 설비:</span> <strong>{historicalCaseRecord.lotId} / {historicalCaseRecord.equipmentId} ({historicalCaseRecord.chamberId})</strong>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "#64748B" }}>저장 일시:</span> <strong>{new Date(historicalCaseRecord.savedAtUtc).toLocaleString("ko-KR")} (UTC: {historicalCaseRecord.savedAtUtc})</strong>
                  </div>
                </div>

                {/* Physical Sensor Snapshot */}
                {historicalCaseRecord.physicalSensorSnapshot && (
                  <div>
                    <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                      저장 당시 물리 센서 계측치 스냅샷
                    </h4>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {Object.entries(historicalCaseRecord.physicalSensorSnapshot).map(([key, val]) => (
                        <div
                          key={key}
                          style={{
                            background: "#F1F5F9",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        >
                          <div style={{ color: "#64748B", fontWeight: 600 }}>{key}</div>
                          <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                            {String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hypotheses */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                    가설 검증 기록 ({historicalCaseRecord.hypotheses?.length || 0}건)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {historicalCaseRecord.hypotheses?.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          background: "#FFFFFF",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 800, color: "#0F172A" }}>
                            [{h.id}] {h.title}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "10px",
                              background: "#EFF6FF",
                              color: "#1D4ED8",
                            }}
                          >
                            {h.statusLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                          {h.engineeringRationale}
                        </div>
                        <div style={{ fontSize: "10px", color: "#059669", marginTop: "4px" }}>
                          연결 증거: {h.linkedEvidenceIds?.join(", ") || "없음"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                    조치 점검표 ({historicalCaseRecord.actions?.filter((a) => a.completed).length || 0} / {historicalCaseRecord.actions?.length || 0} 완료)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {historicalCaseRecord.actions?.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          background: a.completed ? "#F0FDF4" : "#FFFFFF",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{a.completed ? "☑" : "☐"}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, color: a.completed ? "#166534" : "#1E293B" }}>
                            {a.title}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748B", marginLeft: "6px" }}>
                            ({a.assigneeRole} · {a.targetSystem})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                    엔지니어링 메모
                  </h4>
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "#334155",
                      whiteSpace: "pre-wrap",
                      minHeight: "40px",
                    }}
                  >
                    {historicalCaseRecord.userNotes || "(작성된 메모 없음)"}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderBottomLeftRadius: "12px",
                  borderBottomRightRadius: "12px",
                }}
              >
                <button
                  type="button"
                  id="ws-btn-return-active-workspace"
                  onClick={() => {
                    setHistoricalCaseRecord(null);
                    setActiveTab("INVESTIGATION");
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 800,
                    background: "#0B9F78",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  현재 활성 Run ({runId}) 조사로 복귀 ↩
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Historical Server Run Snapshot Panel */}
        {historicalRunSnapshot && (
          <div
            id="ws-historical-run-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historical-run-title"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "800px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                border: "1px solid #CBD5E1",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#F8FAFC",
                  borderTopLeftRadius: "12px",
                  borderTopRightRadius: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "10px",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        border: "1px solid #BFDBFE",
                      }}
                    >
                      HISTORICAL SERVER RUN SNAPSHOT (READ-ONLY)
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      FastAPI SQLite Archive
                    </span>
                  </div>
                  <h3 id="historical-run-title" style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", margin: "4px 0 0 0" }}>
                    과거 공정 Run 아카이브 스냅샷: {historicalRunSnapshot.run_id}
                  </h3>
                </div>
                <button
                  type="button"
                  id="ws-btn-close-historical-run"
                  onClick={() => setHistoricalRunSnapshot(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    lineHeight: 1,
                    color: "#64748B",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>

              {/* Invariant Disclaimer */}
              <div
                style={{
                  margin: "16px 20px 0 20px",
                  padding: "10px 14px",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#166534",
                  lineHeight: 1.5,
                }}
              >
                💡 <strong>과거 Run 진실 계약(Truth Contract):</strong> 본 스냅샷은 과거 완료된 공정 Run의 읽기 전용 계측 기록입니다. 활성 공정 일탈 Run(<strong>{runId}</strong>)과 격리되어 안전하게 조회되며, 현재 설비 실시간 제어나 양산 MES 기록이 아닌 synthetic 시뮬레이션 데이터입니다.
              </div>

              {/* Body */}
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Run Metadata Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                    background: "#F8FAFC",
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748B" }}>Run ID:</span> <strong>{historicalRunSnapshot.run_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>상태:</span> <strong>{historicalRunSnapshot.status}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Seed:</span> <strong>{historicalRunSnapshot.seed}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Session ID:</span> <strong>{historicalRunSnapshot.session_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Lot ID:</span> <strong>{historicalRunSnapshot.lot_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Equipment / Chamber:</span> <strong>{historicalRunSnapshot.equipment_id} / {historicalRunSnapshot.chamber_id}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>생성 일시:</span> <strong>{historicalRunSnapshot.created_at ? new Date(historicalRunSnapshot.created_at).toLocaleString("ko-KR") : "-"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>완료 일시:</span> <strong>{historicalRunSnapshot.completed_at ? new Date(historicalRunSnapshot.completed_at).toLocaleString("ko-KR") : "-"}</strong>
                  </div>
                </div>

                {/* Alert Info */}
                {historicalRunSnapshot.alert && (
                  <div
                    style={{
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#991B1B" }}>
                        FDC 경보: {historicalRunSnapshot.alert.alert_id} ({historicalRunSnapshot.alert.severity})
                      </span>
                      <span style={{ fontSize: "11px", color: "#B91C1C" }}>
                        {historicalRunSnapshot.alert.step_id} ({historicalRunSnapshot.alert.step_name})
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#7F1D1D", marginTop: "4px" }}>
                      {historicalRunSnapshot.alert.message}
                    </div>
                  </div>
                )}

                {/* Evidence Sensors Table */}
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                    물리 센서 계측치 스냅샷 (Evidence Sensors)
                  </h4>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#F1F5F9", textAlign: "left", color: "#475569" }}>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>센서명</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>관측값</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>단위</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>SPC 관리한계 (UCL)</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>일탈 여부</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #CBD5E1" }}>품질 플래그</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalRunSnapshot.evidence_sensors?.map((s: any) => (
                          <tr key={s.sensor_name} style={{ borderBottom: "1px solid #E2E8F0" }}>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#0F172A" }}>{s.sensor_name}</td>
                            <td style={{ padding: "8px", fontWeight: 700, color: s.is_excursion ? "#DC2626" : "#0B9F78" }}>
                              {s.observed_value !== null ? s.observed_value : "미제공 (N/A)"}
                            </td>
                            <td style={{ padding: "8px", color: "#64748B" }}>{s.unit}</td>
                            <td style={{ padding: "8px", color: "#64748B" }}>{s.ucl !== null ? s.ucl : "-"}</td>
                            <td style={{ padding: "8px" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: s.is_excursion ? "#FEF2F2" : "#ECFDF5",
                                  color: s.is_excursion ? "#DC2626" : "#059669",
                                }}
                              >
                                {s.is_excursion ? "EXCURSION" : "NORMAL"}
                              </span>
                            </td>
                            <td style={{ padding: "8px" }}>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: s.quality_flag === "CRITICAL" ? "#FEF2F2" : s.quality_flag === "SUSPECT" ? "#FFF7ED" : "#F1F5F9",
                                  color: s.quality_flag === "CRITICAL" ? "#DC2626" : s.quality_flag === "SUSPECT" ? "#EA580C" : "#475569",
                                }}
                              >
                                {s.quality_flag}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Wafer Summary */}
                <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", fontSize: "12px" }}>
                  <span style={{ fontWeight: 800, color: "#0F172A" }}>웨이퍼 분포 현황:</span> 총 {historicalRunSnapshot.wafer_count || 25}매 중 노출 확정(CONFIRMED_EXPOSED) {historicalRunSnapshot.exposed_wafers?.length || 0}매
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                    ※ Excursion ≠ Defect: 설비 센서 일탈 노출이 웨이퍼의 물리적 결함을 단정하지 않으며, 추가 계측 대상 후보군으로 분류됩니다.
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderBottomLeftRadius: "12px",
                  borderBottomRightRadius: "12px",
                }}
              >
                <button
                  type="button"
                  id="ws-btn-return-active-run"
                  onClick={() => {
                    setHistoricalRunSnapshot(null);
                    setActiveTab("INVESTIGATION");
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 800,
                    background: "#0B9F78",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  현재 활성 Run ({runId}) 조사로 복귀 ↩
                </button>
              </div>
            </div>
          </div>
        )}
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

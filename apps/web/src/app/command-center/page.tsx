'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';
import {
  FdcAlert,
  DemoSummary,
  ErrorState,
  generateModeACommandCenterAlarms,
  isInvestigationSupported,
  applyFilterAndSort,
} from '@/components/command-center/command-center-contract';
import { TourReturnBanner } from '@/components/guided-demo';

function CommandCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryAlert = searchParams.get('alert');
  const querySeed = searchParams.get('seed');
  const queryTourStep = searchParams.get('tourStep');
  const queryMode = searchParams.get('mode');
  const queryRunId = searchParams.get('run_id');

  const isExplicitModeB = queryMode === 'B' || !!queryRunId;

  const initialSeed = useMemo(() => {
    if (querySeed) {
      const num = Number(querySeed);
      if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
        return num;
      }
    }
    return 20261015;
  }, [querySeed]);

  const [mode, setMode] = useState<'A' | 'B'>(isExplicitModeB ? 'B' : 'A');
  const [seed, setSeed] = useState<number>(initialSeed);
  const [activeRunId, setActiveRunId] = useState<string | null>(() =>
    queryRunId || (isExplicitModeB ? null : `RUN-DEMO-${String(initialSeed % 1000).padStart(3, '0')}`)
  );
  const [alarms, setAlarms] = useState<FdcAlert[]>(() =>
    isExplicitModeB ? [] : generateModeACommandCenterAlarms(initialSeed)
  );
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(() => {
    if (isExplicitModeB) return queryAlert || null;
    const initialAlarms = generateModeACommandCenterAlarms(initialSeed);
    return queryAlert || (initialAlarms.length > 0 ? initialAlarms[0].alert_id : null);
  });

  // Filter & Sort States
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED'>('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  const [isLoading, setIsLoading] = useState<boolean>(isExplicitModeB);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [notice, setNotice] = useState<string>('FDC 알람 커맨드 센터 준비 완료');

  // Request ID Guard for race conditions
  const activeReqIdRef = useRef<number>(0);

  // Unified data loader: Summary-first run discovery & explicit alerts query (P1-A compliant)
  // NOTE: loadAlarms is strictly decoupled from UI selection/filter state to eliminate cyclic dependencies!
  const loadAlarms = useCallback(async () => {
    const reqId = ++activeReqIdRef.current;
    setIsLoading(true);
    setErrorState(null);

    // Mode A branch: When not explicitly Mode B
    if (!isExplicitModeB) {
      setMode('A');
      const fixtureAlarms = generateModeACommandCenterAlarms(seed);
      setAlarms(fixtureAlarms);
      const synRunId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
      setActiveRunId(synRunId);
      setSelectedAlertId((prev) => {
        if (prev && fixtureAlarms.some((a) => a.alert_id === prev)) return prev;
        if (queryAlert && fixtureAlarms.some((a) => a.alert_id === queryAlert)) return queryAlert;
        return fixtureAlarms[0]?.alert_id ?? null;
      });
      setIsLoading(false);
      setNotice(`Mode A: 로컬 합성 픽스처 알람 큐(${fixtureAlarms.length}건) 표시.`);
      return;
    }

    // Step 1: Query summary first to discover active_run_id
    let summaryRes: Response;
    try {
      summaryRes = await fetch('http://localhost:8000/api/v1/demo/summary', { cache: 'no-store' });
    } catch {
      // Genuine network disconnect to API server fails closed in Mode B
      if (reqId !== activeReqIdRef.current) return;
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 503,
        title: 'Mode B API 서버 연결 실패 (HTTP 503 / Backend Disconnected)',
        message: 'FastAPI 서버(http://localhost:8000)와 통신할 수 없습니다. 요청된 모드가 Mode B이므로 합성 데이터로 자동 대체하지 않고 조회를 차단합니다 (Fail-closed).'
      });
      setMode('B');
      setNotice('서버 연결 실패: Mode B 백엔드에 연결할 수 없습니다.');
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    if (!summaryRes.ok) {
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: summaryRes.status,
        title: `서버 요약 조회 실패 (HTTP ${summaryRes.status})`,
        message: 'API 서버 요약 정보를 가져오지 못해 데이터 출처 무결성을 위해 알람 조회를 차단했습니다.'
      });
      setMode('B');
      setNotice(`서버 오류 (HTTP ${summaryRes.status}): 공정 요약 정보 조회 실패.`);
      setIsLoading(false);
      return;
    }

    let summaryData: any;
    try {
      summaryData = await summaryRes.json();
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 502,
        title: '서버 응답 형식 오류 (HTTP 502 / Malformed JSON)',
        message: '서버가 반환한 요약 데이터 형식이 올바른 JSON이 아닙니다.'
      });
      setMode('B');
      setNotice('서버 응답 형식 오류: 요약 JSON 파싱에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    const currentRunId = summaryData?.active_run_id;
    if (!currentRunId || typeof currentRunId !== 'string') {
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 500,
        title: '서버 활성 Run 부재 오류 (Data Integrity Error)',
        message: '서버에 현재 활성화된 공정 Run ID가 존재하지 않아 알람 조회를 차단했습니다.'
      });
      setMode('B');
      setNotice('서버 데이터 오류: 유효한 활성 공정 Run ID가 없습니다.');
      setIsLoading(false);
      return;
    }

    // Step 2: Query alerts explicitly filtered by that exact currentRunId
    let alertsRes: Response;
    try {
      alertsRes = await fetch(
        `http://localhost:8000/api/v1/demo/alerts?run_id=${encodeURIComponent(currentRunId)}`,
        { cache: 'no-store' }
      );
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 500,
        title: '서버 통신 실패 (Network Disrupted)',
        message: '알람 큐 목록 조회 중 네트워크 연결이 끊어졌습니다.'
      });
      setMode('B');
      setNotice('네트워크 오류: 알람 목록 수신에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    if (!alertsRes.ok) {
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: alertsRes.status,
        title: `알람 목록 조회 실패 (HTTP ${alertsRes.status})`,
        message: `서버가 알람 목록 요청에 대해 HTTP ${alertsRes.status} 상태를 반환했습니다.`
      });
      setMode('B');
      setNotice(`서버 오류 (HTTP ${alertsRes.status}): 알람 목록을 불러오지 못했습니다.`);
      setIsLoading(false);
      return;
    }

    let alertsData: FdcAlert[];
    try {
      alertsData = await alertsRes.json();
    } catch {
      if (reqId !== activeReqIdRef.current) return;
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 502,
        title: '서버 응답 형식 오류 (HTTP 502 / Malformed JSON)',
        message: '서버가 반환한 알람 목록 형식이 올바른 JSON이 아닙니다.'
      });
      setMode('B');
      setNotice('서버 응답 형식 오류: 알람 목록 JSON 파싱에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    if (reqId !== activeReqIdRef.current) return;

    // Lineage check: verify no mismatched run_id in the returned alerts
    const hasConflictingRun = alertsData.some(
      (a) => a.run_id && a.run_id !== currentRunId
    );
    if (hasConflictingRun) {
      setAlarms([]);
      setSelectedAlertId(null);
      setErrorState({
        status: 500,
        title: '데이터 계통성 불일치 오류 (Data Lineage Error)',
        message: `알람 목록에 활성 Run (${currentRunId})과 다른 공정 Run의 알람이 혼합되어 있어 조회를 차단했습니다.`
      });
      setMode('B');
      setNotice('데이터 계약 오류: 다른 공정 Run 알람과의 혼합이 감지되어 조회를 차단했습니다.');
      setIsLoading(false);
      return;
    }

    // Atomic state commit
    setAlarms(alertsData);
    setActiveRunId(currentRunId);
    setMode('B');
    setErrorState(null);
    setSelectedAlertId((prev) => {
      if (prev && alertsData.some((a) => a.alert_id === prev)) return prev;
      if (queryAlert && alertsData.some((a) => a.alert_id === queryAlert)) return queryAlert;
      return alertsData[0]?.alert_id ?? null;
    });
    setNotice(`Mode B (Live API): 활성 공정 Run (${currentRunId}) FDC 알람 큐(${alertsData.length}건) 동기화 완료.`);
    setIsLoading(false);
  }, [seed, isExplicitModeB, queryAlert, queryMode, queryRunId]);

  // Initial data load (runs once on mount or seed change only)
  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  // Synchronize seed when query param changes
  useEffect(() => {
    if (querySeed) {
      const num = Number(querySeed);
      if (!isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000) {
        setSeed(num);
      }
    }
  }, [querySeed]);

  // Filtered and Sorted Alarms (pure derivation)
  const filteredAndSortedAlarms = useMemo(() => {
    return applyFilterAndSort(alarms, severityFilter, statusFilter, equipmentFilter, sortOrder);
  }, [alarms, severityFilter, statusFilter, equipmentFilter, sortOrder]);

  // Synchronize selectedAlert with filtered list
  const selectedAlert = useMemo(() => {
    if (!selectedAlertId) return null;
    return filteredAndSortedAlarms.find((a) => a.alert_id === selectedAlertId) || null;
  }, [filteredAndSortedAlarms, selectedAlertId]);

  // [P1-A Fix]: Coherent filter, selection, and URL synchronization without cyclic re-fetching
  useEffect(() => {
    if (filteredAndSortedAlarms.length === 0) {
      setSelectedAlertId(null);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('alert')) {
          url.searchParams.delete('alert');
          window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
        }
      }
    } else if (!selectedAlertId || !filteredAndSortedAlarms.some((a) => a.alert_id === selectedAlertId)) {
      const nextId = filteredAndSortedAlarms[0].alert_id;
      setSelectedAlertId(nextId);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('alert', nextId);
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
  }, [filteredAndSortedAlarms, selectedAlertId]);

  // Counts for KPI and filter badges
  const totalCount = alarms.length;
  const criticalCount = alarms.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alarms.filter((a) => a.severity === 'WARNING').length;
  const infoCount = alarms.filter((a) => a.severity === 'INFO').length;

  // Equipment options extracted dynamically
  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    alarms.forEach((a) => set.add(`${a.equipment_id} / ${a.chamber_id}`));
    return Array.from(set);
  }, [alarms]);

  // [P1-A Fix]: User direct selection updates state and synchronizes URL simultaneously
  const handleSelectAlert = (aId: string) => {
    setSelectedAlertId(aId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('alert', aId);
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  };

  // [P1-C Fix]: Rigorous investigation telemetry eligibility evaluation
  const selectedInvCheck = useMemo(() => {
    return isInvestigationSupported(selectedAlert, activeRunId);
  }, [selectedAlert, activeRunId]);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="logo-badge" aria-hidden="true">F1</div>
          <div>
            <span className="brand-title">FAB ONE</span>
            <span className="brand-subtitle">· FDC Alarm Command Center</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px' }} aria-label="화면 탭">
          <Link href={`/${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            홈 (FDC 모니터링)
          </Link>
          <Link href={`/traceability${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            웨이퍼 이력 추적성 (Traceability)
          </Link>
          <Link href={`/command-center${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            FDC 커맨드 센터 (Command Center)
          </Link>
          <Link href={`/equipment-intelligence${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            설비 인텔리전스 (Equipment)
          </Link>
          <Link href={`/fab-simulation${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            FAB 시뮬레이션 (Simulation)
          </Link>
          <Link href={`/engineering-workspace${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            엔지니어링 워크스페이스 (Workspace)
          </Link>
          <Link href={`/demo-tour${mode === 'A' ? `?seed=${seed}${queryTourStep ? `&step=${queryTourStep}` : ''}` : (queryTourStep ? `?step=${queryTourStep}` : '')}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            가이드 투어 (Demo Tour)
          </Link>
        </nav>

        <div className="top-status-pills">
          <span
            id={mode === 'B' ? 'cc-mode-b-badge' : 'cc-mode-a-badge'}
            className="pill"
            style={{ background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
          >
            {mode === 'A' ? 'Mode A (합성 픽스처)' : 'Mode B (FastAPI 연동)'}
          </span>
          <span
            id="cc-run-id-badge"
            className="pill"
            style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
          >
            Run: {activeRunId || '미가동'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* BUILD-10 Tour Return Banner */}
        <TourReturnBanner tourStep={queryTourStep} seed={seed} />

        {/* Notice Banner */}
        <div className="notice-banner" role="status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📡</span>
            <span style={{ fontWeight: 600 }}>{notice}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => loadAlarms()}
              disabled={isLoading}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              {isLoading ? '동기화 중...' : '새로고침 (Refresh)'}
            </button>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Seed: <strong>{seed}</strong>
            </span>
          </div>
        </div>

        {/* Global Statistics Bar (KPI Badges) */}
        <div className="cc-kpi-bar">
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">FDC 관제 대상</span>
            <span className="cc-kpi-val">ETCH 설비군</span>
          </div>
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">전체 수집 알람</span>
            <span className="cc-kpi-val">{totalCount}건</span>
          </div>
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">CRITICAL (치명)</span>
            <span className="cc-kpi-val" style={{ color: '#DC2626' }}>{criticalCount}건</span>
          </div>
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">WARNING (경고)</span>
            <span className="cc-kpi-val" style={{ color: '#D97706' }}>{warningCount}건</span>
          </div>
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">INFO (정보)</span>
            <span className="cc-kpi-val" style={{ color: '#2563EB' }}>{infoCount}건</span>
          </div>
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">현재 필터 일치</span>
            <span className="cc-kpi-val" style={{ color: '#17263B' }}>{filteredAndSortedAlarms.length}건</span>
          </div>
        </div>

        {/* 2-Column Command Center Layout */}
        <div className="cc-layout-grid">
          {/* Left Column: FDC Alarm Queue */}
          <aside className="cc-queue-card" aria-label="FDC 알람 큐">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#17263B', margin: 0 }}>
                  🚨 가상 FDC 알람 큐 (합성 시뮬레이션)
                </h2>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  FAB ONE 반도체 식각 가상 FDC 알람 이벤트 큐 (합성 데이터 · Run 계통성 검증 완료)
                </div>
              </div>
              <span className="pill" style={{ background: '#F1F5F9', color: '#475569', fontSize: '11px' }}>
                {filteredAndSortedAlarms.length} / {totalCount} 건
              </span>
            </div>

            {/* Filter Section */}
            <div className="cc-filter-section">
              {/* Severity Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', minWidth: '45px' }}>심각도:</span>
                <div className="cc-filter-group">
                  {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      className={`cc-filter-chip ${severityFilter === sev ? 'active' : ''}`}
                      onClick={() => setSeverityFilter(sev)}
                    >
                      {sev === 'ALL' ? '전체' : sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', minWidth: '45px' }}>상태:</span>
                <div className="cc-filter-group">
                  {(['ALL', 'ACTIVE', 'CLEARED', 'ACKNOWLEDGED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`cc-filter-chip ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st === 'ALL' ? '전체' : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment & Chamber Filter & Sort */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>설비:</span>
                  <select
                    value={equipmentFilter}
                    onChange={(e) => setEquipmentFilter(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#1E293B',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="ALL">전체 설비/챔버</option>
                    {equipmentOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>정렬:</span>
                  <button
                    type="button"
                    className={`cc-filter-chip ${sortOrder === 'NEWEST' ? 'active' : ''}`}
                    onClick={() => setSortOrder('NEWEST')}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    최신순 ↓
                  </button>
                  <button
                    type="button"
                    className={`cc-filter-chip ${sortOrder === 'OLDEST' ? 'active' : ''}`}
                    onClick={() => setSortOrder('OLDEST')}
                    style={{ fontSize: '10px', padding: '3px 8px' }}
                  >
                    과거순 ↑
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message if API failed */}
            {errorState && (
              <div
                style={{
                  padding: '12px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  margin: '12px 0',
                  fontSize: '12px',
                  color: '#991B1B',
                  lineHeight: 1.4,
                }}
              >
                <strong>⚠️ {errorState.title}:</strong><br />
                {errorState.message}
              </div>
            )}

            {/* Empty State when 0 alarms match */}
            {filteredAndSortedAlarms.length === 0 ? (
              <div className="cc-empty-box" role="status">
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#17263B', marginBottom: '4px' }}>
                  일치하는 FDC 알람이 없습니다 (0건)
                </div>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px' }}>
                  선택한 조건(심각도: {severityFilter}, 상태: {statusFilter})에 일치하는 알람이 없습니다.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSeverityFilter('ALL');
                    setStatusFilter('ALL');
                    setEquipmentFilter('ALL');
                  }}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              /* Scrollable Alarm Queue - [P1-B Fix]: Semantic <button> for native keyboard accessibility */
              <div className="cc-alarm-list-scroll" role="feed" aria-label="알람 큐 목록">
                {filteredAndSortedAlarms.map((alert) => {
                  const isSelected = selectedAlertId === alert.alert_id;
                  let sevBg = '#FEE2E2';
                  let sevColor = '#B91C1C';
                  let sevBorder = '#FECACA';
                  let leftBorderColor = '#DC2626';

                  if (alert.severity === 'WARNING') {
                    sevBg = '#FEF3C7';
                    sevColor = '#B45309';
                    sevBorder = '#FCD34D';
                    leftBorderColor = '#D97706';
                  } else if (alert.severity === 'INFO') {
                    sevBg = '#EFF6FF';
                    sevColor = '#1D4ED8';
                    sevBorder = '#BFDBFE';
                    leftBorderColor = '#2563EB';
                  }

                  // [P1-C Fix]: Rigorous eligibility check for queue badge
                  const invCheck = isInvestigationSupported(alert, activeRunId);

                  return (
                    <button
                      type="button"
                      key={alert.alert_id}
                      id={`cc-alarm-item-${alert.alert_id}`}
                      className={`cc-alarm-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectAlert(alert.alert_id)}
                      aria-pressed={isSelected}
                      aria-selected={isSelected}
                      tabIndex={0}
                      aria-label={`알람 ${alert.alert_id}, 심각도 ${alert.severity}, 설비 ${alert.equipment_id} ${alert.chamber_id}`}
                      style={{
                        borderLeftColor: isSelected ? '#0B9F78' : leftBorderColor,
                        borderLeftWidth: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className="pill"
                            style={{
                              padding: '2px 6px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: sevBg,
                              color: sevColor,
                              borderColor: sevBorder,
                            }}
                          >
                            {alert.severity}
                          </span>
                          <strong style={{ fontSize: '12px', color: '#17263B' }}>{alert.alert_id}</strong>
                        </div>
                        <span
                          className="pill"
                          style={{
                            padding: '1px 6px',
                            fontSize: '9px',
                            color: alert.status === 'ACTIVE' ? '#047857' : '#64748B',
                            background: alert.status === 'ACTIVE' ? '#ECFDF5' : '#F1F5F9',
                            borderColor: alert.status === 'ACTIVE' ? '#A7F3D0' : '#CBD5E1',
                          }}
                        >
                          {alert.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#334155', fontWeight: 600, marginBottom: '4px', lineHeight: 1.4 }}>
                        {alert.message}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#64748B' }}>
                        <span>
                          위치: <strong>{alert.equipment_id} · {alert.chamber_id}</strong>
                        </span>
                        <span>
                          {alert.event_time_utc ? new Date(alert.event_time_utc).toISOString().substring(11, 19) + ' UTC' : '-'}
                        </span>
                      </div>

                      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                          규칙: {alert.rule_code}
                        </span>
                        {invCheck.supported ? (
                          <span style={{ fontSize: '10px', color: '#0B9F78', fontWeight: 700 }}>
                            🔬 센서 조사 지원
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                            {alert.run_id ? '센서조사 미지원' : '대기/단독 경보'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Column: Selected Alarm Engineering Detail Card */}
          {selectedAlert ? (
            <section className="cc-detail-card" aria-label="선택 알람 상세">
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #EDF1F5', paddingBottom: '14px', marginBottom: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      className="pill"
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: selectedAlert.severity === 'CRITICAL' ? '#FEE2E2' : (selectedAlert.severity === 'WARNING' ? '#FEF3C7' : '#EFF6FF'),
                        color: selectedAlert.severity === 'CRITICAL' ? '#B91C1C' : (selectedAlert.severity === 'WARNING' ? '#B45309' : '#1D4ED8'),
                        borderColor: selectedAlert.severity === 'CRITICAL' ? '#FECACA' : (selectedAlert.severity === 'WARNING' ? '#FCD34D' : '#BFDBFE'),
                      }}
                    >
                      {selectedAlert.severity}
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#17263B', margin: 0 }}>
                      {selectedAlert.alert_id}
                    </h2>
                    <span className="pill" style={{ fontSize: '10px', color: '#047857', background: '#ECFDF5', borderColor: '#A7F3D0' }}>
                      {selectedAlert.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    FDC 이상 감지 규칙: <strong>{selectedAlert.rule_code}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(selectedAlert.alert_id);
                        setNotice(`알람 ID '${selectedAlert.alert_id}' 클립보드 복사 완료.`);
                      }
                    }}
                    style={{ fontSize: '11px', padding: '6px 10px' }}
                    title="알람 ID 복사"
                  >
                    ID 복사
                  </button>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="trace-meta-grid" style={{ marginBottom: '18px' }}>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">대상 설비 / 챔버</span>
                  <span className="trace-meta-value">
                    {selectedAlert.equipment_id} · {selectedAlert.chamber_id}
                  </span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">공정 Run ID</span>
                  <span className="trace-meta-value">
                    {selectedAlert.run_id || '해당 없음 (대기/Standby)'}
                  </span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">발생 시각 (UTC)</span>
                  <span className="trace-meta-value" style={{ fontSize: '11px' }}>
                    {selectedAlert.event_time_utc || '미기록'}
                  </span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">영향 Lot ID</span>
                  <span className="trace-meta-value">{selectedAlert.candidate_lot || '해당 없음'}</span>
                </div>
              </div>

              {/* Message Description Box */}
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF1F5' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#48586D', marginBottom: '4px' }}>
                  알람 상세 메시지 (Diagnostic Message):
                </div>
                <div style={{ fontSize: '13px', color: '#1E293B', lineHeight: '1.6', fontWeight: 500 }}>
                  {selectedAlert.message}
                </div>
              </div>

              {/* [P1-C Fix]: Investigation Capability Section rigorously gated by actual telemetry evidence */}
              {selectedInvCheck.supported ? (
                <div className="trace-alert-link-card" style={{ marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px' }}>🔬</span>
                      <strong style={{ fontSize: '14px', color: '#B91C1C' }}>
                        정밀 엔지니어링 이상 조사 (Investigation) 지원 알람
                      </strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '6px', lineHeight: '1.5' }}>
                      현재 합성 시나리오의 조사 연결 지원 조건(활성 Run {selectedAlert.run_id}, {selectedAlert.equipment_id} / {selectedAlert.chamber_id}, 스텝 T7 구간 시계열 센서 급증)을 충족합니다. (진입 후 실제 백엔드 세션/레코드 부재 시 fail-closed 안내 유지)
                    </div>

                    {/* Candidate Wafers Preview (Rendered exclusively when verified candidate wafers exist) */}
                    {selectedAlert.candidate_wafers && selectedAlert.candidate_wafers.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>
                          잠재 노출 영향군 ({selectedAlert.candidate_wafers.length}매):
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {selectedAlert.candidate_wafers.map((wId) => (
                            <Link
                              key={wId}
                              href={`/traceability?wafer=${wId}${mode === 'A' ? `&seed=${seed}` : ''}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#FFFFFF',
                                border: '1px solid #FECACA',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#B91C1C',
                                textDecoration: 'none',
                              }}
                              title={`웨이퍼 ${wId} 이력 추적성 보기`}
                            >
                              {wId} ↗
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* EKL triggers for investigation */}
                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#7F1D1D', fontWeight: 700 }}>공학 개념 (EKL):</span>
                      <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 원리" showBadge />
                      <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 해석" showBadge />
                      <EngineeringTermTrigger conceptId="wafer-exposure-status" label="노출 확정 vs 잠재 후보" showBadge />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'center' }}>
                    <Link
                      id="cc-btn-go-investigation"
                      href={`/?alert=${encodeURIComponent(selectedAlert.alert_id)}&investigation=true${mode === 'A' ? `&seed=${seed}` : ''}`}
                      className="btn-danger-outline"
                      style={{ textDecoration: 'none', padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center' }}
                    >
                      엔지니어링 조사 상세 보기 →
                    </Link>
                    <Link
                      id="cc-btn-go-workspace"
                      href={
                        mode === 'B'
                          ? `/engineering-workspace?alert=${encodeURIComponent(selectedAlert.alert_id)}&mode=B&run_id=${encodeURIComponent(activeRunId || '')}`
                          : `/engineering-workspace?alert=${encodeURIComponent(selectedAlert.alert_id)}&seed=${seed}`
                      }
                      className="btn-primary"
                      style={{
                        textDecoration: 'none',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        background: '#0B9F78',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                      }}
                    >
                      엔지니어링 워크스페이스에서 사건 분석 ↗
                    </Link>
                    <Link
                      id="cc-btn-go-equipment"
                      href={`/equipment-intelligence?sensor=RELATIVE_SIGNAL${mode === 'A' ? `&seed=${seed}` : ''}`}
                      className="btn-secondary"
                      style={{
                        textDecoration: 'none',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        borderColor: '#0B9F78',
                        color: '#047857',
                        background: '#FFFFFF',
                      }}
                    >
                      설비 센서 계측 확인 (ETCH-02 / CH-B) →
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px' }}>ℹ️</span>
                    <strong style={{ fontSize: '13px', color: '#475569' }}>
                      조사 미지원 알람 (No Investigation Telemetry Available)
                    </strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6' }}>
                    {selectedInvCheck.reason}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                    FAB ONE 도메인 무결성 규약에 따라 타 알람의 센서 계측 근거로 왜곡 연결하지 않으며, 허위 조사 동선을 제공하지 않습니다 (Fail-closed).
                  </div>
                </div>
              )}

              {/* Engineering Knowledge Layer Integration (EKL Level 1) */}
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                    📚 FDC 알람 연계 엔지니어링 지식 (EKL L1)
                  </span>
                  <span style={{ fontSize: '10px', color: '#15803D' }}>클릭 시 공학 계산기 및 심층 학습 제공</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 기준" showBadge />
                  <EngineeringTermTrigger conceptId="wafer-exposure-status" label="웨이퍼 노출 상태 정의" showBadge />
                  <EngineeringTermTrigger conceptId="rf-power" label="RF Power 출력 이상" showBadge />
                  <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 변곡" showBadge />
                </div>
              </div>

              {/* Engineering Safety Disclaimers */}
              <div style={{ padding: '14px 16px', background: '#FFFDF5', borderRadius: '8px', border: '1px solid #FEF08A', fontSize: '11px', color: '#854D0E', lineHeight: '1.6' }}>
                <strong style={{ color: '#A16207' }}>※ [FAB ONE 반도체 공학 분석 가이드라인]</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                  <li><strong>Sensor Excursion ≠ Product Defect:</strong> 센서의 관리한계(UCL) 초과는 공정 조건의 일탈 감지이며, 웨이퍼의 물리적 결함(Defect) 확정이 아닙니다.</li>
                  <li><strong>Candidate Exposed ≠ Confirmed Defect:</strong> 잠재 영향군(Candidate) 웨이퍼는 결함 의심군으로서 우선 검측 대상일 뿐이며, 비파괴 검측 통과 시 후속 공정에 정상 투입됩니다.</li>
                  <li><strong>Synthetic Data Contract:</strong> 모든 알람 및 계측치는 반도체 공정 시뮬레이션용 가상 합성(data_origin: synthetic) 데이터입니다.</li>
                </ul>
              </div>
            </section>
          ) : (
            <div className="trace-loading-card">
              <div style={{ fontSize: '20px' }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#64748B', marginTop: '8px' }}>
                선택된 알람이 없습니다. 좌측 큐에서 알람을 선택해 주세요.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<div className="loading-container">커맨드 센터 로딩 중...</div>}>
      <CommandCenterContent />
    </Suspense>
  );
}

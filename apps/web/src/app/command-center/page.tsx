'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';

// Domain Interfaces
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

// Built-in Mode A Deterministic Synthetic Alarm Fixture Generator
function generateModeACommandCenterAlarms(seed: number): FdcAlert[] {
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

function CommandCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryAlert = searchParams.get('alert');

  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [seed, setSeed] = useState<number>(20261015);
  const [activeRunId, setActiveRunId] = useState<string | null>('RUN-DEMO-015');
  const [alarms, setAlarms] = useState<FdcAlert[]>(() => generateModeACommandCenterAlarms(20261015));
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(() => {
    const initialAlarms = generateModeACommandCenterAlarms(20261015);
    return queryAlert || (initialAlarms.length > 0 ? initialAlarms[0].alert_id : null);
  });

  // Filter & Sort States
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED'>('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [notice, setNotice] = useState<string>('FDC 알람 커맨드 센터 준비 완료');

  // Request ID Guard for race conditions
  const activeReqIdRef = useRef<number>(0);

  // Unified data loader: Summary-first run discovery & explicit alerts query (P1-A compliant)
  const loadAlarms = useCallback(async () => {
    const reqId = ++activeReqIdRef.current;
    setIsLoading(true);
    setErrorState(null);

    // Step 1: Query summary first to discover active_run_id
    let summaryRes: Response;
    try {
      summaryRes = await fetch('http://localhost:8000/api/v1/demo/summary', { cache: 'no-store' });
    } catch {
      // Genuine network disconnect -> Mode A fallback
      if (reqId !== activeReqIdRef.current) return;
      setMode('A');
      const fixtureAlarms = generateModeACommandCenterAlarms(seed);
      setAlarms(fixtureAlarms);
      const synRunId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
      setActiveRunId(synRunId);
      if (!selectedAlertId || !fixtureAlarms.some(a => a.alert_id === selectedAlertId)) {
        setSelectedAlertId(fixtureAlarms[0]?.alert_id ?? null);
      }
      setIsLoading(false);
      setNotice(`Mode A: 백엔드 미연결(오프라인)에 따른 로컬 합성 픽스처 알람 큐(${fixtureAlarms.length}건) 표시.`);
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
    if (alertsData.length > 0) {
      if (!selectedAlertId || !alertsData.some(a => a.alert_id === selectedAlertId)) {
        setSelectedAlertId(alertsData[0].alert_id);
      }
    } else {
      setSelectedAlertId(null);
    }
    setNotice(`Mode B (Live API): 활성 공정 Run (${currentRunId}) FDC 알람 큐(${alertsData.length}건) 동기화 완료.`);
    setIsLoading(false);
  }, [seed, selectedAlertId]);

  // Initial load
  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  // Sync if URL search param changes
  useEffect(() => {
    if (queryAlert && queryAlert !== selectedAlertId) {
      setSelectedAlertId(queryAlert);
    }
  }, [queryAlert, selectedAlertId]);

  // Filtered and Sorted Alarms
  const filteredAndSortedAlarms = useMemo(() => {
    let result = [...alarms];

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
  }, [alarms, severityFilter, statusFilter, equipmentFilter, sortOrder]);

  // Synchronize selectedAlert with filtered list
  const selectedAlert = useMemo(() => {
    if (!selectedAlertId) return null;
    return filteredAndSortedAlarms.find(a => a.alert_id === selectedAlertId) || null;
  }, [filteredAndSortedAlarms, selectedAlertId]);

  // When filtered list changes, ensure selection remains coherent
  useEffect(() => {
    if (filteredAndSortedAlarms.length > 0) {
      if (!selectedAlertId || !filteredAndSortedAlarms.some(a => a.alert_id === selectedAlertId)) {
        setSelectedAlertId(filteredAndSortedAlarms[0].alert_id);
      }
    } else {
      setSelectedAlertId(null);
    }
  }, [filteredAndSortedAlarms, selectedAlertId]);

  // Counts for KPI and filter badges
  const totalCount = alarms.length;
  const criticalCount = alarms.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alarms.filter(a => a.severity === 'WARNING').length;
  const infoCount = alarms.filter(a => a.severity === 'INFO').length;

  // Equipment options extracted dynamically
  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    alarms.forEach(a => set.add(`${a.equipment_id} / ${a.chamber_id}`));
    return Array.from(set);
  }, [alarms]);

  const handleSelectAlert = (aId: string) => {
    setSelectedAlertId(aId);
    router.replace(`/command-center?alert=${encodeURIComponent(aId)}`, { scroll: false });
  };

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
          <Link href="/" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            식각 챔버 시뮬레이터 (Home)
          </Link>
          <Link href="/traceability" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            웨이퍼 이력 추적성 (Traceability)
          </Link>
          <Link href="/command-center" className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            FDC 커맨드 센터 (Command Center)
          </Link>
        </nav>

        {/* Status Pills */}
        <div className="top-status-pills">
          <span className="badge-synthetic" title="모든 알람 및 계측 데이터는 가상 시나리오 합성(Synthetic) 계약을 준수합니다">
            🧪 data_origin: synthetic
          </span>

          {mode === 'B' ? (
            <span className="pill pill-mode-b">
              <span className="pulse-dot"></span>
              Mode B · Live API
            </span>
          ) : (
            <span className="pill pill-mode-a">
              <span className="pulse-dot"></span>
              Mode A · Synthetic Fixture
            </span>
          )}
        </div>
      </header>

      {/* Main Wrapper */}
      <main className="main-wrapper">
        {/* Notice Box */}
        <div className="notice-box" role="status">
          <strong>커맨드 센터 상태 안내:</strong> {notice}
        </div>

        {/* KPI Overview Bar */}
        <div className="cc-kpi-bar" aria-label="FDC 알람 큐 핵심 지표">
          <div className="cc-kpi-item">
            <span className="cc-kpi-label">활성 공정 Run ID</span>
            <span className="cc-kpi-val" style={{ fontSize: '13px', color: '#0B9F78' }}>
              {activeRunId || '미배정 (대기)'}
            </span>
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
          <aside className="cc-queue-card" aria-label="FDC 알람 목록 큐">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#17263B' }}>
                  FDC 알람 큐 (Alarm Queue)
                </h2>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  공정 Run에 바인딩된 설비 이상 감지 알람 목록
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadAlarms()}
                style={{ padding: '4px 10px', fontSize: '11px' }}
                title="알람 큐 새로고침"
              >
                새로고침 ↻
              </button>
            </div>

            {/* Severity Filter Chips */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#48586D', marginBottom: '4px' }}>
                심각도(Severity) 필터:
              </div>
              <div className="cc-filter-row" role="tablist" aria-label="심각도 필터">
                <button
                  type="button"
                  id="cc-filter-sev-all"
                  className={`cc-filter-chip ${severityFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('ALL')}
                >
                  전체 ({totalCount})
                </button>
                <button
                  type="button"
                  id="cc-filter-sev-critical"
                  className={`cc-filter-chip critical ${severityFilter === 'CRITICAL' ? 'active critical' : ''}`}
                  onClick={() => setSeverityFilter('CRITICAL')}
                >
                  CRITICAL ({criticalCount})
                </button>
                <button
                  type="button"
                  id="cc-filter-sev-warning"
                  className={`cc-filter-chip warning ${severityFilter === 'WARNING' ? 'active warning' : ''}`}
                  onClick={() => setSeverityFilter('WARNING')}
                >
                  WARNING ({warningCount})
                </button>
                <button
                  type="button"
                  id="cc-filter-sev-info"
                  className={`cc-filter-chip info ${severityFilter === 'INFO' ? 'active info' : ''}`}
                  onClick={() => setSeverityFilter('INFO')}
                >
                  INFO ({infoCount})
                </button>
              </div>
            </div>

            {/* Status & Sorting Control Bar */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #EDF1F5' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label htmlFor="cc-select-status" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                  상태 필터
                </label>
                <select
                  id="cc-select-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                >
                  <option value="ALL">전체 상태</option>
                  <option value="ACTIVE">ACTIVE (활성)</option>
                  <option value="CLEARED">CLEARED (해제)</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED (확인)</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '120px' }}>
                <label htmlFor="cc-select-equipment" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                  설비 / 챔버
                </label>
                <select
                  id="cc-select-equipment"
                  value={equipmentFilter}
                  onChange={(e) => setEquipmentFilter(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                >
                  <option value="ALL">전체 설비/챔버</option>
                  {equipmentOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '100px' }}>
                <label htmlFor="cc-select-sort" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>
                  정렬 기준
                </label>
                <select
                  id="cc-select-sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  style={{ width: '100%', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px' }}
                >
                  <option value="NEWEST">최신순</option>
                  <option value="OLDEST">오래된순</option>
                </select>
              </div>
            </div>

            {/* Error Notification on Left Panel */}
            {errorState && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
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
              /* Scrollable Alarm Queue */
              <div className="cc-alarm-list-scroll">
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

                  const isInvestigatable = Boolean(alert.run_id && alert.severity === 'CRITICAL');

                  return (
                    <div
                      key={alert.alert_id}
                      id={`cc-alarm-item-${alert.alert_id}`}
                      className={`cc-alarm-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectAlert(alert.alert_id)}
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
                        {isInvestigatable ? (
                          <span style={{ fontSize: '10px', color: '#0B9F78', fontWeight: 700 }}>
                            🔬 센서 조사 지원
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                            대기/단독 경보
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Column: Selected Alarm Detail & Investigation Flow */}
          {isLoading ? (
            <div className="trace-loading-card" role="status">
              <div className="pulse-dot" style={{ width: '12px', height: '12px', background: '#0B9F78' }}></div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#17263B', marginTop: '16px' }}>
                FDC 알람 및 공정 계통 데이터 동기화 중...
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                활성 공정 Run과 알람 데이터의 출처 일관성을 안전하게 검증합니다.
              </div>
            </div>
          ) : errorState ? (
            <div className="trace-not-found-card" role="alert">
              <div className="not-found-icon" aria-hidden="true">⚠️</div>
              <h2 className="not-found-title">{errorState.title}</h2>
              <div className="not-found-badge">오류 코드: HTTP {errorState.status}</div>
              <p className="not-found-desc">{errorState.message}</p>
              <div className="not-found-disclaimer">
                <strong>※ FAB ONE 도메인 무결성 규약:</strong><br />
                서버 오류(HTTP {errorState.status}) 또는 데이터 계통성 위반 발생 시, 다른 Run 알람을 혼합하거나 임의의 합성 알람으로 대체하지 않고 조회를 차단(Fail-Closed)합니다.
              </div>
              <div className="not-found-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => loadAlarms()}
                >
                  알람 목록 재시도 ↻
                </button>
                <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
                  챔버 대시보드로 이동 ↗
                </Link>
              </div>
            </div>
          ) : selectedAlert ? (
            <section className="cc-detail-card" aria-label="선택 알람 상세 및 조사 정보">
              {/* Header Banner */}
              <div className="trace-header-banner">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                    <h1 style={{ fontSize: '20px', fontWeight: 850, margin: 0, color: '#17263B' }}>
                      {selectedAlert.alert_id}
                    </h1>
                    <span className="pill" style={{ padding: '2px 8px', fontSize: '11px' }}>
                      {selectedAlert.status}
                    </span>
                    <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 기준" showBadge />
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    FDC 규칙: <strong>{selectedAlert.rule_code}</strong> · 설비: {selectedAlert.equipment_id} ({selectedAlert.chamber_id})
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    href="/"
                    className="btn-secondary"
                    style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '11px' }}
                  >
                    대시보드 보기 ↗
                  </Link>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="trace-meta-grid">
                <div className="trace-meta-col">
                  <span className="trace-meta-label">공정 Run ID</span>
                  <span className="trace-meta-value">{selectedAlert.run_id || '대기 상태 (None)'}</span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">설비 / 챔버</span>
                  <span className="trace-meta-value">{selectedAlert.equipment_id} · {selectedAlert.chamber_id}</span>
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

              {/* Investigation Capability Section */}
              {selectedAlert.run_id && selectedAlert.severity === 'CRITICAL' ? (
                <div className="trace-alert-link-card" style={{ marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '18px' }}>🔬</span>
                      <strong style={{ fontSize: '14px', color: '#B91C1C' }}>
                        정밀 엔지니어링 이상 조사 (Investigation) 지원 알람
                      </strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#7F1D1D', marginTop: '6px', lineHeight: '1.5' }}>
                      식각 챔버(CH-B) 스텝 T7 구간의 시계열 센서(OES 상대 신호, 챔버 압력, RF Power) 급증 계측 근거와 카세트 웨이퍼 영향 구간을 즉시 분석할 수 있습니다.
                    </div>

                    {/* Candidate Wafers Preview */}
                    {selectedAlert.candidate_wafers && selectedAlert.candidate_wafers.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>
                          잠재 노출 영향군 ({selectedAlert.candidate_wafers.length}매):
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {selectedAlert.candidate_wafers.map((wId) => (
                            <Link
                              key={wId}
                              href={`/traceability?wafer=${wId}`}
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
                      href={`/?alert=${encodeURIComponent(selectedAlert.alert_id)}&investigation=true`}
                      className="btn-danger-outline"
                      style={{ textDecoration: 'none', padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'center' }}
                    >
                      엔지니어링 조사 상세 보기 →
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px' }}>ℹ️</span>
                    <strong style={{ fontSize: '13px', color: '#475569' }}>
                      조사 미지원 알람 (No Active Run Investigation Context)
                    </strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6' }}>
                    본 경보는 대기 챔버 점검 또는 일반 설비 상태 알람으로, 연결된 가동 공정 Run 및 웨이퍼 가공 이력이 없습니다.
                    FAB ONE 도메인 무결성 규약에 따라 타 알람의 센서 계측 근거로 왜곡 연결하지 않으며, 허위 조사 동선을 제공하지 않습니다.
                  </div>
                </div>
              )}

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
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>로딩 중...</div>}>
      <CommandCenterContent />
    </Suspense>
  );
}

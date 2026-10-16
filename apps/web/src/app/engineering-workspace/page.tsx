'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
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
} from '@/components/engineering-workspace/engineering-workspace-contract';
import { TourReturnBanner } from '@/components/guided-demo';

function EngineeringWorkspaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse seed & alert parameters
  const querySeed = searchParams.get('seed');
  const queryAlert = searchParams.get('alert');
  const queryTourStep = searchParams.get('tourStep');

  const seed = useMemo(() => parseSafeWorkspaceSeed(querySeed), [querySeed]);
  const navLinks = useMemo(() => getWorkspaceNavLinks(seed, queryAlert || undefined), [seed, queryAlert]);
  const expectedAlertId = useMemo(() => `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`, [seed]);

  // Support check: alert lineage evaluation
  const isSupportedAlert = useMemo(() => {
    return isWorkspaceAlertSupported(queryAlert, expectedAlertId);
  }, [queryAlert, expectedAlertId]);

  // Initial deterministic data
  const defaultEvidence = useMemo(() => generateDefaultEvidenceItems(seed), [seed]);
  const defaultHypotheses = useMemo(() => generateDefaultHypotheses(), []);
  const defaultActions = useMemo(() => generateDefaultActions(), []);

  // In-memory UI states (volatile on refresh)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('EVI-02');
  const [hypotheses, setHypotheses] = useState<HypothesisItem[]>(defaultHypotheses);
  const [actions, setActions] = useState<ActionItem[]>(defaultActions);
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>('HYPO-01');
  const [notes, setNotes] = useState<string>('');

  // Re-synchronize defaults if seed changes
  useEffect(() => {
    setHypotheses(generateDefaultHypotheses());
    setActions(generateDefaultActions());
  }, [seed]);

  // Selected Evidence Item
  const selectedEvidence = useMemo(() => {
    return defaultEvidence.find((e) => e.id === selectedEvidenceId) || defaultEvidence[0];
  }, [defaultEvidence, selectedEvidenceId]);

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
    params.set('alert', expectedAlertId);
    router.replace(`/engineering-workspace?${params.toString()}`);
  }, [searchParams, expectedAlertId, router]);

  // Re-synthesis (advance seed)
  const handleResynthesize = useCallback(() => {
    const nextSeed = seed + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set('seed', String(nextSeed));
    params.delete('alert');
    router.replace(`/engineering-workspace?${params.toString()}`);
  }, [seed, searchParams, router]);

  return (
    <div className="command-center-container" style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Top Header */}
      <header
        className="top-nav-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
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
              · Engineering Workspace (BUILD-08)
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
          <Link href={queryTourStep ? `/demo-tour?seed=${seed}&step=${queryTourStep}` : `/demo-tour?seed=${seed}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            가이드 투어 (Demo Tour)
          </Link>
        </nav>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="pill"
            style={{
              background: '#ECFDF5',
              color: '#047857',
              border: '1px solid #A7F3D0',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Mode A (합성 분석)
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
            Run: {navLinks.runId}
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
                <strong>지원되지 않거나 대기 상태(Standby)인 알람입니다:</strong> {queryAlert}
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  요청된 알람은 활성 공정 일탈 런({navLinks.runId})과 일치하지 않습니다. 허위 데이터로 조용히 대체하지
                  않습니다.
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
              활성 알람({expectedAlertId})으로 전환 ↗
            </button>
          </div>
        )}

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
          <div style={{ display: 'flex', gap: '6px' }}>
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
                {defaultEvidence.length}개 사실
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
              {defaultEvidence.map((evi) => {
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
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                        {evi.id} · {evi.category}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: flagColor,
                          background: flagBg,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {evi.qualityFlag}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginTop: '4px' }}>
                      {evi.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', lineHeight: 1.35 }}>
                      {evi.summary}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '11px',
                        color: '#475569',
                      }}
                    >
                      <span>
                        계측치: <strong>{evi.observedValue}</strong>
                      </span>
                      <span style={{ color: '#0B9F78', fontWeight: 600 }}>세부 확인 ➔</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Evidence Detail Box */}
            <div
              id="selected-evidence-detail"
              style={{
                marginTop: 'auto',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
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
          </section>

          {/* Section 2: Hypothesis Comparison Board */}
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
                  2. 가설 비교 보드 (Hypothesis Board)
                </h2>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  공학적 후보 가설 비교 및 증거 맵핑
                </div>
              </div>
              <button
                type="button"
                id="btn-reset-hypotheses"
                onClick={handleResetHypotheses}
                style={{
                  background: 'none',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#64748B',
                  cursor: 'pointer',
                }}
              >
                초기화 ↺
              </button>
            </div>

            {/* Invariant Note */}
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#92400E',
                lineHeight: 1.4,
              }}
            >
              ⚠️ <strong>원인 확정 금지:</strong> 가설 상태 및 증거 연결은 엔지니어의 로컬 시연 검토 의견일 뿐이며
              자동 원인 규명(RCA)이나 품질 판정이 아닙니다.
            </div>

            {/* Hypothesis Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hypotheses.map((hyp) => {
                const isSelected = hyp.id === selectedHypothesisId;

                let statusBadgeBg = '#F1F5F9';
                let statusBadgeColor = '#475569';
                if (hyp.status === 'SUPPORTED_FOR_REVIEW') {
                  statusBadgeBg = '#CCFBF1';
                  statusBadgeColor = '#0F766E';
                } else if (hyp.status === 'NEEDS_MORE_DATA') {
                  statusBadgeBg = '#FEF3C7';
                  statusBadgeColor = '#B45309';
                } else if (hyp.status === 'RULED_OUT') {
                  statusBadgeBg = '#FEE2E2';
                  statusBadgeColor = '#991B1B';
                }

                return (
                  <div
                    key={hyp.id}
                    id={`hypothesis-card-${hyp.id}`}
                    onClick={() => setSelectedHypothesisId(hyp.id)}
                    style={{
                      border: isSelected ? '2px solid #0D9488' : '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px',
                      background: isSelected ? '#F0FDFA' : '#FFFFFF',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>
                        {hyp.id} · {hyp.domain}
                      </span>
                      <span
                        id={`status-badge-${hyp.id}`}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: statusBadgeColor,
                          background: statusBadgeBg,
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {hyp.statusLabel}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginTop: '6px' }}>
                      {hyp.title}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                      {hyp.description}
                    </div>

                    <div
                      style={{
                        marginTop: '8px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '11px',
                        color: '#64748B',
                      }}
                    >
                      <strong>엔지니어링 근거/판단:</strong> {hyp.engineeringRationale}
                    </div>

                    {/* Linked Evidence Badges */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        연결된 증거 사실 ({hyp.linkedEvidenceIds.length}건):
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {hyp.linkedEvidenceIds.length === 0 ? (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>연결된 증거 없음</span>
                        ) : (
                          hyp.linkedEvidenceIds.map((eviId) => (
                            <span
                              key={eviId}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#0F766E',
                                background: '#E6FFFA',
                                border: '1px solid #99F6E4',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              ✓ {eviId}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Evidence Checklist Toggle */}
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '6px',
                        borderTop: '1px dashed #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#64748B' }}>증거 맵핑:</span>
                        {defaultEvidence.map((e) => {
                          const isLinked = hyp.linkedEvidenceIds.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              id={`btn-link-${hyp.id}-${e.id}`}
                              onClick={(evt) => {
                                evt.stopPropagation();
                                handleToggleEvidenceLink(hyp.id, e.id);
                              }}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                border: isLinked ? '1px solid #0D9488' : '1px solid #CBD5E1',
                                background: isLinked ? '#0D9488' : '#FFFFFF',
                                color: isLinked ? '#FFFFFF' : '#64748B',
                                cursor: 'pointer',
                              }}
                              title={`${e.title} 증거 연결 토글`}
                            >
                              {e.id}
                            </button>
                          );
                        })}
                      </div>

                      {/* Status Cycle Button */}
                      <button
                        type="button"
                        id={`btn-cycle-status-${hyp.id}`}
                        onClick={(evt) => {
                          evt.stopPropagation();
                          handleCycleStatus(hyp.id);
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #0D9488',
                          color: '#0D9488',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        상태 순환 전환 ⟳
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Action Checklist & Notes */}
          <section
            aria-labelledby="section-action-checklist"
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
                  id="section-action-checklist"
                  style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}
                >
                  3. 조치 체크리스트 & 메모
                </h2>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  엔지니어링 검토 조치 및 로컬 메모
                </div>
              </div>
              <button
                type="button"
                id="btn-reset-actions"
                onClick={handleResetActions}
                style={{
                  background: 'none',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#64748B',
                  cursor: 'pointer',
                }}
              >
                체크 초기화 ↺
              </button>
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
              🔒 <strong>장비 제어 명령 미발행:</strong> 체크리스트 조치는 시뮬레이션 검토 항목이며 실제 생산
              장비(MES/FDC)에 제어 명령을 발행하지 않습니다.
            </div>

            {/* Checklist Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map((act) => (
                <div
                  key={act.id}
                  id={`action-item-${act.id}`}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '10px',
                    background: act.completed ? '#F8FAFC' : '#FFFFFF',
                    opacity: act.completed ? 0.75 : 1,
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id={`chk-${act.id}`}
                      checked={act.completed}
                      onChange={() => handleToggleAction(act.id)}
                      style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#0B9F78' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label
                          htmlFor={`chk-${act.id}`}
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#0F172A',
                            textDecoration: act.completed ? 'line-through' : 'none',
                            cursor: 'pointer',
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
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>새로고침 시 휘발</span>
              </div>
              <textarea
                id="engineering-workspace-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="조사 검토 의견, 잠재 리스크, 후속 액션 아이템을 메모하세요..."
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
                {WORKSPACE_DOMAIN_DISCLAIMERS.memoryDisclaimer}
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
              요청된 알람(<strong>{queryAlert}</strong>)은 지원되지 않거나 대기 상태(Standby)인 알람입니다.<br />
              FAB ONE의 합성 Run 계통성을 보호하기 위해 타 런의 증거/가설/조치 보드를 허위로 표기하지 않고 격리 잠금 처리했습니다.<br />
              현재 활성 공정 일탈 런(<strong>{navLinks.runId}</strong>)의 분석 데이터를 로드하려면 활성 알람(<strong>{expectedAlertId}</strong>)으로 전환하십시오.
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
              활성 알람({expectedAlertId})으로 전환 ↗
            </button>
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
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 id="section-quick-nav" style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              연계 화면 빠른 이동 (Cross-Screen Navigation)
            </h3>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Run: <strong>{navLinks.runId}</strong> · Alert: <strong>{navLinks.alertId}</strong> 맥락 유지
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            <Link
              id="ws-nav-simulation"
              href={navLinks.fabSimulation}
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
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>FAB 시뮬레이션 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>T0~T7 공정 진행 및 T7 일탈 타임라인 시연</div>
            </Link>

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
              <div style={{ fontSize: '11px', color: '#64748B' }}>알람 큐 확인 및 실시간 이상 감지 센티넬</div>
            </Link>

            <Link
              id="ws-nav-equipment"
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
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>설비 인텔리전스 ↗</div>
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

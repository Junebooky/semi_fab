'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { FriendlyPageIntro } from '@/components/ux/FriendlyPageIntro';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';
import {
  SimulationStep,
  SIMULATION_STEPS,
  generateSimulatedFoupWafers,
  getTelemetrySnapshotForStep,
  DOMAIN_DISCLAIMERS,
  parseSafeSimulationSeed,
  getSimulationNavLinks,
} from '@/components/fab-simulation/fab-simulation-contract';
import { Fab3dAssetSlot } from '@/components/fab-simulation/Fab3dAssetSlot';
import { TourReturnBanner } from '@/components/guided-demo';
import { buildCrossNavUrl } from '@/lib/investigation-context';

function FabSimulationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Seed parsing & validation
  const querySeed = searchParams.get('seed');
  const queryTourStep = searchParams.get('tourStep');
  const initialSeed = useMemo(() => parseSafeSimulationSeed(querySeed), [querySeed]);

  const [seed, setSeed] = useState<number>(initialSeed);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedWaferId, setSelectedWaferId] = useState<string>('W-08');

  // Synchronize state if URL seed changes
  useEffect(() => {
    if (querySeed) {
      const parsed = parseSafeSimulationSeed(querySeed);
      setSeed(parsed);
    }
  }, [querySeed]);

  // Current step metadata
  const currentStepMeta = useMemo(() => {
    return SIMULATION_STEPS[currentStepIndex] || SIMULATION_STEPS[0];
  }, [currentStepIndex]);

  // Wafers list (25-wafer FOUP)
  const foupWafers = useMemo(() => generateSimulatedFoupWafers(), []);

  // Telemetry snapshot for current step
  const telemetry = useMemo(() => {
    return getTelemetrySnapshotForStep(currentStepMeta.step, seed);
  }, [currentStepMeta.step, seed]);

  // Cross-page navigation links maintaining seed
  const navLinks = useMemo(() => {
    return getSimulationNavLinks(seed);
  }, [seed]);

  // Playback timer ref guard
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timer helper
  const clearAutoPlayTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Step transition handlers
  const goToNextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < SIMULATION_STEPS.length - 1) {
        return prev + 1;
      } else {
        setIsPlaying(false);
        return prev;
      }
    });
  }, []);

  const goToPrevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const resetSimulation = useCallback(() => {
    clearAutoPlayTimer();
    setIsPlaying(false);
    setCurrentStepIndex(0);
  }, [clearAutoPlayTimer]);

  const handleStepSelect = useCallback((index: number) => {
    clearAutoPlayTimer();
    setIsPlaying(false);
    setCurrentStepIndex(index);
  }, [clearAutoPlayTimer]);

  // Toggle Auto Play
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Timer effect for auto-play
  useEffect(() => {
    if (isPlaying) {
      if (currentStepIndex >= SIMULATION_STEPS.length - 1) {
        setCurrentStepIndex(0);
      }
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < SIMULATION_STEPS.length - 1) {
            return prev + 1;
          } else {
            clearAutoPlayTimer();
            setIsPlaying(false);
            return prev;
          }
        });
      }, 2500);
    } else {
      clearAutoPlayTimer();
    }

    return () => {
      clearAutoPlayTimer();
    };
  }, [isPlaying, currentStepIndex, clearAutoPlayTimer]);

  // Re-synthesis handler (advance seed and synchronize URL)
  const handleResynthesize = useCallback(() => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    const params = new URLSearchParams(searchParams.toString());
    params.set('seed', String(nextSeed));
    router.replace(`/fab-simulation?${params.toString()}`, { scroll: false });
  }, [seed, searchParams, router]);

  // Selected wafer info
  const selectedWafer = useMemo(() => {
    return foupWafers.find((w) => w.wafer_id === selectedWaferId) || foupWafers[7];
  }, [foupWafers, selectedWaferId]);

  return (
    <div className="command-center-container" style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Top Header */}
      <header className="top-nav-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-badge" aria-hidden="true" style={{ background: '#0B9F78', color: '#FFFFFF', fontWeight: 800, padding: '4px 8px', borderRadius: '6px' }}>
            F1
          </div>
          <div>
            <span className="brand-title" style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>FAB ONE</span>
            <span className="brand-subtitle" style={{ fontSize: '13px', color: '#64748B', marginLeft: '6px' }}>· Virtual FAB Simulation Journey (BUILD-07)</span>
          </div>
        </div>

        {/* Unified 5-Tab Navigation Bar */}
        <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="화면 탭">
          <Link href={buildCrossNavUrl('/', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            홈
          </Link>
          <Link href={buildCrossNavUrl('/traceability', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            웨이퍼 확인
          </Link>
          <Link href={buildCrossNavUrl('/command-center', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            알람 확인
          </Link>
          <Link href={buildCrossNavUrl('/equipment-intelligence', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            설비 살펴보기
          </Link>
          <Link href={buildCrossNavUrl('/fab-simulation', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            공정 체험
          </Link>
          <Link href={buildCrossNavUrl('/engineering-workspace', { mode: searchParams.get('mode') === 'B' ? 'B' : 'A', seed, runId: searchParams.get('run_id') || undefined, alertId: searchParams.get('alert') || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            조사 노트
          </Link>
          <Link href={buildCrossNavUrl('/demo-tour', { mode: 'A', seed, tourStep: queryTourStep || undefined })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            처음 둘러보기
          </Link>
        </nav>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pill" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
            연습용 시뮬레이션 · Mode A
          </span>
          <span className="pill" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
            Run: {navLinks.runId}
          </span>
          <button
            type="button"
            id="sim-btn-resynthesize"
            className="btn-secondary"
            style={{ padding: '3px 8px', fontSize: '11px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer' }}
            onClick={handleResynthesize}
            title="난수 시드를 변경하여 새로운 합성 시나리오를 생성합니다"
          >
            다른 연습 데이터로 바꾸기 (Seed: {seed}) ⟳
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px' }}>
        <FriendlyPageIntro
  eyebrow="가상 공정 체험"
  title="웨이퍼가 공정을 지나는 과정을 따라가 볼까요?"
  description="첫 단계부터 마지막 T7까지 하나씩 넘겨 보세요. 지금 어떤 일이 일어나는지, 다음에 어떤 신호를 확인해야 하는지 알려 드려요."
  primaryLabel="공정 단계 살펴보기"
  primaryHref="#sim-step-heading"
  detail={<p>8단계 가상 시나리오와 Seed {seed}에 연결된 예시예요. T7 알람과 W-08~W-12는 추가 확인 후보일 뿐 실제 검사·Hold·Release 명령을 수행하지 않아요.</p>}
/>

        {/* BUILD-10 Tour Return Banner */}
        <TourReturnBanner tourStep={queryTourStep} seed={seed} />

        {/* Banner Alert Notice */}
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#166534' }}>
            <span style={{ fontWeight: 800 }}>지금 살펴볼 공정</span>
            <span>웨이퍼 이동과 식각, T7의 이상 신호까지 단계별로 살펴볼 수 있어요.</span>
          </div>
          <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
            {DOMAIN_DISCLAIMERS.simulationMode}
          </span>
        </div>

        {/* Process Stepper Navigation Bar */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
          aria-label="공정 시뮬레이션 단계 조작기"
        >
          {/* Stepper Header with Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span id="sim-step-badge" style={{ padding: '3px 8px', borderRadius: '6px', background: '#0B9F78', color: '#FFFFFF', fontSize: '11px', fontWeight: 800 }}>
                {currentStepMeta.badge}
              </span>
              <h1 id="sim-step-heading" style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {currentStepMeta.name}: {currentStepMeta.title}
              </h1>
            </div>

            {/* Playback Control Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                id="sim-btn-prev"
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: currentStepIndex === 0 ? '#F1F5F9' : '#FFFFFF',
                  color: currentStepIndex === 0 ? '#94A3B8' : '#334155',
                  cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ← 이전 단계
              </button>

              <button
                type="button"
                id="sim-btn-toggle-play"
                onClick={togglePlay}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  background: isPlaying ? '#DC2626' : '#0B9F78',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isPlaying ? '잠시 멈추기' : '자동으로 다음 단계 보기'}
              </button>

              <button
                type="button"
                id="sim-btn-next"
                onClick={goToNextStep}
                disabled={currentStepIndex === SIMULATION_STEPS.length - 1}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: currentStepIndex === SIMULATION_STEPS.length - 1 ? '#F1F5F9' : '#FFFFFF',
                  color: currentStepIndex === SIMULATION_STEPS.length - 1 ? '#94A3B8' : '#334155',
                  cursor: currentStepIndex === SIMULATION_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                다음 단계 →
              </button>

              <button
                type="button"
                id="sim-btn-reset"
                onClick={resetSimulation}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#64748B',
                  cursor: 'pointer',
                }}
                title="시뮬레이션을 처음 상태로 되돌립니다"
              >
                초기화 ↺
              </button>
            </div>
          </div>

          {/* Stepper Pills */}
          <div
            role="tablist"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '6px',
              marginTop: '10px',
            }}
          >
            {SIMULATION_STEPS.map((s, idx) => {
              const isActive = idx === currentStepIndex;
              const isPassed = idx < currentStepIndex;
              return (
                <button
                  type="button"
                  key={s.step}
                  id={`sim-step-${s.step.toLowerCase()}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => handleStepSelect(idx)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: isActive ? '2px solid #0B9F78' : isPassed ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                    background: isActive ? '#ECFDF5' : isPassed ? '#F0FDF4' : '#F8FAFC',
                    color: isActive ? '#065F46' : isPassed ? '#166534' : '#64748B',
                    fontWeight: isActive ? 800 : 600,
                    fontSize: '11px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '10px', color: isActive ? '#047857' : '#94A3B8' }}>{s.badge}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                </button>
              );
            })}
          </div>

          {/* Step Narrative Subtitle & Details */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: currentStepMeta.excursionDetected ? '#FEF2F2' : '#F8FAFC',
              border: `1px solid ${currentStepMeta.excursionDetected ? '#FCA5A5' : '#E2E8F0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: currentStepMeta.excursionDetected ? '#991B1B' : '#0F172A' }}>
                설명: {currentStepMeta.subtitle}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: currentStepMeta.excursionDetected ? '#B91C1C' : '#475569', lineHeight: '1.5' }}>
                {currentStepMeta.description}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className="pill" style={{ background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                상태: {currentStepMeta.equipmentStatusLabel}
              </span>
              <span className="pill" style={{ background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                위치: {currentStepMeta.locationLabel}
              </span>
            </div>
          </div>
        </section>

        {/* 2D Fab Visual Grid Schematic */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Station 1: 25-wafer FOUP & Loadport */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>FOUP 카세트 (25매)</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>· {navLinks.lotId}</span>
              </div>
              <span style={{ fontSize: '10px', padding: '2px 6px', background: '#F1F5F9', borderRadius: '4px', fontWeight: 700, color: '#475569' }}>
                로드포트 #01
              </span>
            </div>

            {/* Target Wafer W-08 Highlight Callout */}
            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '12px',
                fontSize: '11px',
                color: '#92400E',
              }}
            >
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🎯 시연 타겟 웨이퍼: W-08</span>
                <Link
                  href={navLinks.waferTraceability}
                  style={{ color: '#B45309', fontWeight: 700, textDecoration: 'none', fontSize: '11px' }}
                  title="W-08 이력 추적성 페이지로 이동"
                >
                  이력 추적 ↗
                </Link>
              </div>
              <div style={{ marginTop: '3px', fontSize: '10px', color: '#A16207' }}>
                W-08은 챔버 진입 및 식각 중 T7 공정 일탈 영향을 받아 품질 보류(Hold) 대상이 됩니다.
              </div>
            </div>

            {/* 25-wafer Slot Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '6px',
                padding: '8px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}
              aria-label="25매 웨이퍼 카세트 슬롯"
            >
              {foupWafers.map((w) => {
                const isSelected = w.wafer_id === selectedWaferId;
                const isTarget = w.is_target_wafer;

                let slotBg = '#FFFFFF';
                let slotBorder = '#CBD5E1';
                let slotColor = '#475569';

                if (w.exposure_status === 'CONFIRMED_EXPOSED') {
                  slotBg = '#ECFDF5';
                  slotBorder = '#A7F3D0';
                  slotColor = '#065F46';
                } else if (w.exposure_status === 'CANDIDATE_EXPOSED') {
                  slotBg = isTarget ? '#FEF3C7' : '#FFF7ED';
                  slotBorder = isTarget ? '#F59E0B' : '#FED7AA';
                  slotColor = isTarget ? '#B45309' : '#C2410C';
                }

                return (
                  <button
                    type="button"
                    key={w.wafer_id}
                    id={`foup-wafer-${w.wafer_id.toLowerCase()}`}
                    onClick={() => setSelectedWaferId(w.wafer_id)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #0B9F78' : `1px solid ${slotBorder}`,
                      background: slotBg,
                      color: slotColor,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      boxShadow: isTarget ? '0 0 6px rgba(245, 158, 11, 0.4)' : 'none',
                    }}
                    title={`${w.wafer_id} (Slot ${w.slot}): ${w.status_label}`}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800 }}>{w.wafer_id}</span>
                    <span style={{ fontSize: '8px', opacity: 0.8 }}>S-{w.slot}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Slot Metadata Card */}
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                borderRadius: '6px',
                background: '#F1F5F9',
                fontSize: '11px',
                lineHeight: '1.4',
              }}
            >
              <div style={{ fontWeight: 800, color: '#1E293B' }}>
                선택 웨이퍼: {selectedWafer.wafer_id} (Slot {selectedWafer.slot})
              </div>
              <div style={{ color: '#475569', marginTop: '2px' }}>
                구분: <strong>{selectedWafer.status_label}</strong>
              </div>
              <div style={{ color: '#64748B', fontSize: '10px', marginTop: '4px' }}>
                {selectedWafer.note}
              </div>
            </div>

            {/* Exposure Status Legend */}
            <div style={{ marginTop: '12px', fontSize: '10px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ECFDF5', border: '1px solid #A7F3D0' }} />
                <span>W-01~W-07: 노출 이력 확정 (정상 처리, 결함 아님)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FFF7ED', border: '1px solid #FED7AA' }} />
                <span>W-08~W-12: 잠재 노출 후보군 (보류 검토 대상)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FFFFFF', border: '1px solid #CBD5E1' }} />
                <span>W-13~W-25: 미가공 정상 대기</span>
              </div>
            </div>
          </div>

          {/* Right Column: Station 2 (Chamber), Station 3 (FDC), and 3D Asset Slot */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* ETCH-02 Process Chamber View & Real-time Telemetry Snapshot */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>식각 공정 설비: ETCH-02 / CH-B</span>
                  <span className="pill" style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                    {currentStepMeta.chamberPlasma}
                  </span>
                </div>
                <Link
                  id="sim-link-equipment"
                  href={navLinks.equipmentIntelligence}
                  className="btn-secondary"
                  style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#047857', border: '1px solid #A7F3D0', background: '#ECFDF5', borderRadius: '6px' }}
                >
                  설비 인텔리전스 센서 차트 보기 →
                </Link>
              </div>

              {/* 3 Real-time Sensor Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {/* 1. OES Relative Signal Card */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: telemetry.oes_quality === 'MISSING' ? '#FEF2F2' : telemetry.oes_quality === 'SUSPECT' ? '#FFFBEB' : '#F8FAFC',
                    border: `1px solid ${telemetry.oes_quality === 'MISSING' ? '#FECACA' : telemetry.oes_quality === 'SUSPECT' ? '#FDE68A' : '#E2E8F0'}`,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>광학 상대 신호 (OES)</span>
                    <span style={{ fontWeight: 800, color: telemetry.oes_quality === 'MISSING' ? '#DC2626' : telemetry.oes_quality === 'SUSPECT' ? '#D97706' : '#059669' }}>
                      {telemetry.oes_quality}
                    </span>
                  </div>
                  <div id="sim-telemetry-oes" style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
                    {telemetry.oes_signal !== null ? `${telemetry.oes_signal} a.u.` : 'null (결측 / MISSING)'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    {telemetry.oes_quality === 'MISSING' ? (
                      <span style={{ color: '#B91C1C', fontWeight: 700 }}>T4/T5 광학 신호 결측 (MISSING ≠ 0)</span>
                    ) : telemetry.is_excursion ? (
                      <span style={{ color: '#B45309', fontWeight: 700 }}>관리한계 초과 (&gt; UCL 65.0 a.u.)</span>
                    ) : (
                      '정상 범위 (Baseline ~50 a.u.)'
                    )}
                  </div>
                </div>

                {/* 2. Chamber Pressure Card */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: telemetry.is_excursion ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${telemetry.is_excursion ? '#FECACA' : '#E2E8F0'}`,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>챔버 압력 (Chamber Pressure)</span>
                    <span style={{ fontWeight: 800, color: telemetry.is_excursion ? '#DC2626' : '#059669' }}>
                      {telemetry.pressure_quality}
                    </span>
                  </div>
                  <div id="sim-telemetry-pressure" style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
                    {telemetry.chamber_pressure} mTorr
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    {telemetry.is_excursion ? (
                      <span style={{ color: '#B91C1C', fontWeight: 700 }}>
                        압력 급증 (정상 120 → {telemetry.chamber_pressure} mTorr)
                      </span>
                    ) : (
                      '안정 진공 유지 (Baseline ~120 mTorr)'
                    )}
                  </div>
                </div>

                {/* 3. RF Power Card */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: telemetry.is_excursion ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${telemetry.is_excursion ? '#FECACA' : '#E2E8F0'}`,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>RF Power (고주파 전력)</span>
                    <span style={{ fontWeight: 800, color: telemetry.is_excursion ? '#DC2626' : '#059669' }}>
                      {telemetry.rf_quality}
                    </span>
                  </div>
                  <div id="sim-telemetry-rf" style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
                    {telemetry.rf_power} W
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    {telemetry.is_excursion ? (
                      <span style={{ color: '#B91C1C', fontWeight: 700 }}>
                        전력 서지 (정상 1500 → {telemetry.rf_power} W)
                      </span>
                    ) : (
                      '공정 정합 출력 (Baseline ~1500 W)'
                    )}
                  </div>
                </div>
              </div>

              {/* 3D Asset Slot Component */}
              <Fab3dAssetSlot
                plasmaStatus={currentStepMeta.chamberPlasma}
                equipmentStatus={currentStepMeta.equipmentStatus}
                stepName={currentStepMeta.name}
              />
            </div>

            {/* FDC Result & Quality Hold Station */}
            <div
              style={{
                background: currentStepMeta.alarmTriggered ? '#FFF7F7' : '#FFFFFF',
                border: `1px solid ${currentStepMeta.alarmTriggered ? '#FECACA' : '#E2E8F0'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: currentStepMeta.alarmTriggered ? '#991B1B' : '#0F172A' }}>
                    {currentStepMeta.alarmTriggered ? '이상 신호 감지 · 추가 확인 필요' : '센서 상태 살펴보기'}
                  </span>
                  <span
                    className="pill"
                    style={{
                      background: currentStepMeta.alarmTriggered ? '#FEE2E2' : '#ECFDF5',
                      color: currentStepMeta.alarmTriggered ? '#B91C1C' : '#047857',
                      border: `1px solid ${currentStepMeta.alarmTriggered ? '#FECACA' : '#A7F3D0'}`,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    {currentStepMeta.alarmTriggered ? `경보 ID: ${navLinks.alertId}` : '정상 감시 중'}
                  </span>
                </div>

                {/* Direct Action Hub Links */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    id="sim-link-command-center"
                    href={navLinks.commandCenter}
                    className="btn-secondary"
                    style={{
                      textDecoration: 'none',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                      background: '#EFF6FF',
                      borderRadius: '6px',
                    }}
                  >
                    커맨드 센터 알람 큐 보기 →
                  </Link>
                  <Link
                    id="sim-link-investigation"
                    href={navLinks.homeInvestigation}
                    className="btn-danger-outline"
                    style={{
                      textDecoration: 'none',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#B91C1C',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      borderRadius: '6px',
                    }}
                  >
                    엔지니어링 조사 상세 보기 →
                  </Link>
                </div>
              </div>

              {currentStepMeta.alarmTriggered ? (
                <div style={{ fontSize: '12px', color: '#7F1D1D', lineHeight: '1.6' }}>
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>규칙 코드:</strong> <code>FDC-RULE-SPC-UCL-01</code> · <strong>영향 호기:</strong> ETCH-02 / CH-B (Run: {navLinks.runId})
                  </p>
                  <p style={{ margin: '0 0 6px 0' }}>
                    <strong>검토 대상:</strong> 타겟 웨이퍼(W-08) 및 잠재 노출 영향군 5매(W-08~W-12)에 대해 <code>DEFECT_REVIEW_HOLD</code> 격리 조치 실행.
                  </p>
                  <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: 600, background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #FCA5A5' }}>
                    ⚠️ {DOMAIN_DISCLAIMERS.excursionVsDefect}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5' }}>
                  현재 공정 파라미터는 실시간 SPC 관리한계(UCL) 내에서 정상 가동 중입니다. Step T7 진입 시 통계적 이상 신호가 유발됩니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EKL (Engineering Knowledge Layer) Integration */}
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
          aria-label="공학 개념 지식 베이스"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>공학 개념 (EKL) 지식 베이스:</span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>시뮬레이션에서 관측된 물리·통계 원리를 확인하세요</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 원리" showBadge />
            <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 제어" showBadge />
            <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 및 결측치" showBadge />
            <EngineeringTermTrigger conceptId="wafer-exposure-status" label="공정 이력과 영향 가능성" showBadge />
          </div>
        </section>

        {/* Domain Disclaimers Footer */}
        <footer
          style={{
            padding: '14px 20px',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#475569',
            lineHeight: '1.6',
          }}
        >
          <div style={{ fontWeight: 800, color: '#334155', marginBottom: '4px' }}>반도체 제조 도메인 준수 안내 (Domain Standards):</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>{DOMAIN_DISCLAIMERS.excursionVsDefect}</li>
            <li>{DOMAIN_DISCLAIMERS.exposureStatus}</li>
            <li>{DOMAIN_DISCLAIMERS.missingNotZero}</li>
            <li>{DOMAIN_DISCLAIMERS.simulationMode}</li>
          </ul>
        </footer>
      </main>
    </div>
  );
}

export default function FabSimulationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          FAB 가상 시뮬레이션 환경 로딩 중...
        </div>
      }
    >
      <FabSimulationContent />
    </Suspense>
  );
}

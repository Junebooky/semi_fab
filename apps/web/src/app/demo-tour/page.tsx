'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { FriendlyPageIntro } from '@/components/ux/FriendlyPageIntro';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';
import {
  TourStepId,
  TOUR_STEPS,
  TOUR_DOMAIN_DISCLAIMERS,
  TOUR_COMPLETION_SUMMARY,
  parseSafeTourSeed,
  parseSafeTourStep,
  calculateTourProgress,
  getNextTourStep,
  getPrevTourStep,
  getTourStepDetails,
  getTourNavLinks,
} from '@/components/guided-demo/guided-demo-contract';
import { buildCrossNavUrl } from '@/lib/investigation-context';

function DemoTourContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse seed & step parameters
  const querySeed = searchParams.get('seed');
  const queryStep = searchParams.get('step');

  const seed = useMemo(() => parseSafeTourSeed(querySeed), [querySeed]);
  const currentStepId = useMemo(() => parseSafeTourStep(queryStep), [queryStep]);

  const [activeStepId, setActiveStepId] = useState<TourStepId>(currentStepId);

  // Synchronize state if URL changes
  useEffect(() => {
    setActiveStepId(currentStepId);
  }, [currentStepId]);

  const currentStep = useMemo(() => getTourStepDetails(activeStepId), [activeStepId]);
  const progressPercent = useMemo(() => calculateTourProgress(activeStepId), [activeStepId]);
  const navLinks = useMemo(() => getTourNavLinks(activeStepId, seed), [activeStepId, seed]);

  // Step transitions
  const handleSelectStep = useCallback(
    (stepId: TourStepId) => {
      setActiveStepId(stepId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('step', stepId);
      params.set('seed', String(seed));
      router.replace(`/demo-tour?${params.toString()}`, { scroll: false });
    },
    [searchParams, seed, router]
  );

  const handleNextStep = useCallback(() => {
    const next = getNextTourStep(activeStepId);
    handleSelectStep(next);
  }, [activeStepId, handleSelectStep]);

  const handlePrevStep = useCallback(() => {
    const prev = getPrevTourStep(activeStepId);
    handleSelectStep(prev);
  }, [activeStepId, handleSelectStep]);

  const handleResetTour = useCallback(() => {
    handleSelectStep('INTRO');
  }, [handleSelectStep]);

  // Re-synthesis (advance seed)
  const handleResynthesize = useCallback(() => {
    const nextSeed = seed + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set('seed', String(nextSeed));
    router.replace(`/demo-tour?${params.toString()}`);
  }, [seed, searchParams, router]);

  return (
    <div className="command-center-container" style={{ minHeight: '100vh', background: '#FFFFFF' }}>
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
              · Guided Demo Tour (BUILD-09)
            </span>
          </div>
        </div>

        {/* Unified 7-Tab Navigation Bar */}
        <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} aria-label="화면 탭">
          <Link href={buildCrossNavUrl('/', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            홈
          </Link>
          <Link href={buildCrossNavUrl('/traceability', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            웨이퍼 확인
          </Link>
          <Link href={buildCrossNavUrl('/command-center', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            알람 확인
          </Link>
          <Link href={buildCrossNavUrl('/equipment-intelligence', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            설비 살펴보기
          </Link>
          <Link href={buildCrossNavUrl('/fab-simulation', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            공정 체험
          </Link>
          <Link href={buildCrossNavUrl('/engineering-workspace', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            조사 노트
          </Link>
          <Link href={buildCrossNavUrl('/demo-tour', { mode: 'A', seed, tourStep: activeStepId })} className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            처음 둘러보기
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
            연습용 안내 · Mode A
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
              background: '#F1F5F9',
              color: '#475569',
              border: '1px solid #CBD5E1',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            Alert: {navLinks.alertId}
          </span>
          <button
            type="button"
            id="tour-btn-resynthesize"
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
            새 연습 데이터 만들기 (Seed: {seed}) ⟳
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
        <FriendlyPageIntro
  eyebrow="처음 둘러보기"
  title="8단계로 FAB ONE을 익혀 볼까요?"
  description="가상 공정에서 시작해 알람·센서·웨이퍼·조사 노트까지 자연스럽게 연결해 드려요. 원하는 단계에서 멈추거나 다시 시작할 수 있어요."
  primaryLabel="단계 조작으로 이동"
  primaryHref="#tour-btn-next"
  detail={<p>모든 단계는 브라우저의 연습 데이터(Mode A, Seed {seed})로 재현돼요. 실제 제조 장비나 실시간 FAB 기록과 연결하지 않아요.</p>}
/>

        {/* Tour Header Banner */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '18px 24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: '#ECFDF5',
                    color: '#047857',
                    border: '1px solid #A7F3D0',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  약 3분 · 단계별 안내
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>
                  {currentStep.stepNumber} / {TOUR_STEPS.length} 단계 · {progressPercent}% 진행
                </span>
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '6px 0 0 0' }}>
                함께 둘러보며 익혀 봐요
              </h1>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                id="tour-btn-prev"
                onClick={handlePrevStep}
                disabled={activeStepId === 'INTRO'}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: activeStepId === 'INTRO' ? '#F1F5F9' : '#FFFFFF',
                  color: activeStepId === 'INTRO' ? '#94A3B8' : '#334155',
                  cursor: activeStepId === 'INTRO' ? 'not-allowed' : 'pointer',
                }}
              >
                ← 이전으로
              </button>
              <button
                type="button"
                id="tour-btn-next"
                onClick={handleNextStep}
                disabled={activeStepId === 'FINISH'}
                style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: activeStepId === 'FINISH' ? '#E2E8F0' : '#0B9F78',
                  color: activeStepId === 'FINISH' ? '#94A3B8' : '#FFFFFF',
                  cursor: activeStepId === 'FINISH' ? 'not-allowed' : 'pointer',
                }}
              >
                다음으로 →
              </button>
              <button
                type="button"
                id="tour-btn-reset"
                onClick={handleResetTour}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#64748B',
                  cursor: 'pointer',
                }}
                title="투어를 첫 번째 단계로 초기화합니다"
              >
                처음으로 ↺
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', background: '#F1F5F9', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
            <div
              id="tour-progress-bar"
              style={{
                width: `${progressPercent}%`,
                background: '#0B9F78',
                height: '100%',
                transition: 'width 0.3s ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Step Indicator Pills (8 Steps) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          {TOUR_STEPS.map((step) => {
            const isActive = step.id === activeStepId;
            const isCompleted = step.stepNumber < currentStep.stepNumber;

            return (
              <button
                key={step.id}
                type="button"
                id={`tour-step-tab-${step.id}`}
                onClick={() => handleSelectStep(step.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: isActive ? '2px solid #0B9F78' : '1px solid #E2E8F0',
                  background: isActive ? '#F0FDF4' : isCompleted ? '#FFFFFF' : '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: isActive ? '#047857' : isCompleted ? '#0B9F78' : '#64748B',
                    }}
                  >
                    Step {step.stepNumber}
                  </span>
                  {isCompleted && (
                    <span style={{ fontSize: '10px', color: '#0B9F78', fontWeight: 800 }}>✓</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isActive ? '#0F172A' : '#334155',
                    marginTop: '2px',
                    lineHeight: 1.3,
                  }}
                >
                  {step.title.split(' ')[0]} {step.title.split(' ')[1] || ''}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Showcase Card */}
        <div
          id="active-step-showcase"
          data-step-id={currentStep.id}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <span
                style={{
                  background: '#ECFDF5',
                  color: '#047857',
                  border: '1px solid #A7F3D0',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                {currentStep.badgeText}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px 0' }}>
                {currentStep.stepNumber}. {currentStep.title}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748B' }}>{currentStep.subtitle}</div>
            </div>

            {/* Primary Action Button linking to actual screen */}
            <Link
              id="tour-btn-open-target"
              href={navLinks.targetUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0B9F78',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(11, 159, 120, 0.2)',
                transition: 'background 0.15s ease-in-out',
              }}
            >
              <span>{currentStep.actionLabel}</span>
            </Link>
          </div>

          {/* Description & Checkpoints */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#334155', margin: '0 0 8px 0' }}>
                공정 맥락 및 스토리 설명 (Process Context)
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {currentStep.description}
              </p>

              {/* Domain Safeguard Callout */}
              <div
                style={{
                  marginTop: '16px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#166534',
                  lineHeight: 1.45,
                }}
              >
                <strong>💡 도메인 핵심 기준:</strong> {currentStep.domainNotes}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '16px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
                이 단계에서 눈여겨볼 점
              </h3>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentStep.keyCheckpoints.map((cp, idx) => (
                  <li key={idx} style={{ fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
                    <strong>{cp}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Special Finish Step Showcase: 5 Key Engineering Judgment Takeaways */}
          {activeStepId === 'FINISH' && (
            <div
              id="tour-completion-summary-panel"
              style={{
                marginTop: '10px',
                paddingTop: '20px',
                borderTop: '1px dashed #CBD5E1',
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
                🎓 데모 내 엔지니어링 상황 판단 (5대 핵심 판단 요약)
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                {TOUR_COMPLETION_SUMMARY.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#047857', marginBottom: '4px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>{item.description}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: '#991B1B',
                }}
              >
                ※ 본 가이드 데모는 시뮬레이션 학습용이며, 실제 불량/원인 확정/양산 지표 예측/실제 설비 검사 실행
                주장을 포함하지 않습니다.
              </div>
            </div>
          )}
        </div>

        {/* Section: Cross-Screen Quick Navigation Hub */}
        <section
          aria-labelledby="section-quick-hub"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 id="section-quick-hub" style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              전체 화면 직접 이동 허브 (Direct Screen Access)
            </h3>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Run: <strong>{navLinks.runId}</strong> · Alert: <strong>{navLinks.alertId}</strong> 맥락 유지
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
            }}
          >
            <Link
              id="hub-link-home"
              href={navLinks.home}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>홈 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>챔버 상태 및 실시간 계측</div>
            </Link>

            <Link
              id="hub-link-simulation"
              href={navLinks.fabSimulation}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>FAB 시뮬레이션 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>T0~T7 공정 및 T7 일탈</div>
            </Link>

            <Link
              id="hub-link-command-center"
              href={navLinks.commandCenter}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>FDC 커맨드 센터 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>경보 큐 및 인터락 권고</div>
            </Link>

            <Link
              id="hub-link-equipment"
              href={navLinks.equipmentIntelligence}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>설비 인텔리전스 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>OES/압력/RF 시계열 분절</div>
            </Link>

            <Link
              id="hub-link-traceability"
              href={navLinks.traceability}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>웨이퍼 이력 추적성 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>W-08 잠재 영향군 검토</div>
            </Link>

            <Link
              id="hub-link-workspace"
              href={navLinks.engineeringWorkspace}
              style={{
                padding: '10px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                textDecoration: 'none',
                color: '#1E293B',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0B9F78' }}>엔지니어링 워크스페이스 ↗</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>증거·가설·조치 백보드</div>
            </Link>
          </div>
        </section>

        {/* Section: EKL Knowledge 사전 */}
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
            <span style={{ fontSize: '11px', color: '#64748B' }}>가이드 투어 연계 개념 해설</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 원리" showBadge />
            <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 제어" showBadge />
            <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 및 결측치" showBadge />
            <EngineeringTermTrigger conceptId="wafer-exposure-status" label="공정 이력과 영향 가능성" showBadge />
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
            도메인 안전 불변식 및 가이드 투어 고지 사항 (Domain Invariants)
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <li>
              <strong>통계적 일탈과 품질:</strong> {TOUR_DOMAIN_DISCLAIMERS.excursionVsDefect}
            </li>
            <li>
              <strong>웨이퍼 노출 이력 정의 (CONFIRMED_EXPOSED / CANDIDATE_EXPOSED):</strong>{' '}
              {TOUR_DOMAIN_DISCLAIMERS.exposureStatus}
            </li>
            <li>
              <strong>센서 결측치 처리 (MISSING ≠ 0):</strong> {TOUR_DOMAIN_DISCLAIMERS.missingNotZero}
            </li>
            <li>
              <strong>SPC 관리한계 vs 제품 규격 (UCL/LCL ≠ USL/LSL):</strong> {TOUR_DOMAIN_DISCLAIMERS.spcVsSpec}
            </li>
            <li>
              <strong>가설 검토 성격:</strong> {TOUR_DOMAIN_DISCLAIMERS.hypothesisDisclaimer}
            </li>
            <li>
              <strong>장비 제어 경계:</strong> {TOUR_DOMAIN_DISCLAIMERS.noRealFactoryControl}
            </li>
          </ul>
        </footer>
      </main>
    </div>
  );
}

export default function DemoTourPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC' }}>
          <div style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>
            FAB ONE 가이드 투어 로딩 중...
          </div>
        </div>
      }
    >
      <DemoTourContent />
    </Suspense>
  );
}

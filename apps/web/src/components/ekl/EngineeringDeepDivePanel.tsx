'use client';

import React, { useEffect, useRef } from 'react';
import { useEngineeringKnowledge } from './EngineeringKnowledgeContext';

export function EngineeringDeepDivePanel() {
  const { activeLevel, activeConcept, backToInsight, closeAll } = useEngineeringKnowledge();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (activeLevel === 3) {
      setTimeout(() => {
        titleRef.current?.focus();
      }, 50);
    }
  }, [activeLevel, activeConcept]);

  if (activeLevel !== 3 || !activeConcept) {
    return null;
  }

  const { sections } = activeConcept.deepDive;

  return (
    <>
      {/* Background Dim Backdrop */}
      <div
        className="ekl-overlay"
        onClick={closeAll}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(23, 38, 59, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 90,
        }}
      />

      {/* Level 3 Slide-out Side Drawer Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ekl-deep-title"
        className="ekl-deep-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 'min(560px, 100vw)',
          height: '100dvh',
          background: '#FFFFFF',
          borderLeft: '1px solid #DCE3ED',
          boxShadow: '-12px 0 40px rgba(23, 38, 59, 0.15)',
          zIndex: 96,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          animation: 'eklSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sticky Panel Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#FFFFFF',
            borderBottom: '1px solid #EDF1F5',
            padding: '20px 24px',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#076F5B',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              EKL · Level 3 / Deep Dive
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#48586D' }}>
              공학 경계 및 데이터 해석 패널
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              id="ekl-deep-back-btn"
              onClick={backToInsight}
              aria-label="계산/인사이트 카드로 돌아가기"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              ← L2 카드로
            </button>
            <button
              type="button"
              id="ekl-deep-close-btn"
              onClick={closeAll}
              aria-label="패널 닫기"
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                color: '#48586D',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Panel Content Body */}
        <div style={{ padding: '24px 28px', flex: 1 }}>
          {/* Main Title & Subtitle */}
          <div style={{ marginBottom: '20px' }}>
            <h2
              id="ekl-deep-title"
              ref={titleRef}
              tabIndex={-1}
              style={{
                margin: '0 0 6px',
                fontSize: '22px',
                fontWeight: 850,
                color: '#17263B',
                outline: 'none',
              }}
            >
              {activeConcept.deepDive.title}
            </h2>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
              {activeConcept.deepDive.subtitle}
            </div>
          </div>

          {/* Context Retention Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#DDF8EC',
              color: '#076F5B',
              fontSize: '11px',
              fontWeight: 700,
              marginBottom: '16px',
            }}
          >
            <span>🛡️ 화면 컨텍스트 유지 중:</span>
            <span>조사 중인 웨이퍼/알람 상태가 초기화되지 않습니다</span>
          </div>

          {/* Review Status Banner */}
          <div
            style={{
              background: '#FFFBF5',
              borderLeft: '3px solid #D97706',
              padding: '10px 14px',
              fontSize: '11px',
              color: '#78350F',
              borderRadius: '0 8px 8px 0',
              marginBottom: '24px',
              lineHeight: 1.5,
            }}
          >
            <strong>※ 도메인 검토 안내:</strong> {activeConcept.reviewStatus}. 공학적 수학 공식 및 통계 임계값은 정식 승인 전 가상 시뮬레이션용입니다.
          </div>

          {/* 5 Core Engineering Boundaries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* 1. Physical Quantity vs Process Meaning */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(23, 38, 59, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>🔬</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#17263B' }}>
                  1. 센서가 측정하는 물리량 vs 공정적 의미
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#334155' }}>
                {sections.physicalQuantityVsProcess}
              </p>
            </div>

            {/* 2. Control Limits (UCL/LCL) vs Specification Limits (USL/LSL) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(23, 38, 59, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>📊</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#17263B' }}>
                  2. 통계적 관리한계(UCL/LCL) vs 제품 규격한계(USL/LSL)
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#334155' }}>
                {sections.controlLimitsVsSpecLimits}
              </p>
            </div>

            {/* 3. MISSING vs Measured Zero (0) */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(23, 38, 59, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#17263B' }}>
                  3. 결측 데이터(MISSING) vs 실제 계측값 0
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#334155' }}>
                {sections.missingVsZero}
              </p>
            </div>

            {/* 4. Sensor Anomaly vs Confirmed Product Defect */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(23, 38, 59, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>🛡️</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#17263B' }}>
                  4. 센서 이상(Excursion) vs 제품 불량(Defect) 확정의 차이
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#334155' }}>
                {sections.sensorAnomalyVsDefect}
              </p>
            </div>

            {/* 5. Confirmed Exposed vs Candidate Exposed */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(23, 38, 59, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>🎯</span>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#17263B' }}>
                  5. 노출 확정(CONFIRMED) vs 잠재 영향 후보(CANDIDATE)
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: '#334155' }}>
                {sections.exposureStatusMeaning}
              </p>
            </div>
          </div>

          {/* Section: Learning Notes (Simulation Mock / Read-only) */}
          <div style={{ marginTop: '28px', borderTop: '1px solid #EDF1F5', paddingTop: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#48586D', marginBottom: '8px' }}>
              개인 학습 메모 · 시연용 (Simulation Only)
            </div>
            <textarea
              readOnly
              value="개인 메모 저장은 프로토타입/시연용으로 제공됩니다. 실제 IndexedDB 영속 UX는 향후 아키텍처 승인 후 적용되며, 현재 화면은 저장을 수행하지 않습니다."
              style={{
                width: '100%',
                minHeight: '70px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#64748B',
                resize: 'none',
              }}
            />
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
              ※ 시뮬레이션 리셋 시 기존 메모는 영향을 받지 않으며, 현재 화면은 브라우저 세션에 저장되지 않습니다.
            </div>
          </div>
        </div>

        {/* Sticky Panel Footer */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: '#FFFFFF',
            borderTop: '1px solid #EDF1F5',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={backToInsight}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← 계산 카드로
          </button>
          <button
            type="button"
            onClick={closeAll}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              background: '#17263B',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            조사 화면으로 복귀 (Esc)
          </button>
        </div>
      </aside>
    </>
  );
}

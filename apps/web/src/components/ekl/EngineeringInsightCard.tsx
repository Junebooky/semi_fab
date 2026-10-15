'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEngineeringKnowledge } from './EngineeringKnowledgeContext';
import { calculateEtchRate } from './engineering-knowledge';

export function EngineeringInsightCard() {
  const { activeLevel, activeConcept, openDeepDive, closeAll } = useEngineeringKnowledge();

  // Virtual Etch Rate calculator state
  const [t1, setT1] = useState<string>('200');
  const [t2, setT2] = useState<string>('140');
  const [time, setTime] = useState<string>('2.0');

  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus title on open for screen-reader and keyboard navigation
  useEffect(() => {
    if (activeLevel === 2) {
      setTimeout(() => {
        titleRef.current?.focus();
      }, 50);
    }
  }, [activeLevel, activeConcept]);

  if (activeLevel !== 2 || !activeConcept) {
    return null;
  }

  // Parse and calculate Etch Rate
  const numT1 = parseFloat(t1);
  const numT2 = parseFloat(t2);
  const numTime = parseFloat(time);
  const calcResult = calculateEtchRate(numT1, numT2, numTime);

  return (
    <>
      {/* Background Dim Backdrop */}
      <div
        className="ekl-overlay"
        onClick={closeAll}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(23, 38, 59, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 90,
        }}
      />

      {/* Level 2 Modal Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ekl-insight-title"
        className="ekl-insight-card"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'min(85vh, 760px)',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 24px 60px rgba(23, 38, 59, 0.22)',
          border: '1px solid #DCE3ED',
          zIndex: 95,
        }}
      >
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#0B9F78',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              EKL · Level 2 / Engineering Insight
            </div>
            <h2
              id="ekl-insight-title"
              ref={titleRef}
              tabIndex={-1}
              style={{
                margin: '6px 0 0',
                fontSize: '20px',
                fontWeight: 850,
                color: '#17263B',
                outline: 'none',
              }}
            >
              {activeConcept.koreanName}
            </h2>
          </div>
          <button
            type="button"
            id="ekl-insight-close-btn"
            onClick={closeAll}
            aria-label="공학 인사이트 닫기"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              fontSize: '20px',
              color: '#48586D',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Subhead Tags */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#F1F5F9',
              color: '#334155',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {activeConcept.term}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#DDF8EC',
              color: '#076F5B',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            단위: {activeConcept.unit}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            분류: {activeConcept.category}
          </span>
        </div>

        {/* Review Status Banner */}
        <div
          style={{
            background: '#FFFBF5',
            borderLeft: '3px solid #D97706',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#78350F',
            borderRadius: '0 8px 8px 0',
            marginBottom: '18px',
          }}
        >
          {activeConcept.reviewStatus}
        </div>

        {/* Section 1: Definition */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#48586D', margin: '0 0 6px', letterSpacing: '0.3px' }}>
            1. 공학적 개념 및 정의
          </h3>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#1E293B' }}>
            {activeConcept.definition}
          </p>
        </div>

        {/* Section 2: Calculation or Conceptual Model */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#48586D', margin: '0 0 8px', letterSpacing: '0.3px' }}>
            2. 계산 원리 및 산술 예제
          </h3>

          {activeConcept.conceptId === 'etch-rate' ? (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#076F5B', marginBottom: '8px' }}>
                가상 식각 속도 계산 시뮬레이터 (Virtual Sandbox)
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#0E3854',
                  fontWeight: 700,
                  marginBottom: '12px',
                }}
              >
                Etch Rate = (초기 박막 두께 − 종료 박막 두께) / 공정 시간
              </div>

              {/* Input Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label htmlFor="ekl-calc-t1" style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '3px' }}>
                    초기 두께 (nm)
                  </label>
                  <input
                    id="ekl-calc-t1"
                    type="number"
                    value={t1}
                    onChange={(e) => setT1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="ekl-calc-t2" style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '3px' }}>
                    종료 두께 (nm)
                  </label>
                  <input
                    id="ekl-calc-t2"
                    type="number"
                    value={t2}
                    onChange={(e) => setT2(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="ekl-calc-time" style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '3px' }}>
                    공정 시간 (min)
                  </label>
                  <input
                    id="ekl-calc-time"
                    type="number"
                    step="0.1"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>

              {/* Calculation Result Feedback */}
              {calcResult.success ? (
                <div
                  style={{
                    background: calcResult.warningMessage ? '#FFFBEB' : '#ECFDF5',
                    border: `1px solid ${calcResult.warningMessage ? '#FDE68A' : '#A7F3D0'}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: calcResult.warningMessage ? '#92400E' : '#065F46' }}>
                      계산 결과:
                    </span>
                    <strong style={{ fontSize: '16px', color: calcResult.warningMessage ? '#B45309' : '#047857' }}>
                      {calcResult.value} nm/min
                    </strong>
                  </div>
                  {calcResult.warningMessage && (
                    <div style={{ fontSize: '11px', color: '#B45309', marginTop: '4px' }}>
                      ⚠️ {calcResult.warningMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#B91C1C',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {calcResult.errorMessage}
                </div>
              )}

              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '8px' }}>
                ※ 실제 장비의 OES 계측값 [a.u.]에서 직접 유도된 값이 아니며, 박막 두께 측정 기반 가상 예제입니다.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '12px',
                lineHeight: 1.6,
                color: '#334155',
              }}
            >
              <div style={{ fontWeight: 700, color: '#17263B', marginBottom: '4px' }}>
                도메인 계산 전제 및 모델 상태:
              </div>
              <p style={{ margin: '0 0 8px' }}>{activeConcept.assumption}</p>
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: '#64748B',
                }}
              >
                현재 시연 데이터에서는 임의 수식 산출 대신 공학 원리 해석(L3)을 권장합니다.
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Interpretation Caveats */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#48586D', margin: '0 0 8px', letterSpacing: '0.3px' }}>
            3. 데이터 해석 시 주의사항 (Limitations)
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.6, color: '#475569' }}>
            {activeConcept.interpretationCaveats.map((c, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
            ))}
          </ul>
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #EDF1F5', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={closeAll}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#FFFFFF',
              border: '1px solid #DCE3ED',
              color: '#48586D',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            닫기 (Esc)
          </button>
          <button
            type="button"
            id="ekl-go-deep-btn"
            onClick={() => openDeepDive()}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#0B9F78',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(11, 159, 120, 0.25)',
            }}
          >
            <span>Level 3 · Deep Dive 패널 열기</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </>
  );
}

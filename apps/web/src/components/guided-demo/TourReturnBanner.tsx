'use client';

import React from 'react';
import Link from 'next/link';
import {
  parseSafeTourStep,
  getTourStepDetails,
  getNextTourStep,
} from './guided-demo-contract';

interface TourReturnBannerProps {
  tourStep?: string | null;
  seed: number;
}

export function TourReturnBanner({ tourStep, seed }: TourReturnBannerProps) {
  if (!tourStep) return null;
  const stepId = parseSafeTourStep(tourStep);
  const stepDetails = getTourStepDetails(stepId);
  const nextStepId = getNextTourStep(stepId);

  return (
    <div
      id="tour-return-banner"
      style={{
        background: 'linear-gradient(90deg, #ECFDF5 0%, #F0FDF4 100%)',
        border: '1px solid #A7F3D0',
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 1px 3px rgba(11, 159, 120, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            background: '#0B9F78',
            color: '#FFFFFF',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 800,
          }}
        >
          🧭 투어 진행 중
        </span>
        <div style={{ fontSize: '13px', color: '#065F46', fontWeight: 700 }}>
          Step {stepDetails.stepNumber}/8: {stepDetails.title}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          id="btn-return-to-tour"
          href={`/demo-tour?step=${stepId}&seed=${seed}`}
          style={{
            background: '#0B9F78',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 800,
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(11, 159, 120, 0.2)',
          }}
        >
          가이드 투어로 복귀 (Return to Tour) ↩
        </Link>
        {stepId !== 'FINISH' && (
          <Link
            id="btn-continue-next-tour-step"
            href={`/demo-tour?step=${nextStepId}&seed=${seed}`}
            style={{
              background: '#FFFFFF',
              color: '#0B9F78',
              border: '1px solid #0B9F78',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            다음 단계 ({nextStepId}) ➔
          </Link>
        )}
      </div>
    </div>
  );
}

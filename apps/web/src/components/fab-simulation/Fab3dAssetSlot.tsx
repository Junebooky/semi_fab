'use client';

import React from 'react';
import { PlasmaStatus, EquipmentStatus } from './fab-simulation-contract';

interface Fab3dAssetSlotProps {
  plasmaStatus: PlasmaStatus;
  equipmentStatus: EquipmentStatus;
  stepName: string;
}

export function Fab3dAssetSlot({ plasmaStatus, equipmentStatus, stepName }: Fab3dAssetSlotProps) {
  // Derive visual glow color and pulse based on plasma status
  let plasmaGlowColor = 'transparent';
  let plasmaFillColor = 'rgba(226, 232, 240, 0.2)';
  let isPulsing = false;
  let statusText = '플라즈마 미가동 (OFF)';

  if (plasmaStatus === 'IGNITING') {
    plasmaGlowColor = 'rgba(147, 51, 234, 0.4)';
    plasmaFillColor = 'rgba(192, 132, 252, 0.4)';
    isPulsing = true;
    statusText = '플라즈마 점화 중 (IGNITING)';
  } else if (plasmaStatus === 'STABLE_PLASMA') {
    plasmaGlowColor = 'rgba(168, 85, 247, 0.6)';
    plasmaFillColor = 'rgba(147, 51, 234, 0.6)';
    statusText = '안정 플라즈마 방전 (STABLE)';
  } else if (plasmaStatus === 'UNSTABLE_SPIKE') {
    plasmaGlowColor = 'rgba(239, 68, 68, 0.8)';
    plasmaFillColor = 'rgba(220, 38, 38, 0.8)';
    isPulsing = true;
    statusText = '플라즈마 서지 / 공정 일탈 (EXCURSION SPIKE)';
  } else if (plasmaStatus === 'PURGING') {
    plasmaGlowColor = 'rgba(59, 130, 246, 0.4)';
    plasmaFillColor = 'rgba(96, 165, 250, 0.3)';
    statusText = 'N2 퍼지 및 배기 (PURGING)';
  }

  return (
    <div
      id="fab-3d-asset-slot"
      style={{
        background: '#F8FAFC',
        border: '1.5px dashed #CBD5E1',
        borderRadius: '12px',
        padding: '16px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '220px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#475569',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>3D 시각화 자산 예약 슬롯 (Digital Twin Placeholder)</span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 700,
          background: plasmaStatus === 'UNSTABLE_SPIKE' ? '#FEE2E2' : '#F1F5F9',
          color: plasmaStatus === 'UNSTABLE_SPIKE' ? '#B91C1C' : '#334155',
          border: `1px solid ${plasmaStatus === 'UNSTABLE_SPIKE' ? '#FECACA' : '#E2E8F0'}`,
        }}
      >
        {statusText}
      </div>

      {/* SVG 2.5D Isometric Chamber Schematic */}
      <svg
        width="260"
        height="140"
        viewBox="0 0 260 140"
        style={{ marginTop: '20px', overflow: 'visible' }}
        aria-label="3D 챔버 디지털 트윈 슬롯 그래픽"
      >
        <defs>
          <filter id="plasma-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Chamber Outline Isometric Cylinder */}
        <ellipse cx="130" cy="30" rx="90" ry="24" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
        <path d="M 40 30 L 40 100 A 90 24 0 0 0 220 100 L 220 30" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" />
        <ellipse cx="130" cy="100" rx="90" ry="24" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />

        {/* Top Showerhead RF Electrode */}
        <ellipse cx="130" cy="38" rx="65" ry="16" fill="#CBD5E1" stroke="#64748B" strokeWidth="1.5" />
        <ellipse cx="130" cy="42" rx="45" ry="10" fill="#94A3B8" />

        {/* Bottom Electrostatic Chuck (ESC) & Wafer Pedestal */}
        <ellipse cx="130" cy="94" rx="60" ry="15" fill="#CBD5E1" stroke="#64748B" strokeWidth="1.5" />
        <ellipse cx="130" cy="91" rx="46" ry="11" fill="#3B82F6" opacity="0.85" stroke="#1D4ED8" strokeWidth="1" />
        <text x="130" y="94" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700">W-08 (타겟)</text>

        {/* Active Plasma Discharge Glow Volume */}
        {plasmaStatus !== 'OFF' && (
          <ellipse
            cx="130"
            cy="66"
            rx="55"
            ry="18"
            fill={plasmaFillColor}
            filter="url(#plasma-blur)"
            style={{
              transition: 'all 0.5s ease',
              animation: isPulsing ? 'pulseGlow 1s infinite alternate' : 'none',
            }}
          />
        )}
      </svg>

      <div
        style={{
          marginTop: '10px',
          fontSize: '11px',
          color: '#64748B',
          textAlign: 'center',
          lineHeight: '1.5',
        }}
      >
        향후 Blender / 3D 클레이 렌더링 자산 및 애니메이션이 마운트되는 통합 인터페이스 슬롯입니다.
        <br />
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>
          (현재: 경량 CSS/SVG 기반 반응형 가상 챔버 뷰어 구동 중 · 현재 단계: <strong>{stepName}</strong>)
        </span>
      </div>
    </div>
  );
}

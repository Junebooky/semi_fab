'use client';

import React, { useState, useRef } from 'react';
import { ConceptId, KNOWLEDGE_CONCEPTS } from './engineering-knowledge';
import { useEngineeringKnowledge } from './EngineeringKnowledgeContext';

interface EngineeringTermTriggerProps {
  conceptId: ConceptId;
  label?: React.ReactNode;
  showBadge?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function EngineeringTermTrigger({
  conceptId,
  label,
  showBadge = false,
  className = '',
  style,
}: EngineeringTermTriggerProps) {
  const { openInsight } = useEngineeringKnowledge();
  const [showTooltip, setShowTooltip] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const concept = KNOWLEDGE_CONCEPTS[conceptId];
  if (!concept) return null;

  const displayText = label || concept.term;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openInsight(conceptId, triggerRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      openInsight(conceptId, triggerRef.current);
    }
  };

  return (
    <span
      className="ekl-term-wrap"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        id={`ekl-trigger-${conceptId}`}
        className={`ekl-knowledge-term ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-haspopup="dialog"
        aria-label={`${concept.term} (${concept.koreanName}) - 공학 지식 레이어 열기`}
        title={`${concept.term} - 클릭하여 공학 지식(L2) 확인`}
        style={{
          background: 'none',
          border: 'none',
          padding: '1px 3px',
          borderBottom: '1.5px dotted #0B9F78',
          color: '#076F5B',
          fontWeight: 700,
          cursor: 'pointer',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          ...style,
        }}
      >
        <span>{displayText}</span>
        {showBadge && (
          <span
            className="ekl-mini-badge"
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '9999px',
              background: '#DDF8EC',
              color: '#076F5B',
              fontWeight: 800,
              letterSpacing: '0.2px',
            }}
          >
            EKL
          </span>
        )}
      </button>

      {/* Accessible Tooltip (L1 Hover/Focus Preview) */}
      {showTooltip && (
        <span
          role="tooltip"
          className="ekl-tooltip-box"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            maxWidth: '90vw',
            background: '#17263B',
            color: '#FFFFFF',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '11px',
            lineHeight: 1.5,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(23, 38, 59, 0.25)',
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ color: '#A4E9C8', fontWeight: 800 }}>{concept.term}</strong>
            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: '4px' }}>
              {concept.unit}
            </span>
          </span>
          <span style={{ display: 'block', color: '#E2E8F0', marginBottom: '6px' }}>
            {concept.summary}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16B88A', fontWeight: 700, fontSize: '10px' }}>
            <span>클릭 또는 Enter 키로 공학 인사이트(L2) 보기 ↗</span>
          </span>
        </span>
      )}
    </span>
  );
}

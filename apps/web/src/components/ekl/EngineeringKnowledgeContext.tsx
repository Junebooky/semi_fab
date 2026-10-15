'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { ConceptId, KNOWLEDGE_CONCEPTS, KnowledgeConcept } from './engineering-knowledge';

interface EKLContextValue {
  activeLevel: 0 | 2 | 3;
  activeConceptId: ConceptId | null;
  activeConcept: KnowledgeConcept | null;
  openInsight: (conceptId: ConceptId, triggerElement?: HTMLElement | null) => void;
  openDeepDive: (conceptId?: ConceptId) => void;
  backToInsight: () => void;
  closeAll: () => void;
}

const EngineeringKnowledgeContext = createContext<EKLContextValue | null>(null);

export function useEngineeringKnowledge(): EKLContextValue {
  const ctx = useContext(EngineeringKnowledgeContext);
  if (!ctx) {
    throw new Error('useEngineeringKnowledge must be used within an EngineeringKnowledgeProvider');
  }
  return ctx;
}

export function EngineeringKnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [activeLevel, setActiveLevel] = useState<0 | 2 | 3>(0);
  const [activeConceptId, setActiveConceptId] = useState<ConceptId | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const activeConcept = activeConceptId ? KNOWLEDGE_CONCEPTS[activeConceptId] ?? null : null;

  const openInsight = useCallback((conceptId: ConceptId, triggerElement?: HTMLElement | null) => {
    if (triggerElement) {
      triggerRef.current = triggerElement;
    } else if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
    setActiveConceptId(conceptId);
    setActiveLevel(2);
  }, []);

  const openDeepDive = useCallback((conceptId?: ConceptId) => {
    if (conceptId) {
      setActiveConceptId(conceptId);
    }
    setActiveLevel(3);
  }, []);

  const backToInsight = useCallback(() => {
    setActiveLevel(2);
  }, []);

  const closeAll = useCallback(() => {
    setActiveLevel(0);
    const origin = triggerRef.current;
    if (origin && typeof document !== 'undefined' && document.contains(origin)) {
      setTimeout(() => {
        try {
          origin.focus();
        } catch {
          // ignore focus error
        }
      }, 50);
    }
  }, []);

  // Manage inert attribute on background app-container when modal is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const appContainers = document.querySelectorAll<HTMLElement>('.app-container');
    if (activeLevel !== 0) {
      appContainers.forEach((el) => {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      });
    } else {
      appContainers.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
    }

    return () => {
      appContainers.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
    };
  }, [activeLevel]);

  // Keyboard navigation: Escape key handling
  useEffect(() => {
    if (activeLevel === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeLevel === 3) {
          backToInsight();
        } else if (activeLevel === 2) {
          closeAll();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLevel, backToInsight, closeAll]);

  return (
    <EngineeringKnowledgeContext.Provider
      value={{
        activeLevel,
        activeConceptId,
        activeConcept,
        openInsight,
        openDeepDive,
        backToInsight,
        closeAll,
      }}
    >
      {children}
    </EngineeringKnowledgeContext.Provider>
  );
}
